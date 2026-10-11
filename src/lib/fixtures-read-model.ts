import { fixtureCalendar, fixtureClients, fixtureClock, fixtureWork, type FixtureScope, type FixtureStatus } from "@/lib/fixtures";
import { scopeValueForFilter } from "@/lib/control-tower-state";
import type { OrganizationScopeFilter } from "@/lib/domain/organization-catalog";

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

export type OperationalReadModelSource = {
  calendar: readonly (typeof fixtureCalendar)[number][];
  clients: readonly (typeof fixtureClients)[number][];
  today: string;
};

export function dateValue(value: string) {
  return new Date(`${value}T00:00:00`).getTime();
}

function calendarDateForWork(work: (typeof fixtureWork)[number], today: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(work.deadline) ? work.deadline : today;
}

/** One read-model boundary for calendar, due-register, and tower projections. */
export function getOperationalRecords(workItems: readonly (typeof fixtureWork)[number][], source: OperationalReadModelSource): FixtureOperationalRecord[] {
  const workById = new Map(workItems.map((work) => [work.id, work]));
  const records = source.calendar.flatMap((calendar) => {
    const work = workById.get(calendar.workId);
    if (!work) return [];
    return [{ calendar, work, client: source.clients.find((candidate) => candidate.id === calendar.clientId), scope: calendar.scope, status: work.status }];
  });

  // Work created or edited through the Work Register must immediately appear
  // in the same operational projection as the Calendar and Control Tower.
  // A missing milestone is represented as an unresolved work target rather
  // than silently disappearing from management views.
  const calendarWorkIds = new Set(records.map((record) => record.work.id));
  for (const work of workItems) {
    if (calendarWorkIds.has(work.id)) continue;
    const client = source.clients.find((candidate) => candidate.id === work.clientId);
    records.push({
      calendar: {
        id: `calendar-${work.id}`,
        calendarDate: calendarDateForWork(work, source.today),
        dateGroup: work.deadline === source.today ? "Today" : "Scheduled",
        date: work.deadline,
        milestone: "Work target",
        returnKey: work.id,
        returnLabel: work.title,
        period: work.period,
        statutoryDeadline: "Rule unresolved",
        internalDeadline: work.deadline,
        serviceMilestone: work.nextAction,
        client: work.client,
        clientId: work.clientId,
        scope: work.scope,
        workId: work.id,
        type: work.deadlineType,
        status: work.status,
        detail: work.detail,
      } as (typeof fixtureCalendar)[number],
      work,
      client,
      scope: work.scope,
      status: work.status,
    });
  }

  return records;
}

export function getFixtureOperationalRecords(workItems: readonly (typeof fixtureWork)[number][] = fixtureWork): FixtureOperationalRecord[] {
  return getOperationalRecords(workItems, { calendar: fixtureCalendar, clients: fixtureClients, today: fixtureClock.today });
}

export function getLiveOperationalRecords(workItems: readonly (typeof fixtureWork)[number][]): FixtureOperationalRecord[] {
  return getOperationalRecords(workItems, { calendar: [], clients: [], today: new Date().toISOString().slice(0, 10) });
}

export function getFixtureOperationalRecord(workId: string, workItems: readonly (typeof fixtureWork)[number][] = fixtureWork): FixtureOperationalRecord | undefined {
  return getFixtureOperationalRecords(workItems).find((record) => record.work.id === workId);
}

export function filterFixtureOperationalRecords(
  records: FixtureOperationalRecord[],
  filters: { scope: OrganizationScopeFilter; due: DuePreset; status: "all" | FixtureStatus; search?: string; dateFilter?: string | null; today?: string },
) {
  const query = filters.search?.trim().toLowerCase() ?? "";
  const today = filters.today ?? fixtureClock.today;

  return records.filter(({ calendar: item, work }) => {
    if (filters.scope !== "all" && item.scope !== scopeValueForFilter(filters.scope)) return false;
    if (filters.dateFilter && item.calendarDate !== filters.dateFilter) return false;

    const daysFromReview = Math.round((dateValue(item.calendarDate) - dateValue(today)) / 86_400_000);
    if (filters.due === "today" && daysFromReview !== 0) return false;
    if (filters.due === "next-5" && (daysFromReview < 0 || daysFromReview > 5)) return false;
    if (filters.due === "week" && (daysFromReview < 0 || daysFromReview > 7)) return false;
    if (filters.due === "overdue" && daysFromReview >= 0 && !work.deadline.toLowerCase().includes("overdue") && !item.internalDeadline.toLowerCase().includes("overdue")) return false;
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
export function getFixtureWorkRegisterRecords(records = getFixtureOperationalRecords(), today: string = fixtureClock.today): FixtureWorkRegisterRecord[] {
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
      calendar: [...record.milestones].sort((a, b) => dateValue(a.calendarDate) - dateValue(b.calendarDate)).find((item) => item.calendarDate >= today) ?? record.milestones[record.milestones.length - 1],
  }));
}

export function getFixtureClock() {
  return fixtureClock;
}
