import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { AuthMethod } from '@prisma/client';
import {
  PRINCIPAL_PERMISSION_KEYS,
  buildSchoolSettingsDomainVersion,
  type TenantSettingSummary,
} from '@schoolos/core';
import type { AuthContext } from '../auth/auth.types';
import { SettingsDomainMutationService } from './settings-domain-mutation.service';

const auth = (
  permissions: string[],
  roles: string[] = ['school_config_owner'],
): AuthContext => ({
  userId: 'owner-1',
  tenantId: 'tenant-1',
  tenantSlug: 'green-valley',
  email: 'owner@school.test',
  authMethod: 'PASSWORD' as AuthMethod,
  roles,
  permissions,
});

const existing: TenantSettingSummary[] = [
  {
    key: 'receipt_number_prefix',
    value: 'OLD-',
    updatedAt: '2026-08-22T00:00:00.000Z',
  },
  {
    key: 'cashier_close_required',
    value: true,
    updatedAt: '2026-08-22T00:00:00.000Z',
  },
];

function buildService(options?: {
  prior?: { resourceId: string; after: unknown } | null;
  after?: TenantSettingSummary[];
}) {
  const beforeRows = existing.map((item) => ({
    ...item,
    updatedAt: new Date(item.updatedAt),
  }));
  const afterRows = (options?.after ?? [
    {
      ...existing[0],
      value: 'REC-',
      updatedAt: '2026-08-22T01:00:00.000Z',
    },
    existing[1],
  ]).map((item) => ({ ...item, updatedAt: new Date(item.updatedAt) }));
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    auditLog: {
      findFirst: jest.fn().mockResolvedValue(options?.prior ?? null),
      create: jest.fn().mockResolvedValue({}),
    },
    tenantSetting: {
      findMany: jest
        .fn()
        .mockResolvedValueOnce(beforeRows)
        .mockResolvedValueOnce(afterRows),
      upsert: jest.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (work: (client: typeof tx) => unknown) =>
      work(tx),
    ),
  };
  return {
    service: new SettingsDomainMutationService(prisma as never),
    prisma,
    tx,
  };
}

const payload = {
  expectedVersion: buildSchoolSettingsDomainVersion(existing, 'finance'),
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
  reason: 'Update receipt policy for the new school year',
  changes: [{ key: 'receipt_number_prefix', value: 'REC-' }],
};

describe('SettingsDomainMutationService', () => {
  it('blocks Principal-only institutional mutations before opening a transaction', async () => {
    const { service, prisma } = buildService();
    await expect(
      service.updateDomain(
        'finance',
        payload,
        auth([...PRINCIPAL_PERMISSION_KEYS], ['principal']),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects keys outside the route domain and missing domain authority', async () => {
    const { service } = buildService();
    await expect(
      service.updateDomain(
        'finance',
        { ...payload, changes: [{ key: 'default_notice_channel', value: 'SMS' }] },
        auth(['settings:read', 'settings:finance:manage']),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.updateDomain(
        'finance',
        payload,
        auth(['settings:read']),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('fails on stale version without applying any setting', async () => {
    const { service, tx } = buildService();
    await expect(
      service.updateDomain(
        'finance',
        { ...payload, expectedVersion: 'stale' },
        auth(['settings:read', 'settings:finance:manage']),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.tenantSetting.upsert).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('atomically applies tenant-scoped changes and writes one bounded audit record', async () => {
    const { service, tx } = buildService();
    const result = await service.updateDomain(
      'finance',
      payload,
      auth(['settings:read', 'settings:finance:manage']),
    );

    expect(tx.tenantSetting.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1' }),
      }),
    );
    expect(tx.tenantSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_key: {
            tenantId: 'tenant-1',
            key: 'receipt_number_prefix',
          },
        },
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'owner-1',
        action: 'settings_domain_updated',
        resource: 'settings_domain',
        resourceId: 'finance',
        requestId: payload.idempotencyKey,
        before: expect.objectContaining({
          changedKeys: ['receipt_number_prefix'],
        }),
        after: expect.objectContaining({
          changedKeys: ['receipt_number_prefix'],
          reason: payload.reason,
        }),
      }),
    });
    expect(result).toMatchObject({
      success: true,
      domain: 'finance',
      changedKeys: ['receipt_number_prefix'],
      replayed: false,
    });
  });

  it('replays a committed idempotency key without performing duplicate writes', async () => {
    const { service, tx } = buildService({
      prior: {
        resourceId: 'finance',
        after: {
          version: 'receipt_number_prefix@2026-08-22T01:00:00.000Z',
          changedKeys: ['receipt_number_prefix'],
          reason: payload.reason,
        },
      },
    });
    const result = await service.updateDomain(
      'finance',
      payload,
      auth(['settings:read', 'settings:finance:manage']),
    );
    expect(result.replayed).toBe(true);
    expect(tx.tenantSetting.findMany).not.toHaveBeenCalled();
    expect(tx.tenantSetting.upsert).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
