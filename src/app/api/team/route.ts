import { NextResponse } from "next/server";

import { careerServiceLevelLabels, careerServiceLevelTitle, type CareerServiceLevel } from "@/lib/domain/team";
import { listLiveTeamMembers, saveLiveTeamMemberProfile, type SaveLiveTeamMemberProfileInput } from "@/lib/server/team-repository";
import { apiErrorResponse, inferredApiErrorStatus } from "@/lib/server/api-error";
import { requireApiCapability } from "@/lib/server/api-authorization";
import { requireSameOrigin } from "@/lib/server/request-origin";
import { asRecord, isNonEmptyString } from "@/lib/server/request-input";
import { isPrototypeDemoMode } from "@/lib/supabase/config";

export async function GET() {
  const denied = await requireApiCapability(["ViewScopedPortfolio", "CorrectTaxProfile", "MaintainClientRepository", "AdministerUsers", "AdministerOrganization"]);
  if (denied) return denied;

  try {
    return NextResponse.json({ data: await listLiveTeamMembers(), source: "live", fixtureSafe: true });
  } catch (error) {
    return apiErrorResponse(error, "Unable to load Team.", { logContext: "load Team" });
  }
}

function responseError(error: unknown) {
  return apiErrorResponse(error, "Unable to save the Team profile.", { status: inferredApiErrorStatus(error), logContext: "save Team profile" });
}

export async function POST(request: Request) {
  const denied = await requireApiCapability(["AdministerUsers", "AdministerOrganization"]);
  if (denied) return denied;
  const originDenied = requireSameOrigin(request);
  if (originDenied) return originDenied;
  if (isPrototypeDemoMode()) return NextResponse.json({ error: "Prototype mode uses the sanitized browser roster." }, { status: 409 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const input = asRecord(body);
  if (!input || input.action !== "save") {
    return NextResponse.json({ error: "Unsupported Team action." }, { status: 400 });
  }

  const payload = asRecord(input.payload);
  if (!payload) return NextResponse.json({ error: "Unsupported Team action." }, { status: 400 });
  const requiredStrings = ["userId", "organizationUnitId", "effectiveFrom", "careerServiceLevel", "operatingModel"];
  if (requiredStrings.some((key) => !isNonEmptyString(payload[key]))) {
    return NextResponse.json({ error: "User, organizational unit, effective date, career level, and operating model are required." }, { status: 400 });
  }

  const roleKey = payload.roleKey;
  const operatingModel = payload.operatingModel;
  if (!["system_admin", "leader", "team_member", "reviewer"].includes(String(roleKey))) return NextResponse.json({ error: "The selected operating role is not supported." }, { status: 400 });
  if (!["engagement_agile", "engagement_dedicated", "tax_team"].includes(String(operatingModel))) return NextResponse.json({ error: "The selected operating model is not supported." }, { status: 400 });
  const careerServiceLevel = String(payload.careerServiceLevel) as CareerServiceLevel;
  if (!(careerServiceLevel in careerServiceLevelLabels)) return NextResponse.json({ error: "The selected career level is not supported." }, { status: 400 });

  const command: SaveLiveTeamMemberProfileInput = {
    userId: String(payload.userId),
    roleKey: String(roleKey) as SaveLiveTeamMemberProfileInput["roleKey"],
    title: careerServiceLevelTitle(careerServiceLevel),
    organizationUnitId: String(payload.organizationUnitId),
    effectiveFrom: String(payload.effectiveFrom),
    active: payload.active === true,
    careerServiceLevel,
    reportsToUserId: typeof payload.reportsToUserId === "string" && payload.reportsToUserId ? payload.reportsToUserId : null,
    operatingModel: String(operatingModel) as SaveLiveTeamMemberProfileInput["operatingModel"],
    reportingLineExceptionReason: typeof payload.reportingLineExceptionReason === "string" && payload.reportingLineExceptionReason.trim() ? payload.reportingLineExceptionReason.trim() : null,
  };

  try {
    return NextResponse.json({ data: await saveLiveTeamMemberProfile(command), source: "repository" });
  } catch (error) {
    return responseError(error);
  }
}
