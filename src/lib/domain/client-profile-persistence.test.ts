import { describe, expect, it } from "vitest";

import { fixtureClients } from "@/lib/fixtures";
import { applyPersistedTaxProfileSnapshot, hasCredibleTaxProfileValidation } from "./client-profile-persistence";

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
});
