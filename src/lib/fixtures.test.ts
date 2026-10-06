import { describe, expect, it } from "vitest";

import { fixtureClients, fixtureEnvironment, fixtureExceptions, fixtureWork, isSanitizedFixtureText, validateFixtureSet } from "./fixtures";

describe("demo fixture mechanism", () => {
  it("clearly labels local demo data and keeps external documents out of fixtures", () => {
    expect(validateFixtureSet()).toBe(true);
    expect(fixtureEnvironment.label).toBe("REVIEW MODE");
    expect(fixtureEnvironment.description).toContain("No live client information");
    expect(fixtureClients.some((item) => item.name === "Lakeshore Apparel Services")).toBe(true);
    expect(fixtureWork.every((item) => !item.client.includes("synthetic"))).toBe(true);
    expect(fixtureExceptions.every((item) => !item.client.includes("synthetic"))).toBe(true);
  });

  it("rejects prohibited sensitive-looking references", () => {
    expect(isSanitizedFixtureText("real TIN 123")).toBe(false);
    expect(isSanitizedFixtureText("https://example.sharepoint.com/file")).toBe(false);
    expect(isSanitizedFixtureText("synthetic fixture only")).toBe(true);
  });
});
