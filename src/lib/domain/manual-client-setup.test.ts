import { describe, expect, it } from "vitest";

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
});
