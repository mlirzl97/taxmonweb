import type { ClientDeadlinePolicy } from "@/lib/domain/client-deadline-policy";
import { formatTin, type ClientOnboardingContract, type ClientOnboardingIdentity } from "@/lib/domain/client-onboarding";
import type { FixtureClient } from "@/lib/fixtures";
import { fixtureClock } from "@/lib/fixtures";

export const prototypeClientSetupUpdatedEvent = "taxmonweb:client-setup-updated";

export type SubmittedClientSetup = {
  client: Pick<ClientOnboardingIdentity, "clientReferenceCode" | "clientDisplayName" | "entityDisplayName" | "tin" | "unitDisplayName" | "unitKind" | "goLiveDate">;
  contract: Pick<ClientOnboardingContract, "recordType" | "referenceCode">;
  registrationFacts: {
    rdoOrLts: string;
    registeredAddress: string;
    registrationDate: string;
    taxYearBasis: string;
    fiscalYearEnd?: string;
    accountingSystem: string;
    booksType: string;
    invoicing: string;
    filingChannel: string;
    eFPSGroup: string;
    proposedReturnCodes?: string[];
    permanentFileLink?: string;
    goLiveDate?: string;
    firstPeriodToFile?: string;
    enateSetup?: "Yes" | "No" | "Unknown";
    paymentRoute?: "Client Pays" | "TMF Pays" | "Not configured";
    deadlinePolicy?: ClientDeadlinePolicy;
  };
};

export function submittedSetupToFixtureClient(setup: SubmittedClientSetup): FixtureClient {
  const { client, contract, registrationFacts: facts } = setup;
  const taxpayerName = client.entityDisplayName || client.clientDisplayName;
  const taxYearBasis: "Calendar year" | "Fiscal year" | undefined = facts.taxYearBasis === "Calendar year" || facts.taxYearBasis === "Fiscal year" ? facts.taxYearBasis : undefined;
  const profile = {
    registeredTaxpayerName: taxpayerName,
    tinDisplay: formatTin(client.tin) || "Not recorded",
    branchCode: "000",
    rdoOrLts: facts.rdoOrLts || "Needs review",
    entityType: "Needs source review",
    registeredAddress: facts.registeredAddress || "Needs source review",
    lineOfBusiness: "Needs source review",
    registrationEffective: facts.registrationDate || "Needs source review",
    registrationStatus: "Submitted setup · pending profile activation",
    registeredActivities: "Needs source review",
    tradeName: client.clientDisplayName,
    filingChannel: facts.filingChannel || "Not configured",
    filingContext: facts.filingChannel ? `${facts.filingChannel} · submitted setup` : "Needs setup",
    eFPSGroup: facts.eFPSGroup || undefined,
    registeredTaxTypes: [],
    taxYearBasis,
    fiscalYearEnd: facts.fiscalYearEnd,
    goLiveDate: facts.goLiveDate,
    firstPeriodToFile: facts.firstPeriodToFile,
    permanentFileLink: facts.permanentFileLink,
    accountingSystem: facts.accountingSystem || "Not configured",
    booksType: facts.booksType || "Not configured",
    invoicing: facts.invoicing || "Not configured",
    registeredReturnCodes: facts.proposedReturnCodes ?? [],
    paymentRoute: facts.paymentRoute ?? "Not configured",
    deadlinePolicy: facts.deadlinePolicy,
    weight: 0,
    weightLabel: "Not assessed",
    sourceFinalWeight: null,
    fixtureSource: "synthetic_portfolio_test" as const,
    enateSetup: facts.enateSetup ?? "Unknown" as const,
    profileState: "Setup incomplete" as const,
    sourceLabel: "Submitted local onboarding intake",
    sourceKind: "manual validation" as const,
    authorities: [],
    auditExposures: [],
    attention: ["Tax Profile setup pending", "Assignment pending"],
  };
  const clientId = `submitted-${client.clientReferenceCode}`;
  const unitName = client.unitDisplayName || "Head Office";
  return {
    id: clientId,
    name: client.clientDisplayName,
    entitySummary: "1 taxpayer entity",
    profileSummary: profile.profileState,
    contractRepository: {
      id: `submitted-contract-${client.clientReferenceCode}`,
      referenceCode: contract.referenceCode || `CONTRACT-REPO-${client.clientReferenceCode}`,
      masterEngagement: {
        id: `submitted-engagement-${client.clientReferenceCode}`,
        referenceCode: contract.referenceCode || `CONTRACT-${client.clientReferenceCode}`,
        title: contract.recordType || "Main contract",
        status: "Pending review",
        effectiveFrom: client.goLiveDate || fixtureClock.today,
        documents: [],
      },
      additionalEngagements: [],
    },
    scope: "Tower A",
    assignment: { preparer: "Unassigned", checker: "Unassigned", reviewer: "Unassigned", tower: "Unassigned", cluster: "Unassigned", effectiveFrom: client.goLiveDate || fixtureClock.today },
    entities: [{ name: taxpayerName, profile, units: [{ name: unitName, type: client.unitKind === "branch" ? "Branch" : "Head Office", profile }] }],
  };
}

export function readSubmittedClientSetups(): FixtureClient[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem("taxmon.client.setup.drafts") ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is SubmittedClientSetup & { status: "submitted" } => Boolean(item && typeof item === "object" && (item as { status?: unknown }).status === "submitted"))
      .map(submittedSetupToFixtureClient);
  } catch {
    return [];
  }
}
