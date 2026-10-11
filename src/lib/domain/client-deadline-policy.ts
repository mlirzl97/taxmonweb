export const clientDeadlineModes = ["follow_group", "client_defined"] as const;

export type ClientDeadlineMode = (typeof clientDeadlineModes)[number];

/**
 * Client timing is an operational profile, not a second statutory deadline
 * rule. The published Tax Team date remains the anchor; these offsets only
 * determine when client information, approval, filing, or payment work is
 * expected around that anchor.
 */
export type ClientDeadlinePolicy = {
  mode: ClientDeadlineMode;
  sourceReference?: string;
  clientProvideLeadDays?: number;
  clientApprovalLeadDays?: number;
  tmfPackageLeadDays?: number;
  estimatedFilingLeadDays?: number;
  estimatedPaymentLeadDays?: number;
};

const leadDayKeys: ReadonlyArray<keyof Omit<ClientDeadlinePolicy, "mode" | "sourceReference">> = [
  "clientProvideLeadDays",
  "clientApprovalLeadDays",
  "tmfPackageLeadDays",
  "estimatedFilingLeadDays",
  "estimatedPaymentLeadDays",
];

export const defaultClientDeadlinePolicy: ClientDeadlinePolicy = { mode: "follow_group" };

/** Prototype group operating schedule used when a client follows the group policy. */
export const defaultGroupScheduleLeadDays = {
  clientProvideLeadDays: 5,
  clientApprovalLeadDays: 2,
  tmfPackageLeadDays: 1,
  estimatedFilingLeadDays: 1,
  estimatedPaymentLeadDays: 2,
} as const satisfies Required<Omit<ClientDeadlinePolicy, "mode" | "sourceReference">>;

export function isValidClientDeadlineLeadDays(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 365;
}

export function normalizeClientDeadlinePolicy(value: unknown, fallback: ClientDeadlinePolicy = defaultClientDeadlinePolicy): ClientDeadlinePolicy {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const source = value as Record<string, unknown>;
  const mode = source.mode === "client_defined" || source.mode === "follow_group" ? source.mode : fallback.mode;
  const normalized: ClientDeadlinePolicy = { mode };
  if (typeof source.sourceReference === "string" && source.sourceReference.trim()) normalized.sourceReference = source.sourceReference.trim();
  for (const key of leadDayKeys) {
    if (isValidClientDeadlineLeadDays(source[key])) normalized[key] = source[key];
  }
  return normalized;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function workingDaysBefore(dateValue: string, leadDays: number, holidayDates: ReadonlySet<string> = new Set()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !isValidClientDeadlineLeadDays(leadDays)) return null;
  const date = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;

  let remaining = leadDays;
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() - 1);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6 && !holidayDates.has(formatDate(date))) remaining -= 1;
  }

  return formatDate(date);
}

export function clientDeadlinePolicyErrors(policy: ClientDeadlinePolicy): string[] {
  const errors: string[] = [];
  for (const key of leadDayKeys) {
    const value = policy[key];
    if (value !== undefined && !isValidClientDeadlineLeadDays(value)) errors.push(`${key} must be a whole number from 0 to 365.`);
  }
  if (policy.mode === "client_defined" && !leadDayKeys.some((key) => policy[key] !== undefined)) {
    errors.push("Client-specific timing requires at least one working-day offset.");
  }
  return errors;
}
