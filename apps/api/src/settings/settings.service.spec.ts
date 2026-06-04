import { BadRequestException } from '@nestjs/common';
import type { AuthContext } from '../auth/auth.types';
import { SettingsService } from './settings.service';

const actor: AuthContext = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  tenantSlug: 'green-valley',
  email: 'admin@school.test',
  roles: ['admin'],
  permissions: ['settings:manage'],
  authMethod: 'PASSWORD',
};

const validPng = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);

interface TenantSettingUpsertArgs {
  where: { tenantId_key: { tenantId: string; key: string } };
  create: { value: unknown };
}

function buildService() {
  const prisma = {
    tenantSetting: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };
  const auditService = { record: jest.fn() };
  const storageService = { saveBufferObject: jest.fn() };
  const fileRegistryService = {
    registerFile: jest.fn(),
    markUploaded: jest.fn(),
    softDeleteFile: jest.fn(),
    getFileMetadata: jest.fn(),
    auditAccess: jest.fn(),
    getSignedUrl: jest.fn(),
  };

  const service = new SettingsService(
    prisma as never,
    auditService as never,
    storageService as never,
    fileRegistryService as never,
  );

  return {
    service,
    prisma,
    auditService,
    storageService,
    fileRegistryService,
  };
}

describe('SettingsService school logo uploads', () => {
  it('accepts normalized chat-hour settings and rejects malformed times', async () => {
    const { service, prisma, auditService } = buildService();
    prisma.tenantSetting.findUnique.mockResolvedValue(null);
    prisma.tenantSetting.upsert.mockResolvedValue({});
    auditService.record.mockResolvedValue({});

    await service.updateSetting(
      actor.tenantId,
      'chat_sunday_to_thursday_start',
      '16:00',
      actor.userId,
    );

    await expect(
      service.updateSetting(
        actor.tenantId,
        'chat_friday_end',
        '5:00 PM',
        actor.userId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    const upsertMock = prisma.tenantSetting.upsert as jest.MockedFunction<
      (args: TenantSettingUpsertArgs) => Promise<unknown>
    >;
    const upsertArgs = upsertMock.mock.calls[0]?.[0];
    expect(upsertArgs?.where.tenantId_key).toEqual({
      tenantId: actor.tenantId,
      key: 'chat_sunday_to_thursday_start',
    });
    expect(upsertArgs?.create.value).toBe('16:00');
  });

  it('stores tenant logo through private storage and File Registry', async () => {
    const {
      service,
      prisma,
      storageService,
      fileRegistryService,
      auditService,
    } = buildService();
    prisma.tenantSetting.findUnique.mockResolvedValue(null);
    storageService.saveBufferObject.mockResolvedValue({
      objectKey: 'tenant-1/settings/branding/logo/logo.png',
      sizeBytes: validPng.byteLength,
    });
    fileRegistryService.registerFile.mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
      originalFilename: 'school-logo.png',
      mimeType: 'image/png',
      sizeBytes: BigInt(validPng.byteLength),
    });

    const result = await service.uploadSchoolLogo(
      {
        fileName: '../school logo.png',
        mimeType: 'image/png',
        base64Content: validPng.toString('base64'),
      },
      actor,
    );

    expect(storageService.saveBufferObject).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: actor.tenantId,
        prefix: 'settings/branding/logo',
        fileName: 'school-logo.png',
        contentType: 'image/png',
      }),
    );
    expect(fileRegistryService.registerFile).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: actor.tenantId,
        module: 'settings',
        entityId: actor.tenantId,
        originalFilename: 'school-logo.png',
      }),
    );
    expect(prisma.tenantSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_key: { tenantId: actor.tenantId, key: 'school_logo' },
        },
        update: { value: '11111111-1111-1111-1111-111111111111' },
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'school_logo_uploaded',
        tenantId: actor.tenantId,
        resourceId: 'school_logo',
      }),
    );
    expect(result.previewUrl).toBe('/api/v1/settings/branding/logo/preview');
  });

  it('rejects invalid logo extension before storage writes', async () => {
    const { service, prisma, storageService } = buildService();
    prisma.tenantSetting.findUnique.mockResolvedValue(null);

    await expect(
      service.uploadSchoolLogo(
        {
          fileName: 'logo.svg',
          mimeType: 'image/png',
          base64Content: validPng.toString('base64'),
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(storageService.saveBufferObject).not.toHaveBeenCalled();
  });

  it('blocks cross-tenant logo preview when registry metadata is mismatched', async () => {
    const { service, prisma, fileRegistryService } = buildService();
    prisma.tenantSetting.findUnique.mockResolvedValue({
      value: '11111111-1111-1111-1111-111111111111',
    });
    fileRegistryService.getFileMetadata.mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
      module: 'settings',
      entityId: 'other-tenant',
      originalFilename: 'logo.png',
      mimeType: 'image/png',
      sizeBytes: BigInt(12),
    });

    await expect(
      service.getSchoolLogoAccess(actor, 'preview'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(fileRegistryService.auditAccess).not.toHaveBeenCalled();
  });

  it('soft-deletes logo assets and audits removal', async () => {
    const { service, prisma, fileRegistryService, auditService } =
      buildService();
    prisma.tenantSetting.findUnique.mockResolvedValue({
      value: '11111111-1111-1111-1111-111111111111',
    });

    const result = await service.removeSchoolLogo(actor);

    expect(fileRegistryService.softDeleteFile).toHaveBeenCalledWith(
      actor.tenantId,
      '11111111-1111-1111-1111-111111111111',
      actor.userId,
    );
    expect(prisma.tenantSetting.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: actor.tenantId, key: 'school_logo' },
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'school_logo_removed' }),
    );
    expect(result).toEqual({ success: true, removed: true });
  });

  it('lists only tenant-scoped audit logs with filters and pagination', async () => {
    const { service, prisma } = buildService();
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'audit-1',
        action: 'setting_updated',
        resource: 'settings',
        resourceId: 'school_name',
        tenantId: actor.tenantId,
        userId: actor.userId,
        before: { value: 'Old School' },
        after: { value: 'New School' },
        ipAddress: null,
        userAgent: null,
        requestId: 'req-1',
        createdAt: new Date('2026-06-04T00:00:00.000Z'),
        user: {
          id: actor.userId,
          email: actor.email,
          phone: null,
        },
      },
    ]);
    prisma.auditLog.count.mockResolvedValue(1);

    const result = await service.listTenantAuditLogs({
      tenantId: actor.tenantId,
      action: ' setting_updated ',
      resource: 'settings',
      page: '1',
      limit: '10',
    });

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: actor.tenantId,
          action: 'setting_updated',
          resource: 'settings',
        },
        skip: 0,
        take: 10,
      }),
    );
    expect(result.items[0]).toMatchObject({
      id: 'audit-1',
      tenantId: actor.tenantId,
      action: 'setting_updated',
      resource: 'settings',
      createdAt: '2026-06-04T00:00:00.000Z',
    });
    expect(result.total).toBe(1);
  });
});
