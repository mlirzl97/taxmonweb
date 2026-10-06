"use client";

import { useMemo, useState } from "react";

import { fixtureClock, fixtureClients, fixtureWork, type FixtureStatus } from "@/lib/fixtures";
import { dateValue, filterFixtureOperationalRecords, getFixtureOperationalRecords, getFixtureWorkRegisterRecords, type DuePreset } from "@/lib/fixtures-read-model";
import { FilterTabs, isInScope, type ScopeFilter, WorkDetail } from "./workspace-components";

const reviewDate = fixtureClock.today;

function compactReturnLabel(value: string) {
  return value.replace(" · ", " ");
}

export function DueRegisterView({ scope, preset = "all", dateFilter }: { scope: ScopeFilter; preset?: DuePreset; dateFilter?: string | null }) {
  const [search, setSearch] = useState("");
  const [due, setDue] = useState<DuePreset>(preset);
  const [status, setStatus] = useState<"all" | FixtureStatus>("all");
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);

  const operationalRecords = getFixtureOperationalRecords();
  const rows = useMemo(() => filterFixtureOperationalRecords(operationalRecords, { dateFilter, due, scope, search, status }).sort((a, b) => dateValue(a.calendar.calendarDate) - dateValue(b.calendar.calendarDate)), [dateFilter, due, operationalRecords, scope, search, status]);

  const selectedWork = selectedWorkId ? fixtureWork.find((work) => work.id === selectedWorkId) : undefined;

  return (
    <>
      <div className="due-controls" aria-label="Due register filters">
        <label className="search-control due-controls__search"><span className="sr-only">Search due register</span><input onChange={(event) => setSearch(event.target.value)} placeholder="Search taxpayer or return" type="search" value={search} /></label>
        <label className="select-control"><span>Due</span><select onChange={(event) => setDue(event.target.value as DuePreset)} value={due}><option value="all">All dates</option><option value="today">Today</option><option value="next-5">Next 5 days</option><option value="week">This week</option><option value="overdue">Overdue</option><option value="attention">Needs attention</option><option value="blocked">Blocked</option><option value="statutory">Statutory exposure</option></select></label>
        <label className="select-control"><span>Status</span><select onChange={(event) => setStatus(event.target.value as "all" | FixtureStatus)} value={status}><option value="all">All status</option><option value="GREEN">Green</option><option value="AMBER">Amber</option><option value="RED">Red</option><option value="UNRESOLVED">Unresolved</option></select></label>
        {(dateFilter || due !== "all" || status !== "all" || search) && <button className="text-button" onClick={() => { setSearch(""); setDue("all"); setStatus("all"); }} type="button">Clear filters</button>}
        <span className="due-controls__count">{rows.length} due</span>
      </div>
      <section aria-labelledby="due-register-title" className="panel panel--table due-register-panel">
        <div className="section-heading"><div><h2 id="due-register-title">Due register</h2></div><span className="section-heading__note">Internal target first</span></div>
        <div className="due-register" aria-label="Due register">
          <div className="due-register__header"><span>Target</span><span>Taxpayer</span><span>Return / submission</span><span>Period</span><span>Stage / status</span><span>Owner</span><span>Attention</span></div>
          {rows.length === 0 ? <div className="inline-empty">No due work matches these filters.</div> : rows.map(({ calendar: item, work }) => {
            return <button className="due-register__row" key={item.id} onClick={() => setSelectedWorkId(work.id)} type="button">
              <span className={`due-register__date due-register__date--${work.status.toLowerCase()}`}><strong>{item.calendarDate.slice(-2)}</strong><small>{item.internalDeadline.replace(/^.*?·\s*/, "")}</small></span>
              <span><strong>{item.client}</strong><small>{item.scope}</small></span>
              <span><strong>{compactReturnLabel(item.returnLabel)}</strong><small>{item.milestone}</small></span>
              <span className="due-register__period">{item.period}</span>
              <span><span className={`rag-text rag-text--${work.status.toLowerCase()}`}>{work.stage}</span><small>{work.statusReason}</small></span>
              <span>{work.owner}<small>{fixtureClients.find((client) => client.id === item.clientId)?.assignment.tower}</small></span>
              <span className="due-register__attention">{work.blocker?.category ?? (work.status === "GREEN" ? "—" : "Review")}</span>
            </button>;
          })}
        </div>
      </section>
      <p className="deadline-note">The target is the TMF package target. Statutory and adjusted deadlines remain available in the work detail.</p>
      {selectedWork && <WorkDetail onClose={() => setSelectedWorkId(null)} work={selectedWork} />}
    </>
  );
}

type WorkQueueFilter = "all" | "today" | "waiting" | "returned" | "attention";

function stepCount(work: (typeof fixtureWork)[number]) {
  return `${work.steps.filter((step) => step.state === "complete").length}/${work.steps.length} steps recorded`;
}

export function WorkRegisterView({ scope }: { scope: ScopeFilter }) {
  const [search, setSearch] = useState("");
  const [due, setDue] = useState<DuePreset>("all");
  const [status, setStatus] = useState<"all" | FixtureStatus>("all");
  const [queue, setQueue] = useState<WorkQueueFilter>("all");
  const [sort, setSort] = useState<"priority" | "deadline" | "client">("priority");
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);

  const operationalRecords = getFixtureOperationalRecords();
  const records = useMemo(() => {
    const dueRecords = filterFixtureOperationalRecords(operationalRecords, { due, scope, search, status });
    const workRecords = getFixtureWorkRegisterRecords(dueRecords).filter(({ work, milestones }) => {
      if (queue === "today" && !milestones.some((item) => item.calendarDate === reviewDate)) return false;
      if (queue === "waiting" && !work.blocker) return false;
      if (queue === "returned" && !work.returnedFrom) return false;
      if (queue === "attention" && work.status === "GREEN") return false;
      return true;
    });

    return workRecords.sort((a, b) => {
      if (sort === "client") return a.work.client.localeCompare(b.work.client);
      if (sort === "deadline") return dateValue(a.calendar.calendarDate) - dateValue(b.calendar.calendarDate);
      const priority: Record<FixtureStatus, number> = { RED: 0, AMBER: 1, UNRESOLVED: 2, GREEN: 3 };
      return priority[a.status] - priority[b.status];
    });
  }, [due, operationalRecords, queue, scope, search, sort, status]);

  const counts = useMemo(() => {
    const scoped = getFixtureWorkRegisterRecords(filterFixtureOperationalRecords(operationalRecords, { due: "all", scope, status: "all" }));
    return {
      all: scoped.length,
      today: scoped.filter(({ milestones }) => milestones.some((item) => item.calendarDate === reviewDate)).length,
      waiting: scoped.filter(({ work }) => work.blocker).length,
      returned: scoped.filter(({ work }) => work.returnedFrom).length,
      attention: scoped.filter(({ work }) => work.status !== "GREEN").length,
    };
  }, [operationalRecords, scope]);

  const selectedWork = selectedWorkId ? fixtureWork.find((work) => work.id === selectedWorkId) : undefined;

  return (
    <>
      <section className="work-register-explainer" aria-label="How My Work relates to the Due Register">
        <div><span className="eyebrow">Same operational truth</span><strong>Due Register → Work Register → step-by-step detail</strong></div>
        <p>Due Register answers when work is due. Work Register answers what must happen next, who owns it, and which control or evidence is still open.</p>
      </section>
      <div className="due-controls" aria-label="Work Register filters">
        <label className="search-control due-controls__search"><span className="sr-only">Search work register</span><input onChange={(event) => setSearch(event.target.value)} placeholder="Search taxpayer, return, or owner" type="search" value={search} /></label>
        <label className="select-control"><span>Due</span><select onChange={(event) => setDue(event.target.value as DuePreset)} value={due}><option value="all">All dates</option><option value="today">Today</option><option value="next-5">Next 5 days</option><option value="week">This week</option><option value="overdue">Overdue</option><option value="attention">Needs attention</option><option value="blocked">Blocked</option></select></label>
        <label className="select-control"><span>Status</span><select onChange={(event) => setStatus(event.target.value as "all" | FixtureStatus)} value={status}><option value="all">All status</option><option value="GREEN">Green</option><option value="AMBER">Amber</option><option value="RED">Red</option><option value="UNRESOLVED">Unresolved</option></select></label>
        <label className="select-control"><span>Sort by</span><select onChange={(event) => setSort(event.target.value as typeof sort)} value={sort}><option value="priority">Priority</option><option value="deadline">Target</option><option value="client">Client</option></select></label>
        {(due !== "all" || status !== "all" || search) && <button className="text-button" onClick={() => { setSearch(""); setDue("all"); setStatus("all"); }} type="button">Clear filters</button>}
        <span className="due-controls__count">{records.length} work items</span>
      </div>
      <section aria-labelledby="work-register-title" className="panel panel--table due-register-panel work-register-panel">
        <div className="section-heading section-heading--queue"><div><h2 id="work-register-title">Work register</h2><p>One row per generated work item; milestones remain available in the detail.</p></div><span className="section-heading__note">{counts.all} in scope</span></div>
        <FilterTabs label="Work Register filters" onChange={setQueue} options={[{ id: "all", label: "All work", count: counts.all }, { id: "today", label: "Do today", count: counts.today }, { id: "waiting", label: "Waiting", count: counts.waiting }, { id: "returned", label: "Returned", count: counts.returned }, { id: "attention", label: "Needs attention", count: counts.attention }]} value={queue} />
        <div className="work-register" aria-label="Work register">
          <div className="work-register__header"><span>Target</span><span>Work / obligation</span><span>Current step</span><span>Owner</span><span>Control signal</span></div>
          {records.length === 0 ? <div className="inline-empty">No work matches these filters.</div> : records.map(({ calendar: item, work }) => {
            const currentStep = work.steps.find((step) => step.state === "current" || step.state === "blocked" || step.state === "waiting") ?? work.steps[work.steps.length - 1];
            return <button className="work-register__row" key={work.id} onClick={() => setSelectedWorkId(work.id)} type="button">
              <span className={`work-register__date work-register__date--${work.status.toLowerCase()}`}><strong>{item.calendarDate.slice(-2)}</strong><small>{item.internalDeadline.replace(/^.*?·\s*/, "")}</small></span>
              <span><strong>{work.title}</strong><small>{work.client} · {item.returnLabel.replace(" · ", " ")}</small><small>{work.registrationUnit} · {work.period}</small></span>
              <span><strong>{currentStep?.label}</strong><small>{stepCount(work)}</small></span>
              <span><strong>{work.owner}</strong><small>{work.scope}</small></span>
              <span><span className={`rag-text rag-text--${work.status.toLowerCase()}`}>{work.status}</span><small>{work.blocker?.category ?? work.components.find((component) => component.state.includes("Needs") || component.state.includes("unverified"))?.state ?? "No blocker"}</small></span>
            </button>;
          })}
        </div>
      </section>
      <p className="deadline-note">Targets and statutory dates remain the Due Register’s timing facts. This register adds execution detail; it does not replace the due record.</p>
      {selectedWork && <WorkDetail onClose={() => setSelectedWorkId(null)} work={selectedWork} />}
    </>
  );
}

export function CalendarView({ scope, selectedDate, onSelectDate }: { scope: ScopeFilter; selectedDate?: string | null; onSelectDate?: (date: string) => void }) {
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);
  const year = fixtureClock.year;
  const month = fixtureClock.month;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, index) => index < firstDay ? null : index - firstDay + 1);
  const operationalRecords = getFixtureOperationalRecords();
  const scopedItems = operationalRecords.filter((record) => isInScope(record.scope, scope));
  const selectedItems = selectedDate ? scopedItems.filter(({ calendar: item }) => item.calendarDate === selectedDate) : [];

  return (
    <>
      <section className="panel calendar-grid-panel" aria-labelledby="calendar-title">
        <div className="section-heading"><div><h2 id="calendar-title">Calendar</h2></div><span className="section-heading__note">October 2026 · {scopedItems.length} scheduled</span></div>
        <div className="calendar-month__weekdays" aria-hidden="true"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div>
        <div className="calendar-month__days calendar-month__days--compact">
          {cells.map((day, index) => {
            const date = day ? `2026-10-${String(day).padStart(2, "0")}` : null;
            const items = date ? scopedItems.filter(({ calendar: item }) => item.calendarDate === date) : [];
            return <div className={`calendar-day${date && date === selectedDate ? " calendar-day--selected" : ""}${!day ? " calendar-day--empty" : ""}`} key={date ?? `empty-${index}`}>
              {day && <button aria-label={`October ${day}${items.length ? `, ${items.length} due` : ""}`} className="calendar-day__date" onClick={() => { if (date) onSelectDate?.(date); }} type="button"><span className="calendar-day__number">{day}</span></button>}
              {items.length > 0 && <div className="calendar-day__load"><strong>{items.length}</strong><small>due</small></div>}
              {items.slice(0, 2).map(({ calendar: item, status, work }) => <button className={`calendar-event calendar-event--${status.toLowerCase()}`} key={item.id} onClick={() => { onSelectDate?.(item.calendarDate); setSelectedWorkId(work.id); }} type="button"><span className="calendar-event__mark" /><span className="calendar-event__label">{compactReturnLabel(item.returnLabel)}</span></button>)}
              {items.length > 2 && <span className="calendar-day__more">+{items.length - 2} more</span>}
            </div>;
          })}
        </div>
        <div className="calendar-legend"><span><i className="calendar-legend__mark calendar-legend__mark--green" />Green</span><span><i className="calendar-legend__mark calendar-legend__mark--amber" />Amber</span><span><i className="calendar-legend__mark calendar-legend__mark--red" />Red</span></div>
      </section>
      <section className="calendar-day-register" aria-labelledby="calendar-day-title">
        <div className="section-heading"><div><h2 id="calendar-day-title">{selectedDate ? `Due on ${selectedDate}` : "Select a date"}</h2></div><span className="section-heading__note">{selectedDate ? `${selectedItems.length} due` : "Calendar links to the due register"}</span></div>
        {selectedDate ? <DueRegisterView dateFilter={selectedDate} scope={scope} /> : <div className="calendar-selection-hint">Select a marked date to open its due register.</div>}
      </section>
      {selectedWorkId && <WorkDetail onClose={() => setSelectedWorkId(null)} work={fixtureWork.find((work) => work.id === selectedWorkId)!} />}
    </>
  );
}
