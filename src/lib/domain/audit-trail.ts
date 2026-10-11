export type AuditActorType = "user" | "system" | "integration";

export type AuditEvent = {
  id: string;
  actorId: string | null;
  actorDisplay: string;
  actorType: AuditActorType;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  reason?: string | null;
  effectiveAt?: string | null;
  occurredAt: string;
  correlationId?: string | null;
};

export function auditEventSummary(event: AuditEvent): string {
  return `${event.actorDisplay} · ${event.action} · ${event.summary}`;
}

export function hasMaterialChange(event: AuditEvent): boolean {
  return JSON.stringify(event.beforeState ?? null) !== JSON.stringify(event.afterState ?? null);
}
