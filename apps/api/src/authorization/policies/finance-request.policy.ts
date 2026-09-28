import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { AuthContext } from '../../auth/auth.types';
import {
  requireDomainPermission,
  requireIndependentActor,
} from './domain-permission';

export interface FinanceRequestEvidence {
  type: string;
  status: string;
  requestedById: string;
  reviewedById?: string | null;
  approvedById?: string | null;
  policyFingerprint?: string | null;
  sourceFingerprint?: string | null;
  policySnapshot?: unknown;
  requiredApprovalCount?: number;
  decisions?: Array<{ actorUserId: string }>;
}
export type FinanceRequestDuty = 'REVIEW' | 'APPROVE' | 'REJECT' | 'EXECUTE';

export function financeRequestDutyPermission(
  request: Pick<FinanceRequestEvidence, 'type'>,
  duty: FinanceRequestDuty,
) {
  if (duty === 'EXECUTE')
    return request.type === 'REFUND' ? 'payments:refund' : 'payments:reverse';
  return duty === 'REVIEW'
    ? 'finance:approvals:review'
    : 'finance:approvals:decide';
}
export function requireFinanceRequestDuty(
  actor: AuthContext,
  request: FinanceRequestEvidence,
  duty: FinanceRequestDuty,
): void {
  requireDomainPermission(actor, financeRequestDutyPermission(request, duty));
  const statuses = {
    REVIEW: ['PENDING'],
    APPROVE: ['REVIEWED'],
    REJECT: ['PENDING', 'REVIEWED', 'APPROVED'],
    EXECUTE: ['APPROVED', 'EXECUTED'],
  }[duty];
  if (
    !['REFUND', 'REVERSAL'].includes(request.type) ||
    !statuses.includes(request.status)
  )
    throw new ConflictException(
      'The financial request is not available for this action',
    );
  if (!request.requestedById)
    throw new ConflictException('Financial preparation evidence is missing');
  requireIndependentActor(actor, [request.requestedById]);
  if (
    duty !== 'REJECT' &&
    (!request.sourceFingerprint || !request.policyFingerprint)
  )
    throw new ConflictException(
      'Financial source and policy evidence is missing',
    );
  if (duty === 'APPROVE' || duty === 'EXECUTE') {
    if (
      !request.reviewedById ||
      request.reviewedById === request.requestedById ||
      !request.sourceFingerprint ||
      !request.policyFingerprint
    )
      throw new ConflictException(
        'Independent financial review evidence is missing',
      );
  }
  if (duty === 'APPROVE') {
    const snapshot = request.policySnapshot;
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot))
      throw new ConflictException(
        'Financial approval policy evidence is missing',
      );
    const policy = snapshot as Record<string, unknown>;
    const roles = policy.approverRoles;
    const permissions = policy.approverPermissions;
    if (
      !Array.isArray(roles) ||
      roles.some((role) => typeof role !== 'string') ||
      !Array.isArray(permissions) ||
      permissions.some((permission) => typeof permission !== 'string')
    )
      throw new ConflictException(
        'Financial approval policy evidence is invalid',
      );
    if (roles.length && !actor.roles.some((role) => roles.includes(role)))
      throw new ForbiddenException(
        'This user is not designated by the financial approval policy',
      );
    for (const permission of permissions as string[])
      requireDomainPermission(actor, permission);
    requireIndependentActor(actor, [request.reviewedById]);
    if (
      request.decisions?.some(
        (decision) => decision.actorUserId === actor.userId,
      )
    )
      throw new ConflictException('Your approval is already recorded');
  }
  if (duty === 'EXECUTE') {
    const decisions = request.decisions ?? [];
    if (
      !request.approvedById ||
      !decisions.some(
        (decision) => decision.actorUserId === request.approvedById,
      ) ||
      decisions.length < (request.requiredApprovalCount ?? 1) ||
      decisions.some((decision) =>
        [request.requestedById, request.reviewedById].includes(
          decision.actorUserId,
        ),
      )
    )
      throw new ConflictException(
        'Independent financial approval evidence is missing',
      );
    requireIndependentActor(actor, [
      request.reviewedById,
      ...decisions.map((decision) => decision.actorUserId),
    ]);
  }
}
export function financeRequestAllowedActions(
  actor: AuthContext,
  request: FinanceRequestEvidence,
) {
  return Object.fromEntries(
    (['REVIEW', 'APPROVE', 'REJECT', 'EXECUTE'] as const).map((duty) => {
      try {
        requireFinanceRequestDuty(actor, request, duty);
        return [duty.toLowerCase(), true];
      } catch {
        return [duty.toLowerCase(), false];
      }
    }),
  ) as Record<Lowercase<FinanceRequestDuty>, boolean>;
}
