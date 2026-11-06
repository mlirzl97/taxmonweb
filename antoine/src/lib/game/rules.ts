/**
 * Starting point values from 08-COLONY-GAME-PROPOSAL.md §4. These are
 * configuration to be calibrated in shadow mode, not final numbers.
 */
export const XP = {
  FIRST_PASS: 30,
  CHECK_ON_TIME: 15,
  REVIEW_ON_TIME: 15,
  FILED_ACCEPTED: { preparer: 40, checker: 15, reviewer: 15 },
  ANAY_HIT: 20,
  PAID_CONFIRMED: 20,
  ANAY_DEFEATED: 50,
  BLOCKER_RAISED_EARLY: 10,
  MISSED_D1: { senior: -10, other: -5 },
  MISSED_STATUTORY: { senior: -100, other: -50 },
} as const;

/** Blockers raised at least this many working days before D-1 earn the early-raise award. */
export const BLOCKER_EARLY_DAYS = 3;

/** Lifetime-XP floors for the colony ranks (08 §4.6). */
export const RANKS = [
  { floor: 0, name: "Larva" },
  { floor: 500, name: "Worker Ant" },
  { floor: 1500, name: "Forager" },
  { floor: 4000, name: "Tunneler" },
  { floor: 8000, name: "Soldier Ant" },
  { floor: 15000, name: "Scout Captain" },
  { floor: 30000, name: "Colony Elder" },
  { floor: 60000, name: "Colony Keeper" },
] as const;

export function rankFor(lifetimeXp: number) {
  let index = 0;
  RANKS.forEach((rank, i) => { if (lifetimeXp >= rank.floor) index = i; });
  const current = RANKS[index]!;
  const next = RANKS[index + 1];
  return { tier: index + 1, name: current.name, floor: current.floor, next: next?.name ?? null, ceiling: next?.floor ?? current.floor };
}

/** External blockers can waive miss demerits (08 §4.3). Internal ones cannot. */
export const EXTERNAL_BLOCKERS = ["client_data", "client_approval", "payment_funding", "bir_system"] as const;
export const BLOCKER_LABELS: Record<string, string> = {
  client_data: "Client data not ready",
  client_approval: "Waiting on client approval",
  payment_funding: "Client payment funding",
  bir_system: "BIR system issue",
  internal: "Internal (team) blocker",
};
