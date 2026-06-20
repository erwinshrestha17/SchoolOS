import type { AuthContext } from '../auth/auth.types';
import { MobileAdmissionsSummaryService } from './mobile-admissions-summary.service';

const actor = { tenantId: 'tenant-a' } as AuthContext;

describe('MobileAdmissionsSummaryService', () => {
  it('returns only purpose-limited leadership counts and tenant-scoped IEMIS follow-up', async () => {
    const totals: Record<string, number> = {
      WAITING_FOR_REVIEW: 2,
      APPROVED: 1,
      DOCUMENTS_PENDING: 3,
      DUPLICATE_WARNINGS: 4,
    };
    const queues = {
      list: jest
        .fn()
        .mockImplementation((_actor: AuthContext, query: { queue: string }) =>
          Promise.resolve({ total: totals[query.queue] ?? 0 }),
        ),
    };
    const prisma = {
      student: { count: jest.fn().mockResolvedValue(5) },
    };
    const service = new MobileAdmissionsSummaryService(
      queues as never,
      prisma as never,
    );

    const result = await service.getPrincipalSummary(actor);

    expect(result.metrics).toEqual({
      waitingForReview: 2,
      approvedReadyToAdmit: 1,
      documentsPending: 3,
      duplicateWarnings: 4,
      iemisFollowUp: 5,
    });
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'iemis-follow-up' }),
      ]),
    );
    expect(prisma.student.count).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-a',
        lifecycleStatus: 'ACTIVE',
        nationalStudentId: null,
      },
    });
    expect(JSON.stringify(result)).not.toMatch(
      /guardianPhone|notes|objectKey|provider|token/i,
    );
  });
});
