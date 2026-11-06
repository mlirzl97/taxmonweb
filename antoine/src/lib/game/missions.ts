/**
 * Daily Forage missions (08 §4.10, 10 §3 #8): each working day five are
 * offered, the player picks three. Progress is counted only from verified
 * awards earned that day, so a mission can never be completed by clicking.
 */
import type { Award, AwardCode, GameState, PersonId } from "./engine";

export type Mission = { id: string; title: string; hint: string; target: number; codes: AwardCode[]; distinctTasks?: boolean };

export const MISSIONS: Mission[] = [
  { id: "accept", title: "Land an acceptance", hint: "Record a filing that shows accepted.", target: 1, codes: ["FILED_ACCEPTED"] },
  { id: "anay", title: "Hit Anay", hint: "Get a filing accepted that went in by D-1.", target: 1, codes: ["ANAY_HIT"] },
  { id: "check", title: "Check on time", hint: "Approve a check before D-2.", target: 1, codes: ["CHECK_ON_TIME"] },
  { id: "pay", title: "Confirm a payment", hint: "Record a payment with its confirmation.", target: 1, codes: ["PAID_CONFIRMED"] },
  { id: "blocker", title: "Clear a blocker early", hint: "Resolve a blocker you raised early.", target: 1, codes: ["BLOCKER_RAISED_EARLY"] },
  { id: "first", title: "Clean first pass", hint: "Have your prepared work pass check and review first time.", target: 1, codes: ["FIRST_PASS"] },
  { id: "double", title: "Double forage", hint: "Earn XP on two different tasks.", target: 2, codes: ["FILED_ACCEPTED", "CHECK_ON_TIME", "REVIEW_ON_TIME", "PAID_CONFIRMED", "FIRST_PASS", "BLOCKER_RAISED_EARLY"], distinctTasks: true },
];

export const MISSION_XP = 10;
export const ALL_THREE_BONUS = 20;

/** The same five missions for everyone on a given day. */
export function offeredOn(date: string): Mission[] {
  let seed = 0;
  for (const ch of date) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const pool = [...MISSIONS];
  const picked: Mission[] = [];
  while (picked.length < 5 && pool.length) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    picked.push(pool.splice(seed % pool.length, 1)[0]!);
  }
  return picked;
}

export function progressOf(mission: Mission, awards: Award[], person: PersonId, date: string): number {
  const today = awards.filter((a) => a.person === person && a.on === date && a.xp > 0 && mission.codes.includes(a.code));
  return Math.min(mission.target, mission.distinctTasks ? new Set(today.map((a) => a.taskId)).size : today.length);
}

export function missionsFor(state: GameState) {
  const day = state.missions?.date === state.today ? state.missions : undefined;
  return {
    offered: offeredOn(state.today),
    picked: day?.picked ?? [],
    claimed: day?.claimed ?? [],
  };
}
