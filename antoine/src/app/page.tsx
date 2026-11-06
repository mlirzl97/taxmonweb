import Link from "next/link";

import { Anay } from "@/components/Anay";
import { AnthillScene } from "@/components/AnthillScene";
import { StatusIcon } from "@/components/StatusIcon";
import { cycle, me, needsYou, today } from "@/lib/sample-data";

function Ring({ r, color, done, total }: { r: number; color: string; done: number; total: number }) {
  const c = 2 * Math.PI * r;
  return (
    <>
      <circle cx={52} cy={52} r={r} stroke={color} strokeOpacity={0.18} strokeWidth={11} />
      <circle cx={52} cy={52} r={r} stroke={color} strokeWidth={11} strokeDasharray={`${(c * done) / total} ${c}`} />
    </>
  );
}

export default function AnthillHome() {
  const { anay, rings } = cycle;
  return (
    <main className="app">
      <header className="home-head">
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="eyebrow">{today.label}</span>
          <h1 className="display-l">Magandang umaga, {me.first}</h1>
          <span className="sync">Synced {today.sync}</span>
        </div>
        <Link href="/me" className="avatar" aria-label={`Your profile: ${me.name}, ${me.rank.name}, rank ${me.rank.tier}`}>
          {me.initials}<span className="shield" aria-hidden>{me.rank.tier}</span>
        </Link>
      </header>

      <AnthillScene needCount={needsYou.length} chambers={cycle.chambers} late={cycle.late} />

      <div className="page" style={{ paddingTop: 4 }}>
        <Link href="/anay" className="boss">
          <Anay mood="smug" size={78} />
          <div className="boss__body">
            <span className="eyebrow eyebrow--honey">Boss · Anay · {cycle.label}</span>
            <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span className="display-m">{anay.hp} HP left</span>
              <span className="small" style={{ color: "var(--sand)", fontWeight: 700 }}>of {anay.maxHp}</span>
            </span>
            <span className="hp" role="meter" aria-label="Anay health" aria-valuemin={0} aria-valuemax={anay.maxHp} aria-valuenow={anay.hp}>
              <span style={{ width: `${(anay.hp / anay.maxHp) * 100}%` }} />
            </span>
            <span className="small" style={{ color: "var(--sand)", lineHeight: 1.35 }}>Filing by D-1 = a hit. Next D-1: <b style={{ color: "var(--paper)" }}>{anay.nextD1}</b> (sample)</span>
          </div>
        </Link>

        <section className="card card--shadow card--pad rings" aria-label="Your cycle rings">
          <svg width={104} height={104} viewBox="0 0 104 104" role="img" aria-label={`Filed on time ${rings.filed[0]} of ${rings.filed[1]}, evidence complete ${rings.evidence[0]} of ${rings.evidence[1]}, QA clean ${rings.qa[0]} of ${rings.qa[1]}`}>
            <g transform="rotate(-90 52 52)" fill="none" strokeLinecap="round">
              <Ring r={44} color="#e31e24" done={rings.filed[0]} total={rings.filed[1]} />
              <Ring r={31} color="#f0b429" done={rings.evidence[0]} total={rings.evidence[1]} />
              <Ring r={18} color="#1f6b45" done={rings.qa[0]} total={rings.qa[1]} />
            </g>
          </svg>
          <div className="rings__legend">
            <span className="display-m" style={{ fontSize: 19 }}>Your cycle rings</span>
            <div><span><i className="ring-dot" style={{ color: "#e31e24" }} />Filed on time</span><b>{rings.filed.join("/")}</b></div>
            <div><span><i className="ring-dot" style={{ color: "#f0b429" }} />Evidence done</span><b>{rings.evidence.join("/")}</b></div>
            <div><span><i className="ring-dot" style={{ color: "#1f6b45" }} />QA clean</span><b style={{ color: "var(--leaf)" }}>{rings.qa.join("/")}{rings.qa[0] === rings.qa[1] ? " ✓" : ""}</b></div>
          </div>
        </section>

        <section aria-label="Needs you" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="section-head">
            <h2 className="display-m">Needs you</h2>
            <Link href="/now">All {needsYou.length} →</Link>
          </div>
          {needsYou.slice(0, 2).map((item) => (
            <Link key={item.id} href="/now" className="card row-link">
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{item.client} <span className="muted" style={{ fontWeight: 500 }}>(sample)</span></span>
                <span className={`status status--${item.tone}`}><StatusIcon tone={item.tone} />{item.title} · {item.status}</span>
              </span>
              {item.reward ? <span className="chip chip--honey">+{item.reward} XP</span> : <span className="chip chip--quiet">Waiting</span>}
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
