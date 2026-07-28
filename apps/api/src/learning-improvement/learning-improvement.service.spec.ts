import { createHash } from 'node:crypto';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import {
  AuthMethod,
  LearningMasteryStatus,
  LearningOutcomeDomain,
  StudentInterventionPriority,
  StudentInterventionStatus,
} from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import type { AuditService } from '../audit/audit.service';
import type { EntitlementsService } from '../plans/entitlements.service';
import type { PrismaService } from '../prisma/prisma.service';
import { LearningImprovementService } from './learning-improvement.service';

const adminActor: AuthContext = {
  tenantId: 'tenant-1',
  tenantSlug: 'school',
  userId: 'admin-user-1',
  email: 'admin@school.test',
  authMethod: AuthMethod.PASSWORD,
  roles: ['admin'],
  permissions: ['academics:read', 'academics:enter_marks'],
};

const teacherActor: AuthContext = {
  ...adminActor,
  userId: 'teacher-user-1',
  email: 'teacher@school.test',
  roles: ['teacher'],
};

const parentActor: AuthContext = {
  ...adminActor,
  userId: 'parent-user-1',
  email: 'parent@school.test',
  roles: ['parent'],
  permissions: ['academics:read'],
};

describe('LearningImprovementService', () => {
  it('keeps foundational outcome domains limited to Grades 1–3', async () => {
    const { service, prisma } = buildService();
    prisma.academicYear.findFirst.mockResolvedValue({ id: 'year-1' });
    prisma.class.findFirst.mockResolvedValue({ id: 'class-4', level: 4 });
    prisma.subject.findFirst.mockResolvedValue({
      id: 'subject-1',
      classId: 'class-4',
    });

    await expect(
      service.createOutcome(adminActor, {
        academicYearId: 'year-1',
        classId: 'class-4',
        subjectId: 'subject-1',
        code: 'READ-1',
        title: 'Read a short passage',
        domain: LearningOutcomeDomain.FOUNDATIONAL_READING,
      }),
    ).rejects.toThrow(
      'Foundational reading and numeracy outcomes are limited to Grades 1–3',
    );
    expect(prisma.learningOutcome.create).not.toHaveBeenCalled();
  });

  it('rejects partial or out-of-bounds formative scores before persistence', async () => {
    const { service, prisma } = buildService();
    const base = {
      outcomeId: 'outcome-1',
      studentId: 'student-1',
      academicYearId: 'year-1',
      classId: 'class-1',
      subjectId: 'subject-1',
      kind: 'QUIZ' as const,
      masteryStatus: LearningMasteryStatus.DEVELOPING,
      assessedOn: '2026-07-26',
      clientSubmissionId: '10000000-0000-4000-8000-000000000001',
    };

    await expect(
      service.createFormativeAssessment(adminActor, {
        ...base,
        score: 7,
      }),
    ).rejects.toThrow('Score and maximum score must be provided together');
    await expect(
      service.createFormativeAssessment(adminActor, {
        ...base,
        score: 11,
        maxScore: 10,
      }),
    ).rejects.toThrow('Score cannot exceed maximum score');
    expect(prisma.formativeAssessmentEvidence.create).not.toHaveBeenCalled();
  });

  it('returns scoped, explainable, non-predictive attendance warnings with honest source states', async () => {
    const { service, prisma, entitlements } = buildService();
    entitlements.checkModuleEnabled
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    prisma.attendanceRecord.groupBy
      .mockResolvedValueOnce([{ studentId: 'student-1', _count: { _all: 2 } }])
      .mockResolvedValueOnce([
        {
          studentId: 'student-1',
          status: 'ABSENT',
          _count: { _all: 2 },
        },
        {
          studentId: 'student-1',
          status: 'PRESENT',
          _count: { _all: 3 },
        },
      ]);
    prisma.formativeAssessmentEvidence.groupBy.mockResolvedValue([]);
    prisma.student.count.mockResolvedValue(1);
    prisma.student.findMany.mockResolvedValue([studentRecord()]);
    prisma.formativeAssessmentEvidence.findMany.mockResolvedValue([]);
    prisma.studentInterventionCase.findMany.mockResolvedValue([]);

    const result = await service.getEarlyWarnings(adminActor, {
      academicYearId: 'year-1',
      classId: 'class-1',
      page: 1,
      limit: 20,
    });

    expect(result).toEqual(
      expect.objectContaining({
        total: 1,
        rulesVersion: 'stage3-v1',
        nonPredictive: true,
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        student: expect.objectContaining({ id: 'student-1' }),
        attentionLevel: 'NEEDS_ATTENTION',
        sourceStates: {
          attendance: 'available',
          formativeAssessment: 'empty',
          homework: 'locked',
        },
        reasons: [
          expect.objectContaining({
            code: 'ATTENDANCE_PATTERN',
            observedValue: 40,
            threshold: 20,
          }),
        ],
      }),
    );
    expect(prisma.attendanceRecord.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          attendanceSession: expect.objectContaining({
            academicYearId: 'year-1',
          }),
        }),
      }),
    );
  });

  it('defaults early-warning sources to the tenant current academic year', async () => {
    const { service, prisma, entitlements } = buildService();
    prisma.academicYear.findFirst.mockResolvedValue({ id: 'year-current' });
    entitlements.checkModuleEnabled.mockResolvedValue(false);
    prisma.formativeAssessmentEvidence.groupBy.mockResolvedValue([]);

    await expect(
      service.getEarlyWarnings(adminActor, { page: 1, limit: 20 }),
    ).resolves.toEqual(
      expect.objectContaining({
        items: [],
        total: 0,
        nonPredictive: true,
      }),
    );
    expect(prisma.academicYear.findFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', isCurrent: true },
      select: { id: true },
    });
    expect(prisma.formativeAssessmentEvidence.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          academicYearId: 'year-current',
        }),
      }),
    );
  });

  it('fails closed when a current-year learning view has no configured current academic year', async () => {
    const { service, prisma } = buildService();
    prisma.academicYear.findFirst.mockResolvedValue(null);

    await expect(
      service.getEarlyWarnings(adminActor, { page: 1, limit: 20 }),
    ).rejects.toThrow('No current academic year is configured for this school');
  });

  it('returns an empty page for a teacher with no assigned class or subject scope', async () => {
    const { service, prisma } = buildService();
    prisma.staff.findFirst.mockResolvedValue({
      id: 'staff-1',
      firstName: 'Sita',
      lastName: 'Rai',
    });
    prisma.subjectTeacherAssignment.findMany.mockResolvedValue([]);
    prisma.section.findMany.mockResolvedValue([]);

    await expect(
      service.listOutcomes(teacherActor, { page: 2, limit: 10 }),
    ).resolves.toEqual({
      items: [],
      total: 0,
      page: 2,
      limit: 10,
      totalPages: 0,
    });
    expect(prisma.learningOutcome.findMany).not.toHaveBeenCalled();
  });

  it('fails closed for staff callers and parents requesting an unlinked child summary', async () => {
    const { service, prisma } = buildService();

    await expect(
      service.getParentLearningSummary('student-1', adminActor),
    ).rejects.toBeInstanceOf(ForbiddenException);

    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [{ studentId: 'student-2' }],
    });
    await expect(
      service.getParentLearningSummary('student-1', parentActor),
    ).rejects.toThrow('You can only view learning guidance for a linked child');
    expect(prisma.student.findFirst).not.toHaveBeenCalled();
  });

  it('limits linked-parent learning summaries to the tenant current academic year', async () => {
    const { service, prisma } = buildService();
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [{ studentId: 'student-1' }],
    });
    prisma.student.findFirst.mockResolvedValue(studentRecord());
    prisma.academicYear.findFirst.mockResolvedValue({ id: 'year-current' });
    prisma.formativeAssessmentEvidence.findMany.mockResolvedValue([]);
    prisma.parentLearningGuidance.findMany.mockResolvedValue([]);
    prisma.remedialGroupMember.findMany.mockResolvedValue([]);
    prisma.studentInterventionCase.findMany.mockResolvedValue([]);

    await expect(
      service.getParentLearningSummary('student-1', parentActor),
    ).resolves.toEqual(
      expect.objectContaining({
        student: expect.objectContaining({ id: 'student-1' }),
        outcomeProgress: [],
        guidance: [],
        remedialSupport: [],
        interventionUpdates: [],
      }),
    );
    expect(prisma.formativeAssessmentEvidence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          studentId: 'student-1',
          academicYearId: 'year-current',
        }),
      }),
    );
    expect(prisma.parentLearningGuidance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          academicYearId: 'year-current',
        }),
      }),
    );
    expect(prisma.remedialGroupMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          group: expect.objectContaining({
            academicYearId: 'year-current',
          }),
        }),
      }),
    );
    expect(prisma.studentInterventionCase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          academicYearId: 'year-current',
        }),
      }),
    );
  });

  it('replays an identical intervention request and rejects changed payload reuse', async () => {
    const { service, prisma } = buildService();
    prisma.student.findFirst.mockResolvedValue(studentRecord());
    const dto = {
      studentId: 'student-1',
      academicYearId: 'year-1',
      priority: StudentInterventionPriority.IMPORTANT,
      title: 'Reading fluency follow-up',
      concernSummary:
        'Two recent classroom checks show that reading fluency needs support.',
      parentVisibleSummary:
        'We are giving Asha additional guided reading practice.',
      clientRequestId: '10000000-0000-4000-8000-000000000002',
    };
    prisma.studentInterventionCase.findFirst.mockResolvedValue({
      ...interventionRecord(),
      requestFingerprint: fingerprint(dto),
    });

    await expect(service.createIntervention(adminActor, dto)).resolves.toEqual(
      expect.objectContaining({
        id: 'case-1',
        replayed: true,
        status: StudentInterventionStatus.OPEN,
      }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();

    await expect(
      service.createIntervention(adminActor, {
        ...dto,
        title: 'Changed purpose with reused request ID',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

function buildService() {
  const delegate = () => ({
    count: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    groupBy: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  });
  const prisma = {
    academicYear: delegate(),
    attendanceRecord: delegate(),
    class: delegate(),
    curriculumProgressItem: delegate(),
    formativeAssessmentEvidence: delegate(),
    guardian: delegate(),
    homeworkSubmission: delegate(),
    learningOutcome: delegate(),
    parentLearningGuidance: delegate(),
    remedialGroup: delegate(),
    remedialGroupMember: delegate(),
    section: delegate(),
    staff: delegate(),
    student: delegate(),
    studentInterventionCase: delegate(),
    studentInterventionEntry: delegate(),
    subject: delegate(),
    subjectTeacherAssignment: delegate(),
    $transaction: jest.fn(),
  } as any;
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const entitlements = {
    checkModuleEnabled: jest.fn(),
  };
  const service = new LearningImprovementService(
    prisma as PrismaService,
    audit as unknown as AuditService,
    entitlements as unknown as EntitlementsService,
  );
  return { service, prisma, audit, entitlements };
}

function studentRecord() {
  return {
    id: 'student-1',
    studentSystemId: 'STU-001',
    firstNameEn: 'Asha',
    lastNameEn: 'Rai',
    classId: 'class-1',
    sectionId: 'section-1',
    class: { id: 'class-1', name: 'Grade 1', level: 1 },
    sectionRef: { id: 'section-1', name: 'A' },
  };
}

function interventionRecord() {
  const now = new Date('2026-07-26T10:00:00.000Z');
  return {
    id: 'case-1',
    studentId: 'student-1',
    student: studentRecord(),
    academicYearId: 'year-1',
    ownerStaffId: null,
    owner: null,
    sourceSignalKey: null,
    priority: StudentInterventionPriority.IMPORTANT,
    status: StudentInterventionStatus.OPEN,
    title: 'Reading fluency follow-up',
    concernSummary:
      'Two recent classroom checks show that reading fluency needs support.',
    parentVisibleSummary:
      'We are giving Asha additional guided reading practice.',
    nextFollowUpOn: null,
    escalatedAt: null,
    resolvedAt: null,
    resolutionSummary: null,
    version: 1,
    entries: [],
    createdAt: now,
    updatedAt: now,
  };
}

function fingerprint(value: unknown) {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
