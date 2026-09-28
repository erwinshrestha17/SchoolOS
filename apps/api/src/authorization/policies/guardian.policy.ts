import type { GuardianCapability, Prisma } from '@prisma/client';

/** One live predicate for reads, notifications, files and request projections.
 * Custody restrictions are authoritative status/capability changes with a
 * retained evidence reference, never inferred from a parent's role or phone.
 */
export function buildActiveGuardianRelationshipWhere(
  now = new Date(),
  capability?: GuardianCapability,
): Prisma.StudentGuardianWhereInput {
  return {
    status: 'ACTIVE',
    verificationStatus: 'VERIFIED',
    approvalStatus: 'APPROVED',
    effectiveFrom: { lte: now },
    AND: [
      { OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }] },
      ...(capability ? [{ capabilities: { has: capability } }] : []),
    ],
  };
}
