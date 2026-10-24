import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20261210000000_held_calendar_periods.sql"), "utf8");

describe("held calendar periods migration", () => {
  it("lists only unpublished rows of released versions, within the caller's scope", () => {
    expect(migration).toContain("public.can_view_registration_unit(p_registration_unit_id)");
    expect(migration).toContain("calendar_version.status = 'released'");
    expect(migration).toContain("entry.publication_status in ('generated', 'needs_review', 'confirmed', 'unresolved')");
    expect(migration).toContain("revoke execute on function public.held_calendar_periods(uuid, uuid[], integer) from public, anon;");
  });

  it("never returns an unpublished date", () => {
    const returned = migration.slice(migration.indexOf("returns table ("), migration.indexOf("language plpgsql"));
    expect(returned).not.toMatch(/deadline|tmf_package_target/);
  });
});
