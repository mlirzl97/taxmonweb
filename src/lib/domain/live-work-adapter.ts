import type { FixtureScope, FixtureStatus, FixtureWorkComponent, FixtureWorkItem, FixtureWorkStep, FixtureWorkStepState, FixtureWorkflowSnapshot } from "@/lib/fixtures";
import type { LiveGeneratedWork } from "@/lib/server/generated-work-repository";

type UserNameMap = ReadonlyMap<string, string>;

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function scopeFromUnit(name: string | null | undefined): FixtureScope {
  const value = name?.toLowerCase() ?? "";
  if (value.includes("tower a")) return "Tower A";
  if (value.includes("tower b")) return "Tower B";
  if (value.includes("tower c")) return "Tower C";
  return "Unresolved" as FixtureScope;
}

function organizationUnitsForWork(work: LiveGeneratedWork) {
  return work.registration_units?.registration_unit_scope_assignments
    .flatMap((assignment) => {
      const relation = firstRelation(assignment.organization_units);
      return relation ? [relation] : [];
    }) ?? [];
}

function stageFromLifecycle(stage: LiveGeneratedWork["lifecycle_stage"]): FixtureWorkItem["stage"] {
  if (stage === "preparation" || stage === "checking") return "PREPARE";
  if (stage === "review" || stage === "client_approval") return stage === "client_approval" ? "CLIENT" : "REVIEW";
  if (stage === "filing") return "FILE";
  return "POST-FILING";
}

function statusFromRag(status: LiveGeneratedWork["rag_status"]): FixtureStatus {
  return status.toUpperCase() as FixtureStatus;
}

function stepState(stage: LiveGeneratedWork["lifecycle_stage"], step: LiveGeneratedWork["lifecycle_stage"]): FixtureWorkStepState {
  const order: LiveGeneratedWork["lifecycle_stage"][] = ["preparation", "checking", "review", "client_approval", "filing", "payment", "other_submissions", "complete"];
  const current = order.indexOf(stage);
  const target = order.indexOf(step);
  if (stage === "complete" || target < current) return "complete";
  if (target === current) return "current";
  return "not-started";
}

function componentLabel(component: LiveGeneratedWork["generated_compliance_work_components"][number]): FixtureWorkComponent["label"] {
  if (component.component_type === "payment") return "Payment";
  if (component.component_type === "attachment_schedule" || component.component_type === "electronic_submission") return "Attachments";
  if (component.component_type === "evidence") return "Evidence";
  return "Submission";
}

function componentState(component: LiveGeneratedWork["generated_compliance_work_components"][number]) {
  return component.status === "complete" || component.evidence_state === "accepted" ? "Complete" : component.status === "blocked" ? "Blocked" : component.status === "unresolved" || component.evidence_state === "unresolved" ? "Unresolved" : component.status === "in_progress" ? "In progress" : "Not started";
}

function actorName(actorId: string | null | undefined, userNames: UserNameMap) {
  return actorId ? userNames.get(actorId) ?? "Authenticated user" : "Authenticated user";
}

function workflowSnapshotFor(work: LiveGeneratedWork, userNames: UserNameMap): FixtureWorkflowSnapshot | undefined {
  const hasHistory = Boolean(work.generated_work_process_steps?.length || work.generated_work_gate_attempts?.length || work.generated_work_checklist_updates?.length || work.generated_work_evidence?.length || work.generated_work_period_lock_events?.length || work.final_certified_at);
  if (!hasHistory) return undefined;
  const checklistAnswers: FixtureWorkflowSnapshot["checklistAnswers"] = {};
  const checklistHistory = (work.generated_work_checklist_updates ?? []).map((update, index) => {
    const role = update.role.toUpperCase() as "PREPARER" | "CHECKER" | "REVIEWER";
    const answers = checklistAnswers[role] ?? {};
    checklistAnswers[role] = { ...answers, [update.question_id]: update.completed };
    return { id: `${work.id}-checklist-${index + 1}`, role, questionId: update.question_id, completed: update.completed, actor: actorName(update.actor_id, userNames), recordedAt: update.recorded_at };
  });
  const processHistory: Array<FixtureWorkflowSnapshot["processHistory"][number]> = (work.generated_work_evidence ?? []).map((evidence, index) => ({
    id: `${work.id}-evidence-${index + 1}`,
    stepId: evidence.step_code,
    status: "DONE" as const,
    actor: actorName(evidence.actor_id, userNames),
    recordedAt: evidence.recorded_at,
    evidenceReference: evidence.reference,
    sharepointUrl: evidence.sharepoint_url ?? undefined,
  }));
  for (const step of work.generated_work_process_steps ?? []) {
    const status = step.status === "complete" ? "DONE" : step.status === "not_applicable" ? "NOT_APPLICABLE" : step.status === "in_progress" ? "IN_PROGRESS" : step.status === "needs_attention" ? "NEEDS_ATTENTION" : "NOT_STARTED";
    if (status !== "DONE" && status !== "NOT_APPLICABLE") processHistory.push({ id: `${work.id}-${step.step_code}-${step.updated_at}`, stepId: step.step_code, status, actor: "System", recordedAt: step.updated_at });
  }
  const processStatuses = Object.fromEntries((work.generated_work_process_steps ?? []).map((step) => [step.step_code, step.status === "complete" ? "DONE" : step.status === "not_applicable" ? "NOT_APPLICABLE" : step.status === "in_progress" ? "IN_PROGRESS" : step.status === "needs_attention" ? "NEEDS_ATTENTION" : "NOT_STARTED"])) as FixtureWorkflowSnapshot["processStatuses"];
  const attempts = (work.generated_work_gate_attempts ?? []).map((attempt, index) => ({
    id: `${work.id}-attempt-${index + 1}`,
    role: attempt.role.toUpperCase() as "PREPARER" | "CHECKER" | "REVIEWER",
    decision: attempt.decision.toUpperCase() as "CERTIFY" | "APPROVE" | "RETURN",
    note: attempt.note,
    answers: attempt.answers,
    actor: actorName(attempt.actor_id, userNames),
    recordedAt: attempt.recorded_at,
    ...(attempt.override_reason ? { elevatedOverride: true, overrideReason: attempt.override_reason } : {}),
  }));
  const lockHistory = (work.generated_work_period_lock_events ?? []).map((event) => ({ locked: event.locked, actor: actorName(event.actor_id, userNames), recordedAt: event.recorded_at, reason: event.reason }));
  return {
    currentGate: work.current_gate ? work.current_gate.toUpperCase() as "PREPARER" | "CHECKER" | "REVIEWER" : null,
    attempts,
    checklistAnswers,
    checklistHistory,
    processStatuses,
    processHistory,
    changeHistory: [],
    periodLock: lockHistory.at(-1) ?? { locked: false },
    periodLockHistory: lockHistory,
    ...(work.final_certified_at ? { finalCertification: { actor: actorName(work.final_certified_by, userNames), recordedAt: work.final_certified_at, note: work.final_certification_note ?? "Closure certified." } } : {}),
  };
}

function deadlineFor(work: LiveGeneratedWork) {
  if (work.tmf_package_target) return { value: work.tmf_package_target, type: "TMF internal target" as const };
  if (work.adjusted_statutory_deadline) return { value: work.adjusted_statutory_deadline, type: "Control milestone" as const };
  if (work.base_statutory_deadline) return { value: work.base_statutory_deadline, type: "Control milestone" as const };
  return { value: "Deadline unresolved", type: "Control milestone" as const };
}

export function adaptLiveGeneratedWork(work: LiveGeneratedWork, userNames: UserNameMap = new Map()): FixtureWorkItem {
  const unit = work.registration_units;
  const entity = firstRelation(unit?.taxpayer_entities);
  const client = firstRelation(entity?.clients);
  const requirement = firstRelation(work.bir_requirements);
  const deadline = deadlineFor(work);
  const organizationUnits = organizationUnitsForWork(work);
  const tower = organizationUnits.find((organizationUnit) => organizationUnit.unit_kind === "tower")
    ?? organizationUnits.find((organizationUnit) => /^Tower\s+/i.test(organizationUnit.name));
  const cluster = organizationUnits.find((organizationUnit) => organizationUnit.unit_kind === "cluster")
    ?? organizationUnits.find((organizationUnit) => /^Cluster\s+/i.test(organizationUnit.name));
  const payment = work.generated_compliance_work_components.find((component) => component.component_type === "payment");
  const paymentApplicability = work.payment_applicability === "not_applicable" ? "NOT_APPLICABLE" : work.payment_applicability === "required" ? "REQUIRED" : work.payment_applicability === "unresolved" ? "UNRESOLVED" : payment ? payment.requiredness === "unresolved" || payment.requiredness === "optional" ? "UNRESOLVED" : "REQUIRED" : "NOT_APPLICABLE";
  const ownerId = work.current_owner_user_id ?? work.preparer_user_id;
  const owner = ownerId ? userNames.get(ownerId) ?? "Assigned user" : "Unassigned";
  const persistedSteps = work.generated_work_process_steps ?? [];
  const persistedStatus = new Map(persistedSteps.map((step) => [step.step_code, step.status]));
  const steps: FixtureWorkStep[] = [
    ["preparation", "Preparation"], ["checking", "Checking"], ["review", "Review"], ["client_approval", "Client approval"], ["filing", "Filing"], ["payment", "Payment"], ["other_submissions", "Attachments"], ["complete", "Archiving"],
  ].map(([id, label]) => {
    const stepId = id === "other_submissions" ? "esubmission" : id === "complete" ? "evidence" : id;
    const persisted = persistedStatus.get(stepId);
    const state: FixtureWorkStepState = persisted === "complete" || persisted === "not_applicable" ? "complete" : persisted === "needs_attention" ? "unresolved" : persisted === "in_progress" ? "current" : stepState(work.lifecycle_stage, id as LiveGeneratedWork["lifecycle_stage"]);
    return { id: stepId, label, state, detail: "State is read from the governed compliance work record." };
  });
  const components = work.generated_compliance_work_components.map((component) => ({ label: componentLabel(component), state: componentState(component), detail: `${component.label}${component.statutory_deadline ? ` · statutory ${component.statutory_deadline}` : ""}` }));
  const blocker = work.data_readiness === "not_ready" ? { category: "CLIENT DATA" as const, reason: "Data readiness is not confirmed." } : work.engagement_status === "open" && work.rag_status === "red" ? { category: "INTERNAL" as const, reason: "This work object is carrying a red control signal." } : undefined;
  return {
    id: work.id,
    requirementId: work.requirement_id,
    requirementVersionId: work.requirement_version_id,
    clientId: client?.reference_code ?? `registration-unit-${work.registration_unit_id}`,
    client: client?.display_name ?? "Taxpayer unresolved",
    entity: entity?.display_name ?? "Taxpayer entity unresolved",
    registrationUnitId: unit?.id ?? work.registration_unit_id,
    registrationUnit: unit?.display_name ?? "Registration unit unresolved",
    title: requirement ? `${requirement.requirement_code} · ${requirement.requirement_name}` : "Requirement unresolved",
    period: work.period_label,
    detail: work.engagement_status === "complete" ? "Complete" : work.lifecycle_stage.replaceAll("_", " "),
    stage: stageFromLifecycle(work.lifecycle_stage),
    nextAction: work.engagement_status === "complete" ? "No action" : `Continue ${work.lifecycle_stage.replaceAll("_", " ")}`,
    status: statusFromRag(work.rag_status),
    statusReason: work.statutory_deadline_missed ? "Statutory deadline missed." : work.internal_target_missed ? "TMF package target missed." : "Projected from the governed work state.",
    deadline: deadline.value,
    deadlineType: deadline.type,
    owner,
    scope: scopeFromUnit(tower?.name),
    ...(cluster?.name ? { cluster: cluster.name } : {}),
    paymentApplicability,
    paymentAmount: work.payment_amount ?? null,
    steps,
    components,
    ...(workflowSnapshotFor(work, userNames) ? { workflowSnapshot: workflowSnapshotFor(work, userNames) } : {}),
    ...(blocker ? { blocker } : {}),
  };
}
