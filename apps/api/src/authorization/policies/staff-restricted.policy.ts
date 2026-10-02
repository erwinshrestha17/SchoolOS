import { NotFoundException } from '@nestjs/common';
import type { StaffDocumentKind } from '@prisma/client';
import type { AuthContext } from '../../auth/auth.types';
import {
  hasDomainPermission,
  requireDomainPermission,
} from './domain-permission';

/**
 * Phase 7.2 — restricted staff evidence.
 *
 * Generic `hr:documents:*` (or `hr:staff:read`) never reaches medical,
 * disciplinary or safeguarding material: each category has its own explicit,
 * non-delegable permission and is not part of any default role template. The
 * check is applied wherever such a document can surface (list, timeline,
 * lifecycle history, signed file access) so no single path is a bypass.
 */
export const RESTRICTED_STAFF_DOCUMENT_PERMISSIONS: Readonly<
  Partial<Record<StaffDocumentKind, { read: string; manage: string }>>
> = {
  MEDICAL: { read: 'hr:medical:read', manage: 'hr:medical:manage' },
  DISCIPLINARY: {
    read: 'hr:disciplinary:read',
    manage: 'hr:disciplinary:manage',
  },
  SAFEGUARDING: {
    read: 'hr:safeguarding:read',
    manage: 'hr:safeguarding:manage',
  },
};

export function isRestrictedStaffDocumentKind(
  kind: StaffDocumentKind,
): boolean {
  return RESTRICTED_STAFF_DOCUMENT_PERMISSIONS[kind] !== undefined;
}

export function canReadStaffDocumentKind(
  actor: AuthContext,
  kind: StaffDocumentKind,
): boolean {
  const required = RESTRICTED_STAFF_DOCUMENT_PERMISSIONS[kind];
  return (
    hasDomainPermission(actor, 'hr:documents:read') &&
    (!required || hasDomainPermission(actor, required.read))
  );
}

export function canManageStaffDocumentKind(
  actor: AuthContext,
  kind: StaffDocumentKind,
): boolean {
  const required = RESTRICTED_STAFF_DOCUMENT_PERMISSIONS[kind];
  return (
    hasDomainPermission(actor, 'hr:documents:manage') &&
    (!required || hasDomainPermission(actor, required.manage))
  );
}

/** Restricted kinds the actor may NOT read; used as a `kind notIn` filter. */
export function hiddenStaffDocumentKinds(
  actor: AuthContext,
): StaffDocumentKind[] {
  return (
    Object.keys(RESTRICTED_STAFF_DOCUMENT_PERMISSIONS) as StaffDocumentKind[]
  ).filter((kind) => !canReadStaffDocumentKind(actor, kind));
}

/** Writes name the missing permission; the caller already holds the basics. */
export function requireStaffDocumentKindManage(
  actor: AuthContext,
  kind: StaffDocumentKind,
): void {
  const required = RESTRICTED_STAFF_DOCUMENT_PERMISSIONS[kind];
  if (required) requireDomainPermission(actor, required.manage);
}

/**
 * Existence is not confirmed to callers lacking the category permission:
 * a restricted document looks exactly like a missing one.
 */
export function assertStaffDocumentKindVisible(
  actor: AuthContext,
  kind: StaffDocumentKind,
  message = 'Document not found',
): void {
  if (!canReadStaffDocumentKind(actor, kind))
    throw new NotFoundException(message);
}
