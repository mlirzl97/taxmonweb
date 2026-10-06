"use client";

import { useMemo, useState } from "react";

import { fixtureWork } from "@/lib/fixtures";
import { FilterTabs, FixturePageFrame, isInScope, PageHeader, ScopeSwitcher, type ScopeFilter, WorkDetail } from "@/components/app/workspace-components";

type WorkFilter = "all" | "today" | "waiting" | "returned" | "complete";

export default function MyWorkPage() {
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [filter, setFilter] = useState<WorkFilter>("all");
  const [sort, setSort] = useState("priority");
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);

  const visibleWork = useMemo(() => {
    const filtered = fixtureWork.filter((work) => {
      if (!isInScope(work.scope, scope)) return false;
      if (filter === "today") return work.id !== "work-03";
      if (filter === "waiting") return work.blocker !== undefined;
      if (filter === "returned") return work.id === "work-02";
      if (filter === "complete") return work.status === "GREEN";
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sort === "client") return a.client.localeCompare(b.client);
      if (sort === "deadline") return a.deadline.localeCompare(b.deadline);
      const priority: Record<string, number> = { RED: 0, AMBER: 1, UNRESOLVED: 2, GREEN: 3 };
      return priority[a.status] - priority[b.status];
    });
  }, [filter, scope, sort]);

  const selectedWork = fixtureWork.find((work) => work.id === selectedWorkId);

  return (
    <FixturePageFrame>
      <PageHeader
        title="My Work"
      />

      <div className="page-toolbar page-toolbar--stackable">
        <ScopeSwitcher onChange={setScope} value={scope} />
        <label className="select-control">Sort by <select aria-label="Sort My Work" onChange={(event) => setSort(event.target.value)} value={sort}><option value="priority">Priority</option><option value="deadline">Deadline</option><option value="client">Client</option></select></label>
      </div>

      <section aria-labelledby="work-queue-title" className="panel panel--table">
        <div className="section-heading section-heading--queue"><div><h2 id="work-queue-title">Action queue</h2></div><span className="queue-count">{visibleWork.length} visible</span></div>
        <FilterTabs
          label="My Work filters"
          onChange={setFilter}
          options={[
            { id: "all", label: "All work" },
            { id: "today", label: "Do today" },
            { id: "waiting", label: "Waiting on someone" },
            { id: "returned", label: "Returned" },
            { id: "complete", label: "Recently complete" },
          ]}
          value={filter}
        />
        <div className="work-list">
          {visibleWork.length === 0 ? <div className="inline-empty">Nothing requires action in this view.</div> : visibleWork.map((work) => (
            <button className="work-row" key={work.id} onClick={() => setSelectedWorkId(work.id)} type="button">
              <span className="work-row__priority"><span className={`priority-dot priority-dot--${work.status.toLowerCase()}`} /><span className="sr-only">{work.status} priority</span></span>
              <span className="work-row__main"><strong>{work.nextAction}</strong><small>{work.title} · {work.client}</small><small>{work.registrationUnit} · {work.period}</small></span>
              <span className="work-row__stage"><span className="row-label">Stage</span><strong>{work.stage}</strong></span>
              <span className="work-row__deadline"><span className="row-label">When</span><strong>{work.deadline}</strong><small>{work.deadlineType}</small></span>
              <span className={`rag-text rag-text--${work.status.toLowerCase()}`}>{work.status}</span>
            </button>
          ))}
        </div>
      </section>

      {selectedWork && <WorkDetail onClose={() => setSelectedWorkId(null)} work={selectedWork} />}
    </FixturePageFrame>
  );
}
