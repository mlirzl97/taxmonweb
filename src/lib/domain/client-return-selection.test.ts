import { describe, expect, it } from "vitest";

import { governedReturnForms, returnMatchesSearch, returnsSuggestedFromSource, sourceTaxTypeCodesFromWording } from "./client-return-selection";

describe("client return selection", () => {
  it("derives source tax categories without turning them into approved returns", () => {
    expect(sourceTaxTypeCodesFromWording("Income Tax; VAT; Withholding Tax")).toEqual(["CIT", "VAT", "WHT"]);
    expect(returnsSuggestedFromSource("Withholding Tax").map((form) => form.formNumber)).toContain("0619-E");
    expect(returnsSuggestedFromSource("Withholding Tax").map((form) => form.formNumber)).toContain("1601-EQ");
  });

  it("matches form numbers with or without punctuation", () => {
    const form = returnsSuggestedFromSource("Withholding Tax").find((candidate) => candidate.formNumber === "1601-EQ");
    expect(form).toBeDefined();
    if (form) expect(returnMatchesSearch(form, "1601EQ")).toBe(true);
  });

  it("promotes exact form references found in the source wording", () => {
    expect(returnsSuggestedFromSource("2303 lists 0619E and 1601EQ").map((form) => form.formNumber)).toEqual(expect.arrayContaining(["0619-E", "1601-EQ"]));
  });

  it("keeps quarterly and annual corporate income-tax returns distinct while retaining 0605 as a catalog form", async () => {
    const { forms } = await import("./tax-foundation-catalog");
    expect(forms.find((form) => form.formNumber === "1702Q")?.usualTiming).toContain("Quarterly");
    expect(forms.find((form) => form.formNumber === "1702-RT")?.usualTiming).toContain("Annual");
    expect(forms.find((form) => form.formNumber === "0605")?.title).toBe("Payment Form");
    expect(governedReturnForms.some((form) => form.formNumber === "0605")).toBe(false);
  });
});
