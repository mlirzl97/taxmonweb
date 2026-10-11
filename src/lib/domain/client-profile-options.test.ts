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
});
