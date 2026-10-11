import type { FixtureWorkItem } from "@/lib/fixtures";
import type { TaxTeamReportRow } from "./tax-team-reports";

function componentState(work: FixtureWorkItem, label: "Submission" | "Payment" | "Evidence") {
  return work.components.find((component) => component.label === label)?.state ?? "Unknown";
}

export function liveWorkToTaxTeamReportRow(work: FixtureWorkItem): TaxTeamReportRow {
  const filingStep = work.steps.find((step) => step.id === "filing");
  const filing = filingStep?.state === "complete" ? "Reported sent" : filingStep?.state === "not-started" ? "Not reached" : "Unknown";
  const evidence = componentState(work, "Evidence");
  const payment = componentState(work, "Payment");
  const date = /^\d{4}-\d{2}-\d{2}$/.test(work.deadline) ? work.deadline : "1970-01-01";
  return {
    id: work.id,
    date,
    dateLabel: work.deadline,
    period: work.period,
    client: work.client,
    entity: work.entity,
    registrationUnit: work.registrationUnit,
    requirement: work.title,
    tower: work.scope,
    cluster: work.cluster ?? "Unresolved",
    owner: work.owner,
    status: work.status,
    monthlyStatus: "unresolved",
    lifecycle: work.stage,
    filing,
    acceptance: filing === "Reported sent" ? "Not verified" : "Not reached",
    payment,
    evidence,
    control: /verified|complete/i.test(evidence) ? "Complete" : "Incomplete",
    qa: "Not configured",
    qaStatus: "not_configured",
    supportCheck: "not_configured",
    qaFinding: "No approved independent QA result is present.",
    rca: "Not configured",
    rcaStatus: "not_configured",
    attention: work.blocker?.reason ?? work.statusReason,
  };
}
