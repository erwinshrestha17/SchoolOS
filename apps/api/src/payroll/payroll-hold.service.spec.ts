import { Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { PayrollHoldService } from './payroll-hold.service';

jest.mock('../auth/school-authorization-transaction', () => ({
  withSchoolAuthorizationTransaction: jest.fn(
    async (
      prisma: { __tx: unknown },
      _actor: unknown,
      _permission: unknown,
      _scopes: unknown,
      work: (tx: unknown) => Promise<unknown>,
    ) => work(prisma.__tx),
  ),
}));

const actor = (permissions: string[], userId = 'user-a'): AuthContext => ({
  userId,
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  email: 'a@school.test',
  roles: ['payroll_preparer'],
  permissions,
  authMethod: 'PASSWORD',
});

const holdRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'hold-1',
  payrollRunId: 'run-1',
  staffId: 'staff-1',
  status: 'ACTIVE',
  reason: 'Bank query',
  createdAt: new Date('2026-10-20T00:00:00.000Z'),
  createdById: 'user-a',
  releasedAt: null,
  releasedById: null,
  releaseReason: null,
  staff: { firstName: 'Sita', lastName: 'Sharma', employeeId: 'EMP-1' },
  ...overrides,
});

function build(overrides: { createError?: Error; lineExists?: boolean } = {}) {
  const tx = {
    payrollHold: {
      create: jest.fn(async () => {
        if (overrides.createError) throw overrides.createError;
        return holdRow();
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirstOrThrow: jest.fn().mockResolvedValue(
        holdRow({
          status: 'RELEASED',
          releasedById: 'user-b',
          releasedAt: new Date('2026-10-21T00:00:00.000Z'),
          releaseReason: 'Resolved',
        }),
      ),
    },
  };
  const prisma = {
    __tx: tx,
    payrollRun: { findFirst: jest.fn().mockResolvedValue({ id: 'run-1' }) },
    payrollLine: {
      findFirst: jest
        .fn()
        .mockResolvedValue(overrides.lineExists === false ? null : { id: 'l' }),
    },
    payrollHold: {
      findFirst: jest.fn().mockResolvedValue(holdRow()),
      findMany: jest.fn().mockResolvedValue([holdRow()]),
    },
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  return {
    service: new PayrollHoldService(prisma as never, audit as never),
    prisma,
    tx,
    audit,
  };
}

describe('PayrollHoldService', () => {
  it('requires the create permission and a line in the run', async () => {
    const { service } = build();
    await expect(
      service.create(
        'run-1',
        { staffId: 'staff-1', reason: 'Bank query' },
        actor(['payroll:run:read']),
      ),
    ).rejects.toMatchObject({
      response: { code: 'DOMAIN_AUTHORIZATION_DENIED' },
    });
    const missing = build({ lineExists: false });
    await expect(
      missing.service.create(
        'run-1',
        { staffId: 'staff-9', reason: 'Bank query' },
        actor(['payroll:hold:create']),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('places a hold under the actor and audits it with the reason', async () => {
    const { service, tx, audit } = build();
    const result = await service.create(
      'run-1',
      { staffId: 'staff-1', reason: 'Bank query' },
      actor(['payroll:hold:create']),
    );
    expect(tx.payrollHold.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          tenantId: 'tenant-1',
          payrollRunId: 'run-1',
          staffId: 'staff-1',
          reason: 'Bank query',
          createdById: 'user-a',
        },
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create',
        resource: 'payroll_hold',
        tenantId: 'tenant-1',
        userId: 'user-a',
      }),
      tx,
    );
    expect(result).toMatchObject({
      id: 'hold-1',
      staffName: 'Sita Sharma',
      status: 'ACTIVE',
    });
  });

  it('maps database refusals to stable conflict codes', async () => {
    const duplicate = build({
      createError: new Error('violates unique "PayrollHold_one_active"'),
    });
    await expect(
      duplicate.service.create(
        'run-1',
        { staffId: 'staff-1', reason: 'Bank query' },
        actor(['payroll:hold:create']),
      ),
    ).rejects.toMatchObject({
      response: { code: 'PAYROLL_HOLD_ALREADY_ACTIVE' },
    });

    const p2002 = build({
      createError: new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    });
    await expect(
      p2002.service.create(
        'run-1',
        { staffId: 'staff-1', reason: 'Bank query' },
        actor(['payroll:hold:create']),
      ),
    ).rejects.toMatchObject({
      response: { code: 'PAYROLL_HOLD_ALREADY_ACTIVE' },
    });

    const notAllowed = build({
      createError: new Error('PAYROLL_HOLD_NOT_ALLOWED'),
    });
    await expect(
      notAllowed.service.create(
        'run-1',
        { staffId: 'staff-1', reason: 'Bank query' },
        actor(['payroll:hold:create']),
      ),
    ).rejects.toMatchObject({ response: { code: 'PAYROLL_HOLD_NOT_ALLOWED' } });
  });

  it('refuses to let the creator release their own hold', async () => {
    const { service, tx } = build();
    await expect(
      service.release(
        'run-1',
        'hold-1',
        { reason: 'Resolved' },
        actor(['payroll:hold:release'], 'user-a'),
      ),
    ).rejects.toMatchObject({ response: { code: 'SELF_APPROVAL_PROHIBITED' } });
    expect(tx.payrollHold.updateMany).not.toHaveBeenCalled();
  });

  it('releases a hold as a different, authorized user and audits it', async () => {
    const { service, tx, audit } = build();
    const result = await service.release(
      'run-1',
      'hold-1',
      { reason: 'Resolved' },
      actor(['payroll:hold:release'], 'user-b'),
    );
    expect(tx.payrollHold.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'hold-1', tenantId: 'tenant-1', status: 'ACTIVE' },
        data: expect.objectContaining({
          status: 'RELEASED',
          releasedById: 'user-b',
          releaseReason: 'Resolved',
        }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'release', resourceId: 'hold-1' }),
      tx,
    );
    expect(result.status).toBe('RELEASED');
  });

  it('is tenant-scoped and refuses releasing an unknown or already released hold', async () => {
    const { service, prisma } = build();
    prisma.payrollHold.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.release(
        'run-1',
        'hold-x',
        { reason: 'Resolved' },
        actor(['payroll:hold:release'], 'user-b'),
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(prisma.payrollHold.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'hold-x', payrollRunId: 'run-1', tenantId: 'tenant-1' },
      }),
    );
    prisma.payrollHold.findFirst.mockResolvedValueOnce(
      holdRow({ status: 'RELEASED' }),
    );
    await expect(
      service.release(
        'run-1',
        'hold-1',
        { reason: 'Resolved' },
        actor(['payroll:hold:release'], 'user-b'),
      ),
    ).rejects.toMatchObject({ response: { code: 'PAYROLL_HOLD_NOT_ACTIVE' } });
  });

  it('lists holds for a run in the actor tenant only', async () => {
    const { service, prisma } = build();
    const rows = await service.list('run-1', actor(['payroll:run:read']));
    expect(rows).toHaveLength(1);
    expect(prisma.payrollHold.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', payrollRunId: 'run-1' },
      }),
    );
  });
});
