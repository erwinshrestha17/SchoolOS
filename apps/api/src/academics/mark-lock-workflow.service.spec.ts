import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { MarkLockWorkflowService } from './mark-lock-workflow.service';

describe('MarkLockWorkflowService', () => {
  let service: MarkLockWorkflowService;
  let prisma: {
    examTerm: { findFirst: jest.Mock; update: jest.Mock };
    class: { findFirst: jest.Mock };
    section: { findFirst: jest.Mock };
    subject: { findFirst: jest.Mock };
    assessmentComponent: { findFirst: jest.Mock; findMany: jest.Mock };
    markEntry: { findMany: jest.Mock; updateMany: jest.Mock };
    markLockRequest: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    reportCard: { count: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditService: { record: jest.Mock };

  const actor: AuthContext = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    tenantSlug: 'tenant-one',
    email: 'admin@school.test',
    authMethod: 'PASSWORD',
    roles: ['admin'],
    permissions: ['academics:manage'],
  } as AuthContext;

  beforeEach(async () => {
    prisma = {
      examTerm: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      class: { findFirst: jest.fn() },
      section: { findFirst: jest.fn() },
      subject: { findFirst: jest.fn() },
      assessmentComponent: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      markEntry: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      markLockRequest: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      reportCard: { count: jest.fn() },
      $transaction: jest.fn(async (callback: unknown) => {
        if (typeof callback === 'function') {
          return callback(prisma);
        }
        return Promise.all(callback as Promise<unknown>[]);
      }),
    };

    auditService = { record: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarkLockWorkflowService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get(MarkLockWorkflowService);
  });

  function mockExamTerm(overrides: Record<string, unknown> = {}) {
    prisma.examTerm.findFirst.mockResolvedValue({
      id: 'term-1',
      tenantId: actor.tenantId,
      isLocked: false,
      academicYear: { id: 'year-1' },
      ...overrides,
    });
  }

  it('lists lock requests with tenant scope and pagination', async () => {
    mockExamTerm();
    prisma.markLockRequest.findMany.mockResolvedValue([{ id: 'lock-1' }]);
    prisma.markLockRequest.count.mockResolvedValue(1);

    const result = await service.list(actor, {
      examTermId: 'term-1',
      status: 'PENDING',
      page: 2,
      limit: 10,
    });

    expect(result).toEqual({
      items: [{ id: 'lock-1' }],
      meta: { total: 1, page: 2, limit: 10, totalPages: 1 },
    });
    expect(prisma.markLockRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: actor.tenantId,
          examTermId: 'term-1',
          status: 'PENDING',
        }),
        skip: 10,
        take: 10,
      }),
    );
  });

  it('rejects lock request for another tenant exam term', async () => {
    prisma.examTerm.findFirst.mockResolvedValue(null);

    await expect(
      service.request(
        { examTermId: 'foreign-term', reason: 'Ready to lock' },
        actor,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects duplicate pending lock request for same term', async () => {
    mockExamTerm();
    prisma.markLockRequest.findFirst.mockResolvedValue({ id: 'pending-1' });

    await expect(
      service.request({ examTermId: 'term-1', reason: 'Ready' }, actor),
    ).rejects.toThrow(ConflictException);
  });

  it('creates audited lock request with validated scope', async () => {
    mockExamTerm();
    prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
    prisma.section.findFirst.mockResolvedValue({ id: 'section-1' });
    prisma.subject.findFirst.mockResolvedValue({ id: 'subject-1' });
    prisma.assessmentComponent.findFirst.mockResolvedValue({
      id: 'component-1',
    });
    prisma.markLockRequest.findFirst.mockResolvedValue(null);
    prisma.markLockRequest.create.mockResolvedValue({
      id: 'lock-1',
      examTermId: 'term-1',
      reason: 'Ready',
      status: 'PENDING',
    });

    const result = await service.request(
      {
        examTermId: 'term-1',
        classId: 'class-1',
        sectionId: 'section-1',
        subjectId: 'subject-1',
        assessmentComponentId: 'component-1',
        reason: 'Ready',
      },
      actor,
    );

    expect(result.id).toBe('lock-1');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ACADEMICS_MARK_LOCK_REQUESTED',
        tenantId: actor.tenantId,
        userId: actor.userId,
      }),
    );
  });

  it('rejects approval when required component marks are missing', async () => {
    prisma.markLockRequest.findFirst.mockResolvedValue({
      id: 'lock-1',
      tenantId: actor.tenantId,
      examTermId: 'term-1',
      status: 'PENDING',
      examTerm: { id: 'term-1' },
    });
    prisma.assessmentComponent.findMany.mockResolvedValue([
      { id: 'component-1', name: 'Theory' },
    ]);
    prisma.markEntry.findMany.mockResolvedValue([]);

    await expect(
      service.review('lock-1', { status: 'APPROVED' }, actor),
    ).rejects.toThrow(ConflictException);
  });

  it('approves lock and locks term plus mark entries in one transaction', async () => {
    prisma.markLockRequest.findFirst.mockResolvedValue({
      id: 'lock-1',
      tenantId: actor.tenantId,
      examTermId: 'term-1',
      status: 'PENDING',
      examTerm: { id: 'term-1' },
    });
    prisma.assessmentComponent.findMany.mockResolvedValue([
      { id: 'component-1', name: 'Theory' },
    ]);
    prisma.markEntry.findMany.mockResolvedValue([
      { assessmentComponentId: 'component-1' },
    ]);
    prisma.markLockRequest.update.mockResolvedValue({
      id: 'lock-1',
      examTermId: 'term-1',
      status: 'APPROVED',
      reviewNote: null,
    });
    prisma.examTerm.update.mockResolvedValue({ id: 'term-1', isLocked: true });
    prisma.markEntry.updateMany.mockResolvedValue({ count: 10 });

    const result = await service.review(
      'lock-1',
      { status: 'APPROVED' },
      actor,
    );

    expect(result.status).toBe('APPROVED');
    expect(prisma.examTerm.update).toHaveBeenCalledWith({
      where: { id: 'term-1' },
      data: { isLocked: true },
    });
    expect(prisma.markEntry.updateMany).toHaveBeenCalledWith({
      where: { tenantId: actor.tenantId, examTermId: 'term-1' },
      data: { isLocked: true },
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ACADEMICS_MARK_LOCK_APPROVED' }),
    );
  });

  it('requires a review note when rejecting lock request', async () => {
    prisma.markLockRequest.findFirst.mockResolvedValue({
      id: 'lock-1',
      tenantId: actor.tenantId,
      examTermId: 'term-1',
      status: 'PENDING',
      examTerm: { id: 'term-1' },
    });

    await expect(
      service.review('lock-1', { status: 'REJECTED' }, actor),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects direct unlock when report cards already exist', async () => {
    mockExamTerm({ isLocked: true });
    prisma.reportCard.count.mockResolvedValue(1);

    await expect(
      service.unlockExamTerm('term-1', { reason: 'Correction' }, actor),
    ).rejects.toThrow(ConflictException);
  });

  it('unlocks term and marks when no report card exists', async () => {
    mockExamTerm({ isLocked: true });
    prisma.reportCard.count.mockResolvedValue(0);
    prisma.examTerm.update.mockResolvedValue({ id: 'term-1', isLocked: false });
    prisma.markEntry.updateMany.mockResolvedValue({ count: 10 });
    prisma.markLockRequest.create.mockResolvedValue({
      id: 'unlock-1',
      status: 'UNLOCKED',
    });

    const result = await service.unlockExamTerm(
      'term-1',
      { reason: 'Correction' },
      actor,
    );

    expect(result.unlocked).toBe(true);
    expect(prisma.examTerm.update).toHaveBeenCalledWith({
      where: { id: 'term-1' },
      data: { isLocked: false },
    });
    expect(prisma.markEntry.updateMany).toHaveBeenCalledWith({
      where: { tenantId: actor.tenantId, examTermId: 'term-1' },
      data: { isLocked: false },
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ACADEMICS_MARK_UNLOCK_APPROVED' }),
    );
  });
});
