"use client";

import Link from "next/link";

import { derivePersonalControlPulse } from "@/lib/domain/team";
import { fixtureWork } from "@/lib/fixtures";
import { scopeLabelForValue } from "@/components/app/workspace-components";
import { workflowPerspectiveLabel, type WorkflowPerspective } from "@/lib/workflow-state";

export function MyRunView({ perspective, work }: { perspective: WorkflowPerspective; work: readonly (typeof fixtureWork)[number][] }) {
  const roleScoped = perspective === "PREPARER" || perspective === "CHECKER" || perspective === "REVIEWER";
  if (!roleScoped) {
    return <section aria-labelledby="my-run-title" className="my-run-empty"><p className="eyebrow">Private work view</p><h2 id="my-run-title">Choose a staff persona to open My run</h2><p>My run is private to the selected Preparer, Checker, or Reviewer. Management and Tax Team views stay in the Work queue and their own control surfaces.</p></section>;
  }

  const pulse = derivePersonalControlPulse(work);
  return <section aria-labelledby="my-run-title" className="my-run-page">
    <div className="my-run-page__header"><div><p className="eyebrow">Private assigned work</p><h2 id="my-run-title">My run</h2><p>{workflowPerspectiveLabel(perspective)} work only. This is a progress view, not a second source of truth.</p></div><span className={`my-run-page__state my-run-page__state--${pulse.attentionWork ? "focus" : "clear"}`}>{pulse.totalWork === 0 ? "No assigned work" : pulse.attentionWork ? `${pulse.attentionWork} to close` : "All clear"}</span></div>
    <div className="my-run-page__signals"><div><span>Assigned returns</span><strong>{pulse.totalWork}</strong><small>Visible in your access scope</small></div><div><span>Clear</span><strong>{pulse.clearWork}</strong><small>{pulse.clearPercent}% clear</small></div><div><span>Needs attention</span><strong>{pulse.attentionWork}</strong><small>Open status or blocker</small></div><div><span>Blocked</span><strong>{pulse.blockedWork}</strong><small>Waiting on a dependency</small></div></div>
    {pulse.nextWork ? <div className="my-run-page__next"><div><p className="eyebrow">Next move</p><h3>{pulse.nextWork.nextAction}</h3><p>{pulse.nextWork.client} · {pulse.nextWork.title}</p></div><Link className="button button--primary button--small" href={`/app/work/${pulse.nextWork.id}`}>Open return</Link></div> : <div className="my-run-page__clear">All assigned work is clear.</div>}
    <section aria-labelledby="my-run-list-title" className="panel panel--table my-run-page__list"><div className="section-heading"><div><h3 id="my-run-list-title">Assigned returns</h3><p>Open a return to continue its process checklist and role gate.</p></div><Link className="button button--quiet button--small" href="/app/work?view=queue">Open work queue</Link></div>{work.length === 0 ? <div className="inline-empty">No work is assigned to this persona.</div> : <div className="my-run-list">{work.map((item) => <Link className="my-run-list__row" href={`/app/work/${item.id}`} key={item.id}><span><strong>{item.client}</strong><small>{item.title} · {item.period}</small></span><span><b>{item.nextAction}</b><small>{item.status} · {scopeLabelForValue(item.scope)}</small></span></Link>)}</div>}</section>
  </section>;
}
