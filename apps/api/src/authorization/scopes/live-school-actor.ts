import { ForbiddenException } from '@nestjs/common';
import type { AuthContext } from '../../auth/auth.types';
import type { PrismaService } from '../../prisma/prisma.service';
import { unrestrictedRoleAssignmentsWhere } from './unrestricted-role-where';
import { isPlatformRoleName } from '@schoolos/core';

/** Queue payloads are audit snapshots, never current permission authority. */
export async function resolveLiveSchoolActor(
  db: PrismaService,
  snapshot: AuthContext,
): Promise<AuthContext> {
  if (
    !snapshot.sessionFamilyId ||
    snapshot.isSupportOverride ||
    snapshot.securityDomain === 'PLATFORM'
  )
    throw new ForbiddenException('Current school authorization is required');
  const user = await db.user.findFirst({
    where: {
      id: snapshot.userId,
      tenantId: snapshot.tenantId,
      status: 'ACTIVE',
      tenant: { isActive: true, securityDomain: 'SCHOOL' },
    },
    select: {
      id: true,
      tenantId: true,
      email: true,
      authMethod: true,
      mustChangePassword: true,
      lockedUntil: true,
      tenant: { select: { slug: true } },
      userRoles: {
        where: unrestrictedRoleAssignmentsWhere(snapshot.tenantId),
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
      },
    },
  });
  if (
    !user ||
    user.mustChangePassword ||
    (user.lockedUntil && user.lockedUntil > new Date()) ||
    !(await db.refreshToken.findFirst({
      where: {
        userId: user.id,
        familyId: snapshot.sessionFamilyId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    }))
  )
    throw new ForbiddenException('Current school authorization is required');
  const grants = user.userRoles.filter(
    ({ role }) => !isPlatformRoleName(role.name),
  );
  return {
    userId: user.id,
    tenantId: user.tenantId,
    tenantSlug: user.tenant.slug,
    email: user.email,
    authMethod: user.authMethod,
    securityDomain: 'SCHOOL',
    sessionFamilyId: snapshot.sessionFamilyId,
    roles: [...new Set(grants.map(({ role }) => role.name))],
    permissions: [
      ...new Set(
        grants.flatMap(({ role }) =>
          role.rolePermissions.map(
            ({ permission }) => `${permission.resource}:${permission.action}`,
          ),
        ),
      ),
    ],
  };
}
