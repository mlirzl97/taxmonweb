"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { canAccessModule, cloneAccessMatrix, isAccessMatrix, moduleAccessForPersona, rbacPersonaDescription, rbacPersonaLabel, type AccessLevel, type AccessMatrix, type ModuleKey, type RbacPersona } from "@/lib/domain/access";
import { fixtureClients, fixtureClock, fixtureOrgDirectoryMembers, fixtureWork, type FixtureClient, type FixturePaymentApplicability, type FixtureStatus, type FixtureWorkItem } from "@/lib/fixtures";
import { clientIsAssignedForRole, clientMatchesPerspective, staffMemberIdForPerspective, workMatchesStaffPerspective } from "@/lib/domain/team";
import { towerForScopeFilter } from "@/lib/domain/organization-catalog";
import { portfolioClientToFixtureClient } from "@/lib/domain/live-client-adapter";

export type WorkflowRole = "PREPARER" | "CHECKER" | "REVIEWER";
export type WorkflowProcessOwner = WorkflowRole | "TAX_CONTROL";
export type WorkflowPerspective = RbacPersona;
export type WorkflowDecision = "CERTIFY" | "APPROVE" | "RETURN";

export type WorkflowQuestion = { id: string; label: string };
export type WorkflowAttempt = {
  id: string;
  role: WorkflowRole;
  decision: WorkflowDecision;
  note: string;
  answers: Record<string, boolean>;
  actor: string;
  recordedAt: string;
  elevatedOverride?: boolean;
  overrideReason?: string;
};

export type WorkflowProcessStatus = "NOT_STARTED" | "IN_PROGRESS" | "DONE" | "NOT_APPLICABLE" | "NEEDS_ATTENTION";
export type WorkflowProcessUpdate = {
  id: string;
  stepId: string;
  status: WorkflowProcessStatus;
  actor: string;
  recordedAt: string;
  evidenceReference?: string;
  elevatedOverride?: boolean;
  overrideReason?: string;
};
export type WorkflowChangeEvent = {
  id: string;
  kind: "PAYMENT_AMOUNT";
  detail: string;
  actor: string;
  recordedAt: string;
};
export type WorkflowPeriodLock = {
  locked: boolean;
  actor?: string;
  recordedAt?: string;
  reason?: string;
  elevatedOverride?: boolean;
};
export type WorkflowChecklistUpdate = {
  id: string;
  role: WorkflowRole;
  questionId: string;
  completed: boolean;
  actor: string;
  recordedAt: string;
  elevatedOverride?: boolean;
  overrideReason?: string;
};

export type WorkflowRecord = {
  currentGate: WorkflowRole | null;
  attempts: readonly WorkflowAttempt[];
  checklistAnswers: Readonly<Partial<Record<WorkflowRole, Readonly<Record<string, boolean>>>>>;
  checklistHistory: readonly WorkflowChecklistUpdate[];
  processStatuses: Readonly<Record<string, WorkflowProcessStatus>>;
  processHistory: readonly WorkflowProcessUpdate[];
  changeHistory: readonly WorkflowChangeEvent[];
  periodLock: WorkflowPeriodLock;
  periodLockHistory: readonly WorkflowPeriodLock[];
};

type WorkflowPatch = {
  stage?: FixtureWorkItem["stage"];
  status?: FixtureStatus;
  statusReason?: string;
  nextAction?: string;
  returnedFrom?: string;
  blocker?: FixtureWorkItem["blocker"] | null;
  paymentAmount?: number | null;
};

type StoredWorkflowRecord = WorkflowRecord & { patch: WorkflowPatch };

export type WorkAdminInput = {
  clientId: string;
  registrationUnitId?: string;
  title: string;
  period: string;
  deadline: string;
  owner: string;
  stage: FixtureWorkItem["stage"];
  status: FixtureStatus;
  nextAction: string;
  detail: string;
  paymentApplicability: FixturePaymentApplicability;
  paymentAmount: number | null;
};

const workAdminStorageKey = "taxmonweb.prototype.work-register";
const accessPerspectiveStorageKey = "taxmonweb.prototype.access-perspective";
const accessMatrixStorageKey = "taxmonweb.prototype.access-matrix";
const accessHistoryStorageKey = "taxmonweb.prototype.access-history";

export type AccessPolicyEvent = { id: string; actor: string; recordedAt: string; reason: string };

const roleQuestions: Record<WorkflowRole, readonly WorkflowQuestion[]> = {
  PREPARER: [
    { id: "correct-context", label: "Client profile, period, assigned team, and return context confirmed." },
    { id: "data-reviewed", label: "Prior returns, TB, GL, schedules, listings, and supporting documents received or limitations recorded." },
    { id: "mapping-complete", label: "Transaction listing, supplier status, nature of payment, and applicable tax code mapping completed." },
    { id: "documents-vouched", label: "Vouching and documentary support checked for the relevant transactions." },
    { id: "reconciled", label: "Books, schedules, expense analysis, and return reconciled; differences explained." },
    { id: "working-paper-agrees", label: "Alphalist/QAP, working papers, and prepared return agree, including relevant prior-period or amendment context." },
    { id: "self-check-complete", label: "Completeness and accuracy self-check completed; filing and archiving convention followed." },
    { id: "issues-recorded", label: "Exceptions, assumptions, and review notes recorded." },
  ],
  CHECKER: [
    { id: "preparation-traceable", label: "Preparation is complete and traceable to the source work." },
    { id: "source-supports-return", label: "Books, AP/EWT schedules, listings, and supporting documents support the return." },
    { id: "mapping-reasonable", label: "Transaction testing, rates, tax codes, supplier status, and documentary support are reasonable." },
    { id: "vouching-sufficient", label: "Vouching and documentary requirements are sufficient for the work performed." },
    { id: "tie-outs-satisfactory", label: "Books-to-schedule, expense-to-return, and return-to-books tie-outs are satisfactory." },
    { id: "exceptions-documented", label: "Differences, exceptions, and review notes are resolved or properly documented." },
    { id: "ready-for-review", label: "Return, QAP/alphalist, and working papers agree and are ready for Reviewer." },
  ],
  REVIEWER: [
    { id: "independent-review", label: "Independent review completed." },
    { id: "material-items-considered", label: "Material accuracy, completeness, and reconciliations considered." },
    { id: "judgments-addressed", label: "Significant judgments, unusual items, and tax-risk questions addressed." },
    { id: "risks-documented", label: "Exceptions, assumptions, and review notes are properly documented." },
    { id: "client-output-complete", label: "Client-facing output and approval request are complete." },
    { id: "ready-for-client", label: "Work is ready for client approval." },
  ],
};

const roleLabels: Record<WorkflowRole, string> = { PREPARER: "Preparer", CHECKER: "Checker", REVIEWER: "Reviewer" };
const processOwnerLabels: Record<WorkflowProcessOwner, string> = { ...roleLabels, TAX_CONTROL: "Tax Control" };

export function workflowProcessRole(stepId: string): WorkflowProcessOwner {
  if (stepId === "payment-confirmation") return "TAX_CONTROL";
  if (stepId === "check") return "CHECKER";
  if (stepId === "review") return "REVIEWER";
  return "PREPARER";
}

export function workflowProcessRoleLabel(role: WorkflowProcessOwner): string {
  return processOwnerLabels[role];
}

function initialProcessStatuses(work: FixtureWorkItem): Readonly<Record<string, WorkflowProcessStatus>> {
  // Fixture steps can carry a stale visual `current` marker (for example, a
  // package that was filed but still has an unfinished payment branch). The
  // persisted process state must follow the ordered, applicable journey so a
  // later step cannot mask the first unfinished control.
  const statuses: Record<string, WorkflowProcessStatus> = {};
  for (const step of work.steps) {
    statuses[step.id] = step.state === "complete"
      ? "DONE"
      : paymentProcessStepIds.has(step.id) && work.paymentApplicability === "NOT_APPLICABLE"
        ? "NOT_APPLICABLE"
        : "NOT_STARTED";
  }

  const firstIncomplete = work.steps.find((step) => statuses[step.id] === "NOT_STARTED");
  if (firstIncomplete) statuses[firstIncomplete.id] = "IN_PROGRESS";
  return statuses;
}

function initialRecord(work: FixtureWorkItem): WorkflowRecord {
  return { currentGate: initialGate(work), attempts: [], checklistAnswers: {}, checklistHistory: [], processStatuses: initialProcessStatuses(work), processHistory: [], changeHistory: [], periodLock: { locked: false }, periodLockHistory: [] };
}

function recordForWork(work: FixtureWorkItem, stored?: StoredWorkflowRecord): StoredWorkflowRecord {
  const seed = initialRecord(work);
  if (!stored) return { ...seed, patch: {} };
  const recordedStepIds = new Set(stored.processHistory.map((update) => update.stepId));
  const processStatuses = { ...seed.processStatuses, ...stored.processStatuses };
  for (const step of work.steps) {
    if (!recordedStepIds.has(step.id)) processStatuses[step.id] = seed.processStatuses[step.id];
  }
  return { ...stored, processStatuses, changeHistory: stored.changeHistory ?? seed.changeHistory, periodLock: stored.periodLock ?? seed.periodLock, periodLockHistory: stored.periodLockHistory ?? seed.periodLockHistory };
}

function stageForProcessStep(stepId: string): FixtureWorkItem["stage"] {
  if (stepId === "prepare") return "PREPARE";
  if (stepId === "check" || stepId === "review") return "REVIEW";
  if (stepId === "client-approval") return "CLIENT";
  if (stepId === "filing" || stepId === "esubmission" || stepId === "payment" || stepId === "payment-client-approval" || stepId === "payment-confirmation") return "FILE";
  return "POST-FILING";
}

const paymentProcessStepIds = new Set(["payment", "payment-client-approval", "payment-confirmation"]);

function nextApplicableProcessStep(work: FixtureWorkItem, currentIndex: number) {
  return work.steps.slice(currentIndex + 1).find((step) => work.paymentApplicability !== "NOT_APPLICABLE" || !paymentProcessStepIds.has(step.id));
}

function actionForProcessStep(stepId: string, status: WorkflowProcessStatus): string | undefined {
  const labels: Record<string, string> = {
    prepare: "preparation",
    check: "checking",
    review: "review",
    "client-approval": "client approval",
    filing: "filing",
    esubmission: "eSubmission email",
    payment: "payment endorsement",
    "payment-client-approval": "payment client approval",
    "payment-confirmation": "payment confirmation",
    evidence: "archiving",
  };
  const label = labels[stepId];
  if (!label) return undefined;
  if (status === "DONE") return stepId === "client-approval" ? "File the approved return" : `Continue with the next ${label} control`;
  if (status === "NEEDS_ATTENTION") return `Resolve the ${label} attention item`;
  if (status === "NOT_APPLICABLE") return "Continue with the next applicable process step";
  return status === "IN_PROGRESS" ? `Complete ${label}` : `Start ${label}`;
}

function initialGate(work: FixtureWorkItem): WorkflowRole | null {
  const currentStep = work.steps.find((step) => step.state === "current");
  if (currentStep?.id === "check") return "CHECKER";
  if (currentStep?.id === "review") return "REVIEWER";
  if (currentStep?.id === "prepare") return "PREPARER";
  return null;
}

function workflowTimestamp(sequence: number) {
  const base = Date.parse(`${fixtureClock.today}T09:00:00+08:00`);
  const value = new Date(base + Math.max(0, sequence) * 60_000);
  return `${new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Manila" }).format(value)} (Asia/Manila)`;
}

export function workMatchesPerspective(work: FixtureWorkItem, perspective: WorkflowPerspective): boolean {
  if (perspective === "MASTER_ADMIN" || perspective === "TAX_CONTROL" || perspective === "SUPER_ADMIN") return true;
  if (perspective === "TOWER_LEADER") return work.scope === towerForScopeFilter("tower-b");
  if (perspective === "CLUSTER_LEADER") return work.scope === towerForScopeFilter("tower-c");
  if (perspective === "SYSTEM_ADMIN") return false;
  return workMatchesStaffPerspective(work, perspective, fixtureClients, fixtureOrgDirectoryMembers);
}

function transition(role: WorkflowRole, decision: WorkflowDecision, note: string): { currentGate: WorkflowRole | null; patch: WorkflowPatch } {
  if (decision === "RETURN") {
    return {
      currentGate: "PREPARER",
      patch: { stage: "PREPARE", status: "AMBER", statusReason: `${roleLabels[role]} returned this work for correction.`, nextAction: "Address the returned correction notes", returnedFrom: roleLabels[role], blocker: { category: "INTERNAL", reason: note } },
    };
  }

  if (role === "PREPARER") return { currentGate: "CHECKER", patch: { stage: "REVIEW", statusReason: "Preparer certification recorded; independent checking is now required.", nextAction: "Complete Checker review", returnedFrom: undefined, blocker: null } };
  if (role === "CHECKER") return { currentGate: "REVIEWER", patch: { stage: "REVIEW", statusReason: "Checker approval recorded; independent Reviewer review is now required.", nextAction: "Complete Reviewer review", blocker: null } };
  return { currentGate: null, patch: { stage: "CLIENT", statusReason: "Reviewer approval recorded; client approval is now required.", nextAction: "Send return to client for approval", blocker: null } };
}

function applyWorkflowStepState(work: FixtureWorkItem, currentGate: WorkflowRole | null, stage: FixtureWorkItem["stage"], processStatuses?: Readonly<Record<string, WorkflowProcessStatus>>): FixtureWorkItem["steps"] {
  const activeProcessStep = processStatuses && work.steps.find((step) => processStatuses[step.id] === "IN_PROGRESS" || processStatuses[step.id] === "NEEDS_ATTENTION");
  const currentStepId = activeProcessStep?.id ?? (currentGate === "PREPARER" ? "prepare" : currentGate === "CHECKER" ? "check" : currentGate === "REVIEWER" ? "review" : stage === "CLIENT" ? "client-approval" : stage === "FILE" ? "filing" : stage === "POST-FILING" ? "evidence" : null);
  const completeBefore = currentStepId === "check" ? new Set(["prepare"]) : currentStepId === "review" ? new Set(["prepare", "check"]) : currentStepId === "client-approval" ? new Set(["prepare", "check", "review"]) : new Set<string>();
  return work.steps.map((step) => {
    const processStatus = processStatuses?.[step.id];
    const state = processStatus === "DONE" || processStatus === "NOT_APPLICABLE" ? "complete" : processStatus === "NEEDS_ATTENTION" ? "unresolved" : step.state === "blocked" && step.id === currentStepId ? "blocked" : step.id === currentStepId ? "current" : processStatus === "IN_PROGRESS" ? "current" : processStatuses ? "not-started" : completeBefore.has(step.id) ? "complete" : "not-started";
    return { ...step, state };
  });
}

type WorkflowContextValue = {
  prototypeMode: boolean;
  clientRegistry: readonly FixtureClient[];
  clientRegistryState: "loading" | "connected" | "empty" | "error";
  refreshClientRegistry: () => Promise<readonly FixtureClient[]>;
  currentRole: WorkflowRole;
  setCurrentRole: (role: WorkflowRole) => void;
  workPerspective: WorkflowPerspective;
  setWorkPerspective: (perspective: WorkflowPerspective) => void;
  applyAccessPerspective: (perspective: WorkflowPerspective) => void;
  accessMatrix: AccessMatrix;
  accessPolicyHistory: readonly AccessPolicyEvent[];
  commitAccessMatrix: (matrix: AccessMatrix, reason: string) => { ok: boolean; error?: string };
  canManageAccess: boolean;
  getModuleAccess: (module: ModuleKey) => AccessLevel;
  canAccessModule: (module: ModuleKey, allowed?: readonly AccessLevel[]) => boolean;
  getRecord: (work: FixtureWorkItem) => WorkflowRecord;
  getEffectiveWork: (work: FixtureWorkItem) => FixtureWorkItem;
  getWorkItems: () => readonly FixtureWorkItem[];
  createWorkItem: (input: WorkAdminInput) => { ok: boolean; work?: FixtureWorkItem; error?: string };
  updateWorkItem: (workId: string, input: WorkAdminInput) => { ok: boolean; work?: FixtureWorkItem; error?: string };
  deleteWorkItem: (workId: string) => { ok: boolean; error?: string };
  isWorkVisible: (work: FixtureWorkItem) => boolean;
  isClientVisible: (client: FixtureClient) => boolean;
  canActOnWorkflow: (role: WorkflowRole, work?: FixtureWorkItem) => boolean;
  canActOnProcessStep: (stepId: string, work?: FixtureWorkItem) => boolean;
  getProcessStatus: (work: FixtureWorkItem, stepId: string) => WorkflowProcessStatus;
  getLatestProcessUpdate: (work: FixtureWorkItem, stepId: string) => WorkflowProcessUpdate | undefined;
  setPaymentAmount: (work: FixtureWorkItem, amount: number | null) => { ok: boolean; error?: string };
  getPeriodLock: (work: FixtureWorkItem) => WorkflowPeriodLock;
  setPeriodLock: (work: FixtureWorkItem, locked: boolean, reason: string) => { ok: boolean; error?: string };
  setProcessStatus: (work: FixtureWorkItem, stepId: string, status: WorkflowProcessStatus, evidenceReference?: string, overrideReason?: string) => { ok: boolean; error?: string };
  getChecklistAnswers: (work: FixtureWorkItem, role: WorkflowRole) => Readonly<Record<string, boolean>>;
  setChecklistAnswer: (work: FixtureWorkItem, role: WorkflowRole, questionId: string, completed: boolean) => { ok: boolean; error?: string };
  getQuestions: (role: WorkflowRole) => readonly WorkflowQuestion[];
  submitDecision: (work: FixtureWorkItem, role: WorkflowRole, decision: WorkflowDecision, answers: Record<string, boolean>, note: string, overrideReason?: string) => { ok: boolean; error?: string; nextGate?: WorkflowRole | null };
};

const WorkflowContext = createContext<WorkflowContextValue | null>(null);

export function WorkflowProvider({ children, prototypeMode = false }: { children: React.ReactNode; prototypeMode?: boolean }) {
  type LivePortfolioRecord = Parameters<typeof portfolioClientToFixtureClient>[0];
  const [currentRole, setCurrentRole] = useState<WorkflowRole>("PREPARER");
  const [workPerspective, setWorkPerspective] = useState<WorkflowPerspective>("MASTER_ADMIN");
  const [accessMatrix, setAccessMatrix] = useState<AccessMatrix>(() => cloneAccessMatrix());
  const [accessPolicyHistory, setAccessPolicyHistory] = useState<AccessPolicyEvent[]>([]);
  const [accessPerspectiveHydrated, setAccessPerspectiveHydrated] = useState(() => !prototypeMode);
  const [accessMatrixHydrated, setAccessMatrixHydrated] = useState(() => !prototypeMode);
  const [recordsHydrated, setRecordsHydrated] = useState(() => !prototypeMode);
  const [workItemsHydrated, setWorkItemsHydrated] = useState(() => !prototypeMode);
  const [records, setRecords] = useState<Record<string, StoredWorkflowRecord>>({});
  const [clientRegistry, setClientRegistry] = useState<FixtureClient[]>(() => prototypeMode ? [...fixtureClients] : []);
  const [clientRegistryState, setClientRegistryState] = useState<"loading" | "connected" | "empty" | "error">(() => prototypeMode ? "connected" : "loading");
  const clientRegistryRequest = useRef<Promise<readonly FixtureClient[]> | null>(null);
  // Production starts with an empty server-backed projection. The fixture
  // work register exists only for the explicit sanitized prototype mode.
  const [workItems, setWorkItems] = useState<FixtureWorkItem[]>(() => prototypeMode ? [...fixtureWork] : []);

  const refreshClientRegistry = useCallback(async () => {
    if (prototypeMode) {
      setClientRegistry([...fixtureClients]);
      setClientRegistryState("connected");
      return fixtureClients;
    }
    if (clientRegistryRequest.current) return clientRegistryRequest.current;

    const request = fetch("/api/portfolio?detail=registry", { headers: { accept: "application/json" }, cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { data?: LivePortfolioRecord[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Unable to load the client repository.");
        const clients = (payload.data ?? []).map(portfolioClientToFixtureClient);
        setClientRegistry(clients);
        setClientRegistryState(clients.length > 0 ? "connected" : "empty");
        return clients;
      })
      .catch((error: unknown) => {
        setClientRegistryState("error");
        throw error;
      })
      .finally(() => {
        clientRegistryRequest.current = null;
      });
    clientRegistryRequest.current = request;
    return request;
  }, [prototypeMode]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refreshClientRegistry(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshClientRegistry]);

  useEffect(() => {
    if (!prototypeMode) return;
    try {
      const storedPerspective = window.localStorage.getItem(accessPerspectiveStorageKey) as WorkflowPerspective | null;
      if (storedPerspective && ["PREPARER", "CHECKER", "REVIEWER", "TOWER_LEADER", "CLUSTER_LEADER", "TAX_CONTROL", "MASTER_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN"].includes(storedPerspective)) {
        // Hydrate the prototype lens after the server/client markup is stable.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setWorkPerspective(storedPerspective);
      }
      setAccessPerspectiveHydrated(true);
    } catch {
      // Keep the default HOD lens when browser storage is unavailable.
      setAccessPerspectiveHydrated(true);
    }
  }, [prototypeMode]);

  useEffect(() => {
    if (prototypeMode) return;
    let cancelled = false;
    fetch("/api/work", { headers: { accept: "application/json" }, cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { data?: FixtureWorkItem[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Unable to load generated compliance work.");
        if (!cancelled) setWorkItems(payload.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setWorkItems([]);
      });
    return () => { cancelled = true; };
  }, [prototypeMode]);

  useEffect(() => {
    if (!accessPerspectiveHydrated) return;
    if (!prototypeMode) return;
    try {
      window.localStorage.setItem(accessPerspectiveStorageKey, workPerspective);
    } catch {
      // The selector remains usable for the current session when storage is unavailable.
    }
  }, [accessPerspectiveHydrated, prototypeMode, workPerspective]);

  useEffect(() => {
    if (!prototypeMode) return;
    try {
      const storedMatrix = window.localStorage.getItem(accessMatrixStorageKey);
      const parsedMatrix = storedMatrix ? JSON.parse(storedMatrix) as AccessMatrix : null;
      if (isAccessMatrix(parsedMatrix)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAccessMatrix(parsedMatrix);
      }
      const storedHistory = window.localStorage.getItem(accessHistoryStorageKey);
      const parsedHistory = storedHistory ? JSON.parse(storedHistory) as AccessPolicyEvent[] : null;
      if (Array.isArray(parsedHistory)) {
        setAccessPolicyHistory(parsedHistory);
      }
    } catch {
      // Keep the approved role matrix when browser storage is unavailable or malformed.
    }
    setAccessMatrixHydrated(true);
  }, [prototypeMode]);

  useEffect(() => {
    if (!accessMatrixHydrated) return;
    if (!prototypeMode) return;
    try {
      window.localStorage.setItem(accessMatrixStorageKey, JSON.stringify(accessMatrix));
      window.localStorage.setItem(accessHistoryStorageKey, JSON.stringify(accessPolicyHistory));
    } catch {
      // Access changes remain available for the current session when storage is unavailable.
    }
  }, [accessMatrix, accessMatrixHydrated, accessPolicyHistory, prototypeMode]);

  const applyAccessPerspective = useCallback((perspective: WorkflowPerspective) => {
    setCurrentRole(perspective === "PREPARER" || perspective === "CHECKER" || perspective === "REVIEWER" ? perspective : "PREPARER");
    setWorkPerspective(perspective);
  }, []);

  const canManageAccess = prototypeMode && workPerspective === "SUPER_ADMIN";
  const commitAccessMatrix = useCallback((matrix: AccessMatrix, reason: string) => {
    if (!prototypeMode) return { ok: false, error: "Authenticated access templates are managed by server-side administration." };
    if (!canManageAccess) return { ok: false, error: "Only Super Admin can change access templates in this prototype." };
    if (!reason.trim()) return { ok: false, error: "Record a reason for this access change." };
    const event: AccessPolicyEvent = { id: `access-${Date.now()}`, actor: rbacPersonaLabel(workPerspective), recordedAt: fixtureClock.timestampLabel, reason: reason.trim() };
    setAccessMatrix(matrix);
    setAccessPolicyHistory((events) => [...events, event]);
    return { ok: true };
  }, [canManageAccess, prototypeMode, workPerspective]);

  useEffect(() => {
    try {
      if (!prototypeMode) return;
      const storedRecords = window.sessionStorage.getItem("taxmonweb.prototype.workflow-records");
      const parsedRecords = storedRecords ? JSON.parse(storedRecords) as Record<string, StoredWorkflowRecord> : null;
      if (parsedRecords && typeof parsedRecords === "object" && !Array.isArray(parsedRecords)) {
        // Hydrate browser-local workflow history after SSR; production persistence is server-owned.
        // Hydration is intentionally an external-storage synchronization.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRecords(parsedRecords);
      }
      const storedWorkItems = window.sessionStorage.getItem(workAdminStorageKey);
      const parsedWorkItems = storedWorkItems ? JSON.parse(storedWorkItems) as FixtureWorkItem[] : null;
      if (Array.isArray(parsedWorkItems) && parsedWorkItems.every((item) => typeof item.id === "string" && typeof item.clientId === "string" && typeof item.title === "string")) {
        setWorkItems(parsedWorkItems);
      }
    } catch {
      // Keep the shipped fixture baseline when browser storage is unavailable or malformed.
    }
    setRecordsHydrated(true);
    setWorkItemsHydrated(true);
  }, [prototypeMode]);

  useEffect(() => {
    try {
      if (prototypeMode && recordsHydrated) {
        window.sessionStorage.setItem("taxmonweb.prototype.workflow-records", JSON.stringify(records));
      }
    } catch {
      // Workflow edits remain available for the current render when storage is unavailable.
    }
  }, [prototypeMode, records, recordsHydrated]);

  useEffect(() => {
    try {
      if (prototypeMode && workItemsHydrated) {
        window.sessionStorage.setItem(workAdminStorageKey, JSON.stringify(workItems));
      }
    } catch {
      // Prototype edits remain available for the current render when storage is unavailable.
    }
  }, [prototypeMode, workItems, workItemsHydrated]);

  const getRecord = useCallback((work: FixtureWorkItem): WorkflowRecord => recordForWork(work, records[work.id]), [records]);

  const getEffectiveWork = useCallback((work: FixtureWorkItem): FixtureWorkItem => {
    // Always project through the normalized initial record. Raw fixture state
    // may contain a stale visual `current` marker after a later component was
    // completed; bypassing this projection leaves the next applicable step
    // locked on first load.
    const record = recordForWork(work, records[work.id]);
    const { blocker, ...patchWithoutBlocker } = record.patch;
    const stage = record.patch.stage ?? work.stage;
    return { ...work, ...patchWithoutBlocker, steps: applyWorkflowStepState(work, record.currentGate, stage, record.processStatuses), ...(blocker === null ? {} : blocker === undefined ? {} : { blocker }) };
  }, [records]);

  const getWorkItems = useCallback(() => workItems, [workItems]);
  const buildWorkItem = useCallback((input: WorkAdminInput, existing?: FixtureWorkItem): { work?: FixtureWorkItem; error?: string } => {
    const client = fixtureClients.find((candidate) => candidate.id === input.clientId);
    if (!client) return { error: "Choose a taxpayer before saving the work item." };
    if (!input.title.trim() || !input.period.trim() || !input.deadline.trim() || !input.owner.trim() || !input.nextAction.trim()) return { error: "Complete the work, period, target, owner, and next action fields." };

    const entity = client.entities[0];
    const units = entity?.units ?? [];
    const unit = input.registrationUnitId ? units.find((candidate) => candidate.name === input.registrationUnitId) : units.length === 1 ? units[0] : undefined;
    if (units.length > 1 && !unit) return { error: "Choose the registration unit for this work item." };
    return {
      work: {
        ...(existing ?? {
          id: `work-admin-${Date.now()}`,
          steps: [
            { id: "prepare", label: "Preparation", state: "current", detail: "Preparation is ready to begin." },
            { id: "check", label: "Checking", state: "not-started", detail: "Checking follows preparation." },
            { id: "review", label: "Review", state: "not-started", detail: "Review follows checking." },
            { id: "client-approval", label: "Client approval", state: "not-started", detail: "Client approval follows internal review." },
            { id: "filing", label: "Filing", state: "not-started", detail: "File the approved return through the configured submission channel." },
            { id: "payment", label: "Payment endorsement", state: "not-started", detail: "Endorse payment separately from filing when payment is applicable." },
            { id: "payment-client-approval", label: "Payment client approval", state: "not-started", detail: "Record the client's payment approval separately from return approval." },
            { id: "payment-confirmation", label: "Payment confirmation", state: "not-started", detail: "Record confirmation only from the external payment result." },
            { id: "esubmission", label: "eSubmission email", state: "not-started", detail: "Generate and validate the DAT, send it to BIR, and retain the acknowledgment and validation emails." },
            { id: "evidence", label: "Archiving", state: "not-started", detail: "Compile and save the complete return package, including filing, payment, and eSubmission evidence." },
          ],
          components: [
            { label: "Submission", state: "Not started", detail: "The work item has not been submitted." },
            { label: "Payment", state: "Applicability unresolved", detail: "Resolve payment applicability before skipping the payment branch." },
            { label: "Attachments", state: "Not configured", detail: "Attachment requirements are not configured for this prototype record." },
            { label: "Evidence", state: "Not started", detail: "Evidence follows the relevant action." },
          ],
          paymentApplicability: "UNRESOLVED",
          paymentAmount: null,
        }),
        clientId: client.id,
        client: client.name,
        entity: entity?.name ?? client.name,
        registrationUnitId: unit?.name,
        registrationUnit: unit?.name ?? "Head Office",
        title: input.title.trim(),
        period: input.period.trim(),
        deadline: input.deadline.trim(),
        detail: input.detail.trim() || "Prototype work record.",
        stage: input.stage,
        nextAction: input.nextAction.trim(),
        status: input.status,
        statusReason: input.detail.trim() || "Status recorded by Master Admin.",
        deadlineType: existing?.deadlineType ?? "TMF internal target",
        owner: input.owner.trim(),
        scope: client.scope,
        paymentApplicability: input.paymentApplicability,
        paymentAmount: input.paymentAmount,
      },
    };
  }, []);

  const createWorkItem = useCallback((input: WorkAdminInput) => {
    if (!prototypeMode) return { ok: false, error: "Authenticated work commands require the server-backed work repository." };
    const result = buildWorkItem(input);
    if (!result.work) return { ok: false, error: result.error };
    setWorkItems((current) => [...current, result.work!]);
    return { ok: true, work: result.work };
  }, [buildWorkItem, prototypeMode]);

  const updateWorkItem = useCallback((workId: string, input: WorkAdminInput) => {
    if (!prototypeMode) return { ok: false, error: "Authenticated work commands require the server-backed work repository." };
    const current = workItems.find((item) => item.id === workId);
    if (!current) return { ok: false, error: "That work item is no longer in the register." };
    if (recordForWork(current, records[current.id]).periodLock.locked) return { ok: false, error: "This period is locked by Tax Team and cannot be edited." };
    const result = buildWorkItem(input, current);
    if (!result.work) return { ok: false, error: result.error };
    setWorkItems((items) => items.map((item) => item.id === workId ? result.work! : item));
    return { ok: true, work: result.work };
  }, [buildWorkItem, prototypeMode, records, workItems]);

  const deleteWorkItem = useCallback((workId: string) => {
    if (!prototypeMode) return { ok: false, error: "Authenticated work commands require the server-backed work repository." };
    if (!workItems.some((item) => item.id === workId)) return { ok: false, error: "That work item is no longer in the register." };
    const work = workItems.find((item) => item.id === workId)!;
    if (recordForWork(work, records[work.id]).periodLock.locked) return { ok: false, error: "This period is locked by Tax Team and cannot be removed." };
    setWorkItems((items) => items.filter((item) => item.id !== workId));
    return { ok: true };
  }, [prototypeMode, records, workItems]);

  const isWorkVisible = useCallback((work: FixtureWorkItem) => workMatchesPerspective(work, workPerspective), [workPerspective]);
  const isClientVisible = useCallback((client: FixtureClient) => {
    if (workPerspective === "MASTER_ADMIN" || workPerspective === "TAX_CONTROL" || workPerspective === "SUPER_ADMIN") return true;
    if (workPerspective === "TOWER_LEADER") return client.scope === towerForScopeFilter("tower-b");
    if (workPerspective === "CLUSTER_LEADER") return client.scope === towerForScopeFilter("tower-c");
    if (workPerspective === "SYSTEM_ADMIN") return false;
    return clientMatchesPerspective(client, workPerspective, fixtureOrgDirectoryMembers);
  }, [workPerspective]);
  const canOperateWorkForRole = useCallback((work: FixtureWorkItem, role: WorkflowRole | "TAX_CONTROL") => {
    if (!workMatchesPerspective(work, workPerspective)) return false;
    if (workPerspective === "MASTER_ADMIN" || workPerspective === "SUPER_ADMIN") return true;
    if (role === "TAX_CONTROL") return workPerspective === "TAX_CONTROL";
    if (workPerspective !== role) return false;
    const client = fixtureClients.find((candidate) => candidate.id === work.clientId);
    const memberId = staffMemberIdForPerspective(workPerspective);
    const member = fixtureOrgDirectoryMembers.find((candidate) => candidate.id === memberId);
    return Boolean(client && member && (role === "PREPARER" || role === "CHECKER" || role === "REVIEWER") && clientIsAssignedForRole(client, member, role));
  }, [workPerspective]);
  const canActOnWorkflow = useCallback((role: WorkflowRole, work?: FixtureWorkItem) => {
    if (!work) return workPerspective === "MASTER_ADMIN" || workPerspective === "SUPER_ADMIN" || workPerspective === role;
    return canOperateWorkForRole(work, role);
  }, [canOperateWorkForRole, workPerspective]);
  const canActOnProcessStep = useCallback((stepId: string, work?: FixtureWorkItem) => {
    const owner = workflowProcessRole(stepId);
    if (!work) return workPerspective === "MASTER_ADMIN" || workPerspective === "SUPER_ADMIN" || (owner === "TAX_CONTROL" ? workPerspective === "TAX_CONTROL" : workPerspective === owner);
    return canOperateWorkForRole(work, owner);
  }, [canOperateWorkForRole, workPerspective]);
  const getProcessStatus = useCallback((work: FixtureWorkItem, stepId: string): WorkflowProcessStatus => getRecord(work).processStatuses[stepId] ?? "NOT_STARTED", [getRecord]);
  const getLatestProcessUpdate = useCallback((work: FixtureWorkItem, stepId: string) => [...getRecord(work).processHistory].reverse().find((update) => update.stepId === stepId), [getRecord]);

  const getChecklistAnswers = useCallback((work: FixtureWorkItem, role: WorkflowRole) => getRecord(work).checklistAnswers[role] ?? {}, [getRecord]);

  const getPeriodLock = useCallback((work: FixtureWorkItem) => getRecord(work).periodLock, [getRecord]);

  const setPeriodLock = useCallback((work: FixtureWorkItem, locked: boolean, reason: string) => {
    if (!prototypeMode) return { ok: false, error: "Authenticated workflow commands require the server-backed work repository." };
    const record = recordForWork(work, records[work.id]);
    if (!["TAX_CONTROL", "MASTER_ADMIN", "SUPER_ADMIN"].includes(workPerspective)) return { ok: false, error: "Only Tax Team or an authorized Master Admin can lock or unlock a period." };
    if (!reason.trim()) return { ok: false, error: "Add a short reason for this period lock change." };
    if (locked) {
      const priorStepsComplete = work.steps.filter((step) => step.id !== "evidence").every((step) => record.processStatuses[step.id] === "DONE" || record.processStatuses[step.id] === "NOT_APPLICABLE");
      if (record.processStatuses.evidence !== "DONE" || !priorStepsComplete) return { ok: false, error: "Complete every applicable process step through Archiving before locking this period." };
    }
    const periodLock: WorkflowPeriodLock = { locked, actor: rbacPersonaLabel(workPerspective), recordedAt: workflowTimestamp(record.periodLockHistory.length), reason: reason.trim(), elevatedOverride: workPerspective !== "TAX_CONTROL" };
    setRecords((current) => ({ ...current, [work.id]: { ...record, periodLock, periodLockHistory: [...record.periodLockHistory, periodLock] } }));
    return { ok: true };
  }, [prototypeMode, records, workPerspective]);

  const setChecklistAnswer = useCallback((work: FixtureWorkItem, role: WorkflowRole, questionId: string, completed: boolean) => {
    if (!prototypeMode) return { ok: false, error: "Authenticated workflow commands require the server-backed work repository." };
    const record = recordForWork(work, records[work.id]);
    if (record.periodLock.locked) return { ok: false, error: "This period is locked by Tax Team and cannot be edited." };
    if (!roleQuestions[role].some((question) => question.id === questionId)) return { ok: false, error: "That checklist item is not configured for this responsibility." };
    if (!canActOnWorkflow(role, work)) return { ok: false, error: `The ${rbacPersonaLabel(workPerspective)} access view cannot update this checklist for this taxpayer.` };
    const elevatedOverride = workPerspective === "MASTER_ADMIN" || workPerspective === "SUPER_ADMIN";
    const update: WorkflowChecklistUpdate = { id: `${work.id}-checklist-${record.checklistHistory.length + 1}`, role, questionId, completed, actor: rbacPersonaLabel(workPerspective), recordedAt: workflowTimestamp(record.checklistHistory.length), elevatedOverride, overrideReason: elevatedOverride ? "Master Admin calibration intervention" : undefined };
    const roleAnswers = record.checklistAnswers[role] ?? {};
    setRecords((current) => ({
      ...current,
      [work.id]: {
        ...record,
        checklistAnswers: { ...record.checklistAnswers, [role]: { ...roleAnswers, [questionId]: completed } },
        checklistHistory: [...record.checklistHistory, update],
      },
    }));
    return { ok: true };
  }, [canActOnWorkflow, prototypeMode, records, workPerspective]);

  const setProcessStatus = useCallback((work: FixtureWorkItem, stepId: string, status: WorkflowProcessStatus, evidenceReference = "", overrideReason = "") => {
    if (!prototypeMode) return { ok: false, error: "Authenticated workflow commands require the server-backed work repository." };
    const record = recordForWork(work, records[work.id]);
    if (record.periodLock.locked) return { ok: false, error: "This period is locked by Tax Team and cannot be edited." };
    const currentStep = work.steps.find((step) => step.state === "current" || step.state === "unresolved" || step.state === "blocked");
    const step = work.steps.find((candidate) => candidate.id === stepId);
    const isGateStep = stepId === "prepare" || stepId === "check" || stepId === "review";
    const currentStepIndex = currentStep ? work.steps.findIndex((candidate) => candidate.id === currentStep.id) : -1;
    const stepIndex = step ? work.steps.findIndex((candidate) => candidate.id === step.id) : -1;
    const isCurrentStep = currentStep?.id === stepId;
    const noLaterCompletedStep = work.steps.slice(stepIndex + 1).every((candidate) => record.processStatuses[candidate.id] !== "DONE" && record.processStatuses[candidate.id] !== "NOT_APPLICABLE");
    const isUndo = status === "NOT_STARTED" && record.processStatuses[stepId] === "DONE" && (currentStepIndex === stepIndex + 1 || (currentStepIndex === -1 && noLaterCompletedStep));
    if (!step) return { ok: false, error: "That process step is not configured for this work item." };
    if (isGateStep && (status === "DONE" || status === "NOT_APPLICABLE")) return { ok: false, error: "Complete this step through its certification gate." };
    if (status === "NOT_APPLICABLE" && paymentProcessStepIds.has(stepId) && work.paymentApplicability === "UNRESOLVED") return { ok: false, error: "Resolve payment applicability before skipping the payment branch." };
    if (status === "DONE" && stepId === "payment-confirmation" && (work.paymentAmount === null || work.paymentAmount === undefined || !Number.isFinite(work.paymentAmount) || work.paymentAmount < 0)) return { ok: false, error: "Record the payment amount before confirming payment." };
    if (status === "DONE" && ["filing", "payment-confirmation", "esubmission", "evidence"].includes(stepId) && !evidenceReference.trim()) return { ok: false, error: "Record the filing, payment, submission, or archive reference before marking this step complete." };
    if ((workPerspective === "MASTER_ADMIN" || workPerspective === "SUPER_ADMIN") && !overrideReason.trim()) return { ok: false, error: "Record an override reason when Master Admin updates a workflow step." };
    if (!isCurrentStep && !isUndo) return { ok: false, error: "Only the current process step can be edited." };
    if (!canActOnProcessStep(stepId, work)) return { ok: false, error: `The ${rbacPersonaLabel(workPerspective)} access view cannot update this process step for this taxpayer.` };
    const nextStep = status === "DONE" || status === "NOT_APPLICABLE" ? nextApplicableProcessStep(work, stepIndex) : undefined;
    const nextStatus = nextStep && record.processStatuses[nextStep.id] !== "DONE" && record.processStatuses[nextStep.id] !== "NOT_APPLICABLE" ? "IN_PROGRESS" : undefined;
    const actor = rbacPersonaLabel(workPerspective);
    const recordedAt = workflowTimestamp(record.processHistory.length);
    const elevatedOverride = workPerspective === "MASTER_ADMIN" || workPerspective === "SUPER_ADMIN";
    const updates: WorkflowProcessUpdate[] = [{ id: `${work.id}-process-${record.processHistory.length + 1}`, stepId, status, actor, recordedAt, evidenceReference: evidenceReference.trim() || undefined, elevatedOverride, overrideReason: elevatedOverride ? overrideReason.trim() : undefined }];
    const processStatuses = { ...record.processStatuses, [stepId]: status };
    if (nextStep && nextStatus) {
      processStatuses[nextStep.id] = nextStatus;
      updates.push({ id: `${work.id}-process-${record.processHistory.length + updates.length + 1}`, stepId: nextStep.id, status: nextStatus, actor, recordedAt, elevatedOverride, overrideReason: elevatedOverride ? overrideReason.trim() : undefined });
    }
    if (isUndo && currentStep) {
      processStatuses[currentStep.id] = "NOT_STARTED";
      updates.push({ id: `${work.id}-process-${record.processHistory.length + updates.length + 1}`, stepId: currentStep.id, status: "NOT_STARTED", actor, recordedAt, elevatedOverride, overrideReason: elevatedOverride ? overrideReason.trim() : undefined });
    }
    const activeStepId = nextStep && nextStatus ? nextStep.id : status === "NOT_STARTED" ? stepId : stepId;
    const patch: WorkflowPatch = {
      ...record.patch,
      stage: stageForProcessStep(activeStepId),
      nextAction: actionForProcessStep(activeStepId, processStatuses[activeStepId]),
    };
    setRecords((current) => ({
      ...current,
      [work.id]: {
        ...record,
        patch,
        processStatuses,
        processHistory: [...record.processHistory, ...updates],
      },
    }));
    return { ok: true };
  }, [canActOnProcessStep, prototypeMode, records, workPerspective]);

  const setPaymentAmount = useCallback((work: FixtureWorkItem, amount: number | null) => {
    if (!prototypeMode) return { ok: false, error: "Authenticated workflow commands require the server-backed work repository." };
    const record = recordForWork(work, records[work.id]);
    if (record.periodLock.locked) return { ok: false, error: "This period is locked by Tax Team and cannot be edited." };
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) return { ok: false, error: "Enter a valid non-negative payment amount." };
    const actor = rbacPersonaLabel(workPerspective);
    const recordedAt = workflowTimestamp(record.processHistory.length + record.changeHistory.length);
    const formattedAmount = amount === null ? "Amount cleared" : new Intl.NumberFormat("en-PH", { currency: "PHP", maximumFractionDigits: 2, style: "currency" }).format(amount);
    setRecords((current) => ({
      ...current,
      [work.id]: {
        ...record,
        patch: { ...record.patch, paymentAmount: amount },
        changeHistory: [...record.changeHistory, { id: `${work.id}-change-${record.changeHistory.length + 1}`, kind: "PAYMENT_AMOUNT", detail: `Payment amount · ${formattedAmount}`, actor, recordedAt }],
      },
    }));
    return { ok: true };
  }, [prototypeMode, records, workPerspective]);

  const submitDecision = useCallback((work: FixtureWorkItem, role: WorkflowRole, decision: WorkflowDecision, answers: Record<string, boolean>, note: string, overrideReason = "") => {
    if (!prototypeMode) return { ok: false, error: "Authenticated workflow commands require the server-backed work repository." };
    const record = recordForWork(work, records[work.id]);
    if (record.periodLock.locked) return { ok: false, error: "This period is locked by Tax Team and cannot be edited." };
    if (!canActOnWorkflow(role, work)) return { ok: false, error: `The ${rbacPersonaLabel(workPerspective)} access view cannot record this gate decision for this taxpayer.` };
    if (record.currentGate !== role) return { ok: false, error: `This work is not currently waiting for ${roleLabels[role]} certification.` };
    const questions = roleQuestions[role];
    if (questions.some((question) => !answers[question.id])) return { ok: false, error: "Complete every gate question before recording this decision." };
    if (!note.trim()) return { ok: false, error: "Add a short review note before recording this decision." };
    const elevatedOverride = workPerspective === "MASTER_ADMIN" || workPerspective === "SUPER_ADMIN";
    if (elevatedOverride && !overrideReason.trim()) return { ok: false, error: "Record an override reason when Master Admin records another role's gate decision." };

    const result = transition(role, decision, note.trim());
    const attempt: WorkflowAttempt = { id: `${work.id}-attempt-${record.attempts.length + 1}`, role, decision, note: note.trim(), answers, actor: rbacPersonaLabel(workPerspective), recordedAt: workflowTimestamp(record.attempts.length), elevatedOverride, overrideReason: elevatedOverride ? overrideReason.trim() : undefined };
    const gateStepId = role === "PREPARER" ? "prepare" : role === "CHECKER" ? "check" : "review";
    const gateStatus: WorkflowProcessStatus = decision === "RETURN" ? "NEEDS_ATTENTION" : "DONE";
    const processUpdate: WorkflowProcessUpdate = { id: `${work.id}-process-${record.processHistory.length + 1}`, stepId: gateStepId, status: gateStatus, actor: rbacPersonaLabel(workPerspective), recordedAt: workflowTimestamp(record.processHistory.length), elevatedOverride, overrideReason: elevatedOverride ? overrideReason.trim() : undefined };
    setRecords((current) => ({ ...current, [work.id]: { ...record, currentGate: result.currentGate, patch: result.patch, attempts: [...record.attempts, attempt], processStatuses: { ...record.processStatuses, [gateStepId]: gateStatus }, processHistory: [...record.processHistory, processUpdate] } }));
    return { ok: true, nextGate: result.currentGate };
  }, [canActOnWorkflow, prototypeMode, records, workPerspective]);

  const getModuleAccess = useCallback((module: ModuleKey) => moduleAccessForPersona(workPerspective, module, accessMatrix), [accessMatrix, workPerspective]);
  const canAccess = useCallback((module: ModuleKey, allowed: readonly AccessLevel[] = ["VIEW", "ACT", "APPROVE", "GOVERN", "OVERRIDE"]) => canAccessModule(workPerspective, module, allowed, accessMatrix), [accessMatrix, workPerspective]);
  const value = useMemo<WorkflowContextValue>(() => ({ prototypeMode, clientRegistry, clientRegistryState, refreshClientRegistry, currentRole, setCurrentRole, workPerspective, setWorkPerspective, applyAccessPerspective, accessMatrix, accessPolicyHistory, commitAccessMatrix, canManageAccess, getModuleAccess, canAccessModule: canAccess, getRecord, getEffectiveWork, getWorkItems, createWorkItem, updateWorkItem, deleteWorkItem, isWorkVisible, isClientVisible, canActOnWorkflow, canActOnProcessStep, getProcessStatus, getLatestProcessUpdate, setPaymentAmount, getPeriodLock, setPeriodLock, setProcessStatus, getChecklistAnswers, setChecklistAnswer, getQuestions: (role: WorkflowRole) => roleQuestions[role], submitDecision }), [accessMatrix, accessPolicyHistory, applyAccessPerspective, canAccess, canActOnProcessStep, canActOnWorkflow, canManageAccess, clientRegistry, clientRegistryState, commitAccessMatrix, createWorkItem, currentRole, deleteWorkItem, getChecklistAnswers, getEffectiveWork, getLatestProcessUpdate, getModuleAccess, getPeriodLock, getProcessStatus, getRecord, getWorkItems, isClientVisible, isWorkVisible, prototypeMode, refreshClientRegistry, setChecklistAnswer, setPaymentAmount, setPeriodLock, setProcessStatus, submitDecision, updateWorkItem, workPerspective]);
  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>;
}

export function useWorkflow() {
  const value = useContext(WorkflowContext);
  if (!value) throw new Error("useWorkflow must be used inside WorkflowProvider");
  return value;
}

export function workflowRoleLabel(role: WorkflowRole) {
  return roleLabels[role];
}

export function workflowPerspectiveLabel(perspective: WorkflowPerspective) {
  return rbacPersonaLabel(perspective);
}

export function workflowPerspectiveDescription(perspective: WorkflowPerspective) {
  return rbacPersonaDescription(perspective);
}
