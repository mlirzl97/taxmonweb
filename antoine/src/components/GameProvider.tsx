"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { Antoine } from "@/components/Antoine";
import { defaultLook, type Look } from "@/lib/game/cosmetics";
import { anayFor, antsFor, apply, needsMe, ownedItems, positiveXpFor, xpFor, type Action, type Award, type GameState } from "@/lib/game/engine";
import { rankFor } from "@/lib/game/rules";
import { baselines, initialState, ME, seniority } from "@/lib/game/world";

const STORAGE_KEY = "antoine.sample.v1";
const MOTION_KEY = "antoine.motion";
const ONBOARD_KEY = "antoine.onboarded";

export type MotionPref = "system" | "on" | "off";

function subscribeReduced(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function readPref<T extends string>(key: string, fallback: T): T {
  try { return (window.localStorage.getItem(key) as T | null) ?? fallback; } catch { return fallback; }
}

function writePref(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* private mode */ }
}

type Toast = { id: number; text: string; detail?: string; tone: "win" | "info" | "miss" };

type GameContext = {
  state: GameState;
  hydrated: boolean;
  dispatch: (action: Action) => { ok: true; awards: Award[] } | { ok: false; error: string };
  reset: () => void;
  me: {
    xpThisCycle: number;
    lifetimeXp: number;
    rank: ReturnType<typeof rankFor>;
    ants: { available: number; held: number };
  };
  anay: ReturnType<typeof anayFor>;
  myTurn: GameState["tasks"];
  rankUp: string | null;
  clearRankUp: () => void;
  look: Look;
  owned: Set<string>;
  motion: { pref: MotionPref; phoneReduced: boolean; animate: boolean; setPref: (pref: MotionPref) => void };
  onboarded: boolean;
  finishOnboarding: () => void;
};

const Context = createContext<GameContext | null>(null);

const codeLabel: Record<Award["code"], string> = {
  FIRST_PASS: "first pass",
  CHECK_ON_TIME: "check on time",
  REVIEW_ON_TIME: "review on time",
  FILED_ACCEPTED: "filed & accepted",
  ANAY_HIT: "hit on Anay",
  PAID_CONFIRMED: "payment confirmed",
  BLOCKER_RAISED_EARLY: "blocker raised early",
  MISSED_D1: "missed D-1",
  MISSED_STATUTORY: "missed deadline",
};

function load(): GameState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    return parsed?.version === 1 && Array.isArray(parsed.tasks) ? parsed : null;
  } catch {
    return null;
  }
}

function save(state: GameState) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* private mode: play continues in memory */ }
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GameState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [rankUp, setRankUp] = useState<string | null>(null);
  const stateRef = useRef(state);
  const toastId = useRef(0);
  const [motionPref, setMotionPref] = useState<MotionPref>("system");
  const [onboarded, setOnboarded] = useState(true);
  const phoneReduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);
  const animate = motionPref === "on" || (motionPref === "system" && !phoneReduced);

  useEffect(() => {
    document.documentElement.dataset.motion = animate ? "full" : "reduced";
  }, [animate]);

  useEffect(() => {
    const stored = load();
    // Browser-only sample save: read once after mount so server and client markup match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) { setState(stored); stateRef.current = stored; }
    setMotionPref(readPref<MotionPref>(MOTION_KEY, "system"));
    setOnboarded(readPref<string>(ONBOARD_KEY, "") === "yes");
    setHydrated(true);
  }, []);

  const pushToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = ++toastId.current;
    setToasts((current) => [...current.slice(-2), { ...toast, id }]);
    window.setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), toast.tone === "win" ? 3600 : 4200);
  }, []);

  const dispatch = useCallback<GameContext["dispatch"]>((action) => {
    const before = stateRef.current;
    const result = apply(before, action, seniority);
    if (!result.ok) return result;
    stateRef.current = result.state;
    setState(result.state);
    save(result.state);

    const mine = result.awards.filter((a) => a.person === ME);
    const gained = mine.filter((a) => a.xp > 0).reduce((sum, a) => sum + a.xp, 0);
    if (gained > 0) {
      try { navigator.vibrate?.(35); } catch { /* not supported */ }
      const labels = Array.from(new Set(mine.filter((a) => a.xp > 0).map((a) => codeLabel[a.code])));
      pushToast({ tone: "win", text: `+${gained} XP · +${gained} Ants`, detail: labels.join(" · ") });
    }
    for (const miss of mine.filter((a) => a.code === "MISSED_D1" || a.code === "MISSED_STATUTORY")) {
      pushToast({ tone: miss.waivedBy ? "info" : "miss", text: miss.waivedBy ? `${codeLabel[miss.code]} · waived` : `${miss.xp} XP · ${codeLabel[miss.code]}`, detail: miss.waivedBy ?? "See Me for details" });
    }
    if (mine.length === 0 && action.type === "advance_day") pushToast({ tone: "info", text: "New working day", detail: "Sample clock moved forward" });

    const beforeRank = rankFor(baselines.lifetimeXp + positiveXpFor(before, ME));
    const afterRank = rankFor(baselines.lifetimeXp + positiveXpFor(result.state, ME));
    if (afterRank.tier > beforeRank.tier) setRankUp(afterRank.name);
    return { ok: true, awards: result.awards };
  }, [pushToast]);

  const reset = useCallback(() => {
    const fresh = initialState();
    stateRef.current = fresh;
    setState(fresh);
    save(fresh);
    pushToast({ tone: "info", text: "Sample reset", detail: "Back to Fri 6 Nov" });
  }, [pushToast]);

  const value = useMemo<GameContext>(() => {
    const lifetimeXp = baselines.lifetimeXp + positiveXpFor(state, ME);
    return {
      state,
      hydrated,
      dispatch,
      reset,
      me: { xpThisCycle: xpFor(state, ME), lifetimeXp, rank: rankFor(lifetimeXp), ants: antsFor(state, ME, baselines.ants) },
      anay: anayFor(state, baselines.anay),
      myTurn: needsMe(state, ME),
      rankUp,
      clearRankUp: () => setRankUp(null),
      look: state.look ?? defaultLook,
      owned: ownedItems(state),
      motion: { pref: motionPref, phoneReduced, animate, setPref: (pref: MotionPref) => { setMotionPref(pref); writePref(MOTION_KEY, pref); } },
      onboarded,
      finishOnboarding: () => { setOnboarded(true); writePref(ONBOARD_KEY, "yes"); },
    };
  }, [state, hydrated, dispatch, reset, rankUp, motionPref, phoneReduced, animate, onboarded]);

  return (
    <Context.Provider value={value}>
      {children}
      {rankUp && <Link href="/rank-up" className="rankup-banner" onClick={() => setRankUp(null)}>Rank up! {rankUp} ka na <span aria-hidden>→</span></Link>}
      <div className="toasts" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.tone}`} role="status">
            {toast.tone === "win" && <Antoine mood="cheer" size={40} decorative look={state.look ?? defaultLook} />}
            {toast.tone === "win" && animate && <span className="confetti" aria-hidden>{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ ["--i" as string]: i } as React.CSSProperties} />)}</span>}
            <span><strong>{toast.text}</strong>{toast.detail && <small>{toast.detail}</small>}</span>
          </div>
        ))}
      </div>
    </Context.Provider>
  );
}

export function useGame() {
  const value = useContext(Context);
  if (!value) throw new Error("useGame must be used inside GameProvider");
  return value;
}
