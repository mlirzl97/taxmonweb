"use client";

import Link from "next/link";

import { useGame } from "@/components/GameProvider";
import { shortDate } from "@/lib/game/calendar";
import { firstName } from "@/lib/game/present";

import { Anay } from "@/components/Anay";
import { BackIcon } from "@/components/StatusIcon";
import { cycle } from "@/lib/sample-data";

const steps = [
  { mark: "1", bg: "var(--ant-red)", fg: "#fff", text: <><b>Filed and accepted by D-1</b> (one working day early) = 1 hit, +20 XP to each person on it.</> },
  { mark: "2", bg: "var(--card)", fg: "var(--ink)", text: <><b>On time but after D-1</b> = no damage. Still counts as filed.</> },
  { mark: "3", bg: "var(--soil)", fg: "var(--honey)", text: <><b>Late</b> = Anay heals +1.</> },
  { mark: "★", bg: "var(--honey)", fg: "var(--ink)", text: <><b>0 HP by the last D-1 = All Clear.</b> +50 XP for everyone in the colony.</> },
];

const baselineHitters: Record<string, number> = { MR: 7, TG: 5, BS: 4 };

export function AnayRaid() {
  const { state, anay: live } = useGame();
  const anay = { ...cycle.anay, hp: live.hp, maxHp: live.maxHp, hits: live.hits, heals: live.heals };
  const hitsBy: Record<string, number> = { ...baselineHitters };
  const hitTasks = new Map<string, { on: string; people: string[] }>();
  for (const a of state.awards.filter((x) => x.code === "ANAY_HIT")) {
    const entry = hitTasks.get(a.taskId) ?? { on: a.on, people: [] };
    entry.people.push(a.person);
    hitTasks.set(a.taskId, entry);
  }
  for (const entry of hitTasks.values()) {
    const preparer = entry.people[0]!;
    hitsBy[preparer] = (hitsBy[preparer] ?? 0) + 1;
  }
  const hitters = Object.entries(hitsBy).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const healTasks = new Set(state.awards.filter((a) => a.code === "MISSED_STATUTORY").map((a) => a.taskId));
  const liveLog = [
    ...Array.from(hitTasks.entries()).map(([taskId, entry]) => ({ kind: "HIT" as const, who: firstName(entry.people[0]!), what: `${state.tasks.find((t) => t.id === taskId)?.client ?? ""} (sample)`, when: shortDate(entry.on) })),
    ...Array.from(healTasks).map(() => ({ kind: "HEAL" as const, who: undefined, what: "Anay healed · a filing went late", when: shortDate(state.today) })),
  ].reverse();
  return (
    <main className="app app--dark">
      <div className="page">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/colony" className="back"><BackIcon />Colony</Link>
          <span className="eyebrow eyebrow--honey">Boss raid · {cycle.label}</span>
        </div>

        <section aria-label="Anay" style={{ position: "relative", height: 250, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <svg aria-hidden viewBox="0 0 358 250" preserveAspectRatio="xMidYMax meet" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
            <path d="M24 250 L24 150 C24 60 334 60 334 150 L334 250 Z" fill="#1d1d1b" />
            <path d="M44 250 L44 154 C44 84 314 84 314 154 L314 250 Z" fill="#140d08" />
            <path d="M24 150 C24 60 334 60 334 150" fill="none" stroke="#5a4332" strokeWidth={3} strokeDasharray="2 9" strokeLinecap="round" />
            <ellipse cx={179} cy={238} rx={120} ry={10} fill="#3b2a1e" />
          </svg>
          <div className="bob" style={{ position: "relative", marginBottom: 6 }}><Anay mood={anay.hp === 0 ? "defeated" : "angry"} size={232} /></div>
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: -6 }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
            <div>
              <h1 className="display-xl" style={{ letterSpacing: ".01em" }}>Anay</h1>
              <span style={{ fontSize: 13, color: "var(--sand)" }}>Eats foundations. Feeds on late filings.</span>
            </div>
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <span style={{ fontFamily: "var(--display)", fontSize: 28, fontWeight: 800, lineHeight: 1, color: "#ff6b6f" }}>{anay.hp}</span>
              <span className="small" style={{ fontWeight: 700, color: "var(--sand)" }}>of {anay.maxHp} HP</span>
            </span>
          </div>
          <div className="hp-cells" role="meter" aria-label={`Anay health, ${anay.hp} of ${anay.maxHp}`} aria-valuemin={0} aria-valuemax={anay.maxHp} aria-valuenow={anay.hp} style={{ gridTemplateColumns: `repeat(${anay.maxHp}, minmax(0, 1fr))` }}>
            {Array.from({ length: anay.maxHp }, (_, i) => <span key={i} className={i < anay.hp ? "on" : undefined} />)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            <Stat value={String(anay.hits)} label="Hits by D-1" color="var(--honey)" />
            <Stat value={`+${anay.heals}`} label="Heals (late)" color="#ff6b6f" />
            <Stat value={String(anay.workingDaysLeft)} label="Working days left" color="var(--paper)" />
          </div>
        </section>

        <section className="card card--pad" style={{ color: "var(--ink)", boxShadow: "4px 4px 0 #000", display: "flex", flexDirection: "column", gap: 10 }}>
          <h2 className="display-m" style={{ fontSize: 20 }}>How to hit Anay</h2>
          <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 9, fontSize: 13, lineHeight: 1.4 }}>
            {steps.map((step) => (
              <li key={step.mark} style={{ display: "flex", gap: 10 }}>
                <span className="circle" style={{ width: 24, height: 24, fontSize: 12, background: step.bg, color: step.fg }}>{step.mark}</span>
                <span>{step.text}</span>
              </li>
            ))}
          </ol>
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h2 className="display-m" style={{ fontSize: 20 }}>Top hitters</h2>
          <div style={{ background: "var(--ink)", border: "2px solid var(--soil-line)", borderRadius: 6, overflow: "hidden" }}>
            {hitters.map(([id, hits], i) => (
              <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderTop: i ? "1px solid var(--soil)" : undefined, background: id === "BS" ? "var(--soil)" : undefined }}>
                <span style={{ fontFamily: "var(--display)", fontWeight: 800, width: 18, color: "var(--honey)" }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{firstName(id)}{id === "BS" && <span className="you-tag" style={{ marginLeft: 6 }}>YOU</span>}</span>
                <span style={{ fontSize: 13, fontWeight: 800 }}>{hits} hits</span>
              </div>
            ))}
          </div>
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h2 className="display-m" style={{ fontSize: 20 }}>Battle log</h2>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
            {liveLog.map((row, i) => <LogRow key={`live-${i}`} {...row} />)}
            <LogRow kind="HIT" who="Bea" what="Tilapia Foods (sample)" when="Thu" />
            <LogRow kind="HIT" who="Mika" what="Tala Studios (sample)" when="Thu" />
            <LogRow kind="HEAL" what="Anay healed · a filing went late" when="Wed" />
          </ul>
        </section>
      </div>
    </main>
  );
}

function Stat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div style={{ background: "var(--ink)", border: "2px solid var(--soil-line)", borderRadius: 6, padding: 10, display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontFamily: "var(--display)", fontSize: 24, fontWeight: 800, color }}>{value}</span>
      <span className="small" style={{ fontWeight: 600, color: "var(--sand)" }}>{label}</span>
    </div>
  );
}

/** Late filings never name who was late. */
function LogRow({ kind, who, what, when }: { kind: "HIT" | "HEAL"; who?: string; what: string; when: string }) {
  return (
    <li style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <span style={{ flex: "none", fontSize: 11, fontWeight: 800, padding: "2px 6px", borderRadius: 3, background: kind === "HIT" ? "var(--honey)" : "var(--danger)", color: kind === "HIT" ? "var(--ink)" : "#fff" }}>{kind}</span>
      <span style={{ flex: 1 }}>{who && <b>{who} · </b>}{what}</span>
      <span style={{ color: "var(--sand)" }}>{when}</span>
    </li>
  );
}
