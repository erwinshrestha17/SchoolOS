import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { SecurityDomain, UserStatus, type Prisma } from '@prisma/client';
import { hasEffectivePermission, isPlatformRoleName } from '@schoolos/core';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthContext } from './auth.types';
import { lockAuthTenant, lockAuthUsers } from './auth-account-locks';

/**
 * Role/status governance takes the tenant write lock before any user lock.
 * Authentication/reset uses the shared tenant lock, so a governance decision
 * cannot interleave with an already-authorized credential transaction.
 * This coordinates participating writers, not arbitrary SQL or provisioning.
 */
export async function withSchoolAuthorizationTransaction<T>(
  prisma: PrismaService,
  actor: AuthContext,
  permission: string,
  targetUserIds: string[],
  work: (tx: Prisma.TransactionClient, locked: Set<string>) => Promise<T>,
  exclusive = false,
): Promise<T> {
  if (
    actor.securityDomain === SecurityDomain.PLATFORM ||
    actor.isSupportOverride
  )
    throw new ForbiddenException(
      'School account security cannot be changed through Platform support access',
    );
  return prisma.runWithTenantScope(actor.tenantId, () =>
    prisma.$transaction(
      async (tx) => {
        if (exclusive) {
          const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Tenant" WHERE "id" = ${actor.tenantId} AND "isActive" = true FOR UPDATE
      `;
          if (rows.length !== 1)
            throw new UnauthorizedException('Invalid authentication context');
        } else if (!(await lockAuthTenant(tx, actor.tenantId))) {
          throw new UnauthorizedException('Invalid authentication context');
        }
        const tenant = await tx.tenant.findUnique({
          where: { id: actor.tenantId },
          select: { securityDomain: true },
        });
        if (tenant?.securityDomain !== SecurityDomain.SCHOOL)
          throw new ForbiddenException(
            'School account security requires a school tenant',
          );
        const locked = await lockAuthUsers(tx, actor.tenantId, [
          actor.userId,
          ...targetUserIds,
        ]);
        if (!locked.has(actor.userId))
          throw new UnauthorizedException('Invalid authentication context');
        const currentActor = await tx.user.findUnique({
          where: { id: actor.userId, tenantId: actor.tenantId },
          select: { status: true, lockedUntil: true, mustChangePassword: true },
        });
        if (
          currentActor?.status !== UserStatus.ACTIVE ||
          (currentActor.lockedUntil && currentActor.lockedUntil > new Date())
        )
          throw new UnauthorizedException('User is not active');
        if (currentActor.mustChangePassword)
          throw new ForbiddenException(
            'Password change required before accessing this resource',
          );
        if (
          !actor.sessionFamilyId ||
          !(await tx.refreshToken.findFirst({
            where: {
              userId: actor.userId,
              familyId: actor.sessionFamilyId,
              revokedAt: null,
              expiresAt: { gt: new Date() },
            },
            select: { id: true },
          }))
        )
          throw new UnauthorizedException('Session has ended');
        const grants = await tx.userRole.findMany({
          where: {
            tenantId: actor.tenantId,
            userId: actor.userId,
            revokedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            role: { tenantId: actor.tenantId },
          },
          select: {
            role: {
              select: {
                name: true,
                rolePermissions: {
                  select: {
                    permission: { select: { resource: true, action: true } },
                  },
                },
              },
            },
          },
        });
        const permissions = grants.flatMap(({ role }) =>
          role.rolePermissions.map(
            ({ permission: grant }) => `${grant.resource}:${grant.action}`,
          ),
        );
        if (
          grants.some(({ role }) => isPlatformRoleName(role.name)) ||
          !hasEffectivePermission(permissions, permission)
        )
          throw new ForbiddenException('Insufficient permissions');
        return work(tx, locked);
      },
      { timeout: 10000 },
    ),
  );
}
