import { clientDeadlineModes, clientDeadlinePolicyErrors, isValidClientDeadlineLeadDays, normalizeClientDeadlinePolicy, type ClientDeadlinePolicy } from "@/lib/domain/client-deadline-policy";
import { generatedEntityReference, normalizeTinDigits } from "@/lib/domain/client-onboarding";
import { governedReturnForms } from "@/lib/domain/client-return-selection";
import { clientProfileControlErrors } from "@/lib/domain/client-profile-options";

const referenceCodePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const manualClientSetupUnitKinds = ["head_office", "branch", "other"] as const;
export const manualClientSetupSourceSystems = ["sharepoint", "synthetic_fixture", "manual_reference"] as const;

export type ManualClientSetupInput = {
  clientReferenceCode: string;
  clientDisplayName: string;
  entityReferenceCode: string;
  entityDisplayName: string;
  tin?: string;
  unitReferenceCode: string;
  unitDisplayName: string;
  unitKind: (typeof manualClientSetupUnitKinds)[number];
  registrationReference?: string;
  organizationUnitId: string;
  sourceReference: string;
  sourceSystem: (typeof manualClientSetupSourceSystems)[number];
  sourceNotes?: string;
  profileData?: {
    rdoOrLts?: string;
    registeredAddress?: string;
    registrationEffective?: string;
    taxYearBasis?: string;
    fiscalYearEnd?: string;
    accountingSystem?: string;
    booksType?: string;
    invoicing?: string;
    filingChannel?: string;
    eFPSGroup?: string;
    enateSetup?: "Yes" | "No" | "Unknown";
    paymentRoute?: "Client Pays" | "TMF Pays" | "Not configured";
    registeredTaxTypeCodes?: string[];
    registeredTaxTypes?: string[];
    registeredTaxTypesRaw?: string;
    proposedReturnCodes?: string[];
    registeredReturnCodes?: string[];
    goLiveDate?: string;
    firstPeriodToFile?: string;
    permanentFileLink?: string;
    sourceNotes?: string;
    deadlinePolicy?: ClientDeadlinePolicy;
  };
  contractData?: {
    recordType?: string;
    referenceCode?: string;
    sourceReference?: string;
  };
  sourcePack?: Array<{
    type: string;
    status: "not_captured" | "received" | "not_applicable" | "unknown";
    sourceReference?: string;
    notes?: string;
  }>;
};

export type ManualClientSetupResult =
  | { ok: true; value: ManualClientSetupInput }
  | { ok: false; errors: string[] };

/**
 * Fixture writes are only valid inside the explicitly sanitized prototype.
 * Production and authenticated source-backed setup must never accept them.
 */
export function isManualClientSetupSourceAllowed(sourceSystem: ManualClientSetupInput["sourceSystem"], prototypeMode: boolean): boolean {
  if (sourceSystem === "synthetic_fixture") return prototypeMode;
  return !prototypeMode;
}

function readText(input: Record<string, unknown>, key: string, required = true): string | undefined {
  const raw = input[key];

  if (raw === undefined || raw === null || raw === "") {
    return required ? undefined : "";
  }

  return typeof raw === "string" ? raw.trim() : undefined;
}

function requireText(
  input: Record<string, unknown>,
  key: string,
  errors: string[],
  maxLength: number,
): string | undefined {
  const value = readText(input, key);

  if (!value) {
    errors.push(`${key} is required.`);
    return undefined;
  }

  if (value.length > maxLength) {
    errors.push(`${key} must be ${maxLength} characters or fewer.`);
    return undefined;
  }

  return value;
}

function optionalText(
  input: Record<string, unknown>,
  key: string,
  errors: string[],
  maxLength: number,
): string | undefined {
  const value = readText(input, key, false);

  if (value === undefined) {
    errors.push(`${key} must be text.`);
    return undefined;
  }

  if (value.length > maxLength) {
    errors.push(`${key} must be ${maxLength} characters or fewer.`);
    return undefined;
  }

  return value || undefined;
}

export function parseManualClientSetupInput(input: unknown): ManualClientSetupResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["A setup object is required."] };
  }

  const source = input as Record<string, unknown>;
  const errors: string[] = [];
  const clientReferenceCode = requireText(source, "clientReferenceCode", errors, 64);
  const clientDisplayName = requireText(source, "clientDisplayName", errors, 160);
  const suppliedEntityReferenceCode = optionalText(source, "entityReferenceCode", errors, 64);
  const entityReferenceCode = suppliedEntityReferenceCode || (clientReferenceCode ? generatedEntityReference(clientReferenceCode) : undefined);
  const entityDisplayName = requireText(source, "entityDisplayName", errors, 160);
  const unitReferenceCode = requireText(source, "unitReferenceCode", errors, 64);
  const unitDisplayName = requireText(source, "unitDisplayName", errors, 160);
  const sourceReference = requireText(source, "sourceReference", errors, 240);
  const rawTin = optionalText(source, "tin", errors, 64);
  if (rawTin && !/^[\d\s-]+$/.test(rawTin)) errors.push("tin must contain numbers, spaces, or hyphens only.");
  const tin = rawTin ? normalizeTinDigits(rawTin) : undefined;
  if (tin && (tin.length < 9 || tin.length > 14)) errors.push("tin must contain 9 to 14 digits when supplied.");
  const registrationReference = optionalText(source, "registrationReference", errors, 160);
  const organizationUnitId = requireText(source, "organizationUnitId", errors, 36);
  const sourceNotes = optionalText(source, "sourceNotes", errors, 500);
  const unitKind = readText(source, "unitKind");
  const sourceSystem = readText(source, "sourceSystem");
  const profileSource = source.profileData;
  const profileData = profileSource && typeof profileSource === "object" && !Array.isArray(profileSource)
    ? profileSource as Record<string, unknown>
    : undefined;
  if (profileData) errors.push(...clientProfileControlErrors(profileData));

  const profileText = (key: string, maxLength: number) => {
    if (!profileData) return undefined;
    const value = profileData[key];
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value !== "string" || value.trim().length > maxLength) {
      errors.push(`profileData.${key} must be text with ${maxLength} characters or fewer.`);
      return undefined;
    }
    return value.trim() || undefined;
  };

  const registeredTaxTypes = profileData?.registeredTaxTypes;
  if (registeredTaxTypes !== undefined && (!Array.isArray(registeredTaxTypes) || registeredTaxTypes.some((value) => typeof value !== "string" || value.trim().length > 160))) {
    errors.push("profileData.registeredTaxTypes must be an array of short text values.");
  }
  const registeredTaxTypeCodes = profileData?.registeredTaxTypeCodes;
  if (registeredTaxTypeCodes !== undefined && (!Array.isArray(registeredTaxTypeCodes) || registeredTaxTypeCodes.some((value) => typeof value !== "string" || !/^[A-Za-z0-9_]{1,48}$/.test(value.trim())))) {
    errors.push("profileData.registeredTaxTypeCodes must be an array of canonical tax type codes.");
  }
  const proposedReturnCodes = profileData?.proposedReturnCodes;
  const governedReturnCodes = new Set(governedReturnForms.map((form) => form.formNumber));
  if (proposedReturnCodes !== undefined && (!Array.isArray(proposedReturnCodes) || proposedReturnCodes.some((value) => typeof value !== "string" || !governedReturnCodes.has(value.trim())))) {
    errors.push("profileData.proposedReturnCodes must contain only return forms from the current governed form catalog.");
  }
  const registeredReturnCodes = profileData?.registeredReturnCodes;
  if (registeredReturnCodes !== undefined && (!Array.isArray(registeredReturnCodes) || registeredReturnCodes.some((value) => typeof value !== "string" || !governedReturnCodes.has(value.trim())))) {
    errors.push("profileData.registeredReturnCodes must contain only return forms from the current governed form catalog.");
  }
  const goLiveDate = profileText("goLiveDate", 10);
  if (goLiveDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(goLiveDate)) errors.push("profileData.goLiveDate must use YYYY-MM-DD.");
  const firstPeriodToFile = profileText("firstPeriodToFile", 7);
  if (firstPeriodToFile !== undefined && !/^\d{4}-\d{2}$/.test(firstPeriodToFile)) errors.push("profileData.firstPeriodToFile must use YYYY-MM.");
  // A SharePoint link or a shared-drive path; it is a location reference, not a fetched URL.
  const permanentFileLink = profileText("permanentFileLink", 240);
  const enateSetup = profileText("enateSetup", 32);
  if (enateSetup !== undefined && !["Yes", "No", "Unknown"].includes(enateSetup)) errors.push("profileData.enateSetup must be Yes, No, or Unknown.");
  const paymentRoute = profileText("paymentRoute", 32);
  if (paymentRoute !== undefined && !["Client Pays", "TMF Pays", "Not configured"].includes(paymentRoute)) errors.push("profileData.paymentRoute must be Client Pays, TMF Pays, or Not configured.");

  const deadlinePolicySource = profileData?.deadlinePolicy;
  if (deadlinePolicySource !== undefined && (!deadlinePolicySource || typeof deadlinePolicySource !== "object" || Array.isArray(deadlinePolicySource))) {
    errors.push("profileData.deadlinePolicy must be an object when supplied.");
  }
  const deadlinePolicy = deadlinePolicySource && typeof deadlinePolicySource === "object" && !Array.isArray(deadlinePolicySource)
    ? normalizeClientDeadlinePolicy(deadlinePolicySource)
    : undefined;
  if (deadlinePolicySource && typeof deadlinePolicySource === "object" && !Array.isArray(deadlinePolicySource)) {
    const rawPolicy = deadlinePolicySource as Record<string, unknown>;
    if (!clientDeadlineModes.includes(rawPolicy.mode as typeof clientDeadlineModes[number])) {
      errors.push("profileData.deadlinePolicy.mode must be follow_group or client_defined.");
    }
    for (const key of ["clientProvideLeadDays", "clientApprovalLeadDays", "tmfPackageLeadDays", "estimatedFilingLeadDays", "estimatedPaymentLeadDays"] as const) {
      if (rawPolicy[key] !== undefined && !isValidClientDeadlineLeadDays(rawPolicy[key])) {
        errors.push(`profileData.deadlinePolicy.${key} must be a whole number from 0 to 365.`);
      }
    }
  }
  if (deadlinePolicy) errors.push(...clientDeadlinePolicyErrors(deadlinePolicy).map((error) => `profileData.deadlinePolicy: ${error}`));

  const contractSource = source.contractData;
  if (contractSource !== undefined && (!contractSource || typeof contractSource !== "object" || Array.isArray(contractSource))) {
    errors.push("contractData must be an object when supplied.");
  }
  const contractData = contractSource && typeof contractSource === "object" && !Array.isArray(contractSource)
    ? contractSource as Record<string, unknown>
    : undefined;
  const contractText = (key: string, maxLength: number) => {
    if (!contractData) return undefined;
    const value = contractData[key];
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value !== "string" || value.trim().length > maxLength) {
      errors.push(`contractData.${key} must be text with ${maxLength} characters or fewer.`);
      return undefined;
    }
    return value.trim() || undefined;
  };

  const sourcePackSource = source.sourcePack;
  if (sourcePackSource !== undefined && !Array.isArray(sourcePackSource)) {
    errors.push("sourcePack must be an array when supplied.");
  }
  const sourcePack = Array.isArray(sourcePackSource) ? sourcePackSource.flatMap((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push(`sourcePack[${index}] must be an object.`);
      return [];
    }
    const record = item as Record<string, unknown>;
    const type = typeof record.type === "string" ? record.type.trim() : "";
    const status = typeof record.status === "string" ? record.status.trim() : "";
    const sourceReference = typeof record.sourceReference === "string" ? record.sourceReference.trim() : "";
    const notes = typeof record.notes === "string" ? record.notes.trim() : "";
    if (!type || !status || !["not_captured", "received", "not_applicable", "unknown"].includes(status)) {
      errors.push(`sourcePack[${index}] must include a supported type and status.`);
      return [];
    }
    if (status === "received" && !sourceReference) errors.push(`sourcePack.${type} requires a source reference when received.`);
    if ((status === "unknown" || status === "not_applicable") && !notes) errors.push(`sourcePack.${type} requires a rationale.`);
    if (sourceReference.length > 240 || notes.length > 500) errors.push(`sourcePack.${type} contains text that is too long.`);
    return [{ type, status: status as "not_captured" | "received" | "not_applicable" | "unknown", sourceReference: sourceReference || undefined, notes: notes || undefined }];
  }) : undefined;

  if (clientReferenceCode && !referenceCodePattern.test(clientReferenceCode)) {
    errors.push("clientReferenceCode contains unsupported characters.");
  }

  if (entityReferenceCode && !referenceCodePattern.test(entityReferenceCode)) {
    errors.push("entityReferenceCode contains unsupported characters.");
  }

  if (unitReferenceCode && !referenceCodePattern.test(unitReferenceCode)) {
    errors.push("unitReferenceCode contains unsupported characters.");
  }

  if (!unitKind || !manualClientSetupUnitKinds.includes(unitKind as typeof manualClientSetupUnitKinds[number])) {
    errors.push("unitKind must be head_office, branch, or other.");
  }

  if (!sourceSystem || !manualClientSetupSourceSystems.includes(sourceSystem as typeof manualClientSetupSourceSystems[number])) {
    errors.push("sourceSystem must be sharepoint, synthetic_fixture, or manual_reference.");
  }

  if (organizationUnitId && !uuidPattern.test(organizationUnitId)) {
    errors.push("organizationUnitId must be a valid UUID when supplied.");
  }

  if (errors.length > 0 || !clientReferenceCode || !clientDisplayName || !entityReferenceCode || !entityDisplayName || !unitReferenceCode || !unitDisplayName || !sourceReference || !unitKind || !sourceSystem || !organizationUnitId) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      clientReferenceCode,
      clientDisplayName,
      entityReferenceCode,
      entityDisplayName,
      tin,
      unitReferenceCode,
      unitDisplayName,
      unitKind: unitKind as ManualClientSetupInput["unitKind"],
      registrationReference,
      organizationUnitId,
      sourceReference,
      sourceSystem: sourceSystem as ManualClientSetupInput["sourceSystem"],
      sourceNotes,
      profileData: profileData ? {
        rdoOrLts: profileText("rdoOrLts", 160),
        registeredAddress: profileText("registeredAddress", 500),
        registrationEffective: profileText("registrationEffective", 32),
        taxYearBasis: profileText("taxYearBasis", 80),
        fiscalYearEnd: profileText("fiscalYearEnd", 80),
        accountingSystem: profileText("accountingSystem", 160),
        booksType: profileText("booksType", 160),
        invoicing: profileText("invoicing", 160),
        filingChannel: profileText("filingChannel", 80),
        eFPSGroup: profileText("eFPSGroup", 160),
        enateSetup: enateSetup as "Yes" | "No" | "Unknown" | undefined,
        paymentRoute: paymentRoute as "Client Pays" | "TMF Pays" | "Not configured" | undefined,
        registeredTaxTypeCodes: Array.isArray(registeredTaxTypeCodes) ? registeredTaxTypeCodes.map((value) => String(value).trim()).filter(Boolean) : undefined,
        registeredTaxTypes: Array.isArray(registeredTaxTypes) ? registeredTaxTypes.map((value) => String(value).trim()).filter(Boolean) : undefined,
        registeredTaxTypesRaw: profileText("registeredTaxTypesRaw", 1000),
        proposedReturnCodes: Array.isArray(proposedReturnCodes) ? [...new Set(proposedReturnCodes.map((value) => String(value).trim()).filter(Boolean))] : undefined,
        registeredReturnCodes: Array.isArray(registeredReturnCodes) ? [...new Set(registeredReturnCodes.map((value) => String(value).trim()).filter(Boolean))] : undefined,
        goLiveDate,
        firstPeriodToFile,
        permanentFileLink,
        sourceNotes: profileText("sourceNotes", 500),
        deadlinePolicy,
      } : undefined,
      contractData: contractData ? {
        recordType: contractText("recordType", 32),
        referenceCode: contractText("referenceCode", 160),
        sourceReference: contractText("sourceReference", 240),
      } : undefined,
      sourcePack,
    },
  };
}
