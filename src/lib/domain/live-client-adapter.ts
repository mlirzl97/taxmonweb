import type { PortfolioClient } from "@/lib/server/client-repository";
import type { FixtureChangeRequestForm, FixtureChangeRequestFormStatus, FixtureChangeRequestFormType, FixtureClient, FixtureContractRepository, FixtureScope, FixtureTaxProfile, FixtureTeamHistory } from "@/lib/fixtures";
import { formatTin } from "./client-onboarding";
import { applyPersistedTaxProfileSnapshot, type PersistedTaxProfileSnapshot } from "./client-profile-persistence";

function firstRelation<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

function scopeForClient(client: PortfolioClient): { tower: FixtureScope; cluster: string; resolved: boolean } {
  const today = new Date().toISOString().slice(0, 10);
  const organizationUnits = client.taxpayer_entities
    .flatMap((entity) => entity.registration_units)
    .flatMap((unit) => unit.registration_unit_scope_assignments)
    .filter((assignment) => (!assignment.effective_from || assignment.effective_from <= today) && (!assignment.effective_to || assignment.effective_to >= today))
    .flatMap((assignment) => Array.isArray(assignment.organization_units) ? assignment.organization_units : [assignment.organization_units])
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate?.code || candidate?.name));
  const resolved = organizationUnits.find((candidate) => candidate.unit_kind === "tower" && !/review|required|unresolved|unknown/i.test(candidate.name));
  const towerParent = resolved ? (Array.isArray(resolved.parent) ? resolved.parent[0] : resolved.parent) : null;
  // A tower scope implies its parent cluster; an explicit cluster scope still wins.
  const resolvedCluster = organizationUnits.find((candidate) => candidate.unit_kind === "cluster" && !/review|required|unresolved|unknown/i.test(candidate.name))
    ?? (towerParent?.unit_kind === "cluster" ? towerParent : undefined);
  return {
    // The adapter keeps the legacy UI type for compatibility, but the runtime
    // sentinel intentionally does not match any selectable tower filter.
    tower: (resolved?.name ?? "Unresolved") as FixtureScope,
    cluster: resolvedCluster?.name ?? "Unresolved",
    resolved: Boolean(resolved),
  };
}

function contractStatus(status: string): "Active" | "Pending review" | "Closed" {
  return status === "active" ? "Active" : status === "closed" ? "Closed" : "Pending review";
}

function changeRequestType(title: string): FixtureChangeRequestFormType {
  const normalized = title.toLowerCase();
  if (normalized.includes("audit")) return "Tax audit support";
  if (normalized.includes("registration")) return "Registration remediation";
  return "Additional tax service";
}

function changeRequestStatus(status: string): FixtureChangeRequestFormStatus {
  return status === "active" ? "Active" : status === "closed" ? "Closed" : "Pending review";
}

function currentClientGroup(client: PortfolioClient): string | undefined {
  const today = new Date().toISOString().slice(0, 10);
  const membership = [...client.client_group_memberships]
    .filter((item) => item.effective_from <= today && (!item.effective_to || item.effective_to >= today))
    .sort((left, right) => right.effective_from.localeCompare(left.effective_from))
    .find((item) => {
      const group = Array.isArray(item.client_groups) ? item.client_groups[0] : item.client_groups;
      return group?.status === "active" && Boolean(group.display_name);
    });
  if (!membership) return undefined;
  const group = Array.isArray(membership.client_groups) ? membership.client_groups[0] : membership.client_groups;
  return group?.display_name;
}

/**
 * Projects a normalized additional engagement into the legacy CRF read model.
 * The projection intentionally leaves ownership unresolved until an authenticated
 * app user is linked through governed assignment data.
 */
export function additionalEngagementToFixtureChangeRequestForm(
  client: Pick<PortfolioClient, "reference_code" | "display_name"> & { contractRepositoryId: string },
  engagement: {
    id: string;
    contract_repository_id?: string;
    reference_code: string;
    title: string;
    status: string;
    effective_from: string;
    source_reference: string;
    scope_summary: string;
  },
): FixtureChangeRequestForm {
  return {
    id: engagement.id,
    referenceCode: engagement.reference_code,
    clientId: client.reference_code,
    contractRepositoryId: client.contractRepositoryId,
    clientName: client.display_name,
    title: engagement.title,
    type: changeRequestType(engagement.title),
    status: changeRequestStatus(engagement.status),
    requestedOn: engagement.effective_from,
    requestedBy: "Repository record",
    owner: "Unassigned",
    scopeSummary: engagement.scope_summary,
    sourceReference: engagement.source_reference,
    templateVersion: "CRF v1",
  };
}

function currentAssignment(client: PortfolioClient): Pick<FixtureClient["assignment"], "preparer" | "checker" | "reviewer" | "effectiveFrom"> {
  const today = new Date().toISOString().slice(0, 10);
  const clientAssignments = client.client_team_assignments.map((assignment) => ({ ...assignment, source: "client" as const }));
  const unitAssignments = client.taxpayer_entities.flatMap((entity) => entity.registration_units.flatMap((unit) => unit.registration_unit_team_assignments.map((assignment) => ({ ...assignment, source: "registration_unit" as const }))));
  const current = [...clientAssignments, ...unitAssignments].filter((assignment) => assignment.effective_from <= today && (!assignment.effective_to || assignment.effective_to >= today));
  const namesFor = (role: PortfolioClient["client_team_assignments"][number]["assignment_role"]) => current
    .filter((assignment) => assignment.assignment_role === role)
    .map((assignment) => Array.isArray(assignment.app_users) ? assignment.app_users[0]?.display_name ?? assignment.assignee_label : assignment.app_users?.display_name ?? assignment.assignee_label)
    .filter((name): name is string => Boolean(name));
  const first = (names: string[]) => names[0] ?? "Unassigned";
  return {
    preparer: first(namesFor("preparer")),
    checker: first(namesFor("checker")),
    reviewer: first(namesFor("reviewer")),
    effectiveFrom: current.map((assignment) => assignment.effective_from).sort()[0] ?? "Current repository state",
  };
}

function assignmentDisplayName(assignment: PortfolioClient["taxpayer_entities"][number]["registration_units"][number]["registration_unit_team_assignments"][number]) {
  return Array.isArray(assignment.app_users) ? assignment.app_users[0]?.display_name ?? assignment.assignee_label ?? "Unassigned" : assignment.app_users?.display_name ?? assignment.assignee_label ?? "Unassigned";
}

function teamHistoryForUnit(unit: PortfolioClient["taxpayer_entities"][number]["registration_units"][number]): FixtureTeamHistory[] {
  const grouped = new Map<string, FixtureTeamHistory>();
  for (const assignment of unit.registration_unit_team_assignments) {
    const key = `${assignment.effective_from}:${assignment.effective_to ?? "open"}`;
    const current = grouped.get(key) ?? {
      id: `live-team-history-${unit.id}-${assignment.effective_from}-${assignment.effective_to ?? "open"}`,
      clientId: "",
      effectivePeriod: assignment.effective_to ? `${assignment.effective_from} – ${assignment.effective_to}` : assignment.effective_from,
      preparer: "Unassigned",
      checker: "Unassigned",
      reviewer: "Unassigned",
      tower: "Unresolved",
      cluster: "Unresolved",
      reason: "Normalized registration-unit assignment",
    };
    current[assignment.assignment_role === "preparer" ? "preparer" : assignment.assignment_role === "checker" ? "checker" : assignment.assignment_role === "reviewer" ? "reviewer" : "reviewer"] = assignmentDisplayName(assignment);
    grouped.set(key, current);
  }
  return [...grouped.values()].sort((left, right) => right.effectivePeriod.localeCompare(left.effectivePeriod));
}

function buildContractRepository(client: PortfolioClient): FixtureContractRepository {
  // Supabase returns a one-to-one relationship as an object, while older
  // local fixtures/tests use a one-item array. Normalize both shapes here so
  // the adapter never silently replaces a real contract repository with the
  // incomplete fallback projection.
  const repository = firstRelation(client.contract_repositories);
  if (!repository) return { id: `live-contract-${client.id}`, referenceCode: `CONTRACT-${client.reference_code}`, additionalEngagements: [] };
  const master = firstRelation(repository.master_engagements);
  const intakeRecordType = typeof repository.intake_record_type === "string" ? repository.intake_record_type.trim().toLowerCase() : "";
  const intakeDocumentKind = intakeRecordType === "lsa" ? "LSA" : intakeRecordType === "msa" ? "MSA" : undefined;
  const intakeMaster: NonNullable<FixtureContractRepository["masterEngagement"]> | undefined =
    !master && intakeDocumentKind
      ? {
          id: `${repository.id}-intake-master`,
          referenceCode: repository.reference_code,
          title: intakeDocumentKind === "MSA" ? "Master Services Agreement" : "Local Service Agreement",
          status: contractStatus(repository.status),
          effectiveFrom: "Sales handoff",
          documents: [{
            id: `${repository.id}-intake-document`,
            kind: intakeDocumentKind,
            isCurrent: repository.status === "active",
            referenceCode: repository.intake_record_reference ?? repository.reference_code,
            title: intakeDocumentKind === "MSA" ? "Master Services Agreement" : "Local Service Agreement",
            status: contractStatus(repository.status),
            effectiveFrom: "Sales handoff",
            sourceReference: repository.intake_source_reference ?? "Source reference not recorded",
          }],
        }
      : undefined;
  return {
    id: repository.id,
    referenceCode: repository.reference_code,
    masterEngagement: master ? {
      id: master.id,
      referenceCode: master.reference_code,
      title: master.title,
      status: contractStatus(master.status),
      effectiveFrom: "Recorded in repository",
      documents: (master.master_engagement_documents ?? []).map((document) => ({
        id: document.id,
        kind: document.document_kind === "lsa" ? "LSA" : document.document_kind === "addendum" ? "Addendum" : "MSA",
        isCurrent: document.status === "active",
        referenceCode: document.reference_code,
        title: document.title,
        status: contractStatus(document.status),
        effectiveFrom: "Recorded in repository",
        sourceReference: document.source_reference,
      })),
    } : intakeMaster,
    additionalEngagements: (repository.additional_engagements ?? []).map((engagement) => ({
      id: engagement.id,
      kind: "Change Request Form",
      referenceCode: engagement.reference_code,
      title: engagement.title,
      status: contractStatus(engagement.status),
      effectiveFrom: "Recorded in repository",
      sourceReference: engagement.source_reference,
      scopeSummary: engagement.scope_summary,
    })),
  };
}

function buildProfile(client: PortfolioClient, entity?: PortfolioClient["taxpayer_entities"][number], unit?: PortfolioClient["taxpayer_entities"][number]["registration_units"][number]): FixtureTaxProfile {
  const source = unit?.registration_source_references[0];
  const baseProfile: FixtureTaxProfile = {
    registeredTaxpayerName: entity?.display_name ?? client.display_name,
    tinDisplay: entity?.tin ? formatTin(entity.tin) : "Needs validated source",
    branchCode: "Not configured",
    rdoOrLts: "Needs validated source",
    entityType: "Needs validated source",
    registeredAddress: "Needs validated source",
    lineOfBusiness: "Needs validated source",
    registrationEffective: "Needs validated source",
    registrationStatus: client.status === "active" ? "Active · profile source pending" : "Setup incomplete",
    registeredActivities: "Needs validated source",
    tradeName: client.display_name,
    filingChannel: "Not configured",
    filingContext: "Needs validated Tax Profile",
    registeredTaxTypes: ["Needs validated source"],
    taxYearBasis: undefined,
    fiscalYearEnd: undefined,
    accountingSystem: "Not configured",
    booksType: "Not configured",
    invoicing: "Not configured",
    paymentRoute: "Not configured",
    weight: 0,
    weightLabel: "Not assessed",
    sourceFinalWeight: null,
    fixtureSource: "source_weighted_portfolio",
    enateSetup: "Unknown",
    profileState: client.status === "setup_pending" ? "Setup incomplete" : "Ready for validation",
    sourceLabel: source?.source_reference ?? "No registration source recorded",
    sourceKind: source?.source_kind === "bir_form_2303" ? "2303-derived" : "approved registration source",
    authorities: (unit?.registration_authorities ?? []).map((authority) => ({
      id: authority.id,
      authority: authority.authority,
      reference: authority.reference,
      status: authority.status === "active" ? "Active" : authority.status === "review_due" ? "Review due" : "Not configured",
      effectiveFrom: authority.effective_from,
      ...(authority.effective_to ? { effectiveTo: authority.effective_to } : {}),
      entitlement: authority.entitlement_context ?? "No entitlement context recorded",
      source: authority.notes ?? "Source reference not recorded",
    })),
    auditExposures: [],
    attention: ["Tax Profile requires human validation", ...(source ? [] : ["Registration source missing"])],
  };
  const today = new Date().toISOString().slice(0, 10);
  const profileVersions = [...(unit?.tax_profile_versions ?? [])].sort((left, right) => right.version_number - left.version_number || right.effective_from.localeCompare(left.effective_from));
  const saved = profileVersions
    .filter((version) => version.effective_from <= today && (!version.effective_to || version.effective_to >= today))
    .find((version) => version.state !== "superseded")
    ?? profileVersions
      .filter((version) => version.effective_from <= today)
      .find((version) => version.state !== "superseded");
  if (!saved) return baseProfile;
  const snapshot: PersistedTaxProfileSnapshot = {
    state: saved.state,
    effectiveFrom: saved.effective_from,
    profile: saved.profile_data,
    // Assignment labels are allowed during sanitized onboarding before the
    // corresponding authenticated staff account is linked. The repository
    // remains the source of truth; the UI must not turn an unlinked label into
    // a false authenticated identity.
    assignment: saved.assignment_data,
    validatedAt: saved.validated_at,
    validatedBy: saved.validated_by,
  };
  const projected = applyPersistedTaxProfileSnapshot(baseProfile, {
    preparer: "Unassigned",
    checker: "Unassigned",
    reviewer: "Unassigned",
    tower: "Unresolved",
    cluster: "Unresolved",
    effectiveFrom: saved.effective_from,
  }, snapshot).profile;
  const officeContext = firstRelation(saved.tax_profile_office_context);
  const office = firstRelation(officeContext?.bir_offices);
  if (officeContext) {
    projected.rdoOrLts = office?.official_code ?? officeContext.source_label ?? "Needs validated source";
    if (officeContext.resolution_status !== "resolved" && officeContext.resolution_note) {
      projected.attention = [...projected.attention, "BIR office requires validation"];
    }
  }
  const filingContext = firstRelation(saved.tax_profile_filing_context);
  const filingChannel = firstRelation(filingContext?.filing_channels);
  const efpsGroup = firstRelation(filingContext?.efps_groups);
  if (filingContext) {
    projected.filingChannel = filingChannel?.label ?? filingContext.filing_channel_source_label ?? "Not configured";
    projected.filingContext = filingContext.resolution_note ?? (filingContext.channel_resolution_status === "resolved" ? "Canonical filing channel" : "Filing channel requires validation");
    const efpsGroupLabel = efpsGroup?.label ?? filingContext.efps_group_source_label ?? undefined;
    if (efpsGroupLabel) projected.eFPSGroup = efpsGroupLabel;
    else if (filingContext.efps_group_resolution_status === "unresolved") projected.eFPSGroup = "Needs validation";
    if (filingContext.channel_resolution_status !== "resolved") projected.attention = [...projected.attention, "Filing channel requires validation"];
    if (filingContext.efps_group_resolution_status === "unresolved") projected.attention = [...projected.attention, "eFPS group requires validation"];
  }
  const registeredTaxTypes = saved.tax_profile_registered_tax_types ?? [];
  if (registeredTaxTypes.length > 0) {
    projected.registeredTaxTypes = registeredTaxTypes.map((item) => firstRelation(item.tax_types)?.label ?? item.source_label ?? "Needs validation");
  }
  projected.auditExposures = saved.tax_audit_exposure_snapshots.map((audit) => ({
    id: audit.id,
    taxableYear: audit.taxable_year,
    matter: audit.matter,
    status: audit.status === "open" ? "Open" : audit.status === "closed" ? "Closed" : "Under review",
    asOf: audit.as_of_date ?? "Not recorded",
    context: audit.context ?? "No context recorded",
    source: audit.source_reference ?? "Source not recorded",
    officerName: audit.officer_source_label ?? undefined,
    officerRole: audit.officer_role ?? undefined,
    officerContact: audit.officer_contact ?? undefined,
  }));
  return projected;
}

/**
 * Transitional adapter: live repository rows are shaped for the existing
 * dossier while the UI is migrated to a repository-native view model. It
 * deliberately leaves facts unresolved instead of copying fixture tax values.
 */
export function portfolioClientToFixtureClient(client: PortfolioClient): FixtureClient {
  const entity = client.taxpayer_entities[0];
  const unit = entity?.registration_units.find((candidate) => candidate.active && candidate.unit_kind === "head_office")
    ?? entity?.registration_units.find((candidate) => candidate.active)
    ?? entity?.registration_units[0];
  const scope = scopeForClient(client);
  const profile = buildProfile(client, entity, unit);
  if (!scope.resolved) profile.attention = [...profile.attention, "Organizational scope requires validation"];
  const tower = scope.tower;
  const assignment = { ...currentAssignment(client), tower, cluster: scope.cluster } satisfies FixtureClient["assignment"];
  const teamHistory = client.taxpayer_entities
    .flatMap((candidate) => candidate.registration_units.flatMap((registrationUnit) => teamHistoryForUnit(registrationUnit)))
    .map((history) => ({ ...history, clientId: client.reference_code }))
    .sort((left, right) => right.effectivePeriod.localeCompare(left.effectivePeriod));
  const entities = client.taxpayer_entities.map((candidate) => {
    const units = candidate.registration_units
      .filter((registrationUnit) => registrationUnit.active || registrationUnit.id === unit?.id)
      .map((registrationUnit) => ({
        name: registrationUnit.display_name,
        type: registrationUnit.unit_kind === "branch" ? "Branch" as const : "Head Office" as const,
        profile: buildProfile(client, candidate, registrationUnit),
      }));
    const entityUnit = candidate.registration_units.find((registrationUnit) => registrationUnit.id === unit?.id)
      ?? candidate.registration_units.find((registrationUnit) => registrationUnit.active && registrationUnit.unit_kind === "head_office")
      ?? candidate.registration_units.find((registrationUnit) => registrationUnit.active)
      ?? candidate.registration_units[0];
    const entityProfile = candidate.id === entity?.id && entityUnit?.id === unit?.id
      ? profile
      : buildProfile(client, candidate, entityUnit);
    return {
      name: candidate.display_name,
      profile: entityProfile,
      units,
    };
  });
  return {
    id: client.reference_code,
    name: client.display_name,
    clientGroup: currentClientGroup(client),
    entitySummary: `${client.taxpayer_entities.length} taxpayer entit${client.taxpayer_entities.length === 1 ? "y" : "ies"}`,
    profileSummary: profile.profileState,
    contractRepository: buildContractRepository(client),
    scope: tower,
    assignment,
    teamHistory,
    entities: entities.length > 0 ? entities : entity && unit ? [{ name: entity.display_name, profile, units: [{ name: unit.display_name, type: unit.unit_kind === "branch" ? "Branch" : "Head Office", profile }] }] : [],
  };
}
