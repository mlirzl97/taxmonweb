import { describe, expect, it } from 'vitest';
import {
  calculateDeadline,
  calculateInternalTarget,
  buildDeadlineExplainability,
  classifyCoverageIntegrity,
  validateImpactDecision,
  type DeadlinePolicyVersion,
} from './tax-foundation';
import { validateCalendarEntryImport, validateRequirementImport } from './tax-foundation-import';
import { canUseAuthoritatively, comparePublishedDeadline, validateMonthlyCalendarRelease } from './monthly-calendar';

const policy: DeadlinePolicyVersion = {
  id: 'policy-test-days-after-period-end',
  strategy: 'days_after_period_end',
  effectiveFrom: '2026-01-01',
  adjustment: 'none',
  parameters: { days_after_period_end: 15 },
  verificationStatus: 'partially_verified',
  sources: [{ sourceId: 'source-test' }],
};

describe('tax foundation deadline calculations', () => {
  it('calculates a typed statutory date without embedding tax content', () => {
    const result = calculateDeadline({ policy, periodEnd: '2026-09-30' });
    expect(result.baseStatutoryDeadline).toBe('2026-10-15');
    expect(result.adjustedStatutoryDeadline).toBe('2026-10-15');
    expect(result.verificationStatus).toBe('partially_verified');
  });

  it('supports an explicit working-day strategy without inventing an adjustment', () => {
    const result = calculateDeadline({
      policy: {
        ...policy,
        strategy: 'working_day_adjustment',
        adjustment: 'next_working_day',
      },
      baseDate: '2026-10-10',
      holidayDates: new Set(['2026-10-12']),
    });
    expect(result.baseStatutoryDeadline).toBe('2026-10-10');
    expect(result.adjustedStatutoryDeadline).toBe('2026-10-13');
  });

  it('rejects impossible calendar dates instead of normalizing them', () => {
    const result = calculateDeadline({
      policy: { ...policy, strategy: 'fixed_date' },
      baseDate: '2026-02-30',
    });
    expect(result.adjustedStatutoryDeadline).toBeNull();
    expect(result.unresolvedReason).toBe('required_deadline_configuration_missing_or_unresolved');
  });

  it('applies an approved working-day adjustment only when configured', () => {
    const adjusted = calculateDeadline({
      policy: { ...policy, adjustment: 'next_working_day' },
      periodEnd: '2026-09-15',
      holidayDates: new Set(['2026-10-01']),
    });
    expect(adjusted.baseStatutoryDeadline).toBe('2026-09-30');
    expect(adjusted.adjustedStatutoryDeadline).toBe('2026-09-30');

    const weekend = calculateDeadline({
      policy: { ...policy, adjustment: 'next_working_day' },
      periodEnd: '2026-09-16',
    });
    expect(weekend.baseStatutoryDeadline).toBe('2026-10-01');
    expect(weekend.adjustedStatutoryDeadline).toBe('2026-10-01');
  });

  it('does not fabricate an answer for unresolved configuration', () => {
    const result = calculateDeadline({
      policy: { ...policy, verificationStatus: 'unresolved' },
      periodEnd: '2026-09-30',
    });
    expect(result.adjustedStatutoryDeadline).toBeNull();
    expect(result.unresolvedReason).toBe('required_deadline_configuration_missing_or_unresolved');
  });

  it('calculates the TMF internal target separately from a statutory date', () => {
    expect(calculateInternalTarget('2026-10-12')).toBe('2026-10-11');
    expect(calculateInternalTarget('2026-10-13', new Set(['2026-10-12']))).toBe('2026-10-12');
  });
});

describe('coverage integrity', () => {
  it('does not call ordinary future work an exception before its target', () => {
    expect(classifyCoverageIntegrity({
      expected: true,
      generated: true,
      executed: false,
      evidenced: false,
      today: '2026-10-01',
      internalTarget: '2026-10-10',
      statutoryDeadline: '2026-10-15',
      lifecycle: 'open',
      legalSignificance: 'ordinary',
    }).severity).toBe('normal');
  });

  it('distinguishes internal-target attention from statutory exposure', () => {
    const internal = classifyCoverageIntegrity({
      expected: true, generated: true, executed: false, evidenced: false,
      today: '2026-10-11', internalTarget: '2026-10-10', statutoryDeadline: '2026-10-15',
      lifecycle: 'open', legalSignificance: 'ordinary',
    });
    expect(internal.severity).toBe('attention');

    const statutory = classifyCoverageIntegrity({
      expected: true, generated: true, executed: false, evidenced: false,
      today: '2026-10-16', internalTarget: '2026-10-10', statutoryDeadline: '2026-10-15',
      lifecycle: 'open', legalSignificance: 'material',
    });
    expect(statutory.severity).toBe('statutory_exposure');
  });

  it('flags filed work without required evidence as a control exception', () => {
    const result = classifyCoverageIntegrity({
      expected: true, generated: true, executed: true, evidenced: false,
      today: '2026-10-10', statutoryDeadline: '2026-10-15',
      lifecycle: 'filed', legalSignificance: 'ordinary',
    });
    expect(result.severity).toBe('exception');
  });
});

describe('impact decisions', () => {
  it('requires an auditable reason and protects completed work', () => {
    const errors = validateImpactDecision({
      change: {
        objectType: 'rule', objectId: 'rule-1', workIds: ['work-1'],
        completedWorkIds: ['work-1'], openWorkIds: [], oldContext: {}, proposedContext: {},
      },
      decision: 'regenerate', actorId: 'user-1', decidedAt: '2026-10-05T00:00:00Z', reason: 'Rule correction',
    });
    expect(errors).toContain('Completed work cannot be silently rebased or regenerated.');

    expect(validateImpactDecision({
      change: {
        objectType: 'profile', objectId: 'profile-1', workIds: ['work-1'],
        completedWorkIds: ['work-1'], openWorkIds: [], oldContext: {}, proposedContext: {},
      },
      decision: 'rebase', actorId: 'user-1', decidedAt: '2026-10-05T00:00:00Z', reason: 'Profile correction',
    })).toContain('Completed work cannot be silently rebased or regenerated.');
  });
});

describe('source-backed imports', () => {
  it('rejects a verified requirement without provenance/effectivity', () => {
    expect(validateRequirementImport({
      requirementCode: 'REQ-1', requirementName: 'Sourced requirement',
      verificationStatus: 'verified', sourceIds: [],
    })).toEqual([
      'At least one regulatory source is required.',
      'A verified requirement needs an effective-from date.',
    ]);
  });

  it('keeps an unmapped calendar row explicit instead of fabricating a requirement', () => {
    expect(validateCalendarEntryImport({
      externalRequirementLabel: 'Published calendar row',
      validationStatus: 'unmapped_review_required',
      sourceId: 'BIR-RMC-110-2025',
    })).toEqual([]);
  });

  it('requires both dates before a calendar row can be marked matched', () => {
    expect(validateCalendarEntryImport({
      externalRequirementLabel: 'Mapped row',
      requirementId: 'req-1',
      validationStatus: 'match',
      sourceId: 'calendar-source',
      baseStatutoryDeadline: '2026-10-15',
    })).toContain('A matched calendar entry requires both statutory dates.');
  });
});

describe('monthly calendar governance', () => {
  it('reconciles matching dates without requiring row-by-row clerical approval', () => {
    expect(comparePublishedDeadline({
      generatedBaseDate: '2026-10-15', generatedAdjustedDate: '2026-10-15',
      publishedBaseDate: '2026-10-15', publishedAdjustedDate: '2026-10-15',
    })).toBe('match');
  });

  it('keeps an unexplained difference unresolved', () => {
    expect(comparePublishedDeadline({
      generatedBaseDate: '2026-10-15', generatedAdjustedDate: '2026-10-15',
      publishedBaseDate: '2026-10-14', publishedAdjustedDate: '2026-10-14',
    })).toBe('unresolved_mismatch');
  });

  it('requires maker-checker approval before authoritative release', () => {
    const release = {
      month: '2026-10', version: 1, status: 'released' as const,
      preparedBy: 'tax-team-1', approvedBy: 'tax-lead-1',
      approvedAt: '2026-10-01T01:00:00Z', releasedAt: '2026-10-01T02:00:00Z',
      partialRelease: true, unresolvedRowCount: 1,
    };
    expect(validateMonthlyCalendarRelease(release)).toEqual([]);
    expect(canUseAuthoritatively(release)).toBe(true);
    expect(validateMonthlyCalendarRelease({ ...release, approvedBy: 'tax-team-1' })).toContain('Calendar preparer and approver must be distinct.');
  });
});

describe('fictional golden tax scenarios', () => {
  it('supports a calendar-year quarterly period with a component/package target', () => {
    const result = calculateDeadline({
      policy: { ...policy, id: 'TEST-VAT-Q-DEADLINE', parameters: { days_after_period_end: 25 } },
      periodEnd: '2026-09-30',
    });
    const packageTarget = calculateInternalTarget(result.adjustedStatutoryDeadline ?? '2026-10-25');
    expect(result.baseStatutoryDeadline).toBe('2026-10-25');
    expect(packageTarget).toBe('2026-10-24');
  });

  it('supports a fiscal-year period crossing calendar years without changing cadence semantics', () => {
    const result = calculateDeadline({
      policy: { ...policy, id: 'TEST-FISCAL-ANNUAL', strategy: 'days_after_period_end', parameters: { days_after_period_end: 90 } },
      periodEnd: '2026-06-30',
    });
    expect(result.baseStatutoryDeadline).toBe('2026-09-28');
  });

  it('keeps a holiday and a deadline-adjustment rule separate', () => {
    const result = calculateDeadline({
      policy: { ...policy, id: 'TEST-HOLIDAY-ADJUSTMENT', parameters: { days_after_period_end: 3 }, adjustment: 'next_working_day' },
      periodEnd: '2026-09-25',
      holidayDates: new Set(['2026-09-28']),
    });
    expect(result.baseStatutoryDeadline).toBe('2026-09-28');
    expect(result.adjustedStatutoryDeadline).toBe('2026-09-29');
  });

  it('proves the explainability chain for a fictional requirement', () => {
    expect(buildDeadlineExplainability({
      requirementId: 'TEST-COMPONENT-PACKAGE',
      requirementSourceIds: ['TEST-AUTHORITY-1'],
      ruleVersionId: 'TEST-RULE-V1',
      periodOrEvent: 'Q3 2026',
      baseStatutoryDeadline: '2026-10-25',
      adjustedStatutoryDeadline: '2026-10-26',
      adjustmentExplanation: 'Test-only approved adjustment for a source-backed calendar context.',
      tmfPackageTarget: '2026-10-23',
      monthlyCalendarVersion: '2026-10 v1',
    })).toEqual([
      'Requirement TEST-COMPONENT-PACKAGE is supported by 1 cited regulatory source(s).',
      'Rule version TEST-RULE-V1 was evaluated for Q3 2026.',
      'Base statutory deadline: 2026-10-25.',
      'Adjusted statutory deadline: 2026-10-26.',
      'Test-only approved adjustment for a source-backed calendar context.',
      'TMF Package Target: 2026-10-23.',
      'Monthly calendar release: 2026-10 v1.',
    ]);
  });
});
