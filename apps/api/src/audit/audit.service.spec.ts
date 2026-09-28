import { AuditService } from './audit.service';
import { randomUUID } from 'node:crypto';

describe('Authorization audit boundary', () => {
  const create = jest.fn().mockResolvedValue({ id: 'audit' });
  const prisma = {
    auditLog: { create },
    runWithoutTenantScope: (_: string, fn: () => unknown) => fn(),
  };
  const cls = { get: jest.fn() };
  const service = new AuditService(prisma as never, cls as never);
  beforeEach(() => jest.clearAllMocks());

  it('redacts nested credentials, bank and identity numbers before persistence', async () => {
    await service.record({
      tenantId: 'tenant',
      userId: 'actor',
      action: 'security_override',
      resource: 'staff',
      before: { nested: [{ passwordHash: 'hash', refreshToken: 'token' }] },
      after: {
        api_key: 'key',
        jwtSecret: 'secret',
        token_hash: 'hash',
        bankAccount: 'account',
        panNumber: 'pan',
        reason: 'Approved correction',
        effectiveAt: new Date('2026-09-27T00:00Z'),
      },
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        before: {
          nested: [{ passwordHash: '[REDACTED]', refreshToken: '[REDACTED]' }],
        },
        after: {
          api_key: '[REDACTED]',
          jwtSecret: '[REDACTED]',
          token_hash: '[REDACTED]',
          bankAccount: '[REDACTED]',
          panNumber: '[REDACTED]',
          reason: 'Approved correction',
          effectiveAt: '2026-09-27T00:00:00.000Z',
        },
        userId: 'actor',
        tenantId: 'tenant',
        requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      }),
    });
  });

  it('retains valid request correlation and attributes background events without a fabricated user', async () => {
    const requestId = randomUUID();
    cls.get.mockReturnValue(requestId);
    await service.record({
      tenantId: 'tenant',
      action: 'posting_retry',
      resource: 'payment',
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: null, requestId }),
    });
  });

  it('writes through the supplied transaction and propagates a storage failure', async () => {
    const failedCreate = jest
      .fn()
      .mockRejectedValue(new Error('audit unavailable'));
    await expect(
      service.record(
        {
          tenantId: 'tenant',
          userId: 'actor',
          action: 'approve',
          resource: 'journal_entry',
        },
        { auditLog: { create: failedCreate } } as never,
      ),
    ).rejects.toThrow('audit unavailable');
    expect(create).not.toHaveBeenCalled();
  });
});
