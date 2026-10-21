import { describe, expect, it } from "vitest";

import { fixtureClients } from "@/lib/fixtures";
import { applyPersistedTaxProfileSnapshot, buildTaxProfilePersistencePayload, profileActivationGaps } from "./client-profile-persistence";
import { isPermanentFileLocation, sourceSystemForFileLocation, isManualClientSetupSourceAllowed, parseManualClientSetupInput } from "./manual-client-setup";

describe("manual client setup contract", () => {
  it("allows fixture source only in prototype mode", () => {
    expect(isManualClientSetupSourceAllowed("synthetic_fixture", true)).toBe(true);
    expect(isManualClientSetupSourceAllowed("synthetic_fixture", false)).toBe(false);
    expect(isManualClientSetupSourceAllowed("manual_reference", true)).toBe(false);
    expect(isManualClientSetupSourceAllowed("manual_reference", false)).toBe(true);
  });

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

  it("records SharePoint provenance only for a SharePoint web address", () => {
    expect(sourceSystemForFileLocation("https://tenant.sharepoint.invalid/sites/AT/Brightwater")).toBe("sharepoint");
    expect(sourceSystemForFileLocation("\\\\fileserver\\A&T\\Clients\\Brightwater")).toBe("manual_reference");
    expect(sourceSystemForFileLocation("S:/A&T/Clients/Brightwater")).toBe("manual_reference");
    expect(sourceSystemForFileLocation("http://sharepoint.invalid/sites/AT")).toBe("manual_reference");
  });

  it("accepts a shared-drive path or a SharePoint link as the permanent file location", () => {
    const base = {
      clientReferenceCode: "FIXTURE-CLIENT-05",
      clientDisplayName: "Brightwater Trading (synthetic)",
      entityReferenceCode: "FIXTURE-ENTITY-05",
      entityDisplayName: "Brightwater Trading (synthetic)",
      unitReferenceCode: "FIXTURE-RU-05",
      unitDisplayName: "Head Office",
      unitKind: "head_office",
      organizationUnitId: "00000000-0000-4000-8000-000000000001",
      sourceReference: "synthetic-2303-05",
      sourceSystem: "synthetic_fixture",
    };
    for (const location of ["\\\\fileserver\\A&T\\Clients\\Brightwater", "S:/A&T/Clients/Brightwater", "https://tenant.sharepoint.invalid/sites/AT/Brightwater"]) {
      const result = parseManualClientSetupInput({ ...base, profileData: { permanentFileLink: location } });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.profileData?.permanentFileLink).toBe(location);
    }
    expect(parseManualClientSetupInput({ ...base, profileData: { permanentFileLink: "x".repeat(241) } }).ok).toBe(false);
    for (const notALocation of ["TBD", "notes pending", "http://insecure.invalid/AT", "fileserver/AT"]) {
      expect(parseManualClientSetupInput({ ...base, profileData: { permanentFileLink: notALocation } }).ok).toBe(false);
    }
    expect(parseManualClientSetupInput({ ...base, profileData: { permanentFileLink: "synthetic://permanent-file/CRM-2026-001" } }).ok).toBe(true);
    expect(isPermanentFileLocation("synthetic://permanent-file/CRM-2026-001", "manual_reference")).toBe(false);
  });

  it("refuses a first period to file before the go-live month", () => {
    const base = {
      clientReferenceCode: "FIXTURE-CLIENT-05",
      clientDisplayName: "Brightwater Trading (synthetic)",
      entityReferenceCode: "FIXTURE-ENTITY-05",
      entityDisplayName: "Brightwater Trading (synthetic)",
      unitReferenceCode: "FIXTURE-RU-05",
      unitDisplayName: "Head Office",
      unitKind: "head_office",
      organizationUnitId: "00000000-0000-4000-8000-000000000001",
      sourceReference: "synthetic-2303-05",
      sourceSystem: "synthetic_fixture",
    };
    const early = parseManualClientSetupInput({ ...base, profileData: { goLiveDate: "2026-03-01", firstPeriodToFile: "2026-02" } });
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.errors).toContain("profileData.firstPeriodToFile cannot be before the go-live month.");
    expect(parseManualClientSetupInput({ ...base, profileData: { goLiveDate: "2026-03-01", firstPeriodToFile: "2026-03" } }).ok).toBe(true);
  });

  it("generates the internal entity reference and normalizes a source-formatted TIN", () => {
    const result = parseManualClientSetupInput({
      clientReferenceCode: "CLIENT-TIN-001",
      clientDisplayName: "Cresthaven Consumer Products Inc.",
      entityDisplayName: "Cresthaven Consumer Products Inc.",
      tin: "123-456-789-00000",
      unitReferenceCode: "RU-TIN-001",
      unitDisplayName: "Head Office",
      unitKind: "head_office",
      organizationUnitId: "00000000-0000-4000-8000-000000000001",
      sourceReference: "2303-reference-tin-001",
      sourceSystem: "manual_reference",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.entityReferenceCode).toBe("ENTITY-CLIENT-TIN-001");
      expect(result.value.tin).toBe("12345678900000");
    }
  });

  it("preserves canonical tax type codes selected during onboarding", () => {
    const result = parseManualClientSetupInput({
      clientReferenceCode: "CLIENT-TAX-TYPES",
      clientDisplayName: "Cresthaven Consumer Products Inc.",
      entityReferenceCode: "ENTITY-TAX-TYPES",
      entityDisplayName: "Cresthaven Consumer Products Inc.",
      unitReferenceCode: "RU-TAX-TYPES",
      unitDisplayName: "Head Office",
      unitKind: "head_office",
      organizationUnitId: "00000000-0000-4000-8000-000000000001",
      sourceReference: "2303-reference-001",
      sourceSystem: "manual_reference",
      profileData: {
        registeredTaxTypeCodes: ["CIT", "VAT"],
        registeredTaxTypes: ["CIT", "VAT"],
        booksType: "CAS",
        invoicing: "CAS",
        enateSetup: "Yes",
        paymentRoute: "TMF Pays",
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.profileData).toMatchObject({ registeredTaxTypeCodes: ["CIT", "VAT"], booksType: "CAS", invoicing: "CAS", enateSetup: "Yes", paymentRoute: "TMF Pays" });
  });

  it("preserves governed return-form proposals separately from source tax wording", () => {
    const result = parseManualClientSetupInput({
      clientReferenceCode: "CLIENT-RETURNS",
      clientDisplayName: "Cresthaven Consumer Products Inc.",
      entityReferenceCode: "ENTITY-RETURNS",
      entityDisplayName: "Cresthaven Consumer Products Inc.",
      unitReferenceCode: "RU-RETURNS",
      unitDisplayName: "Head Office",
      unitKind: "head_office",
      organizationUnitId: "00000000-0000-4000-8000-000000000001",
      sourceReference: "2303-reference-002",
      sourceSystem: "manual_reference",
      profileData: {
        registeredTaxTypes: ["Withholding Tax"],
        proposedReturnCodes: ["0619-E", "1601-EQ", "0619-E"],
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.profileData?.proposedReturnCodes).toEqual(["0619-E", "1601-EQ"]);
  });

  it("rejects return forms outside the current governed form catalog", () => {
    const result = parseManualClientSetupInput({
      clientReferenceCode: "CLIENT-RETURNS-INVALID",
      clientDisplayName: "Cresthaven Consumer Products Inc.",
      entityReferenceCode: "ENTITY-RETURNS-INVALID",
      entityDisplayName: "Cresthaven Consumer Products Inc.",
      unitReferenceCode: "RU-RETURNS-INVALID",
      unitDisplayName: "Head Office",
      unitKind: "head_office",
      organizationUnitId: "00000000-0000-4000-8000-000000000001",
      sourceReference: "2303-reference-003",
      sourceSystem: "manual_reference",
      profileData: { proposedReturnCodes: ["9999-X"] },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("profileData.proposedReturnCodes must contain only return forms from the current governed form catalog.");
  });

  it("accepts a client-specific timing policy without changing statutory deadline truth", () => {
    const result = parseManualClientSetupInput({
      clientReferenceCode: "FIXTURE-CLIENT-TIMING",
      clientDisplayName: "Asterline Timing (synthetic)",
      entityReferenceCode: "FIXTURE-ENTITY-TIMING",
      entityDisplayName: "Asterline Taxpayer (synthetic)",
      unitReferenceCode: "FIXTURE-RU-TIMING",
      unitDisplayName: "Asterline Head Office (synthetic)",
      unitKind: "head_office",
      organizationUnitId: "00000000-0000-4000-8000-000000000001",
      sourceReference: "synthetic-onboarding-timing",
      sourceSystem: "synthetic_fixture",
      profileData: {
        deadlinePolicy: {
          mode: "client_defined",
          sourceReference: "Synthetic engagement instruction",
          clientProvideLeadDays: 5,
          clientApprovalLeadDays: 2,
        },
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.profileData?.deadlinePolicy?.clientApprovalLeadDays).toBe(2);
  });

  it("does not accept a client-specific policy with no timing definition", () => {
    const result = parseManualClientSetupInput({
      clientReferenceCode: "FIXTURE-CLIENT-TIMING",
      clientDisplayName: "Asterline Timing (synthetic)",
      entityReferenceCode: "FIXTURE-ENTITY-TIMING",
      entityDisplayName: "Asterline Taxpayer (synthetic)",
      unitReferenceCode: "FIXTURE-RU-TIMING",
      unitDisplayName: "Asterline Head Office (synthetic)",
      unitKind: "head_office",
      organizationUnitId: "00000000-0000-4000-8000-000000000001",
      sourceReference: "synthetic-onboarding-timing",
      sourceSystem: "synthetic_fixture",
      profileData: { deadlinePolicy: { mode: "client_defined" } },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("profileData.deadlinePolicy: Client-specific timing requires at least one working-day offset.");
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

  it("requires evidence or rationale for onboarding source-pack states", () => {
    const base = {
      clientReferenceCode: "CLIENT-EXAMPLE",
      clientDisplayName: "Example Client",
      entityReferenceCode: "ENTITY-EXAMPLE",
      entityDisplayName: "Example Entity",
      unitReferenceCode: "RU-EXAMPLE",
      unitDisplayName: "Example Head Office",
      unitKind: "head_office",
      organizationUnitId: "00000000-0000-4000-8000-000000000001",
      sourceReference: "sharepoint://example/2303",
      sourceSystem: "sharepoint",
    };

    const missingSourceReference = parseManualClientSetupInput({
      ...base,
      sourcePack: [{ type: "bir_form_2303", status: "received" }],
    });
    expect(missingSourceReference.ok).toBe(false);
    if (!missingSourceReference.ok) {
      expect(missingSourceReference.errors).toContain("sourcePack.bir_form_2303 requires a source reference when received.");
    }

    const missingRationale = parseManualClientSetupInput({
      ...base,
      sourcePack: [{ type: "registration_update", status: "unknown" }],
    });
    expect(missingRationale.ok).toBe(false);
    if (!missingRationale.ok) {
      expect(missingRationale.errors).toContain("sourcePack.registration_update requires a rationale.");
    }
  });

  it("rejects malformed contract and source-pack containers", () => {
    const result = parseManualClientSetupInput({
      clientReferenceCode: "CLIENT-EXAMPLE",
      clientDisplayName: "Example Client",
      entityReferenceCode: "ENTITY-EXAMPLE",
      entityDisplayName: "Example Entity",
      unitReferenceCode: "RU-EXAMPLE",
      unitDisplayName: "Example Head Office",
      unitKind: "head_office",
      organizationUnitId: "00000000-0000-4000-8000-000000000001",
      sourceReference: "sharepoint://example/2303",
      sourceSystem: "sharepoint",
      contractData: "not-an-object",
      sourcePack: "not-an-array",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("contractData must be an object when supplied.");
      expect(result.errors).toContain("sourcePack must be an array when supplied.");
    }
  });

  it("serializes profile, assignment, provenance, and effective-date context", () => {
    const client = fixtureClients.find((item) => item.entities[0]?.profile.taxYearBasis === "Fiscal year" && item.entities[0]?.profile.sourceKind === "2303-derived") ?? fixtureClients[0];
    const unit = client.entities[0].units[0];
    const payload = buildTaxProfilePersistencePayload(client.entities[0].profile, client.assignment, unit, "HOD baseline review", "2026-10-05");
    expect(payload.effectiveFrom).toBe("2026-10-05");
    expect(payload.profile.sourceKind).toBe("2303-derived");
    expect(payload.profile.taxYearBasis).toBe(client.entities[0].profile.taxYearBasis);
    expect(payload.profile.accountingSystem).toBe(client.entities[0].profile.accountingSystem);
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
    expect(gaps).not.toContain("accounting system");
  });

  it("requires the first period to file before activation, while drafts may park without it", () => {
    const client = fixtureClients.find((item) => item.id === "fixture-client-06");
    if (!client) throw new Error("Expected incomplete fixture.");
    const unit = client.entities[0].units[0];
    expect(profileActivationGaps({ ...client.entities[0].profile, firstPeriodToFile: undefined }, client.assignment, unit)).toContain("first period to file");
    expect(profileActivationGaps({ ...client.entities[0].profile, firstPeriodToFile: "2026-03" }, client.assignment, unit)).not.toContain("first period to file");
    expect(profileActivationGaps({ ...client.entities[0].profile, firstPeriodToFile: "2026-13" }, client.assignment, unit)).toContain("first period to file");
  });

  it("treats two staff who share a name as distinct owners when their ids differ", () => {
    const client = fixtureClients.find((item) => item.id === "fixture-client-06");
    if (!client) throw new Error("Expected incomplete fixture.");
    const sameName = { ...client.assignment, preparer: "Totoy Bibo", checker: "Totoy Bibo", reviewer: "Kristine Kalamansi" };
    const unit = client.entities[0].units[0];
    expect(profileActivationGaps(client.entities[0].profile, sameName, unit)).toContain("distinct Preparer, Checker, and Reviewer");
    const withIds = { ...sameName, preparerUserId: "user-totoy-1", checkerUserId: "user-totoy-2", reviewerUserId: "user-kristine" };
    expect(profileActivationGaps(client.entities[0].profile, withIds, unit)).not.toContain("distinct Preparer, Checker, and Reviewer");
    expect(profileActivationGaps(client.entities[0].profile, { ...withIds, checkerUserId: "user-totoy-1" }, unit)).toContain("distinct Preparer, Checker, and Reviewer");
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
    expect(restored.profile.taxYearBasis).toBe(client.entities[0].profile.taxYearBasis);
    expect(restored.profile.accountingSystem).toBe(client.entities[0].profile.accountingSystem);
    expect(restored.profile.authorities).toEqual(client.entities[0].profile.authorities);
    expect(restored.assignment.preparer).toBe(client.assignment.preparer);
    expect(restored.profile.profileState).toBe("Active");
  });
});
