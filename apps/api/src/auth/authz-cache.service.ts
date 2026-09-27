import { Injectable } from '@nestjs/common';
import { isPlatformRoleName } from '@schoolos/core';
import type { SecurityDomain } from '@prisma/client';
import { grantAllows } from '../authorization/scopes/scope-resolver';
import { scopeTargetExists } from '../authorization/scopes/scope-target';
import type {
  RoleAccessGrant,
  ScopeGrant,
} from '../authorization/scopes/scope.types';
import { RedisCacheService } from '../common/cache/redis-cache.service';
import { PrismaService } from '../prisma/prisma.service';

export interface ResolvedAuthz {
  roles: string[];
  permissions: string[];
  accessGrants?: readonly RoleAccessGrant[];
}

interface CachedRoleGrant {
  assignmentId: string;
  assignedAt: string;
  scopes: ScopeGrant[];
  role: string;
  scopeId: string | null;
  expiresAt: string | null;
  permissions: string[];
}

interface CachedAuthz {
  grants: CachedRoleGrant[];
}

/**
 * Resolves a user's role and permission set from authoritative storage.
 *
 * ## Why
 *
 * Authorization revocation must fail closed. Redis invalidation is best-effort
 * in the shared cache service, so a cached grant could otherwise survive a
 * failed DEL and authorize writes after revocation. Until a database-backed
 * version/fencing contract exists, every effective grant is resolved live.
 *
 * ## What is and is not cached here
 *
 * The caller also reads `User.status` and `Tenant.isActive` live on every
 * request. Redis invalidation methods remain for compatibility and cleanup,
 * but cache state is never consulted for an authorization decision.
 *
 * ## Invalidation contract
 *
 * Every site that mutates role membership or role permissions must call
 * {@link invalidateUser} or {@link invalidateTenant}. As of this change the
 * complete set is:
 *
 * ```text
 * src/roles/roles.service.ts  createRole            -> invalidateTenant
 *                             setRolePermissions    -> invalidateTenant
 *                             assignUserRoles       -> invalidateUser
 * src/tenants/tenants.service.ts  provisioning      -> no live sessions exist yet
 * ```
 *
 * If a new write path is added, it must be added here too. The TTL limits the
 * damage of forgetting; it does not excuse it.
 */
@Injectable()
export class AuthzCacheService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: RedisCacheService,
  ) {}

  private key(tenantId: string, userId: string) {
    return `authz:v2:${tenantId}:${userId}`;
  }

  /** Roles and `resource:action` permission keys for one user in one tenant. */
  async resolve(
    tenantId: string,
    userId: string,
    securityDomain: SecurityDomain = 'SCHOOL',
  ): Promise<ResolvedAuthz> {
    const cached = await this.load(tenantId, userId);

    // Expiry is evaluated on every request rather than only on cache fill. A
    // time-bounded auditor therefore loses access at the exact expiry even if
    // the Redis entry remains warm.
    const now = Date.now();
    const active = cached.grants.filter(
      ({ role, scopeId, expiresAt, assignedAt }) =>
        (securityDomain === 'PLATFORM'
          ? isPlatformRoleName(role) && scopeId === 'global'
          : !isPlatformRoleName(role)) &&
        (expiresAt === null || Date.parse(expiresAt) > now) &&
        Date.parse(assignedAt) <= now,
    );

    const accessGrants: RoleAccessGrant[] = active.map((g) => ({
      assignmentId: g.assignmentId,
      tenantId,
      role: g.role,
      permissions: g.permissions,
      scopes: g.scopes,
    }));
    return {
      roles: [
        ...new Set(
          active
            .filter((g) => securityDomain === 'PLATFORM' || g.scopes.length > 0)
            .map(({ role }) => role),
        ),
      ],
      permissions: [
        ...new Set(
          accessGrants.flatMap((g) =>
            g.permissions.filter(
              (permission) =>
                securityDomain === 'PLATFORM' ||
                grantAllows(g, permission, tenantId),
            ),
          ),
        ),
      ],
      ...(securityDomain === 'SCHOOL' ? { accessGrants } : {}),
    };
  }

  private async load(tenantId: string, userId: string): Promise<CachedAuthz> {
    // This runs inside JwtAuthGuard, i.e. before the CLS tenant context exists
    // — establishing it is what the guard is in the middle of doing. `UserRole`
    // is tenant-scoped, so without an explicit bypass the fail-closed extension
    // would reject the query. The bypass is safe here precisely because
    // `tenantId` is filtered explicitly in every `where` below, which is the
    // same predicate the extension would have injected.
    return this.prisma.runWithoutTenantScope(
      'authorize: resolve role/permission set while establishing tenant context',
      async () => {
        const assignments = await this.prisma.userRole.findMany({
          where: {
            tenantId,
            userId,
            revokedAt: null,
            role: { tenantId },
          },
          select: {
            id: true,
            assignedAt: true,
            scopeGrants: {
              where: { tenantId, supersededAt: null },
              select: {
                scopeType: true,
                scopeId: true,
                effectiveFrom: true,
                expiresAt: true,
                revokedAt: true,
              },
            },
            scopeId: true,
            expiresAt: true,
            role: {
              select: {
                name: true,
                rolePermissions: {
                  select: {
                    permission: {
                      select: { resource: true, action: true },
                    },
                  },
                },
              },
            },
          },
        });

        const grants: CachedRoleGrant[] = [];
        for (const assignment of assignments) {
          const scopes = assignment.scopeGrants ?? [];
          // Deleted, inactive and foreign targets invalidate the entire assignment.
          // Do not drop a restrictive dimension and retain a broader one.
          const valid = await Promise.all(
            scopes.map((scope) =>
              scopeTargetExists(
                this.prisma,
                tenantId,
                scope.scopeType,
                scope.scopeId,
              ),
            ),
          );
          grants.push({
            assignmentId: assignment.id,
            assignedAt: assignment.assignedAt.toISOString(),
            role: assignment.role.name,
            scopeId: assignment.scopeId,
            expiresAt: assignment.expiresAt?.toISOString() ?? null,
            scopes: valid.every(Boolean) ? scopes : [],
            permissions: assignment.role.rolePermissions.map(
              ({ permission }) => `${permission.resource}:${permission.action}`,
            ),
          });
        }
        return { grants };
      },
    );
  }

  /** Call after changing which roles a specific user holds. */
  async invalidateUser(tenantId: string, userId: string): Promise<void> {
    await this.cache.invalidate(this.key(tenantId, userId));
  }

  /**
   * Call after changing a role's permissions or creating/deleting a role —
   * that can change the effective permissions of every user in the tenant, so
   * the whole tenant namespace is dropped.
   */
  async invalidateTenant(tenantId: string): Promise<void> {
    await this.cache.invalidatePrefix(`authz:v2:${tenantId}:`);
  }
}
