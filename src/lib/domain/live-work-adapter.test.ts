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

  it("titles generated work by its own return and family, and gives an elected optional return its TMF due date", () => {
    const generated = adaptLiveGeneratedWork({ ...work, adjusted_statutory_deadline: null, base_statutory_deadline: null, tmf_package_target: "2026-05-19", source_context: { formNumber: "2550M", dueDate: "2026-05-20", dueDateBasis: "TMF due date (no BIR deadline)" } }, new Map());
    expect(generated.title).toBe("2550M · VAT");
    expect(generated.dueDate).toBe("2026-05-20");
    const payment = adaptLiveGeneratedWork({ ...work, source_context: { formNumber: "0619-E" } }, new Map());
    expect(payment.title).toBe("0619-E · Expanded withholding");
  });

  it("keeps unresolved readiness visible as a blocker", () => {
    const projected = adaptLiveGeneratedWork({ ...work, data_readiness: "not_ready" });
    expect(projected.blocker?.category).toBe("CLIENT DATA");
  });

  it("retains the source and recorded date for readiness", () => {
    const projected = adaptLiveGeneratedWork({
      ...work,
      source_context: {
        dataReadiness: {
          state: "ready",
          source: "TMF_BOOKS",
          reason: "Books confirmed for preparation.",
          recordedAt: "2026-10-20T01:00:00Z",
          recordedBy: "user-1",
        },
      },
    }, new Map([["user-1", "Assigned preparer"]]));
    expect(projected.workflowSnapshot?.dataReadiness).toEqual({
      state: "READY",
      source: "TMF_BOOKS",
      reason: "Books confirmed for preparation.",
      actor: "Assigned preparer",
      recordedAt: "2026-10-20T01:00:00Z",
    });
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

  it("keeps the client-send date separate from the approval evidence date", () => {
    const projected = adaptLiveGeneratedWork({
      ...work,
      generated_work_process_steps: [{
        step_code: "client_approval",
        bundle: "filing",
        label: "Client approval",
        owner_role: "preparer",
        step_order: 4,
        status: "complete",
        started_at: "2026-10-19T01:00:00Z",
        completed_at: "2026-10-20T01:00:00Z",
        updated_at: "2026-10-20T01:00:00Z",
      }],
      generated_work_evidence: [{
        step_code: "client_approval",
        evidence_kind: "client_approval",
        reference: "Approval email",
        external_date: "2026-10-20",
        acknowledged_on: null,
        validated_on: null,
        attachment_name: null,
        external_reference: null,
        external_channel: "Email",
        sharepoint_url: null,
        result_status: "reported",
        note: null,
        actor_id: "user-1",
        recorded_at: "2026-10-20T02:00:00Z",
      }, {
        step_code: "check",
        evidence_kind: "payment",
        reference: "Amount to pay captured at Checker certification",
        amount: 1234.56,
        external_date: null,
        acknowledged_on: null,
        validated_on: null,
        attachment_name: null,
        external_reference: null,
        external_channel: null,
        sharepoint_url: null,
        result_status: "reported",
        note: null,
        actor_id: "user-1",
        recorded_at: "2026-10-20T02:01:00Z",
      }],
    }, new Map([["user-1", "Assigned preparer"]]));

    const clientApprovalHistory = projected.workflowSnapshot?.processHistory.filter((event) => event.stepId === "client-approval");
    expect(clientApprovalHistory?.find((event) => event.status === "IN_PROGRESS")?.recordedAt).toBe("2026-10-19T01:00:00Z");
    expect(clientApprovalHistory?.find((event) => event.status === "DONE")?.completedOn).toBe("2026-10-20");
    expect(projected.paymentAmount).toBe(1234.56);
  });
});
