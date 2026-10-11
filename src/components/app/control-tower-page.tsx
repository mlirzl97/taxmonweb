"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { fixtureClock, fixtureWork, type FixtureStatus } from "@/lib/fixtures";
import { getFixtureOperationalRecords, getLiveOperationalRecords } from "@/lib/fixtures-read-model";
import { useWorkflow } from "@/lib/workflow-state";
import { MyRunView } from "@/components/app/my-run-view";
import { FixturePageFrame, isInScope, PageHeader, type ScopeFilter, WorkDetail } from "@/components/app/workspace-components";

function isImmediateAction(work: (typeof fixtureWork)[number]) {
  const overdue = work.deadline.toLowerCase().includes("overdue");
  const waitingForDecision = work.status === "AMBER" && work.stage === "CLIENT";
  return Boolean(work.blocker) || work.status === "RED" || work.status === "UNRESOLVED" || overdue || waitingForDecision;
}

function shortMonth(date: string) {
  return new Intl.DateTimeFormat("en", { month: "short" }).format(new Date(`${date}T00:00:00`));
}

type PulseFilter = "ALL" | FixtureStatus;
type ControlTowerView = "overview" | "my-run";

function matchesPulseFilter(work: (typeof fixtureWork)[number], filter: PulseFilter) {
  return filter === "ALL" || work.status === filter;
}

export default function ControlTowerPage({ displayName, initialScope, initialView = "overview" }: { displayName: string; initialScope: ScopeFilter | null; initialView?: ControlTowerView }) {
  if (initialScope === null) {
    return <FixturePageFrame><PageHeader action={<ControlTowerGreeting displayName={displayName} />} description="Portfolio control, pressure, and intervention." title="Control Tower" /><section aria-labelledby="scope-required-title" className="panel access-state"><h2 id="scope-required-title">Workspace access is not configured</h2><p>Your account has no active organizational scope for this workspace. Ask an administrator to assign a Team, Tower, Cluster, Tax Control, or All A&amp;T scope.</p></section></FixturePageFrame>;
  }

  return <ScopedControlTowerPage displayName={displayName} initialScope={initialScope} initialView={initialView} />;
}

function ControlTowerGreeting({ displayName }: { displayName: string }) {
  return <div aria-label={`Greeting for ${displayName}`} className="control-tower-greeting"><span className="eyebrow">Welcome</span><strong>Hello {displayName}</strong></div>;
}

function ScopedControlTowerPage({ displayName, initialScope, initialView }: { displayName: string; initialScope: ScopeFilter; initialView: ControlTowerView }) {
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);
  const [pulseFilter, setPulseFilter] = useState<PulseFilter>("ALL");
  const { getEffectiveWork, getWorkItems, isWorkVisible, prototypeMode, workPerspective } = useWorkflow();
  const workItems = getWorkItems();
  const today = prototypeMode ? fixtureClock.today : new Date().toISOString().slice(0, 10);

  const visibleWork = useMemo(() => workItems.map(getEffectiveWork).filter((work) => (prototypeMode ? isWorkVisible(work) : true) && isInScope(work.scope, initialScope)), [getEffectiveWork, initialScope, isWorkVisible, prototypeMode, workItems]);
  const operationalRecords = useMemo(() => (prototypeMode ? getFixtureOperationalRecords(workItems) : getLiveOperationalRecords(workItems)).flatMap((record) => {
    const work = getEffectiveWork(record.work);
    return (prototypeMode ? isWorkVisible(work) : true) && isInScope(record.scope, initialScope) ? [{ ...record, work, status: work.status }] : [];
  }), [getEffectiveWork, initialScope, isWorkVisible, prototypeMode, workItems]);

  const intervention = visibleWork.filter(isImmediateAction);
  const blocked = visibleWork.filter((work) => work.blocker);
  const upcoming = operationalRecords
    .filter((record) => record.calendar.calendarDate >= today)
    .sort((a, b) => a.calendar.calendarDate.localeCompare(b.calendar.calendarDate));
  const clearCount = visibleWork.filter((work) => work.status === "GREEN" && !isImmediateAction(work)).length;
  const redCount = visibleWork.filter((work) => work.status === "RED").length;
  const amberCount = visibleWork.filter((work) => work.status === "AMBER").length;
  const unresolvedCount = visibleWork.filter((work) => work.status === "UNRESOLVED").length;
  const clearPercent = visibleWork.length ? Math.round((clearCount / visibleWork.length) * 100) : 0;
  const calendarWorkIds = new Set(operationalRecords.map((record) => record.work.id));
  const visibleWorkIds = new Set(visibleWork.map((work) => work.id));
  const workWithoutCalendar = visibleWork.filter((work) => !calendarWorkIds.has(work.id));
  const calendarWithoutWork = operationalRecords.filter((record) => !visibleWorkIds.has(record.work.id));
  const controlViewState = visibleWork.length === 0 ? "empty" : workWithoutCalendar.length > 0 || calendarWithoutWork.length > 0 ? "warning" : "ready";
  const pulseState = controlViewState !== "ready" ? "AMBER" : redCount > 0 ? "RED" : amberCount > 0 || blocked.length > 0 || unresolvedCount > 0 || intervention.length > 0 ? "AMBER" : "GREEN";
  const pulseLabel = controlViewState === "empty" ? "Control data unavailable" : controlViewState === "warning" ? "Control data needs review" : pulseState === "RED" ? "Red exposure" : pulseState === "AMBER" ? "Attention needed" : "All clear";
  const pulseItems = pulseFilter === "ALL" ? intervention : visibleWork.filter((work) => matchesPulseFilter(work, pulseFilter));
  const pulseQueueLabel = pulseFilter === "ALL" ? "Needs attention" : pulseFilter === "UNRESOLVED" ? "Unresolved work" : `${pulseFilter[0]}${pulseFilter.slice(1).toLowerCase()} work`;
  const missingWorkMessage = workWithoutCalendar.length ? `${workWithoutCalendar.length} work item${workWithoutCalendar.length === 1 ? "" : "s"} missing` : "No work missing";
  const unmatchedDueMessage = calendarWithoutWork.length ? `${calendarWithoutWork.length} due record${calendarWithoutWork.length === 1 ? "" : "s"} unmatched` : "no unmatched due records";
  const controlViewMessage = controlViewState === "ready"
    ? `${visibleWork.length} work items · ${operationalRecords.length} due records`
    : controlViewState === "warning"
      ? `${missingWorkMessage} · ${unmatchedDueMessage}`
      : "This is not an All Clear result.";

  return (
    <FixturePageFrame>
      <PageHeader action={<ControlTowerGreeting displayName={displayName} />} title="Control Tower" />

      <nav aria-label="Control Tower views" className="tower-tabs module-tabs" role="tablist">
        <Link aria-current={initialView === "overview" ? "page" : undefined} className={initialView === "overview" ? "tower-tab tower-tab--active" : "tower-tab"} href="/app/control-tower" role="tab">Portfolio</Link>
        <Link aria-current={initialView === "my-run" ? "page" : undefined} className={initialView === "my-run" ? "tower-tab tower-tab--active" : "tower-tab"} href="/app/control-tower?view=my-run" role="tab">My run</Link>
      </nav>

      {initialView === "my-run" ? <MyRunView perspective={workPerspective} work={visibleWork} /> : <>
      <section aria-labelledby="all-clear-title" className={`run-card run-card--${pulseState.toLowerCase()}`}>
        <div className="run-card__main">
          <div aria-label={`${clearPercent}% of visible work is clear`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={clearPercent} className="run-card__ring" role="progressbar">
            <svg aria-hidden="true" viewBox="0 0 100 100"><circle className="run-card__ring-track" cx="50" cy="50" r="42" /><circle className="run-card__ring-value" cx="50" cy="50" r="42" pathLength="100" style={{ strokeDasharray: `${clearPercent} 100` }} /></svg>
            <strong>{clearPercent}<small>%</small></strong>
          </div>
          <div className="run-card__heading">
            <div className="run-card__heading-top"><span className="eyebrow">Portfolio pulse</span><Link className="text-link-button" href="/app/work">Open Due Register</Link></div><h2 id="all-clear-title">Race to All Clear</h2>
            <p>{clearCount} of {visibleWork.length} work items controlled</p>
            <span className={`run-card__state run-card__state--${pulseState.toLowerCase()}`}><i className={`rag-dot rag-dot--${pulseState.toLowerCase()}`} />{pulseLabel}</span>
          </div>
          <div className="run-card__breakdown" aria-label="Portfolio RAG breakdown">
            {([["GREEN", "Green", clearCount], ["AMBER", "Amber", amberCount], ["RED", "Red", redCount]] as const).map(([filter, label, count]) => <button aria-pressed={pulseFilter === filter} className={`run-card__filter${pulseFilter === filter ? " run-card__filter--active" : ""}`} key={filter} onClick={() => setPulseFilter(pulseFilter === filter ? "ALL" : filter)} type="button"><span><i className={`rag-dot rag-dot--${filter.toLowerCase()}`} />{label}</span><strong>{count}</strong></button>)}
          </div>
        </div>
        <div className="run-card__rail" aria-hidden="true"><span className="run-card__rail-green" style={{ width: `${visibleWork.length ? (clearCount / visibleWork.length) * 100 : 0}%` }} /><span className="run-card__rail-amber" style={{ width: `${visibleWork.length ? (amberCount / visibleWork.length) * 100 : 0}%` }} /><span className="run-card__rail-red" style={{ width: `${visibleWork.length ? (redCount / visibleWork.length) * 100 : 0}%` }} /></div>
        <div className="run-card__meta"><span>{blocked.length} blocked</span><span>{unresolvedCount} unresolved</span><span>RAG reflects risk, not completion alone</span></div>
      </section>

      <div className={`control-tower-integrity control-tower-integrity--${controlViewState}`} role="status"><span aria-hidden="true" className="control-tower-integrity__dot" /><strong>{controlViewState === "ready" ? "Control view reconciled" : controlViewState === "warning" ? "Control view needs review" : "No work returned"}</strong><span>{controlViewMessage}</span></div>

      <section aria-labelledby="attention-title" className="panel needs-attention-panel">
        <div className="section-heading"><div><h2 id="attention-title">{pulseQueueLabel}</h2><p className="section-heading__support">{pulseFilter === "ALL" ? "Decision, unblock, or escalation." : "RAG filter · select the color again to clear."}</p></div><span className="section-heading__note">{pulseItems.length} items</span></div>
        <div className="attention-ledger" aria-label="Work requiring immediate intervention">
          <div className="attention-ledger__header"><span>What</span><span>Taxpayer</span><span>Target</span><span>Owner</span><span>Reason / next action</span></div>
          {pulseItems.length === 0 ? <div className="inline-empty">{pulseFilter === "ALL" ? "Nothing needs attention right now." : `No ${pulseFilter.toLowerCase()} work in this view.`}</div> : pulseItems.map((work) => <button className="attention-ledger__row" key={work.id} onClick={() => setSelectedWorkId(work.id)} type="button">
            <span><strong>{work.title}</strong><small>{work.stage}</small></span>
            <span>{work.client}</span>
            <span>{work.deadline}</span>
            <span>{work.owner}</span>
            <span className="attention-ledger__next"><span className={`rag-text rag-text--${work.status.toLowerCase()}`}>{work.status}</span><small>{work.blocker?.reason ?? work.statusReason}</small><em>{work.nextAction} →</em></span>
          </button>)}
        </div>
      </section>

      <section aria-labelledby="pressure-title" className="panel upcoming-pressure-panel">
        <div className="section-heading"><div><h2 id="pressure-title">Upcoming</h2><p className="section-heading__support">Next scheduled items.</p></div><Link className="text-link-button" href="/app/work">Open Due Register</Link></div>
        <div className="upcoming-list">{upcoming.slice(0, 4).map(({ calendar: item, status, work }) => <Link className="upcoming-row" href={`/app/work?date=${item.calendarDate}`} key={item.id}>
          <span className="upcoming-row__date"><strong>{item.calendarDate.slice(-2)}</strong><small>{shortMonth(item.calendarDate)}</small></span>
          <span><strong>{item.returnLabel.replace(/\s*·\s*/g, " ")}</strong><small>{item.client} · {work.nextAction}</small></span>
          <span className={`rag-dot rag-dot--${status.toLowerCase()}`} aria-label={status} />
        </Link>)}</div>
      </section>

      {selectedWorkId && <WorkDetail onClose={() => setSelectedWorkId(null)} serverAuthorized={!prototypeMode} work={workItems.find((work) => work.id === selectedWorkId)!} />}
      </>}
    </FixturePageFrame>
  );
}
