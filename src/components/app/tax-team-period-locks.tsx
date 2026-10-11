"use client";

import { useMemo, useState } from "react";

import { useWorkflow } from "@/lib/workflow-state";

export function PeriodLocksView() {
  const { getEffectiveWork, getPeriodLock, getRecord, getWorkItems, isWorkVisible, setPeriodLock, workPerspective } = useWorkflow();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const canLock = workPerspective === "TAX_CONTROL" || workPerspective === "MASTER_ADMIN" || workPerspective === "SUPER_ADMIN";
  const work = useMemo(() => getWorkItems().map(getEffectiveWork).filter(isWorkVisible), [getEffectiveWork, getWorkItems, isWorkVisible]);

  return <section aria-labelledby="period-locks-title" className="period-locks-page">
    <div className="my-work-page__subheader"><div><p className="eyebrow">Tax Team control</p><h2 id="period-locks-title">Period locks</h2><p>Lock only after the return package is archived. A lock freezes the workflow record and preserves the final control boundary.</p></div><span className="module-inline-note">{canLock ? "You can act as Tax Team" : "View only"}</span></div>
    {!canLock && <p className="inline-note">Period locks are restricted to Tax Team or an authorized Master Admin. The return journey remains available for review.</p>}
    <div className="period-locks-list">
      {work.length === 0 ? <div className="inline-empty">No returns are visible in this access scope.</div> : work.map((item) => {
        const record = getRecord(item);
        const lock = getPeriodLock(item);
        const archived = record.processStatuses.evidence === "DONE";
        const reason = reasons[item.id] ?? "";
        return <article className={`period-lock-row${lock.locked ? " period-lock-row--locked" : ""}`} key={item.id}>
          <div className="period-lock-row__identity"><span className="period-lock-row__state">{lock.locked ? "Locked" : archived ? "Ready to lock" : "Archiving required"}</span><h3>{item.client}</h3><p>{item.title} · {item.period}</p></div>
          <div className="period-lock-row__meta"><span>Archive status</span><strong>{archived ? "Complete" : "Open"}</strong><small>{lock.locked ? `${lock.actor} · ${lock.recordedAt}` : "No lock recorded"}</small></div>
          <div className="period-lock-row__action">{!lock.locked && <label><span>Reason</span><input aria-label={`Reason for ${item.client} period lock`} disabled={!canLock || !archived} onChange={(event) => setReasons((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Final package reviewed" value={reason} /></label>}<button className={lock.locked ? "button button--quiet button--small" : "button button--primary button--small"} disabled={!canLock || (!lock.locked && (!archived || !reason.trim()))} onClick={() => { void (async () => { const result = await setPeriodLock(item, !lock.locked, lock.locked ? "Tax Team period lock released for controlled correction." : reason); setFeedback((current) => ({ ...current, [item.id]: result.ok ? (lock.locked ? "Period unlocked for controlled correction." : "Period locked and made read-only.") : result.error ?? "The period lock could not be changed." })); })(); }} type="button">{lock.locked ? "Unlock" : "Lock period"}</button>{feedback[item.id] && <small className="period-lock-row__feedback" role="status">{feedback[item.id]}</small>}</div>
        </article>;
      })}
    </div>
  </section>;
}
