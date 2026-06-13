import { RolesService } from './roles.service';

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
    const service = new RolesService(prisma as never, auditService as never);

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
    const service = new RolesService(prisma as never, auditService as never);

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
