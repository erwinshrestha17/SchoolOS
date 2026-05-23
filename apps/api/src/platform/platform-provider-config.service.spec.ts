import { BadRequestException } from '@nestjs/common';
import { PlatformService } from './platform.service';

describe('PlatformService provider config hardening', () => {
  let service: PlatformService;
  let prisma: any;
  let auditService: { record: jest.Mock };

  const makeQueue = () => ({
    getJobCounts: jest.fn(),
    isPaused: jest.fn(),
    getWorkers: jest.fn(),
    getFailed: jest.fn(),
    getJob: jest.fn(),
  });

  beforeEach(() => {
    prisma = {
      providerConfig: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    auditService = { record: jest.fn().mockResolvedValue({}) };

    service = new PlatformService(
      prisma,
      auditService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      makeQueue() as any,
      makeQueue() as any,
      makeQueue() as any,
      makeQueue() as any,
      makeQueue() as any,
    );
  });

  it('returns an empty provider list when ProviderConfig delegate is unavailable', async () => {
    service = new PlatformService(
      {} as any,
      auditService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      makeQueue() as any,
      makeQueue() as any,
      makeQueue() as any,
      makeQueue() as any,
      makeQueue() as any,
    );

    await expect(service.listProviders()).resolves.toEqual([]);
  });

  it('lists providers through secret-safe summaries only', async () => {
    const provider = {
      id: 'provider-1',
      type: 'SMS',
      name: 'sparrow',
      enabled: true,
      environment: 'TEST',
      configEncrypted: {
        apiKey: 'encrypted-api-key',
        senderId: 'SchoolOS',
      },
      secretKeys: ['apiKey'],
      createdAt: new Date('2026-05-01T00:00:00.000Z'),
      updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    };
    prisma.providerConfig.findMany.mockResolvedValue([provider]);
    jest.spyOn(service as any, 'toProviderSummary').mockReturnValue({
      id: 'provider-1',
      type: 'SMS',
      name: 'sparrow',
      enabled: true,
      environment: 'TEST',
      config: {
        apiKey: '********',
        senderId: 'SchoolOS',
      },
      secretKeys: ['apiKey'],
    });

    await expect(service.listProviders()).resolves.toEqual([
      {
        id: 'provider-1',
        type: 'SMS',
        name: 'sparrow',
        enabled: true,
        environment: 'TEST',
        config: {
          apiKey: '********',
          senderId: 'SchoolOS',
        },
        secretKeys: ['apiKey'],
      },
    ]);

    expect(prisma.providerConfig.findMany).toHaveBeenCalledWith({
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
    expect((service as any).toProviderSummary).toHaveBeenCalledWith(provider);
  });

  it('encrypts configured secret keys before persistence and audits masked summaries only', async () => {
    const dto = {
      type: 'SMS' as const,
      name: 'sparrow',
      enabled: true,
      environment: 'TEST' as const,
      config: {
        apiKey: 'raw-secret-value',
        senderId: 'SchoolOS',
      },
      secretKeys: ['apiKey'],
    };
    const persisted = {
      id: 'provider-1',
      type: 'SMS',
      name: 'sparrow',
      enabled: true,
      environment: 'TEST',
      configEncrypted: {
        apiKey: 'encrypted-secret-value',
        senderId: 'SchoolOS',
      },
      secretKeys: ['apiKey'],
    };

    prisma.providerConfig.findUnique.mockResolvedValue(null);
    prisma.providerConfig.upsert.mockResolvedValue(persisted);
    jest
      .spyOn(service as any, 'validateProvider')
      .mockImplementation(() => undefined);
    jest.spyOn(service as any, 'encryptProviderConfig').mockReturnValue({
      apiKey: 'encrypted-secret-value',
      senderId: 'SchoolOS',
    });
    jest.spyOn(service as any, 'toProviderSummary').mockReturnValue({
      id: 'provider-1',
      type: 'SMS',
      name: 'sparrow',
      enabled: true,
      environment: 'TEST',
      config: {
        apiKey: '********',
        senderId: 'SchoolOS',
      },
      secretKeys: ['apiKey'],
    });

    await expect(
      service.upsertProvider(dto, 'platform-user-1'),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'provider-1',
        config: expect.objectContaining({ apiKey: '********' }),
      }),
    );

    expect((service as any).encryptProviderConfig).toHaveBeenCalledWith(
      dto.config,
      ['apiKey'],
    );
    expect(prisma.providerConfig.upsert).toHaveBeenCalledWith({
      where: {
        type_name_environment: {
          type: 'SMS',
          name: 'sparrow',
          environment: 'TEST',
        },
      },
      update: {
        enabled: true,
        configEncrypted: {
          apiKey: 'encrypted-secret-value',
          senderId: 'SchoolOS',
        },
        secretKeys: ['apiKey'],
        updatedBy: 'platform-user-1',
      },
      create: {
        type: 'SMS',
        name: 'sparrow',
        enabled: true,
        environment: 'TEST',
        configEncrypted: {
          apiKey: 'encrypted-secret-value',
          senderId: 'SchoolOS',
        },
        secretKeys: ['apiKey'],
        updatedBy: 'platform-user-1',
      },
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'provider_config_updated',
        resource: 'provider_config',
        resourceId: 'provider-1',
        tenantId: 'platform',
        userId: 'platform-user-1',
        before: null,
        after: expect.objectContaining({
          config: expect.objectContaining({ apiKey: '********' }),
        }),
      }),
    );
    const auditPayload = JSON.stringify(auditService.record.mock.calls[0][0]);
    expect(auditPayload).not.toContain('raw-secret-value');
    expect(auditPayload).not.toContain('encrypted-secret-value');
  });

  it('auto-detects secret-like config keys when explicit secretKeys are not supplied', async () => {
    const dto = {
      type: 'EMAIL' as const,
      name: 'smtp',
      enabled: true,
      environment: 'TEST' as const,
      config: {
        password: 'raw-password',
        host: 'smtp.local',
      },
    };
    const persisted = {
      id: 'provider-2',
      type: 'EMAIL',
      name: 'smtp',
      enabled: true,
      environment: 'TEST',
      configEncrypted: {
        password: 'encrypted-password',
        host: 'smtp.local',
      },
      secretKeys: ['password'],
    };

    prisma.providerConfig.findUnique.mockResolvedValue(null);
    prisma.providerConfig.upsert.mockResolvedValue(persisted);
    jest
      .spyOn(service as any, 'validateProvider')
      .mockImplementation(() => undefined);
    jest
      .spyOn(service as any, 'detectSecretKeys')
      .mockReturnValue(['password']);
    jest.spyOn(service as any, 'encryptProviderConfig').mockReturnValue({
      password: 'encrypted-password',
      host: 'smtp.local',
    });
    jest.spyOn(service as any, 'toProviderSummary').mockReturnValue({
      id: 'provider-2',
      type: 'EMAIL',
      name: 'smtp',
      enabled: true,
      environment: 'TEST',
      config: {
        password: '********',
        host: 'smtp.local',
      },
      secretKeys: ['password'],
    });

    await service.upsertProvider(dto, 'platform-user-1');

    expect((service as any).detectSecretKeys).toHaveBeenCalledWith(dto.config);
    expect((service as any).encryptProviderConfig).toHaveBeenCalledWith(
      dto.config,
      ['password'],
    );
    expect(prisma.providerConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ secretKeys: ['password'] }),
        update: expect.objectContaining({ secretKeys: ['password'] }),
      }),
    );
  });

  it('preserves existing encrypted secret values when edited form posts masked secrets', async () => {
    const before = {
      id: 'provider-1',
      type: 'SMS',
      name: 'sparrow',
      enabled: true,
      environment: 'TEST',
      configEncrypted: {
        apiKey: 'encrypted-original-secret',
        senderId: 'SchoolOS',
      },
      secretKeys: ['apiKey'],
    };
    const persisted = {
      ...before,
      configEncrypted: {
        apiKey: 'encrypted-original-secret',
        senderId: 'SchoolOS Nepal',
      },
    };

    prisma.providerConfig.findUnique.mockResolvedValue(before);
    prisma.providerConfig.upsert.mockResolvedValue(persisted);
    jest
      .spyOn(service as any, 'validateProvider')
      .mockImplementation(() => undefined);
    jest.spyOn(service as any, 'encryptProviderConfig').mockReturnValue({
      apiKey: 'encrypted-masked-value',
      senderId: 'SchoolOS Nepal',
    });
    jest.spyOn(service as any, 'toProviderSummary').mockReturnValue({
      id: 'provider-1',
      config: { apiKey: '********', senderId: 'SchoolOS Nepal' },
      secretKeys: ['apiKey'],
    });

    await service.upsertProvider(
      {
        type: 'SMS',
        name: 'sparrow',
        enabled: true,
        environment: 'TEST',
        config: { apiKey: '********', senderId: 'SchoolOS Nepal' },
        secretKeys: ['apiKey'],
      },
      'platform-user-1',
    );

    expect(prisma.providerConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          configEncrypted: {
            apiKey: 'encrypted-original-secret',
            senderId: 'SchoolOS Nepal',
          },
        }),
      }),
    );
  });

  it('updates provider enabled status without rewriting provider config secrets', async () => {
    const before = {
      id: 'provider-1',
      type: 'SMS',
      name: 'sparrow',
      enabled: true,
      environment: 'TEST',
      configEncrypted: { apiKey: 'encrypted-original-secret' },
      secretKeys: ['apiKey'],
    };
    prisma.providerConfig.findUnique.mockResolvedValue(before);
    prisma.providerConfig.update.mockResolvedValue({
      ...before,
      enabled: false,
    });
    jest
      .spyOn(service as any, 'toProviderSummary')
      .mockImplementation((provider: any) => ({
        id: provider.id,
        enabled: provider.enabled,
        config: { apiKey: '********' },
        secretKeys: ['apiKey'],
      }));

    await service.updateProviderStatus(
      'provider-1',
      false,
      'platform-user-1',
      'Rotating provider credentials',
    );

    expect(prisma.providerConfig.update).toHaveBeenCalledWith({
      where: { id: 'provider-1' },
      data: {
        enabled: false,
        updatedBy: 'platform-user-1',
      },
    });
    expect(prisma.providerConfig.upsert).not.toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'provider_config_disabled',
        resource: 'provider_config',
        resourceId: 'provider-1',
      }),
    );
  });

  it('rejects unsafe provider configurations before persistence', async () => {
    jest.spyOn(service as any, 'validateProvider').mockImplementation(() => {
      throw new BadRequestException('Provider config is invalid');
    });

    await expect(
      service.upsertProvider(
        {
          type: 'OBJECT_STORAGE',
          name: 'r2',
          enabled: true,
          environment: 'PRODUCTION',
          config: {},
        },
        'platform-user-1',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.providerConfig.findUnique).not.toHaveBeenCalled();
    expect(prisma.providerConfig.upsert).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('dry-runs object storage readiness without paid or unsafe external calls', async () => {
    const provider = {
      id: 'storage-provider-1',
      type: 'OBJECT_STORAGE',
      name: 'r2',
      enabled: true,
      environment: 'PRODUCTION',
      configEncrypted: {
        bucket: 'schoolos-private',
        region: 'auto',
        endpoint: 'https://account.r2.cloudflarestorage.com',
        accessKeyId: 'encrypted-access-key',
        secretAccessKey: 'encrypted-secret-key',
      },
      secretKeys: ['accessKeyId', 'secretAccessKey'],
      updatedAt: new Date('2026-05-17T00:00:00.000Z'),
      lastValidatedAt: null,
      validationStatus: null,
    };
    prisma.providerConfig.findUnique.mockResolvedValue(provider);
    prisma.providerConfig.update.mockResolvedValue({
      ...provider,
      validationStatus: 'OK',
      lastValidatedAt: new Date('2026-05-17T00:00:00.000Z'),
    });

    await expect(
      service.testProviderConnection('storage-provider-1', 'platform-user-1'),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'ready',
        mode: 'dry_run',
        missingKeys: [],
        paidExternalCallSkipped: true,
        secretKeysMasked: ['accessKeyId', 'secretAccessKey'],
        message: expect.stringContaining('No external bucket call was made'),
        provider: expect.objectContaining({
          config: expect.objectContaining({
            accessKeyId: '********',
            secretAccessKey: '********',
          }),
        }),
      }),
    );

    expect(prisma.providerConfig.update).toHaveBeenCalledWith({
      where: { id: 'storage-provider-1' },
      data: expect.objectContaining({ validationStatus: 'READY' }),
    });
    const auditPayload = JSON.stringify(auditService.record.mock.calls[0][0]);
    expect(auditPayload).not.toContain('encrypted-access-key');
    expect(auditPayload).not.toContain('encrypted-secret-key');
  });

  it('returns provider readiness failure details without exposing secrets', async () => {
    const provider = {
      id: 'sms-provider-1',
      type: 'SMS',
      name: 'sparrow',
      enabled: true,
      environment: 'PRODUCTION',
      configEncrypted: {
        senderId: 'SchoolOS',
        apiToken: '',
      },
      secretKeys: ['apiToken'],
      updatedAt: new Date('2026-05-17T00:00:00.000Z'),
      lastValidatedAt: new Date('2026-05-17T01:00:00.000Z'),
      validationStatus: 'ERROR',
    };
    prisma.providerConfig.findUnique.mockResolvedValue(provider);
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'audit-1',
        action: 'provider_connection_tested',
        after: {
          status: 'error',
          message: 'Provider configuration is missing required keys: apiToken.',
          secretValue: 'raw-secret-should-not-be-projected',
        },
        createdAt: new Date('2026-05-17T01:00:00.000Z'),
      },
    ]);

    const detail = await service.getProviderReadinessDetail('sms-provider-1');

    expect(detail).toEqual(
      expect.objectContaining({
        status: 'failed',
        missingKeys: ['apiToken'],
        provider: expect.objectContaining({
          config: { senderId: 'SchoolOS', apiToken: '********' },
        }),
        recentAudit: [
          {
            id: 'audit-1',
            action: 'provider_connection_tested',
            createdAt: '2026-05-17T01:00:00.000Z',
            status: 'error',
            message:
              'Provider configuration is missing required keys: apiToken.',
          },
        ],
      }),
    );
    expect(JSON.stringify(detail)).not.toContain(
      'raw-secret-should-not-be-projected',
    );
  });

  it('marks disabled providers as blocked without requiring external validation', async () => {
    const provider = {
      id: 'email-provider-1',
      type: 'EMAIL',
      name: 'smtp',
      enabled: false,
      environment: 'PRODUCTION',
      configEncrypted: {
        apiToken: 'encrypted-token',
        fromEmail: 'noreply@schoolos.test',
      },
      secretKeys: ['apiToken'],
      updatedAt: new Date('2026-05-17T00:00:00.000Z'),
      lastValidatedAt: null,
      validationStatus: null,
    };
    prisma.providerConfig.findUnique.mockResolvedValue(provider);
    prisma.providerConfig.update.mockResolvedValue(provider);

    await expect(
      service.testProviderConnection('email-provider-1', 'platform-user-1'),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'degraded',
        mode: 'disabled',
        paidExternalCallSkipped: true,
        message: expect.stringContaining('Provider is disabled'),
      }),
    );
    expect(prisma.providerConfig.update).toHaveBeenCalledWith({
      where: { id: 'email-provider-1' },
      data: expect.objectContaining({ validationStatus: 'DEGRADED' }),
    });
  });
});
