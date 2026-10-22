import { NextResponse } from "next/server";

import { portfolioClientToFixtureClient } from "@/lib/domain/live-client-adapter";
import type { FixtureClient } from "@/lib/fixtures";
import { workGenerationItems } from "@/lib/domain/work-generation";
import { apiErrorResponse, inferredApiErrorStatus } from "@/lib/server/api-error";
import { requireApiCapability } from "@/lib/server/api-authorization";
import { loadClientServiceCalendar } from "@/lib/server/client-calendar";
import { getPortfolioClient, type PortfolioClient } from "@/lib/server/client-repository";
import {
  approveExpectedCompliance,
  decideExpectedComplianceItem,
  expectedCompliancePermissions,
  listExpectedCompliance,
  proposeExpectedCompliance,
  recordGeneratedComplianceWork,
} from "@/lib/server/expected-compliance-repository";
import { requireSameOrigin } from "@/lib/server/request-origin";
import { asRecord, isNonEmptyString } from "@/lib/server/request-input";

type RouteContext = { params: Promise<{ clientId: string }> };

/**
 * The Registration Unit addressed: the one the request names, which must
 * belong to this client, or else the head office (the unit the dossier saves).
 */
function registrationUnitId(client: PortfolioClient, requested: unknown) {
  const units = client.taxpayer_entities.flatMap((entity) => entity.registration_units);
  if (typeof requested === "string" && requested) return units.find((unit) => unit.id === requested)?.id ?? null;
  return (units.find((unit) => unit.active && unit.unit_kind === "head_office") ?? units.find((unit) => unit.active))?.id ?? null;
}

async function loadContext(context: RouteContext, requestedUnitId: unknown) {
  const portfolioClient = await getPortfolioClient((await context.params).clientId);
  if (!portfolioClient) return null;
  const unitId = registrationUnitId(portfolioClient, requestedUnitId);
  return unitId ? { portfolioClient, unitId } : null;
}

function clientForUnit(client: FixtureClient, unitId: string): FixtureClient {
  for (const entity of client.entities) {
    const unit = entity.units.find((candidate) => candidate.id === unitId);
    if (unit) return { ...client, entities: [{ ...entity, profile: unit.profile, units: [unit] }] };
  }
  return client;
}

/** Generates work for every approved In TMF Scope return, from the first period to file through next year. */
async function generate(portfolioClient: PortfolioClient, unitId: string) {
  const { items } = await listExpectedCompliance(unitId);
  const approvedForms = items.filter((item) => item.status === "approved" && item.serviceScope === "in_scope").map((item) => item.formNumber);
  if (approvedForms.length === 0) return { created: 0, existing: 0, skipped: [] };
  // Generation follows the approved Expected Compliance, not a newer profile whose
  // changes are still awaiting approval; the unit's profile supplies its first period.
  const client = clientForUnit(portfolioClientToFixtureClient(portfolioClient), unitId);
  const firstPeriod = client.entities[0]?.profile.firstPeriodToFile ?? "";
  const currentYear = new Date().getUTCFullYear();
  const firstYear = /^\d{4}-\d{2}$/.test(firstPeriod) ? Math.min(Number(firstPeriod.slice(0, 4)), currentYear) : currentYear;
  const generationItems = [];
  for (let year = firstYear; year <= currentYear + 1; year += 1) {
    const calendar = await loadClientServiceCalendar(client, year, approvedForms);
    generationItems.push(...workGenerationItems(calendar.rows, approvedForms));
  }
  return recordGeneratedComplianceWork(unitId, generationItems);
}

export async function GET(request: Request, context: RouteContext) {
  const denied = await requireApiCapability(["ReviewTaxProfile", "ViewScopedPortfolio", "ProposeComplianceUniverse", "ApproveComplianceUniverse"]);
  if (denied) return denied;
  try {
    const loaded = await loadContext(context, new URL(request.url).searchParams.get("registrationUnitId"));
    if (!loaded) return NextResponse.json({ error: "Client or Registration Unit not found." }, { status: 404 });
    const [expected, permissions] = await Promise.all([listExpectedCompliance(loaded.unitId), expectedCompliancePermissions()]);
    return NextResponse.json({ data: expected, permissions });
  } catch (error) {
    return apiErrorResponse(error, "Unable to load Expected Compliance.", { status: inferredApiErrorStatus(error), logContext: "load expected compliance" });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const originDenied = requireSameOrigin(request);
  if (originDenied) return originDenied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const command = asRecord(body);
  const action = command?.action;
  const capabilities = action === "approve" ? ["ApproveComplianceUniverse"]
    : action === "generate" ? ["ApproveComplianceUniverse", "MaintainGeneratedComplianceWork"]
    : ["ProposeComplianceUniverse", "ApproveComplianceUniverse"];
  const denied = await requireApiCapability(capabilities);
  if (denied) return denied;

  try {
    const loaded = await loadContext(context, command?.registrationUnitId);
    if (!loaded) return NextResponse.json({ error: "Client or Registration Unit not found." }, { status: 404 });
    if (action === "propose") {
      const proposed = await proposeExpectedCompliance(loaded.unitId);
      return NextResponse.json({ proposed });
    }
    if (action === "decide") {
      if (!isNonEmptyString(command?.itemId) || !isNonEmptyString(command?.decision)) return NextResponse.json({ error: "An item and a decision are required." }, { status: 400 });
      const reason = typeof command?.reason === "string" && command.reason.trim() ? command.reason.trim() : null;
      await decideExpectedComplianceItem(loaded.unitId, command.itemId, command.decision, reason);
      return NextResponse.json({ ok: true });
    }
    if (action === "approve") {
      const reason = typeof command?.reason === "string" ? command.reason.trim() : "";
      if (!reason) return NextResponse.json({ error: "A reason is required to approve Expected Compliance." }, { status: 400 });
      const approved = await approveExpectedCompliance(loaded.unitId, reason, command?.elevatedOverride === true);
      // Approval is what makes work generate: set up once, generate automatically.
      const generation = await generate(loaded.portfolioClient, loaded.unitId);
      return NextResponse.json({ approved, generation });
    }
    if (action === "generate") {
      return NextResponse.json({ generation: await generate(loaded.portfolioClient, loaded.unitId) });
    }
    return NextResponse.json({ error: "Unknown Expected Compliance command." }, { status: 400 });
  } catch (error) {
    // The self-approval refusal is a control outcome the approver must see, not an internal error.
    if (error instanceof Error && /another approver must approve/.test(error.message)) {
      return NextResponse.json({ error: "You recorded some of these decisions; another approver must approve them." }, { status: 403 });
    }
    return apiErrorResponse(error, "Unable to apply the Expected Compliance command.", { status: inferredApiErrorStatus(error), logContext: "apply expected compliance command" });
  }
}
