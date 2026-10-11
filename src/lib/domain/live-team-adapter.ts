import type { FixtureTeamMember } from "@/lib/fixtures";
import type { LiveTeamMember } from "@/lib/server/team-repository";

function scopeFromUnit(unitKind: string | null, unitCode: string | null, unitName: string | null): FixtureTeamMember["tower"] {
  if (unitKind !== "tower") return "All A&T";
  const value = `${unitCode ?? ""} ${unitName ?? ""}`.toLowerCase();
  if (value.includes("tower-b")) return "Tower B";
  if (value.includes("tower-c")) return "Tower C";
  if (value.includes("tower-a")) return "Tower A";
  return "All A&T";
}

function clusterFromUnit(unitKind: string | null): string {
  // A tower is not a cluster. Keep the missing relationship visible until a
  // canonical cluster assignment exists in the live organization model.
  if (unitKind === "cluster") return "Configured cluster";
  return "Organization not configured";
}

function profileRemark(unitName: string | null, unitKind: string | null): string | undefined {
  if (!unitName) return "Team profile requires setup.";
  if (unitKind !== "cluster") return "Cluster relationship requires setup.";
  return undefined;
}

function safeEmail() {
  return "Not configured";
}

function roleFromKey(roleKey: string | null): FixtureTeamMember["role"] {
  if (roleKey === "reviewer") return "Reviewer";
  if (roleKey === "leader") return "HOD / Leader";
  if (roleKey === "system_admin") return "System Admin";
  return "Team Member";
}

function operatingModel(): FixtureTeamMember["operatingModel"] {
  return "ENGAGEMENT_AGILE";
}

function operatingModelFromLive(value: LiveTeamMember["operatingModel"]): FixtureTeamMember["operatingModel"] {
  if (value === "engagement_dedicated") return "ENGAGEMENT_DEDICATED";
  if (value === "tax_team") return "TAX_TEAM";
  return operatingModel();
}

export function adaptLiveTeamMember(member: LiveTeamMember): FixtureTeamMember {
  return {
    id: member.id,
    name: member.name,
    title: member.title ?? "Profile not configured",
    role: roleFromKey(member.roleKey),
    tower: scopeFromUnit(member.organizationUnitKind, member.organizationUnitCode, member.organizationUnitName),
    cluster: clusterFromUnit(member.organizationUnitKind),
    active: member.active,
    email: safeEmail(),
    organizationUnitId: member.organizationUnitId,
    operatingModel: operatingModelFromLive(member.operatingModel),
    ...(member.operatingModel === "tax_team" ? { specialistTeam: "Tax Team" as const } : {}),
    careerServiceLevel: member.careerServiceLevel ?? undefined,
    reportsToOrgNodeId: member.reportsToUserId,
    reportingLineExceptionReason: member.reportingLineExceptionReason ?? undefined,
    effectiveFrom: member.effectiveFrom ?? undefined,
    remarks: profileRemark(member.organizationUnitName, member.organizationUnitKind),
  };
}
