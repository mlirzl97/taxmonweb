"use client";

import { useEffect, useState } from "react";

import { Antoine } from "@/components/Antoine";
import { useGame } from "@/components/GameProvider";
import { shortDate } from "@/lib/game/calendar";
import { availableActions, d1, openBlocker, ownerOf, type Action, type BlockerKind, type PersonId, type Task } from "@/lib/game/engine";
import { dueLine, firstName, personName, potentialXp, stageLabel } from "@/lib/game/present";
import { BLOCKER_LABELS } from "@/lib/game/rules";
import { ME } from "@/lib/game/world";

const order = ["preparation", "checking", "review", "client_approval", "filing", "acceptance", "payment", "complete"] as const;

export function TaskSheet({ task, onClose }: { task: Task; onClose: () => void }) {
  const { state, dispatch } = useGame();
  const [error, setError] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [note, setNote] = useState("");
  const [ref, setRef] = useState("");
  const [date, setDate] = useState(state.today);
  const [kind, setKind] = useState<BlockerKind>("client_data");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mine = availableActions(task, ME);
  const owner = ownerOf(task);
  const blocker = openBlocker(task);
  const xp = potentialXp(task, state.today);
  const stageIndex = order.indexOf(task.stage);

  function run(action: Action) {
    const result = dispatch(action);
    if (!result.ok) { setError(result.error); return false; }
    setError(null); setNote(""); setRef(""); setReturning(false); setBlocking(false); setDate(state.today);
    return true;
  }

  function actAsTeammate(person: PersonId) {
    const sampleRef = `SAMPLE-${task.id.toUpperCase()}-${state.today.replaceAll("-", "")}`;
    const step: Action | null =
      task.stage === "preparation" ? { type: "submit_prep", taskId: task.id, actor: person }
      : task.stage === "checking" ? { type: "check_approve", taskId: task.id, actor: person }
      : task.stage === "review" ? { type: "review_approve", taskId: task.id, actor: person }
      : task.stage === "client_approval" ? { type: "record_client_approval", taskId: task.id, actor: person, date: state.today, ref: sampleRef }
      : task.stage === "filing" ? { type: "record_filing", taskId: task.id, actor: person, date: state.today, ref: sampleRef }
      : task.stage === "acceptance" ? { type: "record_acceptance", taskId: task.id, actor: person, ackRef: sampleRef }
      : task.stage === "payment" ? { type: "record_payment", taskId: task.id, actor: person, ref: sampleRef }
      : null;
    if (step) run(step);
  }

  const chain: Array<{ role: string; person: PersonId; done: boolean; current: boolean }> = [
    { role: "Prepare", person: task.preparer, done: stageIndex > 0, current: task.stage === "preparation" },
    { role: "Check", person: task.checker, done: stageIndex > 1, current: task.stage === "checking" },
    { role: "Review", person: task.reviewer, done: stageIndex > 2, current: task.stage === "review" },
  ];

  return (
    <div className="sheet-backdrop">
      <button className="dismiss" type="button" aria-label="Close" onClick={onClose} />
      <section className="sheet" role="dialog" aria-modal="true" aria-label={`${task.client} ${task.title}`}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <span className="chip chip--sample" style={{ alignSelf: "flex-start" }}>Sample · not tax content</span>
            <span className="display-m" style={{ fontSize: 24 }}>{task.client}</span>
            <span style={{ fontSize: 14 }}><span className="chip" style={{ marginRight: 6 }}>{task.category}</span>{task.title} · {task.period}</span>
          </div>
          <button className="btn" type="button" aria-label="Close" style={{ width: 44, minHeight: 44, padding: 0 }} onClick={onClose}>✕</button>
        </div>

        <div className="card card--pad" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontWeight: 800, fontSize: 15 }}>{stageLabel[task.stage]}{owner ? ` · ${owner.person === ME ? "your turn" : `with ${firstName(owner.person)}`}` : ""}</span>
          <span className="small muted">{dueLine(task, state.today)} (sample dates)</span>
        </div>

        {blocker && (
          <div className="blocker" role="note">
            <b>Blocked · {BLOCKER_LABELS[blocker.kind]}</b>
            <span>{blocker.note}</span>
            <span className="small muted">Logged {shortDate(blocker.loggedOn)} by {firstName(blocker.loggedBy)}{blocker.kind !== "internal" ? " · an external blocker logged before a miss waives the demerit" : ""}</span>
          </div>
        )}

        <ol className="card" style={{ listStyle: "none", margin: 0, padding: "12px 10px", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", textAlign: "center" }}>
          {chain.map((link) => (
            <li key={link.role} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span className="circle" style={{ width: 34, height: 34, fontSize: 11, background: link.done ? "var(--ink)" : link.current ? "var(--ant-red)" : "var(--card)", color: link.done || link.current ? "#fff" : "var(--ink)" }}>{link.done ? "✓" : link.person === ME ? "You" : link.person}</span>
              <span style={{ fontSize: 12, fontWeight: link.current ? 800 : 600 }}>{link.role}</span>
              <span className="small muted">{link.person === ME ? "You" : firstName(link.person)}</span>
            </li>
          ))}
        </ol>

        <dl className="card facts">
          <div><dt>Deadline</dt><dd>{shortDate(task.deadline)} (sample)</dd></div>
          <div><dt>D-1 (working day)</dt><dd>{shortDate(d1(task))}</dd></div>
          <div><dt>Client approval</dt><dd>{task.clientApproval ? `${shortDate(task.clientApproval.date)} · ${task.clientApproval.ref}` : "Not yet"}</dd></div>
          <div><dt>Filed</dt><dd>{task.filing ? `${shortDate(task.filing.date)} · ${task.filing.ref}` : "Not yet"}</dd></div>
          <div><dt>Accepted</dt><dd>{task.filing?.status === "accepted" ? `Yes · ${task.filing.ackRef}` : task.filing ? "Waiting" : "—"}</dd></div>
          <div><dt>Paid</dt><dd>{!task.requiresPayment ? "Not required" : task.payment ? `Yes · ${task.payment.ref}` : "Not yet · separate step"}</dd></div>
        </dl>

        {mine.some((a) => a !== "raise_blocker" && a !== "resolve_blocker") && xp > 0 && (
          <div className="card card--pad" style={{ background: "var(--honey)", display: "flex", alignItems: "center", gap: 10 }}>
            <Antoine mood="cheer" size={42} decorative />
            <span style={{ fontSize: 14, fontWeight: 700 }}>This step is worth <b>+{xp} XP</b> to you{task.stage === "filing" || task.stage === "acceptance" ? " once it shows accepted" : ""}.</span>
          </div>
        )}

        {error && <div className="form-error" role="alert">{error}</div>}

        {mine.includes("submit_prep") && <button className="btn btn--primary btn--block" type="button" onClick={() => run({ type: "submit_prep", taskId: task.id, actor: ME })}>Prepared · send for checking</button>}

        {(mine.includes("check_approve") || mine.includes("review_approve")) && !returning && (
          <div className="btn-row">
            <button className="btn" type="button" onClick={() => setReturning(true)}>Return</button>
            <button className="btn btn--primary" type="button" onClick={() => run({ type: task.stage === "checking" ? "check_approve" : "review_approve", taskId: task.id, actor: ME })}>{task.stage === "checking" ? "Approve check" : "Approve review"}</button>
          </div>
        )}
        {returning && (
          <form className="form" onSubmit={(e) => { e.preventDefault(); run({ type: task.stage === "checking" ? "check_return" : "review_return", taskId: task.id, actor: ME, note }); }}>
            <label className="field">What needs fixing?<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Be specific so it's quick to fix" autoFocus /></label>
            <div className="btn-row"><button className="btn" type="button" onClick={() => setReturning(false)}>Cancel</button><button className="btn btn--primary" type="submit">Send back</button></div>
          </form>
        )}

        {mine.includes("record_client_approval") && (
          <form className="form" onSubmit={(e) => { e.preventDefault(); run({ type: "record_client_approval", taskId: task.id, actor: ME, date, ref }); }}>
            <label className="field">Approval date<input type="date" value={date} max={state.today} onChange={(e) => setDate(e.target.value)} /></label>
            <label className="field">Approval evidence<input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. client email subject or signed file name" /></label>
            <small className="small muted">Return approval only. Payment approval is separate.</small>
            <button className="btn btn--primary btn--block" type="submit">Record client approval</button>
          </form>
        )}

        {mine.includes("record_filing") && (
          <form className="form" onSubmit={(e) => { e.preventDefault(); run({ type: "record_filing", taskId: task.id, actor: ME, date, ref }); }}>
            <label className="field">Filing date<input type="date" value={date} max={state.today} onChange={(e) => setDate(e.target.value)} /></label>
            <label className="field">Filing reference no.<input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Reference from the filing confirmation" /></label>
            <small className="small muted">Filed isn&apos;t accepted yet. You&apos;ll record the acceptance next.</small>
            <button className="btn btn--primary btn--block" type="submit">Record filing</button>
          </form>
        )}

        {mine.includes("record_acceptance") && (
          <form className="form" onSubmit={(e) => { e.preventDefault(); run({ type: "record_acceptance", taskId: task.id, actor: ME, ackRef: ref }); }}>
            <label className="field">Acknowledgement reference<input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Reference showing it was accepted" autoFocus /></label>
            <button className="btn btn--primary btn--block" type="submit">Record acceptance</button>
          </form>
        )}

        {mine.includes("record_payment") && (
          <form className="form" onSubmit={(e) => { e.preventDefault(); run({ type: "record_payment", taskId: task.id, actor: ME, ref }); }}>
            <label className="field">Payment confirmation reference<input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Proof of payment reference" autoFocus /></label>
            <small className="small muted">Payment initiated isn&apos;t payment confirmed. Record it once you have the confirmation.</small>
            <button className="btn btn--primary btn--block" type="submit">Record payment</button>
          </form>
        )}

        {mine.includes("resolve_blocker") && <button className="btn btn--block" type="button" onClick={() => run({ type: "resolve_blocker", taskId: task.id, actor: ME })}>Mark blocker resolved</button>}

        {mine.includes("raise_blocker") && (blocking ? (
          <form className="form" onSubmit={(e) => { e.preventDefault(); run({ type: "raise_blocker", taskId: task.id, actor: ME, kind, note }); }}>
            <label className="field">What kind?<select value={kind} onChange={(e) => setKind(e.target.value as BlockerKind)}>{Object.entries(BLOCKER_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label className="field">What&apos;s blocking it?<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Short and specific" /></label>
            <div className="btn-row"><button className="btn" type="button" onClick={() => setBlocking(false)}>Cancel</button><button className="btn btn--primary" type="submit">Raise blocker</button></div>
          </form>
        ) : (
          <button className="btn btn--block" type="button" onClick={() => setBlocking(true)}>Raise a blocker <span className="small muted" style={{ fontWeight: 600 }}>· early = +10 XP</span></button>
        ))}

        {owner && owner.person !== ME && task.stage !== "complete" && (
          <div className="sample-act">
            <span className="eyebrow">Sample controls</span>
            <span className="small">In real use {personName(owner.person)} does this step in their own app. Here you can play their turn to keep the sample moving.</span>
            <button className="btn" type="button" disabled={Boolean(blocker) && (task.stage === "preparation" || task.stage === "filing")} onClick={() => actAsTeammate(owner.person)}>Act as {firstName(owner.person)}: {stageLabel[task.stage].toLowerCase()}</button>
          </div>
        )}

        {task.history.length > 0 && (
          <section>
            <h3 className="display-m" style={{ fontSize: 17, marginBottom: 6 }}>History (who did what)</h3>
            <ul className="history card" style={{ padding: "4px 12px" }}>
              {[...task.history].reverse().map((entry, i) => (
                <li key={`${entry.on}-${i}`}>
                  <span className="circle" style={{ width: 28, height: 28, fontSize: 10 }}>{entry.actor}</span>
                  <span style={{ flex: 1, fontWeight: 600 }}>{entry.what}</span>
                  <span className="muted">{shortDate(entry.on)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </section>
    </div>
  );
}
