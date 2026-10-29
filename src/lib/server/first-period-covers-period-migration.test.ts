import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20261211000000_first_period_covers_whole_period.sql"), "utf8");

describe("first period covers the whole period migration (H-014)", () => {
  it("skips a period only when it ends before the first period to file", () => {
    expect(migration).not.toContain("item_period_start < first_period");
    expect(migration).toContain("public.compliance_period_months(entry.period_or_event, (select requirement.frequency_label from public.bir_requirements requirement where requirement.id = entry.requirement_id)) - 1))::date < first_period");
    expect(migration).toContain("'The period ends before the first period to file.'");
  });

  it("reads the period length from the row's wording and keeps the helper away from API callers", () => {
    // The same labels and cadence fallback as compliancePeriodLastMonth in the client calendar.
    expect(migration).toContain("when coalesce(p_label, '') ~* '(quarter ending|\\mQ[1-4]\\M)' then 3");
    expect(migration).toContain("when coalesce(p_label, '') ~* '(year ending|calendar year|taxable year|fiscal year|\\mFY\\M)' then 12");
    expect(migration).toContain("when coalesce(p_label, '') ~* 'month of' then 1");
    expect(migration).toContain("when coalesce(p_frequency, '') ~* 'quarter' then 3");
    expect(migration).toContain("when coalesce(p_frequency, '') ~* 'annual' then 12");
    expect(migration).toContain("revoke execute on function public.compliance_period_months(text, text) from public, anon, authenticated;");
  });

  it("keeps the generation command's existing grants", () => {
    expect(migration).toContain("revoke execute on function public.record_generated_compliance_work(uuid, jsonb) from public, anon;");
    expect(migration).toContain("grant execute on function public.record_generated_compliance_work(uuid, jsonb) to authenticated;");
  });
});
