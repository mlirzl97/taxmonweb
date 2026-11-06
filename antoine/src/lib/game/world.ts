/**
 * SAMPLE WORLD. Fictional clients and people, illustrative dates. No
 * Philippine tax content (forms, deadlines, holidays) is asserted; titles are
 * generic and deadlines are labelled sample everywhere they show.
 */
import type { GameState, PersonId, Seniority, Task } from "./engine";

export const ME: PersonId = "BS";
export const SAMPLE_TODAY = "2026-11-06";

export const people: Record<PersonId, { name: string; first: string }> = {
  BS: { name: "Bea Santos", first: "Bea" },
  JR: { name: "Jas Ramos", first: "Jas" },
  PD: { name: "Paolo Dizon", first: "Paolo" },
  NB: { name: "Nico Bautista", first: "Nico" },
  MR: { name: "Mika Reyes", first: "Mika" },
  TG: { name: "Toni Garcia", first: "Toni" },
};

/** Sample reporting hierarchy for chain-of-command demerits (read from the Team org chart once connected). */
export const seniority: Seniority = { NB: 4, PD: 3, JR: 3, MR: 2, BS: 2, TG: 1 };

/** Colony figures from everyone else this cycle (sample baselines the engine adds to). */
export const baselines = {
  ants: 2640,
  antsHeld: 1000,
  lifetimeXp: 4700,
  streak: 4,
  freezes: 1,
  cleanRate: 97,
  anay: { maxHp: 41, hits: 23, heals: 2 },
  rings: { filed: [23, 41] as [number, number], evidence: [19, 23] as [number, number], qa: [6, 6] as [number, number] },
};

const task = (t: Omit<Task, "returns" | "blockers" | "history"> & Partial<Pick<Task, "returns" | "blockers" | "history">>): Task => ({ returns: 0, blockers: [], history: [], ...t });

export const initialTasks: Task[] = [
  task({ id: "alon", client: "Alon Logistics", title: "VAT return", category: "VAT / PT", period: "October", deadline: "2026-11-12", requiresPayment: true, preparer: "BS", checker: "PD", reviewer: "NB", stage: "filing",
    clientApproval: { date: "2026-11-05", ref: "Client email 5 Nov" },
    history: [{ on: "2026-11-02", actor: "BS", what: "Prepared and sent for checking" }, { on: "2026-11-03", actor: "PD", what: "Checked" }, { on: "2026-11-04", actor: "NB", what: "Reviewed" }, { on: "2026-11-05", actor: "BS", what: "Client approval recorded with evidence" }] }),
  task({ id: "mabini", client: "Mabini Retail", title: "VAT return", category: "VAT / PT", period: "October", deadline: "2026-11-25", requiresPayment: false, preparer: "BS", checker: "PD", reviewer: "NB", stage: "acceptance",
    clientApproval: { date: "2026-11-04", ref: "Signed approval" }, filing: { ref: "FIL-SAMPLE-2291", date: "2026-11-05", status: "submitted" },
    history: [{ on: "2026-11-02", actor: "BS", what: "Prepared and sent for checking" }, { on: "2026-11-03", actor: "PD", what: "Checked" }, { on: "2026-11-03", actor: "NB", what: "Reviewed" }, { on: "2026-11-05", actor: "BS", what: "Filed · waiting for acceptance" }] }),
  task({ id: "sampaguita", client: "Sampaguita Trading", title: "Percentage tax return", category: "VAT / PT", period: "October", deadline: "2026-11-25", requiresPayment: true, preparer: "JR", checker: "BS", reviewer: "NB", stage: "checking",
    history: [{ on: "2026-11-05", actor: "JR", what: "Prepared and sent for checking" }] }),
  task({ id: "tala", client: "Tala Studios", title: "Income tax return", category: "CIT", period: "Q3", deadline: "2026-11-27", requiresPayment: true, preparer: "BS", checker: "JR", reviewer: "NB", stage: "preparation" }),
  task({ id: "kalye", client: "Kalye Café", title: "Withholding return", category: "WHT", period: "October", deadline: "2026-11-10", requiresPayment: true, preparer: "BS", checker: "JR", reviewer: "NB", stage: "client_approval",
    blockers: [{ kind: "client_approval", note: "Client owner travelling; approval pending", loggedOn: "2026-11-03", loggedBy: "BS" }],
    history: [{ on: "2026-11-02", actor: "BS", what: "Prepared and sent for checking" }, { on: "2026-11-02", actor: "JR", what: "Checked" }, { on: "2026-11-03", actor: "NB", what: "Reviewed" }] }),
  task({ id: "bukid", client: "Bukid Agri", title: "Income tax return", category: "CIT", period: "Q3", deadline: "2026-11-16", requiresPayment: true, preparer: "BS", checker: "PD", reviewer: "NB", stage: "review",
    history: [{ on: "2026-11-04", actor: "BS", what: "Prepared and sent for checking" }, { on: "2026-11-05", actor: "PD", what: "Checked" }] }),
  task({ id: "daan", client: "Daan Builders", title: "Withholding return", category: "WHT", period: "October", deadline: "2026-11-10", requiresPayment: true, preparer: "MR", checker: "BS", reviewer: "PD", stage: "preparation" }),
  task({ id: "lawin", client: "Lawin Shipping", title: "Withholding return", category: "WHT", period: "October", deadline: "2026-11-10", requiresPayment: true, preparer: "TG", checker: "BS", reviewer: "NB", stage: "preparation",
    blockers: [{ kind: "client_data", note: "Payroll data not received", loggedOn: "2026-10-30", loggedBy: "TG" }] }),
];

export function initialState(): GameState {
  return { version: 1, today: SAMPLE_TODAY, tasks: initialTasks, awards: [], purchases: [] };
}
