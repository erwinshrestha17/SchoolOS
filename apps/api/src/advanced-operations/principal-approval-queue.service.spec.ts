import { AuthMethod } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { PrincipalApprovalQueueService } from './principal-approval-queue.service';

describe('PrincipalApprovalQueueService (Phase 4 SoD)', () => {
  const principal: AuthContext = {
    userId: 'principal-1',
    tenantId: 'tenant-1',
    tenantSlug: 'school',
    email: 'principal@school.test',
    authMethod: AuthMethod.PASSWORD,
    roles: ['principal'],
    permissions: ['advanced:approvals:read'],
  };

  const request = (
    id: string,
    step: { approverRole: string | null; approverPermission: string | null },
    delegatedToId: string | null = null,
  ) => ({
    id,
    delegatedToId,
    createdAt: new Date('2026-09-20T00:00:00Z'),
    steps: [{ id: `${id}-s1`, sequence: 1, status: 'PENDING', ...step }],
  });

  function makeService(rows: unknown[]) {
    const findMany = jest.fn().mockResolvedValue(rows);
    const service = new PrincipalApprovalQueueService({
      approvalRequest: { findMany },
    } as never);
    return { service, findMany };
  }

  it("never lists the actor's own requests as reviewable", async () => {
    const { service, findMany } = makeService([]);

    await service.list(principal, {});

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          requestedById: { not: 'principal-1' },
        }),
      }),
    );
  });

  it('lists only requests whose current step the principal may decide', async () => {
    const { service } = makeService([
      request('mine', { approverRole: 'principal', approverPermission: null }),
      request('accounts', {
        approverRole: 'accountant',
        approverPermission: null,
      }),
      request(
        'delegated-away',
        { approverRole: 'principal', approverPermission: null },
        'someone-else',
      ),
    ]);

    const page = await service.list(principal, {});

    expect(page.items.map((item) => item.id)).toEqual(['mine']);
  });
});
