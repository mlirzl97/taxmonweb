export type VerificationStatus =
  | 'verified'
  | 'partially_verified'
  | 'unresolved'
  | 'superseded';

export type OperatingTaxCategory = 'cit' | 'vat_percentage' | 'wht' | 'others';

export type DeadlineStrategy =
  | 'fixed_date'
  | 'fixed_day_of_month'
  | 'days_after_period_end'
  | 'working_day_adjustment'
  | 'one_working_day_before';

export type DeadlineAdjustment = 'none' | 'next_working_day' | 'previous_working_day';

export type CoverageSeverity = 'normal' | 'attention' | 'exception' | 'statutory_exposure';

export type ImpactDecision = 'keep_existing' | 'rebase' | 'regenerate' | 'cancel' | 'supersede';

export interface SourceCitation {
  sourceId: string;
  locator?: string;
  page?: string;
  section?: string;
}

export interface DeadlinePolicyVersion {
  id: string;
  strategy: DeadlineStrategy;
  effectiveFrom: string;
  effectiveTo?: string;
  adjustment: DeadlineAdjustment;
  parameters: Record<string, string | number | boolean>;
  verificationStatus: VerificationStatus;
  sources: SourceCitation[];
}

export interface DeadlineCalculationInput {
  baseDate?: string;
  periodEnd?: string;
  policy: DeadlinePolicyVersion;
  holidayDates?: ReadonlySet<string>;
  weekendDays?: ReadonlySet<number>;
}

export interface DeadlineCalculationResult {
  baseStatutoryDeadline: string | null;
  adjustedStatutoryDeadline: string | null;
  explanation: string;
  policyId: string;
  verificationStatus: VerificationStatus;
  unresolvedReason?: string;
}

export interface DeadlineExplainability {
  requirementId: string;
  requirementSourceIds: string[];
  ruleVersionId: string;
  periodOrEvent: string;
  baseStatutoryDeadline: string | null;
  adjustedStatutoryDeadline: string | null;
  adjustmentExplanation: string;
  tmfPackageTarget?: string;
  monthlyCalendarVersion?: string;
}

export interface CoverageIntegrityInput {
  expected: boolean;
  generated: boolean;
  executed: boolean;
  evidenced: boolean;
  today: string;
  internalTarget?: string;
  statutoryDeadline?: string;
  lifecycle: 'not_started' | 'open' | 'filed' | 'complete';
  legalSignificance: 'ordinary' | 'material';
  approvedException?: boolean;
}

export interface CoverageIntegrityResult {
  stage: 'expected' | 'generated' | 'executed' | 'evidenced' | 'complete';
  severity: CoverageSeverity;
  reason: string;
}

export interface ImpactChange {
  objectType: 'rule' | 'profile' | 'compliance_universe' | 'deadline' | 'service_scope';
  objectId: string;
  workIds: string[];
  completedWorkIds: string[];
  openWorkIds: string[];
  oldContext: Record<string, unknown>;
  proposedContext: Record<string, unknown>;
}

export interface ImpactDecisionRecord {
  change: ImpactChange;
  decision: ImpactDecision;
  actorId: string;
  decidedAt: string;
  reason: string;
}

function parseDate(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return formatDate(date) === value ? date : null;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isNonWorkingDay(date: Date, holidays: ReadonlySet<string>, weekendDays: ReadonlySet<number>): boolean {
  return weekendDays.has(date.getUTCDay()) || holidays.has(formatDate(date));
}

function adjustDate(
  date: Date,
  adjustment: DeadlineAdjustment,
  holidays: ReadonlySet<string>,
  weekendDays: ReadonlySet<number>,
): Date {
  if (adjustment === 'none') return date;

  const direction = adjustment === 'next_working_day' ? 1 : -1;
  const adjusted = new Date(date);
  while (isNonWorkingDay(adjusted, holidays, weekendDays)) {
    adjusted.setUTCDate(adjusted.getUTCDate() + direction);
  }
  return adjusted;
}

function calculateBaseDate(input: DeadlineCalculationInput): Date | null {
  const { policy } = input;
  if (policy.verificationStatus === 'unresolved' || policy.verificationStatus === 'superseded') return null;

  if (policy.strategy === 'fixed_date') return parseDate(input.baseDate);
  if (policy.strategy === 'days_after_period_end') {
    const periodEnd = parseDate(input.periodEnd);
    const days = policy.parameters.days_after_period_end;
    if (!periodEnd || typeof days !== 'number') return null;
    periodEnd.setUTCDate(periodEnd.getUTCDate() + days);
    return periodEnd;
  }
  if (policy.strategy === 'fixed_day_of_month') {
    const periodEnd = parseDate(input.periodEnd);
    const day = policy.parameters.day_of_month;
    const monthsAfter = policy.parameters.months_after_period_end ?? 0;
    if (!periodEnd || typeof day !== 'number' || typeof monthsAfter !== 'number') return null;
    const date = new Date(Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth() + monthsAfter + 1, day));
    return date;
  }
  if (policy.strategy === 'working_day_adjustment') {
    // The anchor date must still be supplied by the governing rule. The
    // explicit policy.adjustment controls direction; `none` is unresolved
    // rather than an implicit legal assumption.
    const anchor = parseDate(input.baseDate);
    if (!anchor || policy.adjustment === 'none') return null;
    return anchor;
  }
  if (policy.strategy === 'one_working_day_before') {
    const anchor = parseDate(input.baseDate);
    if (!anchor) return null;
    const holidays = input.holidayDates ?? new Set<string>();
    const weekendDays = input.weekendDays ?? new Set([0, 6]);
    anchor.setUTCDate(anchor.getUTCDate() - 1);
    return adjustDate(new Date(anchor), 'previous_working_day', holidays, weekendDays);
  }
  return null;
}

export function calculateDeadline(input: DeadlineCalculationInput): DeadlineCalculationResult {
  const base = calculateBaseDate(input);
  if (!base) {
    return {
      baseStatutoryDeadline: null,
      adjustedStatutoryDeadline: null,
      explanation: 'Deadline unresolved: the approved policy is missing, unresolved, superseded, or lacks required parameters.',
      policyId: input.policy.id,
      verificationStatus: 'unresolved',
      unresolvedReason: 'required_deadline_configuration_missing_or_unresolved',
    };
  }

  const holidays = input.holidayDates ?? new Set<string>();
  const weekendDays = input.weekendDays ?? new Set([0, 6]);
  const adjusted = adjustDate(base, input.policy.adjustment, holidays, weekendDays);
  const adjustmentText = input.policy.adjustment === 'none'
    ? 'No approved statutory adjustment applied.'
    : `Approved ${input.policy.adjustment.replaceAll('_', ' ')} adjustment applied using the governed working-day context.`;

  return {
    baseStatutoryDeadline: formatDate(base),
    adjustedStatutoryDeadline: formatDate(adjusted),
    explanation: `Base statutory deadline ${formatDate(base)}. ${adjustmentText}`,
    policyId: input.policy.id,
    verificationStatus: input.policy.verificationStatus,
  };
}

export function calculateInternalTarget(adjustedStatutoryDeadline: string, holidayDates: ReadonlySet<string> = new Set()): string {
  const deadline = parseDate(adjustedStatutoryDeadline);
  if (!deadline) throw new Error('A valid adjusted statutory deadline is required.');
  deadline.setUTCDate(deadline.getUTCDate() - 1);
  return formatDate(adjustDate(deadline, 'previous_working_day', holidayDates, new Set([0, 6])));
}

export function buildDeadlineExplainability(input: DeadlineExplainability): string[] {
  const lines = [
    `Requirement ${input.requirementId} is supported by ${input.requirementSourceIds.length} cited regulatory source(s).`,
    `Rule version ${input.ruleVersionId} was evaluated for ${input.periodOrEvent}.`,
    input.baseStatutoryDeadline
      ? `Base statutory deadline: ${input.baseStatutoryDeadline}.`
      : 'Base statutory deadline: unresolved.',
    input.adjustedStatutoryDeadline
      ? `Adjusted statutory deadline: ${input.adjustedStatutoryDeadline}.`
      : 'Adjusted statutory deadline: unresolved.',
    input.adjustmentExplanation,
  ];
  if (input.tmfPackageTarget) lines.push(`TMF Package Target: ${input.tmfPackageTarget}.`);
  if (input.monthlyCalendarVersion) lines.push(`Monthly calendar release: ${input.monthlyCalendarVersion}.`);
  return lines;
}

export function classifyCoverageIntegrity(input: CoverageIntegrityInput): CoverageIntegrityResult {
  const today = parseDate(input.today);
  const internalTarget = parseDate(input.internalTarget);
  const statutoryDeadline = parseDate(input.statutoryDeadline);
  if (!today) throw new Error('Coverage Integrity requires a valid today date.');

  if (!input.expected) {
    return { stage: 'expected', severity: 'normal', reason: 'No approved expectation is present.' };
  }
  if (!input.generated) {
    const generationDue = internalTarget && today >= internalTarget;
    return generationDue
      ? { stage: 'generated', severity: 'exception', reason: 'Expected work has not been generated by the approved internal target.' }
      : { stage: 'generated', severity: 'normal', reason: 'Expected work is not yet generated, but the approved target has not arrived.' };
  }
  if (!input.executed) {
    if (statutoryDeadline && today > statutoryDeadline && !input.approvedException) {
      return { stage: 'executed', severity: 'statutory_exposure', reason: 'Required execution is incomplete after the statutory deadline.' };
    }
    if (internalTarget && today > internalTarget && !input.approvedException) {
      return { stage: 'executed', severity: 'attention', reason: 'Execution is past the TMF internal target but not necessarily a statutory breach.' };
    }
    return { stage: 'executed', severity: 'normal', reason: 'Generated work remains open before the applicable exposure point.' };
  }
  if (!input.evidenced) {
    if (input.lifecycle === 'filed' || input.lifecycle === 'complete') {
      return { stage: 'evidenced', severity: 'exception', reason: 'Execution is recorded but required evidence is missing.' };
    }
    return { stage: 'evidenced', severity: 'normal', reason: 'Evidence is pending until the relevant execution result exists.' };
  }
  return { stage: 'complete', severity: 'normal', reason: 'Expected work is generated, executed, and evidenced.' };
}

export function validateImpactDecision(record: ImpactDecisionRecord): string[] {
  const errors: string[] = [];
  if (!record.change.objectId) errors.push('Impact decision requires an affected object.');
  if (!record.actorId) errors.push('Impact decision requires an actor.');
  if (!record.decidedAt) errors.push('Impact decision requires a timestamp.');
  if (!record.reason.trim()) errors.push('Impact decision requires a reason.');
  if (record.change.completedWorkIds.length > 0 && ['rebase', 'regenerate'].includes(record.decision)) {
    errors.push('Completed work cannot be silently rebased or regenerated.');
  }
  return errors;
}
