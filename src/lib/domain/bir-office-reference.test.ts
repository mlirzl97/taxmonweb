import { describe, expect, it } from "vitest";

import { formatBirOfficeLabel, toBirOfficeOption } from "./bir-office-reference";

describe("BIR office reference", () => {
  it("formats RDO codes with the complete office name", () => {
    expect(formatBirOfficeLabel("RDO-50", "South Makati City")).toBe("RDO 050 - South Makati City");
    expect(toBirOfficeOption({ official_code: "RDO-17A", official_name: "East Batangas City" })).toEqual({
      code: "RDO-17A",
      name: "East Batangas City",
      label: "RDO 017A - East Batangas City",
    });
  });
});
