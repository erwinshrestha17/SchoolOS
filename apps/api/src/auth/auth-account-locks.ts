import type { Prisma } from '@prisma/client';

/** Acquire before user locks. Locks coordinate mutations; they do not authorize them. */
export async function lockAuthTenant(
  tx: Prisma.TransactionClient,
  tenantId: string,
  allowInactive = false,
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Tenant"
    WHERE "id" = ${tenantId} AND ("isActive" = true OR ${allowInactive}) FOR SHARE
  `;
  return rows.length === 1;
}

/** Sorted actor/target locks also serialize reciprocal administrative operations. */
export async function lockAuthUsers(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userIds: string[],
) {
  const locked = new Set<string>();
  for (const userId of [...new Set(userIds)].sort()) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "User" WHERE "id" = ${userId} AND "tenantId" = ${tenantId} FOR UPDATE
    `;
    if (rows.length === 1) locked.add(userId);
  }
  return locked;
}
