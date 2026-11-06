import { describe, expect, it } from "vitest";

import { workingDaysBefore } from "./calendar";
import { defaultLook } from "./cosmetics";
import { anayFor, antsFor, apply, availableActions, d1, needsMe, positiveXpFor, xpFor, type GameState, type Result } from "./engine";
import { rankFor } from "./rules";
import { baselines, initialState, ME, seniority } from "./world";

function ok(result: Result): GameState {
  if (!result.ok) throw new Error(`expected ok, got: ${result.error}`);
  return result.state;
}

describe("working days", () => {
  it("skips weekends for D-1", () => {
    expect(workingDaysBefore("2026-11-16", 1)).toBe("2026-11-13"); // Monday deadline → Friday
    expect(d1({ deadline: "2026-11-12" })).toBe("2026-11-11");
  });
});

describe("segregation of duties", () => {
  it("refuses self-check and self-review", () => {
    const state = initialState();
    const own = { ...state.tasks.find((t) => t.id === "tala")!, stage: "checking" as const };
    const s = { ...state, tasks: state.tasks.map((t) => t.id === "tala" ? own : t) };
    const result = apply(s, { type: "check_approve", taskId: "tala", actor: "BS" }, seniority);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/someone else/);
  });

  it("only the stage owner can act", () => {
    const result = apply(initialState(), { type: "review_approve", taskId: "bukid", actor: "BS" }, seniority);
    expect(result.ok).toBe(false);
  });
});

describe("evidence rules", () => {
  it("requires a filing reference, and filing is not acceptance", () => {
    expect(apply(initialState(), { type: "record_filing", taskId: "alon", actor: ME, date: "2026-11-06", ref: " " }, seniority).ok).toBe(false);
    const filed = ok(apply(initialState(), { type: "record_filing", taskId: "alon", actor: ME, date: "2026-11-06", ref: "FIL-1" }, seniority));
    const task = filed.tasks.find((t) => t.id === "alon")!;
    expect(task.stage).toBe("acceptance");
    expect(task.filing?.status).toBe("submitted");
    expect(xpFor(filed, ME)).toBe(0); // Submitted ≠ Accepted: no XP yet
  });

  it("awards filed-accepted and an Anay hit to all three people when filed by D-1", () => {
    let s = ok(apply(initialState(), { type: "record_filing", taskId: "alon", actor: ME, date: "2026-11-06", ref: "FIL-1" }, seniority));
    const result = apply(s, { type: "record_acceptance", taskId: "alon", actor: ME, ackRef: "ACK-1" }, seniority);
    s = ok(result);
    if (!result.ok) return;
    expect(result.awards.map((a) => `${a.code}:${a.person}:${a.xp}`).sort()).toEqual([
      "ANAY_HIT:BS:20", "ANAY_HIT:NB:20", "ANAY_HIT:PD:20", "FILED_ACCEPTED:BS:40", "FILED_ACCEPTED:NB:15", "FILED_ACCEPTED:PD:15",
    ]);
    expect(s.tasks.find((t) => t.id === "alon")!.stage).toBe("payment"); // Filed ≠ Paid
    expect(anayFor(s, baselines.anay).hp).toBe(baselines.anay.maxHp - baselines.anay.hits - 1 + baselines.anay.heals);
  });

  it("requires a payment reference and awards payment confirmation", () => {
    let s = ok(apply(initialState(), { type: "record_filing", taskId: "alon", actor: ME, date: "2026-11-06", ref: "FIL-1" }, seniority));
    s = ok(apply(s, { type: "record_acceptance", taskId: "alon", actor: ME, ackRef: "ACK-1" }, seniority));
    expect(apply(s, { type: "record_payment", taskId: "alon", actor: ME, ref: "" }, seniority).ok).toBe(false);
    s = ok(apply(s, { type: "record_payment", taskId: "alon", actor: ME, ref: "PAY-1" }, seniority));
    expect(s.tasks.find((t) => t.id === "alon")!.stage).toBe("complete");
    expect(s.awards.some((a) => a.code === "PAID_CONFIRMED" && a.person === ME)).toBe(true);
  });

  it("client approval needs evidence and clears the client-approval blocker", () => {
    expect(apply(initialState(), { type: "record_client_approval", taskId: "kalye", actor: ME, date: "2026-11-06", ref: "" }, seniority).ok).toBe(false);
    const s = ok(apply(initialState(), { type: "record_client_approval", taskId: "kalye", actor: ME, date: "2026-11-06", ref: "Client email" }, seniority));
    const task = s.tasks.find((t) => t.id === "kalye")!;
    expect(task.stage).toBe("filing");
    expect(task.blockers.every((b) => b.resolvedOn)).toBe(true);
  });
});

describe("checking and review", () => {
  it("awards on-time check, and first pass to the preparer after review", () => {
    let s = ok(apply(initialState(), { type: "check_approve", taskId: "sampaguita", actor: ME }, seniority));
    expect(s.awards.find((a) => a.code === "CHECK_ON_TIME")?.person).toBe(ME);
    s = ok(apply(s, { type: "review_approve", taskId: "sampaguita", actor: "NB" }, seniority));
    expect(s.awards.find((a) => a.code === "FIRST_PASS")?.person).toBe("JR");
  });

  it("a return sends work back with a reason and removes first-pass", () => {
    expect(apply(initialState(), { type: "check_return", taskId: "sampaguita", actor: ME, note: "" }, seniority).ok).toBe(false);
    let s = ok(apply(initialState(), { type: "check_return", taskId: "sampaguita", actor: ME, note: "Totals don't tie" }, seniority));
    expect(s.tasks.find((t) => t.id === "sampaguita")!.stage).toBe("preparation");
    s = ok(apply(s, { type: "submit_prep", taskId: "sampaguita", actor: "JR" }, seniority));
    s = ok(apply(s, { type: "check_approve", taskId: "sampaguita", actor: ME }, seniority));
    s = ok(apply(s, { type: "review_approve", taskId: "sampaguita", actor: "NB" }, seniority));
    expect(s.awards.some((a) => a.code === "FIRST_PASS")).toBe(false);
  });
});

describe("idempotency", () => {
  it("never double-awards the same achievement", () => {
    let s = ok(apply(initialState(), { type: "check_approve", taskId: "sampaguita", actor: ME }, seniority));
    const before = s.awards.length;
    // Forcing the task back into checking and approving again must not award again.
    s = { ...s, tasks: s.tasks.map((t) => t.id === "sampaguita" ? { ...t, stage: "checking" as const } : t) };
    s = ok(apply(s, { type: "check_approve", taskId: "sampaguita", actor: ME }, seniority));
    expect(s.awards.filter((a) => a.code === "CHECK_ON_TIME").length).toBe(1);
    expect(s.awards.length).toBe(before);
  });
});

describe("misses and waivers", () => {
  function advanceTo(state: GameState, date: string) {
    let s = state;
    while (s.today < date) s = ok(apply(s, { type: "advance_day" }, seniority));
    return s;
  }

  it("waives a D-1 miss when an external blocker was logged before it", () => {
    const s = advanceTo(initialState(), "2026-11-10"); // kalye D-1 is Mon 9 Nov
    const misses = s.awards.filter((a) => a.taskId === "kalye" && a.code === "MISSED_D1");
    expect(misses.length).toBeGreaterThan(0);
    expect(misses.every((a) => a.xp === 0 && a.waivedBy)).toBe(true);
  });

  it("chain of command: most senior toucher takes the full demerit, others the share", () => {
    const state = initialState();
    const unblocked = { ...state, tasks: state.tasks.map((t) => t.id === "kalye" ? { ...t, blockers: [] } : t) };
    const s = advanceTo(unblocked, "2026-11-10");
    const misses = s.awards.filter((a) => a.taskId === "kalye" && a.code === "MISSED_D1");
    expect(misses.find((a) => a.person === "NB")?.xp).toBe(-10);
    expect(misses.find((a) => a.person === "BS")?.xp).toBe(-5);
    expect(misses.find((a) => a.person === "JR")?.xp).toBe(-5);
  });

  it("a statutory miss heals Anay", () => {
    const s = advanceTo(initialState(), "2026-11-11");
    expect(s.awards.some((a) => a.code === "MISSED_STATUTORY")).toBe(true);
    expect(anayFor(s, baselines.anay).heals).toBeGreaterThan(baselines.anay.heals);
  });

  it("nobody is demerited for work they never touched", () => {
    const s = advanceTo(initialState(), "2026-11-11");
    // Bea is checker on Daan but never acted on it; Mika (preparer, current owner) carries it.
    expect(s.awards.some((a) => a.taskId === "daan" && a.person === ME)).toBe(false);
    expect(s.awards.some((a) => a.taskId === "daan" && a.person === "MR")).toBe(true);
  });
});

describe("blockers", () => {
  it("rewards raising a blocker early once it is resolved", () => {
    let s = ok(apply(initialState(), { type: "raise_blocker", taskId: "tala", actor: ME, kind: "client_data", note: "Waiting for Q3 ledger" }, seniority));
    expect(availableActions(s.tasks.find((t) => t.id === "tala")!, ME)).not.toContain("submit_prep");
    s = ok(apply(s, { type: "resolve_blocker", taskId: "tala", actor: ME }, seniority));
    expect(s.awards.some((a) => a.code === "BLOCKER_RAISED_EARLY" && a.person === ME)).toBe(true);
  });
});

describe("economy and ranks", () => {
  it("mints Ants from XP, burns on purchase, and refuses overspending", () => {
    let s = ok(apply(initialState(), { type: "check_approve", taskId: "sampaguita", actor: ME }, seniority));
    expect(antsFor(s, ME, 100).available).toBe(115);
    expect(apply(s, { type: "buy", actor: ME, itemId: "frame", price: 800, kind: "digital", balance: 115 }, seniority).ok).toBe(false);
    s = ok(apply(s, { type: "buy", actor: ME, itemId: "freeze", price: 100, kind: "real", balance: 115 }, seniority));
    expect(antsFor(s, ME, 100)).toEqual({ available: 15, held: 100 });
  });

  it("ranks come from lifetime positive XP and never drop on demerits", () => {
    expect(rankFor(4700).name).toBe("Tunneler");
    expect(rankFor(8000).name).toBe("Soldier Ant");
    const state = initialState();
    const unblocked = { ...state, tasks: state.tasks.map((t) => t.id === "kalye" ? { ...t, blockers: [] } : t) };
    let s = unblocked;
    while (s.today < "2026-11-11") s = ok(apply(s, { type: "advance_day" }, seniority));
    expect(xpFor(s, ME)).toBeLessThan(0);
    expect(positiveXpFor(s, ME)).toBe(0);
  });

  it("lists only work where it is my turn", () => {
    const mine = needsMe(initialState(), ME).map((t) => t.id).sort();
    expect(mine).toEqual(["alon", "kalye", "mabini", "sampaguita", "tala"]);
  });
});

describe("wardrobe", () => {
  it("cosmetics are bought once; consumables can be bought again", () => {
    let s = ok(apply(initialState(), { type: "buy", actor: ME, itemId: "shades", price: 500, kind: "digital", balance: 5000 }, seniority));
    expect(apply(s, { type: "buy", actor: ME, itemId: "shades", price: 500, kind: "digital", balance: 5000 }, seniority).ok).toBe(false);
    s = ok(apply(s, { type: "buy", actor: ME, itemId: "freeze", price: 300, kind: "digital", balance: 5000 }, seniority));
    s = ok(apply(s, { type: "buy", actor: ME, itemId: "freeze", price: 300, kind: "digital", balance: 5000 }, seniority));
    expect(s.purchases.filter((p) => p.itemId === "freeze")).toHaveLength(2);
  });

  it("free parts can be worn; locked parts can't until bought", () => {
    const s = initialState();
    expect(apply(s, { type: "equip", actor: ME, look: { ...defaultLook, hat: "cap", eyes: "glasses", body: "ink" } }, seniority).ok).toBe(true);
    const locked = apply(s, { type: "equip", actor: ME, look: { ...defaultLook, eyes: "shades" } }, seniority);
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.error).toMatch(/locked/);
    const owned = ok(apply(s, { type: "buy", actor: ME, itemId: "shades", price: 500, kind: "digital", balance: 5000 }, seniority));
    expect(ok(apply(owned, { type: "equip", actor: ME, look: { ...defaultLook, eyes: "shades" } }, seniority)).look?.eyes).toBe("shades");
  });

  it("refuses parts that don't exist", () => {
    expect(apply(initialState(), { type: "equip", actor: ME, look: { ...defaultLook, hat: "crown" } }, seniority).ok).toBe(false);
  });
});

describe("forage missions", () => {
  it("pick exactly three of today's five, once", async () => {
    const { offeredOn } = await import("./missions");
    const offered = offeredOn("2026-11-06").map((m) => m.id);
    expect(offered).toHaveLength(5);
    expect(apply(initialState(), { type: "pick_missions", actor: ME, ids: offered.slice(0, 2) }, seniority).ok).toBe(false);
    expect(apply(initialState(), { type: "pick_missions", actor: ME, ids: ["nope", ...offered.slice(0, 2)] }, seniority).ok).toBe(false);
    const s = ok(apply(initialState(), { type: "pick_missions", actor: ME, ids: offered.slice(0, 3) }, seniority));
    expect(apply(s, { type: "pick_missions", actor: ME, ids: offered.slice(2, 5) }, seniority).ok).toBe(false);
  });

  it("missions complete only from verified work, and pay once", () => {
    const base = initialState();
    let s = ok(apply({ ...base, missions: { date: base.today, picked: ["check", "accept", "anay"], claimed: [] } }, { type: "advance_day" }, seniority));
    s = { ...s, today: base.today, missions: { date: base.today, picked: ["check", "accept", "anay"], claimed: [] } };
    expect(apply(s, { type: "claim_mission", actor: ME, id: "check" }, seniority).ok).toBe(false);
    s = ok(apply(s, { type: "check_approve", taskId: "sampaguita", actor: ME }, seniority));
    s = ok(apply(s, { type: "claim_mission", actor: ME, id: "check" }, seniority));
    expect(apply(s, { type: "claim_mission", actor: ME, id: "check" }, seniority).ok).toBe(false);
    s = ok(apply(s, { type: "record_filing", taskId: "alon", actor: ME, date: base.today, ref: "F" }, seniority));
    s = ok(apply(s, { type: "record_acceptance", taskId: "alon", actor: ME, ackRef: "A" }, seniority));
    s = ok(apply(s, { type: "claim_mission", actor: ME, id: "accept" }, seniority));
    const last = apply(s, { type: "claim_mission", actor: ME, id: "anay" }, seniority);
    expect(last.ok).toBe(true);
    if (last.ok) expect(last.awards.map((a) => a.code).sort()).toEqual(["MISSION", "MISSIONS_ALL"]);
  });
});

describe("All Clear", () => {
  it("colony hits bring Anay to zero and All Clear pays everyone once", () => {
    let s = initialState();
    for (let i = 0; i < 4; i += 1) s = ok(apply(s, { type: "colony_rush", hits: 5 }, seniority));
    expect(anayFor(s, baselines.anay).hp).toBe(0);
    s = ok(apply(s, { type: "all_clear", people: ["BS", "JR"] }, seniority));
    expect(s.awards.filter((a) => a.code === "ANAY_DEFEATED")).toHaveLength(2);
    s = ok(apply(s, { type: "all_clear", people: ["BS", "JR"] }, seniority));
    expect(s.awards.filter((a) => a.code === "ANAY_DEFEATED")).toHaveLength(2);
  });
});
