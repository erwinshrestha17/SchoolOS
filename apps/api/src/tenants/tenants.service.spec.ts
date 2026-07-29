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
        upsert: jest.fn().mockResolvedValue(undefined),
        findUnique: jest.fn(
          ({ where }: { where: { tenantId_name: { name: string } } }) =>
            Promise.resolve({
              id: `role-${where.tenantId_name.name}`,
              name: where.tenantId_name.name,
            }),
        ),
      },
      permission: {
        upsert: jest.fn().mockResolvedValue(undefined),
        findUnique: jest.fn().mockResolvedValue(null),
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
      },
      feeHead: {
        upsert: jest.fn().mockResolvedValue(undefined),
      },
    };

    const usersService = {
      createManagedUser: jest.fn().mockResolvedValue({
        id: 'user-admin-new',
        email: 'admin@greenvalley.com',
      }),
    };

    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    // Fresh-context escape hatch: register must run provisioning through
    // cls.run so the operator's platform tenantId is not injected into the
    // new tenant's queries by the Prisma tenant-scope extension.
    const cls = {
      get: jest.fn().mockReturnValue('req-123'),
      run: jest.fn((callback: () => unknown) => callback()),
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

  it('provisions the tenant inside a fresh CLS context', async () => {
    const { service, cls } = createMocks();

    await service.register(dto, platformActor);

    expect(cls.run).toHaveBeenCalledTimes(1);
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
    expect(usersService.createManagedUser).toHaveBeenCalledWith({
      tenantId: 'tenant-new',
      email: dto.adminEmail,
      password: dto.adminPassword,
      roleIds: ['role-admin', 'role-school_config_owner'],
      assignedById: null,
    });
    expect(result.tenant.slug).toBe('green-valley');
    expect(result.admin.email).toBe('admin@greenvalley.com');
  });

  it('audits provisioning against the acting platform operator', async () => {
    const { service, auditService } = createMocks();

    await service.register(dto, platformActor);

    expect(auditService.record).toHaveBeenCalledWith({
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
    });
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
