import { describe, expect, it } from "vitest";

import { liveWorkToTaxTeamReportRow } from "./live-tax-team-adapter";

describe("live Tax Team projection", () => {
  it("keeps generated-work control facts unresolved where no evidence exists", () => {
    const row = liveWorkToTaxTeamReportRow({
      id: "work-1",
      clientId: "client-1",
      client: "Sanitized Client",
      entity: "Sanitized Entity",
      registrationUnit: "Head Office",
      title: "REQ-TEST · Test requirement",
      period: "September 2026",
      detail: "Client approval",
      stage: "CLIENT",
      nextAction: "Continue client approval",
      status: "AMBER",
      statusReason: "Approval pending",
      deadline: "2026-10-15",
      deadlineType: "TMF internal target",
      owner: "Assigned user",
      scope: "Tower A",
      paymentApplicability: "UNRESOLVED",
      paymentAmount: null,
      steps: [],
      components: [{ label: "Evidence", state: "Not started", detail: "Evidence unresolved" }],
    });

    expect(row.date).toBe("2026-10-15");
    expect(row.monthlyStatus).toBe("unresolved");
    expect(row.evidence).toBe("Not started");
    expect(row.control).toBe("Incomplete");
  });
});
