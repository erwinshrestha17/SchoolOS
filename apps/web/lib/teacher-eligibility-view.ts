import {
  formatBsDate,
  TEACHER_EVIDENCE_STATUS_LABELS,
  teacherBlockingChangeLabel,
  teacherEligibilityReasonLabel,
  type StatusTone,
  type TeacherBlockingChange,
  type TeacherEligibilityState,
  type TeacherEligibilityWorkspaceItem,
  type TeacherEvidenceRequirementStatus,
} from '@schoolos/core';
import type { EligibilityWorkspaceQuery } from './api/professional-identity';

/**
 * Phase 7.10: pure presentation helpers for the HR teacher-eligibility
 * workspace. The server decides eligibility; nothing here computes it. These
 * only choose labels, tones and request parameters.
 */

export const DEFAULT_HORIZON_DAYS = 30;
export const HORIZON_OPTIONS = [7, 14, 30, 60, 90, 180] as const;
export const WORKSPACE_PAGE_SIZE = 25;
/** Mirrors the API's population cap; used only for the truncation notice. */
export const WORKSPACE_POPULATION_LIMIT = 2000;

export type WorkspaceStateFilter = TeacherEligibilityState | 'ALL';

export const STATE_FILTERS: ReadonlyArray<{
  value: WorkspaceStateFilter;
  label: string;
}> = [
  { value: 'ALL', label: 'All teachers' },
  { value: 'INELIGIBLE', label: 'Ineligible' },
  { value: 'NEEDS_REVIEW', label: 'Needs review' },
  { value: 'ELIGIBLE', label: 'Eligible' },
];

export function eligibilityStateTone(
  state: TeacherEligibilityState,
): StatusTone {
  if (state === 'ELIGIBLE') return 'approved';
  if (state === 'NEEDS_REVIEW') return 'pending';
  return 'rejected';
}

export function evidenceStatusTone(
  status: TeacherEvidenceRequirementStatus,
): StatusTone {
  if (status === 'MATCHED') return 'approved';
  if (status === 'PENDING_REVIEW' || status === 'NOT_YET_VALID')
    return 'pending';
  return 'rejected';
}

export function evidenceStatusLabel(
  status: TeacherEvidenceRequirementStatus | null,
): string {
  return status ? TEACHER_EVIDENCE_STATUS_LABELS[status] : 'Not required';
}

/** Clamp a free-form horizon value to the server's 1–180 day range. */
export function parseHorizonDays(value: string | number | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_HORIZON_DAYS;
  return Math.min(180, Math.max(1, Math.trunc(parsed)));
}

export function buildWorkspaceQuery(input: {
  status: WorkspaceStateFilter;
  atRiskOnly: boolean;
  search: string;
  horizonDays: number;
  page: number;
}): EligibilityWorkspaceQuery {
  return {
    ...(input.status !== 'ALL' ? { status: input.status } : {}),
    ...(input.atRiskOnly ? { atRiskOnly: true } : {}),
    ...(input.search.trim() ? { search: input.search.trim() } : {}),
    horizonDays: parseHorizonDays(input.horizonDays),
    page: Math.max(1, Math.trunc(input.page)),
    limit: WORKSPACE_PAGE_SIZE,
  };
}

/** "Licence expires on 2083-06-18 BS (2026-10-04)". Always BS first. */
export function blockingChangeSentence(change: TeacherBlockingChange): string {
  const label = teacherBlockingChangeLabel(change);
  const gregorian = change.at.slice(0, 10);
  return `${label} on ${formatBsDate(change.at)} (${gregorian})`;
}

export function primaryReasonLabel(
  item: Pick<TeacherEligibilityWorkspaceItem, 'primaryReasonCode'>,
): string {
  return teacherEligibilityReasonLabel(item.primaryReasonCode);
}

export function assignmentSummary(
  item: Pick<TeacherEligibilityWorkspaceItem, 'assignments'>,
): string {
  const { current, passing, needsReview, failing, upcoming } = item.assignments;
  if (current === 0)
    return upcoming > 0
      ? `No current assignment · ${upcoming} upcoming`
      : 'No current assignment';
  const parts = [`${passing} of ${current} pass`];
  if (needsReview > 0) parts.push(`${needsReview} need review`);
  if (failing > 0) parts.push(`${failing} fail`);
  if (upcoming > 0) parts.push(`${upcoming} upcoming`);
  return parts.join(' · ');
}
