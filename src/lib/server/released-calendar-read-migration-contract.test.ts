import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20261201000000_release_calendar_read_boundary.sql"), "utf8");

describe("released calendar read boundary", () => {
  it("exposes only published rows from released calendar versions", () => {
    expect(migration).toContain("publication_status = 'published'");
    expect(migration).toContain("version.status = 'released'");
    expect(migration).toContain("on public.monthly_calendar_versions for select to authenticated");
    expect(migration).toContain("using (status = 'released')");
    expect(migration).not.toMatch(/for select to authenticated[\s\S]*using \(\s*true\s*\)/i);
  });
});
