"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

import { DueRegisterWorkspace, WorkRegisterView } from "@/components/app/control-tower-views";
import { MyRunView } from "@/components/app/my-run-view";
import { DetailDrawer, FixturePageFrame, PageHeader } from "@/components/app/workspace-components";
import { fixtureClients, type FixturePaymentApplicability, type FixtureStatus, type FixtureWorkItem } from "@/lib/fixtures";
import type { DuePreset } from "@/lib/fixtures-read-model";
import { useWorkflow, type WorkAdminInput } from "@/lib/workflow-state";

type WorkQueue = "all" | "today" | "waiting" | "attention";
type MyWorkView = "queue" | "calendar" | "run";

type MyWorkPageProps = {
  initialDate: string | null;
  initialDue: DuePreset;
  initialQueue: WorkQueue;
  initialView: MyWorkView;
};

const myWorkViews: ReadonlyArray<{ id: MyWorkView; label: string }> = [
  { id: "queue", label: "Work queue" },
  { id: "run", label: "My run" },
  { id: "calendar", label: "Calendar" },
];

const emptyWorkDraft: WorkAdminInput = {
  clientId: fixtureClients[0]?.id ?? "",
  title: "",
  period: "",
  deadline: "",
  owner: "",
  stage: "PREPARE",
  status: "UNRESOLVED",
  nextAction: "",
  detail: "",
  paymentApplicability: "UNRESOLVED",
  paymentAmount: null,
};

function AddWorkDrawer({ onClose }: { onClose: () => void }) {
  const { clientRegistry, createLiveWorkItem, createWorkItem, prototypeMode } = useWorkflow();
  const [draft, setDraft] = useState<WorkAdminInput>(emptyWorkDraft);
  const [error, setError] = useState("");
  const clients = prototypeMode ? fixtureClients : clientRegistry;

  function update<K extends keyof WorkAdminInput>(key: K, value: WorkAdminInput[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = prototypeMode ? createWorkItem(draft) : await createLiveWorkItem(draft);
    if (!result.ok) {
      setError(result.error ?? "The work item could not be added.");
      return;
    }
    onClose();
  }

  const liveClientsLoading = !prototypeMode && clients.length === 0;
  return <DetailDrawer eyebrow="Work register" title="Add work" subtitle={prototypeMode ? "Create a sanitized work record." : "Create a governed Work record from an approved taxpayer and BIR requirement."} onClose={onClose}>
    <form className="work-admin-form" onSubmit={submit}>
      <label><span>Taxpayer</span><select disabled={liveClientsLoading} onChange={(event) => update("clientId", event.target.value)} required value={draft.clientId}><option value="">{liveClientsLoading ? "Loading taxpayers…" : "Select taxpayer"}</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
      <label><span>Approved requirement code</span><input onChange={(event) => update("title", event.target.value)} placeholder={prototypeMode ? "e.g. WHT 1601EQ" : "e.g. BIR-1601-EQ"} required value={draft.title} /></label>
      <label><span>Period</span><input onChange={(event) => update("period", event.target.value)} placeholder="e.g. October 2026" required value={draft.period} /></label>
      <label><span>TMF target</span><input onChange={(event) => update("deadline", event.target.value)} placeholder="e.g. 2026-11-09" required value={draft.deadline} /></label>
      {prototypeMode && <>
        <label><span>Owner</span><input onChange={(event) => update("owner", event.target.value)} placeholder="Preparer or accountable owner" required value={draft.owner} /></label>
        <div className="form-grid form-grid--compact">
          <label><span>Stage</span><select onChange={(event) => update("stage", event.target.value as FixtureWorkItem["stage"])} value={draft.stage}><option value="PREPARE">Preparation</option><option value="REVIEW">Review</option><option value="CLIENT">Client approval</option><option value="FILE">Filing</option><option value="POST-FILING">Post-filing</option></select></label>
          <label><span>RAG</span><select onChange={(event) => update("status", event.target.value as FixtureStatus)} value={draft.status}><option value="UNRESOLVED">Unresolved</option><option value="GREEN">Green</option><option value="AMBER">Amber</option><option value="RED">Red</option></select></label>
        </div>
        <label><span>Next action</span><input onChange={(event) => update("nextAction", event.target.value)} placeholder="What needs to happen next?" required value={draft.nextAction} /></label>
      </>}
      <label><span>Payment</span><select onChange={(event) => update("paymentApplicability", event.target.value as FixturePaymentApplicability)} value={draft.paymentApplicability}><option value="UNRESOLVED">Unresolved</option><option value="REQUIRED">Required</option><option value="NOT_APPLICABLE">Not applicable</option></select></label>
      {draft.paymentApplicability === "REQUIRED" && <label><span>Amount to pay</span><input inputMode="decimal" min="0" onChange={(event) => update("paymentAmount", event.target.value === "" ? null : Number(event.target.value))} placeholder="PHP" type="number" value={draft.paymentAmount ?? ""} /></label>}
      {prototypeMode && <label><span>Note</span><textarea onChange={(event) => update("detail", event.target.value)} placeholder="Short context or blocker" value={draft.detail} /></label>}
      {error && <div className="callout callout--error" role="alert">{error}</div>}
      {!prototypeMode && <p className="form-help">The signed-in user is recorded as the preparer. Status starts unresolved until the governed workflow advances it.</p>}
      <div className="team-editor__footer"><button className="button button--quiet" onClick={onClose} type="button">Cancel</button><button className="button button--primary" disabled={liveClientsLoading} type="submit">Add work</button></div>
    </form>
  </DetailDrawer>;
}

export default function MyWorkPage({ initialDate, initialDue, initialQueue, initialView }: MyWorkPageProps) {
  const { getEffectiveWork, getWorkItems, isWorkVisible, prototypeMode, workPerspective } = useWorkflow();
  const [addWorkOpen, setAddWorkOpen] = useState(false);
  const queueDue: DuePreset = initialDue !== "all" ? initialDue : initialQueue === "today" ? "today" : initialQueue === "waiting" ? "blocked" : initialQueue === "attention" ? "attention" : "all";
  const personalWork = useMemo(() => getWorkItems().map(getEffectiveWork).filter((work) => prototypeMode ? isWorkVisible(work) : true), [getEffectiveWork, getWorkItems, isWorkVisible, prototypeMode]);
  return (
    <FixturePageFrame>
      <PageHeader action={<button className="button button--primary button--small" onClick={() => setAddWorkOpen(true)} type="button">Add work</button>} title="Work" />
      <>
        <nav aria-label="Work views" className="tower-tabs module-tabs my-work-tabs">
          {myWorkViews.map((view) => <Link aria-current={initialView === view.id ? "page" : undefined} className={initialView === view.id ? "tower-tab tower-tab--active" : "tower-tab"} href={`/app/work?view=${view.id}`} key={view.id}>{view.label}</Link>)}
        </nav>
        {initialView === "calendar" ? <section aria-labelledby="work-calendar-title" className="my-work-page"><div className="my-work-page__subheader"><div><p className="eyebrow">Targets and milestones</p><h2 id="work-calendar-title">Calendar</h2><p>Due dates remain linked to the same return package used by the Work queue.</p></div><Link className="text-link" href="/app/work?view=queue">Open work queue</Link></div><DueRegisterWorkspace initialDate={initialDate} initialDue={queueDue} scope="all" /></section> : initialView === "run" ? <MyRunView perspective={workPerspective} work={personalWork} /> : <WorkRegisterView initialDue={queueDue} initialQueue={initialQueue} scope="all" />}
      </>
      {addWorkOpen && <AddWorkDrawer onClose={() => setAddWorkOpen(false)} />}
    </FixturePageFrame>
  );
}
