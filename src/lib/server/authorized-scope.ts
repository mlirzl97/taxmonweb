import { isPrototypeDemoMode } from "@/lib/supabase/config";
import { getAuthenticatedRequestContext } from "@/lib/supabase/server";
import type { ScopeFilter } from "@/lib/control-tower-state";
import { fixtureOrganizationScopes } from "@/lib/domain/organization-catalog";

type OrganizationUnit = { id: string; code: string; name: string; unit_kind: string };
type ScopeAssignment = { scope_kind: string; organization_unit_id: string | null };

const SERVER_ACCESS_TIMEOUT_MS = 3500;

async function withTimeout<T>(operation: PromiseLike<T>, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), SERVER_ACCESS_TIMEOUT_MS);
  });
  try {
    return await Promise.race([Promise.resolve(operation), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function towerScopeForUnit(unit: OrganizationUnit | undefined): Exclude<ScopeFilter, "all"> | null {
  if (!unit) return null;
  // Fixture projection mapping is intentionally exact. Fuzzy name matching can
  // silently widen or misroute an authorized live scope.
  return fixtureOrganizationScopes.find((scope) => scope.code === unit.code)?.filterId ?? null;
}

/**
 * Resolve one fixture projection only when the authenticated assignments are
 * unambiguous. A missing, failed, or ambiguous scope must never widen a view.
 */
export function resolveTowerScope(assignments: readonly ScopeAssignment[], units: readonly OrganizationUnit[]): ScopeFilter | null {
  if (assignments.some((assignment) => assignment.scope_kind === "all_a_and_t" || assignment.scope_kind === "cross_portfolio_tax_control")) return "all";

  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  const mapped = assignments.map((assignment) =>
    towerScopeForUnit(assignment.organization_unit_id ? unitById.get(assignment.organization_unit_id) : undefined),
  );
  if (mapped.some((scope) => scope === null)) return null;

  const resolved = [...new Set(mapped.filter((scope): scope is Exclude<ScopeFilter, "all"> => Boolean(scope)))];

  return resolved.length === 1 ? resolved[0] : null;
}

/**
 * Resolves the display projection from server-side access assignments.
 * The database/RLS remains the security boundary; this value only scopes
 * fixture-backed control-tower projections until those records are live.
 */
export async function getAuthorizedControlTowerScope(): Promise<ScopeFilter | null> {
  if (isPrototypeDemoMode()) return "all";

  const { client, user } = await withTimeout(getAuthenticatedRequestContext(), { client: null, user: null });
  if (!user || !client) return null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());

  const { data: assignments, error: assignmentError } = await withTimeout(
    client
      .from("user_scope_assignments")
      .select("scope_kind, organization_unit_id")
      .eq("user_id", user.id)
      .lte("effective_from", today)
      .or(`effective_to.is.null,effective_to.gte.${today}`),
    { data: [] as ScopeAssignment[], error: null, count: 0, status: 200, statusText: "OK", success: true },
  );

  if (assignmentError || !assignments?.length) return null;

  const unitIds = assignments.flatMap((assignment) => assignment.organization_unit_id ? [assignment.organization_unit_id] : []);
  if (unitIds.length === 0) return resolveTowerScope(assignments, []);

  const { data: units, error: unitError } = await withTimeout(
    client.from("organization_units").select("id, code, name, unit_kind").in("id", unitIds),
    { data: [] as OrganizationUnit[], error: null, count: 0, status: 200, statusText: "OK", success: true },
  );
  if (unitError || !units) return null;
  return resolveTowerScope(assignments, units as OrganizationUnit[]);
}
