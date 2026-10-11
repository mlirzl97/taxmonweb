import type { VerificationStatus } from './tax-foundation';

export interface RequirementMasterImport {
  requirementCode: string;
  requirementName: string;
  verificationStatus: VerificationStatus;
  sourceIds: string[];
  effectiveFrom?: string;
}

export interface CalendarEntryImport {
  externalRequirementLabel: string;
  requirementId?: string;
  validationStatus: 'match' | 'mismatch_review_required' | 'unresolved' | 'unmapped_review_required';
  sourceId?: string;
  baseStatutoryDeadline?: string;
  adjustedStatutoryDeadline?: string;
}

export function validateRequirementImport(record: RequirementMasterImport): string[] {
  const errors: string[] = [];
  if (!record.requirementCode.trim()) errors.push('Requirement code is required.');
  if (!record.requirementName.trim()) errors.push('Requirement name is required.');
  if (record.sourceIds.length === 0) errors.push('At least one regulatory source is required.');
  if (record.verificationStatus === 'verified' && !record.effectiveFrom) {
    errors.push('A verified requirement needs an effective-from date.');
  }
  return errors;
}

export function validateCalendarEntryImport(record: CalendarEntryImport): string[] {
  const errors: string[] = [];
  if (!record.externalRequirementLabel.trim()) errors.push('Calendar entry label is required.');
  if (!record.sourceId) errors.push('Calendar entry requires a regulatory source.');
  if (!record.requirementId && record.validationStatus !== 'unmapped_review_required') {
    errors.push('An entry without a Requirement ID must be marked unmapped review required.');
  }
  if (record.validationStatus === 'match' && (!record.baseStatutoryDeadline || !record.adjustedStatutoryDeadline)) {
    errors.push('A matched calendar entry requires both statutory dates.');
  }
  return errors;
}

