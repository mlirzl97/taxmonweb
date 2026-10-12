import { NextResponse } from "next/server";

import { staffAccessProfileDefinition, isStaffAccessProfile, type StaffScopeKind } from "@/lib/domain/staff-access";
import { apiErrorResponse, inferredApiErrorStatus } from "@/lib/server/api-error";
import { requireApiCapabilities } from "@/lib/server/api-authorization";
import { asRecord } from "@/lib/server/request-input";
import { applicationOrigin, requireSameOrigin } from "@/lib/server/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const scopeKinds: readonly StaffScopeKind[] = ["own_assigned_work", "team_tower", "cluster", "cross_portfolio_tax_control", "all_a_and_t"];
const roleKeys = ["system_admin", "leader", "team_member", "reviewer"] as const;
const operatingModels = ["engagement_agile", "engagement_dedicated", "tax_team"] as const;
const careerLevels = ["5.2", "5.1", "4.2", "4.1", "3.2", "3.1", "2.2", "2.1", "1.1"] as const;

function stringValue(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength ? value.trim() : null;
}

export async function POST(request: Request) {
  const denied = await requireApiCapabilities(["AdministerUsers"]);
  if (denied) return denied;
  const originDenied = requireSameOrigin(request);
  if (originDenied) return originDenied;

  const admin = createSupabaseAdminClient();
  const client = await createSupabaseServerClient();
  if (!admin || !client) return NextResponse.json({ error: "Private account provisioning is not configured on this environment." }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const input = asRecord(body);
  const email = stringValue(input?.email, 254)?.toLowerCase();
  const displayName = stringValue(input?.displayName, 120);
  const accessProfile = input?.accessProfile;
  const title = stringValue(input?.title, 120);
  const organizationUnitId = stringValue(input?.organizationUnitId, 80);
  const effectiveFrom = stringValue(input?.effectiveFrom, 10);
  const careerServiceLevel = stringValue(input?.careerServiceLevel, 3);
  const reportsToUserId = typeof input?.reportsToUserId === "string" && input.reportsToUserId ? input.reportsToUserId : null;
  const operatingModel = input?.operatingModel;
  const scopeKind = input?.scopeKind;
  const scopeOrganizationUnitId = typeof input?.scopeOrganizationUnitId === "string" && input.scopeOrganizationUnitId ? input.scopeOrganizationUnitId : null;
  const reportingLineExceptionReason = typeof input?.reportingLineExceptionReason === "string" ? input.reportingLineExceptionReason.trim().slice(0, 500) || null : null;
  const reason = stringValue(input?.reason, 500);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid approved work email." }, { status: 400 });
  if (!displayName || !title || !organizationUnitId || !effectiveFrom || !careerServiceLevel || !reason) return NextResponse.json({ error: "Name, title, organizational unit, effective date, career level, and reason are required." }, { status: 400 });
  if (!uuidPattern.test(organizationUnitId) || (reportsToUserId && !uuidPattern.test(reportsToUserId)) || (scopeOrganizationUnitId && !uuidPattern.test(scopeOrganizationUnitId))) return NextResponse.json({ error: "The selected organization reference is invalid." }, { status: 400 });
  if (!datePattern.test(effectiveFrom) || !careerLevels.includes(careerServiceLevel as typeof careerLevels[number])) return NextResponse.json({ error: "The effective date or career level is invalid." }, { status: 400 });
  if (!isStaffAccessProfile(accessProfile) || !scopeKinds.includes(scopeKind as StaffScopeKind) || !operatingModels.includes(operatingModel as typeof operatingModels[number])) return NextResponse.json({ error: "The selected access profile, scope, or operating model is invalid." }, { status: 400 });

  const profile = staffAccessProfileDefinition(accessProfile);
  const roleKey = profile.roleKey;
  if (!roleKeys.includes(roleKey)) return NextResponse.json({ error: "The selected staff profile is not supported." }, { status: 400 });
  if (scopeKind !== "team_tower" && scopeKind !== "cluster" && scopeOrganizationUnitId) return NextResponse.json({ error: "This access scope does not use an organization unit." }, { status: 400 });
  if ((scopeKind === "team_tower" || scopeKind === "cluster") && !scopeOrganizationUnitId) return NextResponse.json({ error: "Select the organization unit for this access scope." }, { status: 400 });

  const redirectTo = new URL("/auth/callback?next=/activate", `${applicationOrigin(request)}/`).toString();
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { display_name: displayName },
    redirectTo,
  });
  if (inviteError || !invited.user) {
    return apiErrorResponse(inviteError ?? new Error("No Auth user was created."), "The staff account could not be created. The email may already have an account.", { status: 409, logContext: "invite staff account" });
  }

  try {
    const { data, error } = await client.rpc("provision_pending_staff", {
      p_user_id: invited.user.id,
      p_display_name: displayName,
      p_access_profile: accessProfile,
      p_role_key: roleKey,
      p_title: title,
      p_organization_unit_id: organizationUnitId,
      p_effective_from: effectiveFrom,
      p_career_service_level: careerServiceLevel,
      p_reports_to_user_id: reportsToUserId,
      p_operating_model: operatingModel,
      p_reporting_line_exception_reason: reportingLineExceptionReason,
      p_capability_keys: profile.capabilities,
      p_scope_kind: scopeKind,
      p_scope_organization_unit_id: scopeOrganizationUnitId,
      p_reason: reason,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ data, activationSent: true }, { status: 201 });
  } catch (error) {
    // The Auth identity was created by this request and has no usable access
    // unless provisioning succeeds. Remove only this newly-created identity.
    await admin.auth.admin.deleteUser(invited.user.id);
    return apiErrorResponse(error, "The staff account was not provisioned. No usable account was retained.", { status: inferredApiErrorStatus(error, 422), logContext: "provision staff profile and access" });
  }
}
