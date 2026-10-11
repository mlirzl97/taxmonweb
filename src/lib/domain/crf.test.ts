import { describe, expect, it } from "vitest";

import { fixtureChangeRequestForms, fixtureClients } from "@/lib/fixtures";

describe("central CRF repository projection", () => {
  it("keeps every CRF linked to an existing client repository", () => {
    const clientsById = new Map(fixtureClients.map((client) => [client.id, client]));

    expect(fixtureChangeRequestForms.length).toBeGreaterThan(0);
    expect(fixtureChangeRequestForms.every((crf) => {
      const client = clientsById.get(crf.clientId);
      return Boolean(client && client.contractRepository.id === crf.contractRepositoryId && client.contractRepository.additionalEngagements.some((engagement) => engagement.id === crf.id));
    })).toBe(true);
  });

  it("records audit context on audit-support CRFs without creating a separate audit case", () => {
    const auditCrfs = fixtureChangeRequestForms.filter((crf) => crf.type === "Tax audit support");
    expect(auditCrfs.length).toBeGreaterThan(0);
    expect(auditCrfs.every((crf) => crf.auditContext?.source.includes("synthetic"))).toBe(true);
    expect(fixtureChangeRequestForms.every((crf) => crf.templateVersion === "CRF v1")).toBe(true);
  });
});
