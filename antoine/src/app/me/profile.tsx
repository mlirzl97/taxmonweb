"use client";

import Link from "next/link";
import { useState } from "react";

import { Antoine } from "@/components/Antoine";
import { CountUp } from "@/components/CountUp";
import { useGame } from "@/components/GameProvider";
import { PlayerAvatar } from "@/components/PlayerAvatar";

import { Inventory, MotionSetting, SoundSetting, Wardrobe } from "./wardrobe";
import { shortDate } from "@/lib/game/calendar";
import { baselines, ME, people } from "@/lib/game/world";

const me = { name: people[ME]!.name, classes: "Forager · Sentinel", title: "Blocker Buster", streak: baselines.streak, freezes: baselines.freezes, cleanRate: baselines.cleanRate };

const heat = [0,1,2,1,3, 2,2,0,1,2, 3,2,3,1,0, 1,2,2,3,3, 0,1,0,2,1, 2,3,3,2,2, 1,0,2,3,1, 3,3,2,1,2, 2,2,3,0,1, 1,3,2,0,0];
const heatFill = ["var(--paper)", "var(--honey-soft)", "var(--honey)", "var(--honey-text)"];

const badges = [
  { label: "First Hit", got: true, icon: "M5 19l6-6M14 4l6 6-8 8-6-6zM4 20l2-2" },
  { label: "Perfect Cycle", got: true, icon: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" },
  { label: "Blocker Buster", got: true, icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM5.6 5.6l12.8 12.8" },
  { label: "All Clear", got: true, icon: "M4 12l5 5L20 6" },
  { label: "Streak ×4", got: true, icon: "M4 18c3-1 4-4 4-7 2 1 3 3 3 5 1-2 3-4 3-7 3 2 5 5 5 9" },
  { label: "Cycle MVP", got: false, icon: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" },
  { label: "Sentinel Eye", got: false, icon: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" },
  { label: "Streak ×8", got: false, icon: "M4 18c3-1 4-4 4-7 2 1 3 3 3 5 1-2 3-4 3-7 3 2 5 5 5 9" },
];

export function Profile() {
  const [sassy, setSassy] = useState(false);
  const game = useGame();
  const { state } = game;
  const rank = { ...game.me.rank, lifetimeXp: game.me.lifetimeXp };
  const toNext = Math.max(0, rank.ceiling - rank.lifetimeXp);
  const pct = rank.ceiling > rank.floor ? ((rank.lifetimeXp - rank.floor) / (rank.ceiling - rank.floor)) * 100 : 100;
  const myHits = 4 + new Set(state.awards.filter((a) => a.code === "ANAY_HIT" && a.person === ME).map((a) => a.taskId)).size;
  const misses = state.awards.filter((a) => a.person === ME && (a.code === "MISSED_D1" || a.code === "MISSED_STATUTORY"));
  const freezesOwned = me.freezes + state.purchases.filter((p) => p.itemId === "freeze").length;
  return (
    <main className="app">
      <header style={{ background: "var(--ink)", color: "var(--paper)", padding: "22px 18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <PlayerAvatar size={84} mood="proud" href="#wardrobe" label="Your ant. Change your look" />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
            <h1 className="display-l">{me.name}</h1>
            <span style={{ fontSize: 13, color: "var(--sand)" }}>{me.classes} <span style={{ opacity: 0.7 }}>· sample persona</span></span>
            <span className="chip chip--honey" style={{ alignSelf: "flex-start", border: 0 }}>Title · {game.owned.has("title") ? "Deadline Slayer" : me.title}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center", background: "var(--ink-2)", borderRadius: 8, padding: "12px 14px" }}>
          <span className="shield" aria-hidden style={{ flex: "none", width: 46, height: 52, background: "var(--honey)", color: "var(--ink)", fontFamily: "var(--display)", fontSize: 24, fontWeight: 900 }}>{rank.tier}</span>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span className="display-m" style={{ fontSize: 19 }}>{rank.name}</span>
              <span className="small" style={{ fontWeight: 700, color: "var(--sand)" }}>{rank.lifetimeXp.toLocaleString("en-US")} / {rank.ceiling.toLocaleString("en-US")} XP</span>
            </div>
            <div role="meter" aria-label={`Progress to ${rank.next}`} aria-valuemin={rank.floor} aria-valuemax={rank.ceiling} aria-valuenow={rank.lifetimeXp} style={{ height: 10, background: "var(--ink)", border: "2px solid var(--paper)", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: "var(--honey)" }} />
            </div>
            <Link href="/rank-up" style={{ fontSize: 12, fontWeight: 700, color: "var(--honey)" }}>{toNext.toLocaleString("en-US")} XP to {rank.next} · preview the moment →</Link>
          </div>
        </div>
      </header>

      <div className="page">
        <div className="grid-2" style={{ gap: 10 }}>
          <Tile label="XP this cycle" value={`${game.me.xpThisCycle >= 0 ? "+" : ""}${game.me.xpThisCycle}`} valueColor={game.me.xpThisCycle < 0 ? "var(--danger)" : undefined} note={`${me.streak}-cycle clean streak · ${freezesOwned} freeze${freezesOwned === 1 ? "" : "s"}`} noteColor="var(--sky)" />
          <Tile href="/store" label="Ants" value={<CountUp value={game.me.ants.available} />} note="Open store →" bg="var(--honey)" />
          <Tile label="Clean rate" value={`${me.cleanRate}%`} valueColor="var(--leaf)" note="on time · evidenced · QA ok" />
          <Tile href="/anay" label="Anay hits" value={String(myHits)} valueColor="var(--honey)" note="See the raid →" bg="var(--soil)" dark />
        </div>

        <Wardrobe />

        <Inventory />

        <section className="card card--pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="section-head"><h2 className="display-m" style={{ fontSize: 19 }}>Work days</h2><span className="small muted">Only you see this</span></div>
          <div style={{ display: "flex", gap: 8 }}>
            <div aria-hidden style={{ display: "grid", gridTemplateRows: "repeat(5, 18px)", gap: 4, fontSize: 11, fontWeight: 700, color: "var(--earth)" }}><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span></div>
            <div role="img" aria-label="Verified work days, last 10 weeks" style={{ flex: 1, display: "grid", gridAutoFlow: "column", gridTemplateRows: "repeat(5, 18px)", gap: 4 }}>
              {heat.map((level, i) => <span key={i} style={{ borderRadius: 3, border: `1.5px solid ${level ? "var(--ink)" : "var(--rule)"}`, background: heatFill[level] }} />)}
            </div>
          </div>
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="section-head"><h2 className="display-m">Badge album</h2><span style={{ fontSize: 13, fontWeight: 700 }}>{badges.filter((b) => b.got).length} of 12</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
            {badges.map((badge) => (
              <div key={badge.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, textAlign: "center" }}>
                <span className="circle" style={{ width: 64, height: 64, borderWidth: 2.5, borderStyle: badge.got ? "solid" : "dashed", background: badge.got ? "var(--honey)" : "var(--paper)", boxShadow: badge.got ? "var(--shadow-sm)" : undefined }}>
                  <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke={badge.got ? "#1d1d1b" : "#8f8676"} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={badge.icon} /></svg>
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.2, color: badge.got ? undefined : "var(--earth)" }}>{badge.label}{badge.got ? "" : " (locked)"}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card card--pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="section-head"><h2 className="display-m" style={{ fontSize: 19 }}>Misses &amp; waivers</h2><span className="small muted">Private</span></div>
          {misses.length === 0 && <p className="small muted" style={{ margin: 0 }}>No misses this cycle. Keep it that way.</p>}
          {misses.map((miss) => (
            <div key={miss.key} style={{ display: "flex", gap: 10, alignItems: "flex-start", borderTop: "1px solid var(--rule)", paddingTop: 10 }}>
              <span style={{ flex: "none", fontSize: 12, fontWeight: 800, color: miss.waivedBy ? "var(--leaf)" : "var(--danger)", border: `2px solid ${miss.waivedBy ? "var(--leaf)" : "var(--danger)"}`, borderRadius: 4, padding: "1px 6px", textDecoration: miss.waivedBy ? "line-through" : undefined }}>{miss.waivedBy ? (miss.code === "MISSED_D1" ? "−10" : "−100") : miss.xp}</span>
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <b style={{ fontSize: 13 }}>{miss.note} · {state.tasks.find((t) => t.id === miss.taskId)?.client} (sample)</b>
                <span className="small" style={{ color: miss.waivedBy ? "var(--leaf)" : "var(--earth)", fontWeight: miss.waivedBy ? 700 : 500 }}>{miss.waivedBy ? `Waived: ${miss.waivedBy}` : "Chain of command: the most senior person on it takes the full demerit"}</span>
              </span>
            </div>
          ))}
        </section>

        <section className="card" style={{ overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 14px" }}>
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}><b style={{ fontSize: 15 }}>Sassy mode</b><span className="small muted">Let Antoine tease you about streaks</span></span>
            <button type="button" role="switch" aria-checked={sassy} aria-label="Sassy mode" onClick={() => setSassy((value) => !value)} style={{ flex: "none", width: 58, height: 34, borderRadius: 999, border: "2px solid var(--ink)", background: sassy ? "var(--ant-red)" : "var(--rule)", padding: 0, cursor: "pointer", position: "relative" }}>
              <span style={{ position: "absolute", top: 3, left: sassy ? 28 : 3, width: 24, height: 24, borderRadius: 999, background: "var(--card)", border: "2px solid var(--ink)", transition: "left 140ms ease" }} />
            </button>
          </div>
          {sassy && (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, padding: "0 14px 14px" }} aria-live="polite">
              <Antoine mood="cheer" size={48} decorative />
              <p style={{ margin: "0 0 4px", background: "var(--paper)", border: "2px solid var(--ink)", borderRadius: "12px 12px 12px 4px", padding: "8px 10px", fontSize: 13, fontWeight: 600, lineHeight: 1.35 }}>Oh, feeling sassy? Fine. {me.streak} clean cycles in a row… it would be a shame to break that now, wouldn&apos;t it?</p>
            </div>
          )}
          <SoundSetting />
          <MotionSetting />
        </section>

        <section className="sample-act" aria-label="Sample controls">
          <span className="eyebrow">Sample controls · {shortDate(state.today)}</span>
          <span className="small">Move the sample clock one working day to see D-1, misses and waivers play out. Real Antoine follows the real calendar.</span>
          <div className="btn-row">
            <button className="btn" type="button" onClick={() => { if (window.confirm("Reset the sample game to the start?")) game.reset(); }}>Reset sample</button>
            <button className="btn btn--honey" type="button" onClick={() => game.dispatch({ type: "advance_day" })}>Next working day →</button>
          </div>
          <button className="btn btn--block" type="button" onClick={() => game.dispatch({ type: "colony_rush", hits: 5 })}>Colony rush · teammates land 5 hits on Anay</button>
          <Link href="/finale" className="btn btn--block">Preview the season finale</Link>
        </section>

        <p className="small muted" style={{ textAlign: "center", margin: 0 }}>Clients, BIR Center and Team open in TaxMonWeb.</p>
      </div>
    </main>
  );
}

function Tile({ label, value, note, href, bg, dark, valueColor, noteColor }: { label: string; value: React.ReactNode; note: string; href?: string; bg?: string; dark?: boolean; valueColor?: string; noteColor?: string }) {
  const body = (
    <>
      <span className="small" style={{ fontWeight: 700, color: dark ? "var(--sand)" : "var(--earth)" }}>{label}</span>
      <span style={{ fontFamily: "var(--display)", fontSize: 28, fontWeight: 800, lineHeight: 1, color: valueColor }}>{value}</span>
      <span className="small" style={{ fontWeight: 700, color: noteColor ?? (dark ? "var(--paper)" : undefined) }}>{note}</span>
    </>
  );
  const style = { background: bg ?? "var(--card)", color: dark ? "var(--paper)" : "var(--ink)", border: "2px solid var(--ink)", borderRadius: 6, padding: 12, display: "flex", flexDirection: "column" as const, gap: 3, textDecoration: "none" };
  return href ? <Link href={href} style={style}>{body}</Link> : <div style={style}>{body}</div>;
}
