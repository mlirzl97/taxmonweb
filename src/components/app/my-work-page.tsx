"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { DueRegisterWorkspace, WorkRegisterView } from "@/components/app/control-tower-views";
import { MyRunView } from "@/components/app/my-run-view";
import { DetailDrawer, FixturePageFrame, PageHeader } from "@/components/app/workspace-components";
import { fixtureClients, fixtureWork } from "@/lib/fixtures";
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

type RequirementOption = { code: string; name: string; operatingCategory?: string; frequency?: string; version?: string };

const prototypeRequirementOptions: RequirementOption[] = [...new Map(fixtureWork.map((work) => [work.requirementCode ?? work.title, {
  code: work.requirementCode ?? work.title,
  name: work.title,
}])).values()];

function AddWorkDrawer({ onClose }: { onClose: () => void }) {
  const { clientRegistry, createLiveWorkItem, createWorkItem, prototypeMode } = useWorkflow();
  const [draft, setDraft] = useState<WorkAdminInput>(emptyWorkDraft);
  const [error, setError] = useState("");
  const [requirements, setRequirements] = useState<RequirementOption[]>(prototypeMode ? prototypeRequirementOptions : []);
  const [requirementsLoading, setRequirementsLoading] = useState(!prototypeMode);
  const clients = prototypeMode ? fixtureClients : clientRegistry;
  const selectedClient = clients.find((client) => client.id === draft.clientId);
  const assignmentOptions = selectedClient
    ? [
        { role: "Preparer", name: selectedClient.assignment.preparer },
        { role: "Checker", name: selectedClient.assignment.checker },
        { role: "Reviewer", name: selectedClient.assignment.reviewer },
      ].filter((assignment, index, options) => assignment.name !== "Unassigned" && options.findIndex((candidate) => candidate.name === assignment.name) === index)
    : [];

  useEffect(() => {
    if (prototypeMode) return;
    let cancelled = false;
    fetch("/api/requirements/approved", { headers: { accept: "application/json" }, cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { data?: RequirementOption[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Unable to load the approved requirement pool.");
        if (!cancelled) setRequirements(payload.data ?? []);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load the approved requirement pool.");
      })
      .finally(() => {
        if (!cancelled) setRequirementsLoading(false);
      });
    return () => { cancelled = true; };
  }, [prototypeMode]);

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
  const canSubmit = !liveClientsLoading && !requirementsLoading && requirements.length > 0;
  return <DetailDrawer eyebrow="Work register" title="Add work" subtitle="Start the work record with a taxpayer, approved requirement, period, and target date." onClose={onClose}>
    <form className="work-admin-form" onSubmit={submit}>
      <label><span>Taxpayer</span><select disabled={liveClientsLoading} onChange={(event) => { const clientId = event.target.value; const client = clients.find((candidate) => candidate.id === clientId); setDraft((current) => ({ ...current, clientId, owner: prototypeMode && client?.assignment.preparer !== "Unassigned" ? client?.assignment.preparer ?? "" : current.owner })); setError(""); }} required value={draft.clientId}><option value="">{liveClientsLoading ? "Loading taxpayers…" : "Select taxpayer"}</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
      <label><span>Return / submission</span><select disabled={requirementsLoading || requirements.length === 0} onChange={(event) => update("title", event.target.value)} required value={draft.title}><option value="">{requirementsLoading ? "Loading approved returns…" : requirements.length === 0 ? "No approved returns available" : "Select return or submission"}</option>{requirements.map((requirement) => <option key={requirement.code} value={requirement.code}>{requirement.code} — {requirement.name}</option>)}</select></label>
      <label><span>Period</span><input onChange={(event) => update("period", event.target.value)} required type="month" value={draft.period.match(/^\d{4}-\d{2}$/) ? draft.period : ""} /></label>
      <label><span>TMF target</span><input onChange={(event) => update("deadline", event.target.value)} required type="date" value={draft.deadline.match(/^\d{4}-\d{2}-\d{2}$/) ? draft.deadline : ""} /></label>
      {prototypeMode ? <>
        <label><span>Starting owner</span><select onChange={(event) => update("owner", event.target.value)} required value={draft.owner}><option value="">Select from client setup</option>{assignmentOptions.map((assignment) => <option key={assignment.name} value={assignment.name}>{assignment.role} · {assignment.name}</option>)}</select></label>
        <p className="form-help">The package starts with the effective client setup assignment. RAG and next action are derived after creation.</p>
      </> : selectedClient && <section className="work-assignment-summary" aria-label="Assignments from client setup"><span className="meta-label">Assigned from client setup</span><div>{["Preparer", "Checker", "Reviewer"].map((role) => <span key={role}><b>{role}</b>{selectedClient.assignment[role.toLowerCase() as "preparer" | "checker" | "reviewer"]}</span>)}</div></section>}
      {prototypeMode && <label><span>Note</span><textarea onChange={(event) => update("detail", event.target.value)} placeholder="Short context or blocker" value={draft.detail} /></label>}
      {error && <div className="callout callout--error" role="alert">{error}</div>}
      {!prototypeMode && <p className="form-help">The package can be created before it appears in the client’s expected-compliance setup. The approved requirement is the governed source; assignments are inherited from client setup, and RAG/next action are derived.</p>}
      <div className="team-editor__footer"><button className="button button--quiet" onClick={onClose} type="button">Cancel</button><button className="button button--primary" disabled={!canSubmit} type="submit">Add work</button></div>
    </form>
  </DetailDrawer>;
}

export default function MyWorkPage({ initialDate, initialDue, initialQueue, initialView }: MyWorkPageProps) {
  const { getEffectiveWork, getWorkItems, isWorkVisible, prototypeMode, viewer, workPerspective } = useWorkflow();
  const [addWorkOpen, setAddWorkOpen] = useState(false);
  const queueDue: DuePreset = initialDue !== "all" ? initialDue : initialQueue === "today" ? "today" : initialQueue === "waiting" ? "blocked" : initialQueue === "attention" ? "attention" : "all";
  // Live: My run is the signed-in person's own assigned returns, in any control role.
  const personalWork = useMemo(() => getWorkItems().map(getEffectiveWork).filter((work) => prototypeMode ? isWorkVisible(work) : Object.values(work.assignedUsers ?? {}).some((user) => user?.id === viewer?.userId)), [getEffectiveWork, getWorkItems, isWorkVisible, prototypeMode, viewer]);
  return (
    <FixturePageFrame>
      <PageHeader action={<button className="button button--primary button--small" onClick={() => setAddWorkOpen(true)} type="button">Add work</button>} title="Work" />
      <>
        <nav aria-label="Work views" className="tower-tabs module-tabs my-work-tabs">
          {myWorkViews.map((view) => <Link aria-current={initialView === view.id ? "page" : undefined} className={initialView === view.id ? "tower-tab tower-tab--active" : "tower-tab"} href={`/app/work?view=${view.id}`} key={view.id}>{view.label}</Link>)}
        </nav>
        {initialView === "calendar" ? <section aria-labelledby="work-calendar-title" className="my-work-page"><div className="my-work-page__subheader"><div><p className="eyebrow">Targets and milestones</p><h2 id="work-calendar-title">Calendar</h2><p>Due dates remain linked to the same return package used by the Work queue.</p></div><Link className="text-link" href="/app/work?view=queue">Open work queue</Link></div><DueRegisterWorkspace initialDate={initialDate} initialDue={queueDue} scope="all" /></section> : initialView === "run" ? <MyRunView perspective={prototypeMode ? workPerspective : "SELF"} work={personalWork} /> : <WorkRegisterView initialDue={queueDue} initialQueue={initialQueue} scope="all" />}
      </>
      {addWorkOpen && <AddWorkDrawer onClose={() => setAddWorkOpen(false)} />}
    </FixturePageFrame>
  );
}
