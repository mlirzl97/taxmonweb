import { describe, expect, it } from "vitest";

import {
  canViewerActOnWorkRole,
  canViewerEditTaxProfile,
  canViewerExecuteWork,
  canViewerManageModule,
  canViewerOverride,
  canViewerPerformTeamAction,
  canViewerSetDataReadiness,
  canViewerViewModule,
  isViewerLeader,
  viewerModuleLevel,
  type ViewerAccess,
} from "./viewer-access";

function viewer(userId: string, capabilities: string[]): ViewerAccess {
  return { userId, capabilities: new Set(capabilities) };
}

const staff = viewer("staff-1", ["ViewAssignedWork", "ViewScopedPortfolio", "ExecuteGeneratedComplianceWork"]);
const viewerOnly = viewer("viewer-1", ["ViewAssignedWork", "ViewScopedPortfolio", "ViewTaxControlHistory"]);
const teamLead = viewer("lead-1", ["ViewAssignedWork", "ViewScopedPortfolio", "ExecuteGeneratedComplianceWork", "AdministerOrganization"]);
const hod = viewer("hod-1", [
  "ViewAssignedWork", "ViewScopedPortfolio", "ExecuteGeneratedComplianceWork", "ReviewTaxProfile", "CorrectTaxProfile",
  "ValidateTaxProfile", "ViewTaxControlHistory", "MaintainClientRepository", "AdministerUsers", "AdministerOrganization",
  "MaintainGeneratedComplianceWork", "MaintainDeadlineControl", "ManageWorkPeriodLock", "PerformWorkQA",
]);
const assigned = { PREPARER: "staff-1", CHECKER: "staff-2", REVIEWER: "lead-1" };

describe("viewer module access", () => {
  it("mirrors the server module guard", () => {
    expect(canViewerViewModule(staff, "work")).toBe(true);
    expect(canViewerViewModule(staff, "tax_team")).toBe(false);
    expect(canViewerViewModule(staff, "admin")).toBe(false);
    expect(canViewerViewModule(viewerOnly, "tax_team")).toBe(true);
    expect(canViewerViewModule(teamLead, "admin")).toBe(true);
  });

  it("lets every signed-in person read BIR Center", () => {
    expect(canViewerViewModule(viewer("x", []), "bir_center")).toBe(true);
    expect(canViewerManageModule(hod, "bir_center")).toBe(false);
  });

  it("reserves record management for the owning capability", () => {
    expect(canViewerManageModule(staff, "clients")).toBe(false);
    expect(canViewerManageModule(hod, "clients")).toBe(true);
    expect(viewerModuleLevel(staff, "work")).toBe("ACT");
    expect(viewerModuleLevel(viewerOnly, "work")).toBe("VIEW");
    expect(viewerModuleLevel(staff, "admin")).toBe("NONE");
  });
});

describe("viewer team actions", () => {
  it("requires both administration capabilities to add a person, as the API does", () => {
    expect(canViewerPerformTeamAction(teamLead, "ADD_PERSON")).toBe(false);
    expect(canViewerPerformTeamAction(hod, "ADD_PERSON")).toBe(true);
  });

  it("allows viewing without allowing changes", () => {
    expect(canViewerPerformTeamAction(staff, "VIEW_PERSON")).toBe(true);
    expect(canViewerPerformTeamAction(staff, "EDIT_STRUCTURE")).toBe(false);
    expect(canViewerPerformTeamAction(teamLead, "EDIT_STRUCTURE")).toBe(true);
  });
});

describe("viewer leadership", () => {
  it("treats tower, cluster, and wider scopes as leadership", () => {
    expect(isViewerLeader({ ...staff, scopeKinds: new Set(["own_assigned_work"]) })).toBe(false);
    expect(isViewerLeader({ ...teamLead, scopeKinds: new Set(["cluster"]) })).toBe(true);
    expect(isViewerLeader({ ...hod, scopeKinds: new Set(["all_a_and_t"]) })).toBe(true);
    expect(isViewerLeader(staff)).toBe(false);
  });
});

describe("viewer work actions", () => {
  it("lets only the assigned person act on a role", () => {
    expect(canViewerActOnWorkRole(staff, assigned, "PREPARER")).toBe(true);
    expect(canViewerActOnWorkRole(staff, assigned, "CHECKER")).toBe(false);
    expect(canViewerActOnWorkRole(staff, assigned, "REVIEWER")).toBe(false);
  });

  it("does not let an unassigned role act on unassigned work", () => {
    expect(canViewerActOnWorkRole(staff, {}, "PREPARER")).toBe(false);
    expect(canViewerActOnWorkRole(staff, undefined, "PREPARER")).toBe(false);
  });

  it("does not let an assigned viewer act without execute authority", () => {
    expect(canViewerActOnWorkRole(viewerOnly, { PREPARER: "viewer-1" }, "PREPARER")).toBe(false);
  });

  it("treats elevated authority as able to act on any role, matching the database", () => {
    expect(canViewerOverride(hod)).toBe(true);
    expect(canViewerOverride(teamLead)).toBe(false);
    expect(canViewerActOnWorkRole(hod, assigned, "CHECKER")).toBe(true);
  });

  it("never offers work controls without execute authority, even with elevated capabilities", () => {
    const maintainOnly = viewer("maint-1", ["ViewScopedPortfolio", "MaintainGeneratedComplianceWork", "PerformElevatedOverride"]);
    expect(canViewerOverride(maintainOnly)).toBe(true);
    expect(canViewerExecuteWork(maintainOnly)).toBe(false);
    expect(canViewerActOnWorkRole(maintainOnly, assigned, "PREPARER")).toBe(false);
    expect(canViewerActOnWorkRole(maintainOnly, { PREPARER: "maint-1" }, "PREPARER")).toBe(false);
  });

  it("limits Tax Control steps to period-lock or override authority", () => {
    expect(canViewerActOnWorkRole(staff, assigned, "TAX_CONTROL")).toBe(false);
    expect(canViewerActOnWorkRole(hod, assigned, "TAX_CONTROL")).toBe(true);
  });
});

describe("viewer action-specific controls", () => {
  it("lets execute or maintenance authority record Data Readiness without a Preparer assignment, as the command allows", () => {
    expect(canViewerSetDataReadiness(viewer("maint-2", ["ViewScopedPortfolio", "MaintainGeneratedComplianceWork"]))).toBe(true);
    expect(canViewerSetDataReadiness(teamLead)).toBe(true);
    expect(canViewerSetDataReadiness(staff)).toBe(true);
    expect(canViewerSetDataReadiness(viewerOnly)).toBe(false);
  });

  it("lets Tax Profile correction authority edit the profile without repository maintenance", () => {
    expect(canViewerEditTaxProfile(viewer("corrector", ["ReviewTaxProfile", "CorrectTaxProfile"]))).toBe(true);
    expect(canViewerEditTaxProfile(viewer("reviewer", ["ReviewTaxProfile"]))).toBe(false);
    expect(canViewerEditTaxProfile(hod)).toBe(true);
  });
});
