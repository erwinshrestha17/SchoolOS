import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  AttendanceStatus,
  CurriculumProgressStatus,
  EnrollmentStatus,
  FormativeAssessmentKind,
  HomeworkAssignmentStatus,
  HomeworkSubmissionStatus,
  LearningMasteryStatus,
  LearningOutcomeDomain,
  ParentLearningGuidanceStatus,
  Prisma,
  RemedialGroupStatus,
  StaffStatus,
  StudentInterventionEntryType,
  StudentInterventionPriority,
  StudentInterventionStatus,
  StudentLifecycleStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import {
  getParentStudentIds,
  isParentOnly,
  isTeacherOnly,
} from '../common/security/parent-scope';
import { EntitlementsService } from '../plans/entitlements.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddRemedialGroupMembersDto,
  AddStudentInterventionEntryDto,
  CreateCurriculumProgressDto,
  CreateFormativeAssessmentDto,
  CreateLearningOutcomeDto,
  CreateParentLearningGuidanceDto,
  CreateRemedialGroupDto,
  CreateStudentInterventionDto,
  EarlyWarningQueryDto,
  LearningScopeQueryDto,
  ListCurriculumProgressDto,
  ListFormativeAssessmentsDto,
  ListLearningOutcomesDto,
  ListParentLearningGuidanceDto,
  ListRemedialGroupsDto,
  ListStudentInterventionsDto,
  SetLearningOutcomeStateDto,
  UpdateCurriculumProgressDto,
  UpdateParentLearningGuidanceStatusDto,
  UpdateRemedialGroupStatusDto,
  UpdateStudentInterventionDto,
} from './dto/learning-improvement.dto';

const STUDENT_SELECT = {
  id: true,
  studentSystemId: true,
  firstNameEn: true,
  lastNameEn: true,
  classId: true,
  sectionId: true,
  class: { select: { id: true, name: true, level: true } },
  sectionRef: { select: { id: true, name: true } },
} satisfies Prisma.StudentSelect;

const SUBJECT_SELECT = {
  id: true,
  code: true,
  name: true,
} satisfies Prisma.SubjectSelect;

const TEACHER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
} satisfies Prisma.StaffSelect;

const OUTCOME_SELECT = {
  id: true,
  code: true,
  title: true,
  domain: true,
} satisfies Prisma.LearningOutcomeSelect;

const ACTIVE_INTERVENTION_STATUSES: StudentInterventionStatus[] = [
  StudentInterventionStatus.OPEN,
  StudentInterventionStatus.IN_PROGRESS,
  StudentInterventionStatus.MONITORING,
];

const ABSENCE_STATUSES: AttendanceStatus[] = [
  AttendanceStatus.ABSENT,
  AttendanceStatus.SICK_LEAVE,
  AttendanceStatus.UNEXCUSED_LEAVE,
];

const MISSING_HOMEWORK_STATUSES: HomeworkSubmissionStatus[] = [
  HomeworkSubmissionStatus.NOT_SUBMITTED,
  HomeworkSubmissionStatus.INCOMPLETE,
  HomeworkSubmissionStatus.PARTIALLY_COMPLETED,
  HomeworkSubmissionStatus.ABSENT,
];

type TeacherAccess = {
  staffId: string;
  assignments: Array<{
    academicYearId: string;
    classId: string;
    sectionId: string | null;
    subjectId: string;
  }>;
  classTeacherSections: Array<{ classId: string; sectionId: string }>;
};

@Injectable()
export class LearningImprovementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  async listOutcomes(actor: AuthContext, query: ListLearningOutcomesDto) {
    const { page, limit, skip } = pageOf(query);
    const teacherFilter = await this.buildTeacherScopeFilter(actor, true, false);
    if (teacherFilter === 'NONE') return emptyPage(page, limit);

    const where: Prisma.LearningOutcomeWhereInput = {
      tenantId: actor.tenantId,
      ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.domain ? { domain: query.domain } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(teacherFilter ?? {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.learningOutcome.count({ where }),
      this.prisma.learningOutcome.findMany({
        where,
        select: {
          id: true,
          academicYearId: true,
          classId: true,
          code: true,
          title: true,
          description: true,
          domain: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          subject: { select: SUBJECT_SELECT },
        },
        orderBy: [
          { class: { level: 'asc' } },
          { subject: { name: 'asc' } },
          { code: 'asc' },
        ],
        skip,
        take: limit,
      }),
    ]);
    return pageResult(items.map(mapOutcome), total, page, limit);
  }

  async createOutcome(actor: AuthContext, dto: CreateLearningOutcomeDto) {
    const scope = await this.assertLearningScope(actor, {
      academicYearId: dto.academicYearId,
      classId: dto.classId,
      subjectId: dto.subjectId,
    });
    if (
      dto.domain !== LearningOutcomeDomain.GENERAL &&
      scope.classroom.level > 3
    ) {
      throw new ConflictException(
        'Foundational reading and numeracy outcomes are limited to Grades 1–3',
      );
    }

    try {
      const outcome = await this.prisma.learningOutcome.create({
        data: {
          tenantId: actor.tenantId,
          academicYearId: dto.academicYearId,
          classId: dto.classId,
          subjectId: dto.subjectId,
          code: dto.code.trim().toUpperCase(),
          title: dto.title.trim(),
          description: cleanOptional(dto.description),
          domain: dto.domain,
        },
        select: {
          id: true,
          academicYearId: true,
          classId: true,
          code: true,
          title: true,
          description: true,
          domain: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          subject: { select: SUBJECT_SELECT },
        },
      });
      await this.record(actor, 'LEARNING_OUTCOME_CREATED', outcome.id, {
        classId: dto.classId,
        subjectId: dto.subjectId,
        code: outcome.code,
        domain: dto.domain,
      });
      return mapOutcome(outcome);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'An outcome with this code already exists for the selected subject',
        );
      }
      throw error;
    }
  }

  async setOutcomeState(
    actor: AuthContext,
    outcomeId: string,
    dto: SetLearningOutcomeStateDto,
  ) {
    const outcome = await this.getOutcomeInScope(actor, outcomeId);
    const updated = await this.prisma.learningOutcome.update({
      where: { id: outcome.id },
      data: { isActive: dto.isActive },
      select: {
        id: true,
        academicYearId: true,
        classId: true,
        code: true,
        title: true,
        description: true,
        domain: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        subject: { select: SUBJECT_SELECT },
      },
    });
    await this.record(actor, 'LEARNING_OUTCOME_STATE_CHANGED', outcome.id, {
      isActive: dto.isActive,
    });
    return mapOutcome(updated);
  }

  async listFormativeAssessments(
    actor: AuthContext,
    query: ListFormativeAssessmentsDto,
  ) {
    const { page, limit, skip } = pageOf(query);
    const teacherFilter = await this.buildTeacherScopeFilter(actor, true, true);
    if (teacherFilter === 'NONE') return emptyPage(page, limit);
    const where: Prisma.FormativeAssessmentEvidenceWhereInput = {
      tenantId: actor.tenantId,
      ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.outcomeId ? { outcomeId: query.outcomeId } : {}),
      ...(query.masteryStatus
        ? { masteryStatus: query.masteryStatus }
        : {}),
      ...(query.from || query.to
        ? {
            assessedOn: {
              ...(query.from ? { gte: dateOnly(query.from) } : {}),
              ...(query.to ? { lte: dateOnly(query.to) } : {}),
            },
          }
        : {}),
      ...(teacherFilter ?? {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.formativeAssessmentEvidence.count({ where }),
      this.prisma.formativeAssessmentEvidence.findMany({
        where,
        include: formativeInclude,
        orderBy: [{ assessedOn: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);
    return pageResult(items.map(mapFormativeEvidence), total, page, limit);
  }

  async createFormativeAssessment(
    actor: AuthContext,
    dto: CreateFormativeAssessmentDto,
  ) {
    if ((dto.score === undefined) !== (dto.maxScore === undefined)) {
      throw new ConflictException(
        'Score and maximum score must be provided together',
      );
    }
    if (
      dto.score !== undefined &&
      dto.maxScore !== undefined &&
      dto.score > dto.maxScore
    ) {
      throw new ConflictException('Score cannot exceed maximum score');
    }

    const scope = await this.assertLearningScope(actor, {
      academicYearId: dto.academicYearId,
      classId: dto.classId,
      sectionId: dto.sectionId,
      subjectId: dto.subjectId,
      studentId: dto.studentId,
      outcomeId: dto.outcomeId,
    });
    const staff = await this.getActorStaff(actor);
    if (
      scope.outcome &&
      scope.outcome.domain !== LearningOutcomeDomain.GENERAL &&
      scope.classroom.level > 3
    ) {
      throw new ConflictException(
        'Foundational evidence is limited to Grades 1–3',
      );
    }
    if (
      dto.kind === FormativeAssessmentKind.REASSESSMENT &&
      !dto.reassessmentOfId
    ) {
      throw new ConflictException(
        'A reassessment must reference the earlier evidence',
      );
    }
    if (
      dto.kind !== FormativeAssessmentKind.REASSESSMENT &&
      dto.reassessmentOfId
    ) {
      throw new ConflictException(
        'Only a reassessment can reference earlier evidence',
      );
    }
    if (dto.reassessmentOfId) {
      const previous =
        await this.prisma.formativeAssessmentEvidence.findFirst({
          where: {
            id: dto.reassessmentOfId,
            tenantId: actor.tenantId,
            outcomeId: dto.outcomeId,
            studentId: dto.studentId,
          },
          select: { id: true },
        });
      if (!previous) {
        throw new NotFoundException(
          'Earlier assessment evidence was not found for this student and outcome',
        );
      }
    }

    const fingerprint = requestFingerprint(dto);
    const replay =
      await this.prisma.formativeAssessmentEvidence.findFirst({
        where: {
          tenantId: actor.tenantId,
          teacherStaffId: staff.id,
          clientSubmissionId: dto.clientSubmissionId,
        },
        include: formativeInclude,
      });
    if (replay) {
      assertMatchingReplay(replay.requestFingerprint, fingerprint);
      return { ...mapFormativeEvidence(replay), replayed: true };
    }

    try {
      const evidence = await this.prisma.formativeAssessmentEvidence.create({
        data: {
          tenantId: actor.tenantId,
          outcomeId: dto.outcomeId,
          studentId: dto.studentId,
          academicYearId: dto.academicYearId,
          classId: dto.classId,
          sectionId: dto.sectionId ?? null,
          subjectId: dto.subjectId,
          teacherStaffId: staff.id,
          kind: dto.kind,
          masteryStatus: dto.masteryStatus,
          score: dto.score,
          maxScore: dto.maxScore,
          assessedOn: dateOnly(dto.assessedOn),
          note: cleanOptional(dto.note),
          observationChecklist: dto.observationChecklist ?? Prisma.JsonNull,
          parentSummary: cleanOptional(dto.parentSummary),
          reassessmentOfId: dto.reassessmentOfId ?? null,
          clientSubmissionId: dto.clientSubmissionId,
          requestFingerprint: fingerprint,
        },
        include: formativeInclude,
      });
      await this.record(actor, 'FORMATIVE_ASSESSMENT_RECORDED', evidence.id, {
        studentId: dto.studentId,
        outcomeId: dto.outcomeId,
        masteryStatus: dto.masteryStatus,
        reassessmentOfId: dto.reassessmentOfId ?? null,
      });
      return { ...mapFormativeEvidence(evidence), replayed: false };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const concurrent =
        await this.prisma.formativeAssessmentEvidence.findFirst({
          where: {
            tenantId: actor.tenantId,
            teacherStaffId: staff.id,
            clientSubmissionId: dto.clientSubmissionId,
          },
          include: formativeInclude,
        });
      if (!concurrent) throw error;
      assertMatchingReplay(concurrent.requestFingerprint, fingerprint);
      return { ...mapFormativeEvidence(concurrent), replayed: true };
    }
  }

  async getStudentOutcomeProgress(
    actor: AuthContext,
    studentId: string,
    query: LearningScopeQueryDto,
  ) {
    const academicYearId =
      query.academicYearId ??
      (await this.getCurrentAcademicYearId(actor.tenantId));
    const student = await this.getStudentScope(
      actor,
      studentId,
      academicYearId,
    );
    const evidence = await this.prisma.formativeAssessmentEvidence.findMany({
      where: {
        tenantId: actor.tenantId,
        studentId,
        academicYearId,
        ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      },
      select: {
        outcome: { select: OUTCOME_SELECT },
        masteryStatus: true,
        assessedOn: true,
        parentSummary: true,
        createdAt: true,
      },
      orderBy: [{ assessedOn: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });
    return {
      student: mapStudent(student),
      items: buildOutcomeProgress(evidence),
    };
  }

  async getTeacherStudentLearningHub(
    actor: AuthContext,
    studentId: string,
    query: LearningScopeQueryDto,
  ) {
    const academicYearId =
      query.academicYearId ??
      (await this.getCurrentAcademicYearId(actor.tenantId));
    const scopedQuery = { ...query, academicYearId };
    const progress = await this.getStudentOutcomeProgress(
      actor,
      studentId,
      scopedQuery,
    );
    const [outcomes, interventions, remedialGroups, guidance] =
      await Promise.all([
        this.listOutcomes(actor, {
          academicYearId,
          classId: progress.student.classId,
          subjectId: query.subjectId,
          isActive: true,
          page: 1,
          limit: 100,
        }),
        this.listInterventions(actor, {
          academicYearId,
          studentId,
          page: 1,
          limit: 20,
        }),
        this.listRemedialGroups(actor, {
          academicYearId,
          studentId,
          page: 1,
          limit: 20,
        }),
        this.listGuidance(actor, {
          academicYearId,
          studentId,
          page: 1,
          limit: 20,
        }),
      ]);
    return {
      generatedAt: new Date().toISOString(),
      student: progress.student,
      sourceStates: {
        outcomes:
          outcomes.items.length > 0
            ? ('available' as const)
            : ('empty' as const),
        outcomeProgress:
          progress.items.length > 0
            ? ('available' as const)
            : ('empty' as const),
        interventions:
          interventions.items.length > 0
            ? ('available' as const)
            : ('empty' as const),
        remedialSupport:
          remedialGroups.items.length > 0
            ? ('available' as const)
            : ('empty' as const),
        parentGuidance:
          guidance.items.length > 0
            ? ('available' as const)
            : ('empty' as const),
      },
      availableOutcomes: outcomes.items,
      outcomeProgress: progress.items,
      interventions: interventions.items,
      remedialGroups: remedialGroups.items,
      parentGuidance: guidance.items,
    };
  }

  async getEarlyWarnings(actor: AuthContext, query: EarlyWarningQueryDto) {
    const generatedAt = new Date();
    const academicYearId =
      query.academicYearId ??
      (await this.getCurrentAcademicYearId(actor.tenantId));
    const attendanceEnabled =
      await this.entitlementsService.checkModuleEnabled(
        actor.tenantId,
        'attendance',
      );
    const homeworkEnabled = await this.entitlementsService.checkModuleEnabled(
      actor.tenantId,
      'homework',
    );
    const teacherStudentFilter = await this.buildTeacherStudentFilter(actor);
    if (teacherStudentFilter === 'NONE') {
      return {
        ...emptyPage(query.page ?? 1, query.limit ?? 25),
        generatedAt: generatedAt.toISOString(),
        rulesVersion: 'stage3-v1' as const,
        nonPredictive: true as const,
      };
    }

    const thirtyDaysAgo = new Date(generatedAt);
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
    const sixtyDaysAgo = new Date(generatedAt);
    sixtyDaysAgo.setUTCDate(sixtyDaysAgo.getUTCDate() - 60);

    const [absenceCandidates, formativeCandidates, homeworkCandidates] =
      await Promise.all([
        attendanceEnabled
          ? this.prisma.attendanceRecord.groupBy({
              by: ['studentId'],
              where: {
                tenantId: actor.tenantId,
                status: { in: ABSENCE_STATUSES },
                attendanceSession: {
                  attendanceDate: { gte: thirtyDaysAgo, lte: generatedAt },
                  academicYearId,
                },
              },
              _count: { _all: true },
              having: { studentId: { _count: { gte: 2 } } },
              orderBy: { _count: { studentId: 'desc' } },
              take: 2000,
            })
          : Promise.resolve([]),
        this.prisma.formativeAssessmentEvidence.groupBy({
          by: ['studentId'],
          where: {
            tenantId: actor.tenantId,
            academicYearId,
            ...(query.subjectId ? { subjectId: query.subjectId } : {}),
            masteryStatus: LearningMasteryStatus.BEGINNING,
            assessedOn: { gte: sixtyDaysAgo, lte: generatedAt },
          },
          _count: { _all: true },
          having: { studentId: { _count: { gte: 2 } } },
          orderBy: { _count: { studentId: 'desc' } },
          take: 2000,
        }),
        homeworkEnabled
          ? this.prisma.homeworkSubmission.groupBy({
              by: ['studentId'],
              where: {
                tenantId: actor.tenantId,
                status: { in: MISSING_HOMEWORK_STATUSES },
                homework: {
                  academicYearId,
                  ...(query.subjectId ? { subjectId: query.subjectId } : {}),
                  status: HomeworkAssignmentStatus.ASSIGNED,
                  submissionRequired: true,
                  dueAt: { lt: generatedAt, gte: sixtyDaysAgo },
                },
              },
              _count: { _all: true },
              having: { studentId: { _count: { gte: 2 } } },
              orderBy: { _count: { studentId: 'desc' } },
              take: 2000,
            })
          : Promise.resolve([]),
      ]);

    const candidateIds = Array.from(
      new Set([
        ...absenceCandidates.map((row) => row.studentId),
        ...formativeCandidates.map((row) => row.studentId),
        ...homeworkCandidates.map((row) => row.studentId),
      ]),
    );
    const { page, limit, skip } = pageOf(query);
    if (candidateIds.length === 0) {
      return {
        ...emptyPage(page, limit),
        generatedAt: generatedAt.toISOString(),
        rulesVersion: 'stage3-v1' as const,
        nonPredictive: true as const,
      };
    }

    const studentWhere: Prisma.StudentWhereInput = {
      tenantId: actor.tenantId,
      lifecycleStatus: StudentLifecycleStatus.ACTIVE,
      id: { in: candidateIds },
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      ...(query.search
        ? {
            OR: [
              {
                firstNameEn: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
              {
                lastNameEn: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
              {
                studentSystemId: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
      ...(teacherStudentFilter ?? {}),
    };
    const [total, students] = await Promise.all([
      this.prisma.student.count({ where: studentWhere }),
      this.prisma.student.findMany({
        where: studentWhere,
        select: STUDENT_SELECT,
        orderBy: [
          { class: { level: 'asc' } },
          { firstNameEn: 'asc' },
          { lastNameEn: 'asc' },
        ],
        skip,
        take: limit,
      }),
    ]);
    const studentIds = students.map((student) => student.id);
    const [
      attendanceRows,
      formativeRows,
      homeworkRows,
      interventionRows,
    ] = await Promise.all([
      attendanceEnabled && studentIds.length > 0
        ? this.prisma.attendanceRecord.groupBy({
            by: ['studentId', 'status'],
            where: {
              tenantId: actor.tenantId,
              studentId: { in: studentIds },
              attendanceSession: {
                attendanceDate: { gte: thirtyDaysAgo, lte: generatedAt },
                academicYearId,
              },
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      this.prisma.formativeAssessmentEvidence.findMany({
        where: {
          tenantId: actor.tenantId,
          studentId: { in: studentIds },
          academicYearId,
          ...(query.subjectId ? { subjectId: query.subjectId } : {}),
          assessedOn: { gte: sixtyDaysAgo, lte: generatedAt },
        },
        select: {
          studentId: true,
          masteryStatus: true,
          score: true,
          maxScore: true,
          assessedOn: true,
        },
        orderBy: [{ assessedOn: 'desc' }, { createdAt: 'desc' }],
        take: Math.max(studentIds.length * 20, 20),
      }),
      homeworkEnabled && studentIds.length > 0
        ? this.prisma.homeworkSubmission.groupBy({
            by: ['studentId', 'status'],
            where: {
              tenantId: actor.tenantId,
              studentId: { in: studentIds },
              homework: {
                academicYearId,
                ...(query.subjectId ? { subjectId: query.subjectId } : {}),
                status: HomeworkAssignmentStatus.ASSIGNED,
                submissionRequired: true,
                dueAt: { lt: generatedAt, gte: sixtyDaysAgo },
              },
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      this.prisma.studentInterventionCase.findMany({
        where: {
          tenantId: actor.tenantId,
          studentId: { in: studentIds },
          academicYearId,
          status: {
            in:
              query.interventionStatus !== undefined
                ? [query.interventionStatus]
                : ACTIVE_INTERVENTION_STATUSES,
          },
        },
        select: { id: true, studentId: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const items = students
      .map((student) =>
        buildEarlyWarningItem({
          student,
          generatedAt,
          attendanceEnabled,
          homeworkEnabled,
          attendanceRows,
          formativeRows,
          homeworkRows,
          interventionRows,
        }),
      )
      .filter((item) => item.reasons.length > 0);
    return {
      ...pageResult(items, total, page, limit),
      generatedAt: generatedAt.toISOString(),
      rulesVersion: 'stage3-v1' as const,
      nonPredictive: true as const,
    };
  }

  async listInterventions(
    actor: AuthContext,
    query: ListStudentInterventionsDto,
  ) {
    const { page, limit, skip } = pageOf(query);
    const teacherFilter = await this.buildTeacherScopeFilter(actor, false, true);
    if (teacherFilter === 'NONE') return emptyPage(page, limit);
    const where: Prisma.StudentInterventionCaseWhereInput = {
      tenantId: actor.tenantId,
      ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.ownerStaffId ? { ownerStaffId: query.ownerStaffId } : {}),
      ...(teacherFilter ?? {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.studentInterventionCase.count({ where }),
      this.prisma.studentInterventionCase.findMany({
        where,
        include: interventionInclude,
        orderBy: [
          { status: 'asc' },
          { nextFollowUpOn: 'asc' },
          { updatedAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
    ]);
    return pageResult(items.map(mapIntervention), total, page, limit);
  }

  async getIntervention(actor: AuthContext, caseId: string) {
    const record = await this.getInterventionInScope(actor, caseId);
    return mapIntervention(record);
  }

  async createIntervention(
    actor: AuthContext,
    dto: CreateStudentInterventionDto,
  ) {
    const student = await this.getStudentScope(
      actor,
      dto.studentId,
      dto.academicYearId,
    );
    if (dto.ownerStaffId) {
      await this.assertStaffInTenant(actor.tenantId, dto.ownerStaffId);
    }
    const fingerprint = requestFingerprint(dto);
    const replay = await this.prisma.studentInterventionCase.findFirst({
      where: {
        tenantId: actor.tenantId,
        createdByUserId: actor.userId,
        clientRequestId: dto.clientRequestId,
      },
      include: interventionInclude,
    });
    if (replay) {
      assertMatchingReplay(replay.requestFingerprint, fingerprint);
      return { ...mapIntervention(replay), replayed: true };
    }

    try {
      const record = await this.prisma.$transaction(async (tx) => {
        const created = await tx.studentInterventionCase.create({
          data: {
            tenantId: actor.tenantId,
            studentId: dto.studentId,
            academicYearId: dto.academicYearId,
            classId: student.classId,
            sectionId: student.sectionId,
            ownerStaffId: dto.ownerStaffId ?? null,
            sourceSignalKey: cleanOptional(dto.sourceSignalKey),
            priority: dto.priority,
            title: dto.title.trim(),
            concernSummary: dto.concernSummary.trim(),
            parentVisibleSummary: cleanOptional(dto.parentVisibleSummary),
            nextFollowUpOn: dto.nextFollowUpOn
              ? dateOnly(dto.nextFollowUpOn)
              : null,
            createdByUserId: actor.userId,
            clientRequestId: dto.clientRequestId,
            requestFingerprint: fingerprint,
          },
        });
        await tx.studentInterventionEntry.create({
          data: {
            tenantId: actor.tenantId,
            caseId: created.id,
            entryType: StudentInterventionEntryType.NOTE,
            body: dto.concernSummary.trim(),
            parentVisible: Boolean(dto.parentVisibleSummary),
            nextFollowUpOn: dto.nextFollowUpOn
              ? dateOnly(dto.nextFollowUpOn)
              : null,
            actorUserId: actor.userId,
          },
        });
        return tx.studentInterventionCase.findUniqueOrThrow({
          where: { id: created.id },
          include: interventionInclude,
        });
      });
      await this.record(actor, 'STUDENT_INTERVENTION_CREATED', record.id, {
        studentId: dto.studentId,
        priority: dto.priority,
        ownerStaffId: dto.ownerStaffId ?? null,
        sourceSignalKey: dto.sourceSignalKey ?? null,
      });
      return { ...mapIntervention(record), replayed: false };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const concurrent = await this.prisma.studentInterventionCase.findFirst({
        where: {
          tenantId: actor.tenantId,
          createdByUserId: actor.userId,
          clientRequestId: dto.clientRequestId,
        },
        include: interventionInclude,
      });
      if (!concurrent) throw error;
      assertMatchingReplay(concurrent.requestFingerprint, fingerprint);
      return { ...mapIntervention(concurrent), replayed: true };
    }
  }

  async addInterventionEntry(
    actor: AuthContext,
    caseId: string,
    dto: AddStudentInterventionEntryDto,
  ) {
    const record = await this.getInterventionInScope(actor, caseId);
    if (
      record.status === StudentInterventionStatus.CLOSED ||
      (record.status === StudentInterventionStatus.RESOLVED &&
        dto.entryType !== StudentInterventionEntryType.PROGRESS)
    ) {
      throw new ConflictException(
        'Closed or resolved intervention cases must be reopened before adding this update',
      );
    }
    const fingerprint = requestFingerprint(dto);
    const replay = await this.prisma.studentInterventionEntry.findFirst({
      where: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        clientRequestId: dto.clientRequestId,
      },
    });
    if (replay) {
      assertMatchingReplay(replay.requestFingerprint, fingerprint);
      return { ...mapInterventionEntry(replay), replayed: true };
    }

    try {
      const entry = await this.prisma.$transaction(async (tx) => {
        const created = await tx.studentInterventionEntry.create({
          data: {
            tenantId: actor.tenantId,
            caseId,
            entryType: dto.entryType,
            body: dto.body.trim(),
            parentVisible: dto.parentVisible,
            contactedAt: dto.contactedAt
              ? new Date(dto.contactedAt)
              : null,
            nextFollowUpOn: dto.nextFollowUpOn
              ? dateOnly(dto.nextFollowUpOn)
              : null,
            actorUserId: actor.userId,
            clientRequestId: dto.clientRequestId,
            requestFingerprint: fingerprint,
          },
        });
        await tx.studentInterventionCase.update({
          where: { id: caseId },
          data: {
            ...(dto.nextFollowUpOn
              ? { nextFollowUpOn: dateOnly(dto.nextFollowUpOn) }
              : {}),
            ...(dto.entryType === StudentInterventionEntryType.ESCALATION
              ? {
                  priority: StudentInterventionPriority.URGENT,
                  escalatedAt: new Date(),
                }
              : {}),
            version: { increment: 1 },
          },
        });
        return created;
      });
      await this.record(actor, 'STUDENT_INTERVENTION_ENTRY_ADDED', caseId, {
        entryId: entry.id,
        entryType: dto.entryType,
        parentVisible: dto.parentVisible,
      });
      return { ...mapInterventionEntry(entry), replayed: false };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const concurrent = await this.prisma.studentInterventionEntry.findFirst({
        where: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          clientRequestId: dto.clientRequestId,
        },
      });
      if (!concurrent) throw error;
      assertMatchingReplay(concurrent.requestFingerprint, fingerprint);
      return { ...mapInterventionEntry(concurrent), replayed: true };
    }
  }

  async updateIntervention(
    actor: AuthContext,
    caseId: string,
    dto: UpdateStudentInterventionDto,
  ) {
    const current = await this.getInterventionInScope(actor, caseId);
    assertInterventionTransition(current.status, dto.status);
    if (dto.ownerStaffId) {
      await this.assertStaffInTenant(actor.tenantId, dto.ownerStaffId);
    }
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.studentInterventionCase.updateMany({
        where: {
          id: caseId,
          tenantId: actor.tenantId,
          version: dto.expectedVersion,
        },
        data: {
          status: dto.status,
          ownerStaffId: dto.ownerStaffId ?? current.ownerStaffId,
          priority: dto.priority ?? current.priority,
          nextFollowUpOn: dto.nextFollowUpOn
            ? dateOnly(dto.nextFollowUpOn)
            : current.nextFollowUpOn,
          parentVisibleSummary:
            cleanOptional(dto.parentVisibleSummary) ??
            current.parentVisibleSummary,
          resolutionSummary:
            dto.status === StudentInterventionStatus.RESOLVED ||
            dto.status === StudentInterventionStatus.CLOSED
              ? dto.resolutionSummary?.trim()
              : dto.status === StudentInterventionStatus.IN_PROGRESS &&
                  current.status === StudentInterventionStatus.RESOLVED
                ? null
                : current.resolutionSummary,
          resolvedAt:
            dto.status === StudentInterventionStatus.RESOLVED
              ? now
              : dto.status === StudentInterventionStatus.IN_PROGRESS &&
                  current.status === StudentInterventionStatus.RESOLVED
                ? null
                : current.resolvedAt,
          ...(dto.priority === StudentInterventionPriority.URGENT &&
          !current.escalatedAt
            ? { escalatedAt: now }
            : {}),
          version: { increment: 1 },
        },
      });
      if (claim.count !== 1) {
        throw new ConflictException(
          'This intervention changed while you were reviewing it. Refresh and try again.',
        );
      }
      if (
        current.status !== dto.status ||
        dto.priority === StudentInterventionPriority.URGENT
      ) {
        await tx.studentInterventionEntry.create({
          data: {
            tenantId: actor.tenantId,
            caseId,
            entryType:
              dto.status === StudentInterventionStatus.RESOLVED ||
              dto.status === StudentInterventionStatus.CLOSED
                ? StudentInterventionEntryType.RESOLUTION
                : dto.priority === StudentInterventionPriority.URGENT
                  ? StudentInterventionEntryType.ESCALATION
                  : StudentInterventionEntryType.PROGRESS,
            body: dto.resolutionSummary?.trim() ?? dto.reason.trim(),
            parentVisible: Boolean(dto.parentVisibleSummary),
            nextFollowUpOn: dto.nextFollowUpOn
              ? dateOnly(dto.nextFollowUpOn)
              : null,
            actorUserId: actor.userId,
          },
        });
      }
      return tx.studentInterventionCase.findUniqueOrThrow({
        where: { id: caseId },
        include: interventionInclude,
      });
    });
    await this.record(actor, 'STUDENT_INTERVENTION_UPDATED', caseId, {
      fromStatus: current.status,
      toStatus: dto.status,
      reason: dto.reason.trim(),
      ownerStaffId: dto.ownerStaffId ?? current.ownerStaffId,
      priority: dto.priority ?? current.priority,
    });
    return mapIntervention(updated);
  }

  async listRemedialGroups(actor: AuthContext, query: ListRemedialGroupsDto) {
    const { page, limit, skip } = pageOf(query);
    const teacherFilter = await this.buildTeacherScopeFilter(actor, true, true);
    if (teacherFilter === 'NONE') return emptyPage(page, limit);
    const where: Prisma.RemedialGroupWhereInput = {
      tenantId: actor.tenantId,
      ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.studentId
        ? { memberships: { some: { studentId: query.studentId } } }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(teacherFilter ?? {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.remedialGroup.count({ where }),
      this.prisma.remedialGroup.findMany({
        where,
        include: remedialInclude,
        orderBy: [{ status: 'asc' }, { startsOn: 'asc' }],
        skip,
        take: limit,
      }),
    ]);
    return pageResult(items.map(mapRemedialGroup), total, page, limit);
  }

  async createRemedialGroup(
    actor: AuthContext,
    dto: CreateRemedialGroupDto,
  ) {
    if (dto.endsOn && dateOnly(dto.endsOn) < dateOnly(dto.startsOn)) {
      throw new ConflictException('End date cannot be before start date');
    }
    await this.assertLearningScope(actor, {
      academicYearId: dto.academicYearId,
      classId: dto.classId,
      sectionId: dto.sectionId,
      subjectId: dto.subjectId,
      outcomeId: dto.outcomeId,
    });
    const staff = await this.getActorStaff(actor);
    const fingerprint = requestFingerprint(dto);
    const replay = await this.prisma.remedialGroup.findFirst({
      where: {
        tenantId: actor.tenantId,
        createdByUserId: actor.userId,
        clientRequestId: dto.clientRequestId,
      },
      include: remedialInclude,
    });
    if (replay) {
      assertMatchingReplay(replay.requestFingerprint, fingerprint);
      return { ...mapRemedialGroup(replay), replayed: true };
    }
    try {
      const group = await this.prisma.remedialGroup.create({
        data: {
          tenantId: actor.tenantId,
          academicYearId: dto.academicYearId,
          classId: dto.classId,
          sectionId: dto.sectionId ?? null,
          subjectId: dto.subjectId,
          outcomeId: dto.outcomeId ?? null,
          teacherStaffId: staff.id,
          name: dto.name.trim(),
          purpose: dto.purpose.trim(),
          startsOn: dateOnly(dto.startsOn),
          endsOn: dto.endsOn ? dateOnly(dto.endsOn) : null,
          scheduleNote: cleanOptional(dto.scheduleNote),
          parentSummary: cleanOptional(dto.parentSummary),
          createdByUserId: actor.userId,
          clientRequestId: dto.clientRequestId,
          requestFingerprint: fingerprint,
        },
        include: remedialInclude,
      });
      await this.record(actor, 'REMEDIAL_GROUP_CREATED', group.id, {
        classId: dto.classId,
        subjectId: dto.subjectId,
        outcomeId: dto.outcomeId ?? null,
      });
      return { ...mapRemedialGroup(group), replayed: false };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const concurrent = await this.prisma.remedialGroup.findFirst({
        where: {
          tenantId: actor.tenantId,
          createdByUserId: actor.userId,
          clientRequestId: dto.clientRequestId,
        },
        include: remedialInclude,
      });
      if (!concurrent) throw error;
      assertMatchingReplay(concurrent.requestFingerprint, fingerprint);
      return { ...mapRemedialGroup(concurrent), replayed: true };
    }
  }

  async addRemedialMembers(
    actor: AuthContext,
    groupId: string,
    dto: AddRemedialGroupMembersDto,
  ) {
    const group = await this.getRemedialGroupInScope(actor, groupId);
    if (
      group.status === RemedialGroupStatus.COMPLETED ||
      group.status === RemedialGroupStatus.CANCELLED
    ) {
      throw new ConflictException(
        'Members cannot be changed after a remedial group is completed or cancelled',
      );
    }
    const students = await this.prisma.student.findMany({
      where: {
        tenantId: actor.tenantId,
        id: { in: Array.from(new Set(dto.studentIds)) },
        lifecycleStatus: StudentLifecycleStatus.ACTIVE,
        classId: group.classId,
        ...(group.sectionId ? { sectionId: group.sectionId } : {}),
        enrollments: {
          some: {
            tenantId: actor.tenantId,
            academicYearId: group.academicYearId,
            classId: group.classId,
            ...(group.sectionId ? { sectionId: group.sectionId } : {}),
            status: EnrollmentStatus.ACTIVE,
          },
        },
      },
      select: { id: true },
    });
    if (students.length !== new Set(dto.studentIds).size) {
      throw new ConflictException(
        'Every remedial-group member must be an active student in the selected class scope',
      );
    }
    await this.prisma.$transaction(
      students.map((student) =>
        this.prisma.remedialGroupMember.upsert({
          where: {
            tenantId_groupId_studentId: {
              tenantId: actor.tenantId,
              groupId,
              studentId: student.id,
            },
          },
          update: { isActive: true, leftAt: null },
          create: {
            tenantId: actor.tenantId,
            groupId,
            studentId: student.id,
            addedByUserId: actor.userId,
          },
        }),
      ),
    );
    await this.record(actor, 'REMEDIAL_GROUP_MEMBERS_ADDED', groupId, {
      studentIds: students.map((student) => student.id),
    });
    const updated = await this.getRemedialGroupInScope(actor, groupId);
    return mapRemedialGroup(updated);
  }

  async updateRemedialStatus(
    actor: AuthContext,
    groupId: string,
    dto: UpdateRemedialGroupStatusDto,
  ) {
    const current = await this.getRemedialGroupInScope(actor, groupId);
    assertRemedialTransition(current.status, dto.status);
    const updated = await this.prisma.remedialGroup.update({
      where: { id: current.id },
      data: {
        status: dto.status,
        ...(dto.status === RemedialGroupStatus.COMPLETED
          ? {
              memberships: {
                updateMany: {
                  where: { isActive: true },
                  data: { isActive: false, leftAt: new Date() },
                },
              },
            }
          : {}),
      },
      include: remedialInclude,
    });
    await this.record(actor, 'REMEDIAL_GROUP_STATUS_CHANGED', groupId, {
      fromStatus: current.status,
      toStatus: dto.status,
      reason: dto.reason.trim(),
    });
    return mapRemedialGroup(updated);
  }

  async listCurriculumProgress(
    actor: AuthContext,
    query: ListCurriculumProgressDto,
  ) {
    const { page, limit, skip } = pageOf(query);
    const teacherFilter = await this.buildTeacherScopeFilter(actor, true, true);
    if (teacherFilter === 'NONE') {
      return {
        ...emptyPage(page, limit),
        summary: emptyCurriculumSummary(),
      };
    }
    const where: Prisma.CurriculumProgressItemWhereInput = {
      tenantId: actor.tenantId,
      ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            plannedOn: {
              ...(query.from ? { gte: dateOnly(query.from) } : {}),
              ...(query.to ? { lte: dateOnly(query.to) } : {}),
            },
          }
        : {}),
      ...(teacherFilter ?? {}),
    };
    const [total, items, grouped] = await Promise.all([
      this.prisma.curriculumProgressItem.count({ where }),
      this.prisma.curriculumProgressItem.findMany({
        where,
        include: curriculumInclude,
        orderBy: [{ plannedOn: 'asc' }, { createdAt: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.curriculumProgressItem.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
    ]);
    return {
      ...pageResult(items.map(mapCurriculumProgress), total, page, limit),
      summary: buildCurriculumSummary(grouped),
    };
  }

  async createCurriculumProgress(
    actor: AuthContext,
    dto: CreateCurriculumProgressDto,
  ) {
    validateCurriculumState(dto);
    await this.assertLearningScope(actor, {
      academicYearId: dto.academicYearId,
      classId: dto.classId,
      sectionId: dto.sectionId,
      subjectId: dto.subjectId,
      outcomeId: dto.outcomeId,
    });
    const staff = await this.getActorStaff(actor);
    const fingerprint = requestFingerprint(dto);
    const replay = await this.prisma.curriculumProgressItem.findFirst({
      where: {
        tenantId: actor.tenantId,
        createdByUserId: actor.userId,
        clientRequestId: dto.clientRequestId,
      },
      include: curriculumInclude,
    });
    if (replay) {
      assertMatchingReplay(replay.requestFingerprint, fingerprint);
      return { ...mapCurriculumProgress(replay), replayed: true };
    }
    try {
      const item = await this.prisma.curriculumProgressItem.create({
        data: {
          tenantId: actor.tenantId,
          academicYearId: dto.academicYearId,
          classId: dto.classId,
          sectionId: dto.sectionId ?? null,
          subjectId: dto.subjectId,
          outcomeId: dto.outcomeId ?? null,
          teacherStaffId: staff.id,
          title: dto.title.trim(),
          status: dto.status,
          plannedOn: dateOnly(dto.plannedOn),
          completedOn: dto.completedOn ? dateOnly(dto.completedOn) : null,
          missedReason: cleanOptional(dto.missedReason),
          reteachPlan: cleanOptional(dto.reteachPlan),
          resourceUrl: cleanOptional(dto.resourceUrl),
          note: cleanOptional(dto.note),
          createdByUserId: actor.userId,
          clientRequestId: dto.clientRequestId,
          requestFingerprint: fingerprint,
        },
        include: curriculumInclude,
      });
      await this.record(actor, 'CURRICULUM_PROGRESS_CREATED', item.id, {
        classId: dto.classId,
        subjectId: dto.subjectId,
        status: dto.status,
      });
      return { ...mapCurriculumProgress(item), replayed: false };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const concurrent = await this.prisma.curriculumProgressItem.findFirst({
        where: {
          tenantId: actor.tenantId,
          createdByUserId: actor.userId,
          clientRequestId: dto.clientRequestId,
        },
        include: curriculumInclude,
      });
      if (!concurrent) throw error;
      assertMatchingReplay(concurrent.requestFingerprint, fingerprint);
      return { ...mapCurriculumProgress(concurrent), replayed: true };
    }
  }

  async updateCurriculumProgress(
    actor: AuthContext,
    itemId: string,
    dto: UpdateCurriculumProgressDto,
  ) {
    validateCurriculumState(dto);
    const current = await this.getCurriculumItemInScope(actor, itemId);
    const updated = await this.prisma.curriculumProgressItem.update({
      where: { id: current.id },
      data: {
        status: dto.status,
        completedOn: dto.completedOn ? dateOnly(dto.completedOn) : null,
        missedReason: cleanOptional(dto.missedReason),
        reteachPlan: cleanOptional(dto.reteachPlan),
        resourceUrl: cleanOptional(dto.resourceUrl) ?? current.resourceUrl,
      },
      include: curriculumInclude,
    });
    await this.record(actor, 'CURRICULUM_PROGRESS_UPDATED', itemId, {
      fromStatus: current.status,
      toStatus: dto.status,
      reason: dto.reason.trim(),
    });
    return mapCurriculumProgress(updated);
  }

  async listGuidance(
    actor: AuthContext,
    query: ListParentLearningGuidanceDto,
  ) {
    const { page, limit, skip } = pageOf(query);
    const teacherFilter = await this.buildTeacherScopeFilter(actor, true, true);
    if (teacherFilter === 'NONE') return emptyPage(page, limit);
    const where: Prisma.ParentLearningGuidanceWhereInput = {
      tenantId: actor.tenantId,
      ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.classId ? { student: { classId: query.classId } } : {}),
      ...(query.sectionId ? { student: { sectionId: query.sectionId } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(teacherFilter ?? {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.parentLearningGuidance.count({ where }),
      this.prisma.parentLearningGuidance.findMany({
        where,
        include: guidanceInclude,
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);
    return pageResult(items.map(mapGuidance), total, page, limit);
  }

  async createGuidance(
    actor: AuthContext,
    dto: CreateParentLearningGuidanceDto,
  ) {
    const student = await this.getStudentScope(
      actor,
      dto.studentId,
      dto.academicYearId,
    );
    await this.assertLearningScope(actor, {
      academicYearId: dto.academicYearId,
      classId: student.classId,
      sectionId: student.sectionId ?? undefined,
      subjectId: dto.subjectId,
      studentId: dto.studentId,
      outcomeId: dto.outcomeId,
    });
    if (
      dto.visibleFrom &&
      dto.visibleUntil &&
      new Date(dto.visibleUntil) < new Date(dto.visibleFrom)
    ) {
      throw new ConflictException(
        'Guidance visibility end cannot be before its start',
      );
    }
    if (dto.remedialGroupId) {
      const group = await this.prisma.remedialGroup.findFirst({
        where: {
          id: dto.remedialGroupId,
          tenantId: actor.tenantId,
          academicYearId: dto.academicYearId,
          subjectId: dto.subjectId,
          memberships: {
            some: { studentId: dto.studentId, isActive: true },
          },
        },
        select: { id: true },
      });
      if (!group) {
        throw new ConflictException(
          'Linked remedial support must be active for this student and subject',
        );
      }
    }
    const staff = await this.getActorStaff(actor);
    const fingerprint = requestFingerprint(dto);
    const replay = await this.prisma.parentLearningGuidance.findFirst({
      where: {
        tenantId: actor.tenantId,
        createdByUserId: actor.userId,
        clientRequestId: dto.clientRequestId,
      },
      include: guidanceInclude,
    });
    if (replay) {
      assertMatchingReplay(replay.requestFingerprint, fingerprint);
      return { ...mapGuidance(replay), replayed: true };
    }
    try {
      const guidance = await this.prisma.parentLearningGuidance.create({
        data: {
          tenantId: actor.tenantId,
          studentId: dto.studentId,
          academicYearId: dto.academicYearId,
          subjectId: dto.subjectId,
          outcomeId: dto.outcomeId ?? null,
          remedialGroupId: dto.remedialGroupId ?? null,
          teacherStaffId: staff.id,
          title: dto.title.trim(),
          skillExplanation: dto.skillExplanation.trim(),
          homeActivity: dto.homeActivity.trim(),
          visibleFrom: dto.visibleFrom ? new Date(dto.visibleFrom) : null,
          visibleUntil: dto.visibleUntil ? new Date(dto.visibleUntil) : null,
          createdByUserId: actor.userId,
          clientRequestId: dto.clientRequestId,
          requestFingerprint: fingerprint,
        },
        include: guidanceInclude,
      });
      await this.record(actor, 'PARENT_LEARNING_GUIDANCE_CREATED', guidance.id, {
        studentId: dto.studentId,
        subjectId: dto.subjectId,
        outcomeId: dto.outcomeId ?? null,
      });
      return { ...mapGuidance(guidance), replayed: false };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const concurrent = await this.prisma.parentLearningGuidance.findFirst({
        where: {
          tenantId: actor.tenantId,
          createdByUserId: actor.userId,
          clientRequestId: dto.clientRequestId,
        },
        include: guidanceInclude,
      });
      if (!concurrent) throw error;
      assertMatchingReplay(concurrent.requestFingerprint, fingerprint);
      return { ...mapGuidance(concurrent), replayed: true };
    }
  }

  async updateGuidanceStatus(
    actor: AuthContext,
    guidanceId: string,
    dto: UpdateParentLearningGuidanceStatusDto,
  ) {
    const current = await this.getGuidanceInScope(actor, guidanceId);
    assertGuidanceTransition(current.status, dto.status);
    const updated = await this.prisma.parentLearningGuidance.update({
      where: { id: current.id },
      data: {
        status: dto.status,
        publishedAt:
          dto.status === ParentLearningGuidanceStatus.PUBLISHED
            ? new Date()
            : current.publishedAt,
      },
      include: guidanceInclude,
    });
    await this.record(actor, 'PARENT_LEARNING_GUIDANCE_STATUS_CHANGED', guidanceId, {
      fromStatus: current.status,
      toStatus: dto.status,
      reason: dto.reason.trim(),
    });
    return mapGuidance(updated);
  }

  async getParentLearningSummary(studentId: string, actor: AuthContext) {
    if (!isParentOnly(actor)) {
      throw new ForbiddenException(
        'Learning guidance is limited to linked parent accounts',
      );
    }
    const linkedStudentIds = await getParentStudentIds(this.prisma, actor);
    if (!linkedStudentIds?.includes(studentId)) {
      throw new ForbiddenException(
        'You can only view learning guidance for a linked child',
      );
    }
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        tenantId: actor.tenantId,
        lifecycleStatus: StudentLifecycleStatus.ACTIVE,
      },
      select: STUDENT_SELECT,
    });
    if (!student) {
      throw new NotFoundException('Linked student was not found');
    }
    const academicYearId = await this.getCurrentAcademicYearId(actor.tenantId);
    const now = new Date();
    const [evidence, guidance, remedialMemberships, interventions] =
      await Promise.all([
        this.prisma.formativeAssessmentEvidence.findMany({
          where: {
            tenantId: actor.tenantId,
            studentId,
            academicYearId,
            parentSummary: { not: null },
          },
          select: {
            outcome: { select: OUTCOME_SELECT },
            masteryStatus: true,
            assessedOn: true,
            parentSummary: true,
            createdAt: true,
          },
          orderBy: [{ assessedOn: 'desc' }, { createdAt: 'desc' }],
          take: 100,
        }),
        this.prisma.parentLearningGuidance.findMany({
          where: {
            tenantId: actor.tenantId,
            studentId,
            academicYearId,
            status: ParentLearningGuidanceStatus.PUBLISHED,
            OR: [{ visibleFrom: null }, { visibleFrom: { lte: now } }],
            AND: [{ OR: [{ visibleUntil: null }, { visibleUntil: { gte: now } }] }],
          },
          include: guidanceInclude,
          orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
          take: 20,
        }),
        this.prisma.remedialGroupMember.findMany({
          where: {
            tenantId: actor.tenantId,
            studentId,
            isActive: true,
            group: {
              academicYearId,
              status: RemedialGroupStatus.ACTIVE,
              parentSummary: { not: null },
            },
          },
          include: {
            group: {
              include: {
                subject: { select: SUBJECT_SELECT },
              },
            },
          },
          orderBy: { joinedAt: 'desc' },
          take: 20,
        }),
        this.prisma.studentInterventionCase.findMany({
          where: {
            tenantId: actor.tenantId,
            studentId,
            academicYearId,
            parentVisibleSummary: { not: null },
          },
          select: {
            id: true,
            status: true,
            title: true,
            parentVisibleSummary: true,
            nextFollowUpOn: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
          take: 20,
        }),
      ]);
    const outcomeProgress = buildOutcomeProgress(evidence);
    return {
      generatedAt: now.toISOString(),
      student: mapStudent(student),
      sourceStates: {
        outcomeProgress:
          outcomeProgress.length > 0 ? ('available' as const) : ('empty' as const),
        guidance:
          guidance.length > 0 ? ('available' as const) : ('empty' as const),
        remedialSupport:
          remedialMemberships.length > 0
            ? ('available' as const)
            : ('empty' as const),
        interventionUpdates:
          interventions.length > 0
            ? ('available' as const)
            : ('empty' as const),
      },
      outcomeProgress,
      guidance: guidance.map(mapGuidance),
      remedialSupport: remedialMemberships.map(({ group }) => ({
        id: group.id,
        name: group.name,
        subject: mapSubject(group.subject),
        startsOn: formatDate(group.startsOn),
        endsOn: group.endsOn ? formatDate(group.endsOn) : null,
        scheduleNote: group.scheduleNote,
        parentSummary: group.parentSummary,
      })),
      interventionUpdates: interventions.map((item) => ({
        caseId: item.id,
        status: item.status,
        title: item.title,
        summary: item.parentVisibleSummary!,
        nextFollowUpOn: item.nextFollowUpOn
          ? formatDate(item.nextFollowUpOn)
          : null,
        updatedAt: item.updatedAt.toISOString(),
      })),
    };
  }

  private async getOutcomeInScope(actor: AuthContext, outcomeId: string) {
    const outcome = await this.prisma.learningOutcome.findFirst({
      where: { id: outcomeId, tenantId: actor.tenantId },
      select: {
        id: true,
        academicYearId: true,
        classId: true,
        subjectId: true,
        domain: true,
      },
    });
    if (!outcome) {
      throw new NotFoundException('Learning outcome was not found');
    }
    await this.assertLearningScope(actor, outcome);
    return outcome;
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

  private async getInterventionInScope(actor: AuthContext, caseId: string) {
    const record = await this.prisma.studentInterventionCase.findFirst({
      where: { id: caseId, tenantId: actor.tenantId },
      include: interventionInclude,
    });
    if (!record) {
      throw new NotFoundException('Intervention case was not found');
    }
    await this.assertTeacherStudentAccess(
      actor,
      record.classId,
      record.sectionId,
    );
    return record;
  }

  private async getRemedialGroupInScope(actor: AuthContext, groupId: string) {
    const group = await this.prisma.remedialGroup.findFirst({
      where: { id: groupId, tenantId: actor.tenantId },
      include: remedialInclude,
    });
    if (!group) throw new NotFoundException('Remedial group was not found');
    await this.assertLearningScope(actor, {
      academicYearId: group.academicYearId,
      classId: group.classId,
      sectionId: group.sectionId ?? undefined,
      subjectId: group.subjectId,
      outcomeId: group.outcomeId ?? undefined,
    });
    return group;
  }

  private async getCurriculumItemInScope(actor: AuthContext, itemId: string) {
    const item = await this.prisma.curriculumProgressItem.findFirst({
      where: { id: itemId, tenantId: actor.tenantId },
      include: curriculumInclude,
    });
    if (!item) {
      throw new NotFoundException('Curriculum progress item was not found');
    }
    await this.assertLearningScope(actor, {
      academicYearId: item.academicYearId,
      classId: item.classId,
      sectionId: item.sectionId ?? undefined,
      subjectId: item.subjectId,
      outcomeId: item.outcomeId ?? undefined,
    });
    return item;
  }

  private async getGuidanceInScope(actor: AuthContext, guidanceId: string) {
    const guidance = await this.prisma.parentLearningGuidance.findFirst({
      where: { id: guidanceId, tenantId: actor.tenantId },
      include: guidanceInclude,
    });
    if (!guidance) {
      throw new NotFoundException('Parent learning guidance was not found');
    }
    await this.getStudentScope(
      actor,
      guidance.studentId,
      guidance.academicYearId,
    );
    await this.assertLearningScope(actor, {
      academicYearId: guidance.academicYearId,
      classId: guidance.student.classId,
      sectionId: guidance.student.sectionId ?? undefined,
      subjectId: guidance.subjectId,
      studentId: guidance.studentId,
      outcomeId: guidance.outcomeId ?? undefined,
    });
    return guidance;
  }

  private async getStudentScope(
    actor: AuthContext,
    studentId: string,
    academicYearId?: string,
  ) {
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        tenantId: actor.tenantId,
        lifecycleStatus: StudentLifecycleStatus.ACTIVE,
        ...(academicYearId
          ? {
              enrollments: {
                some: {
                  tenantId: actor.tenantId,
                  academicYearId,
                  status: EnrollmentStatus.ACTIVE,
                },
              },
            }
          : {}),
      },
      select: STUDENT_SELECT,
    });
    if (!student) {
      throw new NotFoundException(
        'Student was not found in the selected academic scope',
      );
    }
    await this.assertTeacherStudentAccess(
      actor,
      student.classId,
      student.sectionId,
    );
    return student;
  }

  private async assertLearningScope(
    actor: AuthContext,
    scope: {
      academicYearId: string;
      classId: string;
      sectionId?: string;
      subjectId: string;
      studentId?: string;
      outcomeId?: string;
    },
  ) {
    const [academicYear, classroom, section, subject, student, outcome] =
      await Promise.all([
        this.prisma.academicYear.findFirst({
          where: { id: scope.academicYearId, tenantId: actor.tenantId },
          select: { id: true },
        }),
        this.prisma.class.findFirst({
          where: { id: scope.classId, tenantId: actor.tenantId },
          select: { id: true, level: true },
        }),
        scope.sectionId
          ? this.prisma.section.findFirst({
              where: { id: scope.sectionId, tenantId: actor.tenantId },
              select: { id: true, classId: true },
            })
          : Promise.resolve(null),
        this.prisma.subject.findFirst({
          where: { id: scope.subjectId, tenantId: actor.tenantId },
          select: { id: true, classId: true },
        }),
        scope.studentId
          ? this.prisma.student.findFirst({
              where: {
                id: scope.studentId,
                tenantId: actor.tenantId,
                lifecycleStatus: StudentLifecycleStatus.ACTIVE,
                classId: scope.classId,
                ...(scope.sectionId ? { sectionId: scope.sectionId } : {}),
                enrollments: {
                  some: {
                    tenantId: actor.tenantId,
                    academicYearId: scope.academicYearId,
                    classId: scope.classId,
                    ...(scope.sectionId
                      ? { sectionId: scope.sectionId }
                      : {}),
                    status: EnrollmentStatus.ACTIVE,
                  },
                },
              },
              select: { id: true },
            })
          : Promise.resolve(null),
        scope.outcomeId
          ? this.prisma.learningOutcome.findFirst({
              where: {
                id: scope.outcomeId,
                tenantId: actor.tenantId,
                academicYearId: scope.academicYearId,
                classId: scope.classId,
                subjectId: scope.subjectId,
                isActive: true,
              },
              select: { id: true, domain: true },
            })
          : Promise.resolve(null),
      ]);
    if (!academicYear) throw new NotFoundException('Academic year was not found');
    if (!classroom) throw new NotFoundException('Class was not found');
    if (!subject || subject.classId !== scope.classId) {
      throw new ConflictException(
        'Subject must belong to the selected class and tenant',
      );
    }
    if (scope.sectionId && (!section || section.classId !== scope.classId)) {
      throw new ConflictException(
        'Section must belong to the selected class and tenant',
      );
    }
    if (scope.studentId && !student) {
      throw new NotFoundException(
        'Student was not found in the selected class and academic year',
      );
    }
    if (scope.outcomeId && !outcome) {
      throw new NotFoundException(
        'Learning outcome was not found in the selected academic scope',
      );
    }
    await this.assertTeacherLearningScope(actor, scope);
    return { academicYear, classroom, section, subject, student, outcome };
  }

  private async assertTeacherLearningScope(
    actor: AuthContext,
    scope: {
      academicYearId: string;
      classId: string;
      sectionId?: string;
      subjectId: string;
    },
  ) {
    if (!isTeacherOnly(actor)) return;
    const access = await this.getTeacherAccess(actor);
    const assignedSubject = access.assignments.some(
      (assignment) =>
        assignment.academicYearId === scope.academicYearId &&
        assignment.classId === scope.classId &&
        assignment.subjectId === scope.subjectId &&
        (assignment.sectionId === null ||
          assignment.sectionId === (scope.sectionId ?? null)),
    );
    const assignedClass =
      Boolean(scope.sectionId) &&
      access.classTeacherSections.some(
        (section) =>
          section.classId === scope.classId &&
          section.sectionId === scope.sectionId,
      );
    if (!assignedSubject && !assignedClass) {
      throw new ForbiddenException(
        'Learning-improvement access is limited to assigned classes and subjects',
      );
    }
  }

  private async assertTeacherStudentAccess(
    actor: AuthContext,
    classId: string,
    sectionId: string | null,
  ) {
    if (!isTeacherOnly(actor)) return;
    const access = await this.getTeacherAccess(actor);
    const allowed =
      access.assignments.some(
        (assignment) =>
          assignment.classId === classId &&
          (assignment.sectionId === null ||
            assignment.sectionId === sectionId),
      ) ||
      access.classTeacherSections.some(
        (section) =>
          section.classId === classId && section.sectionId === sectionId,
      );
    if (!allowed) {
      throw new ForbiddenException(
        'Student support access is limited to assigned classes',
      );
    }
  }

  private async getTeacherAccess(actor: AuthContext): Promise<TeacherAccess> {
    const staff = await this.getActorStaff(actor);
    const [assignments, classTeacherSections] = await Promise.all([
      this.prisma.subjectTeacherAssignment.findMany({
        where: { tenantId: actor.tenantId, staffId: staff.id },
        select: {
          academicYearId: true,
          classId: true,
          sectionId: true,
          subjectId: true,
        },
        take: 500,
      }),
      this.prisma.section.findMany({
        where: {
          tenantId: actor.tenantId,
          classTeacherId: staff.id,
        },
        select: { classId: true, id: true },
        take: 100,
      }),
    ]);
    return {
      staffId: staff.id,
      assignments,
      classTeacherSections: classTeacherSections.map((section) => ({
        classId: section.classId,
        sectionId: section.id,
      })),
    };
  }

  private async buildTeacherScopeFilter(
    actor: AuthContext,
    includeSubject: boolean,
    includeSection: boolean,
  ): Promise<Record<string, unknown> | 'NONE' | null> {
    if (!isTeacherOnly(actor)) return null;
    const access = await this.getTeacherAccess(actor);
    const scopes = [
      ...access.assignments.map((assignment) => ({
        classId: assignment.classId,
        ...(includeSubject ? { subjectId: assignment.subjectId } : {}),
        ...(includeSection && assignment.sectionId
          ? {
              OR: [
                { sectionId: assignment.sectionId },
                { sectionId: null },
              ],
            }
          : {}),
      })),
      ...access.classTeacherSections.map((section) => ({
        classId: section.classId,
        ...(includeSection
          ? { OR: [{ sectionId: section.sectionId }, { sectionId: null }] }
          : {}),
      })),
    ];
    return scopes.length > 0 ? { OR: scopes } : 'NONE';
  }

  private async buildTeacherStudentFilter(
    actor: AuthContext,
  ): Promise<Prisma.StudentWhereInput | 'NONE' | null> {
    if (!isTeacherOnly(actor)) return null;
    const access = await this.getTeacherAccess(actor);
    const scopes = [
      ...access.assignments.map((assignment) => ({
        classId: assignment.classId,
        ...(assignment.sectionId ? { sectionId: assignment.sectionId } : {}),
      })),
      ...access.classTeacherSections.map((section) => ({
        classId: section.classId,
        sectionId: section.sectionId,
      })),
    ];
    return scopes.length > 0 ? { OR: scopes } : 'NONE';
  }

  private async getActorStaff(actor: AuthContext) {
    const staff = await this.prisma.staff.findFirst({
      where: {
        tenantId: actor.tenantId,
        userId: actor.userId,
        status: StaffStatus.ACTIVE,
      },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!staff) {
      throw new ForbiddenException(
        'An active staff profile is required for this learning-improvement action',
      );
    }
    return staff;
  }

  private async assertStaffInTenant(tenantId: string, staffId: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId, status: StaffStatus.ACTIVE },
      select: { id: true },
    });
    if (!staff) {
      throw new NotFoundException('Assigned staff member was not found');
    }
  }

  private record(
    actor: AuthContext,
    action: string,
    resourceId: string,
    after: Record<string, unknown>,
  ) {
    return this.auditService.record({
      action,
      resource: 'learning_improvement',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId,
      after,
    });
  }
}

const formativeInclude = {
  outcome: { select: OUTCOME_SELECT },
  student: { select: STUDENT_SELECT },
  subject: { select: SUBJECT_SELECT },
  teacher: { select: TEACHER_SELECT },
} satisfies Prisma.FormativeAssessmentEvidenceInclude;

const interventionInclude = {
  student: { select: STUDENT_SELECT },
  owner: { select: TEACHER_SELECT },
  entries: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.StudentInterventionCaseInclude;

const remedialInclude = {
  subject: { select: SUBJECT_SELECT },
  outcome: { select: OUTCOME_SELECT },
  teacher: { select: TEACHER_SELECT },
  memberships: {
    where: { isActive: true },
    include: { student: { select: STUDENT_SELECT } },
    orderBy: { joinedAt: 'asc' as const },
  },
} satisfies Prisma.RemedialGroupInclude;

const curriculumInclude = {
  subject: { select: SUBJECT_SELECT },
  outcome: { select: OUTCOME_SELECT },
  teacher: { select: TEACHER_SELECT },
} satisfies Prisma.CurriculumProgressItemInclude;

const guidanceInclude = {
  student: { select: STUDENT_SELECT },
  subject: { select: SUBJECT_SELECT },
  outcome: { select: OUTCOME_SELECT },
  remedialGroup: {
    select: { id: true, name: true, scheduleNote: true },
  },
  teacher: { select: TEACHER_SELECT },
} satisfies Prisma.ParentLearningGuidanceInclude;

function mapStudent(student: {
  id: string;
  studentSystemId: string;
  firstNameEn: string;
  lastNameEn: string;
  classId: string;
  sectionId: string | null;
  class: { id: string; name: string; level: number };
  sectionRef: { id: string; name: string } | null;
}) {
  return {
    id: student.id,
    studentSystemId: student.studentSystemId,
    fullName: `${student.firstNameEn} ${student.lastNameEn}`.trim(),
    classId: student.classId,
    className: student.class.name,
    classLevel: student.class.level,
    sectionId: student.sectionId,
    sectionName: student.sectionRef?.name ?? null,
  };
}

function mapSubject(subject: { id: string; code: string; name: string }) {
  return { id: subject.id, code: subject.code, name: subject.name };
}

function mapTeacher(teacher: {
  id: string;
  firstName: string;
  lastName: string;
}) {
  return {
    id: teacher.id,
    fullName: `${teacher.firstName} ${teacher.lastName}`.trim(),
  };
}

function mapOutcome<
  T extends {
    id: string;
    academicYearId: string;
    classId: string;
    code: string;
    title: string;
    description: string | null;
    domain: LearningOutcomeDomain;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    subject: { id: string; code: string; name: string };
  },
>(outcome: T) {
  return {
    id: outcome.id,
    academicYearId: outcome.academicYearId,
    classId: outcome.classId,
    subject: mapSubject(outcome.subject),
    code: outcome.code,
    title: outcome.title,
    description: outcome.description,
    domain: outcome.domain,
    isActive: outcome.isActive,
    createdAt: outcome.createdAt.toISOString(),
    updatedAt: outcome.updatedAt.toISOString(),
  };
}

function mapFormativeEvidence(
  evidence: Prisma.FormativeAssessmentEvidenceGetPayload<{
    include: typeof formativeInclude;
  }>,
) {
  return {
    id: evidence.id,
    outcome: evidence.outcome,
    student: mapStudent(evidence.student),
    academicYearId: evidence.academicYearId,
    subject: mapSubject(evidence.subject),
    teacher: mapTeacher(evidence.teacher),
    kind: evidence.kind,
    masteryStatus: evidence.masteryStatus,
    score: evidence.score?.toString() ?? null,
    maxScore: evidence.maxScore?.toString() ?? null,
    assessedOn: formatDate(evidence.assessedOn),
    note: evidence.note,
    observationChecklist:
      evidence.observationChecklist &&
      typeof evidence.observationChecklist === 'object' &&
      !Array.isArray(evidence.observationChecklist)
        ? (evidence.observationChecklist as Record<string, boolean>)
        : null,
    parentSummary: evidence.parentSummary,
    reassessmentOfId: evidence.reassessmentOfId,
    createdAt: evidence.createdAt.toISOString(),
  };
}

function mapInterventionEntry(entry: {
  id: string;
  entryType: StudentInterventionEntryType;
  body: string;
  parentVisible: boolean;
  contactedAt: Date | null;
  nextFollowUpOn: Date | null;
  createdAt: Date;
}) {
  return {
    id: entry.id,
    entryType: entry.entryType,
    body: entry.body,
    parentVisible: entry.parentVisible,
    contactedAt: entry.contactedAt?.toISOString() ?? null,
    nextFollowUpOn: entry.nextFollowUpOn
      ? formatDate(entry.nextFollowUpOn)
      : null,
    createdAt: entry.createdAt.toISOString(),
  };
}

function mapIntervention(
  record: Prisma.StudentInterventionCaseGetPayload<{
    include: typeof interventionInclude;
  }>,
) {
  return {
    id: record.id,
    student: mapStudent(record.student),
    academicYearId: record.academicYearId,
    owner: record.owner ? mapTeacher(record.owner) : null,
    sourceSignalKey: record.sourceSignalKey,
    priority: record.priority,
    status: record.status,
    title: record.title,
    concernSummary: record.concernSummary,
    parentVisibleSummary: record.parentVisibleSummary,
    nextFollowUpOn: record.nextFollowUpOn
      ? formatDate(record.nextFollowUpOn)
      : null,
    escalatedAt: record.escalatedAt?.toISOString() ?? null,
    resolvedAt: record.resolvedAt?.toISOString() ?? null,
    resolutionSummary: record.resolutionSummary,
    version: record.version,
    entries: record.entries.map(mapInterventionEntry),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapRemedialGroup(
  group: Prisma.RemedialGroupGetPayload<{ include: typeof remedialInclude }>,
) {
  return {
    id: group.id,
    academicYearId: group.academicYearId,
    classId: group.classId,
    sectionId: group.sectionId,
    subject: mapSubject(group.subject),
    outcome: group.outcome
      ? {
          id: group.outcome.id,
          code: group.outcome.code,
          title: group.outcome.title,
        }
      : null,
    teacher: mapTeacher(group.teacher),
    name: group.name,
    purpose: group.purpose,
    status: group.status,
    startsOn: formatDate(group.startsOn),
    endsOn: group.endsOn ? formatDate(group.endsOn) : null,
    scheduleNote: group.scheduleNote,
    parentSummary: group.parentSummary,
    members: group.memberships.map((member) => ({
      student: mapStudent(member.student),
      joinedAt: member.joinedAt.toISOString(),
    })),
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
  };
}

function mapCurriculumProgress(
  item: Prisma.CurriculumProgressItemGetPayload<{
    include: typeof curriculumInclude;
  }>,
) {
  return {
    id: item.id,
    academicYearId: item.academicYearId,
    classId: item.classId,
    sectionId: item.sectionId,
    subject: mapSubject(item.subject),
    outcome: item.outcome
      ? {
          id: item.outcome.id,
          code: item.outcome.code,
          title: item.outcome.title,
        }
      : null,
    teacher: mapTeacher(item.teacher),
    title: item.title,
    status: item.status,
    plannedOn: formatDate(item.plannedOn),
    completedOn: item.completedOn ? formatDate(item.completedOn) : null,
    missedReason: item.missedReason,
    reteachPlan: item.reteachPlan,
    resourceUrl: item.resourceUrl,
    note: item.note,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function mapGuidance(
  guidance: Prisma.ParentLearningGuidanceGetPayload<{
    include: typeof guidanceInclude;
  }>,
) {
  return {
    id: guidance.id,
    studentId: guidance.studentId,
    student: mapStudent(guidance.student),
    academicYearId: guidance.academicYearId,
    subject: mapSubject(guidance.subject),
    outcome: guidance.outcome,
    remedialGroup: guidance.remedialGroup,
    teacher: mapTeacher(guidance.teacher),
    title: guidance.title,
    skillExplanation: guidance.skillExplanation,
    homeActivity: guidance.homeActivity,
    status: guidance.status,
    visibleFrom: guidance.visibleFrom?.toISOString() ?? null,
    visibleUntil: guidance.visibleUntil?.toISOString() ?? null,
    publishedAt: guidance.publishedAt?.toISOString() ?? null,
    createdAt: guidance.createdAt.toISOString(),
    updatedAt: guidance.updatedAt.toISOString(),
  };
}

function buildOutcomeProgress(
  evidence: Array<{
    outcome: {
      id: string;
      code: string;
      title: string;
      domain: LearningOutcomeDomain;
    };
    masteryStatus: LearningMasteryStatus;
    assessedOn: Date;
    parentSummary: string | null;
    createdAt: Date;
  }>,
) {
  const grouped = new Map<string, typeof evidence>();
  for (const item of evidence) {
    const list = grouped.get(item.outcome.id) ?? [];
    list.push(item);
    grouped.set(item.outcome.id, list);
  }
  return Array.from(grouped.values()).map((items) => {
    const latest = items[0]!;
    return {
      outcome: latest.outcome,
      latestMasteryStatus: latest.masteryStatus,
      latestAssessedOn: formatDate(latest.assessedOn),
      previousMasteryStatus: items[1]?.masteryStatus ?? null,
      assessmentCount: items.length,
      parentSummary: latest.parentSummary,
    };
  });
}

function buildEarlyWarningItem(input: {
  student: Parameters<typeof mapStudent>[0];
  generatedAt: Date;
  attendanceEnabled: boolean;
  homeworkEnabled: boolean;
  attendanceRows: Array<{
    studentId: string;
    status: AttendanceStatus;
    _count: { _all: number };
  }>;
  formativeRows: Array<{
    studentId: string;
    masteryStatus: LearningMasteryStatus;
    score: Prisma.Decimal | null;
    maxScore: Prisma.Decimal | null;
    assessedOn: Date;
  }>;
  homeworkRows: Array<{
    studentId: string;
    status: HomeworkSubmissionStatus;
    _count: { _all: number };
  }>;
  interventionRows: Array<{ id: string; studentId: string; createdAt: Date }>;
}) {
  const reasons: Array<{
    code:
      | 'ATTENDANCE_PATTERN'
      | 'FORMATIVE_SUPPORT'
      | 'HOMEWORK_FOLLOW_UP';
    label: string;
    explanation: string;
    observedValue: number;
    threshold: number;
  }> = [];
  const attendance = input.attendanceRows.filter(
    (row) => row.studentId === input.student.id,
  );
  const markedDays = attendance.reduce(
    (sum, row) => sum + row._count._all,
    0,
  );
  const absentDays = attendance
    .filter((row) => ABSENCE_STATUSES.includes(row.status))
    .reduce((sum, row) => sum + row._count._all, 0);
  const absencePercent =
    markedDays > 0 ? Math.round((absentDays / markedDays) * 100) : 0;
  if (absentDays >= 2 && absencePercent >= 20) {
    reasons.push({
      code: 'ATTENDANCE_PATTERN',
      label: 'Recent attendance needs follow-up',
      explanation: `${absentDays} of ${markedDays} marked days were recorded as absence or leave in the last 30 days.`,
      observedValue: absencePercent,
      threshold: 20,
    });
  }

  const formative = input.formativeRows.filter(
    (row) => row.studentId === input.student.id,
  );
  const beginningCount = formative.filter(
    (row) => row.masteryStatus === LearningMasteryStatus.BEGINNING,
  ).length;
  const scoredRatios = formative
    .filter((row) => row.score !== null && row.maxScore !== null)
    .map((row) => Number(row.score) / Number(row.maxScore));
  const averagePercent =
    scoredRatios.length > 0
      ? Math.round(
          (scoredRatios.reduce((sum, value) => sum + value, 0) /
            scoredRatios.length) *
            100,
        )
      : null;
  if (beginningCount >= 2) {
    reasons.push({
      code: 'FORMATIVE_SUPPORT',
      label: 'Recent learning evidence needs support',
      explanation: `${beginningCount} recent checks are at the beginning stage${averagePercent !== null ? `, with an average score of ${averagePercent}% across scored checks` : ''}.`,
      observedValue: beginningCount,
      threshold: 2,
    });
  }

  const homework = input.homeworkRows.filter(
    (row) => row.studentId === input.student.id,
  );
  const missedHomework = homework
    .filter((row) => MISSING_HOMEWORK_STATUSES.includes(row.status))
    .reduce((sum, row) => sum + row._count._all, 0);
  if (missedHomework >= 2) {
    reasons.push({
      code: 'HOMEWORK_FOLLOW_UP',
      label: 'Homework follow-up is due',
      explanation: `${missedHomework} submission-required homework items need follow-up from the last 60 days.`,
      observedValue: missedHomework,
      threshold: 2,
    });
  }

  return {
    signalKey: `stage3-v1:${input.student.id}:${input.generatedAt
      .toISOString()
      .slice(0, 10)}`,
    student: mapStudent(input.student),
    attentionLevel:
      reasons.length >= 2 ||
      absencePercent >= 40 ||
      beginningCount >= 3
        ? ('NEEDS_ATTENTION' as const)
        : ('WATCH' as const),
    reasons,
    sourceStates: {
      attendance: input.attendanceEnabled
        ? markedDays > 0
          ? ('available' as const)
          : ('empty' as const)
        : ('locked' as const),
      formativeAssessment:
        formative.length > 0 ? ('available' as const) : ('empty' as const),
      homework: input.homeworkEnabled
        ? homework.length > 0
          ? ('available' as const)
          : ('empty' as const)
        : ('locked' as const),
    },
    activeInterventionCaseId:
      input.interventionRows.find(
        (row) => row.studentId === input.student.id,
      )?.id ?? null,
    generatedAt: input.generatedAt.toISOString(),
  };
}

function assertInterventionTransition(
  from: StudentInterventionStatus,
  to: StudentInterventionStatus,
) {
  if (from === to) return;
  const allowed: Record<StudentInterventionStatus, StudentInterventionStatus[]> =
    {
      OPEN: [
        StudentInterventionStatus.IN_PROGRESS,
        StudentInterventionStatus.MONITORING,
        StudentInterventionStatus.RESOLVED,
      ],
      IN_PROGRESS: [
        StudentInterventionStatus.MONITORING,
        StudentInterventionStatus.RESOLVED,
      ],
      MONITORING: [
        StudentInterventionStatus.IN_PROGRESS,
        StudentInterventionStatus.RESOLVED,
      ],
      RESOLVED: [
        StudentInterventionStatus.IN_PROGRESS,
        StudentInterventionStatus.CLOSED,
      ],
      CLOSED: [],
    };
  if (!allowed[from].includes(to)) {
    throw new ConflictException(
      `Intervention cannot move from ${from} to ${to}`,
    );
  }
}

function assertRemedialTransition(
  from: RemedialGroupStatus,
  to: RemedialGroupStatus,
) {
  if (from === to) return;
  const allowed: Record<RemedialGroupStatus, RemedialGroupStatus[]> = {
    PLANNED: [RemedialGroupStatus.ACTIVE, RemedialGroupStatus.CANCELLED],
    ACTIVE: [RemedialGroupStatus.COMPLETED, RemedialGroupStatus.CANCELLED],
    COMPLETED: [],
    CANCELLED: [],
  };
  if (!allowed[from].includes(to)) {
    throw new ConflictException(
      `Remedial group cannot move from ${from} to ${to}`,
    );
  }
}

function assertGuidanceTransition(
  from: ParentLearningGuidanceStatus,
  to: ParentLearningGuidanceStatus,
) {
  if (from === to) return;
  const allowed: Record<
    ParentLearningGuidanceStatus,
    ParentLearningGuidanceStatus[]
  > = {
    DRAFT: [
      ParentLearningGuidanceStatus.PUBLISHED,
      ParentLearningGuidanceStatus.ARCHIVED,
    ],
    PUBLISHED: [ParentLearningGuidanceStatus.ARCHIVED],
    ARCHIVED: [],
  };
  if (!allowed[from].includes(to)) {
    throw new ConflictException(
      `Parent guidance cannot move from ${from} to ${to}`,
    );
  }
}

function validateCurriculumState(
  dto: CreateCurriculumProgressDto | UpdateCurriculumProgressDto,
) {
  if (
    dto.status === CurriculumProgressStatus.COMPLETED &&
    !dto.completedOn
  ) {
    throw new ConflictException(
      'Completed curriculum work requires a completion date',
    );
  }
  if (
    (dto.status === CurriculumProgressStatus.MISSED ||
      dto.status === CurriculumProgressStatus.RETEACH_REQUIRED) &&
    !dto.missedReason?.trim()
  ) {
    throw new ConflictException(
      'Missed or re-teach curriculum work requires a reason',
    );
  }
}

function buildCurriculumSummary(
  grouped: Array<{
    status: CurriculumProgressStatus;
    _count: { _all: number };
  }>,
) {
  const count = (status: CurriculumProgressStatus) =>
    grouped.find((row) => row.status === status)?._count._all ?? 0;
  const planned = count(CurriculumProgressStatus.PLANNED);
  const completed = count(CurriculumProgressStatus.COMPLETED);
  const missed = count(CurriculumProgressStatus.MISSED);
  const reteachRequired = count(CurriculumProgressStatus.RETEACH_REQUIRED);
  const totalItems = planned + completed + missed + reteachRequired;
  return {
    totalItems,
    planned,
    completed,
    missed,
    reteachRequired,
    completionPercent:
      totalItems > 0 ? Math.round((completed / totalItems) * 100) : null,
    paceState:
      totalItems === 0
        ? ('unavailable' as const)
        : missed > 0 || reteachRequired > 0
          ? ('attention_needed' as const)
          : ('on_track' as const),
  };
}

function emptyCurriculumSummary() {
  return {
    totalItems: 0,
    planned: 0,
    completed: 0,
    missed: 0,
    reteachRequired: 0,
    completionPercent: null,
    paceState: 'unavailable' as const,
  };
}

function pageOf(query: { page?: number; limit?: number }) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 25;
  return { page, limit, skip: (page - 1) * limit };
}

function emptyPage(page: number, limit: number) {
  return { items: [], total: 0, page, limit, totalPages: 0 };
}

function pageResult<T>(items: T[], total: number, page: number, limit: number) {
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

function cleanOptional(value: string | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function dateOnly(value: string) {
  const parsed = new Date(value);
  return new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
    ),
  );
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function requestFingerprint(value: unknown) {
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

function assertMatchingReplay(
  existingFingerprint: string | null,
  fingerprint: string,
) {
  if (existingFingerprint !== fingerprint) {
    throw new ConflictException(
      'This submission ID was already used for different content',
    );
  }
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}
