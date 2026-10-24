import { beforeEach, describe, expect, it, vi } from "vitest";

import { fixtureClients, type FixtureClient } from "@/lib/fixtures";

const published = vi.fn();
const held = vi.fn();

vi.mock("@/lib/server/generated-work-repository", () => ({
  listLiveClientCalendarEntries: (...args: unknown[]) => published(...args),
  listHeldCalendarPeriods: (...args: unknown[]) => held(...args),
  listRequirementIdsForFormNumbers: async () => ["req-1601c"],
}));

const { loadClientServiceCalendar } = await import("./client-calendar");

function client(): FixtureClient {
  const base = fixtureClients[0];
  const unit = { ...(base.entities[0].units[0] ?? { name: "Head office", type: "Head office" }), id: "unit-1" } as FixtureClient["entities"][number]["units"][number];
  return { ...base, entities: [{ ...base.entities[0], units: [unit], profile: { ...base.entities[0].profile, taxYearBasis: "Calendar year", fiscalYearEnd: "December 31", firstPeriodToFile: "2026-03", goLiveDate: "2026-03-01" } }] };
}

function publishedEntry(id: string, month: string, label: string, due: string) {
  return {
    id, requirement_id: "req-1601c", requirement_version_id: "v1", external_requirement_label: label, period_or_event: label,
    period_start: null, period_end: null, base_statutory_deadline: null, adjusted_statutory_deadline: due, tmf_package_target: null,
    published_operational_deadline: due, publication_status: "published" as const, calendar_year: 2026, calendar_month: month,
    requirement_code: "BIR-1601-C", requirement_name: "Compensation withholding", operating_category: "wht", frequency_label: "monthly", form_number: "1601-C",
  };
}

function heldPeriod(id: string, month: string, label: string) {
  return {
    entry_id: id, requirement_id: "req-1601c", requirement_code: "BIR-1601-C", requirement_name: "Compensation withholding",
    frequency_label: "monthly", operating_category: "wht", period_or_event: label, period_start: null, calendar_month: month,
    publication_status: "unresolved" as const, form_numbers: ["1601-C"],
  };
}

describe("client service calendar: periods waiting on the Tax Team", () => {
  beforeEach(() => {
    published.mockReset();
    held.mockReset();
  });

  it("keeps an unpublished period visible as held, once, with no date", async () => {
    published.mockResolvedValue([publishedEntry("aug", "2026-09-01", "BIR Form 1601-C - Non-eFPS Filers. Month of August 2026", "2026-09-10")]);
    held.mockResolvedValue([
      heldPeriod("sep-a", "2026-10-01", "BIR Form 1601-C - eFPS Filers under Group A. Month of September 2026"),
      heldPeriod("sep-n", "2026-10-01", "BIR Form 1601-C - Non-eFPS Filers. Month of September 2026"),
    ]);
    const calendar = await loadClientServiceCalendar(client(), 2026, ["1601-C"]);
    expect(calendar.rows.map((row) => row.periodStartDate)).toEqual(["2026-08-01"]);
    expect(calendar.heldRows).toHaveLength(1);
    expect(calendar.heldRows[0]).toMatchObject({ formNumber: "1601-C", periodStartDate: "2026-09-01", publishedOperationalDeadline: null, adjustedStatutoryDeadline: null });
    expect(held).toHaveBeenCalledWith("unit-1", ["req-1601c"], 2026);
  });

  it("does not list a period as held when a published row already covers it", async () => {
    published.mockResolvedValue([publishedEntry("sep", "2026-10-01", "BIR Form 1601-C - Non-eFPS Filers. Month of September 2026", "2026-10-10")]);
    held.mockResolvedValue([heldPeriod("sep-a", "2026-10-01", "BIR Form 1601-C - eFPS Filers under Group A. Month of September 2026")]);
    const calendar = await loadClientServiceCalendar(client(), 2026, ["1601-C"]);
    expect(calendar.heldRows).toHaveLength(0);
    expect(calendar.rows).toHaveLength(1);
  });

  it("holds nothing before the first period to file", async () => {
    published.mockResolvedValue([]);
    held.mockResolvedValue([heldPeriod("jan", "2026-02-01", "BIR Form 1601-C - Non-eFPS Filers. Month of January 2026")]);
    const calendar = await loadClientServiceCalendar(client(), 2026, ["1601-C"]);
    expect(calendar.heldRows).toHaveLength(0);
  });

  it("says so when the database cannot list held periods yet, instead of showing none", async () => {
    published.mockResolvedValue([]);
    held.mockResolvedValue(null);
    const calendar = await loadClientServiceCalendar(client(), 2026, ["1601-C"]);
    expect(calendar.notices.join(" ")).toContain("cannot be listed until the latest database update is applied");
  });
});
