import type { FixtureAssignment, FixtureClient, FixtureRegistrationUnit, FixtureTaxProfile } from "@/lib/fixtures";
import { normalizeClientDeadlinePolicy } from "@/lib/domain/client-deadline-policy";

export const prototypeClientProfileUpdatedEvent = "taxmonweb:client-profile-updated";

export function calibrationProfileStorageKey(clientId: string) {
  return `taxmonweb.calibration.tax-profile.${clientId}`;
}

export type TaxProfilePersistencePayload = {
  profile: Record<string, unknown>;
  assignment: Record<string, unknown>;
  effectiveFrom: string;
  reason: string;
};

export function buildTaxProfilePersistencePayload(
  profile: FixtureTaxProfile,
  assignment: FixtureAssignment,
  unit: FixtureRegistrationUnit,
  reason: string,
  effectiveFrom = new Date().toISOString().slice(0, 10),
): TaxProfilePersistencePayload {
  return {
    profile: {
      registeredTaxpayerName: profile.registeredTaxpayerName,
      tinDisplay: profile.tinDisplay,
      branchCode: profile.branchCode,
      registrationUnitIdentity: unit.name,
      rdoOrLts: profile.rdoOrLts,
      entityType: profile.entityType,
      registeredAddress: profile.registeredAddress,
      lineOfBusiness: profile.lineOfBusiness,
      registrationEffective: profile.registrationEffective,
      registrationStatus: profile.registrationStatus,
      fiscalYearEnd: profile.fiscalYearEnd ?? "",
      filingChannel: profile.filingChannel,
      filingContext: profile.filingContext,
      eFPSGroup: profile.eFPSGroup ?? "",
      registeredTaxTypes: profile.registeredTaxTypes,
      registeredTaxTypeCodes: profile.registeredTaxTypeCodes ?? [],
      registeredReturnCodes: profile.registeredReturnCodes ?? [],
      taxYearBasis: profile.taxYearBasis ?? "",
      booksType: profile.booksType ?? "",
      accountingSystem: profile.accountingSystem ?? "",
      invoicing: profile.invoicing ?? "",
      goLiveDate: profile.goLiveDate ?? "",
      firstPeriodToFile: profile.firstPeriodToFile ?? "",
      permanentFileLink: profile.permanentFileLink ?? "",
      paymentRoute: profile.paymentRoute,
      clientWeight: String(profile.weight),
      enateSetup: profile.enateSetup,
      sourceReference: profile.sourceLabel,
      sourceKind: profile.sourceKind,
      extractionFields: profile.extractionFields ?? [],
      authorities: profile.authorities,
      auditExposures: profile.auditExposures,
      sourceProvenance: profile.sourceLabel,
      deadlinePolicy: profile.deadlinePolicy,
      assignmentActors: [assignment.preparer, assignment.checker, assignment.reviewer],
    },
    assignment: {
      preparer: assignment.preparer,
      checker: assignment.checker,
      reviewer: assignment.reviewer,
      ...(assignment.preparerUserId ? { preparerUserId: assignment.preparerUserId } : {}),
      ...(assignment.checkerUserId ? { checkerUserId: assignment.checkerUserId } : {}),
      ...(assignment.reviewerUserId ? { reviewerUserId: assignment.reviewerUserId } : {}),
      tower: assignment.tower,
      cluster: assignment.cluster,
      effectiveFrom: assignment.effectiveFrom,
    },
    effectiveFrom,
    reason: reason.trim(),
  };
}

export type PersistedTaxProfileSnapshot = {
  /** Saved version id; validation activates exactly this version. */
  id?: string;
  state: "draft" | "ready_for_validation" | "active" | "superseded";
  effectiveFrom: string;
  profile: Record<string, unknown>;
  assignment: Record<string, unknown>;
  /** Server-owned validation evidence. A creator/editor is not a validator. */
  validatedAt?: string | null;
  validatedBy?: string | null;
};

export function readCalibrationProfileSnapshot(clientId: string): PersistedTaxProfileSnapshot | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(calibrationProfileStorageKey(clientId));
  if (!stored) return null;
  try {
    return JSON.parse(stored) as PersistedTaxProfileSnapshot;
  } catch {
    return null;
  }
}

/**
 * The small Clients-list check represents a governed validation event, not
 * authorship or edit access. Both the active state and validator evidence are
 * required before it is shown.
 */
export function hasCredibleTaxProfileValidation(profile: Pick<FixtureTaxProfile, "profileState" | "lastValidated" | "validator">) {
  return profile.profileState === "Active" && Boolean(profile.lastValidated?.trim() && profile.validator?.trim());
}

function configured(value: string | undefined): boolean {
  return Boolean(value?.trim()) && !/not configured|needs review|unknown|missing|requires approved/i.test(value ?? "");
}

/** Keep fixture and persisted attention projections aligned with the current saved controls. */
export function reconcileClientAttention(attention: readonly string[], profile: FixtureTaxProfile, assignment: FixtureAssignment): string[] {
  const distinctRoles = new Set([assignment.preparer, assignment.checker, assignment.reviewer]).size === 3;
  return Array.from(new Set(attention.filter((item) => {
    const normalized = item.toLowerCase();
    if (normalized.includes("assignment incomplete")) return assignment.preparer === "Unassigned" || assignment.checker === "Unassigned" || assignment.reviewer === "Unassigned" || !distinctRoles;
    if (normalized.includes("preparer assignment missing")) return assignment.preparer === "Unassigned";
    if (normalized.includes("checker assignment missing")) return assignment.checker === "Unassigned";
    if (normalized.includes("reviewer assignment missing")) return assignment.reviewer === "Unassigned";
    if (normalized.includes("checker and reviewer conflict")) return !distinctRoles;
    if (normalized.includes("rdo") && (normalized.includes("missing") || normalized.includes("requires"))) return !configured(profile.rdoOrLts);
    if (normalized.includes("fiscal year-end missing")) return profile.taxYearBasis === "Fiscal year" && !configured(profile.fiscalYearEnd);
    if (normalized.includes("tax year basis missing")) return !profile.taxYearBasis;
    if (normalized.includes("accounting system missing")) return !configured(profile.accountingSystem);
    if (normalized.includes("filing channel missing")) return !configured(profile.filingChannel);
    if (normalized.includes("efps context requires")) return profile.filingChannel === "eFPS" && !configured(profile.eFPSGroup);
    if (normalized.includes("payment route missing")) return !configured(profile.paymentRoute);
    if (normalized.includes("enate setup unknown")) return profile.enateSetup === "Unknown";
    return true;
  })));
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}

function weightLabel(weight: number): string {
  return ({
    1: "Super Light",
    2: "Light",
    3: "Medium",
    4: "Heavy",
    5: "Super Heavy",
  } as Record<number, string>)[weight] ?? "Not assessed";
}

/** Use the assigned operating weight when a source reconciliation weight is unavailable. */
// A saved id wins. A label-only save inherits the current owner's id only when
// it names that same person, so a stale label never borrows someone's id.
function restoredUserId(savedUserId: unknown, savedLabel: unknown, baseLabel: string, baseUserId: string | undefined): string | undefined {
  if (typeof savedUserId === "string" && savedUserId) return savedUserId;
  if (typeof savedLabel === "string" && savedLabel.trim() && savedLabel.trim().toLowerCase() !== baseLabel.toLowerCase()) return undefined;
  return baseUserId;
}

export function getClientDisplayWeight(profile: Pick<FixtureTaxProfile, "sourceFinalWeight" | "weight">): number | null {
  if (profile.sourceFinalWeight !== null) return profile.sourceFinalWeight;
  return profile.weight >= 1 && profile.weight <= 5 ? profile.weight : null;
}

export function getClientDisplayWeightLabel(profile: Pick<FixtureTaxProfile, "sourceFinalWeight" | "sourceWeightClassification" | "weightLabel" | "weight">): string {
  if (getClientDisplayWeight(profile) === null) return "Not assessed";
  return profile.sourceFinalWeight === null ? profile.weightLabel : profile.sourceWeightClassification ?? profile.weightLabel;
}

/** Apply a server-owned version to the current read model without making the
 * Tax Profile domain depend on the database's JSON shape. */
export function applyPersistedTaxProfileSnapshot(
  baseProfile: FixtureTaxProfile,
  baseAssignment: FixtureAssignment,
  snapshot: PersistedTaxProfileSnapshot,
): { profile: FixtureTaxProfile; assignment: FixtureAssignment } {
  const source = snapshot.profile;
  const savedAssignment = snapshot.assignment;
  const weight = Number(source.clientWeight);
  const hasRecordedValidation = snapshot.state === "active" && Boolean(snapshot.validatedAt?.trim() && snapshot.validatedBy?.trim());
  const profile: FixtureTaxProfile = {
    ...baseProfile,
    registeredTaxpayerName: text(source.registeredTaxpayerName, baseProfile.registeredTaxpayerName),
    tinDisplay: text(source.tinDisplay, baseProfile.tinDisplay),
    branchCode: text(source.branchCode, baseProfile.branchCode),
    rdoOrLts: text(source.rdoOrLts, baseProfile.rdoOrLts),
    entityType: text(source.entityType, baseProfile.entityType),
    registeredAddress: text(source.registeredAddress, baseProfile.registeredAddress),
    lineOfBusiness: text(source.lineOfBusiness, baseProfile.lineOfBusiness),
    registrationEffective: text(source.registrationEffective, baseProfile.registrationEffective),
    registrationStatus: text(source.registrationStatus, baseProfile.registrationStatus),
    fiscalYearEnd: text(source.fiscalYearEnd, baseProfile.fiscalYearEnd ?? ""),
    filingChannel: text(source.filingChannel, baseProfile.filingChannel),
    filingContext: text(source.filingContext, baseProfile.filingContext),
    eFPSGroup: text(source.eFPSGroup, baseProfile.eFPSGroup ?? ""),
    registeredTaxTypes: Array.isArray(source.registeredTaxTypes) ? source.registeredTaxTypes.filter((value): value is string => typeof value === "string") : baseProfile.registeredTaxTypes,
    registeredTaxTypeCodes: Array.isArray(source.registeredTaxTypeCodes) ? source.registeredTaxTypeCodes.filter((value): value is string => typeof value === "string") : baseProfile.registeredTaxTypeCodes,
    registeredReturnCodes: Array.isArray(source.registeredReturnCodes) ? source.registeredReturnCodes.filter((value): value is string => typeof value === "string") : baseProfile.registeredReturnCodes,
    taxYearBasis: source.taxYearBasis === "Calendar year" || source.taxYearBasis === "Fiscal year" ? source.taxYearBasis : baseProfile.taxYearBasis,
    goLiveDate: text(source.goLiveDate, baseProfile.goLiveDate ?? ""),
    firstPeriodToFile: text(source.firstPeriodToFile, baseProfile.firstPeriodToFile ?? ""),
    permanentFileLink: text(source.permanentFileLink, baseProfile.permanentFileLink ?? ""),
    booksType: text(source.booksType, baseProfile.booksType ?? ""),
    accountingSystem: text(source.accountingSystem, baseProfile.accountingSystem ?? ""),
    invoicing: text(source.invoicing, baseProfile.invoicing ?? ""),
    paymentRoute: oneOf(source.paymentRoute, ["Client Pays", "TMF Pays", "Not configured"] as const, baseProfile.paymentRoute),
    weight: Number.isFinite(weight) ? weight : baseProfile.weight,
    weightLabel: weightLabel(Number.isFinite(weight) ? weight : baseProfile.weight),
    sourceFinalWeight: Number.isFinite(weight) && weight >= 1 && weight <= 5 ? weight : baseProfile.sourceFinalWeight,
    sourceWeightClassification: Number.isFinite(weight) && weight >= 1 && weight <= 5 ? weightLabel(weight) as FixtureTaxProfile["sourceWeightClassification"] : baseProfile.sourceWeightClassification,
    enateSetup: oneOf(source.enateSetup, ["Yes", "No", "Unknown"] as const, baseProfile.enateSetup),
    profileState: snapshot.state === "active" ? "Active" : snapshot.state === "ready_for_validation" ? "Ready for validation" : "Setup incomplete",
    sourceLabel: text(source.sourceReference, baseProfile.sourceLabel),
    sourceKind: oneOf(source.sourceKind, ["2303-derived", "approved registration source", "manual validation"] as const, baseProfile.sourceKind),
    authorities: Array.isArray(source.authorities) ? source.authorities as FixtureTaxProfile["authorities"] : baseProfile.authorities,
    auditExposures: Array.isArray(source.auditExposures) ? source.auditExposures as FixtureTaxProfile["auditExposures"] : baseProfile.auditExposures,
    extractionFields: Array.isArray(source.extractionFields) ? source.extractionFields as FixtureTaxProfile["extractionFields"] : baseProfile.extractionFields,
    deadlinePolicy: source.deadlinePolicy === undefined ? baseProfile.deadlinePolicy : normalizeClientDeadlinePolicy(source.deadlinePolicy),
    lastValidated: hasRecordedValidation ? snapshot.validatedAt ?? undefined : undefined,
    validator: hasRecordedValidation ? snapshot.validatedBy ?? undefined : undefined,
  };
  const assignment: FixtureAssignment = {
    ...baseAssignment,
    preparer: text(savedAssignment.preparer, baseAssignment.preparer),
    checker: text(savedAssignment.checker, baseAssignment.checker),
    reviewer: text(savedAssignment.reviewer, baseAssignment.reviewer),
    preparerUserId: restoredUserId(savedAssignment.preparerUserId, savedAssignment.preparer, baseAssignment.preparer, baseAssignment.preparerUserId),
    checkerUserId: restoredUserId(savedAssignment.checkerUserId, savedAssignment.checker, baseAssignment.checker, baseAssignment.checkerUserId),
    reviewerUserId: restoredUserId(savedAssignment.reviewerUserId, savedAssignment.reviewer, baseAssignment.reviewer, baseAssignment.reviewerUserId),
    tower: text(savedAssignment.tower, baseAssignment.tower),
    cluster: text(savedAssignment.cluster, baseAssignment.cluster),
    effectiveFrom: text(savedAssignment.effectiveFrom, snapshot.effectiveFrom),
  };
  return { profile, assignment };
}

/** Project a saved prototype profile into the shared client read model. */
export function applyPersistedClientSnapshot(client: FixtureClient, snapshot: PersistedTaxProfileSnapshot): FixtureClient {
  const entity = client.entities[0];
  if (!entity) return client;
  const restored = applyPersistedTaxProfileSnapshot(entity.profile, client.assignment, snapshot);
  return {
    ...client,
    assignment: restored.assignment,
    entities: client.entities.map((candidate, index) => index === 0 ? { ...candidate, profile: restored.profile } : candidate),
  };
}

export function applySavedCalibrationToClient(client: FixtureClient): FixtureClient {
  const snapshot = readCalibrationProfileSnapshot(client.id);
  return snapshot ? applyPersistedClientSnapshot(client, snapshot) : client;
}

export function profileActivationGaps(profile: FixtureTaxProfile, assignment: FixtureAssignment, unit: FixtureRegistrationUnit): string[] {
  const gaps: string[] = [];
  if (!profile.registeredTaxpayerName.trim()) gaps.push("registered taxpayer name");
  if (!profile.tinDisplay.trim()) gaps.push("TIN");
  if (!unit.name.trim()) gaps.push("Registration Unit identity");
  if (!profile.sourceLabel.trim()) gaps.push("approved source/provenance");
  if (!profile.filingChannel.trim() || /not configured|needs review/i.test(profile.filingChannel)) gaps.push("filing channel");
  if (!profile.taxYearBasis) gaps.push("tax year basis");
  if (profile.taxYearBasis === "Fiscal year" && (!profile.fiscalYearEnd?.trim() || /requires|not configured|needs/i.test(profile.fiscalYearEnd))) gaps.push("fiscal year-end");
  if (!assignment.cluster.trim()) gaps.push("Cluster");
  if (!assignment.tower.trim()) gaps.push("Tower");
  if (!assignment.preparer.trim() || assignment.preparer === "Unassigned") gaps.push("Preparer");
  if (!assignment.checker.trim() || assignment.checker === "Unassigned") gaps.push("Checker");
  if (!assignment.reviewer.trim() || assignment.reviewer === "Unassigned") gaps.push("Reviewer");
  if (new Set([assignment.preparer, assignment.checker, assignment.reviewer]).size !== 3) gaps.push("distinct Preparer, Checker, and Reviewer");
  if (profile.weight < 1 || profile.weight > 5) gaps.push("Client Weight");
  if (profile.enateSetup === "Unknown") gaps.push("eNATE setup");
  if (profile.paymentRoute === "Not configured") gaps.push("payment route");
  return gaps;
}
