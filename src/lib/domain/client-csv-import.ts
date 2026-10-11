import { clientOnboardingContractTypes, type ClientOnboardingContract, type ClientOnboardingIdentity } from "./client-onboarding";

export const clientCsvTemplateHeaders = [
  "client_reference_code",
  "client_display_name",
  "entity_reference_code",
  "entity_display_name",
  "tin",
  "unit_reference_code",
  "unit_display_name",
  "unit_kind",
  "contract_record_type",
  "contract_reference_code",
  "contract_source_reference",
  "source_reference",
  "source_system",
  "source_notes",
] as const;

const requiredHeaders = clientCsvTemplateHeaders.filter((header) => !["tin", "unit_kind", "contract_record_type", "contract_reference_code", "contract_source_reference", "source_system", "source_notes"].includes(header));
const referenceCodePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const unitKinds = ["head_office", "branch", "other"] as const;
const sourceSystems = ["sharepoint", "synthetic_fixture", "manual_reference"] as const;

export type ClientCsvImportRow = {
  rowNumber: number;
  identity: ClientOnboardingIdentity;
  contract: ClientOnboardingContract;
  sourceSystem: (typeof sourceSystems)[number];
  sourceNotes: string;
};

export type ClientCsvImportError = {
  rowNumber?: number;
  field?: string;
  message: string;
};

export type ClientCsvImportResult = {
  headers: string[];
  ignoredHeaders: string[];
  rows: ClientCsvImportRow[];
  errors: ClientCsvImportError[];
};

/**
 * Parse the deliberately narrow client-intake CSV contract. This parser only
 * creates normalized intake rows; it never activates a Tax Profile or creates
 * compliance work.
 */
export function parseClientSetupCsv(input: string): ClientCsvImportResult {
  const errors: ClientCsvImportError[] = [];
  const records = parseCsvRecords(input, errors);
  if (records.length === 0) return { headers: [], ignoredHeaders: [], rows: [], errors: [{ message: "The CSV is empty." }, ...errors] };

  const headers = records[0].map((header) => normalizeHeader(header));
  const seenHeaders = new Set<string>();
  headers.forEach((header, index) => {
    if (!header) errors.push({ rowNumber: 1, field: `column ${index + 1}`, message: "Column headers cannot be blank." });
    if (seenHeaders.has(header)) errors.push({ rowNumber: 1, field: header, message: "Duplicate column header." });
    seenHeaders.add(header);
  });

  requiredHeaders.forEach((header) => {
    if (!headers.includes(header)) errors.push({ rowNumber: 1, field: header, message: "Required column is missing." });
  });

  const headerIndex = new Map(headers.map((header, index) => [header, index]));
  const ignoredHeaders = headers.filter((header) => header && !clientCsvTemplateHeaders.includes(header as typeof clientCsvTemplateHeaders[number]));
  const rows: ClientCsvImportRow[] = [];
  const seenReferences = new Set<string>();

  records.slice(1).forEach((record, recordIndex) => {
    const rowNumber = recordIndex + 2;
    if (record.every((value) => !value.trim())) return;
    const value = (header: string) => record[headerIndex.get(header) ?? -1]?.trim() ?? "";
    const rowErrors: ClientCsvImportError[] = [];
    const clientReferenceCode = value("client_reference_code").toUpperCase();
    const clientDisplayName = value("client_display_name");
    const entityReferenceCode = value("entity_reference_code").toUpperCase();
    const entityDisplayName = value("entity_display_name");
    const tin = value("tin");
    const unitReferenceCode = value("unit_reference_code").toUpperCase();
    const unitDisplayName = value("unit_display_name");
    const contractRecordTypeInput = value("contract_record_type").toLowerCase().trim().replace(/[ -]+/g, "_");
    const contractRecordType = normalizeContractRecordType(contractRecordTypeInput);
    const contractReferenceCode = value("contract_reference_code").toUpperCase();
    const contractSourceReference = value("contract_source_reference");
    const sourceReference = value("source_reference");
    const unitKind = normalizeUnitKind(value("unit_kind"));
    const sourceSystem = normalizeSourceSystem(value("source_system"));
    const sourceNotes = value("source_notes");

    for (const [field, fieldValue] of [
      ["client_reference_code", clientReferenceCode],
      ["client_display_name", clientDisplayName],
      ["entity_reference_code", entityReferenceCode],
      ["entity_display_name", entityDisplayName],
      ["unit_reference_code", unitReferenceCode],
      ["unit_display_name", unitDisplayName],
      ["source_reference", sourceReference],
    ] as const) {
      if (!fieldValue) rowErrors.push({ rowNumber, field, message: "Required value is blank." });
      if (fieldValue.length > 160) rowErrors.push({ rowNumber, field, message: "Value is too long." });
    }

    if (clientReferenceCode && !referenceCodePattern.test(clientReferenceCode)) rowErrors.push({ rowNumber, field: "client_reference_code", message: "Use letters, numbers, dots, underscores, or hyphens only." });
    if (entityReferenceCode && !referenceCodePattern.test(entityReferenceCode)) rowErrors.push({ rowNumber, field: "entity_reference_code", message: "Use letters, numbers, dots, underscores, or hyphens only." });
    if (unitReferenceCode && !referenceCodePattern.test(unitReferenceCode)) rowErrors.push({ rowNumber, field: "unit_reference_code", message: "Use letters, numbers, dots, underscores, or hyphens only." });
    if (contractReferenceCode && !referenceCodePattern.test(contractReferenceCode)) rowErrors.push({ rowNumber, field: "contract_reference_code", message: "Use letters, numbers, dots, underscores, or hyphens only." });
    if (clientReferenceCode && seenReferences.has(clientReferenceCode)) rowErrors.push({ rowNumber, field: "client_reference_code", message: "Client reference is duplicated in this file." });
    if (clientReferenceCode) seenReferences.add(clientReferenceCode);
    if (tin.length > 64) rowErrors.push({ rowNumber, field: "tin", message: "Value is too long." });
    if (contractRecordTypeInput && !isContractRecordType(contractRecordTypeInput === "crf/crn" ? "crf_crn" : contractRecordTypeInput)) rowErrors.push({ rowNumber, field: "contract_record_type", message: "Use msa, lsa, addendum, crf_crn, or not_confirmed." });
    if (sourceNotes.length > 500) rowErrors.push({ rowNumber, field: "source_notes", message: "Value is too long." });
    if (!unitKind) rowErrors.push({ rowNumber, field: "unit_kind", message: "Use head_office, branch, or other." });
    if (!sourceSystem) rowErrors.push({ rowNumber, field: "source_system", message: "Use sharepoint, synthetic_fixture, or manual_reference." });

    errors.push(...rowErrors);
    if (rowErrors.length > 0 || !unitKind || !sourceSystem) return;
    rows.push({
      rowNumber,
      identity: { clientReferenceCode, clientDisplayName, entityReferenceCode, entityDisplayName, tin, unitReferenceCode, unitDisplayName, unitKind, sourceReference },
      contract: { recordType: contractRecordType, referenceCode: contractReferenceCode, sourceReference: contractSourceReference },
      sourceSystem,
      sourceNotes,
    });
  });

  return { headers, ignoredHeaders, rows, errors };
}

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[ -]+/g, "_");
}

function normalizeUnitKind(value: string): ClientCsvImportRow["identity"]["unitKind"] | undefined {
  const normalized = value.toLowerCase().trim().replace(/[ -]+/g, "_");
  if (!normalized) return "head_office";
  return unitKinds.includes(normalized as typeof unitKinds[number]) ? normalized as ClientCsvImportRow["identity"]["unitKind"] : undefined;
}

function normalizeSourceSystem(value: string): ClientCsvImportRow["sourceSystem"] | undefined {
  const normalized = value.toLowerCase().trim().replace(/[ -]+/g, "_");
  if (!normalized) return "manual_reference";
  return sourceSystems.includes(normalized as typeof sourceSystems[number]) ? normalized as ClientCsvImportRow["sourceSystem"] : undefined;
}

function normalizeContractRecordType(value: string): ClientCsvImportRow["contract"]["recordType"] {
  const normalized = value.toLowerCase().trim().replace(/[ -]+/g, "_");
  if (normalized === "crf/crn") return "crf_crn";
  return isContractRecordType(normalized) ? normalized as ClientCsvImportRow["contract"]["recordType"] : "not_confirmed";
}

function isContractRecordType(value: string): value is ClientCsvImportRow["contract"]["recordType"] {
  return clientOnboardingContractTypes.some((candidate) => candidate.id === value);
}

function parseCsvRecords(input: string, errors: ClientCsvImportError[]): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let value = "";
  let quoted = false;
  let sawContent = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const next = input[index + 1];
    if (character === '"') {
      if (quoted && next === '"') { value += '"'; index += 1; continue; }
      quoted = !quoted;
      sawContent = true;
      continue;
    }
    if (!quoted && character === ",") { record.push(value); value = ""; sawContent = true; continue; }
    if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && next === "\n") index += 1;
      record.push(value); value = "";
      if (sawContent || record.some((cell) => cell.trim())) records.push(record);
      record = [];
      sawContent = false;
      continue;
    }
    value += character;
    if (!/\s/.test(character)) sawContent = true;
  }

  if (quoted) errors.push({ rowNumber: records.length + 1, message: "The CSV contains an unterminated quoted value." });
  if (sawContent || value || record.length > 0) { record.push(value); records.push(record); }
  return records;
}
