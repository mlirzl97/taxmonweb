import { describe, expect, it } from "vitest";

import { governedReturnForms } from "./client-return-selection";
import { parseManualClientSetupInput } from "./manual-client-setup";
import {
  buildQuickClientSetupDraft,
  buildQuickClientSetupRequest,
  emptyQuickClientSetup,
  quickClientSetupErrors,
  quickSetupDayCount,
  type QuickClientSetupInput,
} from "./quick-client-setup";

const scopeId = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const firstReturn = governedReturnForms[0]!.formNumber;
const secondReturn = governedReturnForms[1]!.formNumber;

function input(overrides: Partial<QuickClientSetupInput> = {}): QuickClientSetupInput {
  return {
    ...emptyQuickClientSetup,
    clientName: "Sample Bakery Co.",
    crmNumber: "crm-2026-901",
    returnCodes: [firstReturn, secondReturn],
    yearEndBasis: "Calendar year",
    firstPeriodToFile: "2026-12",
    fileLocation: "https://example.sharepoint.com/sites/clients/sample-bakery",
    ...overrides,
  };
}

describe("quick client setup validation", () => {
  it("accepts the four answers for a calendar-year client", () => {
    expect(quickClientSetupErrors(input(), { prototypeMode: false })).toEqual({});
  });

  it("accepts a valid fiscal year-end", () => {
    expect(quickClientSetupErrors(input({ yearEndBasis: "Fiscal year", fiscalYearEndMonth: "June", fiscalYearEndDay: "30" }), { prototypeMode: false })).toEqual({});
  });

  it("requires the client name and CRM number", () => {
    expect(quickClientSetupErrors(input({ clientName: "  " }), { prototypeMode: false }).client).toMatch(/client name/);
    expect(quickClientSetupErrors(input({ crmNumber: "" }), { prototypeMode: false }).client).toMatch(/CRM number/);
    expect(quickClientSetupErrors(input({ crmNumber: "CRM 1/2" }), { prototypeMode: false }).client).toMatch(/letters, numbers/);
  });

  it("requires at least one return, and only approved returns", () => {
    expect(quickClientSetupErrors(input({ returnCodes: [] }), { prototypeMode: false }).returns).toMatch(/at least one/);
    expect(quickClientSetupErrors(input({ returnCodes: ["NOT-A-FORM"] }), { prototypeMode: false }).returns).toMatch(/approved form catalog/);
  });

  it("rejects an impossible fiscal year-end", () => {
    expect(quickClientSetupErrors(input({ yearEndBasis: "Fiscal year", fiscalYearEndMonth: "April", fiscalYearEndDay: "31" }), { prototypeMode: false }).yearEnd).toMatch(/day/);
    expect(quickClientSetupErrors(input({ yearEndBasis: "Fiscal year", fiscalYearEndMonth: "", fiscalYearEndDay: "" }), { prototypeMode: false }).yearEnd).toMatch(/month/);
    expect(quickClientSetupErrors(input({ yearEndBasis: "" }), { prototypeMode: false }).yearEnd).toMatch(/calendar or fiscal/);
    expect(quickSetupDayCount("February")).toBe(29);
  });

  it("requires a first period to file in YYYY-MM", () => {
    expect(quickClientSetupErrors(input({ firstPeriodToFile: "" }), { prototypeMode: false }).firstPeriod).toBeDefined();
    expect(quickClientSetupErrors(input({ firstPeriodToFile: "2026-13" }), { prototypeMode: false }).firstPeriod).toBeDefined();
  });

  it("requires a real file location in live setup but not in the prototype", () => {
    expect(quickClientSetupErrors(input({ fileLocation: "" }), { prototypeMode: false }).fileLocation).toMatch(/permanent file location/);
    expect(quickClientSetupErrors(input({ fileLocation: "" }), { prototypeMode: true }).fileLocation).toBeUndefined();
    expect(quickClientSetupErrors(input({ fileLocation: "somewhere on my laptop" }), { prototypeMode: false }).fileLocation).toMatch(/SharePoint/);
  });
});

describe("quick client setup request", () => {
  it("is accepted by the server's own setup validator", () => {
    const body = buildQuickClientSetupRequest(input(), { prototypeMode: false, organizationUnitId: scopeId });
    const parsed = parseManualClientSetupInput(body);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.clientReferenceCode).toBe("CRM-2026-901");
    expect(parsed.value.sourceSystem).toBe("sharepoint");
    expect(parsed.value.profileData?.proposedReturnCodes).toEqual([firstReturn, secondReturn]);
    expect(parsed.value.profileData?.fiscalYearEnd).toBe("December 31");
    expect(parsed.value.profileData?.firstPeriodToFile).toBe("2026-12");
  });

  it("sends only the four answers and leaves other profile facts unconfigured", () => {
    const body = buildQuickClientSetupRequest(input(), { prototypeMode: false, organizationUnitId: scopeId });
    expect(Object.keys(body.profileData).sort()).toEqual(["firstPeriodToFile", "fiscalYearEnd", "permanentFileLink", "proposedReturnCodes", "registeredReturnCodes", "taxYearBasis"]);
    expect(body.sourcePack.every((item) => item.status === "not_captured")).toBe(true);
  });

  it("records a fiscal year-end as month and day", () => {
    const body = buildQuickClientSetupRequest(input({ yearEndBasis: "Fiscal year", fiscalYearEndMonth: "June", fiscalYearEndDay: "30" }), { prototypeMode: false, organizationUnitId: scopeId });
    expect(body.profileData.fiscalYearEnd).toBe("June 30");
  });

  it("uses a shared-drive path as a manual reference", () => {
    const body = buildQuickClientSetupRequest(input({ fileLocation: "S:\\Clients\\Sample Bakery" }), { prototypeMode: false, organizationUnitId: scopeId });
    expect(body.sourceSystem).toBe("manual_reference");
    expect(parseManualClientSetupInput(body).ok).toBe(true);
  });

  it("marks prototype setups as synthetic, with a synthetic location when none is given", () => {
    const body = buildQuickClientSetupRequest(input({ fileLocation: "" }), { prototypeMode: true, organizationUnitId: scopeId });
    expect(body.sourceSystem).toBe("synthetic_fixture");
    expect(body.sourceReference).toBe("synthetic://quick-setup/CRM-2026-901");
    expect(body.sourceNotes).toMatch(/not yet recorded/);
    expect(parseManualClientSetupInput(body).ok).toBe(true);
  });

  it("never sends a synthetic source outside the prototype", () => {
    const body = buildQuickClientSetupRequest(input(), { prototypeMode: false, organizationUnitId: scopeId });
    expect(body.sourceSystem).not.toBe("synthetic_fixture");
    expect(body.sourceReference.startsWith("synthetic://")).toBe(false);
  });
});

describe("quick client setup prototype draft", () => {
  it("is a pending intake the full setup can resume", () => {
    const draft = buildQuickClientSetupDraft(input({ fileLocation: "" }), { createdAt: "Thu 5 Nov" });
    expect(draft.status).toBe("intake_pending");
    expect(draft.importSource).toBe("quick_setup");
    expect(draft.client.clientReferenceCode).toBe("CRM-2026-901");
    expect(draft.registrationFacts.proposedReturnCodes).toEqual([firstReturn, secondReturn]);
    expect(draft.registrationFacts.firstPeriodToFile).toBe("2026-12");
    expect(draft.registrationFacts.rdoOrLts).toBe("");
    expect(draft.registrationFacts.permanentFileLink).toBe("synthetic://quick-setup/CRM-2026-901");
  });
});
