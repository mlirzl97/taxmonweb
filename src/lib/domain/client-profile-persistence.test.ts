import { describe, expect, it } from "vitest";

import { fixtureClients } from "@/lib/fixtures";
import { applyPersistedTaxProfileSnapshot, buildTaxProfilePersistencePayload, hasCredibleTaxProfileValidation, reconcileClientAttention } from "./client-profile-persistence";

describe("Tax Profile validation indicator", () => {
  it("requires an active state and recorded validator evidence", () => {
    expect(hasCredibleTaxProfileValidation({ profileState: "Setup incomplete", lastValidated: "2026-10-07", validator: "Tax Control" })).toBe(false);
    expect(hasCredibleTaxProfileValidation({ profileState: "Ready for validation", lastValidated: "2026-10-07", validator: "Tax Control" })).toBe(false);
    expect(hasCredibleTaxProfileValidation({ profileState: "Active", lastValidated: "", validator: "Tax Control" })).toBe(false);
    expect(hasCredibleTaxProfileValidation({ profileState: "Active", lastValidated: "2026-10-07", validator: "Tax Control" })).toBe(true);
  });

  it("removes an old validation mark when a new profile is only saved for review", () => {
    const client = fixtureClients.find((item) => item.id === "fixture-client-04");
    const profile = client?.entities[0]?.profile;
    const assignment = client?.assignment;
    expect(profile && assignment).toBeTruthy();
    if (!profile || !assignment) return;

    const restored = applyPersistedTaxProfileSnapshot(profile, assignment, {
      state: "ready_for_validation",
      effectiveFrom: "2026-10-07",
      profile: {},
      assignment: {},
      validatedAt: null,
      validatedBy: null,
    });

    expect(restored.profile.lastValidated).toBeUndefined();
    expect(restored.profile.validator).toBeUndefined();
    expect(hasCredibleTaxProfileValidation(restored.profile)).toBe(false);
  });

  it("round-trips governed tax type codes separately from source wording", () => {
    const client = fixtureClients.find((item) => item.id === "fixture-client-04");
    const profile = client?.entities[0]?.profile;
    const assignment = client?.assignment;
    const unit = client?.entities[0]?.units[0];
    expect(profile && assignment && unit).toBeTruthy();
    if (!profile || !assignment || !unit) return;

    const payload = buildTaxProfilePersistencePayload({ ...profile, registeredTaxTypeCodes: ["WHT"] }, assignment, unit, "QA");
    expect(payload.profile.registeredTaxTypeCodes).toEqual(["WHT"]);
    const restored = applyPersistedTaxProfileSnapshot(profile, assignment, { state: "ready_for_validation", effectiveFrom: "2026-10-11", profile: payload.profile, assignment: payload.assignment });
    expect(restored.profile.registeredTaxTypeCodes).toEqual(["WHT"]);
    expect(restored.profile.registeredTaxTypes).toEqual(profile.registeredTaxTypes);
  });

  it("removes resolved setup and assignment issues from the attention projection", () => {
    const client = fixtureClients.find((item) => item.id === "fixture-client-06");
    const profile = client?.entities[0]?.profile;
    expect(profile && client).toBeTruthy();
    if (!profile || !client) return;

    const resolved = reconcileClientAttention(profile.attention, { ...profile, filingChannel: "eSubmission", taxYearBasis: "Calendar year", fiscalYearEnd: undefined, accountingSystem: "Manual", enateSetup: "Yes", paymentRoute: "Client Pays" }, { ...client.assignment, preparer: "Preparer A", checker: "Checker B", reviewer: "Reviewer C" });
    expect(resolved).not.toContain("Assignment incomplete");
    expect(resolved).not.toContain("Checker and Reviewer conflict");
    expect(resolved).not.toContain("Filing channel missing");
    expect(resolved).not.toContain("Tax year basis missing");
    expect(resolved).not.toContain("Fiscal year-end missing");
    expect(resolved).not.toContain("Accounting system missing");
    expect(resolved).not.toContain("eNATE setup unknown");
  });
});
