"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { useGame } from "@/components/GameProvider";
import { BackIcon, StatusIcon } from "@/components/StatusIcon";
import { d1, ownerOf } from "@/lib/game/engine";
import { dueLine, firstName, nextStepLabel, potentialXp, stageLabel, taskTone } from "@/lib/game/present";
import { ME } from "@/lib/game/world";

import { TaskSheet } from "./task-sheet";

export function WorkQueue() {
  const { state, myTurn } = useGame();
  const params = useSearchParams();
  const router = useRouter();
  const requested = params.get("task") ?? (params.get("next") ? myTurn.slice().sort((a, b) => d1(a).localeCompare(d1(b)))[0]?.id ?? null : null);
  const open = state.tasks.find((t) => t.id === requested) ?? null;

  const mine = myTurn.slice().sort((a, b) => d1(a).localeCompare(d1(b)));
  const myTurnIds = new Set(mine.map((t) => t.id));
  const waiting = state.tasks.filter((t) => t.stage !== "complete" && !myTurnIds.has(t.id)).sort((a, b) => d1(a).localeCompare(d1(b)));
  const done = state.tasks.filter((t) => t.stage === "complete");

  const openTask = (id: string) => router.push(`/work?task=${id}`, { scroll: false });
  const close = () => router.push("/work", { scroll: false });

  return (
    <main className="app">
      <div className="page">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" className="back"><BackIcon />Anthill</Link>
          <span className="chip chip--sample">Sample work</span>
        </div>
        <div>
          <span className="eyebrow">Work</span>
          <h1 className="display-l">Your matches</h1>
        </div>

        <Group title="Your turn" count={mine.length} empty="Nothing waiting on you. Nice.">
          {mine.map((task) => {
            const xp = potentialXp(task, state.today);
            const tone = taskTone(task, state.today);
            return (
              <button key={task.id} type="button" className="card task-row" onClick={() => openTask(task.id)}>
                <span className="task-row__main">
                  <span className="task-row__title">{task.client} <span className="muted" style={{ fontWeight: 500 }}>(sample)</span></span>
                  <span className="small">{task.title} · <b>{nextStepLabel[task.stage]}</b></span>
                  <span className={`status status--${tone}`}><StatusIcon tone={tone} />{dueLine(task, state.today)}</span>
                </span>
                {xp > 0 ? <span className="chip chip--honey">+{xp} XP</span> : <span className="stage-chip stage-chip--mine">Go</span>}
              </button>
            );
          })}
        </Group>

        <Group title="Waiting on others" count={waiting.length} empty="No one else is holding your work.">
          {waiting.map((task) => {
            const owner = ownerOf(task);
            const tone = taskTone(task, state.today);
            return (
              <button key={task.id} type="button" className="card task-row" onClick={() => openTask(task.id)}>
                <span className="task-row__main">
                  <span className="task-row__title">{task.client} <span className="muted" style={{ fontWeight: 500 }}>(sample)</span></span>
                  <span className="small">{task.title} · with {owner ? (owner.person === ME ? "you" : firstName(owner.person)) : "—"}</span>
                  <span className={`status status--${tone}`}><StatusIcon tone={tone} />{tone === "blocked" ? "Blocked · " : ""}{dueLine(task, state.today)}</span>
                </span>
                <span className="stage-chip">{stageLabel[task.stage]}</span>
              </button>
            );
          })}
        </Group>

        {done.length > 0 && (
          <Group title="Done this cycle" count={done.length} empty="">
            {done.map((task) => (
              <button key={task.id} type="button" className="card task-row" onClick={() => openTask(task.id)}>
                <span className="task-row__main">
                  <span className="task-row__title">{task.client} <span className="muted" style={{ fontWeight: 500 }}>(sample)</span></span>
                  <span className="status status--ok"><StatusIcon tone="ok" />{task.title} · filed, accepted{task.requiresPayment ? ", paid" : ""}</span>
                </span>
                <span className="stage-chip stage-chip--done">Done</span>
              </button>
            ))}
          </Group>
        )}
      </div>

      {open && <TaskSheet task={open} onClose={close} />}
    </main>
  );
}

function Group({ title, count, empty, children }: { title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <section className="queue-group" aria-label={title}>
      <div className="section-head"><h2 className="display-m">{title}</h2><span className="small muted" style={{ fontWeight: 700 }}>{count}</span></div>
      {count === 0 && empty ? <p className="small muted" style={{ margin: 0 }}>{empty}</p> : children}
    </section>
  );
}
