"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AntCoin, BackIcon } from "@/components/StatusIcon";
import { me, pendingOrder, storeItems, storeManager, storeName, type StoreItem } from "@/lib/sample-data";

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const GOAL = 10_000;

/** Sample-only: purchases live in this page's memory and vanish on reload. */
export function Store() {
  const [filter, setFilter] = useState<"all" | "digital" | "real">("all");
  const [orders, setOrders] = useState<StoreItem[]>([]);
  const [selected, setSelected] = useState<StoreItem | null>(null);
  const [bought, setBought] = useState(false);

  const spent = orders.reduce((sum, item) => sum + item.price, 0);
  const balance = me.ants - spent;
  const held = me.antsOnHold + orders.filter((item) => item.kind === "real").reduce((sum, item) => sum + item.price, 0);
  const pendingCount = 1 + orders.filter((item) => item.kind === "real").length;
  const items = storeItems.filter((item) => filter === "all" || item.kind === filter);

  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const short = selected ? selected.price - balance : 0;
  return (
    <main className="app">
      <div className="page">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/colony" className="back"><BackIcon />Colony</Link>
          <span className="small muted" style={{ fontWeight: 700 }}>History · coming soon</span>
        </div>

        <section className="wallet" aria-label="Your Ant wallet">
          <CoinStack />
          <span className="eyebrow" style={{ position: "relative", color: "var(--ink)" }}>Ants available</span>
          <div style={{ position: "relative", fontFamily: "var(--display)", fontSize: 52, fontWeight: 900, lineHeight: 1, marginTop: 4 }}>{fmt(balance)}</div>
          <div style={{ position: "relative", fontSize: 13, fontWeight: 700, marginTop: 6 }}>{fmt(held)} on hold · {pendingCount} pending {pendingCount === 1 ? "order" : "orders"}</div>
          <div style={{ position: "relative", marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700 }}><span>Next real reward · Gift certificate ₱100</span><span>{balance >= GOAL ? "Ready!" : `${fmt(GOAL - balance)} to go`}</span></div>
            <div className="progress" role="meter" aria-label="Progress to next real reward" aria-valuemin={0} aria-valuemax={GOAL} aria-valuenow={Math.max(0, balance)}><span style={{ width: `${Math.min(100, Math.max(0, (balance / GOAL) * 100))}%` }} /></div>
          </div>
        </section>

        <section className="card card--pad" style={{ borderStyle: "dashed", display: "flex", gap: 12, alignItems: "center" }}>
          <span className="circle" style={{ width: 40, height: 40, background: "var(--soil)", color: "var(--honey)", borderColor: "var(--soil)" }}>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden><circle cx={12} cy={12} r={9} /><path d="M12 7v5l3 2" /></svg>
          </span>
          <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 800 }}>{pendingOrder}</span>
            <span className="small muted">Pending handover by {storeManager} · Ants on hold until then</span>
          </span>
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <h1 className="display-l" style={{ fontSize: 26 }}>{storeName}</h1>
            <span style={{ fontSize: 13 }} className="muted">Run by {storeManager} · real items are handed over in person</span>
          </div>
          <div style={{ display: "flex", gap: 6 }} role="group" aria-label="Filter">
            {([["all", "All"], ["digital", "Instant"], ["real", "Real items"]] as const).map(([key, label]) => (
              <button key={key} className="pill" type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>
            ))}
          </div>
          <div className="grid-2">
            {items.map((item) => (
              <button key={item.id} className="item" type="button" onClick={() => { setSelected(item); setBought(false); }}>
                <span className="item__art" style={{ background: item.tint }}>
                  <ItemArt id={item.id} />
                  <span className="item__kind" style={{ background: item.kind === "digital" ? "var(--card)" : "var(--ink)", color: item.kind === "digital" ? "var(--ink)" : "var(--honey)" }}>{item.kind === "digital" ? "Instant" : "Real item"}</span>
                </span>
                <span className="item__body">
                  <span style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.2 }}>{item.label}</span>
                  <span className="coin"><AntCoin />{fmt(item.price)}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="small muted" style={{ margin: 0, lineHeight: 1.45 }}>Items marked [placeholder] wait for the Culture and Values Committee to approve the catalog. Ants can&apos;t be sent to other players.</p>
        </section>
      </div>

      {selected && (
        <div className="sheet-backdrop">
          <button className="dismiss" type="button" aria-label="Close" onClick={() => setSelected(null)} />
          <section className="sheet" role="dialog" aria-modal="true" aria-label={selected.label}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="eyebrow">{selected.kind === "digital" ? "Instant · delivered by the app" : `Real item · handed over by ${storeManager}`}</span>
                <span className="display-m" style={{ fontSize: 24 }}>{selected.label}</span>
              </div>
              <button className="btn" type="button" aria-label="Close" style={{ width: 44, minHeight: 44, padding: 0 }} onClick={() => setSelected(null)} autoFocus>✕</button>
            </div>
            <dl className="card facts">
              <div><dt>Price</dt><dd>{fmt(selected.price)} Ants</dd></div>
              <div><dt>Available now</dt><dd>{fmt(balance + (bought ? selected.price : 0))}</dd></div>
              <div><dt>After buying</dt><dd style={{ color: short > 0 && !bought ? "var(--danger)" : undefined }}>{bought ? fmt(balance) : short > 0 ? `${fmt(short)} short` : fmt(balance - selected.price)}</dd></div>
            </dl>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45 }}>{selected.kind === "digital" ? "It lands in your inventory straight away. Ants go back to the colony treasury." : `Your Ants move to the store and stay on hold until ${storeManager} hands you the item. You can cancel any time before then for a full refund.`}</p>
            {bought
              ? <div className="notice" role="status">✓ {selected.kind === "digital" ? "Added to your inventory. Equip it from Me." : `Order placed. ${storeManager} will hand it over; your Ants are on hold until then.`}</div>
              : <button className="btn btn--primary btn--block" type="button" disabled={short > 0} onClick={() => { setOrders((current) => [...current, selected]); setBought(true); }}>{short > 0 ? "Not enough Ants yet" : `Buy for ${fmt(selected.price)} Ants`}</button>}
          </section>
        </div>
      )}
    </main>
  );
}

function CoinStack() {
  return (
    <svg aria-hidden width={150} height={120} viewBox="0 0 150 120" style={{ position: "absolute", right: -10, top: -6 }}>
      <g stroke="#1d1d1b" strokeWidth={2.2}>
        <ellipse cx={96} cy={96} rx={34} ry={11} fill="#d99a12" /><rect x={62} y={84} width={68} height={12} fill="#d99a12" stroke="none" /><path d="M62 84 L62 96 M130 84 L130 96" /><ellipse cx={96} cy={84} rx={34} ry={11} fill="#f7d27a" />
        <ellipse cx={96} cy={72} rx={34} ry={11} fill="#d99a12" /><rect x={62} y={60} width={68} height={12} fill="#d99a12" stroke="none" /><path d="M62 60 L62 72 M130 60 L130 72" /><ellipse cx={96} cy={60} rx={34} ry={11} fill="#f7d27a" />
        <circle cx={104} cy={36} r={22} fill="#f7d27a" />
      </g>
      <g fill="#1d1d1b"><ellipse cx={96} cy={36} rx={4} ry={3.4} /><circle cx={103} cy={36} r={2.6} /><circle cx={110} cy={36} r={3.4} /></g>
      <path d="M93 33 L89 28 M93 39 L89 44 M103 33 L103 28 M103 39 L103 44 M107 33 L111 28 M107 39 L111 44 M112 34 L116 31" stroke="#1d1d1b" strokeWidth={1.4} strokeLinecap="round" />
    </svg>
  );
}

function ItemArt({ id }: { id: StoreItem["id"] }) {
  const common = { fill: "none", stroke: "#1d1d1b", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (id) {
    case "freeze":
      return <svg width={58} height={58} viewBox="0 0 58 58" {...common}><path d="M12 18 L29 9 L46 18 L46 40 L29 49 L12 40 Z" fill="#dff1f7" /><path d="M12 18 L29 27 L46 18 M29 27 L29 49" /><path d="M29 31 V45 M23 34 L35 42 M35 34 L23 42" stroke="#2f638d" /></svg>;
    case "frame":
      return <svg width={60} height={60} viewBox="0 0 60 60" {...common}><rect x={8} y={8} width={44} height={44} rx={3} fill="#f0b429" /><rect x={16} y={16} width={28} height={28} rx={2} fill="#fffaf0" /><circle cx={30} cy={27} r={5} fill="#1d1d1b" /><path d="M21 42 C22 35 38 35 39 42" fill="#1d1d1b" /><path d="M8 8 L16 16 M52 8 L44 16 M8 52 L16 44 M52 52 L44 44" /></svg>;
    case "barong":
      return <svg width={62} height={60} viewBox="0 0 62 60" {...common}><path d="M22 8 L31 13 L40 8 L54 16 L48 28 L44 26 L44 54 L18 54 L18 26 L14 28 L8 16 Z" fill="#fbf3dc" /><path d="M22 8 L31 20 L40 8" /><path d="M31 20 V54" strokeDasharray="1 4" /><path d="M24 30 C27 34 27 38 24 42 M38 30 C35 34 35 38 38 42" stroke="#8a5a00" strokeWidth={1.6} /></svg>;
    case "title":
      return <svg width={70} height={50} viewBox="0 0 70 50" {...common}><path d="M4 16 L14 16 L14 34 L4 34 L9 25 Z" fill="#b8191e" /><path d="M66 16 L56 16 L56 34 L66 34 L61 25 Z" fill="#b8191e" /><rect x={12} y={11} width={46} height={22} fill="#e31e24" /><path d="M20 22 H50" stroke="#fffaf0" strokeWidth={3} /></svg>;
    case "gc":
      return <svg width={74} height={48} viewBox="0 0 74 48" {...common}><path d="M4 8 H70 V18 A6 6 0 0 0 70 30 V40 H4 V30 A6 6 0 0 0 4 18 Z" fill="#fffaf0" /><path d="M50 8 V40" strokeDasharray="3 3" /><text x={27} y={31} textAnchor="middle" fontFamily="var(--display)" fontSize={18} fontWeight={800} fill="#1d1d1b" stroke="none">₱100</text></svg>;
    default:
      return <svg width={60} height={58} viewBox="0 0 60 58" {...common}><rect x={8} y={22} width={44} height={30} fill="#fffaf0" /><rect x={5} y={14} width={50} height={10} fill="#f0b429" /><path d="M30 14 V52 M30 14 C22 4 14 8 20 14 M30 14 C38 4 46 8 40 14" /><text x={42} y={44} textAnchor="middle" fontFamily="var(--display)" fontSize={14} fontWeight={800} fill="#1d1d1b" stroke="none">?</text></svg>;
  }
}
