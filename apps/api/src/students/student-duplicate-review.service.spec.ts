import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  AuthMethod,
  StudentDuplicateReviewStatus,
  StudentLifecycleStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { StudentDuplicateReviewService } from './student-duplicate-review.service';

const tenantId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const firstStudentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const secondStudentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const reviewId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const actor: AuthContext = {
  tenantId,
  tenantSlug: 'everest-academy',
  userId,
  email: 'admin@schoolos.test',
  authMethod: AuthMethod.PASSWORD,
  roles: ['admin'],
  permissions: ['students:manage_lifecycle'],
};

describe('StudentDuplicateReviewService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-18T02:15:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('maps a tenant-scoped paginated queue and backend-owned summary', async () => {
    const { service, prisma } = buildService();
    prisma.$queryRaw.mockResolvedValueOnce([
      candidateRow({
        reviewState: 'NOT_DUPLICATE',
        reviewId,
        reviewStatus: StudentDuplicateReviewStatus.NOT_DUPLICATE,
        reviewReason: 'Confirmed separate enrollment records',
        reviewedById: userId,
        reviewedAt: new Date('2026-07-17T08:00:00.000Z'),
        total: 3n,
        pending: 7n,
        highConfidence: 2n,
        resolvedNotDuplicate: 3n,
      }),
    ]);
    prisma.studentMergeHistory.count.mockResolvedValue(4);
    prisma.student.count.mockResolvedValue(1);
    prisma.student.findMany.mockResolvedValue([
      candidateStudent(firstStudentId, {
        firstNameEn: 'Asha',
        lastNameEn: 'Tamang',
        guardianLinks: [
          {
            guardian: {
              primaryPhone: '9800000001',
              secondaryPhone: '9800000002',
            },
          },
        ],
      }),
      candidateStudent(secondStudentId, {
        firstNameEn: 'Asha',
        lastNameEn: 'Thapa',
      }),
    ]);

    const result = await service.listCandidates(
      {
        studentId: firstStudentId,
        page: 2,
        limit: 1,
        search: '  Asha  ',
        confidence: 'HIGH',
        status: 'NOT_DUPLICATE',
      },
      actor,
    );

    expect(result).toEqual(
      expect.objectContaining({
        page: 2,
        limit: 1,
        total: 3,
        totalPages: 3,
        status: 'NOT_DUPLICATE',
        reviewedStudentId: firstStudentId,
        filters: {
          studentId: firstStudentId,
          search: 'Asha',
          confidence: 'HIGH',
          status: 'NOT_DUPLICATE',
        },
        summary: {
          pending: 7,
          highConfidence: 2,
          resolvedNotDuplicate: 3,
          mergedToday: 4,
          asOf: '2026-07-18T02:15:00.000Z',
        },
      }),
    );
    expect(result.candidates).toEqual([
      expect.objectContaining({
        sourceStudent: expect.objectContaining({
          id: firstStudentId,
          fullNameEn: 'Asha Tamang',
          dateOfBirth: '2015-04-03',
          guardianPhones: ['9800000001', '9800000002'],
        }),
        candidateStudent: expect.objectContaining({
          id: secondStudentId,
          fullNameEn: 'Asha Thapa',
        }),
        score: 80,
        confidence: 'HIGH',
        reviewState: 'NOT_DUPLICATE',
        review: expect.objectContaining({
          id: reviewId,
          status: 'NOT_DUPLICATE',
          reason: 'Confirmed separate enrollment records',
        }),
      }),
    ]);
    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId,
          id: { in: [firstStudentId, secondStudentId] },
        },
      }),
    );
    expect(prisma.student.count).toHaveBeenCalledWith({
      where: { id: firstStudentId, tenantId },
    });
    expect(prisma.studentMergeHistory.count).toHaveBeenCalledWith({
      where: {
        tenantId,
        mergedAt: {
          gte: new Date('2026-07-17T18:15:00.000Z'),
          lt: new Date('2026-07-18T18:15:00.000Z'),
        },
      },
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    for (const [sql] of prisma.$queryRaw.mock.calls) {
      expect(flattenSqlValues(sql)).toContain(tenantId);
    }
  });

  it('keeps stale review metadata visible when identity details changed', async () => {
    const { service, prisma } = buildService();
    prisma.$queryRaw.mockResolvedValueOnce([
      candidateRow({
        reviewState: 'PENDING',
        reviewId,
        reviewStatus: StudentDuplicateReviewStatus.NOT_DUPLICATE,
        reviewReason: 'Previously confirmed as separate students',
        reviewIdentityChanged: true,
        reviewedById: userId,
        reviewedAt: new Date('2026-07-17T08:00:00.000Z'),
      }),
    ]);
    prisma.studentMergeHistory.count.mockResolvedValue(0);
    prisma.student.findMany.mockResolvedValue([
      candidateStudent(firstStudentId),
      candidateStudent(secondStudentId),
    ]);

    const result = await service.listCandidates({}, actor);

    expect(result.candidates[0]).toEqual(
      expect.objectContaining({
        reviewState: 'PENDING',
        review: expect.objectContaining({
          id: reviewId,
          status: 'NOT_DUPLICATE',
          identityChanged: true,
        }),
      }),
    );
  });

  it('returns backend totals when a requested page has no candidate rows', async () => {
    const { service, prisma } = buildService();
    prisma.$queryRaw.mockResolvedValueOnce([
      {
        ...candidateRow({
          total: 21n,
          pending: 21n,
          highConfidence: 4n,
          resolvedNotDuplicate: 2n,
        }),
        sourceStudentId: null,
        candidateStudentId: null,
        score: null,
        confidence: null,
        reasons: null,
        identityFingerprint: null,
        reviewState: null,
      },
    ]);
    prisma.studentMergeHistory.count.mockResolvedValue(1);

    const result = await service.listCandidates(
      {
        page: 3,
        limit: 10,
      },
      actor,
    );

    expect(result).toEqual(
      expect.objectContaining({
        candidates: [],
        page: 3,
        total: 21,
        totalPages: 3,
        summary: expect.objectContaining({
          pending: 21,
          highConfidence: 4,
          resolvedNotDuplicate: 2,
          mergedToday: 1,
        }),
      }),
    );
    expect(prisma.student.findMany).not.toHaveBeenCalled();
  });

  it('canonicalizes a pair and writes the disposition and audit atomically', async () => {
    const { service, prisma, tx, auditService } = buildService();
    prisma.$queryRaw.mockResolvedValueOnce([candidateRow()]);
    tx.studentDuplicateReview.findUnique.mockResolvedValue(null);
    tx.studentDuplicateReview.upsert.mockResolvedValue(
      duplicateReview({
        status: StudentDuplicateReviewStatus.NOT_DUPLICATE,
        reason: 'Different guardians confirmed both records',
      }),
    );

    const result = await service.markNotDuplicate(
      {
        studentOneId: secondStudentId,
        studentTwoId: firstStudentId,
        reason: '  Different guardians confirmed both records  ',
      },
      actor,
    );

    expect(tx.studentDuplicateReview.findUnique).toHaveBeenCalledWith({
      where: {
        tenantId_firstStudentId_secondStudentId: {
          tenantId,
          firstStudentId,
          secondStudentId,
        },
      },
    });
    expect(tx.studentDuplicateReview.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_firstStudentId_secondStudentId: {
            tenantId,
            firstStudentId,
            secondStudentId,
          },
        },
        create: expect.objectContaining({
          tenantId,
          firstStudentId,
          secondStudentId,
          status: 'NOT_DUPLICATE',
          reason: 'Different guardians confirmed both records',
          identityFingerprint: 'identity-fingerprint-1',
          reviewedById: userId,
        }),
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'mark_not_duplicate',
        resource: 'student_duplicate_review',
        tenantId,
        userId,
        resourceId: reviewId,
        after: expect.objectContaining({
          firstStudentId,
          secondStudentId,
          status: 'NOT_DUPLICATE',
        }),
      }),
      tx,
    );
    expect(
      tx.studentDuplicateReview.upsert.mock.invocationCallOrder[0],
    ).toBeLessThan(auditService.record.mock.invocationCallOrder[0]);
    expect(result).toEqual({
      reviewState: 'NOT_DUPLICATE',
      review: expect.objectContaining({
        id: reviewId,
        status: 'NOT_DUPLICATE',
      }),
    });
  });

  it('rejects a disposition for the same student before querying candidates', async () => {
    const { service, prisma } = buildService();

    await expect(
      service.markNotDuplicate(
        {
          studentOneId: firstStudentId,
          studentTwoId: firstStudentId,
          reason: 'The same record cannot form a duplicate-review pair',
        },
        actor,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns an identical existing disposition without a second write or audit', async () => {
    const { service, prisma, tx, auditService } = buildService();
    const existing = duplicateReview({
      status: StudentDuplicateReviewStatus.NOT_DUPLICATE,
      reason: 'Different guardians confirmed both records',
    });
    prisma.$queryRaw.mockResolvedValueOnce([candidateRow()]);
    tx.studentDuplicateReview.findUnique.mockResolvedValue(existing);

    const result = await service.markNotDuplicate(
      {
        studentOneId: firstStudentId,
        studentTwoId: secondStudentId,
        reason: 'Different guardians confirmed both records',
      },
      actor,
    );

    expect(result.review.id).toBe(reviewId);
    expect(tx.studentDuplicateReview.upsert).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('rejects a pair that is absent from the actor tenant candidate set', async () => {
    const { service, prisma, auditService } = buildService();
    prisma.$queryRaw.mockResolvedValueOnce([]);

    await expect(
      service.markNotDuplicate(
        {
          studentOneId: firstStudentId,
          studentTwoId: secondStudentId,
          reason: 'Records belong to separate students',
        },
        actor,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(flattenSqlValues(prisma.$queryRaw.mock.calls[0][0])).toContain(
      tenantId,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('reopens a tenant-owned disposition and records the audit in its transaction', async () => {
    const { service, prisma, tx, auditService } = buildService();
    const existing = duplicateReview();
    const reopened = duplicateReview({
      status: StudentDuplicateReviewStatus.REOPENED,
      reopenedById: userId,
      reopenedAt: new Date('2026-07-18T02:15:00.000Z'),
      reopenReason: 'New guardian evidence requires another review',
    });
    tx.studentDuplicateReview.findFirst.mockResolvedValue(existing);
    tx.studentDuplicateReview.update.mockResolvedValue(reopened);

    const result = await service.reopenReview(
      reviewId,
      {
        reason: '  New guardian evidence requires another review  ',
      },
      actor,
    );

    expect(tx.studentDuplicateReview.findFirst).toHaveBeenCalledWith({
      where: { id: reviewId, tenantId },
    });
    expect(tx.studentDuplicateReview.update).toHaveBeenCalledWith({
      where: { id: reviewId },
      data: {
        status: 'REOPENED',
        reopenedById: userId,
        reopenedAt: new Date('2026-07-18T02:15:00.000Z'),
        reopenReason: 'New guardian evidence requires another review',
      },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'reopen',
        resource: 'student_duplicate_review',
        tenantId,
        userId,
        resourceId: reviewId,
        after: expect.objectContaining({
          status: 'REOPENED',
          firstStudentId,
          secondStudentId,
        }),
      }),
      tx,
    );
    expect(result).toEqual({
      reviewState: 'PENDING',
      review: expect.objectContaining({
        id: reviewId,
        status: 'REOPENED',
        reopenReason: 'New guardian evidence requires another review',
      }),
    });
  });

  it('returns an already reopened disposition without another update or audit', async () => {
    const { service, tx, auditService } = buildService();
    tx.studentDuplicateReview.findFirst.mockResolvedValue(
      duplicateReview({
        status: StudentDuplicateReviewStatus.REOPENED,
        reopenedById: userId,
        reopenedAt: new Date('2026-07-18T02:15:00.000Z'),
        reopenReason: 'New guardian evidence requires another review',
      }),
    );

    const result = await service.reopenReview(
      reviewId,
      {
        reason: 'New guardian evidence requires another review',
      },
      actor,
    );

    expect(result.reviewState).toBe('PENDING');
    expect(tx.studentDuplicateReview.update).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('does not reopen a review that is outside the actor tenant', async () => {
    const { service, tx, auditService } = buildService();
    tx.studentDuplicateReview.findFirst.mockResolvedValue(null);

    await expect(
      service.reopenReview(
        reviewId,
        {
          reason: 'New evidence requires another review',
        },
        actor,
      ),
    ).rejects.toThrow(NotFoundException);

    expect(tx.studentDuplicateReview.findFirst).toHaveBeenCalledWith({
      where: { id: reviewId, tenantId },
    });
    expect(tx.studentDuplicateReview.update).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });
});

function buildService() {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([candidateRow()]),
    studentDuplicateReview: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
  };
  const prisma = {
    $queryRaw: jest.fn(),
    $transaction: jest.fn(
      async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    ),
    student: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    studentMergeHistory: {
      count: jest.fn(),
    },
  };
  const auditService = {
    record: jest.fn().mockResolvedValue(undefined),
  };
  const service = new StudentDuplicateReviewService(
    prisma as unknown as PrismaService,
    auditService as unknown as AuditService,
  );

  return { service, prisma, tx, auditService };
}

function candidateRow(
  overrides: Partial<{
    sourceStudentId: string;
    candidateStudentId: string;
    score: number;
    confidence: 'LOW' | 'MEDIUM' | 'HIGH';
    reasons: string[];
    identityFingerprint: string;
    reviewState: 'PENDING' | 'NOT_DUPLICATE';
    reviewId: string | null;
    reviewStatus: StudentDuplicateReviewStatus | null;
    reviewReason: string | null;
    reviewIdentityChanged: boolean | null;
    reviewedById: string | null;
    reviewedAt: Date | null;
    reopenedById: string | null;
    reopenedAt: Date | null;
    reopenReason: string | null;
    total: bigint;
    pending: bigint;
    highConfidence: bigint;
    resolvedNotDuplicate: bigint;
  }> = {},
) {
  return {
    sourceStudentId: firstStudentId,
    candidateStudentId: secondStudentId,
    score: 80,
    confidence: 'HIGH' as const,
    reasons: ['Same student name', 'Same date of birth'],
    identityFingerprint: 'identity-fingerprint-1',
    reviewState: 'PENDING' as const,
    reviewId: null,
    reviewStatus: null,
    reviewReason: null,
    reviewIdentityChanged: false,
    reviewedById: null,
    reviewedAt: null,
    reopenedById: null,
    reopenedAt: null,
    reopenReason: null,
    total: 1n,
    pending: 1n,
    highConfidence: 1n,
    resolvedNotDuplicate: 0n,
    ...overrides,
  };
}

function candidateStudent(
  id: string,
  overrides: Partial<{
    firstNameEn: string;
    lastNameEn: string;
    guardianLinks: {
      guardian: {
        primaryPhone: string;
        secondaryPhone: string | null;
      };
    }[];
  }> = {},
) {
  return {
    id,
    studentSystemId: `SYS-${id.slice(0, 4)}`,
    firstNameEn: 'Student',
    lastNameEn: 'Record',
    dateOfBirth: new Date('2015-04-03T00:00:00.000Z'),
    admissionNumber: null,
    previousSchool: null,
    lifecycleStatus: StudentLifecycleStatus.ACTIVE,
    class: { name: 'Grade 5' },
    sectionRef: { name: 'A' },
    guardianLinks: [],
    ...overrides,
  };
}

function duplicateReview(
  overrides: Partial<{
    status: StudentDuplicateReviewStatus;
    reason: string;
    reviewedById: string | null;
    reviewedAt: Date;
    reopenedById: string | null;
    reopenedAt: Date | null;
    reopenReason: string | null;
  }> = {},
) {
  return {
    id: reviewId,
    tenantId,
    firstStudentId,
    secondStudentId,
    status: StudentDuplicateReviewStatus.NOT_DUPLICATE,
    reason: 'Records are separate students',
    identityFingerprint: 'identity-fingerprint-1',
    reviewedById: userId,
    reviewedAt: new Date('2026-07-17T08:00:00.000Z'),
    reopenedById: null,
    reopenedAt: null,
    reopenReason: null,
    createdAt: new Date('2026-07-17T08:00:00.000Z'),
    updatedAt: new Date('2026-07-17T08:00:00.000Z'),
    ...overrides,
  };
}

function flattenSqlValues(value: unknown): unknown[] {
  if (
    value &&
    typeof value === 'object' &&
    'values' in value &&
    Array.isArray(value.values)
  ) {
    return value.values.flatMap((nestedValue) => flattenSqlValues(nestedValue));
  }

  return [value];
}
