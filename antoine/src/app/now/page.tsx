import type { Metadata } from "next";
import Link from "next/link";

import { Antoine } from "@/components/Antoine";
import { AntCoin, BackIcon } from "@/components/StatusIcon";
import { match, needsYou } from "@/lib/sample-data";

export const metadata: Metadata = { title: "Now" };

export default function NowPage() {
  return (
    <main className="app">
      <div className="page">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" className="back"><BackIcon />Anthill</Link>
          <span className="small muted" style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            Match 1 of {needsYou.length}
            <span aria-hidden style={{ display: "flex", gap: 4 }}>
              {needsYou.map((item, index) => <span key={item.id} style={{ width: index === 0 ? 18 : 6, height: 6, borderRadius: 3, background: index === 0 ? "var(--ant-red)" : "rgba(29,29,27,.25)" }} />)}
            </span>
          </span>
        </div>

        <section className="stamp">
          <div className="stamp__inner">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="eyebrow">Your next safe action</span>
              <span className="chip chip--sample">Sample</span>
            </div>
            <h1 className="display-l" style={{ fontSize: 30 }}>{match.client}</h1>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 14 }}>
              <span className="chip">{match.category}</span>
              <span>{match.title}</span>
            </div>
          </div>
        </section>

        <section aria-label="What this match is worth" className="card card--pad" style={{ background: "var(--honey)", display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="eyebrow" style={{ color: "var(--ink)" }}>On the line</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            <Loot value={`+${match.loot.xp}`} label="XP · filed & accepted" />
            <Loot value={`+${match.loot.anay}`} label={`Anay hit by ${match.d1.split(" ").slice(0, 2).join(" ")}`} dark />
            <Loot value={<><AntCoin size={16} />{match.loot.ants}</>} label="Ants to your wallet" />
          </div>
          <span className="small" style={{ fontWeight: 600 }}>Counts only when the acknowledgement shows <b>accepted</b>.</span>
        </section>

        <section aria-label="Stage path" className="card" style={{ padding: "14px 10px 12px" }}>
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: `repeat(${match.chain.length}, minmax(0, 1fr))`, position: "relative" }}>
            <li aria-hidden style={{ position: "absolute", left: "10%", right: "10%", top: 15, height: 3, background: "var(--ink)" }} />
            {match.chain.map((step) => (
              <li key={step.label} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, textAlign: "center" }}>
                <span className="circle" style={{ width: 32, height: 32, fontSize: 11, background: step.current ? "var(--ant-red)" : step.ok ? "var(--leaf)" : "var(--ink)", color: "#fff", boxShadow: step.current ? "0 0 0 4px #f6c9c9" : undefined }}>{step.who}</span>
                <span style={{ fontSize: 12, fontWeight: step.current ? 800 : 700, color: step.current ? "var(--ant-red-text)" : undefined }}>{step.label}</span>
              </li>
            ))}
          </ol>
        </section>

        <dl className="card facts">
          <div><dt>Statutory deadline</dt><dd>{match.deadline} (sample)</dd></div>
          <div><dt>D-1 (working day)</dt><dd>{match.d1}</dd></div>
          <div><dt>Filed</dt><dd>Not yet</dd></div>
          <div><dt>Paid</dt><dd>Not yet · separate step</dd></div>
        </dl>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
          <Antoine mood="calm" size={60} decorative />
          <p className="card" style={{ margin: "0 0 6px", flex: 1, borderRadius: "14px 14px 14px 4px", padding: "10px 12px", fontSize: 13, lineHeight: 1.4, fontWeight: 600 }}>
            File it, then attach the acknowledgement and reference number. That&apos;s what makes it count.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button className="btn btn--primary btn--block" type="button" disabled title="Connects to TaxMonWeb filing evidence in the next build step">Record filing result</button>
          <p className="small muted" style={{ margin: 0, textAlign: "center" }}>Recording results opens in TaxMonWeb once Antoine is connected. Antoine never marks work done by itself.</p>
        </div>
      </div>
    </main>
  );
}

function Loot({ value, label, dark = false }: { value: React.ReactNode; label: string; dark?: boolean }) {
  return (
    <div style={{ background: dark ? "var(--soil)" : "var(--card)", color: dark ? "var(--paper)" : undefined, border: "2px solid var(--ink)", borderRadius: 4, padding: 8, display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--display)", fontSize: 20, fontWeight: 800, lineHeight: 1, color: dark ? "var(--honey)" : undefined }}>{value}</span>
      <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>{label}</span>
    </div>
  );
}
