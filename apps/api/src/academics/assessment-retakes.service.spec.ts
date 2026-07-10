import {
  AssessmentRetakeResultDecision,
  AssessmentRetakeStatus,
  AssessmentRetakeType,
  AuthMethod,
  MarkEntryStatus,
  Prisma,
} from '@prisma/client';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { AuthContext } from '../auth/auth.types';
import { AssessmentRetakesService } from './assessment-retakes.service';

describe('AssessmentRetakesService', () => {
  let prisma: any;
  let audit: { record: jest.Mock };
  let communications: { recordDeliveryRecords: jest.Mock };
  let service: AssessmentRetakesService;

  const teacher: AuthContext = {
    userId: 'teacher-user',
    tenantId: 'tenant-1',
    tenantSlug: 'school',
    email: 'teacher@school.test',
    authMethod: AuthMethod.PASSWORD,
    roles: ['subject_teacher'],
    permissions: ['academics:enter_marks', 'academics:read'],
  };

  const examHead: AuthContext = {
    ...teacher,
    userId: 'exam-head-user',
    email: 'exam-head@school.test',
    roles: ['admin'],
    permissions: ['academics:read', 'academics:update'],
  };

  const originalMark = {
    id: 'mark-1',
    tenantId: 'tenant-1',
    examTermId: 'term-1',
    assessmentComponentId: 'component-1',
    subjectId: 'subject-1',
    studentId: 'student-1',
    marksObtained: new Prisma.Decimal(0),
    status: MarkEntryStatus.ABSENT,
    isLocked: false,
    examTerm: {
      id: 'term-1',
      academicYearId: 'year-1',
      isLocked: false,
    },
    assessmentComponent: {
      id: 'component-1',
      name: 'Theory',
      maxMarks: new Prisma.Decimal(50),
    },
    subject: { id: 'subject-1', name: 'Mathematics', code: 'MATH' },
    student: {
      id: 'student-1',
      classId: 'class-1',
      sectionId: 'section-1',
      class: { id: 'class-1', name: 'Grade 5' },
      sectionRef: { id: 'section-1', name: 'A' },
    },
  };

  const retake = {
    id: 'retake-1',
    tenantId: 'tenant-1',
    markEntryId: 'mark-1',
    examTermId: 'term-1',
    assessmentComponentId: 'component-1',
    subjectId: 'subject-1',
    studentId: 'student-1',
    classId: 'class-1',
    sectionId: 'section-1',
    type: AssessmentRetakeType.MAKE_UP,
    status: AssessmentRetakeStatus.REQUESTED,
    reason: 'Student was absent for a documented medical reason.',
    originalMarks: new Prisma.Decimal(0),
    originalStatus: MarkEntryStatus.ABSENT,
    attemptMarks: null,
    assessmentComponent: originalMark.assessmentComponent,
    subject: originalMark.subject,
  };

  beforeEach(() => {
    prisma = {
      assessmentRetake: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      markEntry: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      staff: { findFirst: jest.fn() },
      subjectTeacherAssignment: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      reportCardCorrectionRequest: { findFirst: jest.fn() },
      $transaction: jest.fn((operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    communications = {
      recordDeliveryRecords: jest.fn().mockResolvedValue(undefined),
    };
    service = new AssessmentRetakesService(
      prisma,
      audit as never,
      communications as never,
    );
  });

  it('creates a tenant-scoped make-up lifecycle only for an assigned teacher', async () => {
    prisma.markEntry.findFirst.mockResolvedValue(originalMark);
    prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1' });
    prisma.subjectTeacherAssignment.findFirst.mockResolvedValue({
      id: 'assignment-1',
    });
    prisma.assessmentRetake.findFirst.mockResolvedValue(null);
    prisma.assessmentRetake.create.mockResolvedValue(retake);

    await expect(
      service.create(
        {
          markEntryId: 'mark-1',
          type: AssessmentRetakeType.MAKE_UP,
          reason: ' Student was absent for a documented medical reason. ',
        },
        teacher,
      ),
    ).resolves.toBe(retake);

    expect(prisma.subjectTeacherAssignment.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        tenantId: 'tenant-1',
        staffId: 'staff-1',
        academicYearId: 'year-1',
        classId: 'class-1',
        subjectId: 'subject-1',
      }),
      select: { id: true },
    });
    expect(prisma.assessmentRetake.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          markEntryId: 'mark-1',
          originalMarks: originalMark.marksObtained,
          originalStatus: MarkEntryStatus.ABSENT,
          reason: 'Student was absent for a documented medical reason.',
          requestedById: 'teacher-user',
        }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ACADEMICS_ASSESSMENT_RETAKE_REQUESTED',
        resourceId: 'retake-1',
        tenantId: 'tenant-1',
      }),
    );
  });

  it('fails closed when a teacher is outside the subject assignment', async () => {
    prisma.markEntry.findFirst.mockResolvedValue(originalMark);
    prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1' });
    prisma.subjectTeacherAssignment.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        {
          markEntryId: 'mark-1',
          type: AssessmentRetakeType.RETEST,
          reason: 'Retest requested after the failed terminal assessment.',
        },
        teacher,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.assessmentRetake.create).not.toHaveBeenCalled();
  });

  it('prevents duplicate active lifecycles for the same original mark', async () => {
    prisma.markEntry.findFirst.mockResolvedValue(originalMark);
    prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1' });
    prisma.subjectTeacherAssignment.findFirst.mockResolvedValue({
      id: 'assignment-1',
    });
    prisma.assessmentRetake.findFirst.mockResolvedValue({ id: 'retake-open' });

    await expect(
      service.create(
        {
          markEntryId: 'mark-1',
          type: AssessmentRetakeType.MAKE_UP,
          reason: 'Student was absent for a documented medical reason.',
        },
        teacher,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('approves a request and marks the original entry as lifecycle-pending', async () => {
    prisma.assessmentRetake.findFirst.mockResolvedValue(retake);
    prisma.markEntry.findFirst.mockResolvedValue({
      ...originalMark,
      examTerm: { isLocked: false },
    });
    prisma.assessmentRetake.update.mockResolvedValue({
      ...retake,
      status: AssessmentRetakeStatus.APPROVED,
    });
    prisma.markEntry.update.mockResolvedValue({
      ...originalMark,
      status: MarkEntryStatus.RETEST,
    });

    await service.approve(
      'retake-1',
      { reviewNote: 'Medical evidence verified.' },
      examHead,
    );

    expect(prisma.markEntry.update).toHaveBeenCalledWith({
      where: { id: 'mark-1' },
      data: {
        status: MarkEntryStatus.RETEST,
        enteredById: 'exam-head-user',
      },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ACADEMICS_ASSESSMENT_RETAKE_APPROVED',
      }),
    );
  });

  it('requires an approved correction before changing a locked mark', async () => {
    prisma.assessmentRetake.findFirst.mockResolvedValue(retake);
    prisma.markEntry.findFirst.mockResolvedValue({
      ...originalMark,
      isLocked: true,
      examTerm: { isLocked: true },
    });
    prisma.reportCardCorrectionRequest.findFirst.mockResolvedValue(null);

    await expect(
      service.approve('retake-1', {}, examHead),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.assessmentRetake.update).not.toHaveBeenCalled();
  });

  it('schedules with a BS/NPT parent notification and rejects invalid ranges', async () => {
    prisma.assessmentRetake.findFirst.mockResolvedValue({
      ...retake,
      status: AssessmentRetakeStatus.APPROVED,
    });
    prisma.assessmentRetake.update.mockResolvedValue({
      ...retake,
      status: AssessmentRetakeStatus.SCHEDULED,
      room: 'Room 4',
    });

    await service.schedule(
      'retake-1',
      {
        startsAt: '2026-07-10T03:30:00.000Z',
        endsAt: '2026-07-10T04:30:00.000Z',
        room: 'Room 4',
      },
      examHead,
    );

    expect(communications.recordDeliveryRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'assessment_retake_scheduled',
        studentIds: ['student-1'],
        body: expect.stringContaining('NPT'),
      }),
    );

    await expect(
      service.schedule(
        'retake-1',
        {
          startsAt: '2026-07-10T04:30:00.000Z',
          endsAt: '2026-07-10T03:30:00.000Z',
        },
        examHead,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('records the attempt without mutating the original mark', async () => {
    prisma.assessmentRetake.findFirst.mockResolvedValue({
      ...retake,
      status: AssessmentRetakeStatus.SCHEDULED,
    });
    prisma.assessmentRetake.update.mockResolvedValue({
      ...retake,
      status: AssessmentRetakeStatus.COMPLETED,
      attemptMarks: new Prisma.Decimal(44),
    });

    await service.complete(
      'retake-1',
      { marksObtained: 44, remarks: 'Script checked.' },
      examHead,
    );

    expect(prisma.assessmentRetake.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: AssessmentRetakeStatus.COMPLETED,
          attemptMarks: new Prisma.Decimal(44),
        }),
      }),
    );
    expect(prisma.markEntry.update).not.toHaveBeenCalled();
  });

  it('applies an explicitly selected retake result and finalizes the mark', async () => {
    prisma.assessmentRetake.findFirst.mockResolvedValue({
      ...retake,
      status: AssessmentRetakeStatus.COMPLETED,
      attemptMarks: new Prisma.Decimal(44),
    });
    prisma.markEntry.findFirst.mockResolvedValue({
      ...originalMark,
      status: MarkEntryStatus.RETEST,
      examTerm: { isLocked: false },
    });
    prisma.assessmentRetake.update.mockResolvedValue({
      ...retake,
      status: AssessmentRetakeStatus.APPLIED,
      resultDecision: AssessmentRetakeResultDecision.USE_RETAKE,
    });
    prisma.markEntry.update.mockResolvedValue({
      ...originalMark,
      marksObtained: new Prisma.Decimal(44),
      status: MarkEntryStatus.SUBMITTED,
    });

    await service.applyResult(
      'retake-1',
      {
        decision: AssessmentRetakeResultDecision.USE_RETAKE,
        reason: 'Approved make-up score replaces the absence.',
      },
      examHead,
    );

    expect(prisma.markEntry.update).toHaveBeenCalledWith({
      where: { id: 'mark-1' },
      data: {
        marksObtained: new Prisma.Decimal(44),
        status: MarkEntryStatus.SUBMITTED,
        enteredById: 'exam-head-user',
      },
    });
    expect(communications.recordDeliveryRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'assessment_retake_applied',
        studentIds: ['student-1'],
      }),
    );
  });

  it('restores the original mark when an approved lifecycle is cancelled', async () => {
    prisma.assessmentRetake.findFirst.mockResolvedValue({
      ...retake,
      status: AssessmentRetakeStatus.SCHEDULED,
    });
    prisma.markEntry.findFirst.mockResolvedValue({
      ...originalMark,
      status: MarkEntryStatus.RETEST,
      examTerm: { isLocked: false },
    });
    prisma.assessmentRetake.update.mockResolvedValue({
      ...retake,
      status: AssessmentRetakeStatus.CANCELLED,
    });
    prisma.markEntry.update.mockResolvedValue(originalMark);

    await service.cancel(
      'retake-1',
      { reason: 'Student transferred before the scheduled assessment.' },
      examHead,
    );

    expect(prisma.markEntry.update).toHaveBeenCalledWith({
      where: { id: 'mark-1' },
      data: {
        marksObtained: retake.originalMarks,
        status: MarkEntryStatus.ABSENT,
        enteredById: 'exam-head-user',
      },
    });
  });
});
