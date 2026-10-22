import { describe, expect, it } from "vitest";

import { birOfficeCode, birOfficeLabel, clientEfpsGroupOptions, clientProfileControlErrors, prototypeBirOfficeOptions } from "./client-profile-options";

describe("client profile controlled references", () => {
  it("keeps the sanitized RDO fallback in the same display shape as BIR Center", () => {
    expect(birOfficeLabel("RDO-50")).toBe("RDO 050 - South Makati City");
    expect(birOfficeCode("RDO 050 - South Makati City", prototypeBirOfficeOptions)).toBe("RDO-50");
  });

  it("does not surface ungoverned office text as a selectable office", () => {
    expect(birOfficeLabel("Illustrative RDO/LTS context")).toBe("Needs review");
    expect(birOfficeCode("Illustrative RDO/LTS context", prototypeBirOfficeOptions)).toBe("Needs review");
  });

  it("exposes only source-backed eFPS group labels", () => {
    expect(clientEfpsGroupOptions).toEqual(["Group A", "Group B", "Group C", "Group D", "Group E"]);
  });

  it("rejects legacy free-text controlled values at the intake boundary", () => {
    expect(clientProfileControlErrors({ filingChannel: "eFPS", eFPSGroup: "Synthetic eFPS group" })).toEqual([
      "profileData.eFPSGroup must use an approved option.",
    ]);
    expect(clientProfileControlErrors({ filingChannel: "eFPS", eFPSGroup: "Group B", rdoOrLts: "RDO-50" })).toEqual([]);
  });
  it("checks the file location and first period on profile corrections", () => {
    expect(clientProfileControlErrors({ permanentFileLink: "TBD" })).toEqual([
      "profileData.permanentFileLink must be a SharePoint link (https://…), a network share (\\\\server\\share) or a mapped drive path (S:\\…).",
    ]);
    expect(clientProfileControlErrors({ permanentFileLink: "https://mock-tenant.sharepoint.invalid/sites/AT/MOCK-Voltline" })).toEqual([]);
    expect(clientProfileControlErrors({ permanentFileLink: "\\\\fileserver\\AT\\Voltline" })).toEqual([]);
    expect(clientProfileControlErrors({ goLiveDate: "2026-03-01", firstPeriodToFile: "2026-02" })).toEqual(["profileData.firstPeriodToFile cannot be before the go-live month."]);
    expect(clientProfileControlErrors({ goLiveDate: "2026-03-01", firstPeriodToFile: "2026-03" })).toEqual([]);
    expect(clientProfileControlErrors({ goLiveDate: "2026-03-01", firstPeriodToFile: "2026-13" })).toEqual(["profileData.firstPeriodToFile must use YYYY-MM."]);
    expect(clientProfileControlErrors({ firstPeriodToFile: "2026-00" })).toEqual(["profileData.firstPeriodToFile must use YYYY-MM."]);
    expect(clientProfileControlErrors({ firstPeriodToFile: " 2026-07 " })).toEqual(["profileData.firstPeriodToFile must use YYYY-MM."]);
  });
});
