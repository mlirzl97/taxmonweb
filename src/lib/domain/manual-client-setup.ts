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
};

export type ManualClientSetupResult =
  | { ok: true; value: ManualClientSetupInput }
  | { ok: false; errors: string[] };

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
  const entityReferenceCode = requireText(source, "entityReferenceCode", errors, 64);
  const entityDisplayName = requireText(source, "entityDisplayName", errors, 160);
  const unitReferenceCode = requireText(source, "unitReferenceCode", errors, 64);
  const unitDisplayName = requireText(source, "unitDisplayName", errors, 160);
  const sourceReference = requireText(source, "sourceReference", errors, 240);
  const tin = optionalText(source, "tin", errors, 64);
  const registrationReference = optionalText(source, "registrationReference", errors, 160);
  const organizationUnitId = requireText(source, "organizationUnitId", errors, 36);
  const sourceNotes = optionalText(source, "sourceNotes", errors, 500);
  const unitKind = readText(source, "unitKind");
  const sourceSystem = readText(source, "sourceSystem");

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
    },
  };
}
