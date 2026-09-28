import { ConflictException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { AuthContext } from '../../auth/auth.types';
import {
  requireDomainPermission,
  requireIndependentActor,
} from './domain-permission';

export type JournalDuty =
  | 'SUBMIT'
  | 'REVIEW'
  | 'APPROVE'
  | 'POST'
  | 'REJECT'
  | 'CANCEL';
const duties = {
  SUBMIT: 'accounting:journals:submit',
  REVIEW: 'accounting:journals:review',
  APPROVE: 'accounting:journals:approve',
  POST: 'accounting:journals:post',
  REJECT: 'accounting:journals:reject',
  CANCEL: 'accounting:journals:cancel',
} as const;
interface JournalEvidence {
  status: string;
  sourceType: string;
  createdById: string | null;
  reviewedById?: string | null;
  approvedById?: string | null;
  approvedSourceFingerprint?: string | null;
}
export function journalDutyPermission(duty: JournalDuty) {
  return duties[duty];
}
export function requireJournalDuty(
  actor: AuthContext,
  journal: JournalEvidence,
  duty: JournalDuty,
): void {
  requireDomainPermission(actor, duties[duty]);
  const expected = {
    SUBMIT: ['DRAFT'],
    REVIEW: ['SUBMITTED'],
    APPROVE: ['REVIEWED'],
    POST: ['APPROVED'],
    REJECT: ['SUBMITTED', 'REVIEWED', 'APPROVED'],
    CANCEL: ['DRAFT'],
  }[duty];
  if (journal.sourceType !== 'MANUAL' || !expected.includes(journal.status))
    throw new ConflictException(
      'This journal is not available for the requested action',
    );
  if (!journal.createdById)
    throw new ConflictException('Journal preparation evidence is missing');
  if (['REVIEW', 'APPROVE', 'POST', 'REJECT'].includes(duty))
    requireIndependentActor(actor, [journal.createdById]);
  if (duty === 'APPROVE' || duty === 'POST') {
    if (!journal.reviewedById || journal.reviewedById === journal.createdById)
      throw new ConflictException(
        'Independent journal review evidence is missing',
      );
  }
  if (duty === 'APPROVE')
    requireIndependentActor(actor, [journal.reviewedById]);
  if (duty === 'POST') {
    if (
      !journal.approvedById ||
      !journal.approvedSourceFingerprint ||
      [journal.createdById, journal.reviewedById].includes(journal.approvedById)
    )
      throw new ConflictException(
        'Independent journal approval evidence is missing',
      );
    requireIndependentActor(actor, [journal.approvedById]);
  }
}
export function journalAllowedActions(
  actor: AuthContext,
  journal: JournalEvidence,
) {
  return Object.fromEntries(
    (Object.keys(duties) as JournalDuty[]).map((duty) => {
      try {
        requireJournalDuty(actor, journal, duty);
        return [duty.toLowerCase(), true];
      } catch {
        return [duty.toLowerCase(), false];
      }
    }),
  ) as Record<Lowercase<JournalDuty>, boolean>;
}
export function journalSourceFingerprint(journal: {
  entryDate: Date;
  narration: string;
  sourceModule?: string | null;
  sourceType: string;
  sourceId?: string | null;
  fiscalYearId?: string | null;
  fiscalPeriodId?: string | null;
  lines: Array<{
    id: string;
    chartAccountId: string;
    side: string;
    amount: { toString(): string };
    debit?: { toString(): string };
    credit?: { toString(): string };
    description?: string | null;
  }>;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        version: 'journal-v1',
        entryDate: journal.entryDate.toISOString(),
        narration: journal.narration,
        sourceModule: journal.sourceModule,
        sourceType: journal.sourceType,
        sourceId: journal.sourceId,
        fiscalYearId: journal.fiscalYearId,
        fiscalPeriodId: journal.fiscalPeriodId,
        lines: [...journal.lines]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((line) => ({
            id: line.id,
            chartAccountId: line.chartAccountId,
            side: line.side,
            amount: line.amount.toString(),
            debit: line.debit?.toString(),
            credit: line.credit?.toString(),
            description: line.description,
          })),
      }),
    )
    .digest('hex');
}
