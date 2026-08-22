import { ForbiddenException } from '@nestjs/common';
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
          {
            id: 'legacy-platform-role',
            name: 'platform_super_admin',
            description: 'Legacy school-local platform role',
            isSystem: true,
            rolePermissions: [],
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
          {
            id: 'perm-platform',
            resource: 'platform',
            action: 'manage',
            description: 'Manage Platform',
          },
          {
            id: 'perm-tenants-manage',
            resource: 'tenants',
            action: 'manage',
            description: 'Manage tenants',
          },
        ]),
      },
    };
    const service = new RolesService(
      prisma as never,
      auditService as never,
      authzCacheDouble(),
    );

    await expect(
      service.listPermissions({
        tenantId: 'tenant-1',
        userId: 'user-1',
      } as never),
    ).resolves.toEqual([
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

  it.each(['platform_operator', ' PLATFORM_FUTURE_ROLE '])(
    'rejects reserved Platform role name %p before creating a school role',
    async (name) => {
      const prisma = {
        role: {
          findUnique: jest.fn(),
          create: jest.fn(),
        },
      };
      const service = new RolesService(
        prisma as never,
        auditService as never,
        authzCacheDouble(),
      );

      await expect(
        service.createRole(
          { name, description: 'Reserved role' } as never,
          { tenantId: 'tenant-1', userId: 'admin-1' } as never,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.role.findUnique).not.toHaveBeenCalled();
      expect(prisma.role.create).not.toHaveBeenCalled();
    },
  );
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
        findFirst: jest.fn().mockResolvedValue({
          id: 'role-1',
          name: 'teacher',
          isSystem: false,
        }),
        findUnique: jest.fn().mockResolvedValue({ id: 'role-1' }),
        create: jest.fn().mockResolvedValue({ id: 'role-1' }),
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'role-1', name: 'teacher' }]),
      },
      permission: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'perm-1', resource: 'students', action: 'read' },
          { id: 'perm-2', resource: 'attendance', action: 'read' },
        ]),
      },
      rolePermission: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      userRole: {
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({ id: 'assignment-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(2),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'user-9' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'user-9' }),
      },
      $transaction: jest.fn(async (work: (tx: unknown) => Promise<unknown>) =>
        work(prisma),
      ),
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

  it('rejects a legacy school-local Platform role assignment before mutation', async () => {
    const { service, prisma, authzCache } = buildService();
    prisma.role.findMany.mockResolvedValue([
      { id: 'legacy-platform-role', name: 'platform_super_admin' },
    ]);

    await expect(
      service.assignRoles(
        { userId: 'user-9', roleIds: ['legacy-platform-role'] } as never,
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(authzCache.invalidateUser).not.toHaveBeenCalled();
  });

  it('rejects a Platform permission grant before replacing school grants', async () => {
    const { service, prisma, authzCache } = buildService();
    prisma.permission.findMany.mockResolvedValue([
      { id: 'perm-platform', resource: 'platform', action: 'manage' },
    ]);

    await expect(
      service.assignPermissions(
        'role-1',
        { permissionIds: ['perm-platform'] } as never,
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.rolePermission.deleteMany).not.toHaveBeenCalled();
    expect(prisma.rolePermission.createMany).not.toHaveBeenCalled();
    expect(authzCache.invalidateTenant).not.toHaveBeenCalled();
  });

  it('invalidates only after the write has been committed', async () => {
    const order: string[] = [];
    const { service, authzCache, prisma } = buildService();
    (prisma.userRole.create as jest.Mock).mockImplementation(async () => {
      order.push('write');
      return { id: 'assignment-1' };
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

  it('reports finance authority blocked when no Accountant is designated', async () => {
    const prisma = {
      role: { findMany: jest.fn().mockResolvedValue([]) },
      userRole: { count: jest.fn().mockResolvedValue(0) },
    };
    const service = new RolesService(
      prisma as never,
      { record: jest.fn() } as never,
      authzCacheDouble(),
    );

    const preview = await service.previewFinancePermissionReconciliation(actor);

    expect(preview.status).toBe('BLOCKED');
    expect(preview.financeAuthorityLocked).toBe(true);
    expect(preview.designatedFinanceUserCount).toBe(0);
    expect(preview.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ roleName: 'admin', missingRole: true }),
        expect.objectContaining({ roleName: 'accountant', missingRole: true }),
      ]),
    );
  });

  it('applies preset reconciliation without assigning a finance role to a user', async () => {
    const authzCache = {
      invalidateUser: jest.fn(),
      invalidateTenant: jest.fn().mockResolvedValue(undefined),
    };
    const audit = { record: jest.fn().mockResolvedValue({ id: 'audit-1' }) };
    const prisma = {
      role: { findMany: jest.fn().mockResolvedValue([]) },
      userRole: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
      },
      permission: { findMany: jest.fn().mockResolvedValue([]) },
      rolePermission: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      $transaction: jest.fn(async (work: (tx: unknown) => Promise<unknown>) =>
        work(prisma),
      ),
    };
    const service = new RolesService(
      prisma as never,
      audit as never,
      authzCache as never,
    );

    const result = await service.reconcileFinancePermissions(
      'Owner-approved P0 finance boundary',
      actor,
    );

    expect(result.status).toBe('BLOCKED');
    expect(prisma.userRole.create).not.toHaveBeenCalled();
    expect(authzCache.invalidateTenant).toHaveBeenCalledWith('tenant-1');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'reconcile_finance_permissions',
        after: expect.objectContaining({
          userRoleAssignmentsChanged: false,
        }),
      }),
    );
  });
});
