import { RolesService } from './roles.service';

/** Invalidation is asserted where it matters; elsewhere it is a no-op. */
function authzCacheDouble() {
  return {
    invalidateUser: jest.fn(async () => undefined),
    invalidateTenant: jest.fn(async () => undefined),
  } as never;
}

describe('RolesService role inspection', () => {
  const auditService = { record: jest.fn() };

  it('lists only authenticated-tenant roles with deterministic permission keys', async () => {
    const prisma = {
      role: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'role-1',
            name: 'teacher',
            description: 'Teacher',
            isSystem: true,
            rolePermissions: [
              {
                permission: {
                  id: 'perm-2',
                  resource: 'homework',
                  action: 'create',
                },
              },
              {
                permission: {
                  id: 'perm-1',
                  resource: 'attendance',
                  action: 'read',
                },
              },
            ],
          },
        ]),
      },
      permission: {
        findMany: jest.fn(),
      },
    };
    const service = new RolesService(
      prisma as never,
      auditService as never,
      authzCacheDouble(),
    );

    await expect(
      service.listRoles({
        tenantId: 'tenant-1',
        userId: 'user-1',
      } as never),
    ).resolves.toEqual([
      {
        id: 'role-1',
        name: 'teacher',
        description: 'Teacher',
        isSystem: true,
        permissions: [
          { id: 'perm-1', key: 'attendance:read' },
          { id: 'perm-2', key: 'homework:create' },
        ],
      },
    ]);

    expect(prisma.role.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1' },
      }),
    );
  });

  it('lists permission catalog entries in resource and action order', async () => {
    const prisma = {
      role: {
        findMany: jest.fn(),
      },
      permission: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'perm-1',
            resource: 'roles',
            action: 'read',
            description: 'View roles',
          },
        ]),
      },
    };
    const service = new RolesService(
      prisma as never,
      auditService as never,
      authzCacheDouble(),
    );

    await expect(service.listPermissions()).resolves.toEqual([
      {
        id: 'perm-1',
        resource: 'roles',
        action: 'read',
        key: 'roles:read',
        description: 'View roles',
      },
    ]);

    expect(prisma.permission.findMany).toHaveBeenCalledWith({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });
  });
});

/**
 * The authorization cache is only safe if every write that changes a user's
 * effective permissions invalidates it. These tests pin that wiring — without
 * them a future refactor could silently drop the invalidation and leave stale
 * permissions in place until the TTL expired.
 */
describe('RolesService authorization cache invalidation', () => {
  function buildService(overrides: Record<string, unknown> = {}) {
    const authzCache = {
      invalidateUser: jest.fn(async () => undefined),
      invalidateTenant: jest.fn(async () => undefined),
    };
    const prisma = {
      role: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'role-1', isSystem: false }),
        findUnique: jest.fn().mockResolvedValue({ id: 'role-1' }),
        create: jest.fn().mockResolvedValue({ id: 'role-1' }),
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'role-1', name: 'teacher' }]),
      },
      permission: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'perm-1' }, { id: 'perm-2' }]),
      },
      rolePermission: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      userRole: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(2),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'user-9' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'user-9' }),
      },
      ...overrides,
    };
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    return {
      prisma,
      authzCache,
      service: new RolesService(
        prisma as never,
        auditService as never,
        authzCache as never,
      ),
    };
  }

  const actor = {
    tenantId: 'tenant-1',
    userId: 'admin-1',
    roles: ['admin'],
    permissions: ['roles:assign', 'roles:manage'],
  } as never;

  it('drops the whole tenant when a role permission set changes', async () => {
    const { service, authzCache } = buildService();

    await service.assignPermissions(
      'role-1',
      { permissionIds: ['perm-1', 'perm-2'] } as never,
      actor,
    );

    // Every holder of the role is affected, not just the caller.
    expect(authzCache.invalidateTenant).toHaveBeenCalledWith('tenant-1');
    expect(authzCache.invalidateUser).not.toHaveBeenCalled();
  });

  it('drops only the affected user when role membership changes', async () => {
    const { service, authzCache } = buildService();

    await service.assignRoles(
      { userId: 'user-9', roleIds: ['role-1'] } as never,
      actor,
    );

    expect(authzCache.invalidateUser).toHaveBeenCalledWith(
      'tenant-1',
      'user-9',
    );
    expect(authzCache.invalidateTenant).not.toHaveBeenCalled();
  });

  it('invalidates only after the write has been committed', async () => {
    const order: string[] = [];
    const { service, authzCache, prisma } = buildService();
    (prisma.userRole.createMany as jest.Mock).mockImplementation(async () => {
      order.push('write');
      return { count: 1 };
    });
    authzCache.invalidateUser.mockImplementation(async () => {
      order.push('invalidate');
    });

    await service.assignRoles(
      { userId: 'user-9', roleIds: ['role-1'] } as never,
      actor,
    );

    // Invalidating before the write would let a concurrent request re-populate
    // the cache from the pre-write state.
    expect(order).toEqual(['write', 'invalidate']);
  });
});
