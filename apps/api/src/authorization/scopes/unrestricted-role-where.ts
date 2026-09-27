import type { Prisma } from '@prisma/client';

/** Older role-only/flat consumers must never flatten restricted or stale grants. */
export function unrestrictedRoleAssignmentsWhere(
  tenantId: string,
  now = new Date(),
): Prisma.UserRoleWhereInput {
  return {
    tenantId,
    role: { tenantId },
    revokedAt: null,
    assignedAt: { lte: now },
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    scopeGrants: {
      some: {
        tenantId,
        scopeType: 'TENANT',
        supersededAt: null,
        scopeId: tenantId,
        revokedAt: null,
        effectiveFrom: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    },
  };
}
