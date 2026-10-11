"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { fixtureCalendar, type FixtureStatus, type FixtureWorkItem } from "@/lib/fixtures";
import { dateValue, filterFixtureOperationalRecords, getFixtureWorkRegisterRecords, type DuePreset } from "@/lib/fixtures-read-model";
import { useWorkflow } from "@/lib/workflow-state";
import { FilterTabs, isInScope, scopeLabelForValue, type ScopeFilter, WorkDetail } from "./workspace-components";

function compactReturnLabel(value: string) {
  return value.replace(/\s*·\s*/g, " ");
}

function compactReturnPackageLabel(milestones: readonly (typeof fixtureCalendar)[number][]) {
  const primary = milestones.find((item) => !/QAP/i.test(item.returnLabel)) ?? milestones[0];
  return primary ? compactReturnLabel(primary.returnLabel) : "Return package";
}

function returnPackageDetail(milestones: readonly (typeof fixtureCalendar)[number][], fallback: string) {
  return milestones.some((item) => /QAP/i.test(item.returnLabel)) ? "QAP sequence included" : fallback;
}

function OperationalRegisterHeader({ mode }: { mode: "due" | "work" }) {
  return <div className={mode === "due" ? "due-register__header" : "work-register__header"}><span>Target</span><span>{mode === "due" ? "Taxpayer" : "Client"}</span><span>Return / submission</span><span>Period</span><span>Stage / status</span><span>Owner</span><span>Attention</span></div>;
}

function OperationalRegisterRow({ mode, record, onSelect }: { mode: "due" | "work"; record: { calendar: (typeof fixtureCalendar)[number]; work: FixtureWorkItem; milestones?: readonly (typeof fixtureCalendar)[number][] }; onSelect: (workId: string) => void }) {
  const { calendar: item, work } = record;
  const milestones = record.milestones ?? [item];
  const currentStep = work.steps.find((step) => step.state === "current" || step.state === "blocked" || step.state === "waiting") ?? work.steps[work.steps.length - 1];
  const rowClass = mode === "due" ? "due-register__row" : "work-register__row";
  const dateClass = mode === "due" ? "due-register__date" : "work-register__date";
  const periodClass = mode === "due" ? "due-register__period" : "work-register__period";
  const attentionClass = mode === "due" ? "due-register__attention" : "work-register__attention";

  return <button className={rowClass} key={mode === "due" ? item.id : work.id} onClick={() => onSelect(work.id)} type="button">
    <span className={`${dateClass} ${dateClass}--${work.status.toLowerCase()}`}><strong>{item.calendarDate.slice(-2)}</strong><small>{item.internalDeadline.replace(/^.*?·\s*/, "")}</small></span>
    <span><strong>{item.client}</strong><small>{mode === "due" ? scopeLabelForValue(item.scope) : `${work.registrationUnit} · ${scopeLabelForValue(work.scope)}`}</small></span>
    <span><strong>{mode === "work" ? compactReturnPackageLabel(milestones) : compactReturnLabel(item.returnLabel)}</strong><small>{mode === "work" ? returnPackageDetail(milestones, item.milestone) : item.milestone}</small></span>
    <span className={periodClass}>{item.period}</span>
    {mode === "due" ? <span><span className={`rag-text rag-text--${work.status.toLowerCase()}`}>{work.stage}</span><small>{work.statusReason}</small></span> : <span><span className={`rag-text rag-text--${work.status.toLowerCase()}`}>{work.status}</span><strong>{currentStep?.label}</strong><small>{stepCount(work)}</small></span>}
    <span><strong>{work.owner}</strong><small>{scopeLabelForValue(mode === "due" ? item.scope : work.scope)}</small></span>
    <span className={attentionClass}>{mode === "due" ? <>{work.blocker?.category ?? (work.status === "GREEN" ? "—" : "Review")}</> : <><strong>{work.blocker?.category ?? "Next action"}</strong><small>{work.blocker?.reason ?? work.nextAction}</small></>}</span>
  </button>;
}

export function DueRegisterView({ scope, preset = "all", dateFilter, onClearDate }: { scope: ScopeFilter; preset?: DuePreset; dateFilter?: string | null; onClearDate?: () => void }) {
  const [search, setSearch] = useState("");
  const [due, setDue] = useState<DuePreset>(preset);
  const [status, setStatus] = useState<"all" | FixtureStatus>("all");
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);

  const { getEffectiveWork, getOperationalRecords, getWorkItems, isWorkVisible, operationalToday, prototypeMode } = useWorkflow();
  const workItems = getWorkItems();
  const today = operationalToday;
  const operationalRecords = useMemo(() => getOperationalRecords().flatMap((record) => {
    const work = getEffectiveWork(record.work);
    return (prototypeMode ? isWorkVisible(work) : true) ? [{ ...record, work, status: work.status }] : [];
  }), [getEffectiveWork, getOperationalRecords, isWorkVisible, prototypeMode]);
  const rows = useMemo(() => filterFixtureOperationalRecords(operationalRecords, { dateFilter, due, scope, search, status, today }).sort((a, b) => dateValue(a.calendar.calendarDate) - dateValue(b.calendar.calendarDate)), [dateFilter, due, operationalRecords, scope, search, status, today]);

  const selectedWork = selectedWorkId ? workItems.find((work) => work.id === selectedWorkId) : undefined;

  return (
    <>
      <div className="due-controls" aria-label="Due register filters">
        <label className="search-control due-controls__search"><span className="sr-only">Search due register</span><input onChange={(event) => setSearch(event.target.value)} placeholder="Search taxpayer or return" type="search" value={search} /></label>
        <label className="select-control"><span>Due</span><select onChange={(event) => setDue(event.target.value as DuePreset)} value={due}><option value="all">All dates</option><option value="today">Today</option><option value="next-5">Next 5 days</option><option value="week">This week</option><option value="overdue">Overdue</option><option value="attention">Needs attention</option><option value="blocked">Blocked</option><option value="statutory">Statutory exposure</option></select></label>
        <label className="select-control"><span>Status</span><select onChange={(event) => setStatus(event.target.value as "all" | FixtureStatus)} value={status}><option value="all">All status</option><option value="GREEN">Green</option><option value="AMBER">Amber</option><option value="RED">Red</option><option value="UNRESOLVED">Unresolved</option></select></label>
        {(dateFilter || due !== "all" || status !== "all" || search) && <button className="text-button" onClick={() => { setSearch(""); setDue("all"); setStatus("all"); onClearDate?.(); }} type="button">Clear filters</button>}
        <span className="due-controls__count">{rows.length} due</span>
      </div>
      <section aria-labelledby="due-register-title" className="panel panel--table due-register-panel">
                <div className="section-heading"><div><h2 id="due-register-title">Due register</h2></div><span className="section-heading__note">{dateFilter ? `Due ${dateFilter}` : "Internal target first"}</span></div>
        <div className="due-register" aria-label="Due register">
          {rows.length === 0 ? <div className="inline-empty">No due work matches these filters.</div> : <><OperationalRegisterHeader mode="due" />{rows.map((record) => <OperationalRegisterRow key={record.calendar.id} mode="due" onSelect={setSelectedWorkId} record={record} />)}</>}
        </div>
      </section>
      <p className="deadline-note">The target is the TMF package target. Statutory and adjusted deadlines remain available in the work detail.</p>
      {selectedWork && <WorkDetail onClose={() => setSelectedWorkId(null)} work={selectedWork} />}
    </>
  );
}

type WorkQueueFilter = "all" | "today" | "waiting" | "attention";

function stepCount(work: FixtureWorkItem) {
  const processSteps = work.steps;
  return `${processSteps.filter((step) => step.state === "complete").length}/${processSteps.length} process steps recorded`;
}

export function WorkRegisterView({ scope, initialDue = "all", initialQueue = "all" }: { scope: ScopeFilter; initialDue?: DuePreset; initialQueue?: WorkQueueFilter }) {
  const [search, setSearch] = useState("");
  const [due, setDue] = useState<DuePreset>(initialDue);
  const [status, setStatus] = useState<"all" | FixtureStatus>("all");
  const [queue, setQueue] = useState<WorkQueueFilter>(initialQueue);
  const [sort, setSort] = useState<"priority" | "deadline" | "client">("priority");
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);
  const { getEffectiveWork, getOperationalRecords, getWorkItems, isWorkVisible, operationalToday, prototypeMode } = useWorkflow();
  const workItems = getWorkItems();
  const reviewDate = operationalToday;
  const operationalRecords = useMemo(() => getOperationalRecords().flatMap((record) => {
    const work = getEffectiveWork(record.work);
    return (prototypeMode ? isWorkVisible(work) : true) ? [{ ...record, work, status: work.status }] : [];
  }), [getEffectiveWork, getOperationalRecords, isWorkVisible, prototypeMode]);
  const records = useMemo(() => {
    const dueRecords = filterFixtureOperationalRecords(operationalRecords, { due, scope, search, status, today: reviewDate });
    const workRecords = getFixtureWorkRegisterRecords(dueRecords, reviewDate).filter(({ work, milestones }) => {
      if (queue === "today" && !milestones.some((item) => item.calendarDate === reviewDate)) return false;
      if (queue === "waiting" && !work.blocker) return false;
      if (queue === "attention" && work.status === "GREEN" && !work.blocker) return false;
      return true;
    });

    return workRecords.sort((a, b) => {
      if (sort === "client") return a.work.client.localeCompare(b.work.client);
      if (sort === "deadline") return dateValue(a.calendar.calendarDate) - dateValue(b.calendar.calendarDate);
      const priority: Record<FixtureStatus, number> = { RED: 0, AMBER: 1, UNRESOLVED: 2, GREEN: 3 };
      return priority[a.status] - priority[b.status];
    });
  }, [due, operationalRecords, queue, reviewDate, scope, search, sort, status]);

  const counts = useMemo(() => {
    const scoped = getFixtureWorkRegisterRecords(filterFixtureOperationalRecords(operationalRecords, { due: "all", scope, status: "all", today: reviewDate }), reviewDate);
    return {
      all: scoped.length,
      today: scoped.filter(({ milestones }) => milestones.some((item) => item.calendarDate === reviewDate)).length,
      waiting: scoped.filter(({ work }) => work.blocker).length,
      attention: scoped.filter(({ work }) => work.status !== "GREEN" || work.blocker).length,
    };
  }, [operationalRecords, reviewDate, scope]);

  const selectedWork = selectedWorkId ? workItems.find((work) => work.id === selectedWorkId) : undefined;

  return (
    <>
      <div className="due-controls" aria-label="Work Register filters">
        <label className="search-control due-controls__search"><span className="sr-only">Search work register</span><input onChange={(event) => setSearch(event.target.value)} placeholder="Search taxpayer, return, or owner" type="search" value={search} /></label>
        <label className="select-control"><span>Due</span><select onChange={(event) => setDue(event.target.value as DuePreset)} value={due}><option value="all">All dates</option><option value="today">Today</option><option value="next-5">Next 5 days</option><option value="week">This week</option><option value="overdue">Overdue</option><option value="attention">Needs attention</option><option value="blocked">Blocked</option></select></label>
        <label className="select-control"><span>Status</span><select onChange={(event) => setStatus(event.target.value as "all" | FixtureStatus)} value={status}><option value="all">All status</option><option value="GREEN">Green</option><option value="AMBER">Amber</option><option value="RED">Red</option><option value="UNRESOLVED">Unresolved</option></select></label>
        <label className="select-control"><span>Sort by</span><select onChange={(event) => setSort(event.target.value as typeof sort)} value={sort}><option value="priority">Priority</option><option value="deadline">Target</option><option value="client">Client</option></select></label>
        {(due !== "all" || status !== "all" || search) && <button className="text-button" onClick={() => { setSearch(""); setDue("all"); setStatus("all"); }} type="button">Clear filters</button>}
        <span className="due-controls__count">{records.length} work items</span>
      </div>
      <section aria-labelledby="work-register-title" className="panel panel--table due-register-panel work-register-panel">
        <div className="section-heading section-heading--queue"><div><h2 id="work-register-title">Work register</h2></div><div className="section-heading__actions"><span className="section-heading__note">{counts.all} in scope</span><Link className="text-link" href={queue === "all" ? "/app/work?queue=attention" : "/app/work?queue=all"}>{queue === "all" ? "Needs attention" : "View all"}</Link></div></div>
        {queue === "all" ? <div aria-label="Work queue" className="filter-tabs filter-tabs--context"><span className="filter-tabs__context-label">All current work</span></div> : <FilterTabs label="Work queue" onChange={setQueue} options={[{ id: "today", label: "Do today", count: counts.today }, { id: "waiting", label: "Waiting", count: counts.waiting }, { id: "attention", label: "Needs attention", count: counts.attention }]} value={queue} />}
        <div className="work-register" aria-label="Work register">
          {records.length === 0 ? <div className="inline-empty">No work matches these filters.</div> : <><OperationalRegisterHeader mode="work" />{records.map((record) => <OperationalRegisterRow key={record.work.id} mode="work" onSelect={setSelectedWorkId} record={record} />)}</>}
        </div>
      </section>
      {selectedWork && <WorkDetail onClose={() => setSelectedWorkId(null)} work={selectedWork} />}
    </>
  );
}

export function DueRegisterWorkspace({ scope, initialDate = null, initialDue = "all" }: { scope: ScopeFilter; initialDate?: string | null; initialDue?: DuePreset }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate);
  useEffect(() => {
    const syncDate = () => setSelectedDate(new URLSearchParams(window.location.search).get("date"));
    window.addEventListener("popstate", syncDate);
    return () => window.removeEventListener("popstate", syncDate);
  }, []);
  function selectDate(date: string) {
    setSelectedDate(date);
    const params = new URLSearchParams(window.location.search);
    params.set("view", "calendar");
    params.set("date", date);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}?${params.toString()}`);
  }
  return <>
    <CalendarView includeDueRegister={false} onSelectDate={selectDate} scope={scope} selectedDate={selectedDate} />
    <DueRegisterView dateFilter={selectedDate} onClearDate={() => setSelectedDate(null)} preset={initialDue} scope={scope} />
  </>;
}

export function CalendarView({ scope, selectedDate, onSelectDate, includeDueRegister = true }: { scope: ScopeFilter; selectedDate?: string | null; onSelectDate?: (date: string) => void; includeDueRegister?: boolean }) {
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);
  const selectedDateParts = selectedDate?.match(/^(\d{4})-(\d{2})-/);
  const { getEffectiveWork, getOperationalRecords, getWorkItems, isWorkVisible, operationalToday, prototypeMode } = useWorkflow();
  const runtimeToday = operationalToday;
  const [displayMonth, setDisplayMonth] = useState({ year: selectedDateParts ? Number(selectedDateParts[1]) : Number(runtimeToday.slice(0, 4)), month: selectedDateParts ? Number(selectedDateParts[2]) - 1 : Number(runtimeToday.slice(5, 7)) - 1 });
  const workItems = getWorkItems();
  const { year, month } = displayMonth;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, index) => index < firstDay ? null : index - firstDay + 1);
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthLabel = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(year, month, 1));
  const operationalRecords = useMemo(() => getOperationalRecords().flatMap((record) => {
    const work = getEffectiveWork(record.work);
    return (prototypeMode ? isWorkVisible(work) : true) ? [{ ...record, work, status: work.status }] : [];
  }), [getEffectiveWork, getOperationalRecords, isWorkVisible, prototypeMode]);
  const scopedItems = operationalRecords.filter((record) => isInScope(record.scope, scope));
  const monthItems = scopedItems.filter(({ calendar: item }) => item.calendarDate.startsWith(monthKey));

  function moveMonth(delta: number) {
    const next = new Date(year, month + delta, 1);
    setDisplayMonth({ year: next.getFullYear(), month: next.getMonth() });
  }

  return (
    <>
      <section className="panel calendar-grid-panel" aria-labelledby="calendar-title">
        <div className="calendar-month__header"><button aria-label="Previous month" className="calendar-month__nav" onClick={() => moveMonth(-1)} type="button">‹</button><h2 id="calendar-title">{monthLabel}</h2><button aria-label="Next month" className="calendar-month__nav" onClick={() => moveMonth(1)} type="button">›</button></div>
        <div className="calendar-month__weekdays" aria-hidden="true"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div>
        <div className="calendar-month__days calendar-month__days--compact">
          {cells.map((day, index) => {
            const date = day ? `${monthKey}-${String(day).padStart(2, "0")}` : null;
            const items = date ? scopedItems.filter(({ calendar: item }) => item.calendarDate === date) : [];
            return <div className={`calendar-day${date && date === selectedDate ? " calendar-day--selected" : ""}${!day ? " calendar-day--empty" : ""}`} key={date ?? `empty-${index}`}>
              {day && <button aria-label={`${monthLabel} ${day}${items.length ? `, ${items.length} scheduled item${items.length === 1 ? "" : "s"}` : ""}`} className="calendar-day__date" onClick={() => { if (date) onSelectDate?.(date); }} type="button"><span className="calendar-day__number">{day}</span></button>}
              {items.slice(0, 2).map(({ calendar: item, status, work }) => <button aria-label={`${compactReturnLabel(item.returnLabel)}, ${status}`} className={`calendar-event calendar-event--${status.toLowerCase()}`} key={item.id} onClick={() => { onSelectDate?.(item.calendarDate); setSelectedWorkId(work.id); }} type="button"><span className="calendar-event__label">{compactReturnLabel(item.returnLabel)}</span></button>)}
              {items.length > 2 && <span className="calendar-day__more">+{items.length - 2} more</span>}
            </div>;
          })}
        </div>
        <div className="calendar-legend"><span><i className="calendar-legend__mark calendar-legend__mark--green" />Green</span><span><i className="calendar-legend__mark calendar-legend__mark--amber" />Amber</span><span><i className="calendar-legend__mark calendar-legend__mark--red" />Red</span><span className="section-heading__note">{monthItems.length} scheduled</span></div>
      </section>
      {includeDueRegister && <section className="calendar-day-register" aria-labelledby="calendar-day-title">
        <div className="section-heading"><div><h2 id="calendar-day-title">{selectedDate ? `Due on ${selectedDate}` : "Select a date"}</h2></div><span className="section-heading__note">{selectedDate ? "Due register" : "Calendar links to the due register"}</span></div>
        {selectedDate ? <DueRegisterView dateFilter={selectedDate} scope={scope} /> : <div className="calendar-selection-hint">Select a marked date to open its due register.</div>}
      </section>}
      {selectedWorkId && <WorkDetail onClose={() => setSelectedWorkId(null)} work={workItems.find((work) => work.id === selectedWorkId)!} />}
    </>
  );
}
