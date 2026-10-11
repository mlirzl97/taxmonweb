import { NextResponse } from "next/server";

import { listLiveTeamMembers, saveLiveTeamMemberProfile, type SaveLiveTeamMemberProfileInput } from "@/lib/server/team-repository";
import { isPrototypeDemoMode } from "@/lib/supabase/config";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export async function GET() {
  if (!(await getAuthenticatedUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json({ data: await listLiveTeamMembers(), source: "live", fixtureSafe: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Team." }, { status: 500 });
  }
}

function responseError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to save the Team profile.";
  const status = /authorized|authentication|capability|outside|reporting|career|organization/i.test(message) ? 403 : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (isPrototypeDemoMode()) return NextResponse.json({ error: "Prototype mode uses the sanitized browser roster." }, { status: 409 });
  if (!(await getAuthenticatedUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  if (input.action !== "save" || !input.payload || typeof input.payload !== "object") {
    return NextResponse.json({ error: "Unsupported Team action." }, { status: 400 });
  }

  const payload = input.payload as Record<string, unknown>;
  const requiredStrings = ["userId", "title", "organizationUnitId", "effectiveFrom", "careerServiceLevel", "operatingModel"];
  if (requiredStrings.some((key) => typeof payload[key] !== "string" || !String(payload[key]).trim())) {
    return NextResponse.json({ error: "User, title, organizational unit, effective date, career level, and operating model are required." }, { status: 400 });
  }

  const roleKey = payload.roleKey;
  const operatingModel = payload.operatingModel;
  if (!["system_admin", "leader", "team_member", "reviewer"].includes(String(roleKey))) return NextResponse.json({ error: "The selected operating role is not supported." }, { status: 400 });
  if (!["engagement_agile", "engagement_dedicated", "tax_team"].includes(String(operatingModel))) return NextResponse.json({ error: "The selected operating model is not supported." }, { status: 400 });

  const command: SaveLiveTeamMemberProfileInput = {
    userId: String(payload.userId),
    roleKey: String(roleKey) as SaveLiveTeamMemberProfileInput["roleKey"],
    title: String(payload.title).trim(),
    organizationUnitId: String(payload.organizationUnitId),
    effectiveFrom: String(payload.effectiveFrom),
    active: payload.active === true,
    careerServiceLevel: String(payload.careerServiceLevel),
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
