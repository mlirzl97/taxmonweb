/** Presentation helpers shared by screens: plain words for stages and what a step is worth. */
import { shortDate, workingDaysBefore } from "./calendar";
import { d1, openBlocker, type GameState, type PersonId, type Stage, type Task } from "./engine";
import { XP } from "./rules";
import { people } from "./world";

export const stageLabel: Record<Stage, string> = {
  preparation: "Preparation",
  checking: "Checking",
  review: "Review",
  client_approval: "Client approval",
  filing: "Filing",
  acceptance: "Waiting for acceptance",
  payment: "Payment",
  complete: "Complete",
};

export const nextStepLabel: Record<Stage, string> = {
  preparation: "Prepare and send for checking",
  checking: "Check it",
  review: "Review it",
  client_approval: "Record client approval",
  filing: "Record filing",
  acceptance: "Record acceptance",
  payment: "Record payment",
  complete: "Done",
};

export function personName(id: PersonId) {
  return people[id]?.name ?? id;
}

export function firstName(id: PersonId) {
  return people[id]?.first ?? id;
}

/** XP the viewer can still earn from the next step on this task (shown before acting). */
export function potentialXp(task: Task, today: string): number {
  const beforeD1 = today <= d1(task);
  const beforeD2 = today <= workingDaysBefore(task.deadline, 2);
  switch (task.stage) {
    case "checking": return beforeD2 ? XP.CHECK_ON_TIME : 0;
    case "review": return beforeD2 ? XP.REVIEW_ON_TIME : 0;
    case "acceptance": {
      const filed = task.filing?.date ?? today;
      return (filed <= task.deadline ? XP.FILED_ACCEPTED.preparer : 0) + (filed <= d1(task) ? XP.ANAY_HIT : 0);
    }
    case "filing": return (today <= task.deadline ? XP.FILED_ACCEPTED.preparer : 0) + (beforeD1 ? XP.ANAY_HIT : 0);
    case "payment": return today <= task.deadline ? XP.PAID_CONFIRMED : 0;
    default: return 0;
  }
}

export function taskTone(task: Task, today: string): "blocked" | "risk" | "ok" {
  if (openBlocker(task)) return "blocked";
  if (task.stage === "complete") return "ok";
  return today >= d1(task) ? "risk" : "ok";
}

export function dueLine(task: Task, today: string) {
  if (task.stage === "complete") return "Complete";
  const due = shortDate(task.deadline);
  const one = d1(task);
  if (today > task.deadline) return `Overdue · was due ${due}`;
  if (today > one) return `Past D-1 · due ${due}`;
  if (today === one) return `D-1 is today · due ${due}`;
  return `D-1 ${shortDate(one)} · due ${due}`;
}

/** Colony-wide ring counts: sample baselines plus filings accepted on time in this session. */
export function ringsFor(state: GameState, base: { filed: [number, number]; evidence: [number, number]; qa: [number, number] }) {
  const acceptedOnTime = state.tasks.filter((t) => t.filing?.status === "accepted" && t.filing.date <= t.deadline).length;
  return {
    filed: [Math.min(base.filed[1], base.filed[0] + acceptedOnTime), base.filed[1]] as [number, number],
    evidence: [base.evidence[0] + acceptedOnTime, base.evidence[1] + acceptedOnTime] as [number, number],
    qa: base.qa,
  };
}
