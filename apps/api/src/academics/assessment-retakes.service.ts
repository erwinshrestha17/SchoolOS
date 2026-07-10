import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AssessmentRetakeResultDecision,
  AssessmentRetakeStatus,
  AudienceType,
  ConsentType,
  MarkEntryStatus,
  NotificationChannel,
  Prisma,
} from '@prisma/client';
import { formatBsDateTime } from '@schoolos/core';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from '../communications/communications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ApplyAssessmentRetakeResultDto,
  ApproveAssessmentRetakeDto,
  CancelAssessmentRetakeDto,
  CompleteAssessmentRetakeDto,
  CreateAssessmentRetakeDto,
  ListAssessmentRetakesDto,
  RejectAssessmentRetakeDto,
  ScheduleAssessmentRetakeDto,
} from './dto/assessment-retake.dto';

const ACTIVE_RETAKE_STATUSES = [
  AssessmentRetakeStatus.REQUESTED,
  AssessmentRetakeStatus.APPROVED,
  AssessmentRetakeStatus.SCHEDULED,
  AssessmentRetakeStatus.COMPLETED,
];

const RETAKE_INCLUDE = {
  student: {
    select: {
      id: true,
      studentSystemId: true,
      firstNameEn: true,
      lastNameEn: true,
    },
  },
  class: { select: { id: true, name: true } },
  section: { select: { id: true, name: true } },
  subject: { select: { id: true, name: true, code: true } },
  examTerm: {
    select: {
      id: true,
      name: true,
      academicYearId: true,
      isLocked: true,
    },
  },
  assessmentComponent: {
    select: { id: true, name: true, maxMarks: true },
  },
  requestedBy: { select: { id: true, email: true, phone: true } },
  reviewedBy: { select: { id: true, email: true, phone: true } },
  scheduledBy: { select: { id: true, email: true, phone: true } },
  completedBy: { select: { id: true, email: true, phone: true } },
  appliedBy: { select: { id: true, email: true, phone: true } },
  cancelledBy: { select: { id: true, email: true, phone: true } },
} satisfies Prisma.AssessmentRetakeInclude;

@Injectable()
export class AssessmentRetakesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly communicationsService: CommunicationsService,
  ) {}

  async list(actor: AuthContext, query: ListAssessmentRetakesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const scope = await this.getReadScope(actor);
    const where: Prisma.AssessmentRetakeWhereInput = {
      tenantId: actor.tenantId,
      ...scope,
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.examTermId ? { examTermId: query.examTermId } : {}),
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.assessmentRetake.findMany({
        where,
        include: RETAKE_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.assessmentRetake.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(assessmentRetakeId: string, actor: AuthContext) {
    const scope = await this.getReadScope(actor);
    const retake = await this.prisma.assessmentRetake.findFirst({
      where: {
        id: assessmentRetakeId,
        tenantId: actor.tenantId,
        ...scope,
      },
      include: RETAKE_INCLUDE,
    });

    if (!retake) {
      throw new NotFoundException('Assessment retake not found');
    }

    return retake;
  }

  async create(dto: CreateAssessmentRetakeDto, actor: AuthContext) {
    const mark = await this.prisma.markEntry.findFirst({
      where: { id: dto.markEntryId, tenantId: actor.tenantId },
      include: {
        examTerm: true,
        assessmentComponent: true,
        subject: true,
        student: {
          include: {
            class: true,
            sectionRef: true,
          },
        },
      },
    });

    if (!mark) {
      throw new NotFoundException('Mark entry not found');
    }

    if (
      mark.status === MarkEntryStatus.DRAFT ||
      mark.status === MarkEntryStatus.RETEST
    ) {
      throw new ConflictException(
        'Retest or make-up requests require a finalized original mark',
      );
    }

    await this.assertTeacherAssignment(actor, {
      academicYearId: mark.examTerm.academicYearId,
      classId: mark.student.classId,
      sectionId: mark.student.sectionId,
      subjectId: mark.subjectId,
    });

    const active = await this.prisma.assessmentRetake.findFirst({
      where: {
        tenantId: actor.tenantId,
        markEntryId: mark.id,
        status: { in: ACTIVE_RETAKE_STATUSES },
      },
      select: { id: true },
    });

    if (active) {
      throw new ConflictException(
        'An active retest or make-up lifecycle already exists for this mark',
      );
    }

    const retake = await this.prisma.assessmentRetake.create({
      data: {
        tenantId: actor.tenantId,
        markEntryId: mark.id,
        examTermId: mark.examTermId,
        assessmentComponentId: mark.assessmentComponentId,
        subjectId: mark.subjectId,
        studentId: mark.studentId,
        classId: mark.student.classId,
        sectionId: mark.student.sectionId,
        type: dto.type,
        reason: dto.reason.trim(),
        originalMarks: mark.marksObtained,
        originalStatus: mark.status,
        requestedById: actor.userId,
      },
      include: RETAKE_INCLUDE,
    });

    await this.recordTransition(actor, retake.id, 'REQUESTED', {
      type: retake.type,
      markEntryId: mark.id,
      studentId: mark.studentId,
      reason: retake.reason,
    });

    return retake;
  }

  async approve(
    assessmentRetakeId: string,
    dto: ApproveAssessmentRetakeDto,
    actor: AuthContext,
  ) {
    const retake = await this.getMutableRetake(
      assessmentRetakeId,
      actor,
      AssessmentRetakeStatus.REQUESTED,
    );
    await this.assertLockedMarkCorrection(retake, actor);
    const now = new Date();

    const [updated] = await this.prisma.$transaction([
      this.prisma.assessmentRetake.update({
        where: { id: retake.id },
        data: {
          status: AssessmentRetakeStatus.APPROVED,
          reviewedById: actor.userId,
          reviewedAt: now,
          reviewNote: dto.reviewNote?.trim() || null,
        },
        include: RETAKE_INCLUDE,
      }),
      this.prisma.markEntry.update({
        where: { id: retake.markEntryId },
        data: {
          status: MarkEntryStatus.RETEST,
          enteredById: actor.userId,
        },
      }),
    ]);

    await this.recordTransition(actor, retake.id, 'APPROVED', {
      reviewNote: dto.reviewNote?.trim() || null,
    });

    return updated;
  }

  async reject(
    assessmentRetakeId: string,
    dto: RejectAssessmentRetakeDto,
    actor: AuthContext,
  ) {
    const retake = await this.getMutableRetake(
      assessmentRetakeId,
      actor,
      AssessmentRetakeStatus.REQUESTED,
    );
    const now = new Date();
    const updated = await this.prisma.assessmentRetake.update({
      where: { id: retake.id },
      data: {
        status: AssessmentRetakeStatus.REJECTED,
        reviewedById: actor.userId,
        reviewedAt: now,
        reviewNote: dto.reviewNote.trim(),
      },
      include: RETAKE_INCLUDE,
    });

    await this.recordTransition(actor, retake.id, 'REJECTED', {
      reviewNote: dto.reviewNote.trim(),
    });

    return updated;
  }

  async schedule(
    assessmentRetakeId: string,
    dto: ScheduleAssessmentRetakeDto,
    actor: AuthContext,
  ) {
    const retake = await this.getMutableRetake(assessmentRetakeId, actor, [
      AssessmentRetakeStatus.APPROVED,
      AssessmentRetakeStatus.SCHEDULED,
    ]);
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) {
      throw new ConflictException('Retake end time must be after its start');
    }

    const updated = await this.prisma.assessmentRetake.update({
      where: { id: retake.id },
      data: {
        status: AssessmentRetakeStatus.SCHEDULED,
        scheduledStartsAt: startsAt,
        scheduledEndsAt: endsAt,
        room: dto.room?.trim() || null,
        scheduledById: actor.userId,
        scheduledAt: new Date(),
      },
      include: RETAKE_INCLUDE,
    });

    await this.recordTransition(actor, retake.id, 'SCHEDULED', {
      startsAt,
      endsAt,
      room: updated.room,
    });
    await this.communicationsService.recordDeliveryRecords({
      actor,
      sourceType: 'assessment_retake_scheduled',
      sourceId: retake.id,
      audienceType: AudienceType.STUDENT,
      studentIds: [retake.studentId],
      title: `${this.displayType(retake.type)} scheduled`,
      body: `${retake.subject.name} ${this.displayType(retake.type).toLowerCase()} is scheduled for ${formatBsDateTime(startsAt)}.`,
      channels: [NotificationChannel.PUSH],
      requiredConsentTypes: [ConsentType.MESSAGING],
    });

    return updated;
  }

  async complete(
    assessmentRetakeId: string,
    dto: CompleteAssessmentRetakeDto,
    actor: AuthContext,
  ) {
    const retake = await this.getMutableRetake(
      assessmentRetakeId,
      actor,
      AssessmentRetakeStatus.SCHEDULED,
    );
    const maxMarks = Number(retake.assessmentComponent.maxMarks);
    if (dto.marksObtained > maxMarks) {
      throw new ConflictException(
        `Retake marks must be between 0 and ${maxMarks}`,
      );
    }

    const updated = await this.prisma.assessmentRetake.update({
      where: { id: retake.id },
      data: {
        status: AssessmentRetakeStatus.COMPLETED,
        attemptMarks: new Prisma.Decimal(dto.marksObtained),
        attemptRemarks: dto.remarks?.trim() || null,
        completedById: actor.userId,
        completedAt: new Date(),
      },
      include: RETAKE_INCLUDE,
    });

    await this.recordTransition(actor, retake.id, 'COMPLETED', {
      attemptMarks: dto.marksObtained,
    });

    return updated;
  }

  async applyResult(
    assessmentRetakeId: string,
    dto: ApplyAssessmentRetakeResultDto,
    actor: AuthContext,
  ) {
    const retake = await this.getMutableRetake(
      assessmentRetakeId,
      actor,
      AssessmentRetakeStatus.COMPLETED,
    );
    await this.assertLockedMarkCorrection(retake, actor);
    if (retake.attemptMarks === null) {
      throw new ConflictException('Completed retake has no recorded marks');
    }

    const useRetake =
      dto.decision === AssessmentRetakeResultDecision.USE_RETAKE;
    const nextMarks = useRetake ? retake.attemptMarks : retake.originalMarks;
    const nextStatus = useRetake
      ? MarkEntryStatus.SUBMITTED
      : retake.originalStatus;
    const now = new Date();

    const [updated] = await this.prisma.$transaction([
      this.prisma.assessmentRetake.update({
        where: { id: retake.id },
        data: {
          status: AssessmentRetakeStatus.APPLIED,
          resultDecision: dto.decision,
          resultDecisionReason: dto.reason.trim(),
          appliedById: actor.userId,
          appliedAt: now,
        },
        include: RETAKE_INCLUDE,
      }),
      this.prisma.markEntry.update({
        where: { id: retake.markEntryId },
        data: {
          marksObtained: nextMarks,
          status: nextStatus,
          enteredById: actor.userId,
        },
      }),
    ]);

    await this.recordTransition(actor, retake.id, 'APPLIED', {
      decision: dto.decision,
      reason: dto.reason.trim(),
      marksObtained: Number(nextMarks),
    });
    await this.communicationsService.recordDeliveryRecords({
      actor,
      sourceType: 'assessment_retake_applied',
      sourceId: retake.id,
      audienceType: AudienceType.STUDENT,
      studentIds: [retake.studentId],
      title: `${this.displayType(retake.type)} result finalized`,
      body: `${retake.subject.name} ${this.displayType(retake.type).toLowerCase()} result has been finalized by the school.`,
      channels: [NotificationChannel.PUSH],
      requiredConsentTypes: [ConsentType.MESSAGING],
    });

    return updated;
  }

  async cancel(
    assessmentRetakeId: string,
    dto: CancelAssessmentRetakeDto,
    actor: AuthContext,
  ) {
    const retake = await this.getMutableRetake(assessmentRetakeId, actor, [
      AssessmentRetakeStatus.REQUESTED,
      AssessmentRetakeStatus.APPROVED,
      AssessmentRetakeStatus.SCHEDULED,
    ]);
    const shouldRestoreMark =
      retake.status === AssessmentRetakeStatus.APPROVED ||
      retake.status === AssessmentRetakeStatus.SCHEDULED;
    if (shouldRestoreMark) {
      await this.assertLockedMarkCorrection(retake, actor);
    }
    const now = new Date();
    const updateRetake = this.prisma.assessmentRetake.update({
      where: { id: retake.id },
      data: {
        status: AssessmentRetakeStatus.CANCELLED,
        cancellationReason: dto.reason.trim(),
        cancelledById: actor.userId,
        cancelledAt: now,
      },
      include: RETAKE_INCLUDE,
    });

    const updated = shouldRestoreMark
      ? (
          await this.prisma.$transaction([
            updateRetake,
            this.prisma.markEntry.update({
              where: { id: retake.markEntryId },
              data: {
                marksObtained: retake.originalMarks,
                status: retake.originalStatus,
                enteredById: actor.userId,
              },
            }),
          ])
        )[0]
      : await updateRetake;

    await this.recordTransition(actor, retake.id, 'CANCELLED', {
      reason: dto.reason.trim(),
    });

    return updated;
  }

  private async getMutableRetake(
    assessmentRetakeId: string,
    actor: AuthContext,
    allowed: AssessmentRetakeStatus | readonly AssessmentRetakeStatus[],
  ) {
    const retake = await this.prisma.assessmentRetake.findFirst({
      where: { id: assessmentRetakeId, tenantId: actor.tenantId },
      include: RETAKE_INCLUDE,
    });
    if (!retake) {
      throw new NotFoundException('Assessment retake not found');
    }

    const allowedStatuses = Array.isArray(allowed) ? allowed : [allowed];
    if (!allowedStatuses.includes(retake.status)) {
      throw new ConflictException(
        `Assessment retake cannot transition from ${retake.status}`,
      );
    }

    return retake;
  }

  private async assertLockedMarkCorrection(
    retake: {
      markEntryId: string;
      examTermId: string;
      studentId: string;
    },
    actor: AuthContext,
  ) {
    const mark = await this.prisma.markEntry.findFirst({
      where: {
        id: retake.markEntryId,
        tenantId: actor.tenantId,
      },
      include: { examTerm: { select: { isLocked: true } } },
    });
    if (!mark) {
      throw new NotFoundException('Original mark entry not found');
    }
    if (!mark.isLocked && !mark.examTerm.isLocked) {
      return;
    }

    const approvedCorrection =
      await this.prisma.reportCardCorrectionRequest.findFirst({
        where: {
          tenantId: actor.tenantId,
          status: 'APPROVED',
          reportCard: {
            examTermId: retake.examTermId,
            studentId: retake.studentId,
          },
        },
        select: { id: true },
      });
    if (!approvedCorrection) {
      throw new ConflictException(
        'Locked marks require an approved report-card correction before this retake transition',
      );
    }
  }

  private async assertTeacherAssignment(
    actor: AuthContext,
    scope: {
      academicYearId: string;
      classId: string;
      sectionId: string | null;
      subjectId: string;
    },
  ) {
    if (this.isPrivilegedActor(actor)) {
      return;
    }

    const staff = await this.prisma.staff.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
      select: { id: true },
    });
    if (!staff) {
      throw new ForbiddenException('Staff record not found in this tenant');
    }

    const assignment = await this.prisma.subjectTeacherAssignment.findFirst({
      where: {
        tenantId: actor.tenantId,
        staffId: staff.id,
        academicYearId: scope.academicYearId,
        classId: scope.classId,
        subjectId: scope.subjectId,
        OR: [{ sectionId: null }, { sectionId: scope.sectionId }],
      },
      select: { id: true },
    });
    if (!assignment) {
      throw new ForbiddenException(
        'Assessment retake access is limited to assigned subjects and classes',
      );
    }
  }

  private async getReadScope(
    actor: AuthContext,
  ): Promise<Prisma.AssessmentRetakeWhereInput> {
    if (this.isPrivilegedActor(actor)) {
      return {};
    }

    const staff = await this.prisma.staff.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
      select: { id: true },
    });
    if (!staff) {
      return { id: { in: [] } };
    }

    const assignments = await this.prisma.subjectTeacherAssignment.findMany({
      where: { tenantId: actor.tenantId, staffId: staff.id },
      select: {
        academicYearId: true,
        classId: true,
        sectionId: true,
        subjectId: true,
      },
      take: 500,
    });
    if (assignments.length === 0) {
      return { id: { in: [] } };
    }

    return {
      OR: assignments.map((assignment) => ({
        examTerm: { academicYearId: assignment.academicYearId },
        classId: assignment.classId,
        subjectId: assignment.subjectId,
        ...(assignment.sectionId ? { sectionId: assignment.sectionId } : {}),
      })),
    };
  }

  private isPrivilegedActor(actor: AuthContext) {
    return [
      'academics:manage',
      'academics:update',
      'academics:manage_report_cards',
      'marks:manage',
    ].some((permission) => actor.permissions.includes(permission));
  }

  private recordTransition(
    actor: AuthContext,
    resourceId: string,
    transition: string,
    after: Record<string, unknown>,
  ) {
    return this.auditService.record({
      action: `ACADEMICS_ASSESSMENT_RETAKE_${transition}`,
      resource: 'assessment_retake',
      resourceId,
      tenantId: actor.tenantId,
      userId: actor.userId,
      after,
    });
  }

  private displayType(type: string) {
    return type === 'MAKE_UP' ? 'Make-up assessment' : 'Retest';
  }
}
