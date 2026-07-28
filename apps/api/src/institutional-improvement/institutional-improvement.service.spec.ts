import { ConflictException, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  AuthMethod,
  SchoolImprovementActionStatus,
  SchoolImprovementPlanStatus,
  TeacherDevelopmentGoalStatus,
  TeacherObservationStatus,
} from '@prisma/client';
import type { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import type { FileRegistryService } from '../file-registry/file-registry.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { StudentsService } from '../students/students.service';
import { InstitutionalImprovementService } from './institutional-improvement.service';

const actor: AuthContext = {
  tenantId: 'tenant-1',
  tenantSlug: 'school',
  userId: 'user-1',
  email: 'principal@school.test',
  authMethod: AuthMethod.PASSWORD,
  roles: ['principal'],
  permissions: [
    'hr:read',
    'hr:manage',
    'reports:read',
    'settings:manage',
    'academics:read',
  ],
};

describe('InstitutionalImprovementService', () => {
  it('fails closed when an observation targets staff outside the tenant', async () => {
    const { service, prisma } = buildService();
    prisma.academicYear.findFirst.mockResolvedValue({ id: 'year-1' });
    prisma.staff.findFirst.mockResolvedValue(null);

    await expect(
      service.createTeacherObservation(actor, {
        teacherStaffId: 'staff-foreign',
        academicYearId: 'year-1',
        observedOn: '2026-07-26',
        strengths: 'Students were actively involved in the lesson.',
        developmentFocus: 'Use more frequent understanding checks.',
        clientRequestId: '10000000-0000-4000-8000-000000000001',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.teacherClassroomObservation.create).not.toHaveBeenCalled();
  });

  it('rejects plan completion while an action is still open', async () => {
    const { service, prisma } = buildService();
    prisma.schoolImprovementPlan.findFirst.mockResolvedValue(
      planRecord({
        status: SchoolImprovementPlanStatus.ACTIVE,
        actions: [
          actionRecord({
            status: SchoolImprovementActionStatus.IN_PROGRESS,
          }),
        ],
      }),
    );

    await expect(
      service.updateSchoolImprovementPlan(actor, 'plan-1', {
        expectedVersion: 1,
        status: SchoolImprovementPlanStatus.COMPLETED,
        reason: 'All targets were reviewed and achieved.',
      }),
    ).rejects.toThrow(
      'Complete or cancel every plan action before completing the plan',
    );
    expect(prisma.schoolImprovementPlan.updateMany).not.toHaveBeenCalled();
  });

  it('uses optimistic concurrency for reasoned observation transitions', async () => {
    const { service, prisma, audit } = buildService();
    prisma.teacherClassroomObservation.findFirst
      .mockResolvedValueOnce(observationRecord())
      .mockResolvedValueOnce(
        observationRecord({
          status: TeacherObservationStatus.COMPLETED,
          version: 2,
        }),
      );
    prisma.teacherClassroomObservation.updateMany.mockResolvedValue({
      count: 1,
    });

    await expect(
      service.updateTeacherObservation(actor, 'observation-1', {
        expectedVersion: 1,
        status: TeacherObservationStatus.COMPLETED,
        reason: 'The observation and feedback meeting are complete.',
        agreedAction: 'Use two quick understanding checks in each lesson.',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'observation-1',
        status: TeacherObservationStatus.COMPLETED,
        version: 2,
      }),
    );
    expect(prisma.teacherClassroomObservation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'observation-1',
          tenantId: 'tenant-1',
          version: 1,
        },
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'TEACHER_OBSERVATION_UPDATED',
        tenantId: 'tenant-1',
      }),
    );
  });

  it('replays a concurrent teacher-goal create with the same idempotency data', async () => {
    const { service, prisma, audit } = buildService();
    const dto = {
      teacherStaffId: 'staff-1',
      academicYearId: 'year-1',
      title: 'Increase formative assessment checks',
      baseline: 'Understanding checks are used inconsistently.',
      target: 'Use two checks in every observed lesson.',
      actionPlan: 'Plan and review two techniques with the mentor.',
      startsOn: '2026-07-26',
      dueOn: '2026-09-30',
      clientRequestId: '10000000-0000-4000-8000-000000000002',
    };
    const concurrent = goalRecord({
      title: dto.title,
      baseline: dto.baseline,
      target: dto.target,
      actionPlan: dto.actionPlan,
      clientRequestId: dto.clientRequestId,
      requestFingerprint: fingerprint(dto),
    });
    prisma.academicYear.findFirst.mockResolvedValue({ id: 'year-1' });
    prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1' });
    prisma.teacherDevelopmentGoal.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(concurrent);
    prisma.teacherDevelopmentGoal.create.mockRejectedValue({ code: 'P2002' });

    await expect(service.createTeacherGoal(actor, dto)).resolves.toEqual(
      expect.objectContaining({
        id: 'goal-1',
        replayed: true,
        status: TeacherDevelopmentGoalStatus.DRAFT,
      }),
    );
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('returns explainable, non-predictive SEE readiness from backend-owned counts', async () => {
    const { service, prisma, studentsService } = buildService();
    prisma.academicYear.findFirst.mockResolvedValue({ id: 'year-current' });
    prisma.class.findMany.mockResolvedValue([{ id: 'class-10' }]);
    prisma.examTerm.findFirst.mockResolvedValue({
      id: 'term-1',
      name: 'Second Terminal',
    });
    prisma.student.groupBy.mockResolvedValue([
      { classId: 'class-10', _count: { _all: 2 } },
    ]);
    prisma.subject.findMany.mockResolvedValue([
      { id: 'subject-math', classId: 'class-10' },
    ]);
    prisma.assessmentComponent.groupBy.mockResolvedValue([
      { subjectId: 'subject-math', _count: { _all: 2 } },
    ]);
    prisma.markEntry.count.mockResolvedValue(3);
    prisma.reportCard.count.mockResolvedValue(1);
    studentsService.countIemisReadyForClasses.mockResolvedValue(2);

    const result = await service.getBoardExamReadiness(actor, {
      track: 'SEE',
    });

    expect(result).toEqual(
      expect.objectContaining({
        track: 'SEE',
        classLevel: 10,
        state: 'NEEDS_ATTENTION',
        nonPredictive: true,
        academicYearId: 'year-current',
      }),
    );
    expect(result.indicators).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MARKS_COMPLETION',
          observed: 3,
          expected: 4,
          state: 'NEEDS_ATTENTION',
        }),
        expect.objectContaining({
          code: 'IEMIS_READINESS',
          observed: 2,
          expected: 2,
          state: 'READY',
        }),
      ]),
    );
    expect(studentsService.countIemisReadyForClasses).toHaveBeenCalledWith(
      ['class-10'],
      actor,
    );
  });

  it('fails when a current-year Stage 4 view has no configured year', async () => {
    const { service, prisma } = buildService();
    prisma.academicYear.findFirst.mockResolvedValue(null);

    await expect(
      service.getTeacherDevelopmentOverview(actor, {}),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not reopen a completed school improvement action', async () => {
    const { service, prisma } = buildService();
    prisma.schoolImprovementAction.findFirst.mockResolvedValue(
      actionRecord({ status: SchoolImprovementActionStatus.COMPLETED }),
    );

    await expect(
      service.updateSchoolImprovementAction(actor, 'action-1', {
        expectedVersion: 1,
        status: SchoolImprovementActionStatus.IN_PROGRESS,
        reason: 'Attempting to reopen a finished action.',
      }),
    ).rejects.toThrow(
      'Improvement action cannot move from COMPLETED to IN_PROGRESS',
    );
    expect(prisma.schoolImprovementAction.updateMany).not.toHaveBeenCalled();
  });
});

function buildService() {
  const delegate = () => ({
    count: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
    updateMany: jest.fn(),
  });
  const prisma = {
    academicYear: delegate(),
    assessmentComponent: delegate(),
    class: delegate(),
    examTerm: delegate(),
    markEntry: delegate(),
    reportCard: delegate(),
    schoolImprovementAction: delegate(),
    schoolImprovementKpi: delegate(),
    schoolImprovementPlan: delegate(),
    schoolImprovementReview: delegate(),
    section: delegate(),
    staff: delegate(),
    student: delegate(),
    subject: delegate(),
    teacherClassroomObservation: delegate(),
    teacherDevelopmentGoal: delegate(),
    teacherTrainingRecord: delegate(),
    timetableSlot: delegate(),
    user: delegate(),
    $transaction: jest.fn(),
  } as any;
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const fileRegistry = {
    getFileMetadata: jest.fn(),
    assertFileAccessForAuth: jest.fn(),
  };
  const studentsService = {
    countIemisReadyForClasses: jest.fn(),
  };
  const service = new InstitutionalImprovementService(
    prisma as PrismaService,
    audit as unknown as AuditService,
    fileRegistry as unknown as FileRegistryService,
    studentsService as unknown as StudentsService,
  );
  return { service, prisma, audit, fileRegistry, studentsService };
}

function staffRecord() {
  return {
    id: 'staff-1',
    employeeId: 'EMP-001',
    firstName: 'Sita',
    lastName: 'Rai',
    designation: 'Teacher',
  };
}

function observationRecord(overrides: Record<string, unknown> = {}): any {
  return { ...observationRecordBase(), ...overrides };
}

function observationRecordBase() {
  const now = new Date('2026-07-26T10:00:00.000Z');
  return {
    id: 'observation-1',
    tenantId: 'tenant-1',
    teacherStaffId: 'staff-1',
    teacher: staffRecord(),
    observerUserId: 'user-1',
    academicYearId: 'year-1',
    classId: 'class-1',
    sectionId: 'section-1',
    subjectId: 'subject-1',
    timetableSlotId: null,
    observedOn: new Date('2026-07-25T00:00:00.000Z'),
    strengths: 'Students were actively involved.',
    developmentFocus: 'Use more frequent understanding checks.',
    agreedAction: null,
    teacherResponse: null,
    followUpOn: new Date('2026-08-10T00:00:00.000Z'),
    status: TeacherObservationStatus.DRAFT,
    version: 1,
    clientRequestId: '10000000-0000-4000-8000-000000000001',
    requestFingerprint: 'fingerprint',
    createdAt: now,
    updatedAt: now,
  };
}

function goalRecord(overrides: Record<string, unknown> = {}): any {
  const now = new Date('2026-07-26T10:00:00.000Z');
  return {
    id: 'goal-1',
    tenantId: 'tenant-1',
    teacherStaffId: 'staff-1',
    teacher: staffRecord(),
    mentorStaffId: null,
    mentor: null,
    academicYearId: 'year-1',
    createdByUserId: 'user-1',
    title: 'Increase formative assessment checks',
    baseline: 'Understanding checks are used inconsistently.',
    target: 'Use two checks in every observed lesson.',
    actionPlan: 'Plan and review two techniques with the mentor.',
    startsOn: new Date('2026-07-26T00:00:00.000Z'),
    dueOn: new Date('2026-09-30T00:00:00.000Z'),
    status: TeacherDevelopmentGoalStatus.DRAFT,
    progressNote: null,
    completedOn: null,
    version: 1,
    clientRequestId: '10000000-0000-4000-8000-000000000002',
    requestFingerprint: 'fingerprint',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function fingerprint(value: unknown) {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function actionRecord(overrides: Record<string, unknown> = {}): any {
  return { ...actionRecordBase(), ...overrides };
}

function actionRecordBase() {
  const now = new Date('2026-07-26T10:00:00.000Z');
  return {
    id: 'action-1',
    tenantId: 'tenant-1',
    planId: 'plan-1',
    ownerUserId: 'owner-1',
    title: 'Complete monthly attendance review',
    details: 'Review class-level attendance and agree follow-up actions.',
    dueOn: new Date('2026-08-30T00:00:00.000Z'),
    status: SchoolImprovementActionStatus.NOT_STARTED,
    progressNote: null,
    evidenceFileAssetId: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

function planRecord(overrides: Record<string, unknown> = {}): any {
  return { ...planRecordBase(), ...overrides };
}

function planRecordBase() {
  const now = new Date('2026-07-26T10:00:00.000Z');
  return {
    id: 'plan-1',
    tenantId: 'tenant-1',
    academicYearId: 'year-1',
    createdByUserId: 'user-1',
    ownerUserId: 'owner-1',
    title: 'Improve regular attendance',
    baselineSummary: 'Average attendance is below the school target.',
    targetSummary: 'Reach and sustain the agreed attendance target.',
    startsOn: new Date('2026-07-01T00:00:00.000Z'),
    endsOn: new Date('2027-03-31T00:00:00.000Z'),
    status: SchoolImprovementPlanStatus.DRAFT,
    version: 1,
    clientRequestId: '10000000-0000-4000-8000-000000000010',
    requestFingerprint: 'fingerprint',
    kpis: [],
    actions: [],
    reviews: [],
    createdAt: now,
    updatedAt: now,
  };
}
