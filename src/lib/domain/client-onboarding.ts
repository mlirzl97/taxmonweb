export const clientOnboardingDocumentTypes = [
  { id: "bir_form_2303", label: "BIR Form 2303 / Certificate of Registration", detail: "Primary registration source for human review." },
  { id: "authority_to_print", label: "Authority to Print (ATP)", detail: "Record when applicable; applicability is not inferred." },
  { id: "books_registration", label: "Books registration / permit to use", detail: "Record the registered books source when applicable." },
  { id: "registration_update", label: "BIR registration update / certificate", detail: "Use for later registration changes or supplemental registration evidence." },
  { id: "sec_registration", label: "SEC registration source", detail: "Record the corporate registration source when applicable." },
  { id: "authority_record", label: "PEZA / BOI / other authority record", detail: "Record only when an approved source establishes the context." },
] as const;

export const clientOnboardingContractTypes = [
  { id: "msa", label: "MSA", detail: "Main contract / master services agreement." },
  { id: "lsa", label: "LSA", detail: "Local service agreement within the client relationship." },
  { id: "addendum", label: "Addendum", detail: "Amendment or supplement to the main contract." },
  { id: "crf_crn", label: "CRF/CRN", detail: "Additional engagement outside the main contract." },
  { id: "not_confirmed", label: "Not yet confirmed", detail: "Keep unresolved until the contract source is reviewed." },
] as const;

export const clientOnboardingMainContractTypes = clientOnboardingContractTypes.filter((type) => type.id === "msa" || type.id === "lsa" || type.id === "not_confirmed");

export type ClientOnboardingContractType = (typeof clientOnboardingContractTypes)[number]["id"];

export type ClientOnboardingContract = {
  recordType: ClientOnboardingContractType;
  referenceCode: string;
  sourceReference: string;
};

export type ClientOnboardingDocumentType = (typeof clientOnboardingDocumentTypes)[number]["id"];
export type ClientOnboardingDocumentStatus = "not_captured" | "received" | "not_applicable" | "unknown";

export const clientOnboardingDocumentStatusOptions = [
  { value: "not_captured", label: "Not recorded" },
  { value: "received", label: "Available" },
  { value: "not_applicable", label: "Not applicable" },
  { value: "unknown", label: "Unknown / verify" },
] as const satisfies ReadonlyArray<{ value: ClientOnboardingDocumentStatus; label: string }>;

export type ClientOnboardingDocument = {
  type: ClientOnboardingDocumentType;
  status: ClientOnboardingDocumentStatus;
  sourceReference: string;
  notes: string;
};

export type ClientOnboardingIdentity = {
  clientReferenceCode: string;
  clientDisplayName: string;
  entityReferenceCode: string;
  entityDisplayName: string;
  tin: string;
  unitReferenceCode: string;
  unitDisplayName: string;
  unitKind: "head_office" | "branch" | "other";
  sourceReference: string;
  goLiveDate?: string;
};

/** Keep the source value numeric; punctuation is presentation only. */
export function normalizeTinDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 14);
}

export function formatTin(value: string): string {
  const digits = normalizeTinDigits(value);
  if (!digits) return "";
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9), digits.slice(9, 14)].filter(Boolean).join("-");
}

export function generatedEntityReference(clientReferenceCode: string): string {
  return `ENTITY-${clientReferenceCode.trim().toUpperCase()}`.slice(0, 64);
}

export type ClientOnboardingReadiness = {
  status: "intake_incomplete" | "source_pack_incomplete" | "ready_for_human_review";
  identityGaps: string[];
  sourcePackGaps: string[];
  activationBlocked: true;
};

const requiredIdentityFields: Array<[keyof ClientOnboardingIdentity, string]> = [
  ["clientReferenceCode", "Client reference code"],
  ["clientDisplayName", "Client display name"],
  ["entityDisplayName", "Taxpayer entity name"],
  ["unitReferenceCode", "Registration unit reference code"],
  ["unitDisplayName", "Registration unit name"],
];

export function getClientOnboardingReadiness(
  identity: ClientOnboardingIdentity,
  documents: readonly ClientOnboardingDocument[],
): ClientOnboardingReadiness {
  const identityGaps = requiredIdentityFields
    .filter(([field]) => !String(identity[field] ?? "").trim())
    .map(([, label]) => `${label} is required.`);

  const sourcePackGaps = clientOnboardingDocumentTypes.flatMap((definition) => {
    const document = documents.find((candidate) => candidate.type === definition.id);
    if (!document || document.status === "not_captured") return [`${definition.label} status is not recorded.`];
    if (document.status === "received" && !document.sourceReference.trim()) return [`${definition.label} source reference is required.`];
    if ((document.status === "unknown" || document.status === "not_applicable") && !document.notes.trim()) return [`${definition.label} needs a rationale.`];
    return [];
  });

  return {
    status: identityGaps.length > 0 ? "intake_incomplete" : sourcePackGaps.length > 0 ? "source_pack_incomplete" : "ready_for_human_review",
    identityGaps,
    sourcePackGaps,
    activationBlocked: true,
  };
}
