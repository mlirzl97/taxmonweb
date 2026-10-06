import { fixtureCalendar, fixtureClients, fixtureClock, fixtureWork, type FixtureScope, type FixtureStatus } from "@/lib/fixtures";

export type FixtureOperationalRecord = {
  calendar: (typeof fixtureCalendar)[number];
  work: (typeof fixtureWork)[number];
  client: (typeof fixtureClients)[number] | undefined;
  scope: FixtureScope;
  status: FixtureStatus;
};

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

export function getFixtureClock() {
  return fixtureClock;
}
