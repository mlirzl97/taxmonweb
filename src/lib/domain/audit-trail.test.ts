import { describe, expect, it } from "vitest";

import { auditEventSummary, hasMaterialChange, type AuditEvent } from "./audit-trail";

const event: AuditEvent = {
  id: "audit-1",
  actorId: "user-1",
  actorDisplay: "Master Admin",
  actorType: "user",
  action: "profile.updated",
  entityType: "tax_profile",
  entityId: "profile-1",
  summary: "Filing channel changed",
  beforeState: { filingChannel: "eBIRForms" },
  afterState: { filingChannel: "eFPS" },
  reason: "Approved source correction",
  occurredAt: "2026-10-06T09:00:00+08:00",
};

describe("audit trail", () => {
  it("keeps the actor and action visible in a concise summary", () => {
    expect(auditEventSummary(event)).toContain("Master Admin · profile.updated");
  });

  it("detects material before/after changes", () => {
    expect(hasMaterialChange(event)).toBe(true);
    expect(hasMaterialChange({ ...event, afterState: event.beforeState })).toBe(false);
  });
});
