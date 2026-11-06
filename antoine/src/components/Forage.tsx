"use client";

import { useState } from "react";

import { useGame } from "@/components/GameProvider";
import { shortDate } from "@/lib/game/calendar";
import { ALL_THREE_BONUS, MISSION_XP, MISSIONS, missionsFor, progressOf } from "@/lib/game/missions";
import { ME } from "@/lib/game/world";

/** Daily Forage: pick 3 of 5, complete them with verified work, claim the XP. */
export function Forage() {
  const { state, dispatch } = useGame();
  const { offered, picked, claimed } = missionsFor(state);
  const [choice, setChoice] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (picked.length === 0) {
    return (
      <section className="card card--shadow card--pad forage" aria-label="Today's forage">
        <div className="section-head">
          <h2 className="display-m">Today&apos;s forage</h2>
          <span className="small muted" style={{ fontWeight: 700 }}>{shortDate(state.today)}</span>
        </div>
        <p className="small" style={{ margin: 0 }}>Pick 3 missions. Each is +{MISSION_XP} XP, all three +{ALL_THREE_BONUS} more. Only verified work counts.</p>
        <div className="forage__offers" role="group" aria-label="Missions to pick">
          {offered.map((mission) => {
            const on = choice.includes(mission.id);
            return (
              <button key={mission.id} type="button" className="forage__offer" aria-pressed={on}
                onClick={() => { setError(null); setChoice(on ? choice.filter((id) => id !== mission.id) : choice.length < 3 ? [...choice, mission.id] : choice); }}>
                <b>{mission.title}</b><span>{mission.hint}</span>
              </button>
            );
          })}
        </div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="btn btn--primary btn--block" type="button" disabled={choice.length !== 3}
          onClick={() => { const r = dispatch({ type: "pick_missions", actor: ME, ids: choice }); if (!r.ok) setError(r.error); }}>
          {choice.length === 3 ? "Start foraging" : `Pick ${3 - choice.length} more`}
        </button>
      </section>
    );
  }

  return (
    <section className="card card--shadow card--pad forage" aria-label="Today's forage">
      <div className="section-head">
        <h2 className="display-m">Today&apos;s forage</h2>
        <span className="small" style={{ fontWeight: 800 }}>{claimed.length}/3{claimed.length === 3 ? " · bonus earned" : ""}</span>
      </div>
      <ul className="forage__list">
        {picked.map((id) => {
          const mission = MISSIONS.find((m) => m.id === id)!;
          const progress = progressOf(mission, state.awards, ME, state.today);
          const done = progress >= mission.target;
          const isClaimed = claimed.includes(id);
          return (
            <li key={id} className={isClaimed ? "forage__item forage__item--claimed" : "forage__item"}>
              <span className="forage__check" aria-hidden>{isClaimed ? "✓" : done ? "!" : ""}</span>
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                <b style={{ fontSize: 14 }}>{mission.title}</b>
                <span className="progress" role="meter" aria-label={`${mission.title} progress`} aria-valuemin={0} aria-valuemax={mission.target} aria-valuenow={progress}><span style={{ width: `${(progress / mission.target) * 100}%` }} /></span>
              </span>
              {isClaimed
                ? <span className="small" style={{ fontWeight: 800, color: "var(--leaf)" }}>+{MISSION_XP}</span>
                : <button className="chip chip--honey" type="button" disabled={!done} style={{ cursor: done ? "pointer" : "not-allowed", opacity: done ? 1 : 0.55 }}
                    onClick={() => dispatch({ type: "claim_mission", actor: ME, id })}>{done ? "Claim" : `${progress}/${mission.target}`}</button>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
