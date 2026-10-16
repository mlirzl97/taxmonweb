import { describe, expect, it } from "vitest";

import { submittedSetupToFixtureClient, type SubmittedClientSetup } from "./submitted-client-projection";

describe("submitted client projection", () => {
  it("moves a submitted setup into the taxpayer-shaped read model without inventing readiness", () => {
    const setup = {
      client: { clientReferenceCode: "CLIENT-001", clientDisplayName: "Asterline Services", entityDisplayName: "Asterline Services Inc.", tin: "12345678900000", unitDisplayName: "Head Office", unitKind: "head_office", goLiveDate: "2026-10-13" },
      contract: { recordType: "msa", referenceCode: "MSA-001" },
      registrationFacts: { rdoOrLts: "RDO 050", registeredAddress: "Makati", registrationDate: "2020-01-02", taxYearBasis: "Calendar year", fiscalYearEnd: "December 31", accountingSystem: "TMF · Xero", booksType: "Manual", invoicing: "Manual", filingChannel: "eFPS", eFPSGroup: "Group A", proposedReturnCodes: ["1601-EQ"], permanentFileLink: "synthetic://source", goLiveDate: "2026-10-13", paymentRoute: "Client Pays" },
    } satisfies SubmittedClientSetup;

    const client = submittedSetupToFixtureClient(setup);

    expect(client.id).toBe("submitted-CLIENT-001");
    expect(client.entities[0]?.profile.registeredTaxpayerName).toBe("Asterline Services Inc.");
    expect(client.entities[0]?.profile.profileState).toBe("Setup incomplete");
    expect(client.entities[0]?.profile.tinDisplay).toBe("123-456-789-00000");
    expect(client.assignment.preparer).toBe("Unassigned");
    expect(client.entities[0]?.profile.registeredReturnCodes).toEqual(["1601-EQ"]);
  });
});
