import { describe, expect, it } from "vitest";

import { fixtureCalendar, fixtureClients, fixtureClock, fixtureEnvironment, fixtureExceptions, fixtureWork, isSanitizedFixtureText, validateFixtureSet } from "./fixtures";
import { filterFixtureOperationalRecords, getFixtureOperationalRecords, getFixtureWorkRegisterRecords } from "./fixtures-read-model";

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

  it("uses one operational fixture read model for calendar/work joins", () => {
    const records = getFixtureOperationalRecords();
    expect(records).toHaveLength(fixtureCalendar.length);
    expect(records.every((record) => fixtureWork.some((work) => work.id === record.work.id))).toBe(true);
    expect(fixtureClock.today).toBe("2026-10-05");
  });

  it("derives a one-row-per-work register from due milestones", () => {
    const records = getFixtureWorkRegisterRecords(getFixtureOperationalRecords());
    expect(records).toHaveLength(fixtureWork.length);
    expect(records.find((record) => record.work.id === "work-02")?.milestones).toHaveLength(2);
    expect(records.find((record) => record.work.id === "work-02")?.work.steps.at(-1)?.state).toBe("current");
  });

  it("shares due filtering semantics with the Due Register", () => {
    const records = getFixtureOperationalRecords();
    const today = filterFixtureOperationalRecords(records, { due: "today", scope: "all", status: "all" });
    const blocked = filterFixtureOperationalRecords(records, { due: "blocked", scope: "all", status: "all" });
    const noMatch = filterFixtureOperationalRecords(records, { due: "all", scope: "north", status: "RED" });

    expect(today.map((record) => record.work.id)).toEqual(["work-01"]);
    expect(blocked.map((record) => record.work.id)).toEqual(["work-01"]);
    expect(noMatch).toHaveLength(0);
  });
});
