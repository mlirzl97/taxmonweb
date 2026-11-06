"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { players, rankFloors, rankTiers, type Player } from "@/lib/sample-data";

type Board = "live" | "cup" | "hall";
type Role = "overall" | "f" | "s" | "e" | "st";

const boards: Array<[Board, string]> = [["live", "Live"], ["cup", "Colony Cup"], ["hall", "Hall"]];
const roles: Array<[Role, string]> = [["overall", "Overall"], ["f", "Forager"], ["s", "Sentinel"], ["e", "Elder"], ["st", "Steward"]];
const roleHint: Record<Role, string> = { overall: "Everyone, all roles combined", f: "Foragers · preparing", s: "Sentinels · checking", e: "Elders · reviewing", st: "Stewards · portfolio owners" };
const windowText: Record<Board, string> = { live: "Nov cycle · live", cup: "Q4 Colony Cup · seasonal", hall: "All-time" };
const avatarTints = ["#fffaf0", "#f0b429", "#e2c387", "#f6c9c9"];

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const total = (p: Player) => p.f + p.s + p.e + p.st;
function tierOf(xp: number) {
  let tier = 0;
  rankFloors.forEach((floor, index) => { if (xp >= floor) tier = index; });
  return tier;
}

export function Leaderboard() {
  const [board, setBoard] = useState<Board>("live");
  const [role, setRole] = useState<Role>("overall");

  const ranked = useMemo(() => players
    .map((player, index) => {
      const base = role === "overall" ? total(player) : player[role];
      const multiplier = board === "live" ? 1 : board === "cup" ? player.cup : player.hall;
      return { player, index, xp: base * multiplier, tier: tierOf(total(player) * player.hall) };
    })
    .filter((entry) => entry.xp > 0)
    .sort((a, b) => b.xp - a.xp || b.player.clean - a.player.clean), [board, role]);

  const podium = ranked.slice(0, 3);
  const rows = ranked.slice(3, 8);
  const myIndex = ranked.findIndex((entry) => entry.player.me);
  const showPin = myIndex === -1 || myIndex >= 8;

  const podiumStyle = [
    { order: 2, height: 118, bg: "#f0b429", avatar: 58 },
    { order: 1, height: 88, bg: "#fffaf0", avatar: 48 },
    { order: 3, height: 66, bg: "#e2c387", avatar: 48 },
  ];

  return (
    <main className="app">
      <header style={{ background: "var(--soil)", color: "var(--paper)", padding: "18px 16px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <span className="eyebrow eyebrow--honey">Colony</span>
            <h1 className="display-l" style={{ fontSize: 30 }}>Leaderboards</h1>
          </div>
          <nav aria-label="Colony sections" style={{ display: "flex", gap: 6 }}>
            <Link href="/anay" className="chip" style={{ borderColor: "var(--paper)", color: "var(--paper)", textDecoration: "none", padding: "6px 10px" }}>Anay</Link>
            <Link href="/store" className="chip chip--honey" style={{ textDecoration: "none", padding: "6px 10px" }}>Store</Link>
          </nav>
        </div>
        <div className="seg" role="group" aria-label="Board">
          {boards.map(([key, label]) => <button key={key} type="button" aria-pressed={board === key} onClick={() => setBoard(key)}>{label}</button>)}
        </div>
      </header>

      <div className="page" style={{ gap: 12, paddingTop: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700 }}>{board === "live" && <span className="live-dot" aria-hidden />}{windowText[board]}</span>
          <span className="small muted" style={{ fontWeight: 600 }}>XP · clean rate</span>
        </div>
        <div className="pill-row" role="group" aria-label="Role">
          {roles.map(([key, label]) => <button key={key} className="pill" type="button" aria-pressed={role === key} onClick={() => setRole(key)}>{label}</button>)}
        </div>
        <span className="small muted" style={{ marginTop: -4 }}>{roleHint[role]}</span>

        <section className="podium" aria-label="Top three">
          {podium.map((entry, place) => {
            const style = podiumStyle[place]!;
            return (
              <div className="podium__slot" key={entry.player.name} style={{ order: style.order }}>
                <div className="podium__avatar" style={{ width: style.avatar, height: style.avatar, background: avatarTints[entry.index % 4] }}>
                  {entry.player.initials}
                  {place === 0 && <svg width={26} height={26} viewBox="0 0 24 24" aria-hidden style={{ position: "absolute", top: -14, left: "50%", marginLeft: -13 }}><path d="M12 2l2.6 6.2 6.7.6-5.1 4.4 1.6 6.6L12 16.3 6.2 19.8l1.6-6.6L2.7 8.8l6.7-.6z" fill="#f0b429" stroke="#1d1d1b" strokeWidth={1.6} strokeLinejoin="round" /></svg>}
                  {entry.player.me && <span className="you-tag" style={{ position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)" }}>YOU</span>}
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, textAlign: "center" }}>{entry.player.name.split(" ")[0]}</span>
                <span className="small muted" style={{ fontWeight: 700 }}>{fmt(entry.xp)} XP</span>
                <div className="podium__block" style={{ height: style.height, background: style.bg }}>{place + 1}</div>
              </div>
            );
          })}
        </section>
        <div className="podium-base" aria-hidden />

        {rows.length > 0 && (
          <ol className="board card" start={4}>
            {rows.map((entry, i) => {
              const move = board === "live" ? entry.player.move : 0;
              const tier = entry.tier;
              return (
                <li key={entry.player.name} className={entry.player.me ? "me" : undefined}>
                  <span className="board__pos">{i + 4}</span>
                  <span className="board__move" style={{ color: move > 0 ? "var(--leaf)" : move < 0 ? "var(--danger)" : "var(--earth)" }} aria-label={move > 0 ? `up ${move}` : move < 0 ? `down ${-move}` : "no change"}>{move > 0 ? `▲${move}` : move < 0 ? `▼${-move}` : "–"}</span>
                  <span className="circle" style={{ width: 36, height: 36, fontSize: 12, background: avatarTints[entry.index % 4] }}>{entry.player.initials}</span>
                  <span className="board__who">
                    <span className="board__name">{entry.player.name}{entry.player.me && <span className="you-tag">YOU</span>}</span>
                    <span className="small muted" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span className="shield" style={{ width: 16, height: 18, fontSize: 10, background: tier < 2 ? "var(--rule)" : tier < 5 ? "var(--honey)" : "var(--soil)", color: tier < 5 ? "var(--ink)" : "var(--honey)" }}>{tier + 1}</span>
                      {rankTiers[tier]}
                    </span>
                  </span>
                  <span className="board__xp"><b style={{ fontSize: 15 }}>{fmt(entry.xp)}</b><span className="small" style={{ color: "var(--leaf)", fontWeight: 700 }}>{entry.player.clean}% clean</span></span>
                </li>
              );
            })}
          </ol>
        )}

        <p className="small muted" style={{ margin: "2px 0 0", textAlign: "center", lineHeight: 1.45 }}>Top 8 shown. Demerits stay private to you and your leaders. There is no bottom list.</p>
        <div style={{ height: 80 }} />
      </div>

      {showPin && (
        <div className="pin">
          <span style={{ fontFamily: "var(--display)", fontSize: 17, fontWeight: 800, minWidth: 30, textAlign: "center" }}>{myIndex === -1 ? "–" : `#${myIndex + 1}`}</span>
          <span className="circle" style={{ width: 34, height: 34, fontSize: 12, background: "var(--honey)", color: "var(--ink)", borderColor: "var(--paper)" }}>BS</span>
          <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ fontSize: 14, fontWeight: 800 }}>You · Bea Santos</span>
            <span className="small" style={{ color: "var(--sand)" }}>{myIndex === -1 ? "Not on this board yet. Act in this role to join." : `${fmt(ranked[myIndex - 1]!.xp - ranked[myIndex]!.xp)} XP to pass ${ranked[myIndex - 1]!.player.name.split(" ")[0]}`}</span>
          </span>
          <span style={{ fontSize: 15, fontWeight: 800, color: "var(--honey)" }}>{myIndex === -1 ? "0" : fmt(ranked[myIndex]!.xp)}</span>
        </div>
      )}
    </main>
  );
}
