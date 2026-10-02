import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AuthContext } from '../auth/auth.types';
import { StaffLifecycleService } from './staff-lifecycle.service';

const actorWith = (userId: string, ...permissions: string[]): AuthContext => ({
  tenantId: 'tenant',
  userId,
  tenantSlug: 'school',
  email: 'x@example.test',
  roles: [],
  permissions,
  authMethod: 'PASSWORD',
});

function build(staff: { id: string; userId: string | null } | null) {
  const findMany = jest.fn().mockResolvedValue([
    {
      id: 'e1',
      staffId: 's1',
      eventType: 'TERMINATED',
      eventDate: new Date('2026-01-01'),
      reason: 'misconduct',
      notes: 'private note',
      metadata: { case: 1 },
      createdAt: new Date('2026-01-01'),
      createdBy: { id: 'u', email: 'hr@example.test', staff: null },
    },
  ]);
  const prisma = {
    staff: { findFirst: jest.fn().mockResolvedValue(staff) },
    staffLifecycleEvent: { findMany },
  };
  const service = new StaffLifecycleService(
    prisma as never,
    { record: jest.fn() } as never,
  );
  return { service, findMany };
}

describe('StaffLifecycleService.getStaffHistory', () => {
  it('returns NotFound for a missing or cross-tenant staff member', async () => {
    const { service } = build(null);
    await expect(
      service.getStaffHistory('s1', actorWith('u', 'hr:manage')),
    ).rejects.toThrow(NotFoundException);
  });

  it('forbids a generic hr:staff:read caller who is neither owner nor manager', async () => {
    const { service, findMany } = build({ id: 's1', userId: 'owner' });
    await expect(
      service.getStaffHistory('s1', actorWith('other', 'hr:staff:read')),
    ).rejects.toThrow(ForbiddenException);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('hides reasons, notes and metadata from managers without disciplinary read', async () => {
    const { service } = build({ id: 's1', userId: 'owner' });
    const [event] = await service.getStaffHistory(
      's1',
      actorWith('hr', 'hr:manage'),
    );
    expect(event).toMatchObject({
      eventType: 'TERMINATED',
      reason: null,
      notes: null,
      metadata: null,
    });
    expect(event?.createdBy).not.toBeNull();
  });

  it('releases reasons to disciplinary readers but still hides authorship from the owner', async () => {
    const { service } = build({ id: 's1', userId: 'owner' });
    const [manager] = await service.getStaffHistory(
      's1',
      actorWith('hr', 'hr:manage', 'hr:disciplinary:read'),
    );
    expect(manager).toMatchObject({
      reason: 'misconduct',
      notes: 'private note',
    });
    const [owner] = await service.getStaffHistory('s1', actorWith('owner'));
    expect(owner).toMatchObject({ reason: null, notes: null, createdBy: null });
  });

  it('Platform actors do not pass the manager guard', async () => {
    const { service } = build({ id: 's1', userId: 'owner' });
    await expect(
      service.getStaffHistory('s1', {
        ...actorWith('hr', 'hr:manage', 'hr:disciplinary:read'),
        securityDomain: 'PLATFORM',
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});
