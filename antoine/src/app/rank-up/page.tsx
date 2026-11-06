import type { Metadata } from "next";
import Link from "next/link";

import { Antoine } from "@/components/Antoine";

export const metadata: Metadata = { title: "Rank up" };

const confetti = [
  ["rect", 38, 70, "#f0b429", -25], ["rect", 320, 58, "#e31e24", 30], ["rect", 350, 250, "#f6efe0", 50], ["rect", 24, 270, "#e31e24", -40],
  ["rect", 330, 350, "#1f6b45", -20], ["rect", 160, 34, "#f0b429", 15], ["dot", 270, 98, "#1f6b45", 0], ["dot", 120, 60, "#f6efe0", 0], ["dot", 356, 130, "#f0b429", 0],
] as const;

export default function RankUpPage() {
  return (
    <main className="app app--night" style={{ display: "flex", flexDirection: "column", alignItems: "center", overflow: "hidden", minHeight: "calc(100dvh - 26px)" }}>
      <div aria-hidden className="spin" style={{ position: "absolute", left: "50%", top: 250, width: 760, height: 760, margin: "-380px 0 0 -380px" }}>
        <svg width={760} height={760} viewBox="-380 -380 760 760">
          <g fill="#2b2b28">{Array.from({ length: 12 }, (_, i) => <path key={i} d="M0 0 L-30 -380 L30 -380 Z" transform={`rotate(${i * 30})`} />)}</g>
        </svg>
      </div>
      <svg aria-hidden width={390} height={460} viewBox="0 0 390 460" style={{ position: "absolute", left: "50%", marginLeft: -195, top: 0 }}>
        <g stroke="#1d1d1b" strokeWidth={1.5}>
          {confetti.map(([shape, x, y, fill, rot]) => shape === "rect"
            ? <rect key={`${x}-${y}`} x={x} y={y} width={12} height={7} fill={fill} transform={`rotate(${rot} ${x + 6} ${y + 3})`} />
            : <circle key={`${x}-${y}`} cx={x} cy={y} r={4} fill={fill} />)}
        </g>
      </svg>

      <span className="eyebrow eyebrow--honey" style={{ position: "relative", marginTop: 44, letterSpacing: ".22em" }}>Rank up</span>
      <div className="pop" style={{ position: "relative", marginTop: 18, width: 250, height: 250, display: "grid", placeItems: "center" }}>
        <div aria-hidden className="shield" style={{ position: "absolute", width: 212, height: 240, background: "var(--honey)" }} />
        <div aria-hidden className="shield" style={{ position: "absolute", width: 190, height: 216, background: "var(--soil)" }} />
        <div style={{ position: "relative", marginTop: -12 }}><Antoine mood="cheer" size={150} /></div>
        <span aria-hidden className="circle" style={{ position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)", width: 54, height: 54, background: "var(--ant-red)", borderWidth: 3, boxShadow: "0 0 0 3px var(--honey)", fontFamily: "var(--display)", fontSize: 28, fontWeight: 900, color: "#fff" }}>5</span>
      </div>
      <h1 className="display-xl" style={{ position: "relative", marginTop: 30, textAlign: "center" }}>Soldier Ant<br /><span style={{ color: "var(--honey)" }}>ka na!</span></h1>
      <p style={{ position: "relative", margin: "14px 32px 0", fontSize: 15, lineHeight: 1.5, textAlign: "center", color: "var(--sand)" }}>8,000 lifetime XP. Every point came from a filing that was accepted, evidenced and on time.</p>
      <div style={{ position: "relative", marginTop: 20, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        <span className="chip" style={{ borderColor: "var(--earth)", background: "var(--ink-2)", fontSize: 12 }}>Soldier insignia unlocked</span>
        <span className="chip" style={{ borderColor: "var(--earth)", background: "var(--ink-2)", fontSize: 12 }}>Soldier frame unlocked</span>
      </div>
      <div style={{ position: "relative", width: "calc(100% - 40px)", marginTop: 32, display: "flex", flexDirection: "column", gap: 10 }}>
        <Link href="/" className="btn btn--honey btn--block" style={{ minHeight: 58, fontFamily: "var(--display)", fontSize: 20 }}>Tuloy ang laban</Link>
        <Link href="/colony" className="btn btn--ghost-light btn--block">Share to the Colony feed</Link>
      </div>
      <span className="small" style={{ position: "relative", marginTop: 14, color: "var(--sand)" }}>Preview · sample rank-up</span>
    </main>
  );
}
