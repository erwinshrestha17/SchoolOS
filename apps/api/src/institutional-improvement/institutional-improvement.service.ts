import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  MarkEntryStatus,
  Prisma,
  SchoolImprovementActionStatus,
  SchoolImprovementPlanStatus,
  StaffStatus,
  TeacherDevelopmentGoalStatus,
  TeacherObservationStatus,
  TeacherTrainingStatus,
  UserStatus,
} from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { PrismaService } from '../prisma/prisma.service';
import { StudentsService } from '../students/students.service';
import {
  AddSchoolImprovementReviewDto,
  BoardExamReadinessQueryDto,
  CreateSchoolImprovementPlanDto,
  CreateTeacherGoalDto,
  CreateTeacherObservationDto,
  CreateTeacherTrainingDto,
  InstitutionalPageDto,
  ListSchoolImprovementPlansDto,
  ListTeacherGoalsDto,
  ListTeacherObservationsDto,
  ListTeacherTrainingDto,
  TeacherDevelopmentQueryDto,
  UpdateSchoolImprovementActionDto,
  UpdateSchoolImprovementPlanDto,
  UpdateTeacherGoalDto,
  UpdateTeacherObservationDto,
} from './dto/institutional-improvement.dto';

const STAFF_SELECT = {
  id: true,
  employeeId: true,
  firstName: true,
  lastName: true,
  designation: true,
} satisfies Prisma.StaffSelect;

const observationInclude = {
  teacher: { select: STAFF_SELECT },
} satisfies Prisma.TeacherClassroomObservationInclude;

const goalInclude = {
  teacher: { select: STAFF_SELECT },
  mentor: { select: STAFF_SELECT },
} satisfies Prisma.TeacherDevelopmentGoalInclude;

const trainingInclude = {
  teacher: { select: STAFF_SELECT },
} satisfies Prisma.TeacherTrainingRecordInclude;

const planInclude = {
  kpis: { orderBy: [{ dueOn: 'asc' as const }, { createdAt: 'asc' as const }] },
  actions: {
    orderBy: [{ dueOn: 'asc' as const }, { createdAt: 'asc' as const }],
  },
  reviews: {
    orderBy: [{ reviewedOn: 'desc' as const }, { createdAt: 'desc' as const }],
  },
} satisfies Prisma.SchoolImprovementPlanInclude;

const ACTIVE_GOAL_STATUSES: TeacherDevelopmentGoalStatus[] = [
  TeacherDevelopmentGoalStatus.DRAFT,
  TeacherDevelopmentGoalStatus.ACTIVE,
];

const OPEN_ACTION_STATUSES: SchoolImprovementActionStatus[] = [
  SchoolImprovementActionStatus.NOT_STARTED,
  SchoolImprovementActionStatus.IN_PROGRESS,
  SchoolImprovementActionStatus.BLOCKED,
];

@Injectable()
export class InstitutionalImprovementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly fileRegistry: FileRegistryService,
    private readonly studentsService: StudentsService,
  ) {}

  async listTeacherObservations(
    actor: AuthContext,
    query: ListTeacherObservationsDto,
  ) {
    const { page, limit, skip } = pageOf(query);
    const where: Prisma.TeacherClassroomObservationWhereInput = {
      tenantId: actor.tenantId,
      ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
      ...(query.teacherStaffId ? { teacherStaffId: query.teacherStaffId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.teacherClassroomObservation.count({ where }),
      this.prisma.teacherClassroomObservation.findMany({
        where,
        include: observationInclude,
        orderBy: [{ observedOn: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);
    return pageResult(items.map(mapObservation), total, page, limit);
  }

  async createTeacherObservation(
    actor: AuthContext,
    dto: CreateTeacherObservationDto,
  ) {
    await this.assertObservationScope(actor, dto);
    assertDateOrder(dto.observedOn, dto.followUpOn, 'Follow-up date');
    const fingerprint = fingerprintOf(dto);
    const replay = await this.prisma.teacherClassroomObservation.findFirst({
      where: {
        tenantId: actor.tenantId,
        observerUserId: actor.userId,
        clientRequestId: dto.clientRequestId,
      },
      include: observationInclude,
    });
    if (replay) {
      assertMatchingReplay(replay.requestFingerprint, fingerprint);
      return { ...mapObservation(replay), replayed: true };
    }
    try {
      const created = await this.prisma.teacherClassroomObservation.create({
        data: {
          tenantId: actor.tenantId,
          teacherStaffId: dto.teacherStaffId,
          observerUserId: actor.userId,
          academicYearId: dto.academicYearId,
          classId: dto.classId ?? null,
          sectionId: dto.sectionId ?? null,
          subjectId: dto.subjectId ?? null,
          timetableSlotId: dto.timetableSlotId ?? null,
          observedOn: dateOnly(dto.observedOn),
          strengths: dto.strengths.trim(),
          developmentFocus: dto.developmentFocus.trim(),
          agreedAction: cleanOptional(dto.agreedAction),
          followUpOn: dto.followUpOn ? dateOnly(dto.followUpOn) : null,
          clientRequestId: dto.clientRequestId,
          requestFingerprint: fingerprint,
        },
        include: observationInclude,
      });
      await this.record(actor, 'TEACHER_OBSERVATION_CREATED', created.id, {
        teacherStaffId: dto.teacherStaffId,
        academicYearId: dto.academicYearId,
        status: created.status,
      });
      return { ...mapObservation(created), replayed: false };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const concurrent =
        await this.prisma.teacherClassroomObservation.findFirst({
          where: {
            tenantId: actor.tenantId,
            observerUserId: actor.userId,
            clientRequestId: dto.clientRequestId,
          },
          include: observationInclude,
        });
      if (!concurrent) throw error;
      assertMatchingReplay(concurrent.requestFingerprint, fingerprint);
      return { ...mapObservation(concurrent), replayed: true };
    }
  }

  async updateTeacherObservation(
    actor: AuthContext,
    observationId: string,
    dto: UpdateTeacherObservationDto,
  ) {
    const current = await this.getObservationInScope(actor, observationId);
    assertObservationTransition(current.status, dto.status);
    const updated = await this.prisma.teacherClassroomObservation.updateMany({
      where: {
        id: current.id,
        tenantId: actor.tenantId,
        version: dto.expectedVersion,
      },
      data: {
        status: dto.status,
        agreedAction:
          dto.agreedAction === undefined
            ? current.agreedAction
            : cleanOptional(dto.agreedAction),
        teacherResponse:
          dto.teacherResponse === undefined
            ? current.teacherResponse
            : cleanOptional(dto.teacherResponse),
        followUpOn:
          dto.followUpOn === undefined
            ? current.followUpOn
            : dateOnly(dto.followUpOn),
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException(
        'The observation changed. Refresh before updating it.',
      );
    }
    const result = await this.getObservationInScope(actor, observationId);
    await this.record(actor, 'TEACHER_OBSERVATION_UPDATED', observationId, {
      fromStatus: current.status,
      toStatus: dto.status,
      reason: dto.reason.trim(),
      version: result.version,
    });
    return mapObservation(result);
  }

  async acknowledgeMyTeacherObservation(
    actor: AuthContext,
    observationId: string,
    dto: UpdateTeacherObservationDto,
  ) {
    const staff = await this.getCurrentStaff(actor);
    const current = await this.prisma.teacherClassroomObservation.findFirst({
      where: {
        id: observationId,
        tenantId: actor.tenantId,
        teacherStaffId: staff.id,
      },
      include: observationInclude,
    });
    if (!current) throw new NotFoundException('Observation was not found');
    if (dto.status !== TeacherObservationStatus.ACKNOWLEDGED) {
      throw new ForbiddenException(
        'Teachers can only acknowledge their own observation',
      );
    }
    return this.updateTeacherObservation(actor, observationId, dto);
  }

  async listTeacherGoals(actor: AuthContext, query: ListTeacherGoalsDto) {
    const { page, limit, skip } = pageOf(query);
    const where: Prisma.TeacherDevelopmentGoalWhereInput = {
      tenantId: actor.tenantId,
      ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
      ...(query.teacherStaffId ? { teacherStaffId: query.teacherStaffId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.teacherDevelopmentGoal.count({ where }),
      this.prisma.teacherDevelopmentGoal.findMany({
        where,
        include: goalInclude,
        orderBy: [{ dueOn: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);
    return pageResult(items.map(mapGoal), total, page, limit);
  }

  async createTeacherGoal(actor: AuthContext, dto: CreateTeacherGoalDto) {
    await this.assertAcademicYear(actor, dto.academicYearId);
    await this.assertStaff(actor, dto.teacherStaffId);
    if (dto.mentorStaffId) await this.assertStaff(actor, dto.mentorStaffId);
    assertDateOrder(dto.startsOn, dto.dueOn, 'Goal due date');
    const requestFingerprint = fingerprintOf(dto);
    const replay = await this.prisma.teacherDevelopmentGoal.findFirst({
      where: {
        tenantId: actor.tenantId,
        createdByUserId: actor.userId,
        clientRequestId: dto.clientRequestId,
      },
      include: goalInclude,
    });
    if (replay) {
      assertMatchingReplay(replay.requestFingerprint, requestFingerprint);
      return { ...mapGoal(replay), replayed: true };
    }
    try {
      const created = await this.prisma.teacherDevelopmentGoal.create({
        data: {
          tenantId: actor.tenantId,
          teacherStaffId: dto.teacherStaffId,
          mentorStaffId: dto.mentorStaffId ?? null,
          academicYearId: dto.academicYearId,
          createdByUserId: actor.userId,
          title: dto.title.trim(),
          baseline: dto.baseline.trim(),
          target: dto.target.trim(),
          actionPlan: dto.actionPlan.trim(),
          startsOn: dateOnly(dto.startsOn),
          dueOn: dateOnly(dto.dueOn),
          clientRequestId: dto.clientRequestId,
          requestFingerprint,
        },
        include: goalInclude,
      });
      await this.record(actor, 'TEACHER_DEVELOPMENT_GOAL_CREATED', created.id, {
        teacherStaffId: dto.teacherStaffId,
        mentorStaffId: dto.mentorStaffId ?? null,
      });
      return { ...mapGoal(created), replayed: false };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const concurrent = await this.prisma.teacherDevelopmentGoal.findFirst({
        where: {
          tenantId: actor.tenantId,
          createdByUserId: actor.userId,
          clientRequestId: dto.clientRequestId,
        },
        include: goalInclude,
      });
      if (!concurrent) throw error;
      assertMatchingReplay(concurrent.requestFingerprint, requestFingerprint);
      return { ...mapGoal(concurrent), replayed: true };
    }
  }

  async updateTeacherGoal(
    actor: AuthContext,
    goalId: string,
    dto: UpdateTeacherGoalDto,
  ) {
    const current = await this.getGoalInScope(actor, goalId);
    assertGoalTransition(current.status, dto.status);
    if (dto.mentorStaffId) await this.assertStaff(actor, dto.mentorStaffId);
    const updated = await this.prisma.teacherDevelopmentGoal.updateMany({
      where: {
        id: current.id,
        tenantId: actor.tenantId,
        version: dto.expectedVersion,
      },
      data: {
        status: dto.status,
        mentorStaffId:
          dto.mentorStaffId === undefined
            ? current.mentorStaffId
            : dto.mentorStaffId,
        progressNote:
          dto.progressNote === undefined
            ? current.progressNote
            : cleanOptional(dto.progressNote),
        completedOn:
          dto.status === TeacherDevelopmentGoalStatus.COMPLETED
            ? dateOnly(new Date().toISOString())
            : current.completedOn,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException(
        'The development goal changed. Refresh before updating it.',
      );
    }
    const result = await this.getGoalInScope(actor, goalId);
    await this.record(actor, 'TEACHER_DEVELOPMENT_GOAL_UPDATED', goalId, {
      fromStatus: current.status,
      toStatus: dto.status,
      reason: dto.reason.trim(),
      version: result.version,
    });
    return mapGoal(result);
  }

  async listTeacherTraining(actor: AuthContext, query: ListTeacherTrainingDto) {
    const { page, limit, skip } = pageOf(query);
    const where: Prisma.TeacherTrainingRecordWhereInput = {
      tenantId: actor.tenantId,
      ...(query.teacherStaffId ? { teacherStaffId: query.teacherStaffId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.teacherTrainingRecord.count({ where }),
      this.prisma.teacherTrainingRecord.findMany({
        where,
        include: trainingInclude,
        orderBy: [{ startsOn: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);
    return pageResult(items.map(mapTraining), total, page, limit);
  }

  async createTeacherTraining(
    actor: AuthContext,
    dto: CreateTeacherTrainingDto,
  ) {
    await this.assertStaff(actor, dto.teacherStaffId);
    assertDateOrder(dto.startsOn, dto.endsOn, 'Training end date');
    if (dto.certificateFileAssetId) {
      const asset = await this.fileRegistry.getFileMetadata(
        actor.tenantId,
        dto.certificateFileAssetId,
      );
      await this.fileRegistry.assertFileAccessForAuth(asset, actor);
    }
    const requestFingerprint = fingerprintOf(dto);
    const replay = await this.prisma.teacherTrainingRecord.findFirst({
      where: {
        tenantId: actor.tenantId,
        createdByUserId: actor.userId,
        clientRequestId: dto.clientRequestId,
      },
      include: trainingInclude,
    });
    if (replay) {
      assertMatchingReplay(replay.requestFingerprint, requestFingerprint);
      return { ...mapTraining(replay), replayed: true };
    }
    try {
      const created = await this.prisma.teacherTrainingRecord.create({
        data: {
          tenantId: actor.tenantId,
          teacherStaffId: dto.teacherStaffId,
          createdByUserId: actor.userId,
          title: dto.title.trim(),
          providerName: cleanOptional(dto.providerName),
          startsOn: dateOnly(dto.startsOn),
          endsOn: dto.endsOn ? dateOnly(dto.endsOn) : null,
          status: dto.status,
          learningSummary: cleanOptional(dto.learningSummary),
          certificateFileAssetId: dto.certificateFileAssetId ?? null,
          clientRequestId: dto.clientRequestId,
          requestFingerprint,
        },
        include: trainingInclude,
      });
      await this.record(actor, 'TEACHER_TRAINING_RECORDED', created.id, {
        teacherStaffId: dto.teacherStaffId,
        status: dto.status,
        certificateFileAssetId: dto.certificateFileAssetId ?? null,
      });
      return { ...mapTraining(created), replayed: false };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const concurrent = await this.prisma.teacherTrainingRecord.findFirst({
        where: {
          tenantId: actor.tenantId,
          createdByUserId: actor.userId,
          clientRequestId: dto.clientRequestId,
        },
        include: trainingInclude,
      });
      if (!concurrent) throw error;
      assertMatchingReplay(concurrent.requestFingerprint, requestFingerprint);
      return { ...mapTraining(concurrent), replayed: true };
    }
  }

  async getTeacherDevelopmentOverview(
    actor: AuthContext,
    query: TeacherDevelopmentQueryDto,
  ) {
    const academicYearId =
      query.academicYearId ??
      (await this.getCurrentAcademicYearId(actor.tenantId));
    const teacherWhere = query.teacherStaffId
      ? { teacherStaffId: query.teacherStaffId }
      : {};
    const now = dateOnly(new Date().toISOString());
    const [
      observations,
      goals,
      training,
      observationsDue,
      activeGoals,
      overdueGoals,
      completedTraining,
    ] = await Promise.all([
      this.prisma.teacherClassroomObservation.findMany({
        where: {
          tenantId: actor.tenantId,
          academicYearId,
          ...teacherWhere,
        },
        include: observationInclude,
        orderBy: [{ observedOn: 'desc' }, { createdAt: 'desc' }],
        take: 20,
      }),
      this.prisma.teacherDevelopmentGoal.findMany({
        where: {
          tenantId: actor.tenantId,
          academicYearId,
          ...teacherWhere,
        },
        include: goalInclude,
        orderBy: [{ dueOn: 'asc' }, { createdAt: 'desc' }],
        take: 20,
      }),
      this.prisma.teacherTrainingRecord.findMany({
        where: { tenantId: actor.tenantId, ...teacherWhere },
        include: trainingInclude,
        orderBy: [{ startsOn: 'desc' }, { createdAt: 'desc' }],
        take: 20,
      }),
      this.prisma.teacherClassroomObservation.count({
        where: {
          tenantId: actor.tenantId,
          academicYearId,
          ...teacherWhere,
          followUpOn: { lte: now },
          status: {
            in: [
              TeacherObservationStatus.COMPLETED,
              TeacherObservationStatus.ACKNOWLEDGED,
              TeacherObservationStatus.FOLLOW_UP_DUE,
            ],
          },
        },
      }),
      this.prisma.teacherDevelopmentGoal.count({
        where: {
          tenantId: actor.tenantId,
          academicYearId,
          ...teacherWhere,
          status: { in: ACTIVE_GOAL_STATUSES },
        },
      }),
      this.prisma.teacherDevelopmentGoal.count({
        where: {
          tenantId: actor.tenantId,
          academicYearId,
          ...teacherWhere,
          status: { in: ACTIVE_GOAL_STATUSES },
          dueOn: { lt: now },
        },
      }),
      this.prisma.teacherTrainingRecord.count({
        where: {
          tenantId: actor.tenantId,
          ...teacherWhere,
          status: TeacherTrainingStatus.COMPLETED,
        },
      }),
    ]);
    return {
      generatedAt: new Date().toISOString(),
      academicYearId,
      metrics: {
        observationsDue,
        activeGoals,
        overdueGoals,
        completedTraining,
      },
      sourceStates: {
        observations:
          observations.length > 0 ? ('available' as const) : ('empty' as const),
        goals: goals.length > 0 ? ('available' as const) : ('empty' as const),
        training:
          training.length > 0 ? ('available' as const) : ('empty' as const),
      },
      observations: observations.map(mapObservation),
      goals: goals.map(mapGoal),
      training: training.map(mapTraining),
    };
  }

  async getMyTeacherDevelopment(actor: AuthContext) {
    const staff = await this.getCurrentStaff(actor);
    return this.getTeacherDevelopmentOverview(actor, {
      teacherStaffId: staff.id,
    });
  }

  async getPrincipalTeacherDevelopment(actor: AuthContext) {
    const [overview, teacherOptions] = await Promise.all([
      this.getTeacherDevelopmentOverview(actor, {}),
      this.prisma.staff.findMany({
        where: {
          tenantId: actor.tenantId,
          status: { in: [StaffStatus.ACTIVE, StaffStatus.ON_LEAVE] },
        },
        select: STAFF_SELECT,
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        take: 100,
      }),
    ]);
    return {
      ...overview,
      teacherOptions: teacherOptions.map(mapStaff),
      createObservationSupported: true as const,
      followUpSupported: true as const,
    };
  }

  async listSchoolImprovementPlans(
    actor: AuthContext,
    query: ListSchoolImprovementPlansDto,
  ) {
    const { page, limit, skip } = pageOf(query);
    const where: Prisma.SchoolImprovementPlanWhereInput = {
      tenantId: actor.tenantId,
      ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.schoolImprovementPlan.count({ where }),
      this.prisma.schoolImprovementPlan.findMany({
        where,
        include: planInclude,
        orderBy: [{ status: 'asc' }, { endsOn: 'asc' }],
        skip,
        take: limit,
      }),
    ]);
    return pageResult(items.map(mapPlan), total, page, limit);
  }

  async getSchoolImprovementPlan(actor: AuthContext, planId: string) {
    return mapPlan(await this.getPlanInScope(actor, planId));
  }

  async createSchoolImprovementPlan(
    actor: AuthContext,
    dto: CreateSchoolImprovementPlanDto,
  ) {
    await this.assertAcademicYear(actor, dto.academicYearId);
    assertDateOrder(dto.startsOn, dto.endsOn, 'Plan end date');
    for (const kpi of dto.kpis) {
      if (dateOnly(kpi.dueOn) > dateOnly(dto.endsOn)) {
        throw new ConflictException(
          'KPI due dates must be within the plan period',
        );
      }
    }
    for (const action of dto.actions) {
      if (dateOnly(action.dueOn) > dateOnly(dto.endsOn)) {
        throw new ConflictException(
          'Action due dates must be within the plan period',
        );
      }
    }
    await this.assertTenantUsers(actor, [
      dto.ownerUserId,
      ...dto.kpis.map((item) => item.ownerUserId),
      ...dto.actions.map((item) => item.ownerUserId),
    ]);
    const requestFingerprint = fingerprintOf(dto);
    const replay = await this.prisma.schoolImprovementPlan.findFirst({
      where: {
        tenantId: actor.tenantId,
        createdByUserId: actor.userId,
        clientRequestId: dto.clientRequestId,
      },
      include: planInclude,
    });
    if (replay) {
      assertMatchingReplay(replay.requestFingerprint, requestFingerprint);
      return { ...mapPlan(replay), replayed: true };
    }
    try {
      const created = await this.prisma.schoolImprovementPlan.create({
        data: {
          tenantId: actor.tenantId,
          academicYearId: dto.academicYearId,
          createdByUserId: actor.userId,
          ownerUserId: dto.ownerUserId,
          title: dto.title.trim(),
          baselineSummary: dto.baselineSummary.trim(),
          targetSummary: dto.targetSummary.trim(),
          startsOn: dateOnly(dto.startsOn),
          endsOn: dateOnly(dto.endsOn),
          clientRequestId: dto.clientRequestId,
          requestFingerprint,
          kpis: {
            create: dto.kpis.map((item) => ({
              tenantId: actor.tenantId,
              ownerUserId: item.ownerUserId,
              name: item.name.trim(),
              unit: item.unit.trim(),
              baselineValue: new Prisma.Decimal(item.baselineValue),
              targetValue: new Prisma.Decimal(item.targetValue),
              dueOn: dateOnly(item.dueOn),
            })),
          },
          actions: {
            create: dto.actions.map((item) => ({
              tenantId: actor.tenantId,
              ownerUserId: item.ownerUserId,
              title: item.title.trim(),
              details: item.details.trim(),
              dueOn: dateOnly(item.dueOn),
            })),
          },
        },
        include: planInclude,
      });
      await this.record(actor, 'SCHOOL_IMPROVEMENT_PLAN_CREATED', created.id, {
        academicYearId: dto.academicYearId,
        ownerUserId: dto.ownerUserId,
        kpiCount: dto.kpis.length,
        actionCount: dto.actions.length,
      });
      return { ...mapPlan(created), replayed: false };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const concurrent = await this.prisma.schoolImprovementPlan.findFirst({
        where: {
          tenantId: actor.tenantId,
          createdByUserId: actor.userId,
          clientRequestId: dto.clientRequestId,
        },
        include: planInclude,
      });
      if (!concurrent) throw error;
      assertMatchingReplay(concurrent.requestFingerprint, requestFingerprint);
      return { ...mapPlan(concurrent), replayed: true };
    }
  }

  async updateSchoolImprovementPlan(
    actor: AuthContext,
    planId: string,
    dto: UpdateSchoolImprovementPlanDto,
  ) {
    const current = await this.getPlanInScope(actor, planId);
    assertPlanTransition(current.status, dto.status);
    if (
      dto.status === SchoolImprovementPlanStatus.COMPLETED &&
      current.actions.some((item) => OPEN_ACTION_STATUSES.includes(item.status))
    ) {
      throw new ConflictException(
        'Complete or cancel every plan action before completing the plan',
      );
    }
    const updated = await this.prisma.schoolImprovementPlan.updateMany({
      where: {
        id: current.id,
        tenantId: actor.tenantId,
        version: dto.expectedVersion,
      },
      data: { status: dto.status, version: { increment: 1 } },
    });
    if (updated.count !== 1) {
      throw new ConflictException(
        'The improvement plan changed. Refresh before updating it.',
      );
    }
    const result = await this.getPlanInScope(actor, planId);
    await this.record(actor, 'SCHOOL_IMPROVEMENT_PLAN_UPDATED', planId, {
      fromStatus: current.status,
      toStatus: dto.status,
      reason: dto.reason.trim(),
      version: result.version,
    });
    return mapPlan(result);
  }

  async updateSchoolImprovementAction(
    actor: AuthContext,
    actionId: string,
    dto: UpdateSchoolImprovementActionDto,
  ) {
    const current = await this.prisma.schoolImprovementAction.findFirst({
      where: { id: actionId, tenantId: actor.tenantId },
    });
    if (!current) {
      throw new NotFoundException('School improvement action was not found');
    }
    assertActionTransition(current.status, dto.status);
    if (dto.evidenceFileAssetId) {
      const asset = await this.fileRegistry.getFileMetadata(
        actor.tenantId,
        dto.evidenceFileAssetId,
      );
      await this.fileRegistry.assertFileAccessForAuth(asset, actor);
    }
    const updated = await this.prisma.schoolImprovementAction.updateMany({
      where: {
        id: current.id,
        tenantId: actor.tenantId,
        version: dto.expectedVersion,
      },
      data: {
        status: dto.status,
        progressNote:
          dto.progressNote === undefined
            ? current.progressNote
            : cleanOptional(dto.progressNote),
        evidenceFileAssetId:
          dto.evidenceFileAssetId === undefined
            ? current.evidenceFileAssetId
            : dto.evidenceFileAssetId,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException(
        'The improvement action changed. Refresh before updating it.',
      );
    }
    await this.record(actor, 'SCHOOL_IMPROVEMENT_ACTION_UPDATED', actionId, {
      planId: current.planId,
      fromStatus: current.status,
      toStatus: dto.status,
      reason: dto.reason.trim(),
      evidenceFileAssetId:
        dto.evidenceFileAssetId ?? current.evidenceFileAssetId,
    });
    const result = await this.prisma.schoolImprovementAction.findFirst({
      where: { id: actionId, tenantId: actor.tenantId },
    });
    return mapAction(result!);
  }

  async addSchoolImprovementReview(
    actor: AuthContext,
    planId: string,
    dto: AddSchoolImprovementReviewDto,
  ) {
    const plan = await this.getPlanInScope(actor, planId);
    const allowedKpis = new Set(plan.kpis.map((item) => item.id));
    if (
      dto.kpiSnapshot.some((item) => !allowedKpis.has(item.kpiId)) ||
      new Set(dto.kpiSnapshot.map((item) => item.kpiId)).size !==
        dto.kpiSnapshot.length
    ) {
      throw new ConflictException(
        'Every review KPI must belong to this plan and appear once',
      );
    }
    const requestFingerprint = fingerprintOf(dto);
    const replay = await this.prisma.schoolImprovementReview.findFirst({
      where: {
        tenantId: actor.tenantId,
        reviewedByUserId: actor.userId,
        clientRequestId: dto.clientRequestId,
      },
    });
    if (replay) {
      assertMatchingReplay(replay.requestFingerprint, requestFingerprint);
      return { ...mapReview(replay), replayed: true };
    }
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        for (const snapshot of dto.kpiSnapshot) {
          await tx.schoolImprovementKpi.updateMany({
            where: {
              id: snapshot.kpiId,
              tenantId: actor.tenantId,
              planId,
            },
            data: { latestValue: new Prisma.Decimal(snapshot.value) },
          });
        }
        return tx.schoolImprovementReview.create({
          data: {
            tenantId: actor.tenantId,
            planId,
            reviewedByUserId: actor.userId,
            reviewedOn: dateOnly(dto.reviewedOn),
            summary: dto.summary.trim(),
            nextActions: dto.nextActions.trim(),
            kpiSnapshot: dto.kpiSnapshot as unknown as Prisma.InputJsonValue,
            clientRequestId: dto.clientRequestId,
            requestFingerprint,
          },
        });
      });
      await this.record(actor, 'SCHOOL_IMPROVEMENT_REVIEW_ADDED', created.id, {
        planId,
        reviewedOn: dto.reviewedOn,
        kpiCount: dto.kpiSnapshot.length,
      });
      return { ...mapReview(created), replayed: false };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const concurrent = await this.prisma.schoolImprovementReview.findFirst({
        where: {
          tenantId: actor.tenantId,
          reviewedByUserId: actor.userId,
          clientRequestId: dto.clientRequestId,
        },
      });
      if (!concurrent) throw error;
      assertMatchingReplay(concurrent.requestFingerprint, requestFingerprint);
      return { ...mapReview(concurrent), replayed: true };
    }
  }

  async getBoardExamReadiness(
    actor: AuthContext,
    query: BoardExamReadinessQueryDto,
  ) {
    const academicYearId =
      query.academicYearId ??
      (await this.getCurrentAcademicYearId(actor.tenantId));
    const level = boardLevel(query.track);
    const classes = await this.prisma.class.findMany({
      where: { tenantId: actor.tenantId, level },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    const classIds = classes.map((item) => item.id);
    if (classIds.length === 0) {
      return unavailableBoardReadiness(
        academicYearId,
        query.track,
        level,
        'No supported class is configured for this readiness track.',
      );
    }
    const examTerm = await this.prisma.examTerm.findFirst({
      where: { tenantId: actor.tenantId, academicYearId },
      select: { id: true, name: true },
      orderBy: [{ endsOn: 'desc' }, { createdAt: 'desc' }],
    });
    const activeStudentCounts = await this.prisma.student.groupBy({
      by: ['classId'],
      where: {
        tenantId: actor.tenantId,
        classId: { in: classIds },
        lifecycleStatus: 'ACTIVE',
      },
      _count: { _all: true },
    });
    const studentCount = activeStudentCounts.reduce(
      (sum, item) => sum + item._count._all,
      0,
    );
    if (!examTerm) {
      return buildBoardReadiness({
        academicYearId,
        track: query.track,
        level,
        studentCount,
        examTermName: null,
        expectedMarks: null,
        submittedMarks: null,
        reportCardsReady: null,
        iemisReady: await this.countIemisReady(actor, classIds),
      });
    }
    const subjects = await this.prisma.subject.findMany({
      where: { tenantId: actor.tenantId, classId: { in: classIds } },
      select: { id: true, classId: true },
    });
    const componentCounts = await this.prisma.assessmentComponent.groupBy({
      by: ['subjectId'],
      where: {
        tenantId: actor.tenantId,
        examTermId: examTerm.id,
        subjectId: { in: subjects.map((item) => item.id) },
      },
      _count: { _all: true },
    });
    const studentCountByClass = new Map(
      activeStudentCounts.map((item) => [item.classId, item._count._all]),
    );
    const classBySubject = new Map(
      subjects.map((item) => [item.id, item.classId]),
    );
    const expectedMarks = componentCounts.reduce((sum, item) => {
      const classId = classBySubject.get(item.subjectId);
      return (
        sum +
        (classId ? (studentCountByClass.get(classId) ?? 0) : 0) *
          item._count._all
      );
    }, 0);
    const [submittedMarks, reportCardsReady, iemisReady] = await Promise.all([
      this.prisma.markEntry.count({
        where: {
          tenantId: actor.tenantId,
          examTermId: examTerm.id,
          status: { not: MarkEntryStatus.DRAFT },
          student: {
            classId: { in: classIds },
            lifecycleStatus: 'ACTIVE',
          },
        },
      }),
      this.prisma.reportCard.count({
        where: {
          tenantId: actor.tenantId,
          academicYearId,
          examTermId: examTerm.id,
          classId: { in: classIds },
          isCurrent: true,
          publishStatus: { in: ['READY', 'PUBLISHED'] },
        },
      }),
      this.countIemisReady(actor, classIds),
    ]);
    return buildBoardReadiness({
      academicYearId,
      track: query.track,
      level,
      studentCount,
      examTermName: examTerm.name,
      expectedMarks,
      submittedMarks: Math.min(expectedMarks, submittedMarks),
      reportCardsReady: Math.min(studentCount, reportCardsReady),
      iemisReady: Math.min(studentCount, iemisReady),
    });
  }

  private async countIemisReady(actor: AuthContext, classIds: string[]) {
    return this.studentsService.countIemisReadyForClasses(classIds, actor);
  }

  private async assertObservationScope(
    actor: AuthContext,
    dto: CreateTeacherObservationDto,
  ) {
    await this.assertAcademicYear(actor, dto.academicYearId);
    await this.assertStaff(actor, dto.teacherStaffId);
    if (dto.classId) {
      const klass = await this.prisma.class.findFirst({
        where: { id: dto.classId, tenantId: actor.tenantId },
        select: { id: true },
      });
      if (!klass) throw new NotFoundException('Class was not found');
    }
    if (dto.sectionId) {
      const section = await this.prisma.section.findFirst({
        where: {
          id: dto.sectionId,
          tenantId: actor.tenantId,
          ...(dto.classId ? { classId: dto.classId } : {}),
        },
        select: { id: true },
      });
      if (!section) throw new NotFoundException('Section was not found');
    }
    if (dto.subjectId) {
      const subject = await this.prisma.subject.findFirst({
        where: {
          id: dto.subjectId,
          tenantId: actor.tenantId,
          ...(dto.classId ? { classId: dto.classId } : {}),
        },
        select: { id: true },
      });
      if (!subject) throw new NotFoundException('Subject was not found');
    }
    if (dto.timetableSlotId) {
      const slot = await this.prisma.timetableSlot.findFirst({
        where: {
          id: dto.timetableSlotId,
          tenantId: actor.tenantId,
          academicYearId: dto.academicYearId,
          ...(dto.classId ? { classId: dto.classId } : {}),
          ...(dto.sectionId ? { sectionId: dto.sectionId } : {}),
          ...(dto.subjectId ? { subjectId: dto.subjectId } : {}),
        },
        select: { id: true },
      });
      if (!slot) {
        throw new NotFoundException('Timetable slot was not found');
      }
    }
  }

  private async assertAcademicYear(actor: AuthContext, academicYearId: string) {
    const record = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, tenantId: actor.tenantId },
      select: { id: true },
    });
    if (!record) throw new NotFoundException('Academic year was not found');
  }

  private async assertStaff(actor: AuthContext, staffId: string) {
    const staff = await this.prisma.staff.findFirst({
      where: {
        id: staffId,
        tenantId: actor.tenantId,
        status: { in: [StaffStatus.ACTIVE, StaffStatus.ON_LEAVE] },
      },
      select: { id: true },
    });
    if (!staff) throw new NotFoundException('Staff member was not found');
  }

  private async assertTenantUsers(actor: AuthContext, userIds: string[]) {
    const unique = Array.from(new Set(userIds));
    const count = await this.prisma.user.count({
      where: {
        tenantId: actor.tenantId,
        id: { in: unique },
        status: UserStatus.ACTIVE,
      },
    });
    if (count !== unique.length) {
      throw new NotFoundException(
        'One or more plan owners are not active school users',
      );
    }
  }

  private async getCurrentAcademicYearId(tenantId: string) {
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { tenantId, isCurrent: true },
      select: { id: true },
    });
    if (!academicYear) {
      throw new ConflictException(
        'No current academic year is configured for this school',
      );
    }
    return academicYear.id;
  }

  private async getCurrentStaff(actor: AuthContext) {
    const staff = await this.prisma.staff.findFirst({
      where: {
        tenantId: actor.tenantId,
        userId: actor.userId,
        status: StaffStatus.ACTIVE,
      },
      select: { id: true },
    });
    if (!staff) {
      throw new ForbiddenException('No active staff profile is linked');
    }
    return staff;
  }

  private async getObservationInScope(
    actor: AuthContext,
    observationId: string,
  ) {
    const record = await this.prisma.teacherClassroomObservation.findFirst({
      where: { id: observationId, tenantId: actor.tenantId },
      include: observationInclude,
    });
    if (!record) throw new NotFoundException('Observation was not found');
    return record;
  }

  private async getGoalInScope(actor: AuthContext, goalId: string) {
    const record = await this.prisma.teacherDevelopmentGoal.findFirst({
      where: { id: goalId, tenantId: actor.tenantId },
      include: goalInclude,
    });
    if (!record) {
      throw new NotFoundException('Development goal was not found');
    }
    return record;
  }

  private async getPlanInScope(actor: AuthContext, planId: string) {
    const record = await this.prisma.schoolImprovementPlan.findFirst({
      where: { id: planId, tenantId: actor.tenantId },
      include: planInclude,
    });
    if (!record) {
      throw new NotFoundException('School improvement plan was not found');
    }
    return record;
  }

  private record(
    actor: AuthContext,
    action: string,
    resourceId: string,
    after: Record<string, unknown>,
  ) {
    return this.audit.record({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action,
      resource: 'institutional_improvement',
      resourceId,
      after,
    });
  }
}

function mapStaff(staff: {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  designation: string | null;
}) {
  return {
    id: staff.id,
    employeeId: staff.employeeId,
    fullName: `${staff.firstName} ${staff.lastName}`.trim(),
    designation: staff.designation,
  };
}

function mapObservation(
  record: Prisma.TeacherClassroomObservationGetPayload<{
    include: typeof observationInclude;
  }>,
) {
  return {
    id: record.id,
    teacher: mapStaff(record.teacher),
    observerUserId: record.observerUserId,
    academicYearId: record.academicYearId,
    classId: record.classId,
    sectionId: record.sectionId,
    subjectId: record.subjectId,
    timetableSlotId: record.timetableSlotId,
    observedOn: formatDate(record.observedOn),
    strengths: record.strengths,
    developmentFocus: record.developmentFocus,
    agreedAction: record.agreedAction,
    teacherResponse: record.teacherResponse,
    followUpOn: record.followUpOn ? formatDate(record.followUpOn) : null,
    status: record.status,
    version: record.version,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapGoal(
  record: Prisma.TeacherDevelopmentGoalGetPayload<{
    include: typeof goalInclude;
  }>,
) {
  return {
    id: record.id,
    teacher: mapStaff(record.teacher),
    mentor: record.mentor ? mapStaff(record.mentor) : null,
    academicYearId: record.academicYearId,
    title: record.title,
    baseline: record.baseline,
    target: record.target,
    actionPlan: record.actionPlan,
    startsOn: formatDate(record.startsOn),
    dueOn: formatDate(record.dueOn),
    status: record.status,
    progressNote: record.progressNote,
    completedOn: record.completedOn ? formatDate(record.completedOn) : null,
    version: record.version,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapTraining(
  record: Prisma.TeacherTrainingRecordGetPayload<{
    include: typeof trainingInclude;
  }>,
) {
  return {
    id: record.id,
    teacher: mapStaff(record.teacher),
    title: record.title,
    providerName: record.providerName,
    startsOn: formatDate(record.startsOn),
    endsOn: record.endsOn ? formatDate(record.endsOn) : null,
    status: record.status,
    learningSummary: record.learningSummary,
    certificateFileAssetId: record.certificateFileAssetId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapPlan(
  record: Prisma.SchoolImprovementPlanGetPayload<{
    include: typeof planInclude;
  }>,
) {
  return {
    id: record.id,
    academicYearId: record.academicYearId,
    ownerUserId: record.ownerUserId,
    title: record.title,
    baselineSummary: record.baselineSummary,
    targetSummary: record.targetSummary,
    startsOn: formatDate(record.startsOn),
    endsOn: formatDate(record.endsOn),
    status: record.status,
    version: record.version,
    kpis: record.kpis.map((item) => ({
      id: item.id,
      ownerUserId: item.ownerUserId,
      name: item.name,
      unit: item.unit,
      baselineValue: item.baselineValue.toString(),
      targetValue: item.targetValue.toString(),
      latestValue: item.latestValue?.toString() ?? null,
      dueOn: formatDate(item.dueOn),
    })),
    actions: record.actions.map(mapAction),
    reviews: record.reviews.map(mapReview),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapAction(record: {
  id: string;
  ownerUserId: string;
  title: string;
  details: string;
  dueOn: Date;
  status: SchoolImprovementActionStatus;
  progressNote: string | null;
  evidenceFileAssetId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: record.id,
    ownerUserId: record.ownerUserId,
    title: record.title,
    details: record.details,
    dueOn: formatDate(record.dueOn),
    status: record.status,
    progressNote: record.progressNote,
    evidenceFileAssetId: record.evidenceFileAssetId,
    version: record.version,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapReview(record: {
  id: string;
  reviewedByUserId: string;
  reviewedOn: Date;
  summary: string;
  nextActions: string;
  kpiSnapshot: Prisma.JsonValue;
  createdAt: Date;
}) {
  return {
    id: record.id,
    reviewedByUserId: record.reviewedByUserId,
    reviewedOn: formatDate(record.reviewedOn),
    summary: record.summary,
    nextActions: record.nextActions,
    kpiSnapshot: Array.isArray(record.kpiSnapshot) ? record.kpiSnapshot : [],
    createdAt: record.createdAt.toISOString(),
  };
}

function boardLevel(track: 'GRADE_8' | 'SEE' | 'GRADE_12') {
  return track === 'GRADE_8' ? 8 : track === 'SEE' ? 10 : 12;
}

function buildBoardReadiness(input: {
  academicYearId: string;
  track: 'GRADE_8' | 'SEE' | 'GRADE_12';
  level: 8 | 10 | 12;
  studentCount: number;
  examTermName: string | null;
  expectedMarks: number | null;
  submittedMarks: number | null;
  reportCardsReady: number | null;
  iemisReady: number;
}) {
  const indicators = [
    ratioIndicator(
      'ACTIVE_STUDENTS',
      'Active students',
      input.studentCount,
      input.studentCount,
      input.studentCount > 0
        ? 'The readiness cohort comes from active students in this grade.'
        : 'No active students are assigned to this grade.',
      '/dashboard/students',
    ),
    input.examTermName
      ? ratioIndicator(
          'EXAM_TERM',
          'Exam term configured',
          1,
          1,
          `${input.examTermName} is the latest configured term for this academic year.`,
          '/dashboard/academics/exam-terms',
        )
      : unavailableIndicator(
          'EXAM_TERM',
          'Exam term configured',
          'No exam term is configured for this academic year.',
          '/dashboard/academics/exam-terms',
        ),
    input.expectedMarks === null || input.submittedMarks === null
      ? unavailableIndicator(
          'MARKS_COMPLETION',
          'Marks completion',
          'Marks readiness is unavailable until an exam term exists.',
          '/dashboard/academics/marks',
        )
      : ratioIndicator(
          'MARKS_COMPLETION',
          'Marks completion',
          input.submittedMarks,
          input.expectedMarks,
          `${input.submittedMarks} of ${input.expectedMarks} expected non-draft mark entries are present.`,
          '/dashboard/academics/marks',
        ),
    input.reportCardsReady === null
      ? unavailableIndicator(
          'REPORT_CARD_READINESS',
          'Report cards ready',
          'Report-card readiness is unavailable until an exam term exists.',
          '/dashboard/academics/publishing',
        )
      : ratioIndicator(
          'REPORT_CARD_READINESS',
          'Report cards ready',
          input.reportCardsReady,
          input.studentCount,
          `${input.reportCardsReady} of ${input.studentCount} active students have a current ready or published report card.`,
          '/dashboard/academics/publishing',
        ),
    ratioIndicator(
      'IEMIS_READINESS',
      'iEMIS-ready student records',
      input.iemisReady,
      input.studentCount,
      `${input.iemisReady} of ${input.studentCount} active students pass the current backend-owned iEMIS checks.`,
      '/dashboard/admissions/iemis',
    ),
  ];
  const states = indicators.map((item) => item.state);
  const state = states.includes('BLOCKED')
    ? ('BLOCKED' as const)
    : states.includes('NEEDS_ATTENTION')
      ? ('NEEDS_ATTENTION' as const)
      : states.includes('UNAVAILABLE')
        ? ('UNAVAILABLE' as const)
        : ('READY' as const);
  return {
    generatedAt: new Date().toISOString(),
    academicYearId: input.academicYearId,
    track: input.track,
    classLevel: input.level,
    state,
    nonPredictive: true as const,
    sourceStates: {
      students:
        input.studentCount > 0 ? ('available' as const) : ('empty' as const),
      examTerms: input.examTermName
        ? ('available' as const)
        : ('empty' as const),
      marks:
        input.expectedMarks === null
          ? ('unavailable' as const)
          : input.expectedMarks > 0
            ? ('available' as const)
            : ('empty' as const),
      reportCards:
        input.reportCardsReady === null
          ? ('unavailable' as const)
          : input.reportCardsReady > 0
            ? ('available' as const)
            : ('empty' as const),
      iemis:
        input.studentCount > 0 ? ('available' as const) : ('empty' as const),
    },
    indicators,
  };
}

function unavailableBoardReadiness(
  academicYearId: string,
  track: 'GRADE_8' | 'SEE' | 'GRADE_12',
  level: 8 | 10 | 12,
  explanation: string,
) {
  return {
    generatedAt: new Date().toISOString(),
    academicYearId,
    track,
    classLevel: level,
    state: 'UNAVAILABLE' as const,
    nonPredictive: true as const,
    sourceStates: {
      students: 'unavailable' as const,
      examTerms: 'unavailable' as const,
      marks: 'unavailable' as const,
      reportCards: 'unavailable' as const,
      iemis: 'unavailable' as const,
    },
    indicators: [
      unavailableIndicator(
        'CLASS_CONFIGURATION',
        'Grade configuration',
        explanation,
        '/dashboard/settings/academic-structure',
      ),
    ],
  };
}

function ratioIndicator(
  code: string,
  label: string,
  observed: number,
  expected: number,
  explanation: string,
  actionRoute: string,
) {
  const state =
    expected <= 0
      ? ('BLOCKED' as const)
      : observed >= expected
        ? ('READY' as const)
        : observed === 0
          ? ('BLOCKED' as const)
          : ('NEEDS_ATTENTION' as const);
  return {
    code,
    label,
    state,
    observed,
    expected,
    explanation,
    actionRoute,
  };
}

function unavailableIndicator(
  code: string,
  label: string,
  explanation: string,
  actionRoute: string,
) {
  return {
    code,
    label,
    state: 'UNAVAILABLE' as const,
    observed: null,
    expected: null,
    explanation,
    actionRoute,
  };
}

function assertObservationTransition(
  current: TeacherObservationStatus,
  next: TeacherObservationStatus,
) {
  const allowed: Record<TeacherObservationStatus, TeacherObservationStatus[]> =
    {
      DRAFT: [TeacherObservationStatus.COMPLETED],
      COMPLETED: [
        TeacherObservationStatus.ACKNOWLEDGED,
        TeacherObservationStatus.FOLLOW_UP_DUE,
        TeacherObservationStatus.CLOSED,
      ],
      ACKNOWLEDGED: [
        TeacherObservationStatus.FOLLOW_UP_DUE,
        TeacherObservationStatus.CLOSED,
      ],
      FOLLOW_UP_DUE: [TeacherObservationStatus.CLOSED],
      CLOSED: [],
    };
  if (!allowed[current].includes(next)) {
    throw new ConflictException(
      `Observation cannot move from ${current} to ${next}`,
    );
  }
}

function assertGoalTransition(
  current: TeacherDevelopmentGoalStatus,
  next: TeacherDevelopmentGoalStatus,
) {
  const allowed: Record<
    TeacherDevelopmentGoalStatus,
    TeacherDevelopmentGoalStatus[]
  > = {
    DRAFT: [
      TeacherDevelopmentGoalStatus.ACTIVE,
      TeacherDevelopmentGoalStatus.CANCELLED,
    ],
    ACTIVE: [
      TeacherDevelopmentGoalStatus.COMPLETED,
      TeacherDevelopmentGoalStatus.CANCELLED,
    ],
    COMPLETED: [],
    CANCELLED: [],
  };
  if (!allowed[current].includes(next)) {
    throw new ConflictException(
      `Development goal cannot move from ${current} to ${next}`,
    );
  }
}

function assertPlanTransition(
  current: SchoolImprovementPlanStatus,
  next: SchoolImprovementPlanStatus,
) {
  const allowed: Record<
    SchoolImprovementPlanStatus,
    SchoolImprovementPlanStatus[]
  > = {
    DRAFT: [
      SchoolImprovementPlanStatus.ACTIVE,
      SchoolImprovementPlanStatus.ARCHIVED,
    ],
    ACTIVE: [
      SchoolImprovementPlanStatus.COMPLETED,
      SchoolImprovementPlanStatus.ARCHIVED,
    ],
    COMPLETED: [SchoolImprovementPlanStatus.ARCHIVED],
    ARCHIVED: [],
  };
  if (!allowed[current].includes(next)) {
    throw new ConflictException(
      `Improvement plan cannot move from ${current} to ${next}`,
    );
  }
}

function assertActionTransition(
  current: SchoolImprovementActionStatus,
  next: SchoolImprovementActionStatus,
) {
  if (current === next) return;
  const allowed: Record<
    SchoolImprovementActionStatus,
    SchoolImprovementActionStatus[]
  > = {
    NOT_STARTED: [
      SchoolImprovementActionStatus.IN_PROGRESS,
      SchoolImprovementActionStatus.BLOCKED,
      SchoolImprovementActionStatus.COMPLETED,
      SchoolImprovementActionStatus.CANCELLED,
    ],
    IN_PROGRESS: [
      SchoolImprovementActionStatus.BLOCKED,
      SchoolImprovementActionStatus.COMPLETED,
      SchoolImprovementActionStatus.CANCELLED,
    ],
    BLOCKED: [
      SchoolImprovementActionStatus.IN_PROGRESS,
      SchoolImprovementActionStatus.CANCELLED,
    ],
    COMPLETED: [],
    CANCELLED: [],
  };
  if (!allowed[current].includes(next)) {
    throw new ConflictException(
      `Improvement action cannot move from ${current} to ${next}`,
    );
  }
}

function pageOf(query: InstitutionalPageDto) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 25;
  return { page, limit, skip: (page - 1) * limit };
}

function pageResult<T>(items: T[], total: number, page: number, limit: number) {
  return {
    items,
    total,
    page,
    limit,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

function dateOnly(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ConflictException('A supplied date is invalid');
  }
  return new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
    ),
  );
}

function assertDateOrder(
  start: string,
  end: string | undefined,
  label: string,
) {
  if (end && dateOnly(end) < dateOnly(start)) {
    throw new ConflictException(`${label} cannot be before the start date`);
  }
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function cleanOptional(value?: string) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function fingerprintOf(value: unknown) {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function assertMatchingReplay(actual: string, expected: string) {
  if (actual !== expected) {
    throw new ConflictException(
      'This request identifier was already used for different data',
    );
  }
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

function isUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}
