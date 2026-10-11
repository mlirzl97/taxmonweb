"use client";

import { useMemo, useState } from "react";

import { useWorkflow, workPeriodKey } from "@/lib/workflow-state";

export function PeriodLocksView() {
  const { getEffectiveWork, getPeriodLock, getRecord, getWorkItems, isWorkVisible, setPeriodLock, workPerspective } = useWorkflow();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const canClose = workPerspective === "TAX_CONTROL" || workPerspective === "MASTER_ADMIN" || workPerspective === "SUPER_ADMIN";
  const periods = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; work: ReturnType<typeof getEffectiveWork>[] }>();
    for (const item of getWorkItems().map(getEffectiveWork).filter(isWorkVisible)) {
      const key = workPeriodKey(item);
      const group = groups.get(key) ?? { key, label: item.period, work: [] };
      group.work.push(item);
      groups.set(key, group);
    }
    return [...groups.values()].sort((left, right) => left.label.localeCompare(right.label));
  }, [getEffectiveWork, getWorkItems, isWorkVisible]);

  return <section aria-labelledby="period-locks-title" className="period-locks-page">
    <div className="my-work-page__subheader"><div><p className="eyebrow">Tax Team control</p><h2 id="period-locks-title">Period locks</h2><p>Close an accounting period once. When closed, every work item in that period is read-only. A closed period cannot be reopened.</p></div><span className="module-inline-note">{canClose ? "You can close periods" : "View only"}</span></div>
    {!canClose && <p className="inline-note">Period close is restricted to Tax Team or an authorized Master Admin. Work remains available for review.</p>}
    <div className="period-locks-list">
      {periods.length === 0 ? <div className="inline-empty">No periods are visible in this access scope.</div> : periods.map((period) => {
        const lock = getPeriodLock(period.work[0]);
        const completeCount = period.work.filter((item) => {
          const record = getRecord(item);
          return record.processStatuses.evidence === "DONE" && Boolean(record.finalCertification);
        }).length;
        const ready = completeCount === period.work.length;
        const reason = reasons[period.key] ?? "";
        return <article className={`period-lock-row${lock.locked ? " period-lock-row--locked" : ""}`} key={period.key}>
          <div className="period-lock-row__identity"><span className="period-lock-row__state">{lock.locked ? "Closed" : ready ? "Ready to close" : "Completion required"}</span><h3>{period.label}</h3><p>Accounting period · {period.work.length} work item{period.work.length === 1 ? "" : "s"}</p></div>
          <div className="period-lock-row__meta"><span>Work readiness</span><strong>{completeCount} of {period.work.length} complete</strong><small>{lock.locked ? `${lock.actor ?? "Tax Team"} · ${lock.recordedAt ?? "Recorded"}` : ready ? "All packages archived and closure-certified" : "Archive and certify every package before close"}</small></div>
          <div className="period-lock-row__action">{!lock.locked && <label><span>Close reason</span><input aria-label={`Reason for closing ${period.label}`} disabled={!canClose || !ready} onChange={(event) => setReasons((current) => ({ ...current, [period.key]: event.target.value }))} placeholder="Period reviewed and closed" value={reason} /></label>}{lock.locked ? <span className="period-lock-row__closed">Read-only · no reopen</span> : <button className="button button--primary button--small" disabled={!canClose || !ready || !reason.trim()} onClick={() => { void (async () => { const result = await setPeriodLock(period.work[0], true, reason); setFeedback((current) => ({ ...current, [period.key]: result.ok ? `${period.label} is closed. All work in this period is now read-only.` : result.error ?? "The period could not be closed." })); })(); }} type="button">Close period</button>}{feedback[period.key] && <small className="period-lock-row__feedback" role="status">{feedback[period.key]}</small>}</div>
        </article>;
      })}
    </div>
  </section>;
}
