"use client";

import Link from "next/link";
import { createContext, Fragment, useContext, useEffect, useId, useRef, useState, type CSSProperties } from "react";

import { fixtureClients, type FixtureClient, type FixtureException, type FixturePaymentApplicability, type FixtureScope, type FixtureStatus, type FixtureWorkItem } from "@/lib/fixtures";
import { scopeLabelForValue, scopeOptions, scopeValueForFilter, type ScopeFilter } from "@/lib/control-tower-state";
import { currentProcessStepId } from "@/lib/workflow-rules";
import { canUseElevatedOverride, useWorkflow, workflowPerspectiveLabel, workflowProcessRoleLabel, workflowRoleLabel, type WorkflowArchiveFacts, type WorkflowDecision, type WorkflowProcessOwner, type WorkflowProcessStatus } from "@/lib/workflow-state";
import { generateWorkflowReportPdf } from "@/lib/workflow-report";
import { buildWorkflowFactsCsv, buildWorkflowProcessingLogCsv } from "@/lib/workflow-export";
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

const detailDrawerDepthContext = createContext(0);

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
  const parentDepth = useContext(detailDrawerDepthContext);
  const depth = parentDepth;
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const subtitleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousActiveElement = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      const drawers = Array.from(document.querySelectorAll<HTMLElement>("[data-detail-drawer]"));
      if (drawers[drawers.length - 1] !== drawerRef.current) return;

      if (event.key === "Escape") {
        onCloseRef.current();
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
  }, []);

  return (
    <detailDrawerDepthContext.Provider value={depth + 1}>
      <div className={`drawer-layer${depth > 0 ? " drawer-layer--stacked" : ""}`} data-drawer-depth={depth} role="presentation">
        <button aria-label="Close detail panel" className="drawer-backdrop" onClick={onClose} tabIndex={-1} type="button" />
        <div aria-describedby={subtitle ? subtitleId : undefined} aria-labelledby={titleId} aria-modal="true" className="detail-drawer" data-detail-drawer ref={drawerRef} role="dialog" style={{ "--drawer-depth": depth } as CSSProperties}>
          <div className="detail-drawer__header">
            <div>
              <p className="eyebrow">{eyebrow}</p>
              <h2 id={titleId}>{title}</h2>
              {subtitle && <p id={subtitleId}>{subtitle}</p>}
            </div>
            <button aria-label="Close detail panel" className="icon-button" onClick={onClose} ref={closeButtonRef} type="button">×</button>
          </div>
          <div className="detail-drawer__body">{children}</div>
        </div>
      </div>
    </detailDrawerDepthContext.Provider>
  );
}

/** Keep the focused evidence dialog contained and return focus to its trigger. */
export function useDialogFocus(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousActiveElement = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>(".work-evidence-dialog:last-of-type");
    if (!dialog) return;

    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex=\"-1\"])")).filter((element) => element.offsetParent !== null);
    window.setTimeout(() => (dialog.querySelector<HTMLElement>("[autofocus]") ?? focusable()[0])?.focus(), 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
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
      previousActiveElement?.focus();
    };
  }, [open]);
}

export function WorkDetail({ work, onClose = () => undefined, fullPage = false, serverAuthorized = false }: { work: FixtureWorkItem; onClose?: () => void; fullPage?: boolean; serverAuthorized?: boolean }) {
  const { canActOnProcessStep, canActOnWorkflow, currentRole, getChecklistAnswers, getEffectiveWork, getLatestProcessUpdate, getOperationalRecords, getPeriodLock, getQuestions, getRecord, getWorkItems, isWorkVisible, prototypeMode, setChecklistAnswer, setDataReadiness, setPaymentAmount, setPaymentApplicability, setProcessStatus, setWorkPerspective, submitDecision, workPerspective } = useWorkflow();
  const liveWork = prototypeMode ? undefined : getWorkItems().find((item) => item.id === work.id);
  const effectiveWork = getEffectiveWork(liveWork ?? work);
  const calendarItems = getOperationalRecords().filter((record) => record.work.id === work.id).map((record) => record.calendar);
  const primaryReturn = calendarItems.find((item) => !/QAP/i.test(item.returnLabel)) ?? calendarItems[0];
  const returnPackageLabel = primaryReturn?.returnLabel.replace(/\s*·\s*/g, " ") ?? "Work item";
  const returnFormLabel = primaryReturn?.returnLabel.replace(/^[^·]+·\s*/, "") ?? "return";
  const periodLabel = primaryReturn?.period ?? effectiveWork.period;
  const dueDateLabel = effectiveWork.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(effectiveWork.dueDate)
    ? new Intl.DateTimeFormat("en-PH", { day: "numeric", month: "long", timeZone: "Asia/Manila", year: "numeric" }).format(new Date(`${effectiveWork.dueDate}T00:00:00+08:00`))
    : "Due date unresolved";
  const hasQapSequence = calendarItems.some((item) => /QAP/i.test(item.returnLabel));
  const client = getOperationalRecords().find((record) => record.work.id === work.id)?.client ?? (prototypeMode ? fixtureClients.find((item) => item.id === effectiveWork.clientId) : undefined);
  const clientProfile = client?.entities[0]?.profile;
  const workflowRecord = getRecord(effectiveWork);
  const periodLock = getPeriodLock(effectiveWork);
  const [gateChecklistOpen, setGateChecklistOpen] = useState(false);
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState("");
  const [processFeedback, setProcessFeedback] = useState("");
  const [dataReadinessOpen, setDataReadinessOpen] = useState(false);
  const [dataReadinessSource, setDataReadinessSource] = useState<"CLIENT_RECORDS" | "TMF_BOOKS">("CLIENT_RECORDS");
  const [dataReadinessReason, setDataReadinessReason] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [pendingStatusChange, setPendingStatusChange] = useState<{ stepId: string; currentStatus: WorkflowProcessStatus } | null>(null);
  const [pendingStatusValue, setPendingStatusValue] = useState<WorkflowProcessStatus>("NOT_STARTED");
  const [pendingGateStatus, setPendingGateStatus] = useState<"DONE" | "NOT_APPLICABLE" | null>(null);
  const [taxDueAmountDraft, setTaxDueAmountDraft] = useState("");
  const [pendingProcessStatus, setPendingProcessStatus] = useState<{ stepId: string; status: "DONE" | "NOT_APPLICABLE" } | null>(null);
  const [pendingProcessEvidence, setPendingProcessEvidence] = useState("");
  const [pendingProcessDate, setPendingProcessDate] = useState("");
  const [pendingProcessAcknowledgedDate, setPendingProcessAcknowledgedDate] = useState("");
  const [pendingProcessValidatedDate, setPendingProcessValidatedDate] = useState("");
  const [pendingArchiveSharePoint, setPendingArchiveSharePoint] = useState("");
  const [pendingArchiveAmount, setPendingArchiveAmount] = useState("");
  const [pendingArchiveFacts, setPendingArchiveFacts] = useState<WorkflowArchiveFacts>({});
  const [clientPreviewOpen, setClientPreviewOpen] = useState(false);
  const [paymentAmountDraft, setPaymentAmountDraft] = useState(effectiveWork.paymentAmount === null || effectiveWork.paymentAmount === undefined ? "" : String(effectiveWork.paymentAmount));
  const [paymentAmountCorrectionOpen, setPaymentAmountCorrectionOpen] = useState(false);
  const dialogOpen = Boolean(gateChecklistOpen || pendingStatusChange || paymentAmountCorrectionOpen || dataReadinessOpen || pendingProcessStatus);
  useDialogFocus(dialogOpen, () => {
    if (gateChecklistOpen) setGateChecklistOpen(false);
    else if (pendingStatusChange) setPendingStatusChange(null);
    else if (paymentAmountCorrectionOpen) setPaymentAmountCorrectionOpen(false);
    else if (dataReadinessOpen) setDataReadinessOpen(false);
    else if (pendingProcessStatus) setPendingProcessStatus(null);
  });
  const dataBlocked = effectiveWork.blocker?.category === "CLIENT DATA";
  const stepById = new Map(effectiveWork.steps.map((step) => [step.id, step]));
  function baselineProcessStatus(state: string): WorkflowProcessStatus {
    if (state === "complete") return "DONE";
    if (state === "unresolved") return "NEEDS_ATTENTION";
    if (state === "current" || state === "waiting" || state === "blocked") return "IN_PROGRESS";
    return "NOT_STARTED";
  }
  const processStatusForStep = (step: FixtureWorkItem["steps"][number]) => effectiveWork.paymentApplicability === "NOT_APPLICABLE" && paymentProcessStepIds.has(step.id) ? "NOT_APPLICABLE" as const : dataBlocked && step.id === "prepare" ? "NOT_STARTED" as const : workflowRecord.processStatuses[step.id] ?? baselineProcessStatus(step.state);
  const normalizedProcessStatuses = Object.fromEntries(effectiveWork.steps.map((step) => [step.id, processStatusForStep(step)]));
  const normalizedCurrentProcessStepId = currentProcessStepId(effectiveWork, normalizedProcessStatuses);
  const currentProcessStep = (normalizedCurrentProcessStepId ? stepById.get(normalizedCurrentProcessStepId) : undefined) ?? effectiveWork.steps.find((step) => step.state === "current" || step.state === "unresolved" || step.state === "blocked");
  const gateStepIds: Record<"PREPARER" | "CHECKER" | "REVIEWER", string> = { PREPARER: "prepare", CHECKER: "check", REVIEWER: "review" };
  const activeGate = workflowRecord.currentGate && currentProcessStep?.id === gateStepIds[workflowRecord.currentGate] ? workflowRecord.currentGate : null;
  const role = activeGate ?? currentRole;
  const elevatedOverrideAvailable = canUseElevatedOverride(workPerspective);
  const canAct = !dataBlocked && canActOnWorkflow(role, effectiveWork);
  const processState = (stepId: string) => processStatusLabels[stepById.get(stepId) ? processStatusForStep(stepById.get(stepId)!) : "NOT_STARTED"];
  const paymentProcessIncluded = effectiveWork.paymentApplicability !== "NOT_APPLICABLE";
  const paymentApplicabilityLocked = periodLock.locked || (processStatusForStep(stepById.get("prepare") ?? effectiveWork.steps[0]) === "DONE" && effectiveWork.paymentApplicability !== "UNRESOLVED");
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
  const pendingStage = dataBlocked ? courseStages.find((stage) => stage.id === "data") : currentProcessStep ? courseStages.find((stage) => stage.stepId === currentProcessStep.id) : undefined;
  const pendingOwner = activeGate ?? pendingStage?.owner;
  const paymentConfirmationStatus = processStatusForStep(stepById.get("payment-confirmation") ?? effectiveWork.steps[effectiveWork.steps.length - 1]);
  const paymentAmountPending = effectiveWork.paymentApplicability === "REQUIRED" && !paymentAmountRecorded && (paymentConfirmationStatus === "IN_PROGRESS" || paymentConfirmationStatus === "NEEDS_ATTENTION");
  const pendingTask = paymentAmountPending ? "Record amount to pay" : pendingStage?.label ?? (pendingOwner ? "Complete the assigned gate" : undefined);
  const pendingAssignee = pendingOwner === "PREPARER" ? client?.assignment.preparer : pendingOwner === "CHECKER" ? client?.assignment.checker : pendingOwner === "REVIEWER" ? client?.assignment.reviewer : undefined;
  const visibleProcessBundles = processBundles.filter((bundle) => bundle !== "Payment" || effectiveWork.paymentApplicability !== "NOT_APPLICABLE");
  const visibleJourneyStages = visibleProcessBundles.flatMap((bundle) => courseStages.filter((stage) => stage.bundle === bundle));
  const activeViewStep = effectiveWork.steps.find((step) => {
    const status = processStatusForStep(step);
    return status === "IN_PROGRESS" || status === "NEEDS_ATTENTION";
  });
  const activeBundle = activeViewStep ? processBundleForStep[activeViewStep.id] : undefined;
  const [collapsedBundles, setCollapsedBundles] = useState<Record<string, boolean>>(() => Object.fromEntries(visibleProcessBundles.filter((bundle) => bundle !== activeBundle).map((bundle) => [bundle, true])));
  const journeyView = "table" as const;
  const statusOptions: WorkflowProcessStatus[] = ["NOT_STARTED", "IN_PROGRESS", "NEEDS_ATTENTION", "DONE", "NOT_APPLICABLE"];
  const answers = getChecklistAnswers(effectiveWork, role);
  const roleRows = client ? [
    { code: "P", label: "Preparer", person: client.assignment.preparer },
    { code: "C", label: "Checker", person: client.assignment.checker },
    { code: "R", label: "Reviewer", person: client.assignment.reviewer },
  ] : [];
  const activityEvents = [...workflowRecord.processHistory.map((event) => ({ id: event.id, label: `${processBundleForStep[event.stepId] ?? "Process"} · ${processStatusLabels[event.status]}`, detail: `${event.actor} · ${event.recordedAt}` })), ...workflowRecord.checklistHistory.map((event) => ({ id: event.id, label: `${workflowRoleLabel(event.role)} checklist`, detail: `${event.completed ? "Completed" : "Reopened"} · ${event.actor} · ${event.recordedAt}` })), ...workflowRecord.attempts.map((event) => ({ id: event.id, label: `${workflowRoleLabel(event.role)} · ${event.decision === "RETURN" ? "Returned for correction" : event.decision === "CERTIFY" ? "Certified" : "Approved"}`, detail: `${event.actor} · ${event.recordedAt}` })), ...workflowRecord.periodLockHistory.map((event, index) => ({ id: `period-lock-${index}-${event.recordedAt}`, label: event.locked ? "Accounting period closed" : "Historical lock event", detail: `${event.actor} · ${event.recordedAt}` })), ...workflowRecord.changeHistory.map((event) => ({ id: event.id, label: event.detail, detail: `${event.actor} · ${event.recordedAt}` }))].reverse().slice(0, 12);
  const latestEvidenceForStep = (stepId: string) => [...workflowRecord.processHistory].reverse().find((event) => event.stepId === stepId && event.evidenceReference);
  function archiveFactsFromHistory(): WorkflowArchiveFacts {
    const fact = (stepId: string) => latestEvidenceForStep(stepId);
    const paymentNotApplicable = effectiveWork.paymentApplicability === "NOT_APPLICABLE";
    return {
      ...workflowRecord.archiveFacts,
      filingDate: workflowRecord.archiveFacts?.filingDate ?? fact("filing")?.completedOn ?? "",
      filingReferenceNumber: workflowRecord.archiveFacts?.filingReferenceNumber ?? fact("filing")?.evidenceReference ?? "",
      proceedToPay: workflowRecord.archiveFacts?.proceedToPay ?? (paymentNotApplicable ? "Not applicable" : fact("payment-client-approval")?.evidenceReference ?? fact("payment")?.evidenceReference ?? ""),
      paymentAcknowledgementDate: workflowRecord.archiveFacts?.paymentAcknowledgementDate ?? (paymentNotApplicable ? "Not applicable" : fact("payment-confirmation")?.completedOn ?? ""),
      paymentAcknowledgement: workflowRecord.archiveFacts?.paymentAcknowledgement ?? (paymentNotApplicable ? "Not applicable" : fact("payment-confirmation")?.evidenceReference ?? ""),
      eSubmissionSubmission: workflowRecord.archiveFacts?.eSubmissionSubmission ?? fact("esubmission")?.evidenceReference ?? "",
      eSubmissionSubmissionDate: workflowRecord.archiveFacts?.eSubmissionSubmissionDate ?? fact("esubmission")?.completedOn ?? "",
      birAcknowledgedDate: workflowRecord.archiveFacts?.birAcknowledgedDate ?? fact("esubmission")?.acknowledgedOn ?? "",
      birValidatedDate: workflowRecord.archiveFacts?.birValidatedDate ?? fact("esubmission")?.validatedOn ?? "",
      attachmentName: workflowRecord.archiveFacts?.attachmentName ?? fact("evidence")?.attachmentName ?? "",
    };
  }
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
  const packageCompletedCount = packageStageStatuses.filter((status) => status === "DONE" || status === "NOT_APPLICABLE").length;
  const archiveComplete = processStatusForStep(stepById.get("evidence") ?? effectiveWork.steps[effectiveWork.steps.length - 1]) === "DONE";

  async function downloadJourneyReport() {
    const reportStages = courseStages.map((stage) => {
      const step = stage.stepId ? stepById.get(stage.stepId) : undefined;
      const status = step ? processStatusForStep(step) : stage.id === "data" && processStatusForStep(stepById.get("prepare") ?? effectiveWork.steps[0]) === "DONE" ? "DONE" as const : undefined;
      const update = step ? getLatestProcessUpdate(effectiveWork, step.id) : undefined;
      const evidence = step ? latestEvidenceForStep(step.id) : undefined;
      const archiveFacts = workflowRecord.archiveFacts;
      const archiveFact = stage.stepId === "filing" ? archiveFacts?.filingReferenceNumber : stage.stepId === "payment-client-approval" ? archiveFacts?.proceedToPay : stage.stepId === "payment-confirmation" ? archiveFacts?.paymentAcknowledgement : stage.stepId === "esubmission" ? archiveFacts?.eSubmissionSubmission : undefined;
      return {
        bundle: stage.bundle,
        label: stage.label,
        owner: workflowProcessRoleLabel(stage.owner),
        stepId: stage.stepId,
        status: status ? processStatusLabels[status] : stage.state,
        evidenceReference: archiveFact ?? evidence?.evidenceReference ?? update?.evidenceReference,
        completedOn: (stage.stepId === "filing" ? archiveFacts?.filingDate : stage.stepId === "payment-confirmation" ? archiveFacts?.paymentAcknowledgementDate : stage.stepId === "esubmission" ? archiveFacts?.eSubmissionSubmissionDate : undefined) ?? evidence?.completedOn ?? update?.completedOn,
        acknowledgedOn: (stage.stepId === "esubmission" ? archiveFacts?.birAcknowledgedDate : undefined) ?? evidence?.acknowledgedOn ?? update?.acknowledgedOn,
        validatedOn: (stage.stepId === "esubmission" ? archiveFacts?.birValidatedDate : undefined) ?? evidence?.validatedOn ?? update?.validatedOn,
        attachmentName: (stage.stepId === "evidence" ? archiveFacts?.attachmentName : undefined) ?? evidence?.attachmentName ?? update?.attachmentName,
        recordedBy: evidence?.actor ?? update?.actor,
        recordedAt: evidence?.recordedAt ?? update?.recordedAt,
      };
    });
    const pdfBytes = await generateWorkflowReportPdf({
      work: effectiveWork,
      record: workflowRecord,
      clientName: client?.name ?? effectiveWork.client,
      tinLabel: clientProfile?.tinDisplay ?? "TIN not recorded",
      rdoLabel: clientProfile?.rdoOrLts ?? "RDO / LTS not recorded",
      returnLabel: returnPackageLabel,
      periodLabel,
      dueDateLabel,
      stages: reportStages,
      roles: roleRows.map((row) => ({ label: row.label, person: row.person })),
      paymentAmountLabel: paymentAmountRecorded ? paymentAmountLabel : null,
    });
    const url = URL.createObjectURL(new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `taxmonweb-return-journey-${effectiveWork.id}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function downloadCsv(filename: string, content: string) {
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportWorkflowData(kind: "facts" | "processing") {
    const returns = [{ work: effectiveWork, record: workflowRecord }];
    const filename = kind === "facts" ? `taxmonweb-${effectiveWork.id}-filing-facts.csv` : `taxmonweb-${effectiveWork.id}-processing-log.csv`;
    const content = kind === "facts" ? buildWorkflowFactsCsv(returns) : buildWorkflowProcessingLogCsv(returns);
    downloadCsv(filename, content);
  }

  const questions = getQuestions(role);
  const isCurrentGate = activeGate === role;
  const allQuestionsAnswered = questions.every((question) => answers[question.id]);
  const taxDueAmountValid = role !== "CHECKER" || (taxDueAmountDraft.trim() !== "" && Number.isFinite(Number(taxDueAmountDraft)) && Number(taxDueAmountDraft) >= 0);
  const preparerAmountValid = role !== "PREPARER" || effectiveWork.paymentApplicability !== "REQUIRED" || paymentAmountRecorded || (paymentAmountDraft.trim() !== "" && Number.isFinite(Number(paymentAmountDraft)) && Number(paymentAmountDraft) >= 0);

  if (!serverAuthorized && !isWorkVisible(work)) {
    return <section aria-labelledby="work-access-title" className="persona-access-state"><p className="eyebrow">Work access</p><h1 id="work-access-title">This work item is outside your assigned view</h1><p>Open work assigned to you or within your authorized reporting scope.</p><Link className="button button--quiet" href="/app/work">Back to Work</Link></section>;
  }

  async function recordDecision(decision: WorkflowDecision) {
    const taxDueAmount = taxDueAmountDraft.trim() === "" ? null : Number(taxDueAmountDraft);
    const preparerPaymentAmount = role === "PREPARER" && effectiveWork.paymentApplicability === "REQUIRED" && !paymentAmountRecorded ? Number(paymentAmountDraft) : effectiveWork.paymentAmount ?? null;
    if (role === "PREPARER" && decision !== "RETURN" && effectiveWork.paymentApplicability === "REQUIRED" && !paymentAmountRecorded) {
      const amountResult = await setPaymentAmount(effectiveWork, preparerPaymentAmount);
      if (!amountResult.ok) {
        setFeedback(amountResult.error ?? "The amount to pay could not be recorded.");
        return amountResult;
      }
    }
    const result = await submitDecision(effectiveWork, role, decision, answers, note, overrideReason, pendingGateStatus ?? "DONE", taxDueAmount, decision === "RETURN" ? null : preparerPaymentAmount);
    if (!result.ok) {
      setFeedback(result.error ?? "The decision could not be recorded.");
      return result;
    }
    setFeedback(`${decision === "RETURN" ? "Returned for correction" : role === "PREPARER" ? "Preparer certification recorded" : `${workflowRoleLabel(role)} approval recorded`} · ${effectiveWork.client} · ${effectiveWork.period}`);
    setNote("");
    setOverrideReason("");
    setTaxDueAmountDraft("");
    setPendingGateStatus(null);
    setGateChecklistOpen(false);
    return result;
  }

  async function updateChecklist(questionId: string, completed: boolean) {
    const result = await setChecklistAnswer(effectiveWork, role, questionId, completed);
    if (!result.ok) setFeedback(result.error ?? "The checklist item could not be saved.");
  }

  async function updateProcessStep(stepId: string, status: WorkflowProcessStatus, evidenceReference = "", sharepointUrl = "", completedOn = "", acknowledgedOn = "", validatedOn = "", attachmentName = "", archiveFacts?: WorkflowArchiveFacts, paymentAmountOverride?: number | null) {
    const result = await setProcessStatus(effectiveWork, stepId, status, evidenceReference, overrideReason, sharepointUrl, completedOn, acknowledgedOn, validatedOn, attachmentName, archiveFacts, paymentAmountOverride);
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
    if (gateProcessStepIds.has(stepId) && (status === "DONE" || status === "NOT_APPLICABLE")) {
      setPendingGateStatus(status);
      setFeedback("");
      setGateChecklistOpen(true);
      return;
    }
    if (status === "DONE" || status === "NOT_APPLICABLE") {
      setPendingProcessStatus({ stepId, status });
      setPendingProcessEvidence("");
      setPendingProcessDate("");
      setPendingProcessAcknowledgedDate("");
      setPendingProcessValidatedDate("");
      setPendingArchiveSharePoint("");
      setPendingArchiveAmount(paymentAmountRecorded ? String(effectiveWork.paymentAmount) : "");
      setPendingArchiveFacts(archiveFactsFromHistory());
      setProcessFeedback("");
      return;
    }
    updateProcessStep(stepId, status);
  }

  function openStatusDialog(stepId: string, currentStatus: WorkflowProcessStatus) {
    if (stepId === "payment-confirmation" && effectiveWork.paymentApplicability === "REQUIRED" && !paymentAmountRecorded) {
      setPaymentAmountDraft("");
      setProcessFeedback("");
      setPaymentAmountCorrectionOpen(true);
      return;
    }
    if (gateProcessStepIds.has(stepId)) {
      setPendingGateStatus(null);
      setFeedback("");
      setGateChecklistOpen(true);
      return;
    }
    setPendingStatusChange({ stepId, currentStatus });
    setPendingStatusValue(currentStatus);
    setProcessFeedback("");
  }

  async function savePaymentAmountCorrection() {
    const amount = Number(paymentAmountDraft);
    if (paymentAmountDraft.trim() === "" || !Number.isFinite(amount) || amount < 0) {
      setProcessFeedback("Enter a valid non-negative amount before continuing.");
      return;
    }
    const result = await setPaymentAmount(effectiveWork, amount);
    if (!result.ok) {
      setProcessFeedback(result.error ?? "The amount to pay could not be recorded.");
      return;
    }
    setPaymentAmountCorrectionOpen(false);
    setProcessFeedback("Amount recorded. Confirm payment to continue.");
  }

  function confirmStatusChange() {
    if (!pendingStatusChange || pendingStatusValue === pendingStatusChange.currentStatus) return;
    const { stepId } = pendingStatusChange;
    setPendingStatusChange(null);
    requestProcessStatus(stepId, pendingStatusValue);
  }

  async function confirmPendingProcessStatus() {
    if (!pendingProcessStatus) return;
    if (pendingProcessStatus.stepId === "payment-confirmation" && pendingProcessStatus.status === "DONE" && effectiveWork.paymentApplicability !== "NOT_APPLICABLE" && !paymentAmountRecorded) {
      setPendingProcessStatus(null);
      setPaymentAmountDraft("");
      setProcessFeedback("");
      setPaymentAmountCorrectionOpen(true);
      return;
    }
    const isArchiving = pendingProcessStatus.stepId === "evidence" && pendingProcessStatus.status === "DONE";
    const isESubmission = pendingProcessStatus.stepId === "esubmission" && pendingProcessStatus.status === "DONE";
    const requiresActualDate = ["filing", "payment-confirmation", "esubmission"].includes(pendingProcessStatus.stepId) && pendingProcessStatus.status === "DONE";
    const evidenceReference = isArchiving ? "Return package archived" : pendingProcessEvidence.trim();
    if (!evidenceReference || (requiresActualDate && !pendingProcessDate)) return;
    if (isArchiving) {
      const paymentRequired = effectiveWork.paymentApplicability === "REQUIRED";
      const amount = paymentRequired && !paymentAmountRecorded ? Number(pendingArchiveAmount) : effectiveWork.paymentAmount ?? null;
      const validAmount = !paymentRequired || (Number.isFinite(amount) && amount !== null && amount >= 0);
      const missingFacts = [pendingArchiveFacts.filingDate, pendingArchiveFacts.filingReferenceNumber].some((value) => !value?.trim());
      const missingPaymentFacts = paymentRequired && [pendingArchiveFacts.proceedToPay, pendingArchiveFacts.paymentAcknowledgementDate, pendingArchiveFacts.paymentAcknowledgement].some((value) => !value?.trim());
      if (!validAmount || missingFacts || missingPaymentFacts) {
        setProcessFeedback("Complete the filing and payment facts before archiving.");
        return;
      }
      if (paymentRequired && !paymentAmountRecorded) {
        const amountResult = await setPaymentAmount(effectiveWork, amount);
        if (!amountResult.ok) {
          setProcessFeedback(amountResult.error ?? "The amount to pay could not be recorded.");
          return;
        }
      }
      const result = await updateProcessStep(pendingProcessStatus.stepId, pendingProcessStatus.status, evidenceReference, pendingArchiveSharePoint.trim(), "", "", "", "", pendingArchiveFacts, paymentRequired ? amount : undefined);
      if (result.ok) {
        setPendingProcessStatus(null);
        setPendingArchiveFacts({});
      }
      return;
    }
    if (isESubmission && (!pendingProcessAcknowledgedDate || !pendingProcessValidatedDate)) {
      setProcessFeedback("Record the BIR acknowledgment and validation dates before completing eSubmission.");
      return;
    }
    const result = await updateProcessStep(pendingProcessStatus.stepId, pendingProcessStatus.status, evidenceReference, isArchiving ? pendingArchiveSharePoint.trim() : "", pendingProcessDate, isESubmission ? pendingProcessAcknowledgedDate : "", isESubmission ? pendingProcessValidatedDate : "", "");
    if (result.ok) {
      setPendingProcessStatus(null);
      setPendingProcessEvidence("");
      setPendingProcessDate("");
      setPendingProcessAcknowledgedDate("");
      setPendingProcessValidatedDate("");
      setPendingArchiveSharePoint("");
    }
  }

  async function savePaymentApplicability(value: FixturePaymentApplicability) {
    const result = await setPaymentApplicability(effectiveWork, value);
    setProcessFeedback(result.ok ? "Saved · payment applicability recorded." : result.error ?? "Payment applicability could not be saved.");
  }

  async function confirmDataReadiness() {
    const result = await setDataReadiness(effectiveWork, true, dataReadinessSource, dataReadinessReason);
    if (!result.ok) {
      setProcessFeedback(result.error ?? "Data readiness could not be recorded.");
      return;
    }
    setDataReadinessOpen(false);
    setDataReadinessReason("");
    setProcessFeedback("Data readiness recorded. Preparation is now available.");
  }

  function renderGateChecklist() {
    if (!activeGate) return;
    const gateTitle = activeGate === "PREPARER" ? "Preparer to draft return" : `${workflowRoleLabel(activeGate)} certification`;
    const gateStatusLabel = processStatusLabels[pendingGateStatus ?? "DONE"];
    return <>
      <section className="workflow-final-control-launcher" aria-labelledby="workflow-gate-launcher-title">
        <div><p className="eyebrow">Pending certification</p><strong id="workflow-gate-launcher-title">{gateTitle}</strong><small>Open the gate to record required control facts before continuing.</small></div>
        <button className="button button--primary button--small" onClick={() => { setFeedback(""); setGateChecklistOpen(true); }} type="button">Open gate</button>
      </section>
      {gateChecklistOpen && <div className="work-evidence-dialog-layer" role="presentation"><section aria-labelledby="workflow-gate-title" aria-modal="true" className="work-evidence-dialog workflow-gate-dialog" onKeyDown={(event) => { if (event.key === "Escape") setGateChecklistOpen(false); }} role="dialog"><div className="work-evidence-dialog__header"><div><p className="eyebrow">Certification checklist</p><h2 id="workflow-gate-title">{gateTitle}</h2><p>Complete the checks, then certify the selected status. Each change is saved with the acting persona and time.</p></div><button aria-label="Close certification checklist" autoFocus className="icon-button" onClick={() => setGateChecklistOpen(false)} type="button">×</button></div>
        <p className="workflow-gate-panel__state">Waiting for {workflowRoleLabel(activeGate)}</p>
        <p className="workflow-gate-panel__hint">Selected outcome: {gateStatusLabel}. {workPerspective === "MASTER_ADMIN" ? `HOD preview · acting for ${workflowRoleLabel(role)}.` : `Acting view: ${workflowPerspectiveLabel(workPerspective)}.`}</p>
        {!canAct && <div className="workflow-gate-panel__warning"><span>View only. This checklist belongs to the {workflowRoleLabel(activeGate)}.</span><button className="button button--quiet button--small" onClick={() => { setWorkPerspective(activeGate); }} type="button">Switch to {workflowRoleLabel(activeGate)} view</button></div>}
        <div className="workflow-question-list">{questions.map((question) => { const latestChecklistUpdate = [...workflowRecord.checklistHistory].reverse().find((update) => update.role === role && update.questionId === question.id); return <label className={`workflow-question${answers[question.id] ? " workflow-question--checked" : ""}`} key={question.id}><input aria-label={question.label} checked={Boolean(answers[question.id])} disabled={periodLock.locked || !canAct || !isCurrentGate} onChange={(event) => updateChecklist(question.id, event.target.checked)} type="checkbox" /><span>{question.label}</span><small>{answers[question.id] ? `Done${latestChecklistUpdate ? ` · ${latestChecklistUpdate.actor}` : ""}` : "Open"}</small></label>; })}</div>
        {role === "PREPARER" && effectiveWork.paymentApplicability === "REQUIRED" && <label className="workflow-note-field"><span>Amount to pay</span>{paymentAmountRecorded ? <strong aria-label={`Payment amount ${paymentAmountLabel}`} className="work-course-map__amount-readonly">{paymentAmountLabel}</strong> : <input aria-describedby="workflow-payment-amount-help" aria-label="Amount to pay" disabled={periodLock.locked || !canAct || !isCurrentGate} inputMode="decimal" min="0" onChange={(event) => setPaymentAmountDraft(event.target.value)} step="0.01" type="number" value={paymentAmountDraft} /> }<small id="workflow-payment-amount-help">Record the amount from the drafted return. Do not calculate it here.</small></label>}
        {role === "CHECKER" && <label className="workflow-note-field"><span>Tax due amount</span><input aria-describedby="workflow-tax-due-help" aria-label="Tax due amount" disabled={periodLock.locked || !canAct || !isCurrentGate} inputMode="decimal" min="0" onChange={(event) => setTaxDueAmountDraft(event.target.value)} step="0.01" type="number" value={taxDueAmountDraft} /><small id="workflow-tax-due-help">Record the amount from the approved return or working papers. Do not calculate it here.</small></label>}
        <label className="workflow-note-field"><span>Decision note</span><textarea disabled={periodLock.locked} onChange={(event) => setNote(event.target.value)} placeholder="What did you check, or what needs correction?" value={note} /></label>
        {feedback && <p className="workflow-gate-panel__feedback" role="status">{feedback}</p>}
        <div className="workflow-gate-actions"><button className="button button--primary" disabled={periodLock.locked || !canAct || !isCurrentGate || !allQuestionsAnswered || !taxDueAmountValid || !preparerAmountValid || !note.trim()} onClick={() => { void recordDecision(role === "PREPARER" ? "CERTIFY" : "APPROVE"); }} type="button">Certify as {gateStatusLabel}</button><button className="button button--quiet" disabled={periodLock.locked || !canAct || !isCurrentGate || !note.trim()} onClick={() => { void recordDecision("RETURN"); }} type="button">Return for correction</button></div>
        {workflowRecord.attempts.length > 0 && <div className="workflow-attempt-history"><span className="eyebrow">Decision history</span>{workflowRecord.attempts.map((attempt) => <div className="workflow-attempt" key={attempt.id}><strong>{workflowRoleLabel(attempt.role)} · {attempt.decision === "RETURN" ? "Returned for correction" : attempt.role === "PREPARER" ? "Certified" : "Approved"}</strong><small>{attempt.recordedAt} · {attempt.note}{attempt.taxDueAmount !== undefined ? ` · Tax due: ${new Intl.NumberFormat("en-PH", { currency: "PHP", maximumFractionDigits: 2, style: "currency" }).format(attempt.taxDueAmount)}` : ""}</small></div>)}</div>}
      </section></div>}
    </>;
  }

  const detailContent = (
    <div className="work-detail-content">
      {pendingStatusChange && <div className="work-evidence-dialog-layer" role="presentation"><section aria-labelledby="work-status-dialog-title" aria-modal="true" className="work-evidence-dialog" onKeyDown={(event) => { if (event.key === "Escape") setPendingStatusChange(null); }} role="dialog"><div className="work-evidence-dialog__header"><div><p className="eyebrow">Change status</p><h2 id="work-status-dialog-title">Update process status</h2><p>{courseStages.find((stage) => stage.stepId === pendingStatusChange.stepId)?.label ?? "Process step"}</p></div><button aria-label="Close status dialog" className="icon-button" onClick={() => setPendingStatusChange(null)} type="button">×</button></div><label className="work-evidence-dialog__field"><span>Status</span><select autoFocus aria-label="Process status" onChange={(event) => setPendingStatusValue(event.target.value as WorkflowProcessStatus)} value={pendingStatusValue}>{statusOptions.map((option) => <option key={option} value={option}>{processStatusLabels[option]}</option>)}</select></label><div className="work-evidence-dialog__actions"><button className="button button--quiet" onClick={() => setPendingStatusChange(null)} type="button">Cancel</button><button className="button button--primary" disabled={pendingStatusValue === pendingStatusChange.currentStatus || periodLock.locked} onClick={confirmStatusChange} type="button">Continue</button></div></section></div>}
      {paymentAmountCorrectionOpen && <div className="work-evidence-dialog-layer" role="presentation"><section aria-labelledby="payment-amount-correction-title" aria-modal="true" className="work-evidence-dialog" onKeyDown={(event) => { if (event.key === "Escape") setPaymentAmountCorrectionOpen(false); }} role="dialog"><div className="work-evidence-dialog__header"><div><p className="eyebrow">Preparer correction</p><h2 id="payment-amount-correction-title">Record amount to pay</h2><p>Payment confirmation is waiting for the amount captured from the drafted return.</p></div><button aria-label="Close payment amount correction" className="icon-button" onClick={() => setPaymentAmountCorrectionOpen(false)} type="button">×</button></div><label className="work-evidence-dialog__field"><span>Amount to pay</span><input autoFocus aria-label="Amount to pay" inputMode="decimal" min="0" onChange={(event) => setPaymentAmountDraft(event.target.value)} step="0.01" type="number" value={paymentAmountDraft} /><small>Enter the amount from the Preparer’s drafted return. Do not calculate it here.</small></label>{processFeedback && <p className="work-process-feedback" role="alert">{processFeedback}</p>}<div className="work-evidence-dialog__actions"><button className="button button--quiet" onClick={() => setPaymentAmountCorrectionOpen(false)} type="button">Cancel</button><button className="button button--primary" disabled={periodLock.locked} onClick={() => void savePaymentAmountCorrection()} type="button">Save amount</button></div></section></div>}
      <section aria-label="Return status" className="work-package-timeline" tabIndex={0}>
        <div className="work-package-timeline__summary"><div><p className="eyebrow">Return status</p><h2>{packageCurrentIndex === -1 ? "Return complete" : `Currently in ${packageStages[packageCurrentIndex].label}`}</h2></div><span>{packageCompletedCount} of {packageStages.length} stages complete</span></div>
        {pendingOwner && pendingTask && <div className="work-package-timeline__handoff"><span className="work-package-timeline__handoff-label">Next handoff</span><strong>Waiting for {workflowProcessRoleLabel(pendingOwner)}</strong>{pendingAssignee && <span className="work-package-timeline__handoff-person">{pendingAssignee}</span>}<em>{pendingTask}</em></div>}
        <ol aria-label="Return journey status">
          {packageStages.map((stage, index) => { const status = packageStageStatuses[index]; const state = status === "DONE" ? "complete" : status === "NOT_APPLICABLE" ? "not-applicable" : status === "NEEDS_ATTENTION" ? "attention" : index === packageCurrentIndex ? "current" : "open"; return <li className={`work-package-timeline__item work-package-timeline__item--${state}`} key={stage.id}><span className="work-package-timeline__marker" aria-hidden="true">{status === "DONE" ? "✓" : status === "NOT_APPLICABLE" ? "—" : index + 1}</span><div><strong>{stage.label}</strong><small>{processStatusLabels[status]}</small></div></li>; })}
        </ol>
      </section>
      <section aria-label="Tax filing journey details" className="work-course-map">
        {journeyView === "table" ? <div className="work-journey-table-wrap"><table className="work-journey-table"><caption className="sr-only">Return journey worksteps and current status</caption><thead><tr><th scope="col">Step</th><th scope="col">Status</th></tr></thead><tbody>
          {visibleProcessBundles.map((bundle) => {
            const bundleStages = courseStages.filter((stage) => stage.bundle === bundle);
            const bundleNotApplicable = bundle === "Payment" && effectiveWork.paymentApplicability === "NOT_APPLICABLE";
            return <Fragment key={bundle}><tr className="work-journey-table__bundle"><th colSpan={2} scope="rowgroup"><span>{bundle}</span>{bundle === "Payment" ? <small>{paymentAmountRecorded ? `Amount to pay · ${paymentAmountLabel}` : "Amount to pay · Not recorded"}</small> : bundleNotApplicable && <small>Not applicable</small>}</th></tr>{bundleStages.map((stage) => {
              const step = stage.stepId ? stepById.get(stage.stepId) : undefined;
              const processStatus = step ? processStatusForStep(step) : undefined;
              const isCurrentStep = Boolean(step && currentProcessStep?.id === step.id);
              const canEditStatus = Boolean(!periodLock.locked && !dataBlocked && step && processStatus && canActOnProcessStep(step.id, effectiveWork) && isCurrentStep);
              const isCurrentGateStep = Boolean(step && gateProcessStepIds.has(step.id) && activeGate === stage.owner && canActOnProcessStep(step.id, effectiveWork));
              const gateActionLabel = stage.id === "prepare" ? "Complete preparation" : stage.id === "check" ? "Complete checking" : "Complete review";
              const dataComplete = stage.id === "data" && processStatusForStep(stepById.get("prepare") ?? effectiveWork.steps[0]) === "DONE";
              const visibleStageNumber = visibleJourneyStages.findIndex((candidate) => candidate.id === stage.id) + 1;
              const statusClass = (processStatus ?? "NOT_STARTED").toLowerCase().replaceAll("_", "-");
              return <tr className={`work-journey-table__row${isCurrentStep ? " work-journey-table__row--current" : ""}`} key={stage.id}><th scope="row"><div className="work-journey-table__step"><span className="work-journey-table__number" aria-hidden="true">{visibleStageNumber}</span><div><span>{stage.label}</span></div></div></th><td><div className="work-journey-table__status-stack">{processStatus ? <>{isCurrentGateStep ? <button aria-label={gateActionLabel} className="button button--primary button--small" onClick={() => setGateChecklistOpen(true)} type="button">{gateActionLabel}</button> : canEditStatus ? <button aria-label={`Change ${stage.label} status`} className={`work-journey-table__status work-journey-table__status-button work-journey-table__status--${statusClass}`} onClick={() => openStatusDialog(step!.id, processStatus)} title="Change status" type="button">{processStatusLabels[processStatus]}</button> : <span aria-label={`${stage.label} status`} className={`work-journey-table__status work-journey-table__status--${statusClass}`}>{processStatusLabels[processStatus]}</span>}</> : dataBlocked && stage.id === "data" && canActOnProcessStep("prepare", effectiveWork) ? <button className="button button--primary button--small" onClick={() => setDataReadinessOpen(true)} type="button">Confirm data ready</button> : dataComplete ? <span aria-label="Get data status" className="work-journey-table__status work-journey-table__status--done">Complete</span> : <span className="work-journey-table__status work-journey-table__status--ready">{stage.state}</span>}</div></td></tr>;
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
            const isCurrentGateStep = isCurrentStep && isGateStep && activeGate === stage.owner;
            const canCompleteHere = Boolean(!periodLock.locked && step && isCurrentStep && !isGateStep && canActOnProcessStep(step.id, effectiveWork));
            const canEditStatus = Boolean(!periodLock.locked && step && processStatus && canActOnProcessStep(step.id, effectiveWork) && isCurrentStep);
            const processNumber = courseStages.slice(0, stageIndex + 1).filter((candidate) => candidate.stepId).length;
            const stageClassName = [`work-course-map__stage--${stage.state.toLowerCase().replaceAll(" ", "-")}`, isCurrentStep ? "work-course-map__stage--current-step" : ""].filter(Boolean).join(" ");
            return <div className={`work-course-map__stage-wrap${isCurrentGateStep ? " work-course-map__stage-wrap--active" : ""}`} key={stage.id}>
              <div className={`work-course-map__stage ${stageClassName}`}>
              <span className="work-course-map__marker" aria-hidden="true">{stage.id === "data" ? "P" : processStatus === "DONE" ? "✓" : processNumber}</span>
              <div className="work-course-map__body"><span className="work-course-map__responsibility">{workflowProcessRoleLabel(stage.owner)}</span><div className="work-course-map__stage-title"><strong>{stage.label}</strong><details className="work-stage-help"><summary aria-label={`Show help for ${stage.label}`}>i</summary><p>{stage.detail}</p></details></div>{stage.id === "prepare" && <div className={`work-course-map__amount-field work-course-map__draft-result${paymentAmountRecorded ? " work-course-map__draft-result--recorded" : ""}`}><span className="work-course-map__field-label">Draft result</span><label><span>Payment</span><select aria-label="Payment applicability" disabled={paymentApplicabilityLocked} onChange={(event) => void savePaymentApplicability(event.target.value as FixturePaymentApplicability)} value={effectiveWork.paymentApplicability}><option value="UNRESOLVED">Resolve applicability</option><option value="REQUIRED">Payment required</option><option value="NOT_APPLICABLE">No payment — skip payment phase</option></select></label>{paymentProcessIncluded && <><span>Amount to pay</span>{paymentAmountRecorded ? <strong aria-label={`Payment amount ${paymentAmountLabel}`} className="work-course-map__amount-readonly">{paymentAmountLabel}</strong> : <small>Captured during Preparer certification.</small>}</>}</div>}</div>
              {!step && <div className="work-step__action">{stage.id === "data" && dataBlocked && canActOnProcessStep("prepare", effectiveWork) ? <button className="button button--primary button--small" onClick={() => setDataReadinessOpen(true)} type="button">Confirm data ready</button> : <span className="work-course-map__state">{stage.state}</span>}</div>}
              <div className="work-step__action">
                {step && processStatus && (canEditStatus ? <label className="work-course-map__status-control"><span className="sr-only">{stage.label} status</span><select aria-label={`${stage.label} status`} onChange={(event) => requestProcessStatus(step.id, event.target.value as WorkflowProcessStatus)} value={processStatus}>{statusOptions.map((option) => <option key={option} value={option}>{processStatusLabels[option]}</option>)}</select></label> : <span aria-label={`${stage.label} status`} className={`work-course-map__status-pill work-course-map__status-pill--${processStatus.toLowerCase().replaceAll("_", "-")}`}>{processStatusLabels[processStatus]}</span>)}
                {!isCurrentGateStep && !canCompleteHere && latestProcessUpdate && <small>Recorded by {latestProcessUpdate.actor} · {latestProcessUpdate.recordedAt}</small>}
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
      {dataReadinessOpen && <div className="work-evidence-dialog-layer" role="presentation"><section aria-labelledby="data-readiness-title" aria-modal="true" className="work-evidence-dialog" onKeyDown={(event) => { if (event.key === "Escape") setDataReadinessOpen(false); }} role="dialog"><div className="work-evidence-dialog__header"><div><p className="eyebrow">Data readiness</p><h2 id="data-readiness-title">Confirm source data</h2><p>Record the basis for making Preparation available.</p></div><button aria-label="Close data readiness dialog" autoFocus className="icon-button" onClick={() => setDataReadinessOpen(false)} type="button">×</button></div><label className="work-evidence-dialog__field"><span>Source</span><select onChange={(event) => setDataReadinessSource(event.target.value as "CLIENT_RECORDS" | "TMF_BOOKS")} value={dataReadinessSource}><option value="CLIENT_RECORDS">Client-provided records</option><option value="TMF_BOOKS">TMF-maintained accounting/books</option></select></label><label className="work-evidence-dialog__field"><span>Note</span><textarea onChange={(event) => setDataReadinessReason(event.target.value)} placeholder="What was received or confirmed?" value={dataReadinessReason} /></label><div className="work-evidence-dialog__actions"><button className="button button--quiet" onClick={() => setDataReadinessOpen(false)} type="button">Cancel</button><button className="button button--primary" disabled={!dataReadinessReason.trim()} onClick={() => void confirmDataReadiness()} type="button">Confirm ready</button></div></section></div>}
      {pendingProcessStatus && <div className="work-evidence-dialog-layer" role="presentation"><section aria-labelledby="work-evidence-dialog-title" aria-modal="true" className="work-evidence-dialog" onKeyDown={(event) => { if (event.key === "Escape") setPendingProcessStatus(null); }} role="dialog"><div className="work-evidence-dialog__header"><div><p className="eyebrow">{pendingProcessStatus.stepId === "evidence" && pendingProcessStatus.status === "DONE" ? "Archive record" : "Required before saving"}</p><h2 id="work-evidence-dialog-title">{pendingProcessStatus.stepId === "evidence" && pendingProcessStatus.status === "DONE" ? "Archive return package" : pendingProcessStatus.status === "DONE" ? "Record result / evidence" : "Record why this is not applicable"}</h2><p>{courseStages.find((stage) => stage.stepId === pendingProcessStatus.stepId)?.label ?? "Process step"}</p></div><button aria-label="Close evidence dialog" className="icon-button" onClick={() => setPendingProcessStatus(null)} type="button">×</button></div>{pendingProcessStatus.stepId === "evidence" && pendingProcessStatus.status === "DONE" ? <><p className="work-evidence-dialog__intro">Record the filing and payment facts needed to close the package.</p><label className="work-evidence-dialog__field"><span>SharePoint link <small>(optional)</small></span><input aria-label="SharePoint link" onChange={(event) => setPendingArchiveSharePoint(event.target.value)} placeholder="Paste the final folder or file link" type="url" value={pendingArchiveSharePoint} /></label><div className="work-archive-facts"><p className="eyebrow">Filing facts</p><label className="work-evidence-dialog__field"><span>Filing date</span><input aria-label="Filing date" onChange={(event) => setPendingArchiveFacts((current) => ({ ...current, filingDate: event.target.value }))} required type="date" value={pendingArchiveFacts.filingDate ?? ""} /></label><label className="work-evidence-dialog__field"><span>Filing reference number</span><input aria-label="Filing reference number" onChange={(event) => setPendingArchiveFacts((current) => ({ ...current, filingReferenceNumber: event.target.value }))} required value={pendingArchiveFacts.filingReferenceNumber ?? ""} /></label>{effectiveWork.paymentApplicability === "REQUIRED" ? <><p className="eyebrow">Payment facts</p><label className="work-evidence-dialog__field"><span>Amount to pay</span>{paymentAmountRecorded ? <output className="work-course-map__amount-readonly">{paymentAmountLabel}</output> : <input aria-label="Amount to pay" inputMode="decimal" min="0" onChange={(event) => setPendingArchiveAmount(event.target.value)} required step="0.01" type="number" value={pendingArchiveAmount} />}</label><label className="work-evidence-dialog__field"><span>Proceed to pay / equivalent</span><input aria-label="Proceed to pay / equivalent" onChange={(event) => setPendingArchiveFacts((current) => ({ ...current, proceedToPay: event.target.value }))} required value={pendingArchiveFacts.proceedToPay ?? ""} /></label><label className="work-evidence-dialog__field"><span>Payment acknowledgement date</span><input aria-label="Payment acknowledgement date" onChange={(event) => setPendingArchiveFacts((current) => ({ ...current, paymentAcknowledgementDate: event.target.value }))} required type="date" value={pendingArchiveFacts.paymentAcknowledgementDate ?? ""} /></label><label className="work-evidence-dialog__field"><span>Payment acknowledgement</span><input aria-label="Payment acknowledgement" onChange={(event) => setPendingArchiveFacts((current) => ({ ...current, paymentAcknowledgement: event.target.value }))} required value={pendingArchiveFacts.paymentAcknowledgement ?? ""} /></label></> : <p className="work-evidence-dialog__hint">Payment: Not applicable for this return.</p>}</div></> : <label className="work-evidence-dialog__field"><span>{pendingProcessStatus.status !== "DONE" ? "N/A reason" : pendingProcessStatus.stepId === "filing" ? "Filing reference number" : pendingProcessStatus.stepId === "payment-client-approval" ? "Proceed to pay / equivalent reference" : pendingProcessStatus.stepId === "payment-confirmation" ? "Payment acknowledgement / proof" : pendingProcessStatus.stepId === "esubmission" ? "eSubmission submission evidence" : "Result / evidence ref"}</span><input autoFocus onChange={(event) => setPendingProcessEvidence(event.target.value)} placeholder={pendingProcessStatus.status === "DONE" ? "Enter the retained reference" : "Explain why this step does not apply"} value={pendingProcessEvidence} /></label>}{["filing", "payment-confirmation", "esubmission"].includes(pendingProcessStatus.stepId) && pendingProcessStatus.status === "DONE" && <label className="work-evidence-dialog__field"><span>{pendingProcessStatus.stepId === "filing" ? "Filing date" : pendingProcessStatus.stepId === "payment-confirmation" ? "Payment acknowledgement date" : "eSubmission submission date"}</span><input aria-label="Process completion date" onChange={(event) => setPendingProcessDate(event.target.value)} required type="date" value={pendingProcessDate} /></label>}{pendingProcessStatus.stepId === "esubmission" && pendingProcessStatus.status === "DONE" && <><label className="work-evidence-dialog__field"><span>Date acknowledged by BIR</span><input aria-label="Date acknowledged by BIR" onChange={(event) => setPendingProcessAcknowledgedDate(event.target.value)} required type="date" value={pendingProcessAcknowledgedDate} /></label><label className="work-evidence-dialog__field"><span>Date validated by BIR</span><input aria-label="Date validated by BIR" onChange={(event) => setPendingProcessValidatedDate(event.target.value)} required type="date" value={pendingProcessValidatedDate} /></label></>}{processFeedback && <p className="work-process-feedback" role="alert">{processFeedback}</p>}<div className="work-evidence-dialog__actions"><button className="button button--quiet" onClick={() => setPendingProcessStatus(null)} type="button">Cancel</button><button className="button button--primary" disabled={periodLock.locked} onClick={confirmPendingProcessStatus} type="button">Save {pendingProcessStatus.status === "DONE" ? "complete" : "N/A"}</button></div></section></div>}
      {activityEvents.length > 0 && <details className="work-activity-history"><summary>Transaction history</summary><div>{activityEvents.map((event) => <div className="work-activity-history__event" key={event.id}><strong>{event.label}</strong><small>{event.detail}</small></div>)}</div></details>}
      <details className="work-data-exports"><summary>Data exports</summary><div><p>Files for this return only.</p><button className="text-button" onClick={() => exportWorkflowData("facts")} type="button">Filing facts · CSV</button><button className="text-button" onClick={() => exportWorkflowData("processing")} type="button">Processing log · CSV</button>{archiveComplete && <button className="text-button" onClick={() => void downloadJourneyReport()} type="button">Return report · PDF</button>}</div></details>
    </div>
  );
  if (fullPage) return <section className="work-detail-page" aria-labelledby="work-detail-page-title"><div className="work-detail-page__header"><div><h1 className="work-detail-page__identity" id="work-detail-page-title">{client ? <Link href={`/app/clients/${client.id}`}>{client.name}</Link> : effectiveWork.client}<span className="work-detail-page__identity-meta"><span>{periodLabel}</span><span aria-hidden="true">•</span><span>{returnPackageLabel}</span><span aria-hidden="true">•</span><span>Due {dueDateLabel}</span>{periodLock.locked && <span className="work-validation-badge">✓ Tax Team validated</span>}</span></h1>{roleRows.length > 0 && <div aria-label="Return roles" className="work-detail-page__role-tags">{roleRows.map((row) => <span className={`work-detail-page__role-tag work-detail-page__role-tag--${row.code.toLowerCase()}`} key={row.code}><strong>{row.label}</strong><span>{row.person}</span></span>)}</div>}</div><Link aria-label="Close return journey" className="icon-button work-detail-page__close" href="/app/work">×</Link></div>{detailContent}</section>;
  return <DetailDrawer eyebrow="Return package" title={client ? <button className="detail-drawer__title-link detail-drawer__title-button" onClick={() => setClientPreviewOpen(true)} type="button">{client.name}</button> : effectiveWork.client} subtitle={`${returnPackageLabel} · ${periodLabel} · Due ${dueDateLabel} · ${effectiveWork.registrationUnit}`} onClose={onClose}>{detailContent}{client && clientPreviewOpen && <ClientPreviewDrawer client={client} onClose={() => setClientPreviewOpen(false)} />}</DetailDrawer>;
}

function ClientPreviewDrawer({ client, onClose }: { client: FixtureClient; onClose: () => void }) {
  const profile = client.entities[0]?.profile;
  return <DetailDrawer eyebrow="Taxpayer" title={client.name} subtitle={`${profile?.tinDisplay ?? "TIN not recorded"} · ${client.entities[0]?.units[0]?.type ?? "Registration unit"}`} onClose={onClose}>
    <dl className="detail-list">
      <div><dt>Profile</dt><dd>{profile?.profileState ?? "Not configured"}</dd></div>
      <div><dt>RDO / LTS</dt><dd>{profile?.rdoOrLts ?? "Not recorded"}</dd></div>
      <div><dt>Filing</dt><dd>{profile?.filingChannel ?? "Not configured"}</dd></div>
      <div><dt>Team</dt><dd>{client.assignment.cluster} · {client.assignment.tower}</dd></div>
      <div><dt>Preparer</dt><dd>{client.assignment.preparer}</dd></div>
      <div><dt>Checker</dt><dd>{client.assignment.checker}</dd></div>
      <div><dt>Reviewer</dt><dd>{client.assignment.reviewer}</dd></div>
    </dl>
    <Link className="button button--primary button--small" href={`/app/clients/${client.id}`}>Open full Client Profile</Link>
  </DetailDrawer>;
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
