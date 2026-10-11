import { describe, expect, it } from "vitest";

import { fixtureCalendar, fixtureClients, fixtureClock, fixtureEnvironment, fixtureExceptions, fixtureWork, isSanitizedFixtureText, validateFixtureSet } from "./fixtures";
import { filterFixtureOperationalRecords, getFixtureOperationalRecords, getFixtureWorkRegisterRecords, getLiveOperationalRecords } from "./fixtures-read-model";

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

  it("keeps newly created work in the shared operational projection", () => {
    const addedWork = { ...fixtureWork[0], id: "work-test-created", title: "Test created work" };
    const records = getFixtureOperationalRecords([...fixtureWork, addedWork]);

    expect(records.some((record) => record.work.id === addedWork.id)).toBe(true);
    expect(records.find((record) => record.work.id === addedWork.id)?.calendar.milestone).toBe("Work target");
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
    const noMatch = filterFixtureOperationalRecords(records, { due: "all", scope: "tower-a", status: "RED" });

    expect(today.map((record) => record.work.id)).toEqual(["work-01"]);
    expect(blocked.map((record) => record.work.id)).toEqual(["work-01", "work-04"]);
    expect(noMatch).toHaveLength(0);
  });

  it("recognizes an ISO target before the review date as overdue", () => {
    const liveShapedWork = { ...fixtureWork[0], id: "work-live-overdue", deadline: "2026-10-01" };
    const records = getFixtureOperationalRecords([liveShapedWork]);
    const overdue = filterFixtureOperationalRecords(records, { due: "overdue", scope: "all", status: "all" });

    expect(overdue.map((record) => record.work.id)).toEqual(["work-live-overdue"]);
  });

  it("keeps the live operational projection independent from fixture clients and calendar rows", () => {
    const liveWork = { ...fixtureWork[0], id: "live-work-unresolved", deadline: "Deadline unresolved", clientId: "client-from-supabase" };
    const records = getLiveOperationalRecords([liveWork]);

    expect(records).toHaveLength(1);
    expect(records[0]?.client).toBeUndefined();
    expect(records[0]?.calendar.client).toBe(liveWork.client);
    expect(records[0]?.calendar.statutoryDeadline).toBe("Rule unresolved");
  });

  it("keeps returned correction work visible in general attention", () => {
    const records = getFixtureOperationalRecords();
    const attention = filterFixtureOperationalRecords(records, { due: "attention", scope: "all", status: "all" });

    expect(attention.some((record) => record.work.returnedFrom)).toBe(true);
    expect(records.find((record) => record.work.returnedFrom)?.work.id).toBe("work-02");
  });

  it("includes a preparer-facing data gap and separate attachment control", () => {
    const preparerWork = fixtureWork.find((work) => work.id === "work-04");

    expect(preparerWork?.stage).toBe("PREPARE");
    expect(preparerWork?.blocker?.category).toBe("CLIENT DATA");
    expect(preparerWork?.components.map((component) => component.label)).toEqual(["Submission", "Payment", "Attachments", "Evidence"]);
  });

  it("keeps audit history as linked open and closed context, not a second case tracker", () => {
    const profile = fixtureClients.find((client) => client.id === "fixture-client-05")?.entities[0]?.profile;
    expect(profile?.auditExposures.map((audit) => audit.status)).toEqual(["Open", "Closed"]);
    expect(profile?.auditExposures.every((audit) => audit.source.includes("CRF"))).toBe(true);
  });
});
