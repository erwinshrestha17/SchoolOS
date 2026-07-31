import {
  recordAuthorizationDenial,
  recordAuthorizationEvent,
} from './authorization-audit';

describe('authorization audit helpers', () => {
  it('records denial reasons without secrets', async () => {
    const audit = { record: jest.fn().mockResolvedValue(undefined) };

    await recordAuthorizationDenial(audit, {
      actor: { tenantId: 'tenant-a', userId: 'user-1' },
      reason: 'cross_tenant_attempt',
      resource: 'student',
      resourceId: 'student-b',
      attemptedTenantId: 'tenant-b',
      capability: 'ACADEMICS_VIEW',
    });

    expect(audit.record).toHaveBeenCalledWith({
      action: 'authorization.denied',
      resource: 'student',
      tenantId: 'tenant-a',
      userId: 'user-1',
      resourceId: 'student-b',
      after: {
        reason: 'cross_tenant_attempt',
        capability: 'ACADEMICS_VIEW',
        attemptedTenantId: 'tenant-b',
      },
    });
  });

  it('records high-value authorization lifecycle events', async () => {
    const audit = { record: jest.fn().mockResolvedValue(undefined) };

    await recordAuthorizationEvent(audit, {
      actor: { tenantId: 'tenant-a', userId: 'admin-1' },
      action: 'guardian_access.revoked',
      resource: 'guardian_relationship',
      resourceId: 'link-1',
      metadata: { studentId: 'student-1' },
    });

    expect(audit.record).toHaveBeenCalledWith({
      action: 'guardian_access.revoked',
      resource: 'guardian_relationship',
      tenantId: 'tenant-a',
      userId: 'admin-1',
      resourceId: 'link-1',
      after: { studentId: 'student-1' },
    });
  });
});
