"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Antoine } from "@/components/Antoine";
import { useGame } from "@/components/GameProvider";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { xpByClass } from "@/lib/game/engine";
import { players } from "@/lib/sample-data";

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

/** Season-end podium reveal: drumroll, then 3rd, 2nd, 1st, then where you finished. */
export function Finale() {
  const { state, motion, sound, hydrated } = useGame();
  const standings = useMemo(() => players
    .map((p) => { const e = xpByClass(state, p.initials); return { ...p, xp: p.f + p.s + p.e + p.st + e.f + e.s + e.e }; })
    .sort((a, b) => b.xp - a.xp || b.clean - a.clean), [state]);
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (!hydrated) return;
    if (!motion.animate) { setRevealed(4); return; } // eslint-disable-line react-hooks/set-state-in-effect
    sound.play("drum");
    const timers = [900, 1900, 3000, 3900].map((ms, i) => window.setTimeout(() => {
      setRevealed(i + 1);
      if (i === 2) sound.play("fanfare");
    }, ms));
    return () => timers.forEach(window.clearTimeout);
    // Run the reveal once per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const top = standings.slice(0, 3);
  const meIndex = standings.findIndex((p) => p.me);
  const slots = [
    { place: 2, entry: top[1], height: 110, order: 1, shown: revealed >= 2, bg: "var(--card)" },
    { place: 1, entry: top[0], height: 150, order: 2, shown: revealed >= 3, bg: "var(--honey)" },
    { place: 3, entry: top[2], height: 84, order: 3, shown: revealed >= 1, bg: "#e2c387" },
  ];

  return (
    <main className="app app--night finale">
      <div className="allclear__rays spin" aria-hidden />
      <div className="page" style={{ position: "relative", alignItems: "center", textAlign: "center" }}>
        <span className="eyebrow eyebrow--honey" style={{ letterSpacing: ".22em", marginTop: 12 }}>Nov cycle · season finale (sample)</span>
        <h1 className="display-xl" style={{ color: "var(--paper)" }}>The podium</h1>
        <p className="small" style={{ color: "var(--sand)", margin: 0 }}>Settled XP from verified work. Demerits stay private.</p>

        <section className="finale__podium" aria-label="Final top three" aria-live="polite">
          {slots.map((slot) => (
            <div key={slot.place} className="finale__slot" style={{ order: slot.order }}>
              <div className={slot.shown ? "finale__who finale__who--in" : "finale__who"}>
                {slot.entry?.me ? <PlayerAvatar size={58} label="You" /> : <span className="circle" style={{ width: 58, height: 58, background: "var(--card)", color: "var(--ink)", fontSize: 16 }}>{slot.entry?.initials}</span>}
                <b>{slot.shown ? slot.entry?.name.split(" ")[0] : "???"}</b>
                <span className="small" style={{ color: "var(--sand)" }}>{slot.shown ? `${fmt(slot.entry?.xp ?? 0)} XP` : "…"}</span>
              </div>
              <div className={slot.shown ? "finale__block finale__block--up" : "finale__block"} style={{ height: slot.height, background: slot.bg }}>{slot.place}</div>
            </div>
          ))}
        </section>

        {revealed >= 4 && (
          <section className="card card--pad finale__you" style={{ color: "var(--ink)" }} aria-label="Your finish">
            <PlayerAvatar size={64} mood="proud" label="You" />
            <div style={{ textAlign: "left" }}>
              <span className="eyebrow">Your finish</span>
              <div className="display-l">#{meIndex + 1} of {standings.length}</div>
              <span className="small">{meIndex < 3 ? "Podium! Ang galing mo." : meIndex === 3 ? "One spot off the podium. Next cycle 'yan!" : `${fmt(standings[meIndex - 1]!.xp - standings[meIndex]!.xp)} XP from #${meIndex}. Laban!`}</span>
            </div>
          </section>
        )}
        {revealed >= 4 && <Antoine mood="cheer" size={90} animated={motion.animate} />}
        <Link href="/colony" className="btn btn--honey btn--block" style={{ maxWidth: 360 }}>Back to the Colony</Link>
      </div>
    </main>
  );
}
