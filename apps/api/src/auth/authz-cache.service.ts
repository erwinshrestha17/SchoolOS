import { Injectable } from '@nestjs/common';
import { RedisCacheService } from '../common/cache/redis-cache.service';
import { PrismaService } from '../prisma/prisma.service';

export interface ResolvedAuthz {
  roles: string[];
  permissions: string[];
}

/**
 * TTL is a backstop for a missed invalidation, not the invalidation mechanism.
 * Five minutes bounds how long a stale permission set could survive if a write
 * site is ever added without calling {@link AuthzCacheService.invalidateUser}.
 */
const AUTHZ_TTL_SECONDS = 300;

/**
 * Resolves a user's role and permission set, cached across requests.
 *
 * ## Why
 *
 * `JwtAuthGuard` rebuilt this on every request through a four-level nested
 * `include` (`UserRole → Role → RolePermission → Permission`). Prisma emits one
 * round-trip per relation, so that was four database queries on **every
 * authenticated request across all 1,345 routes** — to reproduce a string array
 * that only changes when an administrator edits a role.
 *
 * ## What is and is not cached here
 *
 * Only the derived role/permission set. The caller still reads `User.status`
 * and `Tenant.isActive` live on every request, so deactivating a user or
 * suspending a tenant still fails closed immediately. This cache can only ever
 * be stale about *which permissions a still-active user holds*, and every write
 * that changes that is enumerated below.
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
    return `authz:${tenantId}:${userId}`;
  }

  /** Roles and `resource:action` permission keys for one user in one tenant. */
  async resolve(tenantId: string, userId: string): Promise<ResolvedAuthz> {
    return this.cache.resolve(
      this.key(tenantId, userId),
      AUTHZ_TTL_SECONDS,
      () => this.load(tenantId, userId),
    );
  }

  private async load(tenantId: string, userId: string): Promise<ResolvedAuthz> {
    // This runs inside JwtAuthGuard, i.e. before the CLS tenant context exists
    // — establishing it is what the guard is in the middle of doing. `UserRole`
    // is tenant-scoped, so without an explicit bypass the fail-closed extension
    // would reject the query. The bypass is safe here precisely because
    // `tenantId` is filtered explicitly in every `where` below, which is the
    // same predicate the extension would have injected.
    return this.prisma.runWithoutTenantScope(
      'authorize: resolve role/permission set while establishing tenant context',
      async () => {
        // Reads `RolePermission` directly instead of descending
        // User → UserRole → Role → RolePermission → Permission. Same rows, same
        // tenant predicate, but two round-trips instead of four.
        const [assignments, rolePermissions] = await Promise.all([
          this.prisma.userRole.findMany({
            where: { tenantId, userId },
            select: { role: { select: { name: true } } },
          }),
          this.prisma.rolePermission.findMany({
            where: {
              role: {
                tenantId,
                userRoles: { some: { tenantId, userId } },
              },
            },
            select: {
              permission: { select: { resource: true, action: true } },
            },
          }),
        ]);

        return {
          roles: [...new Set(assignments.map((entry) => entry.role.name))],
          permissions: [
            ...new Set(
              rolePermissions.map(
                ({ permission }) =>
                  `${permission.resource}:${permission.action}`,
              ),
            ),
          ],
        };
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
    await this.cache.invalidatePrefix(`authz:${tenantId}:`);
  }
}
