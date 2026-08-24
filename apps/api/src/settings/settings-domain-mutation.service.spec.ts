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
  interface AuditCreateInput {
    data: {
      tenantId: string;
      userId: string;
      action: string;
      resource: string;
      resourceId: string;
      requestId: string;
      before: { changedKeys: string[]; [key: string]: unknown };
      after: {
        changedKeys: string[];
        reason: string;
        [key: string]: unknown;
      };
    };
  }
  interface TenantSettingFindManyInput {
    where?: { tenantId?: string };
  }
  let createdAudit: AuditCreateInput | null = null;
  const beforeRows = existing.map((item) => ({
    ...item,
    updatedAt: new Date(item.updatedAt),
  }));
  const afterRows = (
    options?.after ?? [
      {
        ...existing[0],
        value: 'REC-',
        updatedAt: '2026-08-22T01:00:00.000Z',
      },
      existing[1],
    ]
  ).map((item) => ({ ...item, updatedAt: new Date(item.updatedAt) }));
  const findMany = jest
    .fn((input: TenantSettingFindManyInput) => {
      void input;
      return Promise.resolve(beforeRows);
    })
    .mockResolvedValueOnce(beforeRows)
    .mockResolvedValueOnce(afterRows);
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    auditLog: {
      findFirst: jest.fn().mockResolvedValue(options?.prior ?? null),
      create: jest.fn((input: AuditCreateInput) => {
        createdAudit = input;
        return Promise.resolve({});
      }),
    },
    tenantSetting: {
      findMany,
      upsert: jest.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    $transaction: jest.fn((work: (client: typeof tx) => unknown) => work(tx)),
  };
  return {
    service: new SettingsDomainMutationService(prisma as never),
    prisma,
    tx,
    createdAudit: () => createdAudit,
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
        {
          ...payload,
          changes: [{ key: 'default_notice_channel', value: 'SMS' }],
        },
        auth(['settings:read', 'settings:finance:manage']),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.updateDomain('finance', payload, auth(['settings:read'])),
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

    const firstFindManyCall = tx.tenantSetting.findMany.mock.calls[0]?.[0];
    expect(firstFindManyCall?.where?.tenantId).toBe('tenant-1');
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
    const auditCall = tx.auditLog.create.mock.calls[0]?.[0];
    expect(auditCall?.data).toMatchObject({
      tenantId: 'tenant-1',
      userId: 'owner-1',
      action: 'settings_domain_updated',
      resource: 'settings_domain',
      resourceId: 'finance',
      requestId: payload.idempotencyKey,
      before: {
        changedKeys: ['receipt_number_prefix'],
      },
      after: {
        changedKeys: ['receipt_number_prefix'],
        reason: payload.reason,
      },
    });
    expect(result).toMatchObject({
      success: true,
      domain: 'finance',
      changedKeys: ['receipt_number_prefix'],
      replayed: false,
    });
  });

  it('replays a committed idempotency key without performing duplicate writes', async () => {
    const initial = buildService();
    await initial.service.updateDomain(
      'finance',
      payload,
      auth(['settings:read', 'settings:finance:manage']),
    );
    const committed = initial.createdAudit();
    expect(committed).not.toBeNull();
    if (!committed) throw new Error('Expected a committed settings audit row');

    const { service, tx } = buildService({
      prior: {
        resourceId: 'finance',
        after: committed.data.after,
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

  it.each([
    {
      changedPart: 'reason',
      replayPayload: {
        ...payload,
        reason: 'A materially different settings update',
      },
    },
    {
      changedPart: 'setting value',
      replayPayload: {
        ...payload,
        changes: [{ key: 'receipt_number_prefix', value: 'ALT-' }],
      },
    },
    {
      changedPart: 'expected version',
      replayPayload: {
        ...payload,
        expectedVersion: 'receipt_number_prefix@2099-01-01T00:00:00.000Z',
      },
    },
  ])(
    'rejects reuse of an idempotency key with a different $changedPart',
    async ({ replayPayload }) => {
      const initial = buildService();
      await initial.service.updateDomain(
        'finance',
        payload,
        auth(['settings:read', 'settings:finance:manage']),
      );
      const committed = initial.createdAudit();
      expect(committed).not.toBeNull();
      if (!committed)
        throw new Error('Expected a committed settings audit row');
      const replay = buildService({
        prior: {
          resourceId: 'finance',
          after: committed.data.after,
        },
      });

      await expect(
        replay.service.updateDomain(
          'finance',
          replayPayload,
          auth(['settings:read', 'settings:finance:manage']),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(replay.tx.tenantSetting.findMany).not.toHaveBeenCalled();
      expect(replay.tx.tenantSetting.upsert).not.toHaveBeenCalled();
      expect(replay.tx.auditLog.create).not.toHaveBeenCalled();
    },
  );
});
