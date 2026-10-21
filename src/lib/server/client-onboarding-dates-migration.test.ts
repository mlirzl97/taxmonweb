import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20261207000000_keep_onboarding_dates_and_file_location.sql"), "utf8");

describe("client onboarding dates migration", () => {
  it("keeps the onboarding dates and permanent file location in the initial Tax Profile snapshot", () => {
    expect(migration).toContain("'goLiveDate', p_profile_data ->> 'goLiveDate'");
    expect(migration).toContain("'firstPeriodToFile', p_profile_data ->> 'firstPeriodToFile'");
    expect(migration).toContain("'registrationEffective', p_profile_data ->> 'registrationEffective'");
    expect(migration).toContain("'permanentFileLink', nullif(p_profile_data ->> 'permanentFileLink', ''),");
    expect(migration).not.toContain("coalesce(nullif(p_profile_data ->> 'permanentFileLink', ''), p_source_reference)");
    expect(migration).toContain("'registeredReturnCodes', coalesce(p_profile_data -> 'registeredReturnCodes', p_profile_data -> 'proposedReturnCodes', '[]'::jsonb)");
  });

  it("still stores the operating setup and leaves the profile unvalidated", () => {
    expect(migration).toContain("'paymentRoute', p_profile_data ->> 'paymentRoute'");
    expect(migration).toContain("'ready_for_validation'");
    expect(migration).toContain("has_active_capability('MaintainClientRepository')");
  });
  it("accepts only an active Cluster or Tower as the new client's scope", () => {
    expect(migration).toContain("unit.unit_kind in ('cluster', 'tower')");
    expect(migration).toContain("A client must be placed in an active Cluster or Tower.");
  });
});
