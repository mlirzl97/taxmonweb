import { describe, expect, it } from "vitest";

import { adaptLiveTeamMember } from "./live-team-adapter";

const liveMember = (overrides: Partial<Parameters<typeof adaptLiveTeamMember>[0]> = {}) => ({
  id: "user-1",
  name: "A. Staff",
  active: true,
  reportsToUserId: null,
  roleKey: "staff",
  title: null,
  organizationUnitId: "unit-1",
  organizationUnitCode: "FIXTURE-TOWER-A",
  organizationUnitName: "Tower A",
  organizationUnitKind: "tower",
  careerServiceLevel: null,
  operatingModel: "engagement_agile" as const,
  reportingLineExceptionReason: null,
  effectiveFrom: null,
  effectiveTo: null,
  ...overrides,
});

describe("adaptLiveTeamMember", () => {
  it("preserves the canonical tower instead of defaulting every live person to Tower A", () => {
    expect(adaptLiveTeamMember(liveMember({ organizationUnitCode: "FIXTURE-TOWER-B", organizationUnitName: "Tower B" }))).toMatchObject({ tower: "Tower B" });
    expect(adaptLiveTeamMember(liveMember({ organizationUnitCode: "FIXTURE-TOWER-C", organizationUnitName: "Tower C" }))).toMatchObject({ tower: "Tower C" });
  });

  it("does not infer a cluster from a tower assignment", () => {
    expect(adaptLiveTeamMember(liveMember())).toMatchObject({ cluster: "Organization not configured", remarks: "Cluster relationship requires setup." });
  });

  it("keeps unknown organization units unresolved", () => {
    expect(adaptLiveTeamMember(liveMember({ organizationUnitCode: "UNRESOLVED", organizationUnitName: "Unresolved", organizationUnitKind: "tower" }))).toMatchObject({ tower: "All A&T" });
  });

  it("maps persisted operating models and reporting exceptions into the Team domain", () => {
    expect(adaptLiveTeamMember(liveMember({ operatingModel: "engagement_dedicated" }))).toMatchObject({ operatingModel: "ENGAGEMENT_DEDICATED" });
    expect(adaptLiveTeamMember(liveMember({ operatingModel: "tax_team", reportingLineExceptionReason: "Tax control coverage" }))).toMatchObject({ operatingModel: "TAX_TEAM", specialistTeam: "Tax Team", reportingLineExceptionReason: "Tax control coverage" });
  });
});
