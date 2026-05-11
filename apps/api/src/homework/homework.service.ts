import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AudienceType,
  ConsentType,
  HomeworkAssignmentStatus,
  HomeworkSubmissionStatus,
  NotificationChannel,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from '../communications/communications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHomeworkDto } from './dto/create-homework.dto';
import { HomeworkQueryDto } from './dto/homework-query.dto';
import {
  CreateHomeworkSubmissionDto,
  RequestCorrectionDto,
  ReviewHomeworkSubmissionDto,
  UpdateHomeworkSubmissionDto,
  UpdateHomeworkSubmissionStatusDto,
} from './dto/submission.dto';
import { UpdateHomeworkDto } from './dto/update-homework.dto';
import {
  LegacyReviewHomeworkSubmissionDto,
  LegacySubmitHomeworkDto,
} from './dto/legacy-submit-homework.dto';

const EDIT_BLOCKED_ASSIGNMENT_STATUSES: readonly HomeworkAssignmentStatus[] = [
  HomeworkAssignmentStatus.CLOSED,
  HomeworkAssignmentStatus.CANCELLED,
] as const;

const COMPLETED_SUBMISSION_STATUSES: readonly HomeworkSubmissionStatus[] = [
  HomeworkSubmissionStatus.SUBMITTED,
  HomeworkSubmissionStatus.LATE,
  HomeworkSubmissionStatus.REVIEWED,
  HomeworkSubmissionStatus.NEEDS_CORRECTION,
  HomeworkSubmissionStatus.EXCUSED,
] as const;

@Injectable()
export class HomeworkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly communicationsService: CommunicationsService,
    private readonly auditService: AuditService,
  ) {}

  async listAssignments(actor: AuthContext, query: HomeworkQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 100);
    const studentId = await this.resolveVisibleStudentId(
      actor,
      query.studentId,
    );

    return this.prisma.homeworkAssignment.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(query.academicYearId
          ? { academicYearId: query.academicYearId }
          : {}),
        ...(query.classId ? { classId: query.classId } : {}),
        ...(query.sectionId ? { sectionId: query.sectionId } : {}),
        ...(query.subjectId ? { subjectId: query.subjectId } : {}),
        ...(query.teacherId ? { assignedByStaffId: query.teacherId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(studentId ? { submissions: { some: { studentId } } } : {}),
      },
      include: homeworkAssignmentInclude(),
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async getAssignment(actor: AuthContext, homeworkId: string) {
    const assignment = await this.findAssignmentOrThrow(actor, homeworkId);
    await this.ensureHomeworkVisibility(actor, assignment.id);
    return assignment;
  }

  async createAssignment(dto: CreateHomeworkDto, actor: AuthContext) {
    const assignedDate =
      parseDate(dto.assignedDate, 'assignedDate') ?? new Date();
    const dueDate = parseRequiredDate(dto.dueDate, 'dueDate');
    if (dueDate < assignedDate) {
      throw new ConflictException('dueDate cannot be before assignedDate');
    }

    const assignedByStaffId =
      dto.teacherId ??
      dto.assignedByStaffId ??
      (await this.resolveActorStaffId(actor));
    await this.ensureHomeworkRefs(actor, {
      academicYearId: dto.academicYearId,
      classId: dto.classId,
      sectionId: dto.sectionId,
      subjectId: dto.subjectId,
      staffId: assignedByStaffId,
    });
    await this.ensureSubjectTeacherScope(
      actor,
      dto.subjectId,
      assignedByStaffId,
    );

    const assignment = await this.prisma.homeworkAssignment.create({
      data: {
        tenantId: actor.tenantId,
        academicYearId: dto.academicYearId,
        classId: dto.classId,
        sectionId: dto.sectionId ?? null,
        subjectId: dto.subjectId,
        assignedByStaffId,
        title: dto.title,
        instructions: dto.instructions,
        assignedDate,
        dueDate,
        dueAt: dueDate,
        status: dto.status ?? HomeworkAssignmentStatus.DRAFT,
        attachmentMetadata: dto.attachmentMetadata as
          | Prisma.InputJsonValue
          | undefined,
        maxScore:
          dto.maxScore === undefined ? null : new Prisma.Decimal(dto.maxScore),
      },
      include: homeworkAssignmentInclude(),
    });

    await this.auditService.record({
      action: 'create',
      resource: 'homework_assignment',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: assignment.id,
      after: {
        academicYearId: assignment.academicYearId,
        classId: assignment.classId,
        sectionId: assignment.sectionId,
        subjectId: assignment.subjectId,
        status: assignment.status,
      },
    });

    if (assignment.status === HomeworkAssignmentStatus.ASSIGNED) {
      await this.ensureAssignmentSubmissions(assignment.id, actor);
      await this.notifyHomeworkAssigned(assignment.id, actor);
    }

    return this.findAssignmentOrThrow(actor, assignment.id);
  }

  async updateAssignment(
    homeworkId: string,
    dto: UpdateHomeworkDto,
    actor: AuthContext,
  ) {
    const assignment = await this.findAssignmentOrThrow(actor, homeworkId);
    if (EDIT_BLOCKED_ASSIGNMENT_STATUSES.includes(assignment.status)) {
      throw new ConflictException(
        'Closed or cancelled homework cannot be edited',
      );
    }

    const assignedDate =
      parseDate(dto.assignedDate, 'assignedDate') ?? assignment.assignedDate;
    const dueDate = parseDate(dto.dueDate, 'dueDate') ?? assignment.dueDate;
    if (dueDate < assignedDate) {
      throw new ConflictException('dueDate cannot be before assignedDate');
    }

    const staffId =
      dto.teacherId ?? dto.assignedByStaffId ?? assignment.assignedByStaffId;
    await this.ensureHomeworkRefs(actor, {
      academicYearId: assignment.academicYearId,
      classId: assignment.classId,
      sectionId: assignment.sectionId,
      subjectId: dto.subjectId ?? assignment.subjectId,
      staffId,
    });
    await this.ensureSubjectTeacherScope(
      actor,
      dto.subjectId ?? assignment.subjectId,
      staffId,
    );

    const updateData: Prisma.HomeworkAssignmentUncheckedUpdateInput = {
      subjectId: dto.subjectId ?? assignment.subjectId,
      assignedByStaffId: staffId,
      title: dto.title ?? assignment.title,
      instructions: dto.instructions ?? assignment.instructions,
      assignedDate,
      dueDate,
      dueAt: dueDate,
      maxScore:
        dto.maxScore === undefined
          ? assignment.maxScore
          : new Prisma.Decimal(dto.maxScore),
    };
    if (dto.attachmentMetadata !== undefined) {
      updateData.attachmentMetadata =
        dto.attachmentMetadata as Prisma.InputJsonValue;
    }

    const updated = await this.prisma.homeworkAssignment.update({
      where: { id: assignment.id },
      data: updateData,
      include: homeworkAssignmentInclude(),
    });

    await this.auditService.record({
      action: 'update',
      resource: 'homework_assignment',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      before: {
        title: assignment.title,
        dueDate: assignment.dueDate,
        status: assignment.status,
      },
      after: {
        title: updated.title,
        dueDate: updated.dueDate,
        status: updated.status,
      },
    });

    return updated;
  }

  async assignHomework(homeworkId: string, actor: AuthContext) {
    const assignment = await this.findAssignmentOrThrow(actor, homeworkId);
    if (assignment.status !== HomeworkAssignmentStatus.DRAFT) {
      throw new ConflictException('Only draft homework can be assigned');
    }

    await this.ensureAssignmentSubmissions(assignment.id, actor);
    const updated = await this.prisma.homeworkAssignment.update({
      where: { id: assignment.id },
      data: {
        status: HomeworkAssignmentStatus.ASSIGNED,
        assignedDate: new Date(),
      },
      include: homeworkAssignmentInclude(),
    });
    await this.notifyHomeworkAssigned(updated.id, actor);

    await this.auditService.record({
      action: 'assign',
      resource: 'homework_assignment',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      before: { status: assignment.status },
      after: { status: updated.status },
    });

    return updated;
  }

  async closeHomework(homeworkId: string, actor: AuthContext) {
    return this.setAssignmentStatus(
      homeworkId,
      HomeworkAssignmentStatus.CLOSED,
      'close',
      actor,
    );
  }

  async cancelHomework(homeworkId: string, actor: AuthContext) {
    return this.setAssignmentStatus(
      homeworkId,
      HomeworkAssignmentStatus.CANCELLED,
      'cancel',
      actor,
    );
  }

  async deleteOrCancelHomework(homeworkId: string, actor: AuthContext) {
    const assignment = await this.findAssignmentOrThrow(actor, homeworkId);
    const submittedCount = assignment.submissions.filter((submission) =>
      COMPLETED_SUBMISSION_STATUSES.includes(submission.status),
    ).length;

    if (submittedCount > 0) {
      return this.cancelHomework(homeworkId, actor);
    }

    await this.prisma.homeworkAssignment.delete({
      where: { id: assignment.id },
    });

    await this.auditService.record({
      action: 'delete',
      resource: 'homework_assignment',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: assignment.id,
      before: {
        status: assignment.status,
        submissionCount: assignment.submissions.length,
      },
    });

    return { deleted: true, id: assignment.id };
  }

  async previewReminders(homeworkId: string, actor: AuthContext) {
    const assignment = await this.findAssignmentOrThrow(actor, homeworkId);
    if (assignment.status !== HomeworkAssignmentStatus.ASSIGNED) {
      throw new ConflictException('Only assigned homework can send reminders');
    }

    const pending = this.pendingReminderSubmissions(assignment);
    const now = new Date();
    const dueSoonCount = assignment.dueDate >= now ? pending.length : 0;
    const overdueCount = assignment.dueDate < now ? pending.length : 0;

    return {
      homeworkId,
      title: assignment.title,
      dueDate: assignment.dueDate,
      targetCount: pending.length,
      dueSoonCount,
      overdueCount,
      students: pending.map((submission) => ({
        submissionId: submission.id,
        studentId: submission.studentId,
        status: submission.status,
        studentName:
          `${submission.student.firstNameEn} ${submission.student.lastNameEn}`.trim(),
      })),
    };
  }

  async sendReminders(homeworkId: string, actor: AuthContext) {
    const assignment = await this.findAssignmentOrThrow(actor, homeworkId);
    const preview = await this.previewReminders(homeworkId, actor);

    const batch = await this.prisma.homeworkReminderBatch.create({
      data: {
        tenantId: actor.tenantId,
        homeworkId,
        createdById: actor.userId,
        targetCount: preview.targetCount,
        dueSoonCount: preview.dueSoonCount,
        overdueCount: preview.overdueCount,
      },
    });

    const delivery =
      preview.targetCount === 0
        ? { count: 0, skippedCount: 0 }
        : await this.communicationsService.recordDeliveryRecords({
            actor,
            sourceType: 'homework_reminder',
            sourceId: batch.id,
            audienceType: assignment.sectionId
              ? AudienceType.SECTION
              : AudienceType.CLASS,
            classId: assignment.classId,
            sectionId: assignment.sectionId,
            studentIds: preview.students.map((student) => student.studentId),
            title:
              preview.overdueCount > 0
                ? 'Homework overdue'
                : 'Homework reminder',
            body: `${assignment.title} is due ${assignment.dueDate.toLocaleDateString('en-NP')}. Please complete it in SchoolOS.`,
            channels: [NotificationChannel.PUSH],
            requiredConsentTypes: [ConsentType.MESSAGING],
          });

    const updatedBatch = await this.prisma.homeworkReminderBatch.update({
      where: { id: batch.id },
      data: {
        deliveryCount: delivery.count,
        skippedCount: delivery.skippedCount ?? 0,
      },
    });

    await this.auditService.record({
      action: 'reminder',
      resource: 'homework_assignment',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: homeworkId,
      after: {
        batchId: batch.id,
        targetCount: preview.targetCount,
        deliveryCount: delivery.count,
      },
    });

    return { batch: updatedBatch, preview, delivery };
  }

  async listSubmissions(actor: AuthContext, homeworkId?: string) {
    const studentId = await this.resolveVisibleStudentId(actor);
    return this.prisma.homeworkSubmission.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(homeworkId ? { homeworkId } : {}),
        ...(studentId ? { studentId } : {}),
      },
      include: homeworkSubmissionInclude(),
      orderBy: [{ updatedAt: 'desc' }],
      take: 100,
    });
  }

  async createSubmission(
    homeworkId: string,
    dto: CreateHomeworkSubmissionDto,
    actor: AuthContext,
  ) {
    const assignment = await this.findAssignmentOrThrow(actor, homeworkId);
    if (
      assignment.status === HomeworkAssignmentStatus.CLOSED ||
      assignment.status === HomeworkAssignmentStatus.CANCELLED
    ) {
      throw new ConflictException(
        'Cannot submit to closed or cancelled homework',
      );
    }
    await this.ensureStudentInAssignmentScope(actor, dto.studentId, assignment);

    const submittedAt = parseDate(dto.submittedAt, 'submittedAt') ?? new Date();
    const status =
      submittedAt > assignment.dueDate
        ? HomeworkSubmissionStatus.LATE
        : HomeworkSubmissionStatus.SUBMITTED;

    const submission = await this.prisma.$transaction(async (tx) => {
      const created = await tx.homeworkSubmission.upsert({
        where: {
          tenantId_homeworkId_studentId: {
            tenantId: actor.tenantId,
            homeworkId,
            studentId: dto.studentId,
          },
        },
        create: {
          tenantId: actor.tenantId,
          homeworkId,
          studentId: dto.studentId,
          status,
          submittedAt,
          submissionText: dto.submissionText ?? null,
          submissionContent: dto.submissionText ?? null,
          attachmentMetadata: dto.attachmentMetadata as
            | Prisma.InputJsonValue
            | undefined,
        },
        update: {
          status,
          submittedAt,
          submissionText: dto.submissionText ?? null,
          submissionContent: dto.submissionText ?? null,
          attachmentMetadata: dto.attachmentMetadata as
            | Prisma.InputJsonValue
            | undefined,
        },
      });

      if (dto.attachmentIds?.length) {
        await tx.homeworkAttachment.createMany({
          data: dto.attachmentIds.map((fileAssetId) => ({
            tenantId: actor.tenantId,
            submissionId: created.id,
            fileAssetId,
          })),
          skipDuplicates: true,
        });
      }

      return created;
    });

    await this.auditSubmission('create', submission.id, actor, {
      homeworkId,
      studentId: dto.studentId,
      status,
    });

    return this.findSubmissionOrThrow(actor, submission.id);
  }

  async legacySubmit(dto: LegacySubmitHomeworkDto, actor: AuthContext) {
    const submission = await this.findSubmissionOrThrow(
      actor,
      dto.submissionId,
    );
    const studentId = await this.resolveVisibleStudentId(
      actor,
      submission.studentId,
    );
    if (!studentId || studentId !== submission.studentId) {
      throw new ForbiddenException('Student profile not found');
    }

    return this.createSubmission(
      submission.homeworkId,
      {
        studentId,
        submissionText: dto.content,
        attachmentIds: dto.attachmentIds,
      },
      actor,
    );
  }

  async updateSubmission(
    submissionId: string,
    dto: UpdateHomeworkSubmissionDto,
    actor: AuthContext,
  ) {
    const submission = await this.findSubmissionOrThrow(actor, submissionId);
    const updateData: Prisma.HomeworkSubmissionUncheckedUpdateInput = {
      submissionText: dto.submissionText ?? submission.submissionText,
      submissionContent: dto.submissionText ?? submission.submissionContent,
    };
    if (dto.attachmentMetadata !== undefined) {
      updateData.attachmentMetadata =
        dto.attachmentMetadata as Prisma.InputJsonValue;
    }

    const updated = await this.prisma.homeworkSubmission.update({
      where: { id: submission.id },
      data: updateData,
      include: homeworkSubmissionInclude(),
    });

    await this.auditSubmission('update', updated.id, actor, {
      homeworkId: updated.homeworkId,
      status: updated.status,
    });

    return updated;
  }

  async updateSubmissionStatus(
    submissionId: string,
    dto: UpdateHomeworkSubmissionStatusDto,
    actor: AuthContext,
  ) {
    const submission = await this.findSubmissionOrThrow(actor, submissionId);
    const updated = await this.prisma.homeworkSubmission.update({
      where: { id: submission.id },
      data: {
        status: dto.status,
        submittedAt:
          dto.status === HomeworkSubmissionStatus.SUBMITTED ||
          dto.status === HomeworkSubmissionStatus.LATE
            ? (submission.submittedAt ?? new Date())
            : submission.submittedAt,
      },
      include: homeworkSubmissionInclude(),
    });

    await this.auditSubmission('status', updated.id, actor, {
      before: submission.status,
      after: updated.status,
    });

    return updated;
  }

  async reviewSubmission(
    submissionId: string,
    dto: ReviewHomeworkSubmissionDto,
    actor: AuthContext,
  ) {
    const submission = await this.findSubmissionOrThrow(actor, submissionId);
    await this.ensureSubjectTeacherScope(
      actor,
      submission.homework.subjectId,
      await this.resolveActorStaffId(actor),
    );

    const updated = await this.prisma.homeworkSubmission.update({
      where: { id: submission.id },
      data: {
        status: HomeworkSubmissionStatus.REVIEWED,
        score:
          dto.score === undefined
            ? submission.score
            : new Prisma.Decimal(dto.score),
        teacherRemarks: dto.teacherRemarks ?? submission.teacherRemarks,
        correctionRemarks:
          dto.correctionRemarks ?? submission.correctionRemarks,
        feedback: dto.teacherRemarks ?? submission.feedback,
        reviewedById: actor.userId,
        reviewedAt: new Date(),
      },
      include: homeworkSubmissionInclude(),
    });

    await this.notifySubmissionStudent(
      updated,
      actor,
      'homework_reviewed',
      'Homework reviewed',
      `Your homework "${updated.homework.title}" has been reviewed.`,
    );
    await this.auditSubmission('review', updated.id, actor, {
      homeworkId: updated.homeworkId,
      score: dto.score ?? null,
      status: updated.status,
    });

    return updated;
  }

  async legacyReview(
    dto: LegacyReviewHomeworkSubmissionDto,
    actor: AuthContext,
  ) {
    if (dto.status === HomeworkSubmissionStatus.NEEDS_CORRECTION) {
      return this.requestCorrection(
        dto.submissionId,
        {
          correctionRemarks:
            dto.feedback ?? 'Please review the teacher remarks and resubmit.',
        },
        actor,
      );
    }

    return this.reviewSubmission(
      dto.submissionId,
      {
        score: Number(dto.score ?? 0),
        teacherRemarks: dto.feedback,
      },
      actor,
    );
  }

  async requestCorrection(
    submissionId: string,
    dto: RequestCorrectionDto,
    actor: AuthContext,
  ) {
    const submission = await this.findSubmissionOrThrow(actor, submissionId);
    await this.ensureSubjectTeacherScope(
      actor,
      submission.homework.subjectId,
      await this.resolveActorStaffId(actor),
    );

    const updated = await this.prisma.homeworkSubmission.update({
      where: { id: submission.id },
      data: {
        status: HomeworkSubmissionStatus.NEEDS_CORRECTION,
        correctionRemarks: dto.correctionRemarks,
        returnedAt: new Date(),
        reviewedById: actor.userId,
      },
      include: homeworkSubmissionInclude(),
    });

    await this.notifySubmissionStudent(
      updated,
      actor,
      'homework_correction_requested',
      'Correction requested',
      `Please correct and resubmit "${updated.homework.title}".`,
    );
    await this.auditSubmission('request_correction', updated.id, actor, {
      homeworkId: updated.homeworkId,
      status: updated.status,
    });

    return updated;
  }

  private async setAssignmentStatus(
    homeworkId: string,
    status: HomeworkAssignmentStatus,
    action: string,
    actor: AuthContext,
  ) {
    const assignment = await this.findAssignmentOrThrow(actor, homeworkId);
    const updated = await this.prisma.homeworkAssignment.update({
      where: { id: assignment.id },
      data: { status },
      include: homeworkAssignmentInclude(),
    });

    await this.auditService.record({
      action,
      resource: 'homework_assignment',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      before: { status: assignment.status },
      after: { status: updated.status },
    });

    return updated;
  }

  private async findAssignmentOrThrow(actor: AuthContext, homeworkId: string) {
    const assignment = await this.prisma.homeworkAssignment.findFirst({
      where: { id: homeworkId, tenantId: actor.tenantId },
      include: homeworkAssignmentInclude(),
    });
    if (!assignment) {
      throw new NotFoundException('Homework assignment not found');
    }
    return assignment;
  }

  private async findSubmissionOrThrow(
    actor: AuthContext,
    submissionId: string,
  ) {
    const submission = await this.prisma.homeworkSubmission.findFirst({
      where: { id: submissionId, tenantId: actor.tenantId },
      include: homeworkSubmissionInclude(),
    });
    if (!submission) {
      throw new NotFoundException('Homework submission not found');
    }
    return submission;
  }

  private async ensureAssignmentSubmissions(
    homeworkId: string,
    actor: AuthContext,
  ) {
    const assignment = await this.findAssignmentOrThrow(actor, homeworkId);
    const students = await this.prisma.student.findMany({
      where: {
        tenantId: actor.tenantId,
        classId: assignment.classId,
        ...(assignment.sectionId ? { sectionId: assignment.sectionId } : {}),
      },
      select: { id: true },
    });

    if (students.length === 0) {
      return;
    }

    await this.prisma.homeworkSubmission.createMany({
      data: students.map((student) => ({
        tenantId: actor.tenantId,
        homeworkId,
        studentId: student.id,
      })),
      skipDuplicates: true,
    });
  }

  private async ensureHomeworkRefs(
    actor: AuthContext,
    refs: {
      academicYearId: string;
      classId: string;
      sectionId?: string | null;
      subjectId: string;
      staffId?: string | null;
    },
  ) {
    const [year, classroom, subject, staff] = await Promise.all([
      this.prisma.academicYear.findFirst({
        where: { id: refs.academicYearId, tenantId: actor.tenantId },
      }),
      this.prisma.class.findFirst({
        where: { id: refs.classId, tenantId: actor.tenantId },
      }),
      this.prisma.subject.findFirst({
        where: {
          id: refs.subjectId,
          tenantId: actor.tenantId,
          classId: refs.classId,
        },
      }),
      refs.staffId
        ? this.prisma.staff.findFirst({
            where: { id: refs.staffId, tenantId: actor.tenantId },
          })
        : Promise.resolve(null),
    ]);

    if (!year) throw new NotFoundException('Academic year not found');
    if (!classroom) throw new NotFoundException('Class not found');
    if (!subject)
      throw new NotFoundException('Subject not found for this class');
    if (refs.staffId && !staff)
      throw new NotFoundException('Staff member not found');

    if (refs.sectionId) {
      const section = await this.prisma.section.findFirst({
        where: {
          id: refs.sectionId,
          tenantId: actor.tenantId,
          classId: refs.classId,
        },
      });
      if (!section)
        throw new NotFoundException('Section not found for this class');
    }
  }

  private async ensureStudentInAssignmentScope(
    actor: AuthContext,
    studentId: string,
    assignment: Awaited<ReturnType<HomeworkService['findAssignmentOrThrow']>>,
  ) {
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        tenantId: actor.tenantId,
        classId: assignment.classId,
        ...(assignment.sectionId ? { sectionId: assignment.sectionId } : {}),
      },
    });
    if (!student) {
      throw new NotFoundException('Student not found in homework scope');
    }
  }

  private async ensureHomeworkVisibility(
    actor: AuthContext,
    homeworkId: string,
  ) {
    const studentId = await this.resolveVisibleStudentId(actor);
    if (!studentId) return;

    const visible = await this.prisma.homeworkSubmission.findFirst({
      where: { tenantId: actor.tenantId, homeworkId, studentId },
    });
    if (!visible) {
      throw new ForbiddenException('Homework is not visible for this student');
    }
  }

  private async ensureSubjectTeacherScope(
    actor: AuthContext,
    subjectId: string,
    staffId: string | null,
  ) {
    if (!this.isScopedSubjectTeacher(actor)) return;
    if (!staffId)
      throw new ForbiddenException('Subject teacher staff profile not found');

    const assignment = await this.prisma.subjectTeacherAssignment.findFirst({
      where: {
        tenantId: actor.tenantId,
        subjectId,
        staffId,
      },
    });
    if (!assignment) {
      throw new ForbiddenException('You are not assigned to this subject');
    }
  }

  private pendingReminderSubmissions(
    assignment: Awaited<ReturnType<HomeworkService['findAssignmentOrThrow']>>,
  ) {
    return assignment.submissions.filter(
      (submission) =>
        submission.status === HomeworkSubmissionStatus.NOT_SUBMITTED ||
        submission.status === HomeworkSubmissionStatus.LATE ||
        submission.status === HomeworkSubmissionStatus.NEEDS_CORRECTION,
    );
  }

  private async notifyHomeworkAssigned(homeworkId: string, actor: AuthContext) {
    const assignment = await this.findAssignmentOrThrow(actor, homeworkId);
    await this.communicationsService.recordDeliveryRecords({
      actor,
      sourceType: 'homework_assigned',
      sourceId: assignment.id,
      audienceType: assignment.sectionId
        ? AudienceType.SECTION
        : AudienceType.CLASS,
      classId: assignment.classId,
      sectionId: assignment.sectionId,
      title: `Homework: ${assignment.title}`,
      body: `${assignment.subject.name} homework is due ${assignment.dueDate.toLocaleDateString('en-NP')}.`,
      channels: [NotificationChannel.PUSH],
      requiredConsentTypes: [ConsentType.MESSAGING],
    });
  }

  private async notifySubmissionStudent(
    submission: Awaited<ReturnType<HomeworkService['findSubmissionOrThrow']>>,
    actor: AuthContext,
    sourceType: string,
    title: string,
    body: string,
  ) {
    await this.communicationsService.recordDeliveryRecords({
      actor,
      sourceType,
      sourceId: `${submission.id}:${sourceType}:${Date.now()}`,
      audienceType: AudienceType.ALL,
      studentIds: [submission.studentId],
      title,
      body,
      channels: [NotificationChannel.PUSH],
      requiredConsentTypes: [ConsentType.MESSAGING],
    });
  }

  private async auditSubmission(
    action: string,
    submissionId: string,
    actor: AuthContext,
    after: Record<string, unknown>,
  ) {
    await this.auditService.record({
      action,
      resource: 'homework_submission',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: submissionId,
      after,
    });
  }

  private async resolveActorStaffId(actor: AuthContext) {
    const staff = await this.prisma.staff.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
      select: { id: true },
    });
    return staff?.id ?? null;
  }

  private async resolveVisibleStudentId(
    actor: AuthContext,
    requestedStudentId?: string,
  ) {
    if (actor.roles.includes('student')) {
      const student = await this.prisma.student.findFirst({
        where: { tenantId: actor.tenantId, userId: actor.userId },
        select: { id: true },
      });
      return student?.id ?? null;
    }

    if (actor.roles.includes('parent')) {
      const link = await this.prisma.studentGuardian.findFirst({
        where: {
          tenantId: actor.tenantId,
          guardian: { userId: actor.userId },
          ...(requestedStudentId ? { studentId: requestedStudentId } : {}),
        },
        select: { studentId: true },
      });
      return link?.studentId ?? null;
    }

    return requestedStudentId ?? null;
  }

  private isScopedSubjectTeacher(actor: AuthContext) {
    return (
      actor.roles.includes('subject_teacher') &&
      !actor.roles.some((role) =>
        ['platform_super_admin', 'admin', 'principal'].includes(role),
      )
    );
  }
}

function parseDate(value: string | undefined, fieldName: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ConflictException(`${fieldName} must be a valid date`);
  }
  return parsed;
}

function parseRequiredDate(value: string, fieldName: string) {
  const parsed = parseDate(value, fieldName);
  if (!parsed) {
    throw new ConflictException(`${fieldName} must be provided`);
  }
  return parsed;
}

function homeworkAssignmentInclude() {
  return {
    academicYear: true,
    class: true,
    section: true,
    subject: true,
    assignedByStaff: true,
    submissions: {
      include: {
        student: true,
        attachments: {
          include: { fileAsset: true },
        },
      },
    },
  } satisfies Prisma.HomeworkAssignmentInclude;
}

function homeworkSubmissionInclude() {
  return {
    homework: {
      include: {
        subject: true,
        class: true,
        section: true,
        assignedByStaff: true,
      },
    },
    student: true,
    attachments: {
      include: { fileAsset: true },
    },
  } satisfies Prisma.HomeworkSubmissionInclude;
}
