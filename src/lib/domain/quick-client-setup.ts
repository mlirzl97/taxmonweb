import { clientOnboardingDocumentTypes, generatedEntityReference } from "@/lib/domain/client-onboarding";
import { governedReturnForms } from "@/lib/domain/client-return-selection";
import { isPermanentFileLocation, sourceSystemForFileLocation } from "@/lib/domain/manual-client-setup";

/**
 * Quick client setup asks only what decides what is due: which client, which
 * returns, the year-end, and the first period to file. Everything else stays
 * visibly unconfigured until the full setup is finished. Nothing here
 * approves Expected Compliance or generates work.
 */

export const quickSetupMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;
export type QuickSetupMonth = (typeof quickSetupMonths)[number];

const daysInMonth: Record<QuickSetupMonth, number> = {
  January: 31, February: 29, March: 31, April: 30, May: 31, June: 30,
  July: 31, August: 31, September: 30, October: 31, November: 30, December: 31,
};

export function quickSetupDayCount(month: string): number {
  return daysInMonth[month as QuickSetupMonth] ?? 31;
}

export type QuickClientSetupInput = {
  clientName: string;
  crmNumber: string;
  returnCodes: readonly string[];
  yearEndBasis: "Calendar year" | "Fiscal year" | "";
  fiscalYearEndMonth: string;
  fiscalYearEndDay: string;
  firstPeriodToFile: string;
  fileLocation: string;
};

export const emptyQuickClientSetup: QuickClientSetupInput = {
  clientName: "",
  crmNumber: "",
  returnCodes: [],
  yearEndBasis: "Calendar year",
  fiscalYearEndMonth: "",
  fiscalYearEndDay: "",
  firstPeriodToFile: "",
  fileLocation: "",
};

const referenceCodePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const periodPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const governedReturnCodes = new Set(governedReturnForms.map((form) => form.formNumber));

/** Field-keyed errors so the screen can mark the exact question that needs an answer. */
export type QuickClientSetupErrors = Partial<Record<"client" | "returns" | "yearEnd" | "firstPeriod" | "fileLocation", string>>;

export function quickClientSetupErrors(input: QuickClientSetupInput, options: { prototypeMode: boolean }): QuickClientSetupErrors {
  const errors: QuickClientSetupErrors = {};
  const name = input.clientName.trim();
  const crm = input.crmNumber.trim();
  if (!name) errors.client = "Enter the client name.";
  else if (name.length > 160) errors.client = "Client name must be 160 characters or fewer.";
  else if (!crm) errors.client = "Enter the CRM number.";
  else if (!referenceCodePattern.test(crm)) errors.client = "CRM number can use letters, numbers, dots, dashes and underscores only.";

  if (input.returnCodes.length === 0) errors.returns = "Add at least one return.";
  else if (input.returnCodes.some((code) => !governedReturnCodes.has(code))) errors.returns = "Only returns from the approved form catalog can be added.";

  if (input.yearEndBasis !== "Calendar year" && input.yearEndBasis !== "Fiscal year") {
    errors.yearEnd = "Choose calendar or fiscal year.";
  } else if (input.yearEndBasis === "Fiscal year") {
    const day = Number(input.fiscalYearEndDay);
    if (!quickSetupMonths.includes(input.fiscalYearEndMonth as QuickSetupMonth)) errors.yearEnd = "Choose the fiscal year-end month.";
    else if (!Number.isInteger(day) || day < 1 || day > quickSetupDayCount(input.fiscalYearEndMonth)) errors.yearEnd = "Choose a valid fiscal year-end day.";
  }

  if (!periodPattern.test(input.firstPeriodToFile)) errors.firstPeriod = "Choose the first month to file.";

  const location = input.fileLocation.trim();
  // Live setup records provenance in the registration source table, so the
  // permanent file location is required there; only the sanitized prototype
  // may leave it for later.
  if (!location && !options.prototypeMode) errors.fileLocation = "Enter the client's permanent file location (SharePoint link or shared-drive path).";
  else if (location && !isPermanentFileLocation(location, options.prototypeMode ? "synthetic_fixture" : undefined)) {
    errors.fileLocation = "Use a SharePoint link (https://…), a network share (\\\\server\\share) or a mapped drive (S:\\…).";
  }
  return errors;
}

export function quickSetupFiscalYearEnd(input: QuickClientSetupInput): string {
  return input.yearEndBasis === "Calendar year" ? "December 31" : `${input.fiscalYearEndMonth} ${Number(input.fiscalYearEndDay)}`;
}

/** Recorded on prototype drafts that were saved without a file location. */
export const quickSetupPendingSourceNote = "Quick setup: permanent file location and source pack not yet recorded.";

/**
 * The request body for the existing secured client-setup endpoint. Only the
 * four answers are sent; omitted profile facts stay unconfigured rather than
 * being defaulted.
 */
export function buildQuickClientSetupRequest(input: QuickClientSetupInput, options: { prototypeMode: boolean; organizationUnitId: string }) {
  const reference = input.crmNumber.trim().toUpperCase();
  const name = input.clientName.trim();
  const location = input.fileLocation.trim();
  const hasLocation = location.length > 0;
  // Live callers must validate first: quickClientSetupErrors requires a location outside the prototype.
  const sourceSystem = options.prototypeMode ? "synthetic_fixture" : sourceSystemForFileLocation(location);
  const sourceReference = options.prototypeMode && !hasLocation ? `synthetic://quick-setup/${reference}` : location;
  const returnCodes = [...input.returnCodes];
  return {
    clientReferenceCode: reference,
    clientDisplayName: name,
    entityReferenceCode: generatedEntityReference(reference),
    entityDisplayName: name,
    unitReferenceCode: `${reference}-HO`,
    unitDisplayName: "Head Office",
    unitKind: "head_office" as const,
    organizationUnitId: options.organizationUnitId,
    sourceReference,
    sourceSystem,
    sourceNotes: hasLocation ? undefined : quickSetupPendingSourceNote,
    profileData: {
      taxYearBasis: input.yearEndBasis,
      fiscalYearEnd: quickSetupFiscalYearEnd(input),
      proposedReturnCodes: returnCodes,
      registeredReturnCodes: returnCodes,
      firstPeriodToFile: input.firstPeriodToFile,
      ...(hasLocation ? { permanentFileLink: location } : {}),
    },
    contractData: { recordType: "not_confirmed", referenceCode: reference, sourceReference: hasLocation ? location : "" },
    sourcePack: clientOnboardingDocumentTypes.map(({ id }) => ({ type: id, status: "not_captured" as const })),
  };
}

/**
 * The browser-only intake draft used by the sanitized prototype. It uses the
 * same shape as the full setup draft so "Resume" opens the full setup with
 * the four answers already filled in.
 */
export function buildQuickClientSetupDraft(input: QuickClientSetupInput, options: { createdAt: string }) {
  const request = buildQuickClientSetupRequest(input, { prototypeMode: true, organizationUnitId: "" });
  return {
    version: 3,
    importSource: "quick_setup",
    client: {
      clientReferenceCode: request.clientReferenceCode,
      clientDisplayName: request.clientDisplayName,
      entityReferenceCode: request.entityReferenceCode,
      entityDisplayName: request.entityDisplayName,
      tin: "",
      unitReferenceCode: request.unitReferenceCode,
      unitDisplayName: request.unitDisplayName,
      unitKind: request.unitKind,
      sourceReference: request.sourceReference,
      goLiveDate: "",
    },
    contract: request.contractData,
    registrationFacts: {
      rdoOrLts: "",
      registeredAddress: "",
      registrationReference: "",
      registrationDate: "",
      accountingSystem: "",
      booksType: "",
      invoicing: "",
      filingChannel: "",
      eFPSGroup: "",
      ...request.profileData,
      permanentFileLink: request.sourceReference,
    },
    documents: clientOnboardingDocumentTypes.map(({ id }) => ({ type: id, status: "not_captured", sourceReference: "", notes: "" })),
    status: "intake_pending",
    createdAt: options.createdAt,
  };
}
