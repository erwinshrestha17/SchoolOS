import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PlatformApiKeysService } from './platform-api-keys.service';

describe('PlatformApiKeysService', () => {
  let service: PlatformApiKeysService;
  let prisma: any;
  let auditService: { record: jest.Mock };

  beforeEach(() => {
    prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ id: 'tenant-1' }),
      },
      platformApiKey: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    auditService = { record: jest.fn().mockResolvedValue({}) };
    const configService = {
      tokenHashPepper: 'mock-pepper-for-tests-at-least-32-chars-long-12345',
    };
    service = new PlatformApiKeysService(
      prisma,
      auditService as any,
      configService as any,
    );
  });

  it('creates tenant-scoped API keys with one-time secret reveal and hashed persistence', async () => {
    const created = apiKeyRecord({
      id: 'api-key-1',
      prefix: 'sk_schoolos_abcd1234',
      keySuffix: 'wxyz',
      scopes: ['students:read', 'attendance:read'],
      createdBy: 'platform-user-1',
    });
    prisma.platformApiKey.create.mockResolvedValue(created);

    const result = await service.createApiKey(
      'tenant-1',
      {
        name: 'Read integration',
        scopes: ['students:read', 'students:read', 'attendance:read'],
      },
      'platform-user-1',
    );

    expect(result.secret).toMatch(/^sk_schoolos_/);
    expect(result.keyPreview).toBe('sk_schoolos_abcd1234...wxyz');
    expect(prisma.platformApiKey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          name: 'Read integration',
          keyHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          scopes: ['students:read', 'attendance:read'],
          createdBy: 'platform-user-1',
        }),
      }),
    );
    expect(
      prisma.platformApiKey.create.mock.calls[0][0].data,
    ).not.toHaveProperty('secret');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'platform_api_key_created',
        resource: 'api_keys',
        tenantId: 'tenant-1',
        userId: 'platform-user-1',
        after: expect.not.objectContaining({
          secret: expect.any(String),
          keyHash: expect.any(String),
        }),
      }),
    );
  });

  it('lists API keys without exposing hashes or full secrets', async () => {
    prisma.platformApiKey.findMany.mockResolvedValue([
      apiKeyRecord({
        id: 'api-key-1',
        prefix: 'sk_schoolos_abcd1234',
        keySuffix: 'wxyz',
      }),
    ]);

    await expect(service.listApiKeys('tenant-1')).resolves.toEqual([
      expect.objectContaining({
        id: 'api-key-1',
        tenantId: 'tenant-1',
        keyPreview: 'sk_schoolos_abcd1234...wxyz',
      }),
    ]);
    expect(prisma.platformApiKey.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      orderBy: { createdAt: 'desc' },
      select: expect.not.objectContaining({ keyHash: true }),
    });
  });

  it('retries unique key collisions without exposing Prisma errors', async () => {
    prisma.platformApiKey.create
      .mockRejectedValueOnce({ code: 'P2002' })
      .mockResolvedValueOnce(apiKeyRecord({ id: 'api-key-2' }));

    await expect(
      service.createApiKey(
        'tenant-1',
        { name: 'Collision safe key' },
        'platform-user-1',
      ),
    ).resolves.toEqual(expect.objectContaining({ id: 'api-key-2' }));
    expect(prisma.platformApiKey.create).toHaveBeenCalledTimes(2);
  });

  it('revokes only keys inside the requested tenant boundary and audits the reason', async () => {
    const existing = apiKeyRecord({ id: 'api-key-1' });
    const revoked = apiKeyRecord({
      id: 'api-key-1',
      status: 'REVOKED',
      revokedAt: new Date('2026-05-24T10:00:00.000Z'),
    });
    prisma.platformApiKey.findFirst.mockResolvedValue(existing);
    prisma.platformApiKey.update.mockResolvedValue(revoked);

    const result = await service.revokeApiKey(
      'tenant-1',
      'api-key-1',
      { reason: 'Rotated integration owner' },
      'platform-user-1',
    );

    expect(result.status).toBe('REVOKED');
    expect(prisma.platformApiKey.findFirst).toHaveBeenCalledWith({
      where: { id: 'api-key-1', tenantId: 'tenant-1' },
      select: expect.any(Object),
    });
    expect(prisma.platformApiKey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'api-key-1' },
        data: expect.objectContaining({
          status: 'REVOKED',
          revokedBy: 'platform-user-1',
          revokeReason: 'Rotated integration owner',
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'platform_api_key_revoked',
        resource: 'api_keys',
        tenantId: 'tenant-1',
        userId: 'platform-user-1',
      }),
    );
  });

  it('returns safe errors for missing tenants, past expiries, and already revoked keys', async () => {
    prisma.tenant.findUnique.mockResolvedValueOnce(null);
    await expect(service.listApiKeys('missing-tenant')).rejects.toThrow(
      NotFoundException,
    );

    await expect(
      service.createApiKey(
        'tenant-1',
        { name: 'Expired', expiresAt: '2020-01-01T00:00:00.000Z' },
        'platform-user-1',
      ),
    ).rejects.toThrow(BadRequestException);

    prisma.platformApiKey.findFirst.mockResolvedValue(
      apiKeyRecord({ status: 'REVOKED' }),
    );
    await expect(
      service.revokeApiKey(
        'tenant-1',
        'api-key-1',
        { reason: 'Already rotated' },
        'platform-user-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects keys if the tenant does not exist or is inactive', async () => {
    prisma.platformApiKey.findUnique.mockResolvedValue(
      apiKeyRecord({
        tenant: { id: 'tenant-1', isActive: false },
      }),
    );
    const result = await service.validateApiKey('sk_schoolos_validkey_123');
    expect(result).toBeNull();

    prisma.platformApiKey.findUnique.mockResolvedValue(
      apiKeyRecord({
        tenant: null,
      }),
    );
    const result2 = await service.validateApiKey('sk_schoolos_validkey_123');
    expect(result2).toBeNull();
  });

  it('rejects incorrect prefix formats during key validation', async () => {
    const result = await service.validateApiKey('invalid_prefix_key_123');
    expect(result).toBeNull();
  });
});

function apiKeyRecord(overrides: Partial<any> = {}) {
  const now = new Date('2026-05-24T09:00:00.000Z');
  return {
    id: 'api-key-1',
    tenantId: 'tenant-1',
    name: 'Read integration',
    prefix: 'sk_schoolos_prefix12',
    keySuffix: 'abcd',
    scopes: ['students:read'],
    status: 'ACTIVE',
    expiresAt: null,
    lastUsedAt: null,
    revokedAt: null,
    createdBy: 'platform-user-1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
