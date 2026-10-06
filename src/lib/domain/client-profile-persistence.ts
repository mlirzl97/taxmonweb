import type { FixtureAssignment, FixtureRegistrationUnit, FixtureTaxProfile } from "@/lib/fixtures";

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
      booksType: profile.booksType ?? "",
      invoicing: profile.invoicing ?? "",
      paymentRoute: profile.paymentRoute,
      clientWeight: String(profile.weight),
      enateSetup: profile.enateSetup,
      sourceReference: profile.sourceLabel,
      sourceKind: profile.sourceKind,
      extractionFields: profile.extractionFields ?? [],
      authorities: profile.authorities,
      sourceProvenance: profile.sourceLabel,
      assignmentActors: [assignment.preparer, assignment.checker, assignment.reviewer],
    },
    assignment: {
      preparer: assignment.preparer,
      checker: assignment.checker,
      reviewer: assignment.reviewer,
      tower: assignment.tower,
      cluster: assignment.cluster,
      effectiveFrom: assignment.effectiveFrom,
    },
    effectiveFrom,
    reason: reason.trim(),
  };
}

export type PersistedTaxProfileSnapshot = {
  state: "draft" | "ready_for_validation" | "active" | "superseded";
  effectiveFrom: string;
  profile: Record<string, unknown>;
  assignment: Record<string, unknown>;
};

function text(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
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
    booksType: text(source.booksType, baseProfile.booksType ?? ""),
    invoicing: text(source.invoicing, baseProfile.invoicing ?? ""),
    paymentRoute: oneOf(source.paymentRoute, ["Client Pays", "TMF Pays", "Not configured"] as const, baseProfile.paymentRoute),
    weight: Number.isFinite(weight) ? weight : baseProfile.weight,
    weightLabel: baseProfile.weightLabel,
    enateSetup: oneOf(source.enateSetup, ["Yes", "No", "Unknown"] as const, baseProfile.enateSetup),
    profileState: snapshot.state === "active" ? "Active" : snapshot.state === "ready_for_validation" ? "Ready for validation" : "Setup incomplete",
    sourceLabel: text(source.sourceReference, baseProfile.sourceLabel),
    sourceKind: oneOf(source.sourceKind, ["2303-derived", "approved registration source", "manual validation"] as const, baseProfile.sourceKind),
    authorities: Array.isArray(source.authorities) ? source.authorities as FixtureTaxProfile["authorities"] : baseProfile.authorities,
    extractionFields: Array.isArray(source.extractionFields) ? source.extractionFields as FixtureTaxProfile["extractionFields"] : baseProfile.extractionFields,
    lastValidated: snapshot.state === "active" ? baseProfile.lastValidated ?? snapshot.effectiveFrom : baseProfile.lastValidated,
  };
  const assignment: FixtureAssignment = {
    ...baseAssignment,
    preparer: text(savedAssignment.preparer, baseAssignment.preparer),
    checker: text(savedAssignment.checker, baseAssignment.checker),
    reviewer: text(savedAssignment.reviewer, baseAssignment.reviewer),
    tower: text(savedAssignment.tower, baseAssignment.tower),
    cluster: text(savedAssignment.cluster, baseAssignment.cluster),
    effectiveFrom: text(savedAssignment.effectiveFrom, snapshot.effectiveFrom),
  };
  return { profile, assignment };
}

export function profileActivationGaps(profile: FixtureTaxProfile, assignment: FixtureAssignment, unit: FixtureRegistrationUnit): string[] {
  const gaps: string[] = [];
  if (!profile.registeredTaxpayerName.trim()) gaps.push("registered taxpayer name");
  if (!profile.tinDisplay.trim()) gaps.push("TIN");
  if (!unit.name.trim()) gaps.push("Registration Unit identity");
  if (!profile.sourceLabel.trim()) gaps.push("approved source/provenance");
  if (!profile.filingChannel.trim() || /not configured|needs review/i.test(profile.filingChannel)) gaps.push("filing channel");
  if (!profile.fiscalYearEnd?.trim() || /requires|not configured|needs/i.test(profile.fiscalYearEnd)) gaps.push("fiscal year-end");
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
