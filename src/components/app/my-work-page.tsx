"use client";

import Link from "next/link";

import { DueRegisterWorkspace, WorkRegisterView } from "@/components/app/control-tower-views";
import type { DuePreset } from "@/lib/fixtures-read-model";
import { FixturePageFrame, PageHeader } from "@/components/app/workspace-components";
import { useWorkflow } from "@/lib/workflow-state";

type WorkQueue = "all" | "today" | "waiting" | "attention";
type MyWorkView = "queue" | "calendar";

type MyWorkPageProps = {
  initialDate: string | null;
  initialDue: DuePreset;
  initialQueue: WorkQueue;
  initialView: MyWorkView;
};

const myWorkViews: ReadonlyArray<{ id: MyWorkView; label: string }> = [
  { id: "queue", label: "Work queue" },
  { id: "calendar", label: "Calendar" },
];

export default function MyWorkPage({ initialDate, initialDue, initialQueue, initialView }: MyWorkPageProps) {
  const { prototypeMode } = useWorkflow();
  const queueDue: DuePreset = initialDue !== "all" ? initialDue : initialQueue === "today" ? "today" : initialQueue === "waiting" ? "blocked" : initialQueue === "attention" ? "attention" : "all";
  return (
    <FixturePageFrame>
      <PageHeader action={prototypeMode ? <span className="module-action-note">One return package · assigned actions stay here.</span> : undefined} title="Work" />
      <>
        <nav aria-label="My Work pages" className="tower-tabs module-tabs my-work-tabs" role="tablist">
          {myWorkViews.map((view) => <Link aria-current={initialView === view.id ? "page" : undefined} className={initialView === view.id ? "tower-tab tower-tab--active" : "tower-tab"} href={`/app/work?view=${view.id}`} key={view.id} role="tab">{view.label}</Link>)}
        </nav>
        {initialView === "calendar" ? <section aria-labelledby="work-calendar-title" className="my-work-page"><div className="my-work-page__subheader"><div><p className="eyebrow">Targets and milestones</p><h2 id="work-calendar-title">Calendar</h2><p>Due dates remain linked to the same return package used by the Work queue.</p></div><Link className="text-link" href="/app/work?view=queue">Open work queue</Link></div><DueRegisterWorkspace initialDate={initialDate} initialDue={queueDue} scope="all" /></section> : <WorkRegisterView initialDue={queueDue} initialQueue={initialQueue} scope="all" />}
      </>
    </FixturePageFrame>
  );
}
