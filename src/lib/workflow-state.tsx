"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { canAccessModule, cloneAccessMatrix, isAccessMatrix, moduleAccessForPersona, rbacPersonaDescription, rbacPersonaLabel, type AccessLevel, type AccessMatrix, type ModuleKey, type RbacPersona } from "@/lib/domain/access";
import { fixtureClients, fixtureClock, fixtureOrgDirectoryMembers, fixtureWork, type FixtureClient, type FixtureDataReadiness, type FixturePaymentApplicability, type FixtureStatus, type FixtureWorkItem } from "@/lib/fixtures";
import { applySavedCalibrationToClient, prototypeClientProfileUpdatedEvent } from "@/lib/domain/client-profile-persistence";
import { clientIsAssignedForRole, clientMatchesPerspective, staffMemberIdForPerspective } from "@/lib/domain/team";
import { towerForScopeFilter } from "@/lib/domain/organization-catalog";
import { portfolioClientToFixtureClient } from "@/lib/domain/live-client-adapter";
import { getFixtureOperationalRecords, getLiveOperationalRecords, type FixtureOperationalRecord } from "@/lib/fixtures-read-model";
import { isPrototypeEmptyMode } from "@/lib/supabase/config";
export { workflowProcessRole, workflowProcessRoleLabel } from "@/lib/workflow-rules";
import { actionForProcessStep, applyWorkflowStepState, autoStartProcessStep, currentProcessStepId, isValidTaxDueAmount, nextApplicableProcessStep, paymentProcessStepIds, recordForWork, roleLabels, roleQuestions, stageForProcessStep, transition, workflowProcessRole, workflowTimestamp, workMatchesPerspective } from "@/lib/workflow-rules";

export type WorkflowRole = "PREPARER" | "CHECKER" | "REVIEWER";
export type WorkflowProcessOwner = WorkflowRole | "TAX_CONTROL";
export type WorkflowPerspective = RbacPersona;

function prototypeClientRegistry() {
  return fixtureClients.map(applySavedCalibrationToClient);
}
export type WorkflowDecision = "CERTIFY" | "APPROVE" | "RETURN";

export function canUseElevatedOverride(perspective: WorkflowPerspective) {
  return perspective === "TAX_CONTROL" || perspective === "MASTER_ADMIN" || perspective === "SUPER_ADMIN";
}

export type WorkflowQuestion = { id: string; label: string };
export type WorkflowAttempt = {
  id: string;
  role: WorkflowRole;
  decision: WorkflowDecision;
  note: string;
  answers: Record<string, boolean>;
  taxDueAmount?: number;
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
  completedOn?: string;
  acknowledgedOn?: string;
  validatedOn?: string;
  attachmentName?: string;
  sharepointUrl?: string;
  elevatedOverride?: boolean;
  overrideReason?: string;
};
export type WorkflowArchiveFacts = {
  filingDate?: string;
  filingReferenceNumber?: string;
  proceedToPay?: string;
  paymentAcknowledgementDate?: string;
  paymentAcknowledgement?: string;
  eSubmissionSubmission?: string;
  eSubmissionSubmissionDate?: string;
  birAcknowledgedDate?: string;
  birValidatedDate?: string;
  attachmentName?: string;
};
export type WorkflowChangeEvent = {
  id: string;
  kind: "PAYMENT_AMOUNT" | "PAYMENT_PROFILE";
  detail: string;
  actor: string;
  recordedAt: string;
};
export type WorkflowFinalCertification = {
  actor: string;
  recordedAt: string;
  note: string;
  elevatedOverride?: boolean;
  overrideReason?: string;
};
export type WorkflowPeriodLock = {
  locked: boolean;
  periodKey?: string;
  periodLabel?: string;
  returnCode?: string;
  returnLabel?: string;
  dueDate?: string | null;
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
  dataReadiness?: FixtureDataReadiness;
  archiveFacts?: WorkflowArchiveFacts;
  changeHistory: readonly WorkflowChangeEvent[];
  periodLock: WorkflowPeriodLock;
  periodLockHistory: readonly WorkflowPeriodLock[];
  finalCertification?: WorkflowFinalCertification;
};

export type WorkflowPatch = {
  stage?: FixtureWorkItem["stage"];
  status?: FixtureStatus;
  statusReason?: string;
  nextAction?: string;
  returnedFrom?: string;
  blocker?: FixtureWorkItem["blocker"] | null;
  paymentApplicability?: FixturePaymentApplicability;
  paymentAmount?: number | null;
};

export type StoredWorkflowRecord = WorkflowRecord & { patch: WorkflowPatch };

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

const periodMonths = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"] as const;

export function workPeriodKey(work: Pick<FixtureWorkItem, "period" | "periodKey">) {
  if (work.periodKey?.trim()) return work.periodKey.trim();
  const month = work.period.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(20\d{2})\b/i);
  if (month) {
    const monthIndex = periodMonths.findIndex((name) => name.startsWith(month[1].toLowerCase().slice(0, 3)));
    if (monthIndex >= 0) return `${month[2]}-${String(monthIndex + 1).padStart(2, "0")}`;
  }
  const year = work.period.match(/\b(20\d{2})\b/);
  return year ? `FY-${year[1]}` : work.period.trim().toLowerCase().replace(/\s+/g, "-");
}

export function workReturnCode(work: Pick<FixtureWorkItem, "requirementCode" | "title">) {
  return work.requirementCode?.trim().toUpperCase() || work.title.trim().toUpperCase();
}

export function workReturnLockKey(work: Pick<FixtureWorkItem, "period" | "periodKey" | "requirementCode" | "title">) {
  return `${workPeriodKey(work)}::${workReturnCode(work)}`;
}

const workAdminStorageKey = "taxmonweb.prototype.work-register";
const accessPerspectiveStorageKey = "taxmonweb.prototype.access-perspective";
const accessMatrixStorageKey = "taxmonweb.prototype.access-matrix";
const accessHistoryStorageKey = "taxmonweb.prototype.access-history";
const periodLocksStorageKey = "taxmonweb.prototype.period-locks";

function prototypeWorkSeed(): FixtureWorkItem[] {
  return fixtureWork.map((work) => work.id === "work-02"
    ? {
        ...work,
        detail: "Payment applies; record the amount during Checker certification.",
        stage: "PREPARE",
        nextAction: "Complete preparation",
        status: "AMBER",
        statusReason: "The return package is reset for a fresh Preparer certification.",
        steps: work.steps.map((step, index) => ({ ...step, state: index === 0 ? "current" : "not-started" })),
        components: work.components.map((component) => component.label === "Payment" ? { ...component, state: "Required · amount not recorded", detail: "Record the amount during Checker certification." } : { ...component, state: component.label === "Submission" ? "Not started" : component.label === "Attachments" ? "Waiting" : "Not started" }),
        returnedFrom: undefined,
      }
    : work);
}

function readPrototypeState(key: string) {
  return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
}

export type AccessPolicyEvent = { id: string; actor: string; recordedAt: string; reason: string };

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
  getOperationalRecords: () => readonly FixtureOperationalRecord[];
  operationalToday: string;
  createWorkItem: (input: WorkAdminInput) => { ok: boolean; work?: FixtureWorkItem; error?: string };
  createLiveWorkItem: (input: WorkAdminInput) => Promise<{ ok: boolean; workId?: string; error?: string }>;
  updateWorkItem: (workId: string, input: WorkAdminInput) => { ok: boolean; work?: FixtureWorkItem; error?: string };
  deleteWorkItem: (workId: string) => { ok: boolean; error?: string };
  isWorkVisible: (work: FixtureWorkItem) => boolean;
  isClientVisible: (client: FixtureClient) => boolean;
  canActOnWorkflow: (role: WorkflowRole, work?: FixtureWorkItem) => boolean;
  canActOnProcessStep: (stepId: string, work?: FixtureWorkItem) => boolean;
  getProcessStatus: (work: FixtureWorkItem, stepId: string) => WorkflowProcessStatus;
  getLatestProcessUpdate: (work: FixtureWorkItem, stepId: string) => WorkflowProcessUpdate | undefined;
  setPaymentApplicability: (work: FixtureWorkItem, applicability: FixturePaymentApplicability) => Promise<{ ok: boolean; error?: string }>;
  setPaymentAmount: (work: FixtureWorkItem, amount: number | null) => Promise<{ ok: boolean; error?: string }>;
  getPeriodLock: (work: FixtureWorkItem) => WorkflowPeriodLock;
  setPeriodLock: (work: FixtureWorkItem, locked: boolean, reason: string) => Promise<{ ok: boolean; error?: string }>;
  setProcessStatus: (work: FixtureWorkItem, stepId: string, status: WorkflowProcessStatus, evidenceReference?: string, overrideReason?: string, sharepointUrl?: string, completedOn?: string, acknowledgedOn?: string, validatedOn?: string, attachmentName?: string, archiveFacts?: WorkflowArchiveFacts, paymentAmountOverride?: number | null) => Promise<{ ok: boolean; error?: string }>;
  setDataReadiness: (work: FixtureWorkItem, ready: boolean, source: "CLIENT_RECORDS" | "TMF_BOOKS", reason: string) => Promise<{ ok: boolean; error?: string }>;
  getChecklistAnswers: (work: FixtureWorkItem, role: WorkflowRole) => Readonly<Record<string, boolean>>;
  setChecklistAnswer: (work: FixtureWorkItem, role: WorkflowRole, questionId: string, completed: boolean) => Promise<{ ok: boolean; error?: string }>;
  getQuestions: (role: WorkflowRole) => readonly WorkflowQuestion[];
  submitDecision: (work: FixtureWorkItem, role: WorkflowRole, decision: WorkflowDecision, answers: Record<string, boolean>, note: string, overrideReason?: string, gateStatus?: "DONE" | "NOT_APPLICABLE", taxDueAmount?: number | null, paymentAmount?: number | null) => Promise<{ ok: boolean; error?: string; nextGate?: WorkflowRole | null }>;
  recordFinalCertification: (work: FixtureWorkItem, note: string, overrideReason?: string) => Promise<{ ok: boolean; error?: string }>;
};

const WorkflowContext = createContext<WorkflowContextValue | null>(null);

export function WorkflowProvider({ children, prototypeMode = false }: { children: React.ReactNode; prototypeMode?: boolean }) {
  type LivePortfolioRecord = Parameters<typeof portfolioClientToFixtureClient>[0];
  const emptyPrototypeMode = prototypeMode && isPrototypeEmptyMode();
  const [currentRole, setCurrentRole] = useState<WorkflowRole>("PREPARER");
  const [workPerspective, setWorkPerspective] = useState<WorkflowPerspective>(prototypeMode ? "SUPER_ADMIN" : "MASTER_ADMIN");
  const [accessMatrix, setAccessMatrix] = useState<AccessMatrix>(() => cloneAccessMatrix());
  const [accessPolicyHistory, setAccessPolicyHistory] = useState<AccessPolicyEvent[]>([]);
  const [accessPerspectiveHydrated, setAccessPerspectiveHydrated] = useState(() => !prototypeMode);
  const [accessMatrixHydrated, setAccessMatrixHydrated] = useState(() => !prototypeMode);
  const [recordsHydrated, setRecordsHydrated] = useState(() => !prototypeMode || emptyPrototypeMode);
  const [workItemsHydrated, setWorkItemsHydrated] = useState(() => !prototypeMode || emptyPrototypeMode);
  const [records, setRecords] = useState<Record<string, StoredWorkflowRecord>>({});
  const [periodLocks, setPeriodLocks] = useState<Record<string, WorkflowPeriodLock>>({});
  const [clientRegistry, setClientRegistry] = useState<FixtureClient[]>(() => prototypeMode && !emptyPrototypeMode ? [...fixtureClients] : []);
  const [clientRegistryState, setClientRegistryState] = useState<"loading" | "connected" | "empty" | "error">(() => prototypeMode && !emptyPrototypeMode ? "connected" : prototypeMode ? "empty" : "loading");
  const clientRegistryRequest = useRef<Promise<readonly FixtureClient[]> | null>(null);
  const [operationalRecords, setOperationalRecords] = useState<FixtureOperationalRecord[]>([]);
  const [operationalRecordsHydrated, setOperationalRecordsHydrated] = useState(prototypeMode);
  // Production starts with an empty server-backed projection. The fixture
  // work register exists only for the explicit sanitized prototype mode.
  const [workItems, setWorkItems] = useState<FixtureWorkItem[]>(() => prototypeMode && !emptyPrototypeMode ? prototypeWorkSeed() : []);

  const refreshClientRegistry = useCallback(async () => {
    if (prototypeMode) {
      const clients = prototypeClientRegistry();
      setClientRegistry(clients);
      setClientRegistryState(clients.length > 0 ? "connected" : "empty");
      return clients;
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
    if (!prototypeMode || emptyPrototypeMode) return;
    const syncPrototypeClient = () => { void refreshClientRegistry(); };
    window.addEventListener(prototypeClientProfileUpdatedEvent, syncPrototypeClient);
    window.addEventListener("storage", syncPrototypeClient);
    return () => {
      window.removeEventListener(prototypeClientProfileUpdatedEvent, syncPrototypeClient);
      window.removeEventListener("storage", syncPrototypeClient);
    };
  }, [emptyPrototypeMode, prototypeMode, refreshClientRegistry]);

  useEffect(() => {
    if (!prototypeMode || emptyPrototypeMode) return;
    try {
      // Temporary prototype policy: operate as one Super Admin until the
      // production access model is reintroduced and assigned deliberately.
      window.localStorage.removeItem(accessPerspectiveStorageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWorkPerspective("SUPER_ADMIN");
      setAccessPerspectiveHydrated(true);
    } catch {
      // Keep the default Super Admin lens when browser storage is unavailable.
      setAccessPerspectiveHydrated(true);
    }
  }, [emptyPrototypeMode, prototypeMode]);

  useEffect(() => {
    if (prototypeMode) return;
    let cancelled = false;
    fetch("/api/work", { headers: { accept: "application/json" }, cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { data?: FixtureWorkItem[]; operationalRecords?: FixtureOperationalRecord[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Unable to load generated compliance work.");
        if (!cancelled) {
          const nextWork = payload.data ?? [];
          setWorkItems(nextWork);
          setOperationalRecords(payload.operationalRecords ?? []);
          setOperationalRecordsHydrated(true);
        }
      })
      .catch(() => { if (!cancelled) { setWorkItems([]); setOperationalRecords([]); setOperationalRecordsHydrated(true); } });
    return () => { cancelled = true; };
  }, [prototypeMode]);

  useEffect(() => {
    if (!accessPerspectiveHydrated) return;
    if (!prototypeMode || emptyPrototypeMode) return;
    try {
      window.localStorage.setItem(accessPerspectiveStorageKey, workPerspective);
    } catch {
      // The selector remains usable for the current session when storage is unavailable.
    }
  }, [accessPerspectiveHydrated, emptyPrototypeMode, prototypeMode, workPerspective]);

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
  }, [emptyPrototypeMode, prototypeMode]);

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
    const nextPerspective = prototypeMode ? "SUPER_ADMIN" : perspective;
    setCurrentRole(nextPerspective === "PREPARER" || nextPerspective === "CHECKER" || nextPerspective === "REVIEWER" ? nextPerspective : "PREPARER");
    setWorkPerspective(nextPerspective);
  }, [prototypeMode]);

  const canManageAccess = prototypeMode && ["MASTER_ADMIN", "TAX_CONTROL", "SUPER_ADMIN"].includes(workPerspective);
  const commitAccessMatrix = useCallback((matrix: AccessMatrix, reason: string) => {
    if (!prototypeMode) return { ok: false, error: "Authenticated access templates are managed by server-side administration." };
    if (!canManageAccess) return { ok: false, error: "Only HOD, Tax Control or Super Admin can change access templates in this prototype." };
    if (!reason.trim()) return { ok: false, error: "Record a reason for this access change." };
    const event: AccessPolicyEvent = { id: `access-${Date.now()}`, actor: rbacPersonaLabel(workPerspective), recordedAt: fixtureClock.timestampLabel, reason: reason.trim() };
    setAccessMatrix(matrix);
    setAccessPolicyHistory((events) => [...events, event]);
    return { ok: true };
  }, [canManageAccess, prototypeMode, workPerspective]);

  useEffect(() => {
    try {
      if (!prototypeMode || emptyPrototypeMode) return;
      const storedRecords = readPrototypeState("taxmonweb.prototype.workflow-records");
      const parsedRecords = storedRecords ? JSON.parse(storedRecords) as Record<string, StoredWorkflowRecord> : null;
      if (parsedRecords && typeof parsedRecords === "object" && !Array.isArray(parsedRecords)) {
        // Hydrate browser-local workflow history after SSR; production persistence is server-owned.
        // Hydration is intentionally an external-storage synchronization.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRecords(parsedRecords);
      }
      const storedWorkItems = readPrototypeState(workAdminStorageKey);
      const parsedWorkItems = storedWorkItems ? JSON.parse(storedWorkItems) as FixtureWorkItem[] : null;
      const hydratedWorkItems = Array.isArray(parsedWorkItems)
        ? parsedWorkItems.map((item) => {
          const baseline = fixtureWork.find((fixture) => fixture.id === item.id);
          return baseline ? { ...item, requirementCode: item.requirementCode ?? baseline.requirementCode, dueDate: item.dueDate ?? baseline.dueDate } : item;
        })
        : null;
      const validStoredWorkItems = Array.isArray(hydratedWorkItems) && hydratedWorkItems.every((item) => typeof item.id === "string" && typeof item.clientId === "string" && typeof item.title === "string");
      if (validStoredWorkItems) {
        setWorkItems(hydratedWorkItems);
      }
      const storedPeriodLocks = readPrototypeState(periodLocksStorageKey);
      const parsedPeriodLocks = storedPeriodLocks ? JSON.parse(storedPeriodLocks) as Record<string, WorkflowPeriodLock> : null;
      const nextPeriodLocks = parsedPeriodLocks && typeof parsedPeriodLocks === "object" && !Array.isArray(parsedPeriodLocks)
        ? Object.fromEntries(Object.entries(parsedPeriodLocks).filter(([key]) => key.includes("::")))
        : {};
      const migrationWorkItems = validStoredWorkItems ? hydratedWorkItems : fixtureWork;
      for (const item of migrationWorkItems) {
        const legacyLock = parsedRecords?.[item.id]?.periodLock;
        const key = workReturnLockKey(item);
        if (legacyLock?.locked && legacyLock.returnCode && !nextPeriodLocks[key]) nextPeriodLocks[key] = { ...legacyLock, periodKey: workPeriodKey(item), periodLabel: item.period, returnCode: workReturnCode(item) };
      }
      setPeriodLocks(nextPeriodLocks);
    } catch {
      // Keep the shipped fixture baseline when browser storage is unavailable or malformed.
    }
    setRecordsHydrated(true);
    setWorkItemsHydrated(true);
  }, [emptyPrototypeMode, prototypeMode]);

  useEffect(() => {
    try {
      if (prototypeMode && !emptyPrototypeMode && recordsHydrated) window.localStorage.setItem(periodLocksStorageKey, JSON.stringify(periodLocks));
    } catch {
      // Prototype period closes remain available for the current render when storage is unavailable.
    }
  }, [emptyPrototypeMode, periodLocks, prototypeMode, recordsHydrated]);

  useEffect(() => {
    try {
      if (prototypeMode && !emptyPrototypeMode && recordsHydrated) {
        window.localStorage.setItem("taxmonweb.prototype.workflow-records", JSON.stringify(records));
      }
    } catch {
      // Workflow edits remain available for the current render when storage is unavailable.
    }
  }, [emptyPrototypeMode, prototypeMode, records, recordsHydrated]);

  useEffect(() => {
    try {
      if (prototypeMode && !emptyPrototypeMode && workItemsHydrated) {
        window.localStorage.setItem(workAdminStorageKey, JSON.stringify(workItems));
      }
    } catch {
      // Prototype edits remain available for the current render when storage is unavailable.
    }
  }, [emptyPrototypeMode, prototypeMode, workItems, workItemsHydrated]);

  const getRecord = useCallback((work: FixtureWorkItem): WorkflowRecord => {
    const storedRecord = recordForWork(work, records[work.id]);
    const record = storedRecord.periodLock.returnCode ? storedRecord : { ...storedRecord, periodLock: { locked: false }, periodLockHistory: [] };
    const periodLock = periodLocks[workReturnLockKey(work)];
    if (!periodLock) return record;
    const periodLockHistory = record.periodLockHistory.some((event) => event.recordedAt === periodLock.recordedAt) ? record.periodLockHistory : [...record.periodLockHistory, periodLock];
    return { ...record, periodLock, periodLockHistory };
  }, [periodLocks, records]);

  const getEffectiveWork = useCallback((work: FixtureWorkItem): FixtureWorkItem => {
    // Always project through the normalized initial record. Raw fixture state
    // may contain a stale visual `current` marker after a later component was
    // completed; bypassing this projection leaves the next applicable step
    // locked on first load.
    const record = recordForWork(work, records[work.id]);
    const { blocker: baseBlocker, ...workWithoutBlocker } = work;
    const { blocker: patchedBlocker, ...patchWithoutBlocker } = record.patch;
    const stage = record.patch.stage ?? work.stage;
    const blocker = patchedBlocker === undefined ? baseBlocker : patchedBlocker;
    const clientApprovalComplete = record.processStatuses["client-approval"] === "DONE" || record.processStatuses["client-approval"] === "NOT_APPLICABLE" || work.steps.find((step) => step.id === "client-approval")?.state === "complete";
    const staleClientApprovalBlocker = blocker?.category === "CLIENT APPROVAL" && clientApprovalComplete;
    const effectiveBlocker = blocker === null || staleClientApprovalBlocker ? undefined : blocker;
    const effectiveWork = { ...workWithoutBlocker, ...patchWithoutBlocker, ...(effectiveBlocker ? { blocker: effectiveBlocker } : {}) };
    const steps = applyWorkflowStepState(effectiveWork, record.currentGate, stage, record.processStatuses);
    const activeStep = steps.find((step) => step.state === "current" || step.state === "unresolved" || step.state === "blocked");
    const activeStatus = activeStep ? record.processStatuses[activeStep.id] : undefined;
    const derivedNextAction = activeStep && activeStatus ? actionForProcessStep(activeStep.id, activeStatus) : undefined;
    const packageComplete = steps.length > 0 && steps.every((step) => step.state === "complete");
    const nextAction = packageComplete ? "No action due" : !effectiveWork.blocker && derivedNextAction ? derivedNextAction : effectiveWork.nextAction;
    const statusReason = packageComplete ? "Return package complete." : !effectiveWork.blocker && activeStep && activeStatus ? actionForProcessStep(activeStep.id, activeStatus) ?? effectiveWork.statusReason : effectiveWork.statusReason;
    const status = packageComplete && !effectiveWork.blocker ? "GREEN" : effectiveWork.status;
    return { ...effectiveWork, nextAction, statusReason, status, steps };
  }, [records]);

  const getWorkItems = useCallback(() => workItems, [workItems]);
  const getOperationalRecords = useCallback(() => {
    if (prototypeMode) {
      return getFixtureOperationalRecords(workItems);
    }
    return operationalRecordsHydrated ? operationalRecords : getLiveOperationalRecords(workItems);
  }, [operationalRecords, operationalRecordsHydrated, prototypeMode, workItems]);
  const refreshLiveWork = useCallback(async () => {
    if (prototypeMode) return workItems;
    const response = await fetch("/api/work", { headers: { accept: "application/json" }, cache: "no-store" });
    const payload = await response.json() as { data?: FixtureWorkItem[]; operationalRecords?: FixtureOperationalRecord[]; error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Unable to load generated compliance work.");
    const nextWork = payload.data ?? [];
    setWorkItems(nextWork);
    setOperationalRecords(payload.operationalRecords ?? []);
    setOperationalRecordsHydrated(true);
    return nextWork;
  }, [prototypeMode, workItems]);

  const executeLiveCommand = useCallback(async (work: FixtureWorkItem, command: string, payload: Record<string, unknown>) => {
    const idempotencyKey = globalThis.crypto?.randomUUID?.() ?? `${work.id}-${command}-${Date.now()}`;
    const response = await fetch(`/api/work/${encodeURIComponent(work.id)}`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ command, payload, idempotencyKey }),
    });
    const result = await response.json() as { data?: Record<string, unknown>; error?: string };
    if (!response.ok) return { ok: false, error: result.error ?? "The Work command could not be recorded." };
    await refreshLiveWork();
    return { ok: true, data: result.data };
  }, [refreshLiveWork]);

  const createLiveWorkItem = useCallback(async (input: WorkAdminInput) => {
    if (prototypeMode) return { ok: false, error: "Live Work creation is unavailable in prototype mode." };
    const idempotencyKey = globalThis.crypto?.randomUUID?.() ?? `manual-work-${Date.now()}`;
    const response = await fetch("/api/work", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({
        clientId: input.clientId,
        title: input.title,
        period: input.period,
        deadline: input.deadline,
        idempotencyKey,
      }),
    });
    const result = await response.json() as { data?: { id?: string }; error?: string };
    if (!response.ok) return { ok: false, error: result.error ?? "The Work record could not be created." };
    await refreshLiveWork();
    return { ok: true, workId: result.data?.id };
  }, [prototypeMode, refreshLiveWork]);
  const buildWorkItem = useCallback((input: WorkAdminInput, existing?: FixtureWorkItem): { work?: FixtureWorkItem; error?: string } => {
    const client = fixtureClients.find((candidate) => candidate.id === input.clientId);
    if (!client) return { error: "Choose a taxpayer before saving the work item." };
    if (!input.title.trim() || !input.period.trim() || !input.deadline.trim() || !input.owner.trim()) return { error: "Complete the return, period, target, and starting owner fields." };

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
            { id: "esubmission", label: "Attachments", state: "not-started", detail: "Complete the applicable attachment or eSubmission sequence and retain its validation and acknowledgment results." },
            { id: "evidence", label: "Archiving", state: "not-started", detail: "Compile and save the complete return package, including filing, payment, and eSubmission evidence." },
          ],
          components: [
            { label: "Submission", state: "Not started", detail: "The work item has not been submitted." },
            { label: "Payment", state: "Applicability unresolved", detail: "Resolve payment applicability before skipping the payment branch." },
            { label: "Attachments", state: "Not configured", detail: "Attachment requirements are not configured for this prototype record." },
            { label: "Evidence", state: "Not started", detail: "Evidence follows the relevant action." },
          ],
          blocker: { category: "CLIENT DATA", reason: "Data readiness is not confirmed." },
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
        nextAction: input.nextAction.trim() || "Complete preparation",
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
    if (periodLocks[workReturnLockKey(result.work)]?.locked) return { ok: false, error: "This return and compliance period are locked by Tax Team and cannot accept new work." };
    setWorkItems((current) => [...current, result.work!]);
    return { ok: true, work: result.work };
  }, [buildWorkItem, periodLocks, prototypeMode]);

  const updateWorkItem = useCallback((workId: string, input: WorkAdminInput) => {
    if (!prototypeMode) return { ok: false, error: "Authenticated work commands require the server-backed work repository." };
    const current = workItems.find((item) => item.id === workId);
    if (!current) return { ok: false, error: "That work item is no longer in the register." };
    if (periodLocks[workReturnLockKey(current)]?.locked || (recordForWork(current, records[current.id]).periodLock.returnCode && recordForWork(current, records[current.id]).periodLock.locked)) return { ok: false, error: "This return and compliance period are locked by Tax Team and cannot be edited." };
    const result = buildWorkItem(input, current);
    if (!result.work) return { ok: false, error: result.error };
    setWorkItems((items) => items.map((item) => item.id === workId ? result.work! : item));
    return { ok: true, work: result.work };
  }, [buildWorkItem, periodLocks, prototypeMode, records, workItems]);

  const deleteWorkItem = useCallback((workId: string) => {
    if (!prototypeMode) return { ok: false, error: "Authenticated work commands require the server-backed work repository." };
    if (!workItems.some((item) => item.id === workId)) return { ok: false, error: "That work item is no longer in the register." };
    const work = workItems.find((item) => item.id === workId)!;
    if (periodLocks[workReturnLockKey(work)]?.locked || (recordForWork(work, records[work.id]).periodLock.returnCode && recordForWork(work, records[work.id]).periodLock.locked)) return { ok: false, error: "This return and compliance period are locked by Tax Team and cannot be removed." };
    setWorkItems((items) => items.filter((item) => item.id !== workId));
    return { ok: true };
  }, [periodLocks, prototypeMode, records, workItems]);

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

  const setPeriodLock = useCallback(async (work: FixtureWorkItem, locked: boolean, reason: string) => {
    const periodKey = workPeriodKey(work);
    const lockKey = workReturnLockKey(work);
    const returnCode = workReturnCode(work);
    if (!prototypeMode) return executeLiveCommand(work, "period_lock", { locked, periodKey, periodLabel: work.period, returnCode, reason });
    if (!["TAX_CONTROL", "MASTER_ADMIN", "SUPER_ADMIN"].includes(workPerspective)) return { ok: false, error: "Only Tax Team or an authorized HOD can control return locks." };
    if (!reason.trim()) return { ok: false, error: `Add a short reason for ${locked ? "locking" : "reopening"} ${returnCode}.` };
    const returnWork = workItems.filter((item) => workReturnLockKey(item) === lockKey);
    const currentLock = periodLocks[lockKey];
    if (!locked && !currentLock?.locked) return { ok: false, error: `${returnCode} is not currently locked for ${work.period}.` };
    if (locked && currentLock?.locked) return { ok: false, error: `${returnCode} is already locked for ${work.period}.` };
    if (locked) {
      const dueDates = returnWork.map((item) => item.dueDate ?? (/^20\d{2}-\d{2}-\d{2}$/.test(item.deadline) ? item.deadline : null));
      if (dueDates.some((date) => !date)) return { ok: false, error: `${returnCode} has an unresolved due date and cannot be locked.` };
      const knownDueDates = dueDates.filter((date): date is string => Boolean(date));
      const latestDueDate = knownDueDates.reduce((latest, date) => date > latest ? date : latest, knownDueDates[0]);
      const today = prototypeMode ? fixtureClock.today : new Date().toISOString().slice(0, 10);
      if (latestDueDate > today) return { ok: false, error: `${returnCode} cannot be locked before its due date (${latestDueDate}).` };
    }
    const periodLock: WorkflowPeriodLock = { locked, periodKey, periodLabel: work.period, returnCode, returnLabel: work.title, dueDate: work.dueDate ?? null, actor: rbacPersonaLabel(workPerspective), recordedAt: workflowTimestamp(Object.keys(periodLocks).length), reason: reason.trim(), elevatedOverride: workPerspective !== "TAX_CONTROL" };
    setPeriodLocks((current) => ({ ...current, [lockKey]: periodLock }));
    setRecords((current) => {
      const next = { ...current };
      for (const item of returnWork) {
        const record = recordForWork(item, current[item.id]);
        next[item.id] = { ...record, periodLock, periodLockHistory: [...record.periodLockHistory, periodLock] };
      }
      return next;
    });
    return { ok: true };
  }, [executeLiveCommand, periodLocks, prototypeMode, workItems, workPerspective]);

  const recordFinalCertification = useCallback(async (work: FixtureWorkItem, note: string, overrideReason = "") => {
    if (!prototypeMode) return executeLiveCommand(work, "final_certification", { note, overrideReason });
    const record = recordForWork(work, records[work.id]);
    if (periodLocks[workReturnLockKey(work)]?.locked || record.periodLock.locked) return { ok: false, error: "This return and compliance period are locked by Tax Team and cannot be edited." };
    if (record.currentGate || record.processStatuses.evidence !== "DONE") return { ok: false, error: "Reviewer final certification is available only after all gates and Archiving are complete." };
    if (!note.trim()) return { ok: false, error: "Add a short final certification note." };
    if (!canUseElevatedOverride(workPerspective) && workPerspective !== "REVIEWER") return { ok: false, error: "Only Reviewer or an authorized elevated role can certify closure." };
    const elevatedOverride = canUseElevatedOverride(workPerspective) && Boolean(overrideReason.trim());
    if (elevatedOverride && !overrideReason.trim()) return { ok: false, error: "Record an override reason for elevated final certification." };
    const finalCertification: WorkflowFinalCertification = { actor: rbacPersonaLabel(workPerspective), recordedAt: workflowTimestamp(record.processHistory.length + record.attempts.length), note: note.trim(), elevatedOverride, overrideReason: elevatedOverride ? overrideReason.trim() : undefined };
    setRecords((current) => ({ ...current, [work.id]: { ...record, finalCertification, patch: { ...record.patch, status: "GREEN", statusReason: "Reviewer final certification recorded.", nextAction: "Tax Team QA sample or period close" } } }));
    return { ok: true };
  }, [executeLiveCommand, periodLocks, prototypeMode, records, workPerspective]);

  const setChecklistAnswer = useCallback(async (work: FixtureWorkItem, role: WorkflowRole, questionId: string, completed: boolean) => {
    if (!prototypeMode) return executeLiveCommand(work, "checklist", { role: role.toLowerCase(), questionId, completed });
    const record = recordForWork(work, records[work.id]);
    if (periodLocks[workReturnLockKey(work)]?.locked || record.periodLock.locked) return { ok: false, error: "This return and compliance period are locked by Tax Team and cannot be edited." };
    if (!roleQuestions[role].some((question) => question.id === questionId)) return { ok: false, error: "That checklist item is not configured for this responsibility." };
    if (!canActOnWorkflow(role, work)) return { ok: false, error: `The ${rbacPersonaLabel(workPerspective)} access view cannot update this checklist for this taxpayer.` };
    const update: WorkflowChecklistUpdate = { id: `${work.id}-checklist-${record.checklistHistory.length + 1}`, role, questionId, completed, actor: rbacPersonaLabel(workPerspective), recordedAt: workflowTimestamp(record.checklistHistory.length) };
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
  }, [canActOnWorkflow, executeLiveCommand, periodLocks, prototypeMode, records, workPerspective]);

  const setProcessStatus = useCallback(async (work: FixtureWorkItem, stepId: string, status: WorkflowProcessStatus, evidenceReference = "", overrideReason = "", sharepointUrl = "", completedOn = "", acknowledgedOn = "", validatedOn = "", attachmentName = "", archiveFacts?: WorkflowArchiveFacts, paymentAmountOverride?: number | null) => {
    if (!prototypeMode) return executeLiveCommand(work, "process_status", { stepCode: stepId, status: status.toLowerCase(), evidenceReference, overrideReason, sharepointUrl, externalDate: completedOn, acknowledgedOn, validatedOn, attachmentName, ...(archiveFacts ? { note: JSON.stringify({ archiveFacts }) } : {}), ...(paymentAmountOverride !== undefined ? { paymentAmount: paymentAmountOverride } : {}), role: workflowProcessRole(stepId).toLowerCase() });
    const record = recordForWork(work, records[work.id]);
    if (periodLocks[workReturnLockKey(work)]?.locked || record.periodLock.locked) return { ok: false, error: "This return and compliance period are locked by Tax Team and cannot be edited." };
    const normalizedCurrentStepId = currentProcessStepId(work, record.processStatuses);
    const currentStep = normalizedCurrentStepId ? work.steps.find((step) => step.id === normalizedCurrentStepId) : undefined;
    const step = work.steps.find((candidate) => candidate.id === stepId);
    const isGateStep = stepId === "prepare" || stepId === "check" || stepId === "review";
    const currentStepIndex = currentStep ? work.steps.findIndex((candidate) => candidate.id === currentStep.id) : -1;
    const stepIndex = step ? work.steps.findIndex((candidate) => candidate.id === step.id) : -1;
    const isCurrentStep = currentStep?.id === stepId;
    const noLaterCompletedStep = work.steps.slice(stepIndex + 1).every((candidate) => record.processStatuses[candidate.id] !== "DONE" && record.processStatuses[candidate.id] !== "NOT_APPLICABLE");
    const isUndo = status === "NOT_STARTED" && record.processStatuses[stepId] === "DONE" && (currentStepIndex === stepIndex + 1 || (currentStepIndex === -1 && noLaterCompletedStep));
    if (!step) return { ok: false, error: "That process step is not configured for this work item." };
    if (isUndo && !canUseElevatedOverride(workPerspective)) return { ok: false, error: "A completed step can only be corrected by an authorized override." };
    if (isUndo && !overrideReason.trim()) return { ok: false, error: "Record an override reason before correcting a completed step." };
    if (isGateStep && (status === "DONE" || status === "NOT_APPLICABLE")) return { ok: false, error: "Complete this step through its certification gate." };
    if (status === "NOT_APPLICABLE" && paymentProcessStepIds.has(stepId) && work.paymentApplicability === "UNRESOLVED") return { ok: false, error: "Resolve payment applicability before skipping the payment branch." };
    if ((status === "DONE" || status === "NOT_APPLICABLE") && !evidenceReference.trim()) return { ok: false, error: status === "NOT_APPLICABLE" ? "Record why this process step is not applicable." : "Record the result or evidence reference before marking this step complete." };
    if (status === "DONE" && ["client-approval", "filing", "payment-confirmation", "esubmission"].includes(stepId) && !/^\d{4}-\d{2}-\d{2}$/.test(completedOn)) return { ok: false, error: "Record the actual completion date before marking this outcome complete." };
    if (status === "DONE" && stepId === "esubmission" && (!/^\d{4}-\d{2}-\d{2}$/.test(acknowledgedOn) || !/^\d{4}-\d{2}-\d{2}$/.test(validatedOn))) return { ok: false, error: "Record the BIR acknowledgment and validation dates before completing eSubmission." };
    if (!isCurrentStep && !isUndo) return { ok: false, error: "Only the current process step can be edited." };
    if (!canActOnProcessStep(stepId, work)) return { ok: false, error: `The ${rbacPersonaLabel(workPerspective)} access view cannot update this process step for this taxpayer.` };
    const nextStep = status === "DONE" || status === "NOT_APPLICABLE" ? nextApplicableProcessStep(work, stepIndex, record.processStatuses) : undefined;
    const nextStatus = nextStep && autoStartProcessStep(nextStep.id) && record.processStatuses[nextStep.id] !== "DONE" && record.processStatuses[nextStep.id] !== "NOT_APPLICABLE" ? "IN_PROGRESS" : undefined;
    const actor = rbacPersonaLabel(workPerspective);
    const recordedAt = workflowTimestamp(record.processHistory.length);
    const elevatedOverride = canUseElevatedOverride(workPerspective) && Boolean(overrideReason.trim());
    const updates: WorkflowProcessUpdate[] = [{ id: `${work.id}-process-${record.processHistory.length + 1}`, stepId, status, actor, recordedAt, evidenceReference: evidenceReference.trim() || undefined, completedOn: completedOn || undefined, acknowledgedOn: acknowledgedOn || undefined, validatedOn: validatedOn || undefined, attachmentName: attachmentName.trim() || undefined, sharepointUrl: sharepointUrl.trim() || undefined, elevatedOverride, overrideReason: elevatedOverride ? overrideReason.trim() : undefined }];
    const processStatuses = { ...record.processStatuses, [stepId]: status };
    if (nextStep && nextStatus) {
      processStatuses[nextStep.id] = nextStatus;
      updates.push({ id: `${work.id}-process-${record.processHistory.length + updates.length + 1}`, stepId: nextStep.id, status: nextStatus, actor, recordedAt, elevatedOverride, overrideReason: elevatedOverride ? overrideReason.trim() : undefined });
    }
    if (isUndo && currentStep) {
      processStatuses[currentStep.id] = "NOT_STARTED";
      updates.push({ id: `${work.id}-process-${record.processHistory.length + updates.length + 1}`, stepId: currentStep.id, status: "NOT_STARTED", actor, recordedAt, elevatedOverride, overrideReason: elevatedOverride ? overrideReason.trim() : undefined });
    }
    const activeStepId = nextStep?.id ?? stepId;
    const patch: WorkflowPatch = {
      ...record.patch,
      ...(status === "DONE" || status === "NOT_APPLICABLE" ? { blocker: null } : {}),
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
        ...(archiveFacts ? { archiveFacts } : {}),
      },
    }));
    return { ok: true };
  }, [canActOnProcessStep, executeLiveCommand, periodLocks, prototypeMode, records, workPerspective]);

  const setDataReadiness = useCallback(async (work: FixtureWorkItem, ready: boolean, source: "CLIENT_RECORDS" | "TMF_BOOKS", reason: string) => {
    if (!reason.trim()) return { ok: false, error: "Record why the source data is ready before continuing." };
    if (!prototypeMode) return executeLiveCommand(work, "data_readiness", { ready, source, reason: reason.trim() });
    if (periodLocks[workReturnLockKey(work)]?.locked) return { ok: false, error: "This return and compliance period are locked by Tax Team." };
    const record = recordForWork(work, records[work.id]);
    const dataReadiness: FixtureDataReadiness = { state: ready ? "READY" : "NOT_READY", source, reason: reason.trim(), actor: rbacPersonaLabel(workPerspective), recordedAt: workflowTimestamp(record.processHistory.length + record.changeHistory.length) };
    setRecords((current) => {
      const existing = recordForWork(work, current[work.id]);
      return { ...current, [work.id]: { ...existing, dataReadiness, patch: { ...existing.patch, blocker: ready ? null : { category: "CLIENT DATA", reason: reason.trim() } } } };
    });
    return { ok: true };
  }, [executeLiveCommand, periodLocks, prototypeMode, records, workPerspective]);

  const setPaymentApplicability = useCallback(async (work: FixtureWorkItem, applicability: FixturePaymentApplicability) => {
    if (!prototypeMode) return executeLiveCommand(work, "payment_profile", { paymentApplicability: applicability.toLowerCase(), paymentAmount: applicability === "NOT_APPLICABLE" ? null : work.paymentAmount ?? null });
    const record = recordForWork(work, records[work.id]);
    if (periodLocks[workReturnLockKey(work)]?.locked || record.periodLock.locked) return { ok: false, error: "This return and compliance period are locked by Tax Team and cannot be edited." };
    if (!["REQUIRED", "NOT_APPLICABLE", "UNRESOLVED"].includes(applicability)) return { ok: false, error: "Choose a valid payment applicability state." };
    const actor = rbacPersonaLabel(workPerspective);
    const recordedAt = workflowTimestamp(record.processHistory.length + record.changeHistory.length);
    const detail = applicability === "REQUIRED" ? "Payment required" : applicability === "NOT_APPLICABLE" ? "Payment not applicable" : "Payment applicability unresolved";
    setRecords((current) => ({
      ...current,
      [work.id]: {
        ...record,
        patch: { ...record.patch, paymentApplicability: applicability, paymentAmount: applicability === "NOT_APPLICABLE" ? null : record.patch.paymentAmount },
        changeHistory: [...record.changeHistory, { id: `${work.id}-change-${record.changeHistory.length + 1}`, kind: "PAYMENT_PROFILE", detail, actor, recordedAt }],
      },
    }));
    return { ok: true };
  }, [executeLiveCommand, periodLocks, prototypeMode, records, workPerspective]);

  const setPaymentAmount = useCallback(async (work: FixtureWorkItem, amount: number | null) => {
    if (!prototypeMode) return executeLiveCommand(work, "payment_profile", { paymentApplicability: work.paymentApplicability.toLowerCase(), paymentAmount: amount });
    const record = recordForWork(work, records[work.id]);
    if (periodLocks[workReturnLockKey(work)]?.locked || record.periodLock.locked) return { ok: false, error: "This return and compliance period are locked by Tax Team and cannot be edited." };
    if (!canActOnWorkflow("CHECKER", work)) return { ok: false, error: `The ${rbacPersonaLabel(workPerspective)} access view cannot record the amount to pay for this taxpayer.` };
    if (work.paymentAmount !== null && work.paymentAmount !== undefined && amount !== work.paymentAmount) return { ok: false, error: "The amount to pay is already recorded and cannot be edited." };
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
  }, [canActOnWorkflow, executeLiveCommand, periodLocks, prototypeMode, records, workPerspective]);

  const submitDecision = useCallback(async (work: FixtureWorkItem, role: WorkflowRole, decision: WorkflowDecision, answers: Record<string, boolean>, note: string, overrideReason = "", gateStatus: "DONE" | "NOT_APPLICABLE" = "DONE", taxDueAmount?: number | null, paymentAmount?: number | null) => {
    const recordedTaxDueAmount = taxDueAmount ?? null;
    if (!prototypeMode) {
      // shortcut: live gate storage still treats non-return outcomes as complete; enable live N/A after its migration adds the outcome.
      if (gateStatus === "NOT_APPLICABLE") return { ok: false, error: "Not applicable gate outcomes are not yet enabled for live work." };
      const result = await executeLiveCommand(work, "gate_decision", { role: role.toLowerCase(), decision: decision.toLowerCase(), answers: role === "CHECKER" && decision !== "RETURN" ? { ...answers, taxDueAmount: recordedTaxDueAmount } : answers, note, overrideReason, gateStatus: gateStatus.toLowerCase(), ...(role === "CHECKER" && decision !== "RETURN" ? { paymentAmount } : {}) });
      return { ...result, nextGate: decision === "RETURN" ? "PREPARER" as WorkflowRole : role === "PREPARER" ? "CHECKER" as WorkflowRole : role === "CHECKER" ? "REVIEWER" as WorkflowRole : null };
    }
    const record = recordForWork(work, records[work.id]);
    if (periodLocks[workReturnLockKey(work)]?.locked || record.periodLock.locked) return { ok: false, error: "This return and compliance period are locked by Tax Team and cannot be edited." };
    if (!canActOnWorkflow(role, work)) return { ok: false, error: `The ${rbacPersonaLabel(workPerspective)} access view cannot record this gate decision for this taxpayer.` };
    if (record.currentGate !== role) return { ok: false, error: `This work is not currently waiting for ${roleLabels[role]} certification.` };
    const questions = roleQuestions[role];
    if (decision !== "RETURN" && questions.some((question) => !answers[question.id])) return { ok: false, error: "Complete every gate question before recording this decision." };
    if (role === "CHECKER" && decision !== "RETURN" && !isValidTaxDueAmount(recordedTaxDueAmount)) return { ok: false, error: "Record the tax due amount before certifying the Checker gate." };
    if (role === "CHECKER" && decision !== "RETURN" && work.paymentApplicability === "REQUIRED" && !isValidTaxDueAmount(paymentAmount)) return { ok: false, error: "Record the amount to pay before certifying the Checker gate." };
    if (!note.trim()) return { ok: false, error: "Add a short review note before recording this decision." };
    const elevatedOverride = canUseElevatedOverride(workPerspective) && Boolean(overrideReason.trim());
    if (elevatedOverride && !overrideReason.trim()) return { ok: false, error: "Record an override reason when Master Admin records another role's gate decision." };

    const result = transition(role, decision, note.trim());
    const attempt: WorkflowAttempt = { id: `${work.id}-attempt-${record.attempts.length + 1}`, role, decision, note: note.trim(), answers, ...(role === "CHECKER" && isValidTaxDueAmount(recordedTaxDueAmount) ? { taxDueAmount: recordedTaxDueAmount as number } : {}), actor: rbacPersonaLabel(workPerspective), recordedAt: workflowTimestamp(record.attempts.length), elevatedOverride, overrideReason: elevatedOverride ? overrideReason.trim() : undefined };
    const gateStepId = role === "PREPARER" ? "prepare" : role === "CHECKER" ? "check" : "review";
    const processStatus: WorkflowProcessStatus = decision === "RETURN" ? "NEEDS_ATTENTION" : gateStatus;
    const processUpdate: WorkflowProcessUpdate = { id: `${work.id}-process-${record.processHistory.length + 1}`, stepId: gateStepId, status: processStatus, actor: rbacPersonaLabel(workPerspective), recordedAt: workflowTimestamp(record.processHistory.length), elevatedOverride, overrideReason: elevatedOverride ? overrideReason.trim() : undefined };
    setRecords((current) => {
      const currentRecord = recordForWork(work, current[work.id]);
      return { ...current, [work.id]: { ...currentRecord, currentGate: result.currentGate, patch: { ...currentRecord.patch, ...result.patch }, attempts: [...currentRecord.attempts, attempt], processStatuses: { ...currentRecord.processStatuses, [gateStepId]: processStatus }, processHistory: [...currentRecord.processHistory, processUpdate] } };
    });
    return { ok: true, nextGate: result.currentGate };
  }, [canActOnWorkflow, executeLiveCommand, periodLocks, prototypeMode, records, workPerspective]);

  const getModuleAccess = useCallback((module: ModuleKey) => moduleAccessForPersona(workPerspective, module, accessMatrix), [accessMatrix, workPerspective]);
  const canAccess = useCallback((module: ModuleKey, allowed: readonly AccessLevel[] = ["VIEW", "ACT", "APPROVE", "GOVERN", "OVERRIDE"]) => canAccessModule(workPerspective, module, allowed, accessMatrix), [accessMatrix, workPerspective]);
  const value = useMemo<WorkflowContextValue>(() => ({ prototypeMode, clientRegistry, clientRegistryState, refreshClientRegistry, currentRole, setCurrentRole, workPerspective, setWorkPerspective, applyAccessPerspective, accessMatrix, accessPolicyHistory, commitAccessMatrix, canManageAccess, getModuleAccess, canAccessModule: canAccess, getRecord, getEffectiveWork, getWorkItems, getOperationalRecords, operationalToday: prototypeMode ? fixtureClock.today : new Date().toISOString().slice(0, 10), createWorkItem, createLiveWorkItem, updateWorkItem, deleteWorkItem, isWorkVisible, isClientVisible, canActOnWorkflow, canActOnProcessStep, getProcessStatus, getLatestProcessUpdate, setDataReadiness, setPaymentApplicability, setPaymentAmount, getPeriodLock, setPeriodLock, setProcessStatus, getChecklistAnswers, setChecklistAnswer, getQuestions: (role: WorkflowRole) => roleQuestions[role], submitDecision, recordFinalCertification }), [accessMatrix, accessPolicyHistory, applyAccessPerspective, canAccess, canActOnProcessStep, canActOnWorkflow, canManageAccess, clientRegistry, clientRegistryState, commitAccessMatrix, createLiveWorkItem, createWorkItem, currentRole, deleteWorkItem, getChecklistAnswers, getEffectiveWork, getLatestProcessUpdate, getModuleAccess, getOperationalRecords, getPeriodLock, getProcessStatus, getRecord, getWorkItems, isClientVisible, isWorkVisible, prototypeMode, recordFinalCertification, refreshClientRegistry, setDataReadiness, setChecklistAnswer, setPaymentApplicability, setPaymentAmount, setPeriodLock, setProcessStatus, submitDecision, updateWorkItem, workPerspective]);
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
