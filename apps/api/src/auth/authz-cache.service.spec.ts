import { AuthzCacheService } from './authz-cache.service';
import { SecurityDomain } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisCacheService } from '../common/cache/redis-cache.service';

/**
 * These tests pin the security contract of the cross-request authorization
 * resolver. Effective grants are deliberately live until a versioned,
 * fail-closed cache contract exists, so each guarantee is asserted explicitly:
 *
 *  - the tenant predicate is present on every underlying read;
 *  - entries are namespaced per tenant and per user;
 *  - invalidation targets exactly the right key(s).
 *
 * Liveness (`User.status`, `Tenant.isActive`) is deliberately *not* handled
 * here — `JwtAuthGuard` reads it live on every request, so suspension and
 * deactivation are unaffected by this cache. `jwt-auth.guard.spec.ts` covers
 * that.
 */
describe('AuthzCacheService', () => {
  let prisma: {
    runWithoutTenantScope: jest.Mock;
    userRole: { findMany: jest.Mock };
  };
  let store: Map<string, unknown>;
  let cache: RedisCacheService;
  let service: AuthzCacheService;

  /** A real caching double, so hit/miss behaviour is actually exercised. */
  function makeCache() {
    store = new Map<string, unknown>();
    return {
      resolve: async <T>(
        key: string,
        _ttl: number,
        loader: () => Promise<T>,
      ) => {
        if (store.has(key)) return store.get(key) as T;
        const value = await loader();
        store.set(key, value);
        return value;
      },
      invalidate: jest.fn(async (key: string) => {
        store.delete(key);
      }),
      invalidatePrefix: jest.fn(async (prefix: string) => {
        for (const key of [...store.keys()]) {
          if (key.startsWith(prefix)) store.delete(key);
        }
      }),
    } as unknown as RedisCacheService;
  }

  beforeEach(() => {
    prisma = {
      runWithoutTenantScope: jest.fn(
        async (_reason: string, fn: () => Promise<unknown>) => fn(),
      ),
      userRole: {
        findMany: jest.fn().mockResolvedValue([
          {
            scopeId: null,
            expiresAt: null,
            role: {
              name: 'teacher',
              rolePermissions: [
                { permission: { resource: 'students', action: 'read' } },
                { permission: { resource: 'attendance', action: 'mark' } },
              ],
            },
          },
        ]),
      },
    };
    cache = makeCache();
    service = new AuthzCacheService(prisma as unknown as PrismaService, cache);
  });

  it('resolves roles and resource:action permission keys', async () => {
    await expect(service.resolve('tenant-1', 'user-1')).resolves.toEqual({
      roles: ['teacher'],
      permissions: ['students:read', 'attendance:mark'],
    });
  });

  it('filters active assignments by the requested tenant', async () => {
    await service.resolve('tenant-1', 'user-1');

    expect(prisma.userRole.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        userId: 'user-1',
        revokedAt: null,
        role: { tenantId: 'tenant-1' },
      },
      select: {
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
  });

  it('declares an explicit reason when bypassing tenant scope', async () => {
    await service.resolve('tenant-1', 'user-1');

    // The bypass is required because this runs before the guard establishes
    // CLS tenant context; it is only safe because tenantId is filtered above.
    expect(prisma.runWithoutTenantScope).toHaveBeenCalledWith(
      expect.stringContaining('authorize'),
      expect.any(Function),
    );
  });

  it('re-reads a second request for the same user from authoritative storage', async () => {
    await service.resolve('tenant-1', 'user-1');
    await service.resolve('tenant-1', 'user-1');

    expect(prisma.userRole.findMany).toHaveBeenCalledTimes(2);
    expect(store.size).toBe(0);
  });

  it('never serves one user the permissions cached for another', async () => {
    prisma.userRole.findMany
      .mockResolvedValueOnce([roleGrant('admin')])
      .mockResolvedValueOnce([roleGrant('parent')]);

    const first = await service.resolve('tenant-1', 'user-1');
    const second = await service.resolve('tenant-1', 'user-2');

    expect(first.roles).toEqual(['admin']);
    expect(second.roles).toEqual(['parent']);
  });

  it('never serves one tenant the permissions cached for another', async () => {
    prisma.userRole.findMany
      .mockResolvedValueOnce([roleGrant('admin')])
      .mockResolvedValueOnce([roleGrant('teacher')]);

    // Same user id in two tenants must not share an entry.
    const a = await service.resolve('tenant-1', 'user-1');
    const b = await service.resolve('tenant-2', 'user-1');

    expect(a.roles).toEqual(['admin']);
    expect(b.roles).toEqual(['teacher']);
  });

  it('re-reads after the user entry is invalidated', async () => {
    prisma.userRole.findMany
      .mockResolvedValueOnce([roleGrant('teacher')])
      .mockResolvedValueOnce([roleGrant('parent')]);

    await expect(service.resolve('tenant-1', 'user-1')).resolves.toEqual(
      expect.objectContaining({ roles: ['teacher'] }),
    );

    await service.invalidateUser('tenant-1', 'user-1');

    // A revoked role must be observed on the next request, not after the TTL.
    await expect(service.resolve('tenant-1', 'user-1')).resolves.toEqual(
      expect.objectContaining({ roles: ['parent'] }),
    );
  });

  it('invalidating one user remains bounded to its compatibility cache key', async () => {
    await service.resolve('tenant-1', 'user-1');
    await service.resolve('tenant-1', 'user-2');
    prisma.userRole.findMany.mockClear();

    await service.invalidateUser('tenant-1', 'user-1');

    await service.resolve('tenant-1', 'user-1');
    await service.resolve('tenant-1', 'user-2');

    expect(prisma.userRole.findMany).toHaveBeenCalledTimes(2);
    expect(cache.invalidate).toHaveBeenCalledWith('authz:v2:tenant-1:user-1');
  });

  it('invalidating a tenant drops every user in that tenant only', async () => {
    await service.resolve('tenant-1', 'user-1');
    await service.resolve('tenant-1', 'user-2');
    await service.resolve('tenant-2', 'user-3');
    prisma.userRole.findMany.mockClear();

    // A role's permission set changed, so every holder in the tenant must
    // re-resolve — but another tenant's entries are untouched.
    await service.invalidateTenant('tenant-1');

    await service.resolve('tenant-1', 'user-1');
    await service.resolve('tenant-1', 'user-2');
    await service.resolve('tenant-2', 'user-3');

    expect(prisma.userRole.findMany).toHaveBeenCalledTimes(3);
  });

  it('uses a tenant-scoped key prefix so invalidation cannot span tenants', async () => {
    await service.invalidateTenant('tenant-1');

    expect(cache.invalidatePrefix).toHaveBeenCalledWith('authz:v2:tenant-1:');
  });

  it('deduplicates roles and permissions granted by several roles', async () => {
    prisma.userRole.findMany.mockResolvedValue([
      roleGrant('teacher', 'students', 'read'),
      roleGrant('teacher', 'students', 'read'),
    ]);

    await expect(service.resolve('tenant-1', 'user-1')).resolves.toEqual({
      roles: ['teacher'],
      permissions: ['students:read'],
    });
  });

  it('returns empty sets for a user with no roles', async () => {
    prisma.userRole.findMany.mockResolvedValue([]);

    await expect(service.resolve('tenant-1', 'user-1')).resolves.toEqual({
      roles: [],
      permissions: [],
    });
  });

  it('ignores reserved platform roles in the school security domain', async () => {
    prisma.userRole.findMany.mockResolvedValue([
      roleGrant(
        'platform_super_admin',
        'platform:dashboard',
        'read',
        null,
        'global',
      ),
      roleGrant('admin', 'students', 'read'),
    ]);

    await expect(
      service.resolve('tenant-1', 'user-1', SecurityDomain.SCHOOL),
    ).resolves.toEqual({
      roles: ['admin'],
      permissions: ['students:read'],
    });
  });

  it('requires a global platform-role assignment in the platform security domain', async () => {
    prisma.userRole.findMany.mockResolvedValue([
      roleGrant(
        'platform_support',
        'platform:queues',
        'read',
        null,
        'tenant-2',
      ),
      roleGrant('admin', 'students', 'read', null, 'global'),
    ]);

    await expect(
      service.resolve('tenant-1', 'user-1', SecurityDomain.PLATFORM),
    ).resolves.toEqual({
      roles: [],
      permissions: [],
    });
  });

  it('accepts only global reserved roles in the platform security domain', async () => {
    prisma.userRole.findMany.mockResolvedValue([
      roleGrant('platform_support', 'platform:queues', 'read', null, 'global'),
      roleGrant('admin', 'students', 'read', null, 'global'),
    ]);

    await expect(
      service.resolve('tenant-1', 'user-1', SecurityDomain.PLATFORM),
    ).resolves.toEqual({
      roles: ['platform_support'],
      permissions: ['platform:queues:read'],
    });
  });

  it('always re-reads platform grants instead of trusting Redis', async () => {
    prisma.userRole.findMany
      .mockResolvedValueOnce([
        roleGrant(
          'platform_super_admin',
          'platform:support_override',
          'manage',
          null,
          'global',
        ),
      ])
      .mockResolvedValueOnce([]);

    await expect(
      service.resolve('platform-tenant', 'operator-1', SecurityDomain.PLATFORM),
    ).resolves.toEqual({
      roles: ['platform_super_admin'],
      permissions: ['platform:support_override:manage'],
    });

    await expect(
      service.resolve('platform-tenant', 'operator-1', SecurityDomain.PLATFORM),
    ).resolves.toEqual({ roles: [], permissions: [] });

    expect(prisma.userRole.findMany).toHaveBeenCalledTimes(2);
    expect(store.size).toBe(0);
  });

  it('removes a time-bounded grant at expiry even while the cache is warm', async () => {
    const expiresAt = new Date(Date.now() + 1_000);
    prisma.userRole.findMany.mockResolvedValue([
      roleGrant('financial_auditor', 'reports', 'export', expiresAt),
    ]);

    await expect(service.resolve('tenant-1', 'user-1')).resolves.toEqual({
      roles: ['financial_auditor'],
      permissions: ['reports:export'],
    });

    jest.spyOn(Date, 'now').mockReturnValue(expiresAt.getTime());
    await expect(service.resolve('tenant-1', 'user-1')).resolves.toEqual({
      roles: [],
      permissions: [],
    });
  });
});

function roleGrant(
  name: string,
  resource = 'students',
  action = 'read',
  expiresAt: Date | null = null,
  scopeId: string | null = null,
) {
  return {
    scopeId,
    expiresAt,
    role: {
      name,
      rolePermissions: [{ permission: { resource, action } }],
    },
  };
}
