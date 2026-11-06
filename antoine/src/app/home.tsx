"use client";

import Link from "next/link";

import { Anay } from "@/components/Anay";
import { AnthillScene } from "@/components/AnthillScene";
import { useGame } from "@/components/GameProvider";
import { StatusIcon } from "@/components/StatusIcon";
import { shortDate } from "@/lib/game/calendar";
import { d1 } from "@/lib/game/engine";
import { dueLine, potentialXp, ringsFor, taskTone } from "@/lib/game/present";
import { baselines, people, ME } from "@/lib/game/world";

function Ring({ r, color, done, total }: { r: number; color: string; done: number; total: number }) {
  const c = 2 * Math.PI * r;
  return (
    <>
      <circle cx={52} cy={52} r={r} stroke={color} strokeOpacity={0.18} strokeWidth={11} />
      <circle className="ring-arc" cx={52} cy={52} r={r} stroke={color} strokeWidth={11} strokeDasharray={`${(c * Math.min(done, total)) / total} ${c}`} />
    </>
  );
}

export function Home() {
  const { state, me, anay, myTurn } = useGame();
  const rings = ringsFor(state, baselines.rings);
  const upcomingD1 = state.tasks.filter((t) => t.stage !== "complete" && d1(t) >= state.today).map(d1).sort()[0];
  const first = people[ME]!.first;
  const greeting = "Magandang umaga"; // the sample clock always starts the working day

  return (
    <main className="app">
      <header className="home-head">
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="eyebrow">{shortDate(state.today)} · sample clock</span>
          <h1 className="display-l">{greeting}, {first}</h1>
          <span className="sync">Synced · sample</span>
        </div>
        <Link href="/me" className="avatar" aria-label={`Your profile: ${people[ME]!.name}, ${me.rank.name}, rank ${me.rank.tier}`}>
          BS<span className="shield" aria-hidden>{me.rank.tier}</span>
        </Link>
      </header>

      <AnthillScene needCount={myTurn.length} chambers={{ done: ["SEP", "OCT"], digging: "NOV", progress: `${rings.filed[0]}/${rings.filed[1]}` }} late={anay.heals} />

      <div className="page" style={{ paddingTop: 4 }}>
        <Link href="/anay" className="boss">
          <Anay mood={anay.hp === 0 ? "defeated" : "smug"} size={78} />
          <div className="boss__body">
            <span className="eyebrow eyebrow--honey">Boss · Anay · Nov cycle</span>
            <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span className="display-m">{anay.hp === 0 ? "All Clear!" : `${anay.hp} HP left`}</span>
              <span className="small" style={{ color: "var(--sand)", fontWeight: 700 }}>of {anay.maxHp}</span>
            </span>
            <span className="hp" role="meter" aria-label="Anay health" aria-valuemin={0} aria-valuemax={anay.maxHp} aria-valuenow={anay.hp}>
              <span style={{ width: `${(anay.hp / anay.maxHp) * 100}%` }} />
            </span>
            <span className="small" style={{ color: "var(--sand)", lineHeight: 1.35 }}>Filing by D-1 = a hit.{upcomingD1 && <> Next D-1: <b style={{ color: "var(--paper)" }}>{shortDate(upcomingD1)}</b> (sample)</>}</span>
          </div>
        </Link>

        <section className="card card--shadow card--pad rings" aria-label="Colony cycle rings">
          <svg width={104} height={104} viewBox="0 0 104 104" role="img" aria-label={`Filed on time ${rings.filed[0]} of ${rings.filed[1]}, evidence complete ${rings.evidence[0]} of ${rings.evidence[1]}, QA clean ${rings.qa[0]} of ${rings.qa[1]}`}>
            <g transform="rotate(-90 52 52)" fill="none" strokeLinecap="round">
              <Ring r={44} color="#e31e24" done={rings.filed[0]} total={rings.filed[1]} />
              <Ring r={31} color="#f0b429" done={rings.evidence[0]} total={rings.evidence[1]} />
              <Ring r={18} color="#1f6b45" done={rings.qa[0]} total={rings.qa[1]} />
            </g>
          </svg>
          <div className="rings__legend">
            <span className="display-m" style={{ fontSize: 19 }}>Cycle rings</span>
            <div><span><i className="ring-dot" style={{ color: "#e31e24" }} />Filed on time</span><b>{rings.filed.join("/")}</b></div>
            <div><span><i className="ring-dot" style={{ color: "#f0b429" }} />Evidence done</span><b>{rings.evidence.join("/")}</b></div>
            <div><span><i className="ring-dot" style={{ color: "#1f6b45" }} />QA clean</span><b style={{ color: "var(--leaf)" }}>{rings.qa.join("/")}{rings.qa[0] === rings.qa[1] ? " ✓" : ""}</b></div>
          </div>
        </section>

        <section aria-label="Needs you" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="section-head">
            <h2 className="display-m">Needs you</h2>
            <Link href="/work">All work →</Link>
          </div>
          {myTurn.length === 0 && <p className="card card--pad" style={{ margin: 0, fontSize: 14 }}>Nothing needs you right now. Antoine is taking a nap.</p>}
          {myTurn.slice(0, 3).map((task) => {
            const tone = taskTone(task, state.today);
            const xp = potentialXp(task, state.today);
            return (
              <Link key={task.id} href={`/work?task=${task.id}`} className="card row-link">
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{task.client} <span className="muted" style={{ fontWeight: 500 }}>(sample)</span></span>
                  <span className={`status status--${tone}`}><StatusIcon tone={tone} />{task.title} · {dueLine(task, state.today)}</span>
                </span>
                {xp > 0 ? <span className="chip chip--honey">+{xp} XP</span> : <span className="chip chip--quiet">Your turn</span>}
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}
