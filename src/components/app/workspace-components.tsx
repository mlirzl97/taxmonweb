"use client";

import Link from "next/link";
import { Fragment, useEffect, useId, useRef, useState } from "react";

import { fixtureClients, type FixtureException, type FixturePaymentApplicability, type FixtureScope, type FixtureStatus, type FixtureWorkItem } from "@/lib/fixtures";
import { scopeLabelForValue, scopeOptions, scopeValueForFilter, type ScopeFilter } from "@/lib/control-tower-state";
import { canUseElevatedOverride, useWorkflow, workflowPerspectiveLabel, workflowProcessRoleLabel, workflowRoleLabel, type WorkflowDecision, type WorkflowProcessOwner, type WorkflowProcessStatus, type WorkflowRole } from "@/lib/workflow-state";
import { StatusPill } from "../ui/status-pill";

export { scopeOptions };
export type { ScopeFilter };

export function isInScope(scope: FixtureScope, filter: ScopeFilter): boolean {
  if (filter === "all") return true;
  return scope === scopeValueForFilter(filter);
}

export { scopeLabelForValue };

const gateProcessStepIds = new Set(["prepare", "check", "review"]);
const paymentProcessStepIds = new Set(["payment", "payment-client-approval", "payment-confirmation"]);
const processStatusLabels: Record<WorkflowProcessStatus, string> = { NOT_STARTED: "Not started", IN_PROGRESS: "In progress", DONE: "Complete", NOT_APPLICABLE: "Not applicable", NEEDS_ATTENTION: "Needs attention" };
type ProcessBundle = "Filing" | "Payment" | "Attachments" | "Archiving";
const processBundles: readonly ProcessBundle[] = ["Filing", "Payment", "Attachments", "Archiving"];
const processBundleForStep: Record<string, ProcessBundle> = { prepare: "Filing", check: "Filing", review: "Filing", "client-approval": "Filing", filing: "Filing", payment: "Payment", "payment-client-approval": "Payment", "payment-confirmation": "Payment", esubmission: "Attachments", evidence: "Archiving" };

export function FixturePageFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="workspace-page">
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="module-header page-header">
      <div>
        <h1>{title}</h1>
        {description && <p className="page-header__description">{description}</p>}
      </div>
      {action && <div className="page-header__action">{action}</div>}
    </header>
  );
}

export function ScopeSwitcher({ value, onChange }: { value: ScopeFilter; onChange: (value: ScopeFilter) => void }) {
  return (
    <label className="scope-select">
      <span>Scope</span>
      <select aria-label="Scope" onChange={(event) => onChange(event.target.value as ScopeFilter)} value={value}>
        {scopeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </label>
  );
}

export function FilterTabs<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ id: T; label: string; count?: number }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="filter-tabs" aria-label={label} role="group">
      {options.map((option) => (
        <button
          aria-pressed={value === option.id}
          className={value === option.id ? "filter-tab filter-tab--active" : "filter-tab"}
          key={option.id}
          onClick={() => onChange(option.id)}
          type="button"
        >
          {option.label}{option.count !== undefined && <span className="filter-tab__count">{option.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  tone,
  detail,
  active,
  onClick,
}: {
  label: string;
  value: string;
  tone: "neutral" | "amber" | "blue" | "red";
  detail: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="metric-card__label">{label}</span>
      <strong>{value}</strong>
      <span className="metric-card__detail">{detail}</span>
      {onClick && <span className="metric-card__action">{active ? "Showing queue" : "Show queue"}</span>}
    </>
  );

  if (!onClick) return <div className={`metric-card metric-card--${tone}`}>{content}</div>;

  return (
    <button aria-pressed={active} className={`metric-card metric-card--${tone}${active ? " metric-card--active" : ""}`} onClick={onClick} type="button">
      {content}
    </button>
  );
}

export function SectionHeading({ title, detail, href, linkLabel }: { title: string; detail?: string; href?: string; linkLabel?: string }) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {detail && <p>{detail}</p>}
      </div>
      {href && linkLabel && <Link className="text-link" href={href}>{linkLabel}</Link>}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-state__mark" aria-hidden="true">—</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}

export function StatusLabel({ status, detail }: { status: FixtureStatus; detail?: string }) {
  const tone = status === "GREEN" ? "green" : status === "AMBER" ? "amber" : status === "RED" ? "red" : "unresolved";
  return <span className="status-label"><StatusPill tone={tone}>{status}</StatusPill>{detail && <span className="status-label__detail">{detail}</span>}</span>;
}

export function ConceptTag({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "blocker" | "risk" | "exception" }) {
  return <span className={`concept-tag concept-tag--${tone}`}>{children}</span>;
}

export function DetailDrawer({
  eyebrow,
  title,
  subtitle,
  onClose,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const subtitleId = useId();

  useEffect(() => {
    const previousActiveElement = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActiveElement?.focus();
    };
  }, [onClose]);

  return (
    <div className="drawer-layer" role="presentation">
      <button aria-label="Close detail panel" className="drawer-backdrop" onClick={onClose} tabIndex={-1} type="button" />
      <aside aria-describedby={subtitle ? subtitleId : undefined} aria-labelledby={titleId} aria-modal="true" className="detail-drawer" ref={drawerRef} role="dialog">
        <div className="detail-drawer__header">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p id={subtitleId}>{subtitle}</p>}
          </div>
          <button aria-label="Close detail panel" className="icon-button" onClick={onClose} ref={closeButtonRef} type="button">×</button>
        </div>
        <div className="detail-drawer__body">{children}</div>
      </aside>
    </div>
  );
}

export function WorkDetail({ work, onClose = () => undefined, fullPage = false, serverAuthorized = false }: { work: FixtureWorkItem; onClose?: () => void; fullPage?: boolean; serverAuthorized?: boolean }) {
  const { canActOnProcessStep, canActOnWorkflow, currentRole, getChecklistAnswers, getEffectiveWork, getLatestProcessUpdate, getOperationalRecords, getPeriodLock, getQuestions, getRecord, getWorkItems, isWorkVisible, prototypeMode, recordFinalCertification, setChecklistAnswer, setCurrentRole, setPaymentAmount, setPaymentApplicability, setProcessStatus, setWorkPerspective, submitDecision, workPerspective } = useWorkflow();
  const liveWork = prototypeMode ? undefined : getWorkItems().find((item) => item.id === work.id);
  const effectiveWork = getEffectiveWork(liveWork ?? work);
  const calendarItems = getOperationalRecords().filter((record) => record.work.id === work.id).map((record) => record.calendar);
  const primaryReturn = calendarItems.find((item) => !/QAP/i.test(item.returnLabel)) ?? calendarItems[0];
  const returnPackageLabel = primaryReturn?.returnLabel.replace(/\s*·\s*/g, " ") ?? "Work item";
  const returnFormLabel = primaryReturn?.returnLabel.replace(/^[^·]+·\s*/, "") ?? "return";
  const periodLabel = primaryReturn?.period ?? effectiveWork.period;
  const hasQapSequence = calendarItems.some((item) => /QAP/i.test(item.returnLabel));
  const client = getOperationalRecords().find((record) => record.work.id === work.id)?.client ?? (prototypeMode ? fixtureClients.find((item) => item.id === effectiveWork.clientId) : undefined);
  const workflowRecord = getRecord(effectiveWork);
  const periodLock = getPeriodLock(effectiveWork);
  const [selectedRole, setSelectedRole] = useState<WorkflowRole>(workflowRecord.currentGate ?? currentRole);
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState("");
  const [processFeedback, setProcessFeedback] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideDraft, setOverrideDraft] = useState("");
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [pendingProcessStatus, setPendingProcessStatus] = useState<{ stepId: string; status: "DONE" | "NOT_APPLICABLE" } | null>(null);
  const [pendingProcessEvidence, setPendingProcessEvidence] = useState("");
  const [pendingArchiveNaming, setPendingArchiveNaming] = useState("");
  const [pendingArchiveSharePoint, setPendingArchiveSharePoint] = useState("");
  const [paymentAmountDraft, setPaymentAmountDraft] = useState(effectiveWork.paymentAmount === null || effectiveWork.paymentAmount === undefined ? "" : String(effectiveWork.paymentAmount));
  const role = workPerspective === "MASTER_ADMIN" ? selectedRole : workflowRecord.currentGate ?? selectedRole;
  const elevatedOverrideAvailable = canUseElevatedOverride(workPerspective);
  const requiresOverrideReason = elevatedOverrideAvailable;
  const canAct = canActOnWorkflow(role, effectiveWork);
  const currentProcessStep = effectiveWork.steps.find((step) => step.state === "current" || step.state === "unresolved" || step.state === "blocked");
  const stepById = new Map(effectiveWork.steps.map((step) => [step.id, step]));
  function baselineProcessStatus(state: string): WorkflowProcessStatus {
    if (state === "complete") return "DONE";
    if (state === "unresolved") return "NEEDS_ATTENTION";
    if (state === "current" || state === "waiting" || state === "blocked") return "IN_PROGRESS";
    return "NOT_STARTED";
  }
  const processStatusForStep = (step: FixtureWorkItem["steps"][number]) => effectiveWork.paymentApplicability === "NOT_APPLICABLE" && paymentProcessStepIds.has(step.id) ? "NOT_APPLICABLE" as const : getLatestProcessUpdate(effectiveWork, step.id)?.status ?? baselineProcessStatus(step.state);
  const processState = (stepId: string) => processStatusLabels[stepById.get(stepId) ? processStatusForStep(stepById.get(stepId)!) : "NOT_STARTED"];
  const paymentProcessIncluded = effectiveWork.paymentApplicability !== "NOT_APPLICABLE";
  const paymentAmountRecorded = effectiveWork.paymentAmount !== null && effectiveWork.paymentAmount !== undefined;
  const paymentAmountLabel = paymentAmountRecorded ? new Intl.NumberFormat("en-PH", { currency: "PHP", maximumFractionDigits: 2, style: "currency" }).format(effectiveWork.paymentAmount ?? 0) : "";
  const courseStages: readonly { id: string; label: string; bundle: ProcessBundle; owner: WorkflowProcessOwner; stepId?: string; state: string; detail: string }[] = [
    { id: "data", label: "Get data", bundle: "Filing", owner: "PREPARER", state: effectiveWork.blocker?.category === "CLIENT DATA" ? "Blocked" : "Ready", detail: "Receive the information and source schedules needed for this return." },
    { id: "prepare", label: "Draft return", bundle: "Filing", owner: "PREPARER", stepId: "prepare", state: processState("prepare"), detail: hasQapSequence ? `Data mapping, vouching, plotting, reconciliation, draft ${returnFormLabel} Excel working paper, and QAP.` : `Data mapping, vouching, plotting, reconciliation, and draft ${returnFormLabel} Excel working paper.` },
    { id: "check", label: "Checker review", bundle: "Filing", owner: "CHECKER", stepId: "check", state: processState("check"), detail: "Check the prepared return, capture client comments, and return it to the Preparer when revisions are needed." },
    { id: "review", label: "Reviewer review", bundle: "Filing", owner: "REVIEWER", stepId: "review", state: processState("review"), detail: "Review the return and client comments before it is cleared for client approval and filing." },
    { id: "client-approval", label: "Send to client for approval", bundle: "Filing", owner: "PREPARER", stepId: "client-approval", state: processState("client-approval"), detail: "Send the approval package to the client and record the response before filing." },
    { id: "filing", label: "File return and retain FRN", bundle: "Filing", owner: "PREPARER", stepId: "filing", state: processState("filing"), detail: "File through eFPS, eBIRForms, or the configured channel; retain the filed return and FRN or BIR email acknowledgment." },
    { id: "payment-endorsement", label: "Endorse payment", bundle: "Payment", owner: "PREPARER", stepId: "payment", state: processState("payment"), detail: "After filing, send the filed return package for payment. The route may be client-facilitated or TMF-facilitated." },
    { id: "payment-client-approval", label: "Release or approve payment", bundle: "Payment", owner: "PREPARER", stepId: "payment-client-approval", state: processState("payment-client-approval"), detail: "For client payment, record the client release or approval; for TMF payment, retain the payment request and funding confirmation." },
    { id: "paid", label: "Process payment and retain proof", bundle: "Payment", owner: "PREPARER", stepId: "payment-confirmation", state: processState("payment-confirmation"), detail: "Once payment is available, process it and retain proof of payment and any supporting documents." },
    { id: "attachments", label: "Attachments", bundle: "Attachments", owner: "PREPARER", stepId: "esubmission", state: processState("esubmission"), detail: "Complete the applicable attachment or eSubmission sequence, retain its validation and acknowledgement results, and fix/resend when errors are returned." },
    { id: "archive", label: "Archive the return package", bundle: "Archiving", owner: "PREPARER", stepId: "evidence", state: processState("evidence"), detail: "Compile the working paper, approval, filed return, FRN/BIR acknowledgment, payment proof where applicable, and eSubmission outputs; apply naming convention and save to the correct A&T folder or SharePoint." },
  ];
  const pendingStage = currentProcessStep ? courseStages.find((stage) => stage.stepId === currentProcessStep.id) : undefined;
  const pendingOwner = workflowRecord.currentGate ?? pendingStage?.owner;
  const pendingTask = pendingStage?.label ?? (pendingOwner ? "Complete the assigned gate" : undefined);
  const pendingAssignee = pendingOwner === "PREPARER" ? client?.assignment.preparer : pendingOwner === "CHECKER" ? client?.assignment.checker : pendingOwner === "REVIEWER" ? client?.assignment.reviewer : undefined;
  const visibleProcessBundles = processBundles.filter((bundle) => bundle !== "Payment" || effectiveWork.paymentApplicability !== "NOT_APPLICABLE");
  const activeViewStep = effectiveWork.steps.find((step) => {
    const status = processStatusForStep(step);
    return status === "IN_PROGRESS" || status === "NEEDS_ATTENTION";
  });
  const activeBundle = activeViewStep ? processBundleForStep[activeViewStep.id] : undefined;
  const [collapsedBundles, setCollapsedBundles] = useState<Record<string, boolean>>(() => Object.fromEntries(visibleProcessBundles.filter((bundle) => bundle !== activeBundle).map((bundle) => [bundle, true])));
  const [journeyView, setJourneyView] = useState<"table" | "map">("table");
  const allBundlesExpanded = visibleProcessBundles.every((bundle) => collapsedBundles[bundle] !== true);
  const statusOptions: WorkflowProcessStatus[] = ["NOT_STARTED", "IN_PROGRESS", "NEEDS_ATTENTION", "DONE", "NOT_APPLICABLE"];
  const answers = getChecklistAnswers(effectiveWork, role);
  const roleRows = client ? [
    { code: "P", label: "Preparer", person: client.assignment.preparer, action: "Draft · client approval · filing · payment · attachments · archive" },
    { code: "C", label: "Checker", person: client.assignment.checker, action: "Review and capture comments" },
    { code: "R", label: "Reviewer", person: client.assignment.reviewer, action: "Review and clear for filing" },
  ] : [];
  const activityEvents = [...workflowRecord.processHistory.map((event) => ({ id: event.id, label: `${processBundleForStep[event.stepId] ?? "Process"} · ${processStatusLabels[event.status]}`, detail: `${event.actor} · ${event.recordedAt}` })), ...workflowRecord.checklistHistory.map((event) => ({ id: event.id, label: `${workflowRoleLabel(event.role)} checklist`, detail: `${event.completed ? "Completed" : "Reopened"} · ${event.actor} · ${event.recordedAt}` })), ...workflowRecord.attempts.map((event) => ({ id: event.id, label: `${workflowRoleLabel(event.role)} · ${event.decision === "RETURN" ? "Returned for correction" : event.decision === "CERTIFY" ? "Certified" : "Approved"}`, detail: `${event.actor} · ${event.recordedAt}` })), ...workflowRecord.periodLockHistory.map((event, index) => ({ id: `period-lock-${index}-${event.recordedAt}`, label: event.locked ? "Accounting period closed" : "Historical lock event", detail: `${event.actor} · ${event.recordedAt}` })), ...workflowRecord.changeHistory.map((event) => ({ id: event.id, label: event.detail, detail: `${event.actor} · ${event.recordedAt}` }))].reverse().slice(0, 12);
  const packageStages: ReadonlyArray<{ id: string; label: string; stepIds: string[] }> = [
    { id: "filing", label: "Filing", stepIds: ["prepare", "check", "review", "client-approval", "filing"] },
    { id: "payment", label: "Payment", stepIds: ["payment", "payment-client-approval", "payment-confirmation"] },
    { id: "attachments", label: "Attachments", stepIds: ["esubmission"] },
    { id: "archiving", label: "Archiving", stepIds: ["evidence"] },
  ];
  const packageStageStatuses: WorkflowProcessStatus[] = packageStages.map((stage) => {
    const statuses = stage.stepIds.map((stepId) => stepById.get(stepId)).filter((step): step is FixtureWorkItem["steps"][number] => Boolean(step)).map(processStatusForStep);
    if (statuses.length > 0 && statuses.every((value) => value === "NOT_APPLICABLE")) return "NOT_APPLICABLE";
    return statuses.some((value) => value === "NEEDS_ATTENTION") ? "NEEDS_ATTENTION" : statuses.every((value) => value === "DONE" || value === "NOT_APPLICABLE") ? "DONE" : statuses.some((value) => value === "IN_PROGRESS") ? "IN_PROGRESS" : "NOT_STARTED";
  });
  const packageCurrentIndex = packageStageStatuses.findIndex((status) => status !== "DONE" && status !== "NOT_APPLICABLE");
  const packageCompletedCount = packageStageStatuses.filter((status) => status === "DONE").length;

  const questions = getQuestions(role);
  const isCurrentGate = workflowRecord.currentGate === role;
  const allQuestionsAnswered = questions.every((question) => answers[question.id]);

  if (!serverAuthorized && !isWorkVisible(work)) {
    return <section aria-labelledby="work-access-title" className="persona-access-state"><p className="eyebrow">Work access</p><h1 id="work-access-title">This work item is outside your assigned view</h1><p>Open work assigned to you or within your authorized reporting scope.</p><Link className="button button--quiet" href="/app/work">Back to Work</Link></section>;
  }

  async function recordDecision(decision: WorkflowDecision) {
    const result = await submitDecision(effectiveWork, role, decision, answers, note, overrideReason);
    if (!result.ok) {
      setFeedback(result.error ?? "The decision could not be recorded.");
      return;
    }
    setFeedback(`${decision === "RETURN" ? "Returned for correction" : role === "PREPARER" ? "Preparer certification recorded" : `${workflowRoleLabel(role)} approval recorded`} · ${effectiveWork.client} · ${effectiveWork.period}`);
    setNote("");
    setOverrideReason("");
    if (result.nextGate) setSelectedRole(result.nextGate);
  }

  async function updateChecklist(questionId: string, completed: boolean) {
    const result = await setChecklistAnswer(effectiveWork, role, questionId, completed);
    if (!result.ok) setFeedback(result.error ?? "The checklist item could not be saved.");
  }

  async function updateProcessStep(stepId: string, status: WorkflowProcessStatus, evidenceReference = "", sharepointUrl = "") {
    const result = await setProcessStatus(effectiveWork, stepId, status, evidenceReference, overrideReason, sharepointUrl);
    const message = status === "DONE" ? "Saved · step marked done." : status === "NOT_STARTED" ? "Saved · returned to the queue." : `Saved · ${processStatusLabels[status]}.`;
    setProcessFeedback(result.ok ? message : result.error ?? "The process step could not be recorded.");
    if (result.ok) {
      if (elevatedOverrideAvailable) setOverrideReason("");
    }
    if (result.ok && (status === "DONE" || status === "NOT_APPLICABLE")) {
      const stepIndex = effectiveWork.steps.findIndex((candidate) => candidate.id === stepId);
      const nextStep = effectiveWork.steps[stepIndex + 1];
      const nextBundle = nextStep ? processBundleForStep[nextStep.id] : undefined;
      setCollapsedBundles(nextBundle ? (current) => ({ ...current, [nextBundle]: false }) : Object.fromEntries(processBundles.map((bundle) => [bundle, true])));
    }
    return result;
  }

  function requestProcessStatus(stepId: string, status: WorkflowProcessStatus) {
    if (status === "DONE" || status === "NOT_APPLICABLE") {
      setPendingProcessStatus({ stepId, status });
      setPendingProcessEvidence("");
      setPendingArchiveNaming("");
      setPendingArchiveSharePoint("");
      setProcessFeedback("");
      return;
    }
    updateProcessStep(stepId, status);
  }

  async function confirmPendingProcessStatus() {
    if (!pendingProcessStatus) return;
    const isArchiving = pendingProcessStatus.stepId === "evidence" && pendingProcessStatus.status === "DONE";
    const evidenceReference = isArchiving
      ? `Naming convention: ${pendingArchiveNaming.trim()}${pendingArchiveSharePoint.trim() ? ` · SharePoint: ${pendingArchiveSharePoint.trim()}` : ""}`
      : pendingProcessEvidence.trim();
    if (!evidenceReference || (isArchiving && !pendingArchiveNaming.trim())) return;
    const result = await updateProcessStep(pendingProcessStatus.stepId, pendingProcessStatus.status, evidenceReference, isArchiving ? pendingArchiveSharePoint.trim() : "");
    if (result.ok) {
      setPendingProcessStatus(null);
      setPendingProcessEvidence("");
      setPendingArchiveNaming("");
      setPendingArchiveSharePoint("");
    }
  }

  async function savePaymentAmount() {
    const trimmed = paymentAmountDraft.trim();
    const amount = trimmed === "" ? null : Number(trimmed);
    const result = await setPaymentAmount(effectiveWork, amount);
    setProcessFeedback(result.ok ? "Saved · payment amount recorded." : result.error ?? "The payment amount could not be saved.");
  }

  async function savePaymentApplicability(value: FixturePaymentApplicability) {
    const result = await setPaymentApplicability(effectiveWork, value);
    setProcessFeedback(result.ok ? "Saved · payment applicability recorded." : result.error ?? "Payment applicability could not be saved.");
  }

  function renderGateChecklist() {
    if (!workflowRecord.currentGate) {
      if (workflowRecord.finalCertification) return <section className="workflow-gate-panel work-course-map__checklist" aria-labelledby="workflow-final-certification-title"><div className="section-heading"><div><p className="eyebrow">Final control</p><h2 id="workflow-final-certification-title">Reviewer closure certified</h2><p>{workflowRecord.finalCertification.note}</p></div><span className="workflow-gate-panel__state">Recorded · {workflowRecord.finalCertification.actor}</span></div><small>{workflowRecord.finalCertification.recordedAt}</small></section>;
      const archiveStep = stepById.get("evidence");
      if (!archiveStep || processStatusForStep(archiveStep) !== "DONE") return null;
      return <section className="workflow-gate-panel work-course-map__checklist" aria-labelledby="workflow-final-certification-title"><div className="section-heading"><div><p className="eyebrow">Final control</p><h2 id="workflow-final-certification-title">Reviewer closure certification</h2><p>Confirm the complete package is archived and ready for Tax Team sampling or period close.</p></div><span className="workflow-gate-panel__state">Waiting for Reviewer</span></div><label className="workflow-note-field"><span>Final certification note</span><textarea aria-label="Final certification note" onChange={(event) => setNote(event.target.value)} placeholder="Confirm the package is complete and traceable." value={note} /></label>{requiresOverrideReason && <label className="workflow-note-field"><span>Override reason (required)</span><textarea aria-label="Final certification override reason" onChange={(event) => setOverrideReason(event.target.value)} placeholder="Why is elevated certification required?" value={overrideReason} /> </label>}<button className="button button--primary" disabled={periodLock.locked || !note.trim() || (requiresOverrideReason && !overrideReason.trim())} onClick={() => void recordFinalCertification(effectiveWork, note, overrideReason)} type="button">Certify closure as Reviewer</button></section>;
    }
    return <section className="workflow-gate-panel work-course-map__checklist" aria-labelledby="workflow-gate-title">
      <div className="section-heading"><div><p className="eyebrow">Gate checklist</p><h2 id="workflow-gate-title">{workflowRoleLabel(workflowRecord.currentGate)} checks</h2><p>Complete the checks, then record the gate decision. Each change is saved with the acting persona and time.</p></div><span className="workflow-gate-panel__state">Waiting for {workflowRoleLabel(workflowRecord.currentGate)}</span></div>
      <label className="select-control workflow-role-select"><span>Acting as</span><select aria-label="Workflow role" disabled={workPerspective !== "MASTER_ADMIN"} onChange={(event) => { const nextRole = event.target.value as WorkflowRole; setSelectedRole(nextRole); setCurrentRole(nextRole); setFeedback(""); }} value={role}><option value="PREPARER">Preparer</option><option value="CHECKER">Checker</option><option value="REVIEWER">Reviewer</option></select></label>
      <p className="workflow-gate-panel__hint">{workPerspective === "MASTER_ADMIN" ? "HOD preview." : `Acting view: ${workflowPerspectiveLabel(workPerspective)}.`}</p>
      {!canAct && <div className="workflow-gate-panel__warning"><span>View only. This checklist belongs to the {workflowRoleLabel(workflowRecord.currentGate)}.</span><button className="button button--quiet button--small" onClick={() => { const gate = workflowRecord.currentGate!; setCurrentRole(gate); setWorkPerspective(gate); }} type="button">Switch to {workflowRoleLabel(workflowRecord.currentGate)} view</button></div>}
      <div className="workflow-question-list">{questions.map((question) => { const latestChecklistUpdate = [...workflowRecord.checklistHistory].reverse().find((update) => update.role === role && update.questionId === question.id); return <label className={`workflow-question${answers[question.id] ? " workflow-question--checked" : ""}`} key={question.id}><input aria-label={question.label} checked={Boolean(answers[question.id])} disabled={periodLock.locked || !canAct || !isCurrentGate} onChange={(event) => updateChecklist(question.id, event.target.checked)} type="checkbox" /><span>{question.label}</span><small>{answers[question.id] ? `Done${latestChecklistUpdate ? ` · ${latestChecklistUpdate.actor}` : ""}` : "Open"}</small></label>; })}</div>
      <label className="workflow-note-field"><span>Decision note</span><textarea disabled={periodLock.locked} onChange={(event) => setNote(event.target.value)} placeholder="What did you check, or what needs correction?" value={note} /></label>
      {feedback && <p className="workflow-gate-panel__feedback" role="status">{feedback}</p>}
      <div className="workflow-gate-actions"><button className="button button--primary" disabled={periodLock.locked || !canAct || !isCurrentGate || !allQuestionsAnswered || !note.trim()} onClick={() => recordDecision(role === "PREPARER" ? "CERTIFY" : "APPROVE")} type="button">{role === "PREPARER" ? "Certify and submit" : `Approve as ${workflowRoleLabel(role)}`}</button><button className="button button--quiet" disabled={periodLock.locked || !canAct || !isCurrentGate || !note.trim()} onClick={() => recordDecision("RETURN")} type="button">Return for correction</button></div>
      {workflowRecord.attempts.length > 0 && <div className="workflow-attempt-history"><span className="eyebrow">Decision history</span>{workflowRecord.attempts.map((attempt) => <div className="workflow-attempt" key={attempt.id}><strong>{workflowRoleLabel(attempt.role)} · {attempt.decision === "RETURN" ? "Returned for correction" : attempt.role === "PREPARER" ? "Certified" : "Approved"}</strong><small>{attempt.recordedAt} · {attempt.note}</small></div>)}</div>}
    </section>;
  }

  const detailContent = (
    <div className="work-detail-content">
      <section aria-labelledby="work-package-tracker-title" className="work-package-timeline" tabIndex={0}>
        <div className="work-package-timeline__summary"><div><p className="eyebrow">Return status</p><h2 id="work-package-tracker-title">{packageCurrentIndex === -1 ? "Return complete" : `Currently in ${packageStages[packageCurrentIndex].label}`}</h2></div><span>{packageCompletedCount} of {packageStages.length} stages complete</span></div>
        {pendingOwner && pendingTask && <div className="work-package-timeline__handoff"><span className="work-package-timeline__handoff-label">Next handoff</span><strong>Waiting for {workflowProcessRoleLabel(pendingOwner)}</strong>{pendingAssignee && <span className="work-package-timeline__handoff-person">{pendingAssignee}</span>}<em>{pendingTask}</em></div>}
        <ol aria-label="Return journey status">
          {packageStages.map((stage, index) => { const status = packageStageStatuses[index]; const state = status === "DONE" ? "complete" : status === "NOT_APPLICABLE" ? "not-applicable" : status === "NEEDS_ATTENTION" ? "attention" : index === packageCurrentIndex ? "current" : "open"; return <li className={`work-package-timeline__item work-package-timeline__item--${state}`} key={stage.id}><span className="work-package-timeline__marker" aria-hidden="true">{status === "DONE" ? "✓" : status === "NOT_APPLICABLE" ? "—" : index + 1}</span><div><strong>{stage.label}</strong><small>{processStatusLabels[status]}</small></div></li>; })}
        </ol>
      </section>
      <section className="work-course-map" aria-labelledby="work-course-map-title">
        <div className="work-detail-progress__heading"><div><p className="eyebrow">Process</p><h2 id="work-course-map-title">Journey</h2><p className="work-progress-note">Each row shows the owner, status, and action for one step.</p></div><div className="work-course-map__tools"><div aria-label="Journey view" className="work-journey-view-toggle" role="group"><button aria-pressed={journeyView === "table"} className="text-button" onClick={() => setJourneyView("table")} type="button">Table</button><button aria-pressed={journeyView === "map"} className="text-button" onClick={() => setJourneyView("map")} type="button">Map</button></div><button aria-label={allBundlesExpanded ? "Collapse all process stages" : "Expand all process stages"} className="text-button work-course-map__bulk-toggle" onClick={() => setCollapsedBundles(Object.fromEntries(visibleProcessBundles.map((bundle) => [bundle, allBundlesExpanded])))} title={allBundlesExpanded ? "Collapse all" : "Expand all"} type="button">{allBundlesExpanded ? "−" : "+"}</button>{elevatedOverrideAvailable && <button aria-haspopup="dialog" className="text-button work-override-trigger" onClick={() => { setOverrideDraft(overrideReason); setOverrideDialogOpen(true); }} type="button">Elevated override{overrideReason.trim() ? " · ready" : ""}</button>}</div></div>
        {journeyView === "table" ? <div className="work-journey-table-wrap"><table className="work-journey-table"><caption className="sr-only">Return journey worksteps and current status</caption><thead><tr><th scope="col">Step</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead><tbody>
          {visibleProcessBundles.map((bundle) => {
            const bundleStages = courseStages.filter((stage) => stage.bundle === bundle);
            const bundleNotApplicable = bundle === "Payment" && effectiveWork.paymentApplicability === "NOT_APPLICABLE";
            return <Fragment key={bundle}><tr className="work-journey-table__bundle"><th colSpan={3} scope="rowgroup"><span>{bundle}</span>{bundleNotApplicable && <small>Not applicable</small>}</th></tr>{bundleStages.map((stage) => {
              const stageIndex = courseStages.findIndex((candidate) => candidate.id === stage.id);
              const previousStage = stageIndex > 0 && courseStages[stageIndex - 1].bundle === stage.bundle ? courseStages[stageIndex - 1] : undefined;
              const showOwner = !previousStage || previousStage.owner !== stage.owner;
              const step = stage.stepId ? stepById.get(stage.stepId) : undefined;
              const processStatus = step ? processStatusForStep(step) : undefined;
              const latestProcessUpdate = step ? getLatestProcessUpdate(effectiveWork, step.id) : undefined;
              const isCurrentStep = Boolean(step && currentProcessStep?.id === step.id);
              const isGateStep = Boolean(step && gateProcessStepIds.has(step.id));
              const canCompleteHere = Boolean(!periodLock.locked && step && isCurrentStep && !isGateStep && canActOnProcessStep(step.id, effectiveWork));
              const canUndoHere = Boolean(!periodLock.locked && step && processStatus === "DONE" && latestProcessUpdate?.status === "DONE" && !isGateStep && canActOnProcessStep(step.id, effectiveWork));
              const canEditStatus = Boolean(!periodLock.locked && step && processStatus && canActOnProcessStep(step.id, effectiveWork) && isCurrentStep);
              const archiveVerified = step?.id === "evidence" && processStatus === "DONE";
              const processNumber = courseStages.slice(0, stageIndex + 1).filter((candidate) => candidate.stepId).length;
              const statusClass = (processStatus ?? "NOT_STARTED").toLowerCase().replaceAll("_", "-");
              return <tr className={`work-journey-table__row${isCurrentStep ? " work-journey-table__row--current" : ""}`} key={stage.id}><th scope="row"><div className="work-journey-table__step"><span className="work-journey-table__number" aria-hidden="true">{stage.id === "data" ? "P" : processStatus === "DONE" ? "✓" : processNumber}</span><div><span>{stage.label}</span>{showOwner && <small className="work-journey-table__owner">{workflowProcessRoleLabel(stage.owner)}</small>}<details className="work-stage-help"><summary aria-label={`Show help for ${stage.label}`}>i</summary><p>{stage.detail}</p></details>{archiveVerified && <small className="work-verified-badge" aria-label="Filing and submission evidence verified">✓ Evidence verified</small>}</div></div></th><td>{processStatus ? canEditStatus ? <label className="work-journey-table__status-control"><span className="sr-only">{stage.label} status</span><select aria-label={`${stage.label} status`} onChange={(event) => requestProcessStatus(step!.id, event.target.value as WorkflowProcessStatus)} value={processStatus}>{statusOptions.map((option) => <option disabled={isGateStep && option === "DONE"} key={option} value={option}>{processStatusLabels[option]}</option>)}</select></label> : <span aria-label={`${stage.label} status`} className={`work-journey-table__status work-journey-table__status--${statusClass}`}>{processStatusLabels[processStatus]}</span> : <span className="work-journey-table__status work-journey-table__status--ready">{stage.state}</span>}</td><td><div className="work-journey-table__action">{stage.id === "prepare" && <div className="work-journey-table__result"><span>Payment</span><label><span className="sr-only">Payment applicability</span><select aria-label="Payment applicability" disabled={periodLock.locked || processStatusForStep(stepById.get("prepare") ?? effectiveWork.steps[0]) === "DONE"} onChange={(event) => void savePaymentApplicability(event.target.value as FixturePaymentApplicability)} value={effectiveWork.paymentApplicability}><option value="UNRESOLVED">Resolve applicability</option><option value="REQUIRED">Payment required</option><option value="NOT_APPLICABLE">No payment — skip payment phase</option></select></label>{paymentProcessIncluded && <>{paymentAmountRecorded ? <strong aria-label={`Payment amount ${paymentAmountLabel}`}>{paymentAmountLabel}</strong> : <><label><span className="sr-only">Payment amount in Philippine pesos</span><span aria-hidden="true">₱</span><input aria-label="Payment amount in Philippine pesos" inputMode="decimal" min="0" onChange={(event) => setPaymentAmountDraft(event.target.value)} placeholder="Amount" step="0.01" type="number" value={paymentAmountDraft} /></label><button className="button button--quiet button--small" disabled={periodLock.locked || !paymentAmountDraft.trim()} onClick={() => void savePaymentAmount()} type="button">Save</button></>}</>}</div>}{!step && <span className="work-journey-table__next">Receive source schedules</span>}{canCompleteHere && <button className="button button--quiet button--small" onClick={() => requestProcessStatus(stage.stepId!, "DONE")} type="button">Mark done</button>}{canUndoHere && <button className="text-button work-course-map__undo" onClick={() => updateProcessStep(stage.stepId!, "NOT_STARTED")} type="button">Undo</button>}{step && stage.id !== "prepare" && !canCompleteHere && !canUndoHere && <span aria-hidden="true" className="work-journey-table__empty">—</span>}</div></td></tr>;
            })}</Fragment>;
          })}
        </tbody></table></div> : <ol aria-label="End-to-end return process">
          {visibleProcessBundles.map((bundle) => {
            const bundleStages = courseStages.filter((stage) => stage.bundle === bundle);
            const bundleSteps = bundleStages.filter((stage) => stage.stepId).map((stage) => stepById.get(stage.stepId!)).filter((step): step is FixtureWorkItem["steps"][number] => Boolean(step));
            const completedCount = bundleSteps.filter((step) => { const status = processStatusForStep(step); return status === "DONE" || status === "NOT_APPLICABLE"; }).length;
            const bundleIsActive = bundleStages.some((stage) => stage.stepId === currentProcessStep?.id);
            const isCollapsed = collapsedBundles[bundle] ?? true;
            const bundleNotApplicable = bundle === "Payment" && effectiveWork.paymentApplicability === "NOT_APPLICABLE";
            return <li className={`work-course-map__bundle${bundleIsActive ? " work-course-map__bundle--active" : ""}${isCollapsed ? " work-course-map__bundle--collapsed" : ""}`} key={bundle}>
              <button aria-controls={`work-course-map-${bundle.replaceAll(" ", "-")}`} aria-expanded={!isCollapsed} className="work-course-map__bundle-toggle" onClick={() => setCollapsedBundles((current) => ({ ...current, [bundle]: !isCollapsed }))} type="button"><span>{bundle}</span><small>{bundleNotApplicable ? "Not applicable" : bundleSteps.length ? `${completedCount}/${bundleSteps.length} complete` : "Prerequisite"} · {isCollapsed ? "Show" : "Hide"}</small></button>
              {!isCollapsed && <div className="work-course-map__bundle-stages" id={`work-course-map-${bundle.replaceAll(" ", "-")}`}>
                {bundleStages.map((stage) => {
            const stageIndex = courseStages.findIndex((candidate) => candidate.id === stage.id);
            const step = stage.stepId ? stepById.get(stage.stepId) : undefined;
            const processStatus = step ? processStatusForStep(step) : undefined;
            const latestProcessUpdate = step ? getLatestProcessUpdate(effectiveWork, step.id) : undefined;
            const isCurrentStep = Boolean(step && currentProcessStep?.id === step.id);
            const isGateStep = Boolean(step && gateProcessStepIds.has(step.id));
            const isCurrentGateStep = isCurrentStep && isGateStep && workflowRecord.currentGate === stage.owner;
            const canCompleteHere = Boolean(!periodLock.locked && step && isCurrentStep && !isGateStep && canActOnProcessStep(step.id, effectiveWork));
            const canUndoHere = Boolean(!periodLock.locked && step && processStatus === "DONE" && latestProcessUpdate?.status === "DONE" && !isGateStep && canActOnProcessStep(step.id, effectiveWork));
            const canEditStatus = Boolean(!periodLock.locked && step && processStatus && canActOnProcessStep(step.id, effectiveWork) && isCurrentStep);
            const archiveVerified = step?.id === "evidence" && processStatus === "DONE";
            const processNumber = courseStages.slice(0, stageIndex + 1).filter((candidate) => candidate.stepId).length;
            const stageClassName = [`work-course-map__stage--${stage.state.toLowerCase().replaceAll(" ", "-")}`, isCurrentStep ? "work-course-map__stage--current-step" : ""].filter(Boolean).join(" ");
            return <div className={`work-course-map__stage-wrap${isCurrentGateStep ? " work-course-map__stage-wrap--active" : ""}`} key={stage.id}>
              <div className={`work-course-map__stage ${stageClassName}`}>
              <span className="work-course-map__marker" aria-hidden="true">{stage.id === "data" ? "P" : processStatus === "DONE" ? "✓" : processNumber}</span>
              <div className="work-course-map__body"><span className="work-course-map__responsibility">{workflowProcessRoleLabel(stage.owner)}</span><div className="work-course-map__stage-title"><strong>{stage.label}</strong><details className="work-stage-help"><summary aria-label={`Show help for ${stage.label}`}>i</summary><p>{stage.detail}</p></details></div>{archiveVerified && <span aria-label="Filed return and attachment evidence verified" className="work-verified-badge">✓ Evidence verified</span>}{stage.id === "prepare" && <div className={`work-course-map__amount-field work-course-map__draft-result${paymentAmountRecorded ? " work-course-map__draft-result--recorded" : ""}`}><span className="work-course-map__field-label">Draft result</span><label><span>Payment</span><select aria-label="Payment applicability" disabled={periodLock.locked || processStatusForStep(stepById.get("prepare") ?? effectiveWork.steps[0]) === "DONE"} onChange={(event) => void savePaymentApplicability(event.target.value as FixturePaymentApplicability)} value={effectiveWork.paymentApplicability}><option value="UNRESOLVED">Resolve applicability</option><option value="REQUIRED">Payment required</option><option value="NOT_APPLICABLE">No payment — skip payment phase</option></select></label>{paymentProcessIncluded && <><span>Amount to pay</span>{paymentAmountRecorded ? <strong aria-label={`Payment amount ${paymentAmountLabel}`} className="work-course-map__amount-readonly">{paymentAmountLabel}</strong> : <><label><span className="sr-only">Payment amount in Philippine pesos</span><span aria-hidden="true">₱</span><input aria-label="Payment amount in Philippine pesos" inputMode="decimal" min="0" onChange={(event) => setPaymentAmountDraft(event.target.value)} placeholder="Enter amount after draft" step="0.01" type="number" value={paymentAmountDraft} /></label><button className="button button--quiet button--small" disabled={periodLock.locked || !paymentAmountDraft.trim()} onClick={() => void savePaymentAmount()} type="button">Save amount</button></>}</>}</div>}</div>
              {!step && <span className="work-course-map__state">{stage.state}</span>}
              <div className="work-step__action">
                {step && processStatus && (canEditStatus ? <label className="work-course-map__status-control"><span className="sr-only">{stage.label} status</span><select aria-label={`${stage.label} status`} onChange={(event) => requestProcessStatus(step.id, event.target.value as WorkflowProcessStatus)} value={processStatus}>{statusOptions.map((option) => <option disabled={isGateStep && option === "DONE"} key={option} value={option}>{processStatusLabels[option]}</option>)}</select></label> : <span aria-label={`${stage.label} status`} className={`work-course-map__status-pill work-course-map__status-pill--${processStatus.toLowerCase().replaceAll("_", "-")}`}>{processStatusLabels[processStatus]}</span>)}
                {canCompleteHere && <button className="button button--quiet button--small" onClick={() => requestProcessStatus(stage.stepId!, "DONE")} type="button">Mark done</button>}
                {canUndoHere && <button className="text-button work-course-map__undo" onClick={() => updateProcessStep(stage.stepId!, "NOT_STARTED")} type="button">Undo</button>}
                {!isCurrentGateStep && !canCompleteHere && !canUndoHere && latestProcessUpdate && <small>Recorded by {latestProcessUpdate.actor} · {latestProcessUpdate.recordedAt}</small>}
              </div>
            </div>
            </div>;
          })}
              </div>}
            </li>;
          })}
        </ol>}
        {renderGateChecklist()}
        {processFeedback && <p className="work-process-feedback" role="status">{processFeedback}</p>}
      </section>
      {pendingProcessStatus && <div className="work-evidence-dialog-layer" role="presentation"><section aria-labelledby="work-evidence-dialog-title" aria-modal="true" className="work-evidence-dialog" onKeyDown={(event) => { if (event.key === "Escape") setPendingProcessStatus(null); }} role="dialog"><div className="work-evidence-dialog__header"><div><p className="eyebrow">Required before saving</p><h2 id="work-evidence-dialog-title">{pendingProcessStatus.status === "DONE" ? "Record result / evidence" : "Record why this is not applicable"}</h2><p>{courseStages.find((stage) => stage.stepId === pendingProcessStatus.stepId)?.label ?? "Process step"}</p></div><button aria-label="Close evidence dialog" className="icon-button" onClick={() => setPendingProcessStatus(null)} type="button">×</button></div>{pendingProcessStatus.stepId === "evidence" && pendingProcessStatus.status === "DONE" ? <><label className="work-evidence-dialog__field"><span>Naming convention</span><input autoFocus onChange={(event) => setPendingArchiveNaming(event.target.value)} placeholder="Final return package name" value={pendingArchiveNaming} /></label><label className="work-evidence-dialog__field"><span>SharePoint link <small>(optional)</small></span><input aria-label="SharePoint link" onChange={(event) => setPendingArchiveSharePoint(event.target.value)} placeholder="Paste the final folder or file link" type="url" value={pendingArchiveSharePoint} /></label></> : <label className="work-evidence-dialog__field"><span>{pendingProcessStatus.status === "DONE" ? "Result / evidence ref" : "N/A reason"}</span><input autoFocus onChange={(event) => setPendingProcessEvidence(event.target.value)} placeholder={pendingProcessStatus.status === "DONE" ? "Reference, acknowledgement, or result" : "Explain why this step does not apply"} value={pendingProcessEvidence} /></label>}{processFeedback && <p className="work-process-feedback" role="alert">{processFeedback}</p>}<div className="work-evidence-dialog__actions"><button className="button button--quiet" onClick={() => setPendingProcessStatus(null)} type="button">Cancel</button><button className="button button--primary" disabled={(!pendingProcessEvidence.trim() && !(pendingProcessStatus.stepId === "evidence" && pendingArchiveNaming.trim())) || periodLock.locked} onClick={confirmPendingProcessStatus} type="button">Save {pendingProcessStatus.status === "DONE" ? "complete" : "N/A"}</button></div></section></div>}
      {overrideDialogOpen && <div className="work-evidence-dialog-layer" role="presentation"><section aria-labelledby="work-override-dialog-title" aria-modal="true" className="work-evidence-dialog" onKeyDown={(event) => { if (event.key === "Escape") setOverrideDialogOpen(false); }} role="dialog"><div className="work-evidence-dialog__header"><div><p className="eyebrow">Exceptional action</p><h2 id="work-override-dialog-title">Elevated override</h2><p>This reason is attached to the next override and retained in the audit history.</p></div><button aria-label="Close elevated override dialog" className="icon-button" onClick={() => setOverrideDialogOpen(false)} type="button">×</button></div><label className="work-evidence-dialog__field"><span>Reason</span><textarea autoFocus aria-label="Override reason" disabled={periodLock.locked} onChange={(event) => setOverrideDraft(event.target.value)} placeholder="Why is this intervention required?" value={overrideDraft} /></label><div className="work-evidence-dialog__actions"><button className="button button--quiet" onClick={() => setOverrideDialogOpen(false)} type="button">Cancel</button><button className="button button--primary" disabled={periodLock.locked || !overrideDraft.trim()} onClick={() => { setOverrideReason(overrideDraft.trim()); setOverrideDialogOpen(false); }} type="button">Save reason</button></div></section></div>}
      {roleRows.length > 0 && <details className="work-raci"><summary>Roles</summary><div className="work-raci__rows">{roleRows.map((row) => <div className="work-raci__row" key={row.code}><strong>{row.code}</strong><span><b>{row.label}</b><small>{row.person}</small></span><em>{row.action}</em></div>)}</div></details>}
      {activityEvents.length > 0 && <details className="work-activity-history"><summary>Transaction history</summary><div>{activityEvents.map((event) => <div className="work-activity-history__event" key={event.id}><strong>{event.label}</strong><small>{event.detail}</small></div>)}</div></details>}
    </div>
  );
  if (fullPage) return <section className="work-detail-page" aria-labelledby="work-detail-page-title"><div className="work-detail-page__header"><div><p className="eyebrow">Return journey</p><h1 id="work-detail-page-title">{effectiveWork.title}</h1><p className="work-detail-page__client-line">{client ? <Link href={`/app/clients/${client.id}`}>{client.name}</Link> : effectiveWork.client}<span>{returnPackageLabel}</span><span>{periodLabel}</span>{periodLock.locked && <span className="work-validation-badge">✓ Tax Team validated</span>}</p></div><Link aria-label="Close return journey" className="icon-button work-detail-page__close" href="/app/work">×</Link></div>{detailContent}</section>;
  return <DetailDrawer eyebrow="Return package" title={client ? <Link className="detail-drawer__title-link" href={`/app/clients/${client.id}`}>{client.name}</Link> : effectiveWork.client} subtitle={`${returnPackageLabel} · ${periodLabel} · ${effectiveWork.registrationUnit}`} onClose={onClose}>{detailContent}</DetailDrawer>;
}

export function ExceptionDetail({ exception, onClose }: { exception: FixtureException; onClose: () => void }) {
  const tone = exception.kind === "Blocker" ? "blocker" : exception.kind === "RAG / Risk" ? "risk" : "exception";

  return (
    <DetailDrawer eyebrow={exception.kind} title={exception.title} subtitle={exception.client} onClose={onClose}>
      <div className="drawer-status-row"><ConceptTag tone={tone}>{exception.category}</ConceptTag><StatusLabel status={exception.severity} /></div>
      <dl className="detail-list">
        <div><dt>Affected work</dt><dd>{exception.workId}</dd></div>
        <div><dt>What is happening</dt><dd>{exception.detail}</dd></div>
        <div><dt>Timing / aging</dt><dd>{exception.aging}</dd></div>
        <div><dt>Accountable owner</dt><dd>{exception.owner}</dd></div>
      </dl>
      <div className="next-action-box"><span className="next-action-box__label">Possible next action</span><strong>{exception.nextAction}</strong></div>
      <p className="drawer-note">Blocker, RAG/Risk, and Exception remain separate control signals.</p>
    </DetailDrawer>
  );
}
