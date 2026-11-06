/**
 * The Antoine game engine (08 §4). Pure functions: given a state and an
 * action, return the next state and the awards it produced, or a refusal.
 *
 * Controls enforced here mirror TaxMonWeb's (L-114): actual-actor segregation
 * of duties, evidence before filing/acceptance/payment counts, Submitted ≠
 * Accepted, Filed ≠ Paid. Awards are idempotent by key, so replaying an action
 * can never double-award.
 */
import { addDays, nextWorkingDay, workingDaysBefore, type IsoDate } from "./calendar";
import { lookErrors, oneTimeItems, type Look } from "./cosmetics";
import { BLOCKER_EARLY_DAYS, EXTERNAL_BLOCKERS, XP } from "./rules";

export type PersonId = string;
export type Role = "preparer" | "checker" | "reviewer";
export type Stage = "preparation" | "checking" | "review" | "client_approval" | "filing" | "acceptance" | "payment" | "complete";
export type BlockerKind = "client_data" | "client_approval" | "payment_funding" | "bir_system" | "internal";

export type Blocker = { kind: BlockerKind; note: string; loggedOn: IsoDate; loggedBy: PersonId; resolvedOn?: IsoDate };
export type HistoryEntry = { on: IsoDate; actor: PersonId; what: string };

export type Task = {
  id: string;
  client: string;
  title: string;
  category: string;
  period: string;
  deadline: IsoDate;
  requiresPayment: boolean;
  preparer: PersonId;
  checker: PersonId;
  reviewer: PersonId;
  stage: Stage;
  returns: number;
  blockers: Blocker[];
  clientApproval?: { date: IsoDate; ref: string };
  filing?: { ref: string; date: IsoDate; status: "submitted" | "accepted"; ackRef?: string };
  payment?: { ref: string; date: IsoDate };
  history: HistoryEntry[];
};

export type AwardCode =
  | "FIRST_PASS" | "CHECK_ON_TIME" | "REVIEW_ON_TIME" | "FILED_ACCEPTED" | "ANAY_HIT"
  | "PAID_CONFIRMED" | "BLOCKER_RAISED_EARLY" | "MISSED_D1" | "MISSED_STATUTORY";

export type Award = {
  key: string;
  person: PersonId;
  code: AwardCode;
  role: Role | "owner";
  xp: number;
  taskId: string;
  on: IsoDate;
  note: string;
  waivedBy?: string;
};

export type Purchase = { id: string; itemId: string; price: number; kind: "digital" | "real"; on: IsoDate; status: "held" | "delivered" };

export type GameState = {
  version: 1;
  today: IsoDate;
  tasks: Task[];
  awards: Award[];
  purchases: Purchase[];
  /** The player's ant. Missing on saves from before the wardrobe existed. */
  look?: Look;
};

export type Action =
  | { type: "submit_prep" | "check_approve" | "review_approve"; taskId: string; actor: PersonId }
  | { type: "check_return" | "review_return"; taskId: string; actor: PersonId; note: string }
  | { type: "record_client_approval"; taskId: string; actor: PersonId; date: IsoDate; ref: string }
  | { type: "record_filing"; taskId: string; actor: PersonId; date: IsoDate; ref: string }
  | { type: "record_acceptance"; taskId: string; actor: PersonId; ackRef: string }
  | { type: "record_payment"; taskId: string; actor: PersonId; ref: string }
  | { type: "raise_blocker"; taskId: string; actor: PersonId; kind: BlockerKind; note: string }
  | { type: "resolve_blocker"; taskId: string; actor: PersonId }
  | { type: "advance_day" }
  | { type: "buy"; actor: PersonId; itemId: string; price: number; kind: "digital" | "real"; balance: number }
  | { type: "equip"; actor: PersonId; look: Look };

export type Result = { ok: true; state: GameState; awards: Award[] } | { ok: false; error: string };

/** Higher outranks lower. Used only to decide who takes the full shared demerit (08 §4.3). */
export type Seniority = Record<PersonId, number>;

const roleOrder: Record<Role, number> = { reviewer: 3, checker: 2, preparer: 1 };

export function d1(task: Pick<Task, "deadline">): IsoDate {
  return workingDaysBefore(task.deadline, 1);
}

export function ownerOf(task: Task): { person: PersonId; role: Role } | null {
  switch (task.stage) {
    case "preparation": return { person: task.preparer, role: "preparer" };
    case "checking": return { person: task.checker, role: "checker" };
    case "review": return { person: task.reviewer, role: "reviewer" };
    case "complete": return null;
    default: return { person: task.preparer, role: "preparer" };
  }
}

export function openBlocker(task: Task): Blocker | undefined {
  return task.blockers.find((blocker) => !blocker.resolvedOn);
}

function onTeam(task: Task, person: PersonId) {
  return person === task.preparer || person === task.checker || person === task.reviewer;
}

function refuse(error: string): Result {
  return { ok: false, error };
}

function award(state: GameState, fresh: Award[], input: Omit<Award, "key" | "on"> & { on?: IsoDate }) {
  const key = `${input.code}:${input.taskId}:${input.person}`;
  if (state.awards.some((existing) => existing.key === key) || fresh.some((existing) => existing.key === key)) return;
  fresh.push({ ...input, key, on: input.on ?? state.today });
}

function updateTask(state: GameState, task: Task): GameState {
  return { ...state, tasks: state.tasks.map((existing) => existing.id === task.id ? task : existing) };
}

function withHistory(task: Task, state: GameState, actor: PersonId, what: string): Task {
  return { ...task, history: [...task.history, { on: state.today, actor, what }] };
}

/** Which actions `actor` may take on `task` right now. The engine re-checks on apply. */
export function availableActions(task: Task, actor: PersonId): Action["type"][] {
  if (task.stage === "complete") return [];
  const actions: Action["type"][] = [];
  const blocked = Boolean(openBlocker(task));
  if (task.stage === "preparation" && actor === task.preparer && !blocked) actions.push("submit_prep");
  if (task.stage === "checking" && actor === task.checker && task.checker !== task.preparer) actions.push("check_approve", "check_return");
  if (task.stage === "review" && actor === task.reviewer && task.reviewer !== task.preparer && task.reviewer !== task.checker) actions.push("review_approve", "review_return");
  if (task.stage === "client_approval" && onTeam(task, actor)) actions.push("record_client_approval");
  if (task.stage === "filing" && actor === task.preparer && !blocked) actions.push("record_filing");
  if (task.stage === "acceptance" && actor === task.preparer) actions.push("record_acceptance");
  if (task.stage === "payment" && actor === task.preparer) actions.push("record_payment");
  if (onTeam(task, actor)) actions.push(blocked ? "resolve_blocker" : "raise_blocker");
  return actions;
}

export function apply(state: GameState, action: Action, seniority: Seniority): Result {
  if (action.type === "advance_day") {
    const today = nextWorkingDay(state.today);
    const next = { ...state, today };
    const fresh = evaluateMisses(next, seniority);
    return { ok: true, state: { ...next, awards: [...next.awards, ...fresh] }, awards: fresh };
  }
  if (action.type === "equip") {
    const problem = lookErrors(action.look, ownedItems(state));
    if (problem) return refuse(problem);
    return { ok: true, state: { ...state, look: action.look }, awards: [] };
  }
  if (action.type === "buy") {
    if (oneTimeItems.has(action.itemId) && ownedItems(state).has(action.itemId)) return refuse("You already own this. Equip it from Me.");
    if (action.price > action.balance) return refuse("Not enough Ants yet.");
    const purchase: Purchase = { id: `${action.itemId}-${state.purchases.length + 1}`, itemId: action.itemId, price: action.price, kind: action.kind, on: state.today, status: action.kind === "digital" ? "delivered" : "held" };
    return { ok: true, state: { ...state, purchases: [...state.purchases, purchase] }, awards: [] };
  }

  const task = state.tasks.find((candidate) => candidate.id === action.taskId);
  if (!task) return refuse("That task no longer exists.");
  if (!availableActions(task, action.actor).includes(action.type)) {
    if (task.stage === "complete") return refuse("This task is already complete.");
    if ((action.type === "check_approve" || action.type === "check_return") && action.actor === task.preparer) return refuse("You prepared this, so someone else has to check it.");
    if ((action.type === "review_approve" || action.type === "review_return") && (action.actor === task.preparer || action.actor === task.checker)) return refuse("You worked on this, so someone else has to review it.");
    if (openBlocker(task) && (action.type === "submit_prep" || action.type === "record_filing")) return refuse("Resolve the open blocker first.");
    return refuse("That step isn't yours to take right now.");
  }

  const fresh: Award[] = [];
  let next: Task = task;
  const today = state.today;
  const d2 = workingDaysBefore(task.deadline, 2);

  switch (action.type) {
    case "submit_prep":
      next = withHistory({ ...task, stage: "checking" }, state, action.actor, "Prepared and sent for checking");
      break;
    case "check_approve":
      next = withHistory({ ...task, stage: "review" }, state, action.actor, "Checked");
      if (today <= d2) award(state, fresh, { person: task.checker, code: "CHECK_ON_TIME", role: "checker", xp: XP.CHECK_ON_TIME, taskId: task.id, note: "Check done by D-2" });
      break;
    case "review_approve":
      next = withHistory({ ...task, stage: "client_approval" }, state, action.actor, "Reviewed");
      if (today <= d2) award(state, fresh, { person: task.reviewer, code: "REVIEW_ON_TIME", role: "reviewer", xp: XP.REVIEW_ON_TIME, taskId: task.id, note: "Review done by D-2" });
      if (task.returns === 0) award(state, fresh, { person: task.preparer, code: "FIRST_PASS", role: "preparer", xp: XP.FIRST_PASS, taskId: task.id, note: "Passed check and review first time" });
      break;
    case "check_return":
    case "review_return": {
      if (!action.note.trim()) return refuse("Say what needs fixing.");
      next = withHistory({ ...task, stage: "preparation", returns: task.returns + 1 }, state, action.actor, `Returned: ${action.note.trim()}`);
      break;
    }
    case "record_client_approval":
      if (!action.ref.trim()) return refuse("Attach the client's approval reference.");
      if (!action.date || action.date > today) return refuse("Approval date can't be in the future.");
      next = withHistory({ ...task, stage: "filing", clientApproval: { date: action.date, ref: action.ref.trim() }, blockers: task.blockers.map((b) => b.kind === "client_approval" && !b.resolvedOn ? { ...b, resolvedOn: today } : b) }, state, action.actor, "Client approval recorded with evidence");
      break;
    case "record_filing":
      if (!action.ref.trim()) return refuse("Enter the filing reference number.");
      if (!action.date || action.date > today) return refuse("Filing date can't be in the future.");
      if (task.clientApproval && action.date < task.clientApproval.date) return refuse("Filing date can't be before the client approved.");
      next = withHistory({ ...task, stage: "acceptance", filing: { ref: action.ref.trim(), date: action.date, status: "submitted" } }, state, action.actor, "Filed · waiting for acceptance");
      break;
    case "record_acceptance": {
      if (!action.ackRef.trim()) return refuse("Enter the acknowledgement reference showing it was accepted.");
      const filing = task.filing!;
      next = withHistory({ ...task, stage: task.requiresPayment ? "payment" : "complete", filing: { ...filing, status: "accepted", ackRef: action.ackRef.trim() } }, state, action.actor, "Accepted · acknowledgement attached");
      if (filing.date <= task.deadline) {
        for (const role of ["preparer", "checker", "reviewer"] as const) {
          award(state, fresh, { person: task[role], code: "FILED_ACCEPTED", role, xp: XP.FILED_ACCEPTED[role], taskId: task.id, note: "Filed and accepted on time" });
        }
      }
      if (filing.date <= d1(task)) {
        for (const role of ["preparer", "checker", "reviewer"] as const) {
          award(state, fresh, { person: task[role], code: "ANAY_HIT", role, xp: XP.ANAY_HIT, taskId: task.id, note: "Filed by D-1 · hit on Anay" });
        }
      }
      break;
    }
    case "record_payment":
      if (!action.ref.trim()) return refuse("Enter the payment confirmation reference.");
      next = withHistory({ ...task, stage: "complete", payment: { ref: action.ref.trim(), date: today } }, state, action.actor, "Payment confirmed with proof");
      if (today <= task.deadline) award(state, fresh, { person: action.actor, code: "PAID_CONFIRMED", role: "preparer", xp: XP.PAID_CONFIRMED, taskId: task.id, note: "Payment confirmed on time" });
      break;
    case "raise_blocker":
      if (!action.note.trim()) return refuse("Say what's blocking it.");
      next = withHistory({ ...task, blockers: [...task.blockers, { kind: action.kind, note: action.note.trim(), loggedOn: today, loggedBy: action.actor }] }, state, action.actor, `Blocker raised: ${action.note.trim()}`);
      break;
    case "resolve_blocker": {
      const open = openBlocker(task)!;
      next = withHistory({ ...task, blockers: task.blockers.map((b) => b === open ? { ...b, resolvedOn: today } : b) }, state, action.actor, "Blocker resolved");
      if (open.loggedOn <= workingDaysBefore(d1(task), BLOCKER_EARLY_DAYS)) {
        award(state, fresh, { person: open.loggedBy, code: "BLOCKER_RAISED_EARLY", role: "owner", xp: XP.BLOCKER_RAISED_EARLY, taskId: task.id, note: "Raised a blocker early" });
      }
      break;
    }
  }

  const updated = updateTask(state, next);
  return { ok: true, state: { ...updated, awards: [...updated.awards, ...fresh] }, awards: fresh };
}

/** People who actually acted on the task (actual-actor history), or the current owner if nobody has. */
function touchedBy(task: Task): PersonId[] {
  const actors = Array.from(new Set(task.history.map((entry) => entry.actor)));
  if (actors.length > 0) return actors;
  const owner = ownerOf(task);
  return owner ? [owner.person] : [];
}

function roleOf(task: Task, person: PersonId): Role {
  if (person === task.reviewer) return "reviewer";
  if (person === task.checker) return "checker";
  return "preparer";
}

/** An external blocker logged before the miss and still open at it waives the demerit. */
function waiverFor(task: Task, missDate: IsoDate): Blocker | undefined {
  return task.blockers.find((b) => (EXTERNAL_BLOCKERS as readonly string[]).includes(b.kind) && b.loggedOn <= missDate && (!b.resolvedOn || b.resolvedOn > missDate));
}

/** Chain of command: the most senior toucher takes the full demerit, everyone else the share. */
export function evaluateMisses(state: GameState, seniority: Seniority): Award[] {
  const fresh: Award[] = [];
  for (const task of state.tasks) {
    const filedOn = task.filing?.date;
    const checks: Array<{ code: "MISSED_D1" | "MISSED_STATUTORY"; date: IsoDate; amounts: { senior: number; other: number } }> = [
      { code: "MISSED_D1", date: d1(task), amounts: XP.MISSED_D1 },
      { code: "MISSED_STATUTORY", date: task.deadline, amounts: XP.MISSED_STATUTORY },
    ];
    for (const check of checks) {
      const missed = state.today > check.date && (!filedOn || filedOn > check.date);
      if (!missed) continue;
      const people = touchedBy(task);
      const ranked = [...people].sort((a, b) => (seniority[b] ?? 0) - (seniority[a] ?? 0) || roleOrder[roleOf(task, b)] - roleOrder[roleOf(task, a)]);
      const waiver = waiverFor(task, check.date);
      ranked.forEach((person, index) => {
        const amount = index === 0 ? check.amounts.senior : check.amounts.other;
        award(state, fresh, {
          person, code: check.code, role: roleOf(task, person), taskId: task.id, on: addDays(check.date, 1),
          xp: waiver ? 0 : amount,
          note: check.code === "MISSED_D1" ? "Not filed by D-1" : "Statutory deadline missed",
          waivedBy: waiver ? `${waiver.note} (logged ${waiver.loggedOn})` : undefined,
        });
      });
    }
  }
  return fresh;
}

// ---------- Derived views (never stored) ----------

/** Digital items the player has bought (cosmetics are kept forever). */
export function ownedItems(state: GameState): Set<string> {
  return new Set(state.purchases.filter((p) => p.kind === "digital").map((p) => p.itemId));
}

export function xpFor(state: GameState, person: PersonId) {
  return state.awards.filter((a) => a.person === person).reduce((sum, a) => sum + a.xp, 0);
}

export function positiveXpFor(state: GameState, person: PersonId) {
  return state.awards.filter((a) => a.person === person && a.xp > 0).reduce((sum, a) => sum + a.xp, 0);
}

export function xpByClass(state: GameState, person: PersonId) {
  const totals = { f: 0, s: 0, e: 0 };
  for (const a of state.awards) {
    if (a.person !== person) continue;
    if (a.role === "checker") totals.s += a.xp;
    else if (a.role === "reviewer") totals.e += a.xp;
    else totals.f += a.xp;
  }
  return totals;
}

export function antsFor(state: GameState, person: PersonId, base: number) {
  const spent = state.purchases.reduce((sum, p) => sum + p.price, 0);
  const held = state.purchases.filter((p) => p.status === "held").reduce((sum, p) => sum + p.price, 0);
  return { available: base + xpFor(state, person) - spent, held };
}

export function anayFor(state: GameState, base: { maxHp: number; hits: number; heals: number }) {
  const hitTasks = new Set(state.awards.filter((a) => a.code === "ANAY_HIT").map((a) => a.taskId));
  const healTasks = new Set(state.awards.filter((a) => a.code === "MISSED_STATUTORY").map((a) => a.taskId));
  const hits = base.hits + hitTasks.size;
  const heals = base.heals + healTasks.size;
  return { maxHp: base.maxHp, hits, heals, hp: Math.max(0, base.maxHp - hits + heals) };
}

export function needsMe(state: GameState, me: PersonId) {
  return state.tasks.filter((task) => {
    if (task.stage === "complete") return false;
    const owner = ownerOf(task);
    return owner?.person === me && availableActions(task, me).some((a) => a !== "raise_blocker" && a !== "resolve_blocker");
  });
}
