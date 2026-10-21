import { describe, expect, it } from "vitest";

import { additionalEngagementToFixtureChangeRequestForm, portfolioClientToFixtureClient } from "./live-client-adapter";

function liveClient(overrides: Record<string, unknown> = {}) {
  return {
    id: "client-live-1",
    reference_code: "CLIENT-LIVE-1",
    display_name: "Sanitized Operations Inc.",
    status: "active" as const,
    client_group_memberships: [],
    client_team_assignments: [],
    contract_repositories: [],
    taxpayer_entities: [{
      id: "entity-live-1",
      reference_code: "ENTITY-LIVE-1",
      display_name: "Sanitized Operations Inc.",
      tin: "000000000999",
      tin_status: "provided" as const,
      registration_units: [{
        id: "ru-live-1",
        reference_code: "RU-LIVE-1",
        display_name: "Head Office",
        unit_kind: "head_office" as const,
        active: true,
        registration_unit_scope_assignments: [{ organization_units: { code: "ORG-UNRESOLVED", name: "Review required", unit_kind: "tower" } }],
        registration_unit_team_assignments: [],
        registration_source_references: [{ source_kind: "other_registration_source" as const, source_system: "manual_reference" as const, source_reference: "approved-source-1", status: "needs_review" as const }],
        registration_authorities: [],
        tax_profile_versions: [{
          id: "profile-live-1",
          version_number: 1,
          state: "ready_for_validation" as const,
          effective_from: "2026-10-05",
          profile_data: {
            registeredTaxpayerName: "Sanitized Operations Incorporated",
            tinDisplay: "000-000-000-999",
            filingChannel: "eBIRForms",
            paymentRoute: "Client Pays",
            enateSetup: "No",
            clientWeight: "2",
          },
          assignment_data: { preparer: "Unlinked fixture label" },
          validated_at: null,
          validated_by: null,
          tax_profile_office_context: [],
          tax_profile_filing_context: [],
          tax_profile_registered_tax_types: [],
          tax_audit_exposure_snapshots: [],
        }],
      }],
    }],
    ...overrides,
  };
}

describe("live client adapter", () => {
  it("derives the cluster from a tower scope's parent", () => {
    const base = liveClient();
    const entity = base.taxpayer_entities[0];
    const unit = entity.registration_units[0];
    const client = { ...base, taxpayer_entities: [{ ...entity, registration_units: [{ ...unit, registration_unit_scope_assignments: [{ organization_units: { code: "CL-BEATO-T1", name: "Brgy. Beato · Tower 1", unit_kind: "tower", parent: { name: "Brgy. Beato", unit_kind: "cluster" } } }] }] }] };
    const projected = portfolioClientToFixtureClient(client as unknown as Parameters<typeof portfolioClientToFixtureClient>[0]);
    expect(projected.assignment.tower).toBe("Brgy. Beato · Tower 1");
    expect(projected.assignment.cluster).toBe("Brgy. Beato");
  });

  it("projects normalized additional engagements without inventing ownership", () => {
    const client = liveClient({
      contract_repositories: [{
        id: "contract-live-1",
        reference_code: "CONTRACT-LIVE-1",
        additional_engagements: [{
          id: "engagement-live-1",
          contract_repository_id: "contract-live-1",
          reference_code: "CRF-LIVE-1",
          title: "Registration remediation",
          status: "active" as const,
          effective_from: "2026-10-05",
          source_reference: "approved-reference",
          scope_summary: "Sanitized registration context",
        }],
      }],
    });
    const engagement = {
      id: "engagement-live-1",
      contract_repository_id: "contract-live-1",
      reference_code: "CRF-LIVE-1",
      title: "Registration remediation",
      status: "active",
      effective_from: "2026-10-05",
      source_reference: "approved-reference",
      scope_summary: "Sanitized registration context",
    };
    const projected = additionalEngagementToFixtureChangeRequestForm({ reference_code: client.reference_code, display_name: client.display_name, contractRepositoryId: "contract-live-1" }, engagement);

    expect(projected.type).toBe("Registration remediation");
    expect(projected.status).toBe("Active");
    expect(projected.owner).toBe("Unassigned");
    expect(projected.sourceReference).toBe("approved-reference");
  });

  it("projects the current normalized client-group relationship", () => {
    const projected = portfolioClientToFixtureClient(liveClient({
      client_group_memberships: [{
        effective_from: "2026-01-01",
        effective_to: null,
        client_groups: { display_name: "Sanitized Group (sanitized)", status: "active" as const },
      }],
    }));

    expect(projected.clientGroup).toBe("Sanitized Group (sanitized)");
  });

  it("preserves multiple active Registration Units in the live profile projection", () => {
    const base = liveClient();
    const entity = base.taxpayer_entities[0];
    const branch = {
      ...entity.registration_units[0],
      id: "ru-live-branch-1",
      reference_code: "RU-LIVE-BRANCH-1",
      display_name: "South Operations Branch",
      unit_kind: "branch" as const,
    };
    const projected = portfolioClientToFixtureClient({
      ...base,
      taxpayer_entities: [{ ...entity, registration_units: [...entity.registration_units, branch] }],
    });

    expect(projected.entities[0]?.units.map((unit) => unit.name)).toEqual(["Head Office", "South Operations Branch"]);
  });

  it("projects the persisted Tax Profile instead of reconstructing fixture facts", () => {
    const projected = portfolioClientToFixtureClient(liveClient());
    const profile = projected.entities[0]?.profile;

    expect(profile?.registeredTaxpayerName).toBe("Sanitized Operations Incorporated");
    expect(profile?.tinDisplay).toBe("000-000-000-999");
    expect(profile?.filingChannel).toBe("eBIRForms");
    expect(profile?.paymentRoute).toBe("Client Pays");
    expect(projected.assignment.preparer).toBe("Unassigned");
  });

  it("prefers normalized Tax Profile context over legacy profile JSON", () => {
    const projected = portfolioClientToFixtureClient(liveClient({
      taxpayer_entities: [{
        id: "entity-live-1",
        reference_code: "ENTITY-LIVE-1",
        display_name: "Sanitized Operations Inc.",
        tin: "000000000999",
        tin_status: "provided" as const,
        registration_units: [{
          id: "ru-live-1",
          reference_code: "RU-LIVE-1",
          display_name: "Head Office",
          unit_kind: "head_office" as const,
          active: true,
          registration_unit_scope_assignments: [],
          registration_unit_team_assignments: [],
          registration_source_references: [],
          registration_authorities: [],
          tax_profile_versions: [{
            id: "profile-live-1",
            version_number: 1,
            state: "ready_for_validation" as const,
            effective_from: "2026-10-05",
            profile_data: {
              rdoOrLts: "Legacy JSON value",
              filingChannel: "Legacy JSON value",
              registeredTaxTypes: ["Legacy JSON value"],
            },
            assignment_data: {},
            validated_at: null,
            validated_by: null,
            tax_profile_office_context: [{
              source_label: "RDO 50",
              resolution_status: "resolved",
              resolution_note: null,
              bir_offices: { official_code: "RDO-50", official_name: "South Makati City", office_type: "RDO" },
            }],
            tax_profile_filing_context: [{
              filing_channel_source_label: "eBIRForms",
              efps_group_source_label: null,
              channel_resolution_status: "resolved",
              efps_group_resolution_status: "unresolved",
              resolution_note: null,
              filing_channels: { code: "EBIRFORMS", label: "eBIRForms" },
              efps_groups: null,
            }],
            tax_profile_registered_tax_types: [{
              source_label: "VAT",
              resolution_status: "resolved",
              resolution_note: null,
              tax_types: { code: "VAT", label: "Value-Added Tax", operating_category: "VAT / Percentage Tax" },
            }],
            tax_audit_exposure_snapshots: [],
          }],
        }],
      }],
    }));
    const profile = projected.entities[0]?.profile;

    expect(profile?.rdoOrLts).toBe("RDO-50");
    expect(profile?.filingChannel).toBe("eBIRForms");
    expect(profile?.registeredTaxTypes).toEqual(["Value-Added Tax"]);
    expect(profile?.attention).toContain("eFPS group requires validation");
  });

  it("does not project a future-dated Tax Profile version as current", () => {
    const baseUnit = liveClient().taxpayer_entities[0]!.registration_units[0]!;
    const projected = portfolioClientToFixtureClient(liveClient({
      taxpayer_entities: [{
        ...liveClient().taxpayer_entities[0]!,
        registration_units: [{
          ...baseUnit,
          tax_profile_versions: [
            {
              ...baseUnit.tax_profile_versions[0]!,
              id: "profile-current",
              version_number: 1,
              effective_from: "2026-10-05",
              profile_data: { registeredTaxpayerName: "Current Sanitized Name" },
            },
            {
              ...baseUnit.tax_profile_versions[0]!,
              id: "profile-future",
              version_number: 2,
              effective_from: "2099-01-01",
              profile_data: { registeredTaxpayerName: "Future Sanitized Name" },
            },
          ],
        }],
      }],
    }));

    expect(projected.entities[0]?.profile.registeredTaxpayerName).toBe("Current Sanitized Name");
  });

  it("does not assign an unresolved live scope to a real tower", () => {
    const projected = portfolioClientToFixtureClient(liveClient());

    expect(projected.scope).toBe("Unresolved");
    expect(projected.assignment.cluster).toBe("Unresolved");
    expect(projected.entities[0]?.profile.attention).toContain("Organizational scope requires validation");
  });

  it("projects a normalized cluster scope without changing the tower boundary", () => {
    const projected = portfolioClientToFixtureClient(liveClient({
      taxpayer_entities: [{
        id: "entity-live-1",
        reference_code: "ENTITY-LIVE-1",
        display_name: "Sanitized Operations Inc.",
        tin: "000000000999",
        tin_status: "provided" as const,
        registration_units: [{
          id: "ru-live-1",
          reference_code: "RU-LIVE-1",
          display_name: "Head Office",
          unit_kind: "head_office" as const,
          active: true,
          registration_unit_scope_assignments: [{ organization_units: [
            { code: "FIXTURE-TOWER-A", name: "Tower A", unit_kind: "tower" },
            { code: "FIXTURE-CLUSTER-A", name: "Cluster A", unit_kind: "cluster" },
          ] }],
          registration_unit_team_assignments: [],
          registration_source_references: [],
          registration_authorities: [],
          tax_profile_versions: [],
        }],
      }],
    }));

    expect(projected.scope).toBe("Tower A");
    expect(projected.assignment.cluster).toBe("Cluster A");
  });

  it("projects only current canonical assignment records", () => {
    const projected = portfolioClientToFixtureClient(liveClient({
      client_team_assignments: [
        { id: "assignment-current", user_id: "user-preparer", assignment_role: "preparer", effective_from: "2026-01-01", effective_to: null, app_users: { display_name: "Current Preparer" } },
        { id: "assignment-expired", user_id: "user-old", assignment_role: "checker", effective_from: "2024-01-01", effective_to: "2025-12-31", app_users: { display_name: "Former Checker" } },
      ],
    }));

    expect(projected.assignment.preparer).toBe("Current Preparer");
    expect(projected.assignment.checker).toBe("Unassigned");
  });

  it("projects effective-dated registration-unit team history without inventing staff identities", () => {
    const projected = portfolioClientToFixtureClient(liveClient({
      taxpayer_entities: [{
        id: "entity-live-1",
        reference_code: "ENTITY-LIVE-1",
        display_name: "Sanitized Operations Inc.",
        tin: "000000000999",
        tin_status: "provided" as const,
        registration_units: [{
          id: "ru-live-1",
          reference_code: "RU-LIVE-1",
          display_name: "Head Office",
          unit_kind: "head_office" as const,
          active: true,
          registration_unit_scope_assignments: [],
          registration_unit_team_assignments: [
            { id: "assignment-history-1", user_id: null, assignment_role: "preparer", effective_from: "2026-01-01", effective_to: "2026-06-30", app_users: null },
            { id: "assignment-history-2", user_id: null, assignment_role: "preparer", effective_from: "2026-07-01", effective_to: null, app_users: null },
          ],
          registration_source_references: [],
          registration_authorities: [],
          tax_profile_versions: [],
        }],
      }],
    }));

    expect(projected.teamHistory).toEqual([
      expect.objectContaining({ effectivePeriod: "2026-07-01", preparer: "Unassigned" }),
      expect.objectContaining({ effectivePeriod: "2026-01-01 – 2026-06-30", preparer: "Unassigned" }),
    ]);
  });

  it("projects normalized audit exposure snapshots with source context", () => {
    const client = liveClient({
      taxpayer_entities: [{
        id: "entity-live-1",
        reference_code: "ENTITY-LIVE-1",
        display_name: "Sanitized Operations Inc.",
        tin: "000000000999",
        tin_status: "provided" as const,
        registration_units: [{
          id: "ru-live-1",
          reference_code: "RU-LIVE-1",
          display_name: "Head Office",
          unit_kind: "head_office" as const,
          active: true,
          registration_unit_scope_assignments: [],
          registration_unit_team_assignments: [],
          registration_source_references: [],
          registration_authorities: [{
            id: "authority-live-1",
            authority: "PEZA",
            reference: "PEZA-REFERENCE-1",
            status: "active" as const,
            effective_from: "2026-01-01",
            effective_to: null,
            entitlement_context: "Source-backed entitlement context",
            notes: "Approved registration source",
          }],
          tax_profile_versions: [{
            id: "profile-live-1",
            version_number: 1,
            state: "ready_for_validation" as const,
            effective_from: "2026-10-05",
            profile_data: {},
            assignment_data: {},
            validated_at: null,
            validated_by: null,
            tax_profile_office_context: [],
            tax_profile_filing_context: [],
            tax_profile_registered_tax_types: [],
            tax_audit_exposure_snapshots: [{
              id: "audit-live-1",
              taxable_year: "2025",
              matter: "BIR audit exposure",
              status: "open" as const,
              as_of_date: "2026-10-05",
              context: "Source-backed high-level context",
              source_reference: "approved-audit-source",
              officer_source_label: "Officer label from source",
              officer_role: "Revenue Officer",
              officer_contact: null,
            }],
          }],
        }],
      }],
    });
    const projected = portfolioClientToFixtureClient(client);
    expect(projected.entities[0]?.profile.auditExposures).toEqual([expect.objectContaining({ taxableYear: "2025", status: "Open", source: "approved-audit-source" })]);
    expect(projected.entities[0]?.profile.authorities).toEqual([expect.objectContaining({ authority: "PEZA", status: "Active", reference: "PEZA-REFERENCE-1" })]);
  });
});
