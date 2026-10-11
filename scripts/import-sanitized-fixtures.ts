import { createClient } from "@supabase/supabase-js";

import { buildTaxProfilePersistencePayload } from "../src/lib/domain/client-profile-persistence";
import { fixtureClients } from "../src/lib/fixtures";

type ImportOptions = {
  audit: boolean;
  dryRun: boolean;
  confirm: boolean;
  sql: boolean;
  includeTaxProfiles: boolean;
  actorUserId?: string;
  sqlPart?: { index: number; total: number };
};

function optionsFromArgs(): ImportOptions {
  const args = new Set(process.argv.slice(2));
  const sqlPartArg = process.argv.slice(2).find((arg) => /^--sql-part=\d+\/\d+$/.test(arg));
  const sqlPartMatch = sqlPartArg?.match(/^--sql-part=(\d+)\/(\d+)$/);
  const sqlPart = sqlPartMatch ? { index: Number(sqlPartMatch[1]), total: Number(sqlPartMatch[2]) } : undefined;
  if (sqlPart && (sqlPart.total < 1 || sqlPart.index >= sqlPart.total)) throw new Error("--sql-part must use a zero-based index smaller than the total, for example --sql-part=0/8.");
  return {
    audit: args.has("--audit"),
    dryRun: args.has("--dry-run"),
    confirm: args.has("--confirm"),
    sql: args.has("--sql"),
    includeTaxProfiles: args.has("--include-tax-profiles"),
    actorUserId: process.env.TAXMON_FIXTURE_ACTOR_USER_ID,
    sqlPart,
  };
}

async function countRows(client: ReturnType<typeof createClient>, table: string, filter?: (query: ReturnType<typeof client.from>) => ReturnType<typeof client.from>) {
  let query = client.from(table).select("id", { count: "exact", head: true });
  if (filter) query = filter(query);
  const { count, error } = await query;
  if (error) throw new Error(`Unable to audit ${table}: ${error.message}`);
  return count ?? 0;
}

function fixtureReference(prefix: string, id: string) {
  const suffix = id.replace(/^fixture-client-/i, "").replace(/[^0-9A-Za-z-]/g, "").toUpperCase();
  return `FIXTURE-${prefix}-${suffix}`;
}

function fixtureNumber(id: string) {
  return id.match(/(\d+)$/)?.[1] ?? id.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function fixtureTowerCode(scope: string) {
  return `FIXTURE-${scope.replace(/\s+/g, "-").toUpperCase()}`;
}

function fixtureClusterCode(cluster: string) {
  return `FIXTURE-${cluster.replace(/\s+/g, "-").toUpperCase()}`;
}

function fixtureGroupReference(groupName: string) {
  return `FIXTURE-GROUP-${groupName
    .replace(/\s*\(synthetic\)\s*$/i, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase()}`;
}

function requireValue(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function sqlValue(value: string | null | undefined) {
  if (value == null) return "null";
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlJson(value: unknown) {
  return sqlValue(JSON.stringify(value));
}

function sqlStatus(status: string) {
  return status === "Active" ? "active" : status === "Closed" ? "closed" : "pending_review";
}

function sqlAuthorityStatus(status: string) {
  return status === "Active" ? "active" : status === "Review due" ? "review_due" : "not_configured";
}

function hasIsoDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

const fixtureFamilyDisposition = {
  clients: "normalized: clients, taxpayer entities, registration units, and scope assignments",
  taxProfiles: "normalized: dated profile versions, provenance, profile events, filing context, tax types, office context, and audit snapshots",
  registrationsAndContracts: "normalized: registration source references, dated authorities where dates are authoritative, client groups, contract repositories, engagements, and documents",
  teamAssignments: "partially normalized: effective-dated assignment rows are retained; staff identity remains unresolved until authenticated users are onboarded",
  changeRequestForms: "normalized: represented as additional engagements under the client contract repository",
  filingHistory: "deferred: requires governed compliance work, external-result/evidence records, and immutable work history; no standalone fixture history is imported",
  complianceAndWork: "deferred: requires BIR Requirement Master, Rule version, approved Compliance Universe, and authenticated ownership",
  calendar: "deferred: fixture dates are illustrative/unresolved and cannot become statutory or published calendar records",
  exceptions: "deferred: derived from governed work/control observations; not copied into a second exception tracker",
  specialistCases: "deferred: Tax Audit/specialist case management is outside this vertical slice",
} as const;

function sqlForRecords(records: ReturnType<typeof buildRecords>, options: ImportOptions) {
  const lines = ["-- Generated from sanitized TaxMonWeb fixtures. No real client data is included.", "-- Review the target project and execute as one transaction in Supabase SQL Editor.", "begin;", ""];

  for (const organizationUnitCode of [...new Set(records.map((record) => record.organizationUnitCode))]) {
    lines.push(`insert into public.organization_units (code, name, unit_kind, effective_from) values (${sqlValue(organizationUnitCode)}, ${sqlValue(organizationUnitCode.replace(/^FIXTURE-/, "").replaceAll("-", " "))}, 'tower', date '2026-10-05') on conflict (code) do nothing;`);
  }
  for (const cluster of [...new Map(records.map((record) => [record.organizationUnitClusterCode, record])).values()]) {
    lines.push(`insert into public.organization_units (code, name, unit_kind, parent_id, effective_from) select ${sqlValue(cluster.organizationUnitClusterCode)}, ${sqlValue(cluster.client.assignment.cluster)}, 'cluster', tower.id, date '2026-10-05' from public.organization_units tower where tower.code = ${sqlValue(cluster.organizationUnitCode)} on conflict (code) do nothing;`);
  }

  for (const record of records) {
    lines.push(`insert into public.clients (reference_code, display_name, status) values (${sqlValue(record.clientReferenceCode)}, ${sqlValue(record.client.name)}, 'active') on conflict (reference_code) do update set display_name = excluded.display_name, status = excluded.status;`);
    lines.push(`insert into public.taxpayer_entities (client_id, reference_code, display_name, tin, tin_status) select id, ${sqlValue(record.entityReferenceCode)}, ${sqlValue(record.entityDisplayName)}, ${sqlValue(record.tin)}, ${record.tin ? "'provided'" : "'unresolved'"} from public.clients where reference_code = ${sqlValue(record.clientReferenceCode)} on conflict (reference_code) do update set display_name = excluded.display_name, tin = excluded.tin, tin_status = excluded.tin_status;`);
    lines.push(`insert into public.registration_units (taxpayer_entity_id, reference_code, display_name, unit_kind, registration_reference) select id, ${sqlValue(record.unitReferenceCode)}, ${sqlValue(record.unitDisplayName)}, ${sqlValue(record.unitKind)}, ${sqlValue(record.sourceReference)} from public.taxpayer_entities where reference_code = ${sqlValue(record.entityReferenceCode)} on conflict (reference_code) do update set display_name = excluded.display_name, unit_kind = excluded.unit_kind, registration_reference = excluded.registration_reference;`);
    lines.push(`insert into public.registration_unit_scope_assignments (registration_unit_id, organization_unit_id, effective_from, reason) select ru.id, ou.id, date '2026-10-05', 'Sanitized fixture import' from public.registration_units ru cross join public.organization_units ou where ru.reference_code = ${sqlValue(record.unitReferenceCode)} and ou.code = ${sqlValue(record.organizationUnitCode)} and not exists (select 1 from public.registration_unit_scope_assignments existing where existing.registration_unit_id = ru.id and existing.organization_unit_id = ou.id and existing.effective_from = date '2026-10-05');`);
    lines.push(`insert into public.registration_unit_scope_assignments (registration_unit_id, organization_unit_id, effective_from, reason) select ru.id, cluster.id, tower_scope.effective_from, 'Sanitized fixture import' from public.registration_units ru join public.registration_unit_scope_assignments tower_scope on tower_scope.registration_unit_id = ru.id and tower_scope.effective_to is null and tower_scope.reason not ilike 'Superseded%' join public.organization_units tower on tower.id = tower_scope.organization_unit_id and tower.code = ${sqlValue(record.organizationUnitCode)} join public.organization_units cluster on cluster.code = ${sqlValue(record.organizationUnitClusterCode)} where ru.reference_code = ${sqlValue(record.unitReferenceCode)} and not exists (select 1 from public.registration_unit_scope_assignments existing where existing.registration_unit_id = ru.id and existing.organization_unit_id = cluster.id and existing.effective_from = tower_scope.effective_from);`);
    lines.push(`insert into public.registration_source_references (registration_unit_id, source_kind, source_system, source_reference, document_version, status, notes) select id, 'bir_form_2303', 'synthetic_fixture', ${sqlValue(record.sourceReference)}, 'fixture-v1', 'needs_review', 'Sanitized structural source only; no binary document is stored.' from public.registration_units where reference_code = ${sqlValue(record.unitReferenceCode)} and not exists (select 1 from public.registration_source_references existing where existing.registration_unit_id = public.registration_units.id and existing.source_reference = ${sqlValue(record.sourceReference)});`);
    if (options.includeTaxProfiles) {
      if (!options.actorUserId) throw new Error("TAXMON_FIXTURE_ACTOR_USER_ID is required with --include-tax-profiles.");
      const payload = buildTaxProfilePersistencePayload(record.profile, record.client.assignment, record.unit, "Sanitized baseline import", "2026-10-05");
      lines.push(`insert into public.tax_profile_versions (registration_unit_id, version_number, state, effective_from, profile_data, assignment_data, source_reference_id, created_by, change_reason) select ru.id, 1, 'ready_for_validation', date '2026-10-05', ${sqlJson(payload.profile)}, ${sqlJson(payload.assignment)}, source.id, ${sqlValue(options.actorUserId)}, 'Sanitized baseline import — human validation required' from public.registration_units ru left join public.registration_source_references source on source.registration_unit_id = ru.id and source.source_reference = ${sqlValue(record.sourceReference)} where ru.reference_code = ${sqlValue(record.unitReferenceCode)} and not exists (select 1 from public.tax_profile_versions existing where existing.registration_unit_id = ru.id);`);
      lines.push(`insert into public.tax_profile_change_events (registration_unit_id, tax_profile_version_id, event_kind, actor_id, effective_from, reason, after_context) select profile.registration_unit_id, profile.id, 'draft_saved', profile.created_by, profile.effective_from, profile.change_reason, jsonb_build_object('profile', profile.profile_data, 'assignment', profile.assignment_data, 'version', profile.version_number) from public.tax_profile_versions profile join public.registration_units ru on ru.id = profile.registration_unit_id where ru.reference_code = ${sqlValue(record.unitReferenceCode)} and profile.version_number = 1 and not exists (select 1 from public.tax_profile_change_events existing where existing.tax_profile_version_id = profile.id and existing.event_kind = 'draft_saved');`);
      for (const authority of record.profile.authorities.filter((item) => hasIsoDate(item.effectiveFrom) && (!item.effectiveTo || hasIsoDate(item.effectiveTo)))) {
        lines.push(`insert into public.registration_authorities (registration_unit_id, authority, reference, status, effective_from, effective_to, entitlement_context, source_reference_id, notes, created_by) select ru.id, ${sqlValue(authority.authority)}, ${sqlValue(authority.reference)}, '${sqlAuthorityStatus(authority.status)}', ${sqlValue(authority.effectiveFrom)}, ${sqlValue(authority.effectiveTo)}, ${sqlValue(authority.entitlement)}, source.id, 'Imported from sanitized Tax Profile authority context.', ${sqlValue(options.actorUserId)} from public.registration_units ru left join public.registration_source_references source on source.id = (select source_reference_id from public.tax_profile_versions where id = (select id from public.tax_profile_versions where registration_unit_id = ru.id and version_number = 1 limit 1)) where ru.reference_code = ${sqlValue(record.unitReferenceCode)} and not exists (select 1 from public.registration_authorities existing where existing.registration_unit_id = ru.id and existing.authority = ${sqlValue(authority.authority)} and existing.reference = ${sqlValue(authority.reference)} and existing.effective_from = ${sqlValue(authority.effectiveFrom)});`);
      }
    }

    const repository = record.client.contractRepository;
    lines.push(`insert into public.contract_repositories (client_id, reference_code, status) select id, ${sqlValue(repository.referenceCode)}, ${repository.masterEngagement ? "'active'" : "'setup_pending'"} from public.clients where reference_code = ${sqlValue(record.clientReferenceCode)} on conflict (client_id) do update set reference_code = excluded.reference_code, status = excluded.status;`);
    if (repository.masterEngagement) {
      const master = repository.masterEngagement;
      lines.push(`insert into public.master_engagements (contract_repository_id, reference_code, title, status, effective_from) select cr.id, ${sqlValue(master.referenceCode)}, ${sqlValue(master.title)}, ${sqlValue(sqlStatus(master.status))}, date '2026-10-05' from public.contract_repositories cr join public.clients c on c.id = cr.client_id where c.reference_code = ${sqlValue(record.clientReferenceCode)} on conflict (contract_repository_id) do update set reference_code = excluded.reference_code, title = excluded.title, status = excluded.status;`);
      for (const document of master.documents) {
        lines.push(`insert into public.master_engagement_documents (master_engagement_id, document_kind, reference_code, title, status, effective_from, source_reference) select me.id, ${sqlValue(document.kind.toLowerCase())}, ${sqlValue(document.referenceCode)}, ${sqlValue(document.title)}, ${sqlValue(sqlStatus(document.status))}, date '2026-10-05', ${sqlValue(document.sourceReference)} from public.master_engagements me where reference_code = ${sqlValue(master.referenceCode)} on conflict (reference_code) do update set title = excluded.title, status = excluded.status, source_reference = excluded.source_reference;`);
      }
    }
    for (const engagement of repository.additionalEngagements) {
      lines.push(`insert into public.additional_engagements (contract_repository_id, engagement_kind, reference_code, title, status, effective_from, source_reference, scope_summary) select cr.id, 'change_request_form', ${sqlValue(engagement.referenceCode)}, ${sqlValue(engagement.title)}, ${sqlValue(sqlStatus(engagement.status))}, date '2026-10-05', ${sqlValue(engagement.sourceReference)}, ${sqlValue(engagement.scopeSummary)} from public.contract_repositories cr join public.clients c on c.id = cr.client_id where c.reference_code = ${sqlValue(record.clientReferenceCode)} on conflict (reference_code) do update set title = excluded.title, status = excluded.status, source_reference = excluded.source_reference, scope_summary = excluded.scope_summary;`);
    }
  }

  for (const group of [...new Map(records.filter((record) => record.clientGroup).map((record) => [record.clientGroup!.referenceCode, record.clientGroup!])).values()]) {
    lines.push(`insert into public.client_groups (reference_code, display_name, status, effective_from, reason) values (${sqlValue(group.referenceCode)}, ${sqlValue(group.displayName)}, 'active', date '2026-10-05', 'Sanitized relationship fixture import') on conflict (reference_code) do update set display_name = excluded.display_name, status = excluded.status;`);
  }
  for (const record of records) {
    if (!record.clientGroup) continue;
    lines.push(`insert into public.client_group_memberships (client_group_id, client_id, effective_from, reason) select g.id, c.id, date '2026-10-05', 'Sanitized relationship fixture import' from public.client_groups g cross join public.clients c where g.reference_code = ${sqlValue(record.clientGroup.referenceCode)} and c.reference_code = ${sqlValue(record.clientReferenceCode)} on conflict (client_group_id, client_id, effective_from) do nothing;`);
  }
  lines.push("commit;");
  if (!options.sqlPart) return lines.join("\n");

  const body = lines.slice(4, -1);
  const partSize = Math.ceil(body.length / options.sqlPart.total);
  const part = body.slice(options.sqlPart.index * partSize, (options.sqlPart.index + 1) * partSize);
  return [
    "-- Generated from sanitized TaxMonWeb fixtures. No real client data is included.",
    `-- Ordered SQL part ${options.sqlPart.index + 1} of ${options.sqlPart.total}; execute parts in index order.`,
    "begin;",
    ...part,
    "commit;",
  ].join("\n");
}

function buildRecords() {
  return fixtureClients.flatMap((client) => client.entities.flatMap((entity, entityIndex) => entity.units.map((unit, unitIndex) => {
    const profile = unit.profile;
    const clientNumber = fixtureNumber(client.id);
    const entitySuffix = entityIndex === 0 ? "" : `-E${entityIndex + 1}`;
    const unitSuffix = unitIndex === 0 && unit.type === "Head Office" ? "" : `-${unit.type === "Branch" ? "BRANCH" : "UNIT"}-${unit.profile.branchCode || String(unitIndex + 1).padStart(3, "0")}`;
    return {
      client,
      profile,
      unit,
      clientReferenceCode: fixtureReference("CLIENT", client.id),
      entityReferenceCode: `${fixtureReference("ENTITY", client.id)}${entitySuffix}`,
      unitReferenceCode: `${fixtureReference("RU", client.id)}${unitSuffix}`,
      sourceReference: `synthetic-2303-${clientNumber}${unitSuffix.toLowerCase()}`,
      organizationUnitCode: fixtureTowerCode(client.scope),
      organizationUnitClusterCode: fixtureClusterCode(client.assignment.cluster),
      entityDisplayName: entity.name,
      unitDisplayName: unit.name,
      tin: profile.tinDisplay.replace(/[^0-9]/g, "") || null,
      unitKind: unit.type === "Branch" ? "branch" : "head_office",
      clientGroup: client.clientGroup
        ? {
            referenceCode: fixtureGroupReference(client.clientGroup),
            displayName: client.clientGroup.replace(/\s*\(synthetic\)\s*$/i, " (sanitized)"),
          }
        : null,
    };
  })));
}

async function main() {
  const options = optionsFromArgs();
  if (!options.audit && !options.dryRun && !options.sql && (!options.confirm || process.env.TAXMON_FIXTURE_IMPORT_CONFIRM !== "IMPORT_SANITIZED_FIXTURES")) {
    throw new Error("Refusing to write. Use --dry-run first, then --confirm with TAXMON_FIXTURE_IMPORT_CONFIRM=IMPORT_SANITIZED_FIXTURES.");
  }

  const records = buildRecords();
  const uniqueClients = [...new Map(records.map((record) => [record.clientReferenceCode, record.client])).values()];
  const uniqueClientRecords = records.filter((record, index) => records.findIndex((candidate) => candidate.clientReferenceCode === record.clientReferenceCode) === index);

  const report = {
    mode: options.dryRun ? "dry-run" : "write",
    clients: uniqueClients.length,
    registrationUnits: records.length,
    groups: new Set(uniqueClients.map((client) => client.clientGroup).filter(Boolean)).size,
    taxProfiles: options.includeTaxProfiles ? records.length : 0,
    normalizedAuthorities: options.includeTaxProfiles ? records.reduce((total, record) => total + record.profile.authorities.filter((item) => hasIsoDate(item.effectiveFrom) && (!item.effectiveTo || hasIsoDate(item.effectiveTo))).length, 0) : 0,
    fixtureFamilyDisposition,
    unresolved: [
      options.includeTaxProfiles
        ? "Imported Tax Profile snapshots remain ready_for_validation; activation remains human-controlled."
        : "Tax Profile snapshots are not imported unless --include-tax-profiles is explicitly provided with an actor ID.",
      "Preparer/checker/reviewer assignments are not imported from labels without an app-user match.",
      "Fixture staff are not created as app_users: authenticated identities must be onboarded before team records can be imported.",
      "Compliance work, deadlines, and tax applicability are not inferred by this importer.",
      "Fixture work remains outside the import until each row is mapped to a governed BIR requirement/version.",
      "Authority records with non-date fixture effective values remain in profile context and are not inserted into the dated authority master.",
    ],
  };

  if (options.sql) {
    console.log(sqlForRecords(records, options));
    return;
  }

  if (options.dryRun) {
    console.log(JSON.stringify({ ...report, sample: records.slice(0, 3).map(({ client, ...record }) => ({ ...record, client: client.name })) }, null, 2));
    return;
  }

  const supabase = createClient(requireValue("SUPABASE_URL"), requireValue("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });

  if (options.audit) {
    const expected = {
      clients: uniqueClients.length,
      taxpayerEntities: uniqueClients.reduce((count, client) => count + client.entities.length, 0),
      registrationUnits: records.length,
      registrationSources: records.length,
      clientGroups: new Set(uniqueClientRecords.map((record) => record.clientGroup?.referenceCode).filter(Boolean)).size,
      clientGroupMemberships: uniqueClientRecords.filter((record) => record.clientGroup).length,
      registrationUnitTeamAssignments: records.length * 3,
      registrationUnitScopeAssignments: records.length * 2,
      contractRepositories: uniqueClientRecords.length,
      masterEngagements: uniqueClientRecords.filter((record) => Boolean(record.client.contractRepository.masterEngagement)).length,
      masterEngagementDocuments: uniqueClientRecords.reduce((count, record) => count + (record.client.contractRepository.masterEngagement?.documents.length ?? 0), 0),
      additionalEngagements: uniqueClientRecords.reduce((count, record) => count + record.client.contractRepository.additionalEngagements.length, 0),
      taxProfileVersions: options.includeTaxProfiles ? records.length : 0,
      taxProfileChangeEvents: options.includeTaxProfiles ? records.length : 0,
      registrationAuthorities: options.includeTaxProfiles ? records.reduce((total, record) => total + record.profile.authorities.filter((item) => hasIsoDate(item.effectiveFrom) && (!item.effectiveTo || hasIsoDate(item.effectiveTo))).length, 0) : 0,
    };
    const actual = {
      clients: await countRows(supabase, "clients", (query) => query.like("reference_code", "FIXTURE-%")),
      taxpayerEntities: await countRows(supabase, "taxpayer_entities", (query) => query.like("reference_code", "FIXTURE-%")),
      registrationUnits: await countRows(supabase, "registration_units", (query) => query.like("reference_code", "FIXTURE-%")),
      registrationSources: await countRows(supabase, "registration_source_references", (query) => query.eq("source_system", "synthetic_fixture")),
      clientGroups: await countRows(supabase, "client_groups", (query) => query.like("reference_code", "FIXTURE-GROUP-%")),
      clientGroupMemberships: await countRows(supabase, "client_group_memberships", (query) => query.eq("reason", "Sanitized relationship fixture import")),
      registrationUnitTeamAssignments: await countRows(supabase, "registration_unit_team_assignments", (query) => query.is("user_id", null)),
      registrationUnitScopeAssignments: await countRows(supabase, "registration_unit_scope_assignments", (query) => query.in("reason", ["Sanitized fixture import", "Synthetic fixture portfolio assignment"])),
      contractRepositories: await countRows(supabase, "contract_repositories", (query) => query.like("reference_code", "CONTRACT-REPO-%")),
      masterEngagements: await countRows(supabase, "master_engagements", (query) => query.like("reference_code", "ME-%")),
      masterEngagementDocuments: await countRows(supabase, "master_engagement_documents", (query) => query.or("reference_code.ilike.MSA-%,reference_code.ilike.LSA-%,reference_code.ilike.Addendum-%")),
      additionalEngagements: await countRows(supabase, "additional_engagements", (query) => query.like("reference_code", "CRF-%")),
      taxProfileVersions: options.includeTaxProfiles ? await countRows(supabase, "tax_profile_versions", (query) => query.eq("change_reason", "Sanitized baseline import — human validation required")) : 0,
      taxProfileChangeEvents: options.includeTaxProfiles ? await countRows(supabase, "tax_profile_change_events", (query) => query.eq("reason", "Sanitized baseline import — human validation required")) : 0,
      registrationAuthorities: options.includeTaxProfiles ? await countRows(supabase, "registration_authorities", (query) => query.eq("notes", "Imported from sanitized Tax Profile authority context.")) : 0,
    };
    const mismatches = Object.keys(expected).filter((key) => expected[key as keyof typeof expected] !== actual[key as keyof typeof actual]);
    const unresolved = {
      profilesReadyForValidation: await countRows(supabase, "tax_profile_versions", (query) => query.eq("state", "ready_for_validation")),
      generatedWork: await countRows(supabase, "generated_compliance_work"),
      publishedCalendarEntries: await countRows(supabase, "published_calendar_entries"),
      fixtureStaffProfiles: await countRows(supabase, "team_member_profiles"),
    };
    console.log(JSON.stringify({ mode: "audit", expected, actual, mismatches, unresolved, ok: mismatches.length === 0 }, null, 2));
    if (mismatches.length > 0) process.exitCode = 1;
    return;
  }

  if (options.includeTaxProfiles) {
    const actorUserId = requireValue("TAXMON_FIXTURE_ACTOR_USER_ID");
    const { data: actor, error: actorError } = await supabase.auth.admin.getUserById(actorUserId);
    if (actorError || !actor.user) throw new Error(`TAXMON_FIXTURE_ACTOR_USER_ID is not an existing authenticated user: ${actorError?.message ?? "not found"}`);
  }

  const scopes = [...new Set(records.map((record) => record.organizationUnitCode))];
  for (const code of scopes) {
    const { error } = await supabase.from("organization_units").upsert({ code, name: code.replace(/^FIXTURE-/, "").replaceAll("-", " "), unit_kind: "tower", active: true }, { onConflict: "code" });
    if (error) throw error;
  }
  const clusters = [...new Map(records.map((record) => [record.organizationUnitClusterCode, record])).values()];
  for (const record of clusters) {
    const { data: parent, error: parentError } = await supabase.from("organization_units").select("id").eq("code", record.organizationUnitCode).single();
    if (parentError) throw parentError;
    const { error } = await supabase.from("organization_units").upsert({ code: record.organizationUnitClusterCode, name: record.client.assignment.cluster, unit_kind: "cluster", parent_id: parent.id, active: true, effective_from: "2026-10-05" }, { onConflict: "code" });
    if (error) throw error;
  }

  const groupIds = new Map<string, string>();
  for (const group of [...new Map(records.filter((record) => record.clientGroup).map((record) => [record.clientGroup!.referenceCode, record.clientGroup!])).values()]) {
    const { data, error } = await supabase
      .from("client_groups")
      .upsert({ reference_code: group.referenceCode, display_name: group.displayName, status: "active", effective_from: "2026-10-05", reason: "Sanitized relationship fixture import" }, { onConflict: "reference_code" })
      .select("id")
      .single();
    if (error) throw error;
    groupIds.set(group.referenceCode, data.id);
  }

  for (const record of records) {
    const { data: organizationUnit, error: organizationUnitError } = await supabase
      .from("organization_units")
      .select("id")
      .eq("code", record.organizationUnitCode)
      .maybeSingle();
    if (organizationUnitError) throw organizationUnitError;
    if (!organizationUnit) throw new Error(`Missing organization unit ${record.organizationUnitCode}; seed the controlled scope first.`);

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .upsert({ reference_code: record.clientReferenceCode, display_name: record.client.name, status: "active" }, { onConflict: "reference_code" })
      .select("id")
      .single();
    if (clientError) throw clientError;

    if (record.clientGroup) {
      const groupId = groupIds.get(record.clientGroup.referenceCode);
      if (!groupId) throw new Error(`Missing imported client group ${record.clientGroup.referenceCode}.`);
      const { error: membershipError } = await supabase
        .from("client_group_memberships")
        .upsert({ client_group_id: groupId, client_id: client.id, effective_from: "2026-10-05", reason: "Sanitized relationship fixture import" }, { onConflict: "client_group_id,client_id,effective_from" });
      if (membershipError) throw membershipError;
    }

    const { data: entity, error: entityError } = await supabase
      .from("taxpayer_entities")
      .upsert({ client_id: client.id, reference_code: record.entityReferenceCode, display_name: record.entityDisplayName, tin: record.tin, tin_status: record.tin ? "provided" : "unresolved" }, { onConflict: "reference_code" })
      .select("id")
      .single();
    if (entityError) throw entityError;

    const { data: registrationUnit, error: registrationUnitError } = await supabase
      .from("registration_units")
      .upsert({ taxpayer_entity_id: entity.id, reference_code: record.unitReferenceCode, display_name: record.unitDisplayName, unit_kind: record.unitKind, registration_reference: record.sourceReference }, { onConflict: "reference_code" })
      .select("id")
      .single();
    if (registrationUnitError) throw registrationUnitError;

    const { data: clusterUnit, error: clusterUnitError } = await supabase
      .from("organization_units")
      .select("id")
      .eq("code", record.organizationUnitClusterCode)
      .single();
    if (clusterUnitError) throw clusterUnitError;
    const { data: currentTowerScope, error: currentTowerScopeError } = await supabase
      .from("registration_unit_scope_assignments")
      .select("effective_from, reason")
      .eq("registration_unit_id", registrationUnit.id)
      .eq("organization_unit_id", organizationUnit.id)
      .is("effective_to", null)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (currentTowerScopeError) throw currentTowerScopeError;
    const scopeEffectiveFrom = currentTowerScope && !/^Superseded/i.test(currentTowerScope.reason) ? currentTowerScope.effective_from : "2026-10-05";
    for (const scopeUnit of [organizationUnit, clusterUnit]) {
      const { data: existingScope, error: scopeLookupError } = await supabase
        .from("registration_unit_scope_assignments")
        .select("id")
        .eq("registration_unit_id", registrationUnit.id)
        .eq("organization_unit_id", scopeUnit.id)
        .eq("effective_from", scopeEffectiveFrom)
        .maybeSingle();
      if (scopeLookupError) throw scopeLookupError;
      if (!existingScope) {
        const { error: scopeInsertError } = await supabase
          .from("registration_unit_scope_assignments")
          .insert({ registration_unit_id: registrationUnit.id, organization_unit_id: scopeUnit.id, effective_from: scopeEffectiveFrom, reason: "Sanitized fixture import" });
        if (scopeInsertError) throw scopeInsertError;
      }
    }

    const { data: existingSource, error: sourceLookupError } = await supabase
      .from("registration_source_references")
      .select("id")
      .eq("registration_unit_id", registrationUnit.id)
      .eq("source_reference", record.sourceReference)
      .maybeSingle();
    if (sourceLookupError) throw sourceLookupError;
    let sourceId = existingSource?.id;
    if (!sourceId) {
      const { data: insertedSource, error: sourceInsertError } = await supabase
        .from("registration_source_references")
        .insert({ registration_unit_id: registrationUnit.id, source_kind: "bir_form_2303", source_system: "synthetic_fixture", source_reference: record.sourceReference, document_version: "fixture-v1", status: "needs_review", notes: "Sanitized structural source only; no real document is stored." })
        .select("id")
        .single();
      if (sourceInsertError) throw sourceInsertError;
      sourceId = insertedSource.id;
    }

    if (options.includeTaxProfiles) {
      const { data: existingProfile, error: profileLookupError } = await supabase
        .from("tax_profile_versions")
        .select("id")
        .eq("registration_unit_id", registrationUnit.id)
        .limit(1)
        .maybeSingle();
      if (profileLookupError) throw profileLookupError;
      let profileId = existingProfile?.id;
      if (!existingProfile) {
        const payload = buildTaxProfilePersistencePayload(record.profile, record.client.assignment, record.unit, "Sanitized baseline import", "2026-10-05");
        const { data: insertedProfile, error: profileInsertError } = await supabase.from("tax_profile_versions").insert({
          registration_unit_id: registrationUnit.id,
          version_number: 1,
          state: "ready_for_validation",
          effective_from: "2026-10-05",
          profile_data: payload.profile,
          assignment_data: payload.assignment,
          source_reference_id: sourceId,
          created_by: requireValue("TAXMON_FIXTURE_ACTOR_USER_ID"),
          change_reason: "Sanitized baseline import — human validation required",
        }).select("id").single();
        if (profileInsertError) throw profileInsertError;
        profileId = insertedProfile.id;
      }
      if (!profileId) throw new Error(`Unable to resolve imported Tax Profile for ${record.unitReferenceCode}.`);
      const { data: existingEvent, error: eventLookupError } = await supabase
        .from("tax_profile_change_events")
        .select("id")
        .eq("tax_profile_version_id", profileId)
        .eq("event_kind", "draft_saved")
        .maybeSingle();
      if (eventLookupError) throw eventLookupError;
      if (!existingEvent) {
        const { data: profileForEvent, error: profileEventLookupError } = await supabase
          .from("tax_profile_versions")
          .select("registration_unit_id, effective_from, profile_data, assignment_data, version_number, created_by, change_reason")
          .eq("id", profileId)
          .single();
        if (profileEventLookupError) throw profileEventLookupError;
        const { error: eventInsertError } = await supabase.from("tax_profile_change_events").insert({
          registration_unit_id: profileForEvent.registration_unit_id,
          tax_profile_version_id: profileId,
          event_kind: "draft_saved",
          actor_id: profileForEvent.created_by,
          effective_from: profileForEvent.effective_from,
          reason: profileForEvent.change_reason,
          after_context: {
            profile: profileForEvent.profile_data,
            assignment: profileForEvent.assignment_data,
            version: profileForEvent.version_number,
          },
        });
        if (eventInsertError) throw eventInsertError;
      }
      for (const authority of record.profile.authorities.filter((item) => hasIsoDate(item.effectiveFrom) && (!item.effectiveTo || hasIsoDate(item.effectiveTo)))) {
        const { data: existingAuthority, error: authorityLookupError } = await supabase
          .from("registration_authorities")
          .select("id")
          .eq("registration_unit_id", registrationUnit.id)
          .eq("authority", authority.authority)
          .eq("reference", authority.reference)
          .eq("effective_from", authority.effectiveFrom)
          .maybeSingle();
        if (authorityLookupError) throw authorityLookupError;
        if (!existingAuthority) {
          const { error: authorityInsertError } = await supabase.from("registration_authorities").insert({
            registration_unit_id: registrationUnit.id,
            authority: authority.authority,
            reference: authority.reference,
            status: sqlAuthorityStatus(authority.status),
            effective_from: authority.effectiveFrom,
            effective_to: authority.effectiveTo ?? null,
            entitlement_context: authority.entitlement,
            source_reference_id: sourceId,
            notes: "Imported from sanitized Tax Profile authority context.",
            created_by: requireValue("TAXMON_FIXTURE_ACTOR_USER_ID"),
          });
          if (authorityInsertError) throw authorityInsertError;
        }
      }
    }

    const repository = record.client.contractRepository;
    const { data: contractRepository, error: contractError } = await supabase
      .from("contract_repositories")
      .upsert({ client_id: client.id, reference_code: repository.referenceCode, status: repository.masterEngagement ? "active" : "setup_pending" }, { onConflict: "client_id" })
      .select("id")
      .single();
    if (contractError) throw contractError;

    if (repository.masterEngagement) {
      const { data: masterEngagement, error: masterError } = await supabase
        .from("master_engagements")
        .upsert({ contract_repository_id: contractRepository.id, reference_code: repository.masterEngagement.referenceCode, title: repository.masterEngagement.title, status: repository.masterEngagement.status === "Active" ? "active" : repository.masterEngagement.status === "Closed" ? "closed" : "pending_review", effective_from: "2026-10-05" }, { onConflict: "contract_repository_id" })
        .select("id")
        .single();
      if (masterError) throw masterError;
      for (const document of repository.masterEngagement.documents) {
        const { error } = await supabase.from("master_engagement_documents").upsert({ master_engagement_id: masterEngagement.id, document_kind: document.kind.toLowerCase(), reference_code: document.referenceCode, title: document.title, status: document.status === "Active" ? "active" : document.status === "Closed" ? "closed" : "pending_review", effective_from: "2026-10-05", source_reference: document.sourceReference }, { onConflict: "reference_code" });
        if (error) throw error;
      }
    }
    for (const engagement of repository.additionalEngagements) {
      const { error } = await supabase.from("additional_engagements").upsert({ contract_repository_id: contractRepository.id, engagement_kind: "change_request_form", reference_code: engagement.referenceCode, title: engagement.title, status: engagement.status === "Active" ? "active" : engagement.status === "Closed" ? "closed" : "pending_review", effective_from: "2026-10-05", source_reference: engagement.sourceReference, scope_summary: engagement.scopeSummary }, { onConflict: "reference_code" });
      if (error) throw error;
    }
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
