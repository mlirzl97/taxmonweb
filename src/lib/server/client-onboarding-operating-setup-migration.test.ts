import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20261109000000_preserve_onboarding_operating_setup.sql"), "utf8");

describe("client onboarding operating setup migration", () => {
  it("preserves source and operating setup fields in the initial Tax Profile snapshot", () => {
    expect(migration).toContain("'booksType', p_profile_data ->> 'booksType'");
    expect(migration).toContain("'invoicing', p_profile_data ->> 'invoicing'");
    expect(migration).toContain("'enateSetup', p_profile_data ->> 'enateSetup'");
    expect(migration).toContain("'paymentRoute', p_profile_data ->> 'paymentRoute'");
    expect(migration).toContain("'registeredTaxTypeCodes', coalesce(p_profile_data -> 'registeredTaxTypeCodes', '[]'::jsonb)");
    expect(migration).toContain("'proposedReturnCodes', coalesce(p_profile_data -> 'proposedReturnCodes', '[]'::jsonb)");
  });
});
