export type CalendarReleaseStatus = 'draft' | 'under_review' | 'approved' | 'released' | 'superseded';

export type CalendarComparisonStatus =
  | 'match'
  | 'explained_difference'
  | 'unresolved_mismatch'
  | 'not_comparable'
  | 'unmapped_review_required';

export interface CalendarRowComparison {
  generatedBaseDate?: string;
  generatedAdjustedDate?: string;
  publishedBaseDate?: string;
  publishedAdjustedDate?: string;
  explanation?: string;
  status?: CalendarComparisonStatus;
}

export interface MonthlyCalendarRelease {
  month: string;
  version: number;
  status: CalendarReleaseStatus;
  preparedBy?: string;
  approvedBy?: string;
  preparedAt?: string;
  approvedAt?: string;
  releasedAt?: string;
  partialRelease: boolean;
  unresolvedRowCount: number;
}

export function comparePublishedDeadline(row: CalendarRowComparison): CalendarComparisonStatus {
  if (!row.generatedBaseDate || !row.publishedBaseDate) return 'not_comparable';
  if (!row.generatedAdjustedDate || !row.publishedAdjustedDate) return 'not_comparable';
  if (row.generatedBaseDate === row.publishedBaseDate && row.generatedAdjustedDate === row.publishedAdjustedDate) {
    return 'match';
  }
  return row.explanation?.trim() ? 'explained_difference' : 'unresolved_mismatch';
}

export function validateMonthlyCalendarRelease(release: MonthlyCalendarRelease): string[] {
  const errors: string[] = [];
  if (!/^\d{4}-\d{2}$/.test(release.month)) errors.push('Calendar release month must be YYYY-MM.');
  if (release.version < 1) errors.push('Calendar release version must be positive.');
  if (release.status === 'approved' || release.status === 'released') {
    if (!release.preparedBy) errors.push('Calendar release requires a preparer.');
    if (!release.approvedBy) errors.push('Calendar release requires an approver.');
    if (release.preparedBy && release.preparedBy === release.approvedBy) {
      errors.push('Calendar preparer and approver must be distinct.');
    }
    if (!release.approvedAt) errors.push('Approved calendar release requires an approval timestamp.');
  }
  if (release.status === 'released' && !release.releasedAt) errors.push('Released calendar requires a release timestamp.');
  if (release.unresolvedRowCount > 0 && !release.partialRelease) {
    errors.push('Unresolved rows require explicit partial-release handling or resolution before release.');
  }
  return errors;
}

export function canUseAuthoritatively(release: MonthlyCalendarRelease): boolean {
  return release.status === 'released' && validateMonthlyCalendarRelease(release).length === 0;
}
