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
    jest.spyOn(service as any, 'validateProvider').mockImplementation(() => undefined);
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

    await expect(service.upsertProvider(dto, 'platform-user-1')).resolves.toEqual(
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
    jest.spyOn(service as any, 'validateProvider').mockImplementation(() => undefined);
    jest.spyOn(service as any, 'detectSecretKeys').mockReturnValue(['password']);
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
});
