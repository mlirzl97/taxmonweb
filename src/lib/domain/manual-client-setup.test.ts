import { describe, expect, it } from "vitest";

import { fixtureClients } from "@/lib/fixtures";
import { applyPersistedTaxProfileSnapshot, buildTaxProfilePersistencePayload, profileActivationGaps } from "./client-profile-persistence";
import { parseManualClientSetupInput } from "./manual-client-setup";

describe("manual client setup contract", () => {
  it("accepts a sanitized structured setup payload", () => {
    const result = parseManualClientSetupInput({
      clientReferenceCode: "FIXTURE-CLIENT-04",
      clientDisplayName: "Asterline Manufacturing (synthetic)",
      entityReferenceCode: "FIXTURE-ENTITY-04",
      entityDisplayName: "Asterline Taxpayer (synthetic)",
      unitReferenceCode: "FIXTURE-RU-04",
      unitDisplayName: "Asterline Head Office (synthetic)",
      unitKind: "head_office",
      organizationUnitId: "00000000-0000-4000-8000-000000000001",
      sourceReference: "synthetic-2303-04",
      sourceSystem: "synthetic_fixture",
    });

    expect(result.ok).toBe(true);
  });

  it("does not accept arbitrary tax or source values", () => {
    const result = parseManualClientSetupInput({
      clientReferenceCode: "bad code",
      clientDisplayName: "Synthetic client",
      entityReferenceCode: "FIXTURE-ENTITY-04",
      entityDisplayName: "Synthetic entity",
      unitReferenceCode: "FIXTURE-RU-04",
      unitDisplayName: "Synthetic unit",
      unitKind: "head_office",
      organizationUnitId: "00000000-0000-4000-8000-000000000001",
      sourceReference: "synthetic-2303-04",
      sourceSystem: "invented-source",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("clientReferenceCode contains unsupported characters.");
      expect(result.errors).toContain("sourceSystem must be sharepoint, synthetic_fixture, or manual_reference.");
    }
  });

  it("serializes profile, assignment, provenance, and effective-date context", () => {
    const client = fixtureClients[0];
    const unit = client.entities[0].units[0];
    const payload = buildTaxProfilePersistencePayload(client.entities[0].profile, client.assignment, unit, "HOD baseline review", "2026-10-05");
    expect(payload.effectiveFrom).toBe("2026-10-05");
    expect(payload.profile.sourceKind).toBe("2303-derived");
    expect(payload.assignment.preparer).toBe(client.assignment.preparer);
    expect(payload.reason).toBe("HOD baseline review");
  });

  it("does not activate a profile with unresolved critical setup facts", () => {
    const client = fixtureClients.find((item) => item.id === "fixture-client-06");
    if (!client) throw new Error("Expected incomplete fixture.");
    const gaps = profileActivationGaps(client.entities[0].profile, client.assignment, client.entities[0].units[0]);
    expect(gaps).toContain("Preparer");
    expect(gaps).toContain("distinct Preparer, Checker, and Reviewer");
    expect(gaps).toContain("filing channel");
  });

  it("rehydrates a saved version without replacing immutable fixture context", () => {
    const client = fixtureClients[0];
    const unit = client.entities[0].units[0];
    const saved = buildTaxProfilePersistencePayload(client.entities[0].profile, client.assignment, unit, "Saved correction", "2026-10-05");
    const restored = applyPersistedTaxProfileSnapshot(client.entities[0].profile, client.assignment, {
      state: "active",
      effectiveFrom: "2026-10-05",
      profile: { ...saved.profile, registeredAddress: "Sanitized updated address" },
      assignment: saved.assignment,
    });

    expect(restored.profile.registeredAddress).toBe("Sanitized updated address");
    expect(restored.profile.authorities).toEqual(client.entities[0].profile.authorities);
    expect(restored.assignment.preparer).toBe(client.assignment.preparer);
    expect(restored.profile.profileState).toBe("Active");
  });
});
