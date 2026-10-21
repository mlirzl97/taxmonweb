import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ManualClientSetupInput } from "@/lib/domain/manual-client-setup";

type ScopeOrganizationUnit = {
  code: string;
  name: string;
  unit_kind: string;
  parent?: { name: string; unit_kind: string } | Array<{ name: string; unit_kind: string }> | null;
};

export type PortfolioClient = {
  id: string;
  reference_code: string;
  display_name: string;
  status: "active" | "inactive" | "setup_pending";
  client_group_memberships: Array<{
    effective_from: string;
    effective_to: string | null;
    client_groups: { display_name: string; status: "active" | "inactive" | "closed" } | Array<{ display_name: string; status: "active" | "inactive" | "closed" }> | null;
  }>;
  client_team_assignments: Array<{
    id: string;
    user_id: string | null;
    assignment_role: "portfolio_owner" | "preparer" | "checker" | "reviewer";
    assignee_label?: string | null;
    effective_from: string;
    effective_to: string | null;
    app_users: { display_name: string } | Array<{ display_name: string }> | null;
  }>;
  contract_repositories: {
    id: string;
    reference_code: string;
    status: "active" | "setup_pending" | "closed";
    intake_record_type?: "msa" | "lsa" | "addendum" | "crf_crn" | "not_confirmed" | null;
    intake_record_reference?: string | null;
    intake_source_reference?: string | null;
    master_engagements: {
      id: string;
      reference_code: string;
      title: string;
      status: "active" | "pending_review" | "closed";
      master_engagement_documents: Array<{
        id: string;
        document_kind: "msa" | "lsa" | "addendum";
        reference_code: string;
        title: string;
        status: "active" | "pending_review" | "closed";
        source_reference: string;
      }>;
    } | Array<{
      id: string;
      reference_code: string;
      title: string;
      status: "active" | "pending_review" | "closed";
      master_engagement_documents: Array<{
        id: string;
        document_kind: "msa" | "lsa" | "addendum";
        reference_code: string;
        title: string;
        status: "active" | "pending_review" | "closed";
        source_reference: string;
      }>;
    }>;
    additional_engagements: Array<{
      id: string;
      engagement_kind: "change_request_form";
      reference_code: string;
      title: string;
      status: "active" | "pending_review" | "closed";
      source_reference: string;
      scope_summary: string;
    }>;
  } | Array<{
    id: string;
    reference_code: string;
    status: "active" | "setup_pending" | "closed";
    intake_record_type?: "msa" | "lsa" | "addendum" | "crf_crn" | "not_confirmed" | null;
    intake_record_reference?: string | null;
    intake_source_reference?: string | null;
    master_engagements: {
      id: string;
      reference_code: string;
      title: string;
      status: "active" | "pending_review" | "closed";
      master_engagement_documents: Array<{
        id: string;
        document_kind: "msa" | "lsa" | "addendum";
        reference_code: string;
        title: string;
        status: "active" | "pending_review" | "closed";
        source_reference: string;
      }>;
    } | Array<{
      id: string;
      reference_code: string;
      title: string;
      status: "active" | "pending_review" | "closed";
      master_engagement_documents: Array<{
        id: string;
        document_kind: "msa" | "lsa" | "addendum";
        reference_code: string;
        title: string;
        status: "active" | "pending_review" | "closed";
        source_reference: string;
      }>;
    }>;
    additional_engagements: Array<{
      id: string;
      engagement_kind: "change_request_form";
      reference_code: string;
      title: string;
      status: "active" | "pending_review" | "closed";
      source_reference: string;
      scope_summary: string;
    }>;
  }>;
  taxpayer_entities: Array<{
    id: string;
    reference_code: string;
    display_name: string;
    tin: string | null;
    tin_status: "unresolved" | "provided" | "validated";
      registration_units: Array<{
      id: string;
      reference_code: string;
      display_name: string;
      unit_kind: "head_office" | "branch" | "other";
      active: boolean;
        registration_unit_scope_assignments: Array<{
          effective_from?: string;
          effective_to?: string | null;
          organization_units: ScopeOrganizationUnit | ScopeOrganizationUnit[] | null;
        }>;
        registration_unit_team_assignments: Array<{
          id: string;
          user_id: string | null;
          assignment_role: "portfolio_owner" | "preparer" | "checker" | "reviewer";
          assignee_label: string;
          effective_from: string;
          effective_to: string | null;
          app_users: { display_name: string } | Array<{ display_name: string }> | null;
        }>;
        registration_source_references: Array<{
        source_kind: "bir_form_2303" | "other_registration_source";
        source_system: "sharepoint" | "synthetic_fixture" | "manual_reference";
        source_reference: string;
          status: "reference_only" | "needs_review" | "verified";
        }>;
        registration_authorities?: Array<{
          id: string;
          authority: string;
          reference: string;
          status: "active" | "review_due" | "not_configured" | "superseded";
          effective_from: string;
          effective_to: string | null;
          entitlement_context: string | null;
          notes: string | null;
        }>;
        tax_profile_versions: Array<{
          id: string;
          version_number: number;
          state: "draft" | "ready_for_validation" | "active" | "superseded";
          effective_from: string;
          effective_to?: string | null;
          profile_data: Record<string, unknown>;
          assignment_data: Record<string, unknown>;
          validated_at: string | null;
          validated_by: string | null;
          tax_profile_office_context?: Array<{
            bir_offices: { official_code: string; official_name: string; office_type: string } | Array<{ official_code: string; official_name: string; office_type: string }> | null;
            source_label: string | null;
            resolution_status: string;
            resolution_note: string | null;
          }>;
          tax_profile_filing_context?: Array<{
            filing_channels: { code: string; label: string } | Array<{ code: string; label: string }> | null;
            efps_groups: { code: string; label: string } | Array<{ code: string; label: string }> | null;
            filing_channel_source_label: string | null;
            efps_group_source_label: string | null;
            channel_resolution_status: string;
            efps_group_resolution_status: string;
            resolution_note: string | null;
          }>;
          tax_profile_registered_tax_types?: Array<{
            tax_types: { code: string; label: string; operating_category: string } | Array<{ code: string; label: string; operating_category: string }> | null;
            source_label: string;
            resolution_status: string;
            resolution_note: string | null;
          }>;
          tax_audit_exposure_snapshots: Array<{
            id: string;
            taxable_year: string;
            matter: string;
            status: "open" | "under_review" | "closed" | "unresolved";
            as_of_date: string | null;
            context: string | null;
            source_reference: string | null;
            officer_source_label: string | null;
            officer_role: string | null;
            officer_contact: string | null;
          }>;
        }>;
      }>;
  }>;
};

export type OrganizationUnitOption = {
  id: string;
  code: string;
  name: string;
  unit_kind: "team" | "tower" | "cluster" | "a_and_t";
  parent_id?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
};

export async function listOrganizationUnitOptions(): Promise<OrganizationUnitOption[]> {
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase is not configured for this environment.");
  const { data, error } = await client
    .from("organization_units")
    .select("id, code, name, unit_kind, parent_id, effective_from, effective_to")
    .eq("active", true)
    .order("unit_kind")
    .order("name");
  if (error) throw new Error(`Unable to load organizational units: ${error.message}`);
  return (data ?? []) as OrganizationUnitOption[];
}

export async function listPortfolioClients(options: { detail?: "registry" | "full" } = {}): Promise<PortfolioClient[]> {
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase is not configured for this environment.");

  const contractSelect = options.detail === "registry"
    ? `
      contract_repositories (
        id,
        reference_code,
        status,
        intake_record_type,
        intake_record_reference,
        intake_source_reference
      ),`
    : `
      contract_repositories (
        id,
        reference_code,
        status,
        intake_record_type,
        intake_record_reference,
        intake_source_reference,
        master_engagements (
          id,
          reference_code,
          title,
          status,
          master_engagement_documents (
            id,
            document_kind,
            reference_code,
            title,
            status,
            source_reference
          )
        ),
        additional_engagements (
          id,
          engagement_kind,
          reference_code,
          title,
          status,
          source_reference,
          scope_summary
        )
      ),`;

  const registryOnlyRelations = options.detail === "registry" ? "" : `
        ,registration_authorities (
          id,
          authority,
          reference,
          status,
          effective_from,
          effective_to,
          entitlement_context,
          notes
        )`;
  const registeredTaxTypesRelation = options.detail === "registry" ? "" : `
          ,tax_profile_registered_tax_types (
            source_label,
            resolution_status,
            resolution_note,
            tax_types (code, label, operating_category)
          )`;

  const { data, error } = await client
    .from("clients")
    .select(`
      id,
      reference_code,
      display_name,
      status,
      client_group_memberships (
        effective_from,
        effective_to,
        client_groups (display_name, status)
      ),
      client_team_assignments (
        id,
        user_id,
        assignment_role,
        effective_from,
        effective_to,
        app_users (display_name)
      ),
      ${contractSelect}
      taxpayer_entities (
        id,
        reference_code,
        display_name,
        tin,
        tin_status,
        registration_units (
          id,
          reference_code,
          display_name,
          unit_kind,
          active,
        registration_source_references (
            source_kind,
            source_system,
            source_reference,
          status
        )
        ${registryOnlyRelations}
        ,registration_unit_scope_assignments (
          effective_from,
          effective_to,
          organization_units (code, name, unit_kind, parent:parent_id (name, unit_kind))
        )
        ,registration_unit_team_assignments (
          id,
          user_id,
          assignment_role,
          assignee_label,
          effective_from,
          effective_to,
          app_users (display_name)
        )
        ,tax_profile_versions (
          id,
          version_number,
          state,
          effective_from,
          effective_to,
          profile_data,
          assignment_data,
          validated_at,
          validated_by,
          tax_audit_exposure_snapshots (
            id,
            taxable_year,
            matter,
            status,
            as_of_date,
            context,
            source_reference,
            officer_source_label,
            officer_role,
            officer_contact
          ),
          tax_profile_office_context (
            source_label,
            resolution_status,
            resolution_note,
            bir_offices (official_code, official_name, office_type)
          ),
          tax_profile_filing_context (
            filing_channel_source_label,
            efps_group_source_label,
            channel_resolution_status,
            efps_group_resolution_status,
            resolution_note,
            filing_channels (code, label),
            efps_groups (code, label)
          )
          ${registeredTaxTypesRelation}
        )
        )
      )
    `)
    .order("display_name");

  if (error) throw new Error(`Unable to load the client portfolio: ${error.message}`);
  return (data ?? []) as unknown as PortfolioClient[];
}

export async function getPortfolioClient(referenceCode: string): Promise<PortfolioClient | null> {
  const clients = await listPortfolioClients();
  return clients.find((client) => client.reference_code === referenceCode) ?? null;
}

export async function createManualClientSetup(input: ManualClientSetupInput): Promise<{
  clientId: string;
  contractRepositoryId: string;
  taxpayerEntityId: string;
  registrationUnitId: string;
  setupStatus: "setup_pending";
}> {
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase is not configured for this environment.");

  const { data, error } = await client.rpc("create_manual_client_setup", {
    p_client_reference_code: input.clientReferenceCode,
    p_client_display_name: input.clientDisplayName,
    p_entity_reference_code: input.entityReferenceCode,
    p_entity_display_name: input.entityDisplayName,
    p_tin: input.tin ?? null,
    p_unit_reference_code: input.unitReferenceCode,
    p_unit_display_name: input.unitDisplayName,
    p_unit_kind: input.unitKind,
    p_registration_reference: input.registrationReference ?? null,
    p_organization_unit_id: input.organizationUnitId,
    p_source_reference: input.sourceReference,
    p_source_system: input.sourceSystem,
    p_source_notes: input.sourceNotes ?? null,
    p_profile_data: input.profileData ?? {},
    p_contract_data: input.contractData ?? {},
    p_source_pack: input.sourcePack ?? [],
  });

  if (error) throw new Error(`Unable to create the client setup record: ${error.message}`);
  return data as {
    clientId: string;
    contractRepositoryId: string;
    taxpayerEntityId: string;
    registrationUnitId: string;
    setupStatus: "setup_pending";
  };
}
