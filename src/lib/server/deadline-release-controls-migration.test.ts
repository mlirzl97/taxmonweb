import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20261213000000_deadline_release_controls.sql"), "utf8");

describe("deadline release controls migration (H-010)", () => {
  it("publishes only a confirmed deadline, and never by the person who confirmed it", () => {
    expect(migration).toContain("'A deadline is confirmed before it is published.'");
    expect(migration).toContain("if entry.confirmed_by = auth.uid() then");
    expect(migration).toContain("'The person who confirmed a deadline cannot publish it.'");
    expect(migration).toContain("'The publisher cannot change the confirmed date; confirm the new date first.'");
    // One confirmation stands at a time, and it confirms the date as saved now.
    expect(migration).toContain("'This deadline is already confirmed; send it back to review before confirming again.'");
    expect(migration).toContain("case when entry.supersedes_entry_id is not null then entry.published_operational_deadline end,");
    expect(migration).toContain("'The deadline this Override replaces is no longer published.'");
  });

  it("changes a published deadline only through an Override that supersedes it on publication", () => {
    expect(migration).toContain("'A published deadline changes only through Override.'");
    expect(migration).toContain("'A deadline is superseded only by publishing its Override.'");
    expect(migration).toContain("create or replace function public.override_published_deadline(");
    expect(migration).toContain("update public.monthly_calendar_entries set publication_status = 'superseded' where id = original.id;");
    expect(migration).toContain("'An Override for this deadline is already waiting to be published.'");
    // An Override changes only the TMF date, even if the waiting row was edited.
    expect(migration).toContain("'An Override cannot change the BIR statutory date.'");
    expect(migration).toContain("where supersedes_entry_id is not null and publication_status <> 'superseded';");
  });

  it("never lets an operational date pass the statutory deadline, and keeps the internal target a day before", () => {
    expect(migration.match(/'The operational due date cannot be later than the earliest applicable statutory deadline\.'/g)?.length).toBeGreaterThanOrEqual(3);
    expect(migration).toContain("p_operational_deadline - 1,");
  });

  it("keeps every command behind deadline control authority and away from anonymous callers", () => {
    expect(migration.match(/if not public\.has_deadline_control_access\(\) then/g)?.length).toBe(3);
    expect(migration).toContain("revoke execute on function public.override_published_deadline(uuid, date, text) from public, anon;");
    expect(migration).toContain("revoke execute on function public.get_deadline_release_state(integer) from public, anon;");
  });
});
