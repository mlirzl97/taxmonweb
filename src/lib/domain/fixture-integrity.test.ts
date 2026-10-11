import { describe, expect, it } from "vitest";

import { getFixtureIntegrityIssues } from "./fixture-integrity";

describe("sanitized fixture integrity", () => {
  it("reconciles client, employee, work, calendar, exception, and specialist records", () => {
    expect(getFixtureIntegrityIssues()).toEqual([]);
  });
});
