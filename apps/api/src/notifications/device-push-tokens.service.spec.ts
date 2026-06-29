import { ConflictException, ForbiddenException } from '@nestjs/common';
import { DevicePushTokensService } from './device-push-tokens.service';

describe('DevicePushTokensService', () => {
  const actor = {
    userId: 'parent-user-1',
    tenantId: 'tenant-1',
    tenantSlug: 'school-one',
    email: 'parent@school.test',
    authMethod: 'PASSWORD',
    roles: ['parent'],
    permissions: [],
  } as never;

  const dto = {
    token: 'fcm-token-value-that-is-long-enough-for-validation-123456789',
    installationId: '3b53ee2c-f356-477d-8b2c-7a35918590ab',
    platform: 'android' as const,
    appVersion: '1.0.0',
  };

  function buildService(overrides?: {
    existingToken?: {
      userId: string;
      installationId: string;
    } | null;
  }) {
    const prisma = {
      mobilePushToken: {
        findFirst: jest
          .fn()
          .mockResolvedValue(overrides?.existingToken ?? null),
        upsert: jest.fn().mockResolvedValue({
          id: 'push-token-1',
          installationId: dto.installationId,
          platform: 'android',
          lastSeenAt: new Date('2026-06-29T12:00:00.000Z'),
        }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const auditService = { record: jest.fn() };
    const notificationsService = {
      getProviderReadiness: jest.fn().mockResolvedValue({
        enabled: false,
        failureCode: 'PROVIDER_DISABLED',
        failureReason: 'Push notification dispatch is disabled.',
      }),
    };
    const plansService = {
      checkFeatureEnabled: jest.fn().mockResolvedValue({ allowed: true }),
    };
    const service = new DevicePushTokensService(
      prisma as never,
      { jwtSecret: 'test-jwt-secret' } as never,
      auditService as never,
      notificationsService as never,
      plansService as never,
    );

    return { service, prisma, auditService, plansService };
  }

  it('registers only the signed-in users tenant-scoped installation', async () => {
    const { service, prisma } = buildService();

    await expect(service.register(dto, actor)).resolves.toEqual({
      registered: true,
      installationId: dto.installationId,
      platform: 'android',
      lastSeenAt: '2026-06-29T12:00:00.000Z',
      provider: {
        enabled: false,
        failureCode: 'PROVIDER_DISABLED',
        failureReason: 'Push notification dispatch is disabled.',
      },
    });

    expect(prisma.mobilePushToken.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      select: {
        userId: true,
        installationId: true,
      },
    });
    expect(prisma.mobilePushToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_userId_installationId: {
            tenantId: 'tenant-1',
            userId: 'parent-user-1',
            installationId: dto.installationId,
          },
        },
        create: expect.objectContaining({
          tenantId: 'tenant-1',
          userId: 'parent-user-1',
          installationId: dto.installationId,
          tokenEncrypted: expect.stringMatching(/^enc:v1:/),
        }),
      }),
    );
    expect(
      JSON.stringify(prisma.mobilePushToken.upsert.mock.calls[0]),
    ).not.toContain(dto.token);
  });

  it('rejects an active token owned by another user without reassigning it', async () => {
    const { service, prisma } = buildService({
      existingToken: {
        userId: 'other-user',
        installationId: dto.installationId,
      },
    });

    await expect(service.register(dto, actor)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.mobilePushToken.upsert).not.toHaveBeenCalled();
  });

  it('revokes only the signed-in users token in the current tenant', async () => {
    const { service, prisma } = buildService();

    await expect(service.revoke(dto.installationId, actor)).resolves.toEqual({
      revoked: true,
    });
    expect(prisma.mobilePushToken.deleteMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        userId: 'parent-user-1',
        installationId: dto.installationId,
      },
    });
  });

  it('fails closed when the persona mobile feature is not entitled', async () => {
    const { service, plansService } = buildService();
    plansService.checkFeatureEnabled.mockResolvedValue({
      allowed: false,
      message: 'Mobile parent access is not included in this school plan.',
    });

    await expect(service.register(dto, actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('fails closed for unsupported broad student mobile sessions', async () => {
    const { service } = buildService();

    await expect(
      service.register(dto, {
        userId: 'student-user-1',
        tenantId: 'tenant-1',
        tenantSlug: 'school-one',
        email: 'student@school.test',
        authMethod: 'PASSWORD',
        roles: ['student'],
        permissions: [],
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
