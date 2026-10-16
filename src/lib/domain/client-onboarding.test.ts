import { describe, expect, it } from "vitest";

import { clientOnboardingDocumentTypes, formatTin, generatedEntityReference, getClientOnboardingReadiness, normalizeTinDigits, type ClientOnboardingDocument, type ClientOnboardingIdentity } from "./client-onboarding";

const completeIdentity: ClientOnboardingIdentity = {
  clientReferenceCode: "CLIENT-001",
  clientDisplayName: "Sanitized Client",
  entityReferenceCode: "ENTITY-001",
  entityDisplayName: "Sanitized Taxpayer",
  tin: "",
  unitReferenceCode: "RU-001",
  unitDisplayName: "Sanitized Head Office",
  unitKind: "head_office",
  sourceReference: "2303-source-001",
};

function completeDocuments(): ClientOnboardingDocument[] {
  return clientOnboardingDocumentTypes.map(({ id }) => ({ type: id, status: "received", sourceReference: `source-${id}`, notes: "" }));
}

describe("client onboarding readiness", () => {
  it("keeps TIN storage numeric while presenting the source-friendly format", () => {
    expect(normalizeTinDigits("123-456-789-00000")).toBe("12345678900000");
    expect(formatTin("12345678900000")).toBe("123-456-789-00000");
    expect(generatedEntityReference("client-2026-001")).toBe("ENTITY-CLIENT-2026-001");
  });

  it("does not require an internal entity reference from the onboarding user", () => {
    const readiness = getClientOnboardingReadiness({ ...completeIdentity, entityReferenceCode: "" }, completeDocuments());
    expect(readiness.status).toBe("ready_for_human_review");
    expect(readiness.identityGaps).toEqual([]);
  });

  it("collects the source reference in the source step instead of blocking identity handoff", () => {
    const readiness = getClientOnboardingReadiness({ ...completeIdentity, sourceReference: "" }, completeDocuments());
    expect(readiness.identityGaps).toEqual([]);
    expect(readiness.status).toBe("ready_for_human_review");
  });

  it("keeps an incomplete registration pack visibly unresolved", () => {
    const readiness = getClientOnboardingReadiness(completeIdentity, []);
    expect(readiness.status).toBe("source_pack_incomplete");
    expect(readiness.sourcePackGaps).toContain("BIR Form 2303 / Certificate of Registration status is not recorded.");
    expect(readiness.activationBlocked).toBe(true);
  });

  it("does not force ATP applicability when the source says not applicable", () => {
    const documents = completeDocuments().map((document) => document.type === "authority_to_print"
      ? { ...document, status: "not_applicable" as const, sourceReference: "", notes: "Applicability not established in the supplied registration source." }
      : document);
    const readiness = getClientOnboardingReadiness(completeIdentity, documents);
    expect(readiness.status).toBe("ready_for_human_review");
    expect(readiness.sourcePackGaps).toEqual([]);
    expect(readiness.activationBlocked).toBe(true);
  });

  it("requires a source reference for received documents", () => {
    const documents = completeDocuments().map((document) => document.type === "bir_form_2303" ? { ...document, sourceReference: "" } : document);
    const readiness = getClientOnboardingReadiness(completeIdentity, documents);
    expect(readiness.sourcePackGaps).toContain("BIR Form 2303 / Certificate of Registration source reference is required.");
  });
});
