import { ConflictException } from '@nestjs/common';
import type { AuthContext } from '../../auth/auth.types';
import {
  requireDomainPermission,
  requireIndependentActor,
} from './domain-permission';

export type ReconciliationDuty =
  | 'MANAGE'
  | 'SUBMIT'
  | 'REVIEW'
  | 'RETURN'
  | 'FINALIZE'
  | 'CANCEL';
const permissions = {
  MANAGE: 'accounting:reconciliation:manage',
  SUBMIT: 'accounting:reconciliation:manage',
  REVIEW: 'accounting:reconciliation:review',
  RETURN: 'accounting:reconciliation:review',
  FINALIZE: 'accounting:reconciliation:finalize',
  CANCEL: 'accounting:reconciliation:manage',
} as const;
export const reconciliationPermission = (duty: ReconciliationDuty) =>
  permissions[duty];
type Evidence = {
  status: string;
  createdById: string;
  submittedById?: string | null;
  reviewedById?: string | null;
  sourceFingerprint?: string | null;
  matches: Array<{ matchedById: string; unmatchedById?: string | null }>;
};
export function requireReconciliationDuty(
  actor: AuthContext,
  session: Evidence,
  duty: ReconciliationDuty,
) {
  requireDomainPermission(actor, permissions[duty]);
  const expected = {
    CANCEL: ['OPEN', 'REOPENED'],
    MANAGE: ['OPEN', 'REOPENED'],
    SUBMIT: ['OPEN', 'REOPENED'],
    REVIEW: ['SUBMITTED'],
    RETURN: ['SUBMITTED', 'REVIEWED'],
    FINALIZE: ['REVIEWED'],
  }[duty];
  if (!expected.includes(session.status))
    throw new ConflictException(
      'Reconciliation is not available for this action',
    );
  const preparers = [
    session.createdById,
    session.submittedById,
    ...session.matches.flatMap((match) => [
      match.matchedById,
      match.unmatchedById,
    ]),
  ];
  if (['REVIEW', 'RETURN', 'FINALIZE'].includes(duty))
    requireIndependentActor(actor, preparers);
  if (duty === 'REVIEW' || duty === 'FINALIZE') {
    if (!session.submittedById || !session.sourceFingerprint)
      throw new ConflictException(
        'Reconciliation submission evidence is missing',
      );
  }
  if (duty === 'FINALIZE') {
    if (!session.reviewedById || preparers.includes(session.reviewedById))
      throw new ConflictException(
        'Independent reconciliation review evidence is missing',
      );
    requireIndependentActor(actor, [session.reviewedById]);
  }
}
export function reconciliationAllowedActions(
  actor: AuthContext,
  session: Evidence,
) {
  return Object.fromEntries(
    (Object.keys(permissions) as ReconciliationDuty[]).map((duty) => {
      try {
        requireReconciliationDuty(actor, session, duty);
        return [duty.toLowerCase(), true];
      } catch {
        return [duty.toLowerCase(), false];
      }
    }),
  ) as Record<Lowercase<ReconciliationDuty>, boolean>;
}
