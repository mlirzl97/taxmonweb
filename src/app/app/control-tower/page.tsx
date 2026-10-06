"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { fixtureClients, fixtureClock, fixtureWork } from "@/lib/fixtures";
import { getFixtureOperationalRecords } from "@/lib/fixtures-read-model";
import { buildControlTowerPath, parseControlTowerSearch, type TowerPreset as Preset, type TowerView } from "@/lib/control-tower-state";
import { CalendarView, DueRegisterView } from "@/components/app/control-tower-views";
import { FixturePageFrame, isInScope, PageHeader, ScopeSwitcher, type ScopeFilter, WorkDetail } from "@/components/app/workspace-components";

export default function ControlTowerPage() {
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [view, setView] = useState<TowerView>("overview");
  const [preset, setPreset] = useState<Preset>("all");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);

  useEffect(() => {
    const syncFromUrl = () => {
      const next = parseControlTowerSearch(window.location.search);
      setScope(next.scope);
      setView(next.view);
      setPreset(next.preset);
      setSelectedDate(next.date);
    };
    const timer = window.setTimeout(syncFromUrl, 0);
    window.addEventListener("popstate", syncFromUrl);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("popstate", syncFromUrl);
    };
  }, []);

  function changeView(next: TowerView, nextPreset: Preset = "all", nextDate: string | null = selectedDate) {
    setView(next);
    setPreset(nextPreset);
    window.history.pushState(null, "", buildControlTowerPath({ view: next, preset: nextPreset, scope, date: nextDate }));
  }

  const visibleWork = useMemo(() => fixtureWork.filter((work) => isInScope(work.scope, scope)), [scope]);
  const operationalRecords = useMemo(() => getFixtureOperationalRecords().filter((record) => isInScope(record.scope, scope)), [scope]);
  const attention = visibleWork.filter((work) => work.status !== "GREEN" || work.blocker);
  const dueToday = operationalRecords.filter((record) => record.calendar.calendarDate === fixtureClock.today);
  const upcoming = operationalRecords.filter((record) => record.calendar.calendarDate > fixtureClock.today).sort((a, b) => a.calendar.calendarDate.localeCompare(b.calendar.calendarDate));
  const blocked = visibleWork.filter((work) => work.blocker);
  const statutoryExposure = operationalRecords.filter((record) => record.calendar.statutoryDeadline !== "Rule unresolved" && record.status === "RED");

  return (
    <FixturePageFrame>
      <PageHeader title="Control Tower" />
      <div className="tower-toolbar"><nav aria-label="Control Tower views" className="tower-tabs"><button aria-current={view === "overview" ? "page" : undefined} className={view === "overview" ? "tower-tab tower-tab--active" : "tower-tab"} onClick={() => changeView("overview")} type="button">Overview</button><button aria-current={view === "due" ? "page" : undefined} className={view === "due" ? "tower-tab tower-tab--active" : "tower-tab"} onClick={() => changeView("due")} type="button">Due Register</button><button aria-current={view === "calendar" ? "page" : undefined} className={view === "calendar" ? "tower-tab tower-tab--active" : "tower-tab"} onClick={() => changeView("calendar")} type="button">Calendar</button></nav><ScopeSwitcher onChange={(nextScope) => { setScope(nextScope); window.history.replaceState(null, "", buildControlTowerPath({ view, preset, scope: nextScope, date: selectedDate })); }} value={scope} /></div>

      {view === "overview" && <>
        <section aria-label="Portfolio signals" className="health-strip">
          {[
            { label: "Due today", value: dueToday.length, note: "open due register", preset: "today" as Preset },
            { label: "Upcoming", value: upcoming.length, note: "next scheduled items", preset: "all" as Preset },
            { label: "Needs attention", value: attention.length, note: "requires intervention", preset: "attention" as Preset },
            { label: "Blocked", value: blocked.length, note: "cannot progress", preset: "blocked" as Preset },
            { label: "Statutory exposure", value: statutoryExposure.length, note: "approved date at risk", preset: "statutory" as Preset },
          ].map((signal) => <button className={`health-signal${signal.value === 0 ? " health-signal--quiet" : ""}`} key={signal.label} onClick={() => { setPreset(signal.preset); changeView("due", signal.preset); }} type="button"><strong>{signal.value}</strong><span>{signal.label}</span><small>{signal.note}</small></button>)}
        </section>

        <section aria-labelledby="attention-title" className="panel needs-attention-panel">
          <div className="section-heading"><div><h2 id="attention-title">Needs your attention</h2></div><span className="section-heading__note">{attention.length} items</span></div>
          <div className="attention-ledger" aria-label="Items needing attention"><div className="attention-ledger__header"><span>What</span><span>Taxpayer</span><span>Target</span><span>Owner</span><span>Problem</span><span>Next action</span></div>{attention.length === 0 ? <div className="inline-empty">All clear for this scope.</div> : attention.map((work) => <button className="attention-ledger__row" key={work.id} onClick={() => setSelectedWorkId(work.id)} type="button"><span><strong>{work.title}</strong><small>{work.stage}</small></span><span>{work.client}</span><span>{work.deadline}</span><span>{work.owner}</span><span><span className={`rag-text rag-text--${work.status.toLowerCase()}`}>{work.status}</span><small>{work.blocker?.reason ?? work.statusReason}</small></span><span className="attention-ledger__next">{work.nextAction} <span aria-hidden="true">→</span></span></button>)}</div>
        </section>

        <div className="tower-lower-grid">
          <section aria-labelledby="upcoming-title" className="panel"><div className="section-heading"><div><h2 id="upcoming-title">Upcoming pressure</h2></div><button className="text-link-button" onClick={() => changeView("calendar")} type="button">Open calendar</button></div><div className="upcoming-list">{upcoming.slice(0, 4).map(({ calendar: item, status }) => <button className="upcoming-row" key={item.id} onClick={() => { setPreset("all"); changeView("due", "all", item.calendarDate); }} type="button"><span className="upcoming-row__date"><strong>{item.calendarDate.slice(-2)}</strong><small>Oct</small></span><span><strong>{item.returnLabel.replace(" · ", " ")}</strong><small>{item.client} · {item.serviceMilestone}</small></span><span className={`rag-dot rag-dot--${status.toLowerCase()}`} aria-label={status} /></button>)}</div></section>
          <section aria-labelledby="scope-title" className="panel panel--quiet"><div className="section-heading"><div><h2 id="scope-title">Scope</h2></div></div><p className="scope-summary"><strong>{scope === "all" ? "All A&T" : scope === "north" ? "Tower North" : scope === "central" ? "Tower Central" : "Tower South"}</strong><span>{fixtureClients.filter((client) => isInScope(client.scope, scope)).length} taxpayers · {visibleWork.length} active work items</span></p><div className="compact-links"><Link href="/app/clients">Find a taxpayer</Link><Link href="/app/team">Review team coverage</Link></div></section>
        </div>
        {selectedWorkId && <WorkDetail onClose={() => setSelectedWorkId(null)} work={fixtureWork.find((work) => work.id === selectedWorkId)!} />}
      </>}

      {view === "due" && <DueRegisterView preset={preset} scope={scope} />}
      {view === "calendar" && <CalendarView onSelectDate={(date) => { setSelectedDate(date); changeView("calendar", "all", date); }} selectedDate={selectedDate} scope={scope} />}
    </FixturePageFrame>
  );
}
