import { fixtureCalendar, fixtureClients, fixtureClock, fixtureWork, type FixtureScope, type FixtureStatus } from "@/lib/fixtures";

export type DuePreset = "all" | "today" | "next-5" | "week" | "overdue" | "attention" | "blocked" | "statutory";

export type FixtureOperationalRecord = {
  calendar: (typeof fixtureCalendar)[number];
  work: (typeof fixtureWork)[number];
  client: (typeof fixtureClients)[number] | undefined;
  scope: FixtureScope;
  status: FixtureStatus;
};

export type FixtureWorkRegisterRecord = {
  work: (typeof fixtureWork)[number];
  calendar: (typeof fixtureCalendar)[number];
  milestones: Array<(typeof fixtureCalendar)[number]>;
  client: (typeof fixtureClients)[number] | undefined;
  scope: FixtureScope;
  status: FixtureStatus;
};

export function dateValue(value: string) {
  return new Date(`${value}T00:00:00`).getTime();
}

/** One read-model boundary for calendar, due-register, and tower projections. */
export function getFixtureOperationalRecords(): FixtureOperationalRecord[] {
  return fixtureCalendar.flatMap((calendar) => {
    const work = fixtureWork.find((candidate) => candidate.id === calendar.workId);
    if (!work) return [];
    return [{ calendar, work, client: fixtureClients.find((candidate) => candidate.id === calendar.clientId), scope: calendar.scope, status: work.status }];
  });
}

export function getFixtureOperationalRecord(workId: string): FixtureOperationalRecord | undefined {
  return getFixtureOperationalRecords().find((record) => record.work.id === workId);
}

export function filterFixtureOperationalRecords(
  records: FixtureOperationalRecord[],
  filters: { scope: "all" | "north" | "central" | "south"; due: DuePreset; status: "all" | FixtureStatus; search?: string; dateFilter?: string | null },
) {
  const query = filters.search?.trim().toLowerCase() ?? "";

  return records.filter(({ calendar: item, work }) => {
    if (filters.scope !== "all" && item.scope !== ({ north: "Tower North", central: "Tower Central", south: "Tower South" }[filters.scope])) return false;
    if (filters.dateFilter && item.calendarDate !== filters.dateFilter) return false;

    const daysFromReview = Math.round((dateValue(item.calendarDate) - dateValue(fixtureClock.today)) / 86_400_000);
    if (filters.due === "today" && daysFromReview !== 0) return false;
    if (filters.due === "next-5" && (daysFromReview < 0 || daysFromReview > 5)) return false;
    if (filters.due === "week" && (daysFromReview < 0 || daysFromReview > 7)) return false;
    if (filters.due === "overdue" && !work.deadline.toLowerCase().includes("overdue") && !item.internalDeadline.toLowerCase().includes("overdue")) return false;
    if (filters.due === "attention" && work.status === "GREEN") return false;
    if (filters.due === "blocked" && !work.blocker) return false;
    if (filters.due === "statutory" && (item.statutoryDeadline === "Rule unresolved" || work.status !== "RED")) return false;
    if (filters.status !== "all" && work.status !== filters.status) return false;
    if (query && ![item.client, item.returnLabel, item.period, work.title, work.owner, work.stage, work.registrationUnit].some((value) => value.toLowerCase().includes(query))) return false;
    return true;
  });
}

/**
 * Work Register is a one-row-per-work projection over the Due Register's
 * operational records. Calendar milestones remain available as context.
 */
export function getFixtureWorkRegisterRecords(records = getFixtureOperationalRecords()): FixtureWorkRegisterRecord[] {
  const grouped = new Map<string, FixtureWorkRegisterRecord>();

  for (const record of records) {
    const current = grouped.get(record.work.id);
    if (current) {
      current.milestones.push(record.calendar);
      current.milestones.sort((a, b) => dateValue(a.calendarDate) - dateValue(b.calendarDate));
      continue;
    }

    grouped.set(record.work.id, {
      work: record.work,
      calendar: record.calendar,
      milestones: [record.calendar],
      client: record.client,
      scope: record.scope,
      status: record.status,
    });
  }

  return [...grouped.values()].map((record) => ({
    ...record,
    calendar: [...record.milestones].sort((a, b) => dateValue(a.calendarDate) - dateValue(b.calendarDate)).find((item) => item.calendarDate >= fixtureClock.today) ?? record.milestones[record.milestones.length - 1],
  }));
}

export function getFixtureClock() {
  return fixtureClock;
}
