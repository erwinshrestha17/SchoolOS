import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { AuthContext } from '../auth/auth.types';
import { TenantActiveGuard } from '../auth/guards/tenant-active.guard';
import { RolesController } from '../roles/roles.controller';
import { RolesService } from '../roles/roles.service';
import { UsersController } from '../users/users.controller';
import { UsersService } from '../users/users.service';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { SchoolSettingsWorkspaceController } from './school-settings-workspace.controller';

const baseActor: Omit<AuthContext, 'tenantId' | 'permissions'> = {
  userId: 'user-1',
  tenantSlug: 'green-valley',
  email: 'user@school.test',
  authMethod: 'PASSWORD',
  roles: ['admin'],
};

function actorWith(permissions: string[], tenantId = 'tenant-1'): AuthContext {
  return { ...baseActor, tenantId, permissions };
}

function buildSettingsService() {
  const upserts: Array<{ tenantId: string; key: string; value: unknown }> = [];
  const prisma = {
    tenantSetting: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockImplementation((args) => {
        upserts.push({
          tenantId: args.where.tenantId_key.tenantId,
          key: args.where.tenantId_key.key,
          value: args.create.value,
        });
        return Promise.resolve({});
      }),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    tenant: { findUnique: jest.fn() },
    auditLog: { findMany: jest.fn(), count: jest.fn() },
  };
  const auditService = { record: jest.fn().mockResolvedValue({}) };
  const service = new SettingsService(
    prisma as never,
    auditService as never,
    { saveBufferObject: jest.fn() } as never,
    {
      registerFile: jest.fn(),
      markUploaded: jest.fn(),
      softDeleteFile: jest.fn(),
      getFileMetadata: jest.fn(),
      auditAccess: jest.fn(),
      getSignedUrl: jest.fn(),
    } as never,
  );
  return { service, prisma, auditService, upserts };
}

describe('Suspended-tenant fail-closed wiring', () => {
  it.each([
    ['SettingsController', SettingsController],
    ['SchoolSettingsWorkspaceController', SchoolSettingsWorkspaceController],
    ['UsersController', UsersController],
    ['RolesController', RolesController],
  ])('%s enforces TenantActiveGuard', (_name, controller) => {
    const guards: unknown[] =
      Reflect.getMetadata(GUARDS_METADATA, controller) ?? [];
    expect(guards).toContain(TenantActiveGuard);
  });
});

describe('School settings domain authorization', () => {
  it('allows a domain-scoped manager to write only that domain', async () => {
    const { service, upserts } = buildSettingsService();
    const accountant = actorWith(['settings:read', 'settings:finance:manage']);

    await service.updateSetting(accountant, 'receipt_number_prefix', 'REC-');
    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toMatchObject({
      tenantId: 'tenant-1',
      key: 'receipt_number_prefix',
    });

    await expect(
      service.updateSetting(accountant, 'default_notice_channel', 'SMS'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.updateSetting(accountant, 'session_timeout_minutes', 30),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(upserts).toHaveLength(1);
  });

  it('denies view-only personas from every settings mutation', async () => {
    const { service, upserts, auditService } = buildSettingsService();
    const viewer = actorWith(['settings:read', 'settings:read_public']);

    await expect(
      service.updateSetting(viewer, 'school_name', 'New Name'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.updateSetting(viewer, 'receipt_number_prefix', 'X-'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(upserts).toHaveLength(0);
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('reserves feature toggles for full settings authority', async () => {
    const { service } = buildSettingsService();
    const domainManager = actorWith([
      'settings:read',
      'settings:finance:manage',
      'settings:communication:manage',
    ]);
    await expect(
      service.updateSetting(domainManager, 'feature_toggles', {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('keeps writes scoped to the authenticated tenant of each school', async () => {
    const { service, upserts } = buildSettingsService();

    await service.updateSetting(
      actorWith(['settings:manage'], 'school-a'),
      'school_name',
      'School A Name',
    );
    await service.updateSetting(
      actorWith(['settings:manage'], 'school-b'),
      'school_name',
      'School B Name',
    );

    expect(upserts).toEqual([
      expect.objectContaining({
        tenantId: 'school-a',
        value: 'School A Name',
      }),
      expect.objectContaining({
        tenantId: 'school-b',
        value: 'School B Name',
      }),
    ]);
  });
});

describe('Tenant audit exposure', () => {
  it('returns safe audit summaries without raw payloads or client metadata', async () => {
    const { service, prisma } = buildSettingsService();
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'audit-1',
        action: 'setting_updated',
        resource: 'settings',
        resourceId: 'school_name',
        tenantId: 'tenant-1',
        userId: 'user-1',
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        user: { id: 'user-1', email: 'owner@school.test', phone: null },
      },
    ]);
    prisma.auditLog.count.mockResolvedValue(1);

    const result = await service.listTenantAuditLogs({
      tenantId: 'tenant-1',
    });

    expect(result.items[0]).not.toHaveProperty('before');
    expect(result.items[0]).not.toHaveProperty('after');
    expect(result.items[0]).not.toHaveProperty('ipAddress');
    expect(result.items[0]).not.toHaveProperty('userAgent');
    expect(result.items[0]).not.toHaveProperty('requestId');
    const select = prisma.auditLog.findMany.mock.calls[0][0].select;
    expect(select.before).toBeUndefined();
    expect(select.after).toBeUndefined();
    expect(select.ipAddress).toBeUndefined();
    expect(select.userAgent).toBeUndefined();
  });

  it('lists recent setting changes as bounded tenant-scoped summaries', async () => {
    const { service, prisma } = buildSettingsService();
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'audit-2',
        action: 'setting_updated',
        resourceId: 'receipt_number_prefix',
        createdAt: new Date('2026-07-02T00:00:00.000Z'),
        user: { email: 'accountant@school.test', phone: null },
      },
    ]);

    const changes = await service.listRecentSettingChanges('tenant-1', 25);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', resource: 'settings' },
        take: 5,
      }),
    );
    expect(changes).toEqual([
      {
        id: 'audit-2',
        action: 'setting_updated',
        settingKey: 'receipt_number_prefix',
        actorLabel: 'accountant@school.test',
        changedAt: '2026-07-02T00:00:00.000Z',
      },
    ]);
  });
});

describe('Configuration Owner safeguards', () => {
  function buildRolesService(options: {
    ownerAssignment: { roleId: string } | null;
    otherActiveOwners: number;
  }) {
    const prisma = {
      role: {
        findMany: jest.fn().mockResolvedValue([{ id: 'role-other' }]),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'user-owner' }),
      },
      userRole: {
        findFirst: jest.fn().mockResolvedValue(options.ownerAssignment),
        count: jest.fn().mockResolvedValue(options.otherActiveOwners),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      permission: { findMany: jest.fn() },
    };
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    return {
      prisma,
      auditService,
      service: new RolesService(prisma as never, auditService as never),
    };
  }

  const actor = actorWith(['roles:assign']);

  it('blocks removing the final active Configuration Owner role', async () => {
    const { service, prisma } = buildRolesService({
      ownerAssignment: { roleId: 'role-owner' },
      otherActiveOwners: 0,
    });

    await expect(
      service.assignRoles(
        {
          userId: 'user-owner',
          roleIds: ['role-other'],
          reason: 'restructure',
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.userRole.deleteMany).not.toHaveBeenCalled();
  });

  it('requires a reason to remove the Configuration Owner role', async () => {
    const { service, prisma } = buildRolesService({
      ownerAssignment: { roleId: 'role-owner' },
      otherActiveOwners: 2,
    });

    await expect(
      service.assignRoles(
        { userId: 'user-owner', roleIds: ['role-other'] },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.userRole.deleteMany).not.toHaveBeenCalled();
  });

  it('allows owner-role transfer when another active owner remains', async () => {
    const { service, prisma, auditService } = buildRolesService({
      ownerAssignment: { roleId: 'role-owner' },
      otherActiveOwners: 1,
    });

    await service.assignRoles(
      { userId: 'user-owner', roleIds: ['role-other'], reason: 'transfer' },
      actor,
    );

    expect(prisma.userRole.deleteMany).toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        after: expect.objectContaining({
          configOwnerRoleRemoved: true,
          reason: 'transfer',
        }),
      }),
    );
  });

  function buildUsersService(options: { otherActiveOwners: number }) {
    const ownerUser = {
      id: 'user-owner',
      email: 'owner@school.test',
      phone: null,
      status: 'ACTIVE',
      mustChangePassword: false,
      lastLoginAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      userRoles: [{ role: { id: 'role-owner', name: 'school_config_owner' } }],
      staff: null,
      student: null,
    };
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(ownerUser),
        update: jest.fn().mockResolvedValue({
          ...ownerUser,
          status: 'SUSPENDED',
        }),
      },
      userRole: {
        count: jest.fn().mockResolvedValue(options.otherActiveOwners),
      },
      refreshToken: { updateMany: jest.fn() },
    };
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    return {
      prisma,
      auditService,
      service: new UsersService(
        prisma as never,
        { bcryptRounds: 4 } as never,
        auditService as never,
      ),
    };
  }

  const userActor = actorWith(['users:update_status']);

  it('blocks deactivating the final active Configuration Owner', async () => {
    const { service, prisma } = buildUsersService({ otherActiveOwners: 0 });

    await expect(
      service.updateStatus(
        'user-owner',
        { status: 'SUSPENDED' as never, reason: 'left school' },
        userActor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('requires a reason to deactivate a Configuration Owner', async () => {
    const { service, prisma } = buildUsersService({ otherActiveOwners: 3 });

    await expect(
      service.updateStatus(
        'user-owner',
        { status: 'SUSPENDED' as never },
        userActor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('deactivates an owner with reason when another active owner remains', async () => {
    const { service, prisma, auditService } = buildUsersService({
      otherActiveOwners: 1,
    });

    await service.updateStatus(
      'user-owner',
      { status: 'SUSPENDED' as never, reason: 'staff transfer' },
      userActor,
    );

    expect(prisma.user.update).toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        after: expect.objectContaining({
          configOwnerDeactivated: true,
          reason: 'staff transfer',
        }),
      }),
    );
  });
});
