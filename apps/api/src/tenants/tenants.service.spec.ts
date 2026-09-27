import { ConflictException } from '@nestjs/common';
import type { AuthContext } from '../auth/auth.types';
import { TenantsService } from './tenants.service';

describe('TenantsService.register (platform-operator provisioning)', () => {
  const platformActor = {
    userId: 'platform-operator-1',
    tenantId: 'platform-tenant',
    tenantSlug: 'platform',
    email: 'operator@schoolos.io',
    authMethod: 'PASSWORD',
    roles: ['platform_super_admin'],
    permissions: ['tenants:manage'],
  } as AuthContext;

  function createMocks() {
    const prisma = {
      runWithoutTenantScope: jest.fn(
        async (_reason: string, callback: () => unknown) => callback(),
      ),
      $transaction: jest.fn(),
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      tenant: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'tenant-new',
          name: 'Green Valley School',
          slug: 'green-valley',
          plan: 'standard',
        }),
      },
      role: {
        upsert: jest
          .fn<
            Promise<void>,
            [
              {
                update: Record<string, unknown>;
                create: { name: string; isSystem: boolean };
              },
            ]
          >()
          .mockResolvedValue(undefined),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(
          ({
            where,
          }: {
            where: { tenantId_name: { name: string } };
          }): Promise<{
            id: string;
            name: string;
            isSystem: boolean;
          } | null> =>
            Promise.resolve({
              id: `role-${where.tenantId_name.name}`,
              name: where.tenantId_name.name,
              isSystem: true,
            }),
        ),
      },
      permission: {
        upsert: jest.fn().mockResolvedValue(undefined),
        findUnique: jest.fn(
          ({
            where,
          }: {
            where: { resource_action: { resource: string; action: string } };
          }): Promise<{ id: string } | null> =>
            Promise.resolve({
              id: `permission-${where.resource_action.resource}:${where.resource_action.action}`,
            }),
        ),
      },
      rolePermission: {
        deleteMany: jest.fn().mockResolvedValue(undefined),
        create: jest.fn().mockResolvedValue(undefined),
      },
      academicYear: {
        upsert: jest.fn().mockResolvedValue(undefined),
      },
      chartAccount: {
        upsert: jest.fn().mockResolvedValue(undefined),
        findUnique: jest.fn(
          ({ where }: { where: { tenantId_code: { code: string } } }) =>
            Promise.resolve({
              id: `account-${where.tenantId_code.code}`,
              code: where.tenantId_code.code,
            }),
        ),
      },
      feeHead: {
        upsert: jest.fn().mockResolvedValue(undefined),
      },
      accountingSourceMapping: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(undefined),
      },
    };
    prisma.$transaction.mockImplementation(
      (callback: (tx: unknown) => unknown) => callback(prisma),
    );

    const usersService = {
      createManagedUser: jest.fn().mockResolvedValue({
        id: 'user-admin-new',
        email: 'admin@greenvalley.com',
      }),
    };

    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    const cls = {
      get: jest.fn().mockReturnValue('req-123'),
    };

    const service = new TenantsService(
      prisma as never,
      usersService as never,
      auditService as never,
      cls as never,
    );

    return { service, prisma, usersService, auditService, cls };
  }

  const dto = {
    name: 'Green Valley School',
    slug: 'green-valley',
    adminEmail: 'admin@greenvalley.com',
    adminPassword: 'RootAccess1!',
  };

  it('provisions the tenant inside an explicit cross-tenant scope', async () => {
    const { service, prisma } = createMocks();

    await service.register(dto, platformActor);

    expect(prisma.runWithoutTenantScope).toHaveBeenCalledWith(
      expect.stringContaining('provision'),
      expect.any(Function),
    );
  });

  it('creates the tenant and first admin with the config-owner role pair', async () => {
    const { service, prisma, usersService } = createMocks();

    const result = await service.register(dto, platformActor);

    expect(prisma.tenant.create).toHaveBeenCalledWith({
      data: {
        name: dto.name,
        slug: dto.slug,
        mode: 'MULTI',
        plan: 'standard',
      },
    });
    expect(usersService.createManagedUser).toHaveBeenCalledWith(
      {
        tenantId: 'tenant-new',
        email: dto.adminEmail.toLowerCase(),
        password: dto.adminPassword,
        roleIds: ['role-admin', 'role-school_config_owner'],
        assignedById: null,
      },
      prisma,
    );
    expect(result.tenant.slug).toBe('green-valley');
    expect(result.admin.email).toBe('admin@greenvalley.com');
  });

  it('never provisions reserved Platform roles into a school tenant', async () => {
    const { service, prisma } = createMocks();

    await service.register(dto, platformActor);

    const provisionedRoleNames = prisma.role.upsert.mock.calls.map(
      ([call]: [{ create: { name: string } }]) => call.create.name,
    );
    expect(provisionedRoleNames.length).toBeGreaterThan(0);
    expect(
      provisionedRoleNames.some((name: string) =>
        name.trim().toLowerCase().startsWith('platform_'),
      ),
    ).toBe(false);
  });

  it('fails tenant provisioning when a configured system role permission is missing', async () => {
    const { service, prisma, usersService, auditService } = createMocks();
    prisma.permission.findUnique.mockResolvedValueOnce(null);

    await expect(service.register(dto, platformActor)).rejects.toThrow(
      /System role permission .+ is missing from the catalog/,
    );
    expect(usersService.createManagedUser).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('fails tenant provisioning when a configured system role is missing', async () => {
    const { service, prisma, usersService } = createMocks();
    prisma.role.findUnique.mockResolvedValue(null);

    await expect(service.register(dto, platformActor)).rejects.toThrow(
      /System role .+ was not provisioned/,
    );
    expect(usersService.createManagedUser).not.toHaveBeenCalled();
  });

  it('does not promote a colliding custom role into a system template', async () => {
    const { service, prisma, usersService } = createMocks();
    prisma.role.findMany.mockResolvedValue([{ name: ' CASHIER ' }]);

    await expect(service.register(dto, platformActor)).rejects.toThrow(
      'Custom role CASHIER conflicts with a SchoolOS system template',
    );
    expect(prisma.permission.upsert).not.toHaveBeenCalled();
    expect(prisma.role.upsert).not.toHaveBeenCalled();
    expect(prisma.rolePermission.deleteMany).not.toHaveBeenCalled();
    expect(usersService.createManagedUser).not.toHaveBeenCalled();
  });

  it('never changes a preexisting role into a system role during upsert', async () => {
    const { service, prisma } = createMocks();

    await service.register(dto, platformActor);

    for (const [call] of prisma.role.upsert.mock.calls) {
      expect(call.update).not.toHaveProperty('isSystem');
      expect(call.create.isSystem).toBe(true);
    }
  });

  it('audits provisioning against the acting platform operator', async () => {
    const { service, prisma, auditService } = createMocks();

    await service.register(dto, platformActor);

    expect(auditService.record).toHaveBeenCalledWith(
      {
        action: 'register',
        resource: 'tenant',
        tenantId: 'tenant-new',
        userId: 'platform-operator-1',
        resourceId: 'tenant-new',
        requestId: 'req-123',
        after: {
          slug: 'green-valley',
          adminEmail: 'admin@greenvalley.com',
          adminUserId: 'user-admin-new',
        },
      },
      prisma,
    );
  });

  it('rejects duplicate slugs with a conflict', async () => {
    const { service, prisma, auditService } = createMocks();
    prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-existing' });

    await expect(service.register(dto, platformActor)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.tenant.create).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });
});
