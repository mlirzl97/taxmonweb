"use client";

import { useMemo, useState } from "react";

import { fixtureCalendar, fixtureClients, fixtureWork, type FixtureStatus } from "@/lib/fixtures";
import { isInScope, type ScopeFilter, WorkDetail } from "./workspace-components";

const reviewDate = "2026-10-05";

type DuePreset = "all" | "today" | "next-5" | "week" | "overdue" | "attention" | "blocked" | "statutory";

function dateValue(value: string) {
  return new Date(`${value}T00:00:00`).getTime();
}

function compactReturnLabel(value: string) {
  return value.replace(" · ", " ");
}

function workForCalendar(item: (typeof fixtureCalendar)[number]) {
  return fixtureWork.find((work) => work.id === item.workId);
}

export function DueRegisterView({ scope, preset = "all", dateFilter }: { scope: ScopeFilter; preset?: DuePreset; dateFilter?: string | null }) {
  const [search, setSearch] = useState("");
  const [due, setDue] = useState<DuePreset>(preset);
  const [status, setStatus] = useState<"all" | FixtureStatus>("all");
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);

  const rows = useMemo(() => fixtureCalendar.filter((item) => {
    const work = workForCalendar(item);
    if (!isInScope(item.scope, scope) || !work) return false;
    if (dateFilter && item.calendarDate !== dateFilter) return false;
    const daysFromReview = Math.round((dateValue(item.calendarDate) - dateValue(reviewDate)) / 86_400_000);
    if (due === "today" && daysFromReview !== 0) return false;
    if (due === "next-5" && (daysFromReview < 0 || daysFromReview > 5)) return false;
    if (due === "week" && (daysFromReview < 0 || daysFromReview > 7)) return false;
    if (due === "overdue" && !item.internalDeadline.toLowerCase().includes("overdue")) return false;
    if (due === "attention" && work.status === "GREEN") return false;
    if (due === "blocked" && !work.blocker) return false;
    if (due === "statutory" && (item.statutoryDeadline === "Rule unresolved" || work.status !== "RED")) return false;
    if (status !== "all" && work.status !== status) return false;
    const query = search.trim().toLowerCase();
    if (query && ![item.client, item.returnLabel, item.period, work.owner, work.stage].some((value) => value.toLowerCase().includes(query))) return false;
    return true;
  }).sort((a, b) => dateValue(a.calendarDate) - dateValue(b.calendarDate)), [dateFilter, due, scope, search, status]);

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
        <div className="due-register" role="table" aria-label="Due register">
          <div className="due-register__header" role="row"><span>Target</span><span>Taxpayer</span><span>Return / submission</span><span>Period</span><span>Stage / status</span><span>Owner</span><span>Attention</span></div>
          {rows.length === 0 ? <div className="inline-empty">No due work matches these filters.</div> : rows.map((item) => {
            const work = workForCalendar(item);
            if (!work) return null;
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

export function CalendarView({ scope }: { scope: ScopeFilter }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);
  const year = 2026;
  const month = 9;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, index) => index < firstDay ? null : index - firstDay + 1);
  const scopedItems = fixtureCalendar.filter((item) => isInScope(item.scope, scope));
  const selectedItems = selectedDate ? scopedItems.filter((item) => item.calendarDate === selectedDate) : [];

  return (
    <>
      <section className="panel calendar-grid-panel" aria-labelledby="calendar-title">
        <div className="section-heading"><div><h2 id="calendar-title">Calendar</h2></div><span className="section-heading__note">October 2026 · {scopedItems.length} scheduled</span></div>
        <div className="calendar-month__weekdays" aria-hidden="true"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div>
        <div className="calendar-month__days calendar-month__days--compact">
          {cells.map((day, index) => {
            const date = day ? `2026-10-${String(day).padStart(2, "0")}` : null;
            const items = date ? scopedItems.filter((item) => item.calendarDate === date) : [];
            return <div className={`calendar-day${date && date === selectedDate ? " calendar-day--selected" : ""}${!day ? " calendar-day--empty" : ""}`} key={date ?? `empty-${index}`}>
              {day && <button aria-label={`October ${day}${items.length ? `, ${items.length} due` : ""}`} className="calendar-day__date" onClick={() => setSelectedDate(date)} type="button"><span className="calendar-day__number">{day}</span></button>}
              {items.length > 0 && <div className="calendar-day__load"><strong>{items.length}</strong><small>due</small></div>}
              {items.slice(0, 2).map((item) => <button className={`calendar-event calendar-event--${item.status.toLowerCase()}`} key={item.id} onClick={() => { setSelectedDate(item.calendarDate); setSelectedWorkId(item.workId); }} type="button"><span className="calendar-event__mark" /><span className="calendar-event__label">{compactReturnLabel(item.returnLabel)}</span></button>)}
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
