import { describe, expect, it } from "vitest";

import { adaptLiveGeneratedWork } from "./live-work-adapter";

const work = {
  id: "work-live-1",
  registration_unit_id: "ru-live-1",
  requirement_id: "requirement-test",
  requirement_version_id: "requirement-version-test",
  period_label: "September 2026",
  data_readiness: "ready" as const,
  lifecycle_stage: "client_approval" as const,
  engagement_status: "open" as const,
  rag_status: "amber" as const,
  base_statutory_deadline: "2026-10-16",
  adjusted_statutory_deadline: "2026-10-16",
  tmf_package_target: "2026-10-15",
  internal_target_missed: false,
  statutory_deadline_missed: false,
  preparer_user_id: "user-1",
  checker_user_id: null,
  reviewer_user_id: null,
  current_owner_user_id: "user-1",
  registration_units: {
    id: "ru-live-1",
    display_name: "Head Office",
    unit_kind: "head_office",
    taxpayer_entities: { display_name: "Sanitized Entity", clients: { reference_code: "CLIENT-LIVE-1", display_name: "Sanitized Client" } },
    registration_unit_scope_assignments: [
      { organization_units: { code: "TOWER-A", name: "Tower A", unit_kind: "tower" } },
      { organization_units: { code: "CLUSTER-A", name: "Cluster A", unit_kind: "cluster" } },
    ],
  },
  bir_requirements: { requirement_code: "REQ-TEST", requirement_name: "Test requirement" },
  generated_compliance_work_components: [{ component_code: "filing", label: "Filing", component_type: "return_filing" as const, requiredness: "mandatory" as const, status: "complete" as const, statutory_deadline: "2026-10-16", evidence_state: "recorded" as const }],
};

describe("live generated work adapter", () => {
  it("projects governed work without inferring tax facts", () => {
    const projected = adaptLiveGeneratedWork(work, new Map([["user-1", "Assigned preparer"]]))
    expect(projected.clientId).toBe("CLIENT-LIVE-1");
    expect(projected.deadline).toBe("2026-10-15");
    expect(projected.deadlineType).toBe("TMF internal target");
    expect(projected.owner).toBe("Assigned preparer");
    expect(projected.status).toBe("AMBER");
    expect(projected.stage).toBe("CLIENT");
    expect(projected.cluster).toBe("Cluster A");
    expect(projected.steps.map((step) => step.label)).toEqual([
      "Preparation",
      "Checking",
      "Review",
      "Client approval",
      "Filing",
      "Payment",
      "Attachments",
      "Archiving",
    ]);
  });

  it("keeps unresolved readiness visible as a blocker", () => {
    const projected = adaptLiveGeneratedWork({ ...work, data_readiness: "not_ready" });
    expect(projected.blocker?.category).toBe("CLIENT DATA");
  });

  it("normalizes live process aliases to the Work journey identifiers", () => {
    const projected = adaptLiveGeneratedWork({
      ...work,
      lifecycle_stage: "preparation",
      current_gate: "preparer",
      generated_work_process_steps: [{
        step_code: "preparer",
        bundle: "filing",
        label: "Preparation",
        owner_role: "preparer",
        step_order: 1,
        status: "in_progress",
        started_at: "2026-10-13T01:00:00Z",
        completed_at: null,
        updated_at: "2026-10-13T01:00:00Z",
      }],
    });
    expect(projected.steps[0]?.id).toBe("prepare");
    expect(projected.steps[0]?.state).toBe("current");
    expect(projected.workflowSnapshot?.currentGate).toBe("PREPARER");
    expect(projected.workflowSnapshot?.processStatuses.prepare).toBe("IN_PROGRESS");
  });
});
