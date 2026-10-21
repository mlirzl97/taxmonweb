"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { deriveWorkReturnOutcome, type WorkOutcomeState, type WorkReturnOutcome } from "@/lib/domain/work-outcome";
import { type FixtureWorkItem } from "@/lib/fixtures";
import { useWorkflow, workPeriodKey, workReturnCode, workReturnLockKey } from "@/lib/workflow-state";
import { useDialogFocus } from "./workspace-components";

type ReturnGroup = { key: string; code: string; work: FixtureWorkItem[] };
type PeriodGroup = { key: string; year: string; month: string; label: string; returns: ReturnGroup[] };
type LockStatus = "locked" | "ready" | "active" | "unresolved";
type LockGroup = ReturnGroup & { periodLabel: string; status: LockStatus };
type PendingLock = { work: FixtureWorkItem; lockKey: string; code: string; periodLabel: string; locked: boolean };
const monthLabels = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;

function dueDateFor(work: FixtureWorkItem) {
  return work.dueDate ?? (/^20\d{2}-\d{2}-\d{2}$/.test(work.deadline) ? work.deadline : null);
}

type OutcomeKey = "filing" | "payment" | "attachments" | "overall";

function summarizeOutcomes(outcomes: WorkReturnOutcome[], key: OutcomeKey) {
  const states: WorkOutcomeState[] = outcomes.map((outcome) => key === "overall" ? outcome.overall : outcome[key].state);
  return {
    onTime: states.filter((state) => state === "on_time").length,
    late: states.filter((state) => state === "late").length,
    unverified: states.filter((state) => state === "unverified").length,
    notDue: states.filter((state) => state === "not_due").length,
    attention: states.filter((state) => state === "needs_attention").length,
    notApplicable: states.filter((state) => state === "not_applicable").length,
  } satisfies Record<"onTime" | "late" | "unverified" | "notDue" | "attention" | "notApplicable", number>;
}

function outcomeCellDetail(summary: ReturnType<typeof summarizeOutcomes>) {
  const details = [`${summary.late} late`, `${summary.unverified} unverified`];
  if (summary.notDue) details.push(`${summary.notDue} not due`);
  if (summary.attention) details.push(`${summary.attention} needs attention`);
  if (summary.notApplicable) details.push(`${summary.notApplicable} N/A`);
  return details.join(" · ");
}

function displayDate(value: string | null) {
  if (!value) return "Due date unresolved";
  return new Intl.DateTimeFormat("en-PH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Manila" }).format(new Date(`${value}T00:00:00+08:00`));
}

function calendarPeriodFor(work: FixtureWorkItem) {
  const periodKey = workPeriodKey(work);
  const monthlyPeriod = /^(20\d{2})-(0[1-9]|1[0-2])$/.exec(periodKey);
  if (monthlyPeriod) {
    const month = Number(monthlyPeriod[2]);
    return { key: periodKey, year: monthlyPeriod[1], month: monthLabels[month - 1], label: `${monthLabels[month - 1]} ${monthlyPeriod[1]}` };
  }
  const dueDate = dueDateFor(work);
  if (dueDate) {
    const date = new Date(`${dueDate}T00:00:00+08:00`);
    const year = String(date.getFullYear());
    const month = date.getMonth();
    return { key: `${year}-${String(month + 1).padStart(2, "0")}`, year, month: monthLabels[month], label: `${monthLabels[month]} ${year}` };
  }
  const year = work.period.match(/\b(20\d{2})\b/)?.[1] ?? "Unresolved year";
  return { key: `${year}-00`, year, month: "Month unresolved", label: `Month unresolved · ${year}` };
}

export function PeriodLocksView() {
  const { canManagePeriodLocks, getEffectiveWork, getPeriodLock, getRecord, getWorkItems, isWorkVisible, operationalToday, setPeriodLock } = useWorkflow();
  const [pendingLock, setPendingLock] = useState<PendingLock | null>(null);
  const [reasonDraft, setReasonDraft] = useState("");
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  useDialogFocus(Boolean(pendingLock), () => setPendingLock(null));
  const canManage = canManagePeriodLocks;
  const periods = useMemo<PeriodGroup[]>(() => {
    const groups = new Map<string, { key: string; year: string; month: string; label: string; returns: Map<string, ReturnGroup> }>();
    for (const item of getWorkItems().map(getEffectiveWork).filter(isWorkVisible)) {
      const calendarPeriod = calendarPeriodFor(item);
      const period = groups.get(calendarPeriod.key) ?? { ...calendarPeriod, returns: new Map<string, ReturnGroup>() };
      const code = workReturnCode(item);
      const returnGroup = period.returns.get(code) ?? { key: workReturnLockKey(item), code, work: [] };
      returnGroup.work.push(item);
      period.returns.set(code, returnGroup);
      groups.set(calendarPeriod.key, period);
    }
    return [...groups.values()].map((period) => ({ ...period, returns: [...period.returns.values()].sort((left, right) => left.code.localeCompare(right.code)) })).sort((left, right) => left.key.localeCompare(right.key));
  }, [getEffectiveWork, getWorkItems, isWorkVisible]);
  const lockGroups = useMemo<LockGroup[]>(() => periods.flatMap((period) => period.returns.map((returnGroup) => {
    const lock = getPeriodLock(returnGroup.work[0]);
    const dueDates = returnGroup.work.map(dueDateFor);
    const latestDueDate = dueDates.filter((date): date is string => Boolean(date)).sort().at(-1) ?? null;
    const status: LockStatus = lock.locked
      ? "locked"
      : !dueDates.every(Boolean) || !latestDueDate
        ? "unresolved"
        : latestDueDate <= operationalToday
          ? "ready"
          : "active";
    return { ...returnGroup, periodLabel: period.label, status };
  })), [getPeriodLock, operationalToday, periods]);
  const statusByLockKey = useMemo(() => new Map(lockGroups.map((group) => [group.key, group.status])), [lockGroups]);

  return <section aria-labelledby="period-locks-title" className="period-locks-page">
    <div className="my-work-page__subheader"><div><p className="eyebrow">Tax Team control</p><h2 id="period-locks-title">Period locks</h2><p>Lock each return for a compliance month centrally. A lock applies to every client return in that group and can be reopened only by an authorized Tax Team or HOD user.</p></div><span className="module-inline-note">{canManage ? "You can manage locks" : "View only"}</span></div>
    {!canManage && <p className="inline-note">Period locks are restricted to Tax Team and authorized HOD users. Work remains available for review.</p>}
    <div className="period-locks-list">
      {periods.length === 0 ? <div className="inline-empty">No periods are visible in this access scope.</div> : periods.map((period) => <section className="period-lock-period" key={period.key}>
        <div className="period-lock-period__header"><span>Calendar year · month</span><h3>{period.year}</h3><p>{period.month}</p></div>
        <div className="period-lock-period__returns">
          {period.returns.map((returnGroup) => {
            const representative = returnGroup.work[0];
            const lock = getPeriodLock(representative);
            const lockKey = returnGroup.key;
            const completeCount = returnGroup.work.filter((item) => {
              const record = getRecord(item);
              return record.processStatuses.evidence === "DONE" && Boolean(record.finalCertification);
            }).length;
            const dueDates = returnGroup.work.map(dueDateFor);
            const latestDueDate = dueDates.filter((date): date is string => Boolean(date)).sort().at(-1) ?? null;
            const allDueDatesKnown = dueDates.every(Boolean);
            const status = statusByLockKey.get(lockKey) ?? "active";
            const eligible = status === "ready";
            const actionLabel = lock.locked ? `Reopen ${returnGroup.code}` : `Lock ${returnGroup.code}`;
            const outcomes = returnGroup.work.map((item) => deriveWorkReturnOutcome(item, getRecord(item), operationalToday));
            const outcomeCells: Array<{ key: OutcomeKey; label: string }> = [{ key: "filing", label: "Filing" }, { key: "payment", label: "Payment" }, { key: "attachments", label: "Attachments" }, { key: "overall", label: "Overall" }];
            return <article className={`period-lock-row period-lock-row--${status}${lock.locked ? " period-lock-row--locked" : ""}`} key={lockKey}>
              <div className="period-lock-row__identity"><span className="period-lock-row__state">{lock.locked ? "Locked" : status === "ready" ? "Ready to lock" : status === "unresolved" ? "Needs setup" : "Active"}</span><h3>{returnGroup.code}</h3><p>{returnGroup.work.length} client return{returnGroup.work.length === 1 ? "" : "s"} · due {displayDate(latestDueDate)}</p></div>
              <div className="period-lock-row__meta"><span>Portfolio readiness</span><strong>{completeCount} of {returnGroup.work.length} complete</strong><small>{lock.locked ? `${lock.actor ?? "Tax Team"} · ${lock.recordedAt ?? "Recorded"} · read-only` : !allDueDatesKnown ? "Cannot lock until every due date is governed" : eligible ? "Due date has passed; Tax Team may lock this return" : `Cannot lock before ${displayDate(latestDueDate)}`}</small></div>
              <div aria-label={`${returnGroup.code} client return status`} className="period-lock-row__status-summary"><div><span>Client return status</span><small>Derived from Work evidence and actual completion dates.</small></div><div className="period-lock-row__status-grid">{outcomeCells.map(({ key, label }) => { const summary = summarizeOutcomes(outcomes, key); return <div className={`period-lock-row__status-cell period-lock-row__status-cell--${key}`} key={key}><span>{label}</span><strong>{summary.onTime} on time</strong><small>{outcomeCellDetail(summary)}</small></div>; })}</div></div>
              <div className="period-lock-row__action"><button className="button button--primary button--small" disabled={!canManage || (!lock.locked && !eligible)} onClick={() => { setReasonDraft(""); setPendingLock({ work: representative, lockKey, code: returnGroup.code, periodLabel: period.label, locked: lock.locked }); }} type="button">{actionLabel}</button>{feedback[lockKey] && <small className="period-lock-row__feedback" role="status">{feedback[lockKey]}</small>}</div>
              <details className="period-lock-row__returns"><summary>View {returnGroup.work.length} client return{returnGroup.work.length === 1 ? "" : "s"}</summary><div className="period-lock-row__return-list">{returnGroup.work.map((item) => { const itemRecord = getRecord(item); const itemReady = itemRecord.processStatuses.evidence === "DONE" && Boolean(itemRecord.finalCertification); return <div className="period-lock-row__return" key={item.id}><div><strong>{item.client}</strong><span>{item.title}</span></div><span className={`period-lock-row__return-status${itemReady ? " period-lock-row__return-status--ready" : ""}`}>{lock.locked ? "Read-only" : itemReady ? "Ready" : "Needs completion"}</span><Link className="text-button" href={`/app/work/${item.id}`}>View return</Link></div>; })}</div></details>
            </article>;
          })}
        </div>
      </section>)}
    </div>
    {pendingLock && <div className="work-evidence-dialog-layer" role="presentation"><section aria-describedby="period-lock-dialog-description" aria-labelledby="period-lock-dialog-title" aria-modal="true" className="work-evidence-dialog" onKeyDown={(event) => { if (event.key === "Escape") setPendingLock(null); }} role="dialog"><div className="work-evidence-dialog__header"><div><p className="eyebrow">Central return lock</p><h2 id="period-lock-dialog-title">{pendingLock.locked ? `Reopen ${pendingLock.code}` : `Lock ${pendingLock.code}`}</h2><p>{pendingLock.periodLabel} · applies to every client return in this group</p></div><button aria-label="Close period lock dialog" className="icon-button" onClick={() => setPendingLock(null)} type="button">×</button></div><p className="period-lock-dialog__description" id="period-lock-dialog-description">This reason is retained in the lock history and supports the Tax Team control record.</p><label className="work-evidence-dialog__field"><span>{pendingLock.locked ? "Reason for reopening" : "Reason for locking"}</span><textarea autoFocus aria-label={pendingLock.locked ? "Reason for reopening" : "Reason for locking"} onChange={(event) => setReasonDraft(event.target.value)} placeholder={pendingLock.locked ? "Authorized correction or exception" : "Return reviewed and locked"} value={reasonDraft} /></label><div className="work-evidence-dialog__actions"><button className="button button--quiet" onClick={() => setPendingLock(null)} type="button">Cancel</button><button className="button button--primary" disabled={!reasonDraft.trim()} onClick={() => { void (async () => { const result = await setPeriodLock(pendingLock.work, !pendingLock.locked, reasonDraft); setFeedback((current) => ({ ...current, [pendingLock.lockKey]: result.ok ? `${pendingLock.code} ${pendingLock.locked ? "reopened" : "locked"} for ${pendingLock.periodLabel}.` : result.error ?? `The ${pendingLock.code} lock could not be changed.` })); if (result.ok) setPendingLock(null); })(); }} type="button">{pendingLock.locked ? "Reopen return" : "Lock return"}</button></div></section></div>}
  </section>;
}
