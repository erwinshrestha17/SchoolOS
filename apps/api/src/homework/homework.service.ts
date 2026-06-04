import {
  AudienceType,
  ConsentType,
  HomeworkAssignmentStatus,
  HomeworkSubmissionStatus,
  NotificationChannel,
  Prisma,
} from '@prisma/client';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from '../communications/communications.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { FileRegistryService } from '../file-registry/file-registry.service';
import {
  HomeworkReminderQueryDto,
  HomeworkReminderType,
  SendHomeworkReminderDto,
} from './dto/reminder.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHomeworkDto } from './dto/create-homework.dto';
import { HomeworkQueryDto } from './dto/homework-query.dto';
import { HomeworkSubmissionQueryDto } from './dto/homework-submission-query.dto';
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
import type { HomeworkRecurrenceDto } from './dto/create-homework.dto';
import { randomUUID } from 'node:crypto';

const EDIT_BLOCKED_ASSIGNMENT_STATUSES: readonly HomeworkAssignmentStatus[] = [
  HomeworkAssignmentStatus.CLOSED,
  HomeworkAssignmentStatus.CANCELLED,
] as const;

@Injectable()
export class HomeworkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly communicationsService: CommunicationsService,
    private readonly auditService: AuditService,
    private readonly fileRegistry: FileRegistryService,
    @InjectQueue('homework') private readonly homeworkQueue: Queue,
  ) {}

  async listAssignments(actor: AuthContext, query: HomeworkQueryDto) {
    const skip = ((query.page ?? 1) - 1) * (query.limit ?? 20);
    const take = query.limit ?? 20;
    let scopedStudentId: string | null = null;

    const where: Prisma.HomeworkAssignmentWhereInput = {
      tenantId: actor.tenantId,
      ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.teacherId ? { assignedByStaffId: query.teacherId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    // Scoping for students/guardians
    if (actor.roles.includes('student')) {
      const student = await this.prisma.student.findFirst({
        where: { tenantId: actor.tenantId, userId: actor.userId },
        select: { id: true, classId: true, sectionId: true },
      });
      if (!student) {
        return { items: [], total: 0 };
      }
      scopedStudentId = student.id;
      if (student) {
        where.classId = student.classId;
        if (student.sectionId) {
          where.OR = [{ sectionId: student.sectionId }, { sectionId: null }];
        } else {
          where.sectionId = null;
        }
      }
    } else if (actor.roles.includes('parent')) {
      const studentId = await this.resolveVisibleStudentId(
        actor,
        query.studentId,
      );
      if (studentId) {
        const student = await this.prisma.student.findUnique({
          where: { id: studentId },
          select: { classId: true, sectionId: true },
        });
        if (!student) {
          return { items: [], total: 0 };
        }
        scopedStudentId = studentId;
        if (student) {
          where.classId = student.classId;
          if (student.sectionId) {
            where.OR = [{ sectionId: student.sectionId }, { sectionId: null }];
          } else {
            where.sectionId = null;
          }
        }
      } else {
        return { items: [], total: 0 };
      }
    }

    if (query.studentId) {
      if (scopedStudentId && query.studentId !== scopedStudentId) {
        return { items: [], total: 0 };
      }
      where.submissions = {
        some: { studentId: query.studentId },
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.homeworkAssignment.findMany({
        where,
        include: homeworkAssignmentInclude(),
        orderBy: { dueDate: 'desc' },
        skip,
        take,
      }),
      this.prisma.homeworkAssignment.count({ where }),
    ]);

    return { items, total };
  }

  async markAsReviewed(
    actor: AuthContext,
    submissionId: string,
    feedback?: string,
  ) {
    const submission = await this.prisma.homeworkSubmission.findFirst({
      where: { id: submissionId, tenantId: actor.tenantId },
      include: { homework: true },
    });
    if (!submission) throw new NotFoundException('Submission not found');

    const updated = await this.prisma.homeworkSubmission.update({
      where: { id: submissionId },
      data: {
        status: HomeworkSubmissionStatus.REVIEWED,
        feedback: feedback ?? submission.feedback,
        reviewedAt: new Date(),
        reviewedById: actor.userId,
      },
    });

    await this.auditService.record({
      action: 'review',
      resource: 'homework_submission',
      resourceId: submissionId,
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: updated,
    });

    return updated;
  }

  async getAssignment(actor: AuthContext, id: string) {
    return this.findAssignmentOrThrow(actor, id);
  }

  async listTemplates(actor: AuthContext) {
    const candidates = await this.prisma.homeworkAssignment.findMany({
      where: {
        tenantId: actor.tenantId,
        attachmentMetadata: { not: Prisma.JsonNull },
      },
      include: homeworkAssignmentInclude(),
      orderBy: [{ updatedAt: 'desc' }],
      take: 100,
    });

    return candidates.filter((assignment) =>
      isHomeworkTemplateMetadata(assignment.attachmentMetadata),
    );
  }

  async getSubmission(actor: AuthContext, id: string) {
    const studentScope = await this.resolveVisibleStudentIdsForRead(actor);
    const submission = await this.prisma.homeworkSubmission.findFirst({
      where: {
        id,
        tenantId: actor.tenantId,
        ...(studentScope
          ? {
              studentId: {
                in: studentScope.length ? studentScope : ['__none__'],
              },
            }
          : {}),
      },
      include: homeworkSubmissionInclude(),
    });
    if (!submission) throw new NotFoundException('Submission not found');
    return submission;
  }

  async createAssignment(dto: CreateHomeworkDto, actor: AuthContext) {
    // 1. Validate Dates
    const assignedDate = dto.assignedDate
      ? new Date(dto.assignedDate)
      : new Date();
    const dueDate = new Date(dto.dueDate);

    if (dueDate < assignedDate) {
      throw new ConflictException('Due date cannot be before assigned date');
    }

    const staffId = await this.resolveActorStaffId(actor);
    if (!staffId) {
      throw new ForbiddenException('Only staff can create homework');
    }

    // 2. Validate Scope & Existence
    const [academicYear, classRecord, subject] = await Promise.all([
      this.prisma.academicYear.findFirst({
        where: { id: dto.academicYearId, tenantId: actor.tenantId },
      }),
      this.prisma.class.findFirst({
        where: { id: dto.classId, tenantId: actor.tenantId },
      }),
      this.prisma.subject.findFirst({
        where: { id: dto.subjectId, tenantId: actor.tenantId },
      }),
    ]);

    if (!academicYear) throw new NotFoundException('Academic year not found');
    if (!classRecord) throw new NotFoundException('Class not found');
    if (!subject) throw new NotFoundException('Subject not found');

    // 3. Validate Teacher Assignment
    const isTeacher =
      actor.roles.includes('teacher') ||
      actor.roles.includes('subject_teacher');
    const isAdmin =
      actor.roles.includes('admin') ||
      actor.roles.includes('platform_super_admin');

    if (isTeacher && !isAdmin) {
      const isAssigned = await this.prisma.subjectTeacherAssignment.findFirst({
        where: {
          tenantId: actor.tenantId,
          academicYearId: dto.academicYearId,
          subjectId: dto.subjectId,
          staffId,
        },
      });
      if (!isAssigned) {
        throw new ForbiddenException('You are not assigned to this subject');
      }
    }

    const occurrences = buildHomeworkOccurrences({
      assignedDate,
      dueDate,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : dueDate,
      recurrence: dto.recurrence,
    });
    const recurrenceSeriesId =
      occurrences.length > 1 ? cryptoRandomId('hw-series') : null;

    const result = await this.prisma.$transaction(async (tx) => {
      const assignments = [];

      for (const [index, occurrence] of occurrences.entries()) {
        const assignment = await tx.homeworkAssignment.create({
          data: {
            tenantId: actor.tenantId,
            academicYearId: dto.academicYearId,
            classId: dto.classId,
            sectionId: dto.sectionId,
            subjectId: dto.subjectId,
            assignedByStaffId: staffId,
            title:
              occurrences.length > 1
                ? `${dto.title} (${index + 1}/${occurrences.length})`
                : dto.title,
            description: dto.description,
            instructions: dto.instructions,
            assignedDate: occurrence.assignedDate,
            dueDate: occurrence.dueDate,
            dueAt: occurrence.dueAt,
            maxScore: dto.maxScore,
            submissionRequired: dto.submissionRequired,
            status: HomeworkAssignmentStatus.DRAFT,
            attachmentMetadata: buildHomeworkMetadata(dto.attachmentMetadata, {
              saveAsTemplate: dto.saveAsTemplate,
              templateName: dto.templateName,
              templateSourceTitle: dto.title,
              actorUserId: actor.userId,
              recurrence: dto.recurrence,
              recurrenceSeriesId,
              occurrenceIndex: index,
              occurrenceCount: occurrences.length,
            }),
          },
        });

        if (dto.attachmentFileIds?.length) {
          await this.linkAttachments(
            actor,
            assignment.id,
            null,
            dto.attachmentFileIds,
            tx,
          );
        }

        assignments.push(assignment);
      }

      return assignments;
    });

    const assignments = await Promise.all(
      result.map((assignment) => this.findAssignmentOrThrow(actor, assignment.id)),
    );
    const assignment = assignments[0];

    await this.auditService.record({
      action: occurrences.length > 1 ? 'create_recurring' : 'create',
      resource: 'homework_assignment',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: assignment.id,
      after: {
        title: assignment.title,
        dueDate: assignment.dueDate,
        attachmentCount: dto.attachmentFileIds?.length ?? 0,
        submissionRequired: assignment.submissionRequired,
        recurrenceSeriesId,
        occurrenceCount: assignments.length,
        savedAsTemplate: dto.saveAsTemplate ?? false,
      },
    });

    return assignments.length === 1
      ? assignment
      : {
          recurrenceSeriesId,
          occurrenceCount: assignments.length,
          items: assignments,
        };
  }

  async updateAssignment(
    id: string,
    dto: UpdateHomeworkDto,
    actor: AuthContext,
  ) {
    const assignment = await this.findAssignmentOrThrow(actor, id);

    if (EDIT_BLOCKED_ASSIGNMENT_STATUSES.includes(assignment.status)) {
      throw new ConflictException(
        `Cannot edit homework in ${assignment.status} status`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.homeworkAssignment.update({
        where: { id },
        data: {
          title: dto.title,
          description: dto.description,
          instructions: dto.instructions,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          dueAt: dto.dueAt
            ? new Date(dto.dueAt)
            : dto.dueDate
              ? new Date(dto.dueDate)
              : undefined,
          maxScore: dto.maxScore,
          submissionRequired: dto.submissionRequired,
        },
      });

      if (dto.attachmentFileIds) {
        await tx.homeworkAttachment.deleteMany({
          where: { tenantId: actor.tenantId, assignmentId: assignment.id },
        });
        if (dto.attachmentFileIds.length > 0) {
          await this.linkAttachments(
            actor,
            assignment.id,
            null,
            dto.attachmentFileIds,
            tx,
          );
        }
      }

      return result;
    });

    await this.findAssignmentOrThrow(actor, updated.id);

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
        attachmentCount:
          dto.attachmentFileIds?.length ?? assignment.attachments.length,
        submissionRequired: updated.submissionRequired,
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

    // Create a reminder batch for publication
    await this.createOrReuseReminderBatch(
      actor,
      updated.id,
      HomeworkReminderType.HOMEWORK_PUBLISHED,
      {
        targetCount: 0, // Will be updated by communications service
        deliveryCount: 0,
      },
    );

    return updated;
  }

  async closeHomework(homeworkId: string, actor: AuthContext) {
    return this.setAssignmentStatus(
      homeworkId,
      HomeworkAssignmentStatus.CLOSED,
      actor,
    );
  }

  async cancelHomework(homeworkId: string, actor: AuthContext) {
    return this.setAssignmentStatus(
      homeworkId,
      HomeworkAssignmentStatus.CANCELLED,
      actor,
    );
  }

  async deleteOrCancelHomework(id: string, actor: AuthContext) {
    const assignment = await this.findAssignmentOrThrow(actor, id);
    if (assignment.status === HomeworkAssignmentStatus.DRAFT) {
      await this.prisma.homeworkAssignment.delete({
        where: { id: assignment.id, tenantId: actor.tenantId },
      });
      return { deleted: true, id };
    }
    return this.cancelHomework(id, actor);
  }

  private async setAssignmentStatus(
    id: string,
    status: HomeworkAssignmentStatus,
    actor: AuthContext,
  ) {
    const assignment = await this.findAssignmentOrThrow(actor, id);
    const updated = await this.prisma.homeworkAssignment.update({
      where: { id },
      data: { status },
      include: homeworkAssignmentInclude(),
    });

    await this.auditService.record({
      action: 'status_update',
      resource: 'homework_assignment',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: id,
      before: { status: assignment.status },
      after: { status: updated.status },
    });

    return updated;
  }

  async listSubmissions(
    actor: AuthContext,
    assignmentId: string | undefined,
    query: HomeworkSubmissionQueryDto,
  ) {
    const skip = ((query.page ?? 1) - 1) * (query.limit ?? 20);
    const take = query.limit ?? 20;
    const studentScope = await this.resolveVisibleStudentIdsForRead(actor);

    if (studentScope && studentScope.length === 0) {
      return { items: [], total: 0 };
    }

    if (
      studentScope &&
      query.studentId &&
      !studentScope.includes(query.studentId)
    ) {
      return { items: [], total: 0 };
    }

    const where: Prisma.HomeworkSubmissionWhereInput = {
      tenantId: actor.tenantId,
      ...(assignmentId ? { homeworkId: assignmentId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(studentScope
        ? { studentId: query.studentId ?? { in: studentScope } }
        : query.studentId
          ? { studentId: query.studentId }
          : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.homeworkSubmission.findMany({
        where,
        include: homeworkSubmissionInclude(),
        orderBy: { submittedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.homeworkSubmission.count({ where }),
    ]);

    return { items, total };
  }

  async createSubmission(
    assignmentId: string,
    dto: CreateHomeworkSubmissionDto,
    actor: AuthContext,
  ) {
    const studentId = await this.resolveVisibleStudentId(actor, dto.studentId);
    if (!studentId) {
      throw new NotFoundException('Student not found or not in your scope');
    }

    const assignment = await this.findAssignmentOrThrow(actor, assignmentId);
    if (assignment.status !== HomeworkAssignmentStatus.ASSIGNED) {
      throw new ConflictException('Homework is not open for submission');
    }

    const existing = await this.prisma.homeworkSubmission.findFirst({
      where: {
        tenantId: actor.tenantId,
        homeworkId: assignmentId,
        studentId,
      },
    });

    if (existing) {
      throw new ConflictException('Submission already exists');
    }

    const isLate = new Date() > assignment.dueDate;
    const status = isLate
      ? HomeworkSubmissionStatus.LATE
      : HomeworkSubmissionStatus.SUBMITTED;

    const result = await this.prisma.$transaction(async (tx) => {
      const submission = await tx.homeworkSubmission.create({
        data: {
          tenantId: actor.tenantId,
          homeworkId: assignmentId,
          studentId,
          status,
          studentRemarks: dto.studentRemarks,
          submittedAt: new Date(),
        },
      });

      if (dto.attachmentFileIds?.length) {
        await this.linkAttachments(
          actor,
          assignmentId,
          submission.id,
          dto.attachmentFileIds,
          tx,
        );
      }

      return submission;
    });

    const submission = await this.findSubmissionOrThrow(actor, result.id);

    await this.auditSubmission('create', submission.id, actor, {
      homeworkId: assignmentId,
      status: submission.status,
      attachmentCount: dto.attachmentFileIds?.length ?? 0,
    });

    return submission;
  }

  async updateSubmission(
    submissionId: string,
    dto: UpdateHomeworkSubmissionDto,
    actor: AuthContext,
  ) {
    const submission = await this.findSubmissionOrThrow(actor, submissionId);
    if (
      submission.status === HomeworkSubmissionStatus.REVIEWED ||
      submission.status === HomeworkSubmissionStatus.EXCUSED
    ) {
      throw new ConflictException('Cannot update reviewed/excused submission');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.homeworkSubmission.update({
        where: { id: submissionId },
        data: {
          studentRemarks: dto.studentRemarks,
          submittedAt: new Date(),
        },
      });

      if (dto.attachmentFileIds) {
        await tx.homeworkAttachment.deleteMany({
          where: { tenantId: actor.tenantId, submissionId: submission.id },
        });
        if (dto.attachmentFileIds.length > 0) {
          await this.linkAttachments(
            actor,
            submission.homeworkId,
            submission.id,
            dto.attachmentFileIds,
            tx,
          );
        }
      }

      return result;
    });

    await this.auditSubmission('update', updated.id, actor, {
      homeworkId: submission.homeworkId,
      attachmentCount:
        dto.attachmentFileIds?.length ?? submission.attachments.length,
    });

    return this.findSubmissionOrThrow(actor, updated.id);
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
    this.ensureSubjectTeacherScope(
      actor,
      submission.homework.subjectId,
      await this.resolveActorStaffId(actor),
    );

    const updated = await this.prisma.homeworkSubmission.update({
      where: { id: submission.id },
      data: {
        status: dto.status,
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
        returnedAt:
          dto.status === HomeworkSubmissionStatus.NEEDS_CORRECTION
            ? new Date()
            : submission.returnedAt,
      },
      include: homeworkSubmissionInclude(),
    });

    if (updated.status === HomeworkSubmissionStatus.NEEDS_CORRECTION) {
      await this.sendHomeworkReturnedForCorrection(updated.id, actor);
    } else {
      await this.notifySubmissionStudent(
        updated,
        actor,
        'homework_reviewed',
        'Homework reviewed',
        `Your homework "${updated.homework.title}" has been reviewed.`,
      );
    }
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
        { correctionRemarks: dto.teacherRemarks ?? 'Needs correction' },
        actor,
      );
    }

    return this.reviewSubmission(
      dto.submissionId,
      {
        status: dto.status,
        score: dto.score,
        teacherRemarks: dto.teacherRemarks,
      },
      actor,
    );
  }

  async legacySubmit(dto: LegacySubmitHomeworkDto, actor: AuthContext) {
    const submission = await this.findSubmissionOrThrow(
      actor,
      dto.submissionId,
    );
    return this.updateSubmission(
      submission.id,
      {
        studentRemarks: dto.content,
        attachmentFileIds: dto.attachmentIds,
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
    this.ensureSubjectTeacherScope(
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

    await this.sendHomeworkReturnedForCorrection(updated.id, actor);
    await this.auditSubmission('request_correction', updated.id, actor, {
      homeworkId: updated.homeworkId,
      status: updated.status,
    });

    return updated;
  }

  private async findAssignmentOrThrow(actor: AuthContext, id: string) {
    const item = await this.prisma.homeworkAssignment.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: homeworkAssignmentInclude(),
    });
    if (!item) throw new NotFoundException('Homework assignment not found');
    return item;
  }

  private async findSubmissionOrThrow(actor: AuthContext, id: string) {
    const studentScope = await this.resolveVisibleStudentIdsForRead(actor);
    const item = await this.prisma.homeworkSubmission.findFirst({
      where: {
        id,
        tenantId: actor.tenantId,
        ...(studentScope
          ? {
              studentId: {
                in: studentScope.length ? studentScope : ['__none__'],
              },
            }
          : {}),
      },
      include: homeworkSubmissionInclude(),
    });
    if (!item) throw new NotFoundException('Homework submission not found');
    return item;
  }

  private async ensureAssignmentSubmissions(
    assignmentId: string,
    actor: AuthContext,
  ) {
    const assignment = await this.prisma.homeworkAssignment.findUnique({
      where: { id: assignmentId },
      select: { classId: true, sectionId: true, tenantId: true },
    });

    if (!assignment) return;

    const students = await this.prisma.student.findMany({
      where: {
        tenantId: actor.tenantId,
        classId: assignment.classId,
        ...(assignment.sectionId ? { sectionId: assignment.sectionId } : {}),
        lifecycleStatus: 'ACTIVE',
      },
      select: { id: true },
    });

    const existing = await this.prisma.homeworkSubmission.findMany({
      where: { homeworkId: assignmentId, tenantId: actor.tenantId },
      select: { studentId: true },
    });

    const existingIds = new Set(existing.map((e) => e.studentId));
    const toCreate = students.filter((s) => !existingIds.has(s.id));

    if (toCreate.length > 0) {
      await this.prisma.homeworkSubmission.createMany({
        data: toCreate.map((s) => ({
          tenantId: actor.tenantId,
          homeworkId: assignmentId,
          studentId: s.id,
          status: HomeworkSubmissionStatus.NOT_SUBMITTED,
        })),
      });
    }
  }

  private ensureSubjectTeacherScope(
    actor: AuthContext,
    subjectId: string,
    staffId: string | null,
  ) {
    if (actor.roles.includes('admin') || actor.roles.includes('principal')) {
      return;
    }

    if (!staffId) {
      throw new ForbiddenException('Only staff can access this resource');
    }

    // Basic check: teacher must belong to the tenant
    // More advanced check would involve Timetable/SubjectTeacher mapping
  }

  private async auditSubmission(
    action: string,
    submissionId: string,
    actor: AuthContext,
    payload: Record<string, unknown>,
  ) {
    await this.auditService.record({
      action: `${action}_submission`,
      resource: 'homework_submission',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: submissionId,
      after: payload,
    });
  }

  private async linkAttachments(
    actor: AuthContext,
    assignmentId: string,
    submissionId: string | null,
    fileAssetIds: string[],
    tx?: Prisma.TransactionClient,
  ) {
    const prisma = tx || this.prisma;

    // 1. Validate files belong to tenant
    const fileAssets = await prisma.fileAsset.findMany({
      where: { id: { in: fileAssetIds }, tenantId: actor.tenantId },
      select: { id: true },
    });

    if (fileAssets.length !== fileAssetIds.length) {
      throw new ConflictException(
        'Some attachment files were not found or do not belong to this tenant',
      );
    }

    // 2. Create join records
    await prisma.homeworkAttachment.createMany({
      data: fileAssetIds.map((fileAssetId) => ({
        tenantId: actor.tenantId,
        assignmentId,
        submissionId,
        fileAssetId,
      })),
      skipDuplicates: true,
    });

    // 3. Update FileAsset entity reference via Registry for consistency/auditing
    for (const assetId of fileAssetIds) {
      await this.fileRegistry.linkToEntity(
        actor.tenantId,
        assetId,
        'homework',
        submissionId ?? assignmentId,
        actor.userId,
      );
    }
  }

  async sendHomeworkReminder(
    homeworkId: string,
    dto: SendHomeworkReminderDto,
    actor: AuthContext,
  ) {
    const homework = await this.findAssignmentOrThrow(actor, homeworkId);

    const idempotencyKey = this.buildHomeworkReminderIdempotencyKey(
      actor.tenantId,
      homework.id,
      dto.reminderType,
    );

    const existingBatch = await this.prisma.homeworkReminderBatch.findFirst({
      where: {
        tenantId: actor.tenantId,
        idempotencyKey,
        status: 'COMPLETED',
      },
    });

    if (existingBatch && !dto.force) {
      return existingBatch;
    }

    let batch = await this.createOrReuseReminderBatch(
      actor,
      homework.id,
      dto.reminderType,
      { idempotencyKey },
    );

    try {
      let result;
      switch (dto.reminderType) {
        case HomeworkReminderType.HOMEWORK_PUBLISHED:
          result = await this.sendHomeworkPublishedReminder(actor, homework.id);
          break;
        case HomeworkReminderType.HOMEWORK_DUE_SOON:
          result = await this.sendHomeworkDueSoonReminder(actor, homework.id);
          break;
        case HomeworkReminderType.HOMEWORK_OVERDUE:
          result = await this.sendHomeworkOverdueReminder(actor, homework.id);
          break;
        default:
          throw new ConflictException(
            `Unsupported reminder type: ${dto.reminderType}`,
          );
      }

      batch = await this.prisma.homeworkReminderBatch.update({
        where: { id: batch.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          targetCount: result.count ?? 0,
          deliveryCount: result.sentCount ?? 0,
          skippedCount: result.skippedCount ?? 0,
        },
      });
    } catch (error) {
      await this.prisma.homeworkReminderBatch.update({
        where: { id: batch.id },
        data: {
          status: 'FAILED',
          failedReason: error instanceof Error ? error.message : String(error),
          completedAt: new Date(),
        },
      });
      throw error;
    }

    await this.auditService.record({
      action: 'send_reminder',
      resource: 'homework_reminder',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: homework.id,
      after: {
        reminderType: dto.reminderType,
        batchId: batch.id,
        idempotencyKey,
      },
    });

    return batch;
  }

  async previewReminders(id: string, actor: AuthContext) {
    const homework = await this.findAssignmentOrThrow(actor, id);
    const targets = await this.resolveHomeworkReminderTargets(
      actor,
      homework,
      HomeworkReminderType.HOMEWORK_DUE_SOON,
    );
    return {
      homeworkId: id,
      targetCount: targets.studentIds.length,
      targets: targets.studentIds,
    };
  }

  async sendReminders(id: string, actor: AuthContext) {
    return this.sendHomeworkReminder(
      id,
      { reminderType: HomeworkReminderType.HOMEWORK_DUE_SOON },
      actor,
    );
  }

  async listHomeworkReminderBatches(
    actor: AuthContext,
    query: HomeworkReminderQueryDto,
  ) {
    const skip = ((query.page ?? 1) - 1) * (query.limit ?? 20);
    const take = query.limit ?? 20;

    return this.prisma.homeworkReminderBatch.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(query.homeworkId ? { homeworkId: query.homeworkId } : {}),
        ...(query.reminderType ? { reminderType: query.reminderType } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.fromDate || query.toDate
          ? {
              createdAt: {
                ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
                ...(query.toDate ? { lte: new Date(query.toDate) } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  async retryHomeworkReminderBatch(batchId: string, actor: AuthContext) {
    const batch = await this.prisma.homeworkReminderBatch.findFirst({
      where: { id: batchId, tenantId: actor.tenantId },
    });

    if (!batch) {
      throw new NotFoundException('Reminder batch not found');
    }

    return this.sendHomeworkReminder(
      batch.homeworkId,
      {
        reminderType: batch.reminderType as HomeworkReminderType,
        force: true,
      },
      actor,
    );
  }

  private async sendHomeworkPublishedReminder(
    actor: AuthContext,
    homeworkId: string,
  ) {
    const assignment = await this.findAssignmentOrThrow(actor, homeworkId);
    return this.communicationsService.recordDeliveryRecords({
      actor,
      sourceType: 'homework_published',
      sourceId: assignment.id,
      audienceType: assignment.sectionId
        ? AudienceType.SECTION
        : AudienceType.CLASS,
      classId: assignment.classId,
      sectionId: assignment.sectionId,
      title: `New homework: ${assignment.title}`,
      body: `${assignment.subject.name} homework is due ${assignment.dueDate.toLocaleDateString('en-NP')}.`,
      channels: [NotificationChannel.PUSH],
      requiredConsentTypes: [ConsentType.MESSAGING],
    });
  }

  private async sendHomeworkDueSoonReminder(
    actor: AuthContext,
    homeworkId: string,
  ) {
    const homework = await this.findAssignmentOrThrow(actor, homeworkId);
    const targets = await this.resolveHomeworkReminderTargets(
      actor,
      homework,
      HomeworkReminderType.HOMEWORK_DUE_SOON,
    );

    if (targets.studentIds.length === 0) {
      return { count: 0, sentCount: 0, skippedCount: 0 };
    }

    return this.communicationsService.recordDeliveryRecords({
      actor,
      sourceType: 'homework_due_soon',
      sourceId: `${homework.id}:due_soon:${new Date().toISOString().split('T')[0]}`,
      audienceType: homework.sectionId
        ? AudienceType.SECTION
        : AudienceType.CLASS,
      classId: homework.classId,
      sectionId: homework.sectionId,
      studentIds: targets.studentIds,
      title: `Homework due soon: ${homework.title}`,
      body: `Reminder: Your ${homework.subject.name} homework is due ${homework.dueDate.toLocaleDateString('en-NP')}.`,
      channels: [NotificationChannel.PUSH],
      requiredConsentTypes: [ConsentType.MESSAGING],
    });
  }

  private async sendHomeworkOverdueReminder(
    actor: AuthContext,
    homeworkId: string,
  ) {
    const homework = await this.findAssignmentOrThrow(actor, homeworkId);
    const targets = await this.resolveHomeworkReminderTargets(
      actor,
      homework,
      HomeworkReminderType.HOMEWORK_OVERDUE,
    );

    if (targets.studentIds.length === 0) {
      return { count: 0, sentCount: 0, skippedCount: 0 };
    }

    return this.communicationsService.recordDeliveryRecords({
      actor,
      sourceType: 'homework_overdue',
      sourceId: `${homework.id}:overdue:${new Date().toISOString().split('T')[0]}`,
      audienceType: homework.sectionId
        ? AudienceType.SECTION
        : AudienceType.CLASS,
      classId: homework.classId,
      sectionId: homework.sectionId,
      studentIds: targets.studentIds,
      title: `Homework overdue: ${homework.title}`,
      body: `Your ${homework.subject.name} homework was due on ${homework.dueDate.toLocaleDateString('en-NP')}. Please submit as soon as possible.`,
      channels: [NotificationChannel.PUSH, NotificationChannel.SMS],
      requiredConsentTypes: [ConsentType.MESSAGING],
    });
  }

  private async resolveHomeworkReminderTargets(
    actor: AuthContext,
    homework: { id: string; classId: string; sectionId: string | null },
    reminderType: HomeworkReminderType,
  ) {
    // Get all students in the class/section
    const students = await this.prisma.student.findMany({
      where: {
        tenantId: actor.tenantId,
        classId: homework.classId,
        ...(homework.sectionId ? { sectionId: homework.sectionId } : {}),
        lifecycleStatus: 'ACTIVE', // Only active students
      },
      select: { id: true },
    });

    let studentIds = students.map((s) => s.id);

    if (
      reminderType === HomeworkReminderType.HOMEWORK_DUE_SOON ||
      reminderType === HomeworkReminderType.HOMEWORK_OVERDUE
    ) {
      // Exclude students who already submitted
      const submittedStudentIds = await this.prisma.homeworkSubmission.findMany(
        {
          where: {
            homeworkId: homework.id,
            status: {
              in: [
                HomeworkSubmissionStatus.SUBMITTED,
                HomeworkSubmissionStatus.LATE,
                HomeworkSubmissionStatus.REVIEWED,
                HomeworkSubmissionStatus.EXCUSED,
              ],
            },
          },
          select: { studentId: true },
        },
      );

      const submittedIds = new Set(submittedStudentIds.map((s) => s.studentId));
      studentIds = studentIds.filter((id) => !submittedIds.has(id));
    }

    return { studentIds };
  }

  private buildHomeworkReminderIdempotencyKey(
    tenantId: string,
    homeworkId: string,
    reminderType: HomeworkReminderType,
  ) {
    const date = new Date().toISOString().split('T')[0];
    if (reminderType === HomeworkReminderType.HOMEWORK_PUBLISHED) {
      return `hw_rem:${tenantId}:${homeworkId}:${reminderType}`;
    }
    return `hw_rem:${tenantId}:${homeworkId}:${reminderType}:${date}`;
  }

  private async createOrReuseReminderBatch(
    actor: AuthContext,
    homeworkId: string,
    reminderType: string,
    options: {
      idempotencyKey?: string;
      targetCount?: number;
      deliveryCount?: number;
    } = {},
  ) {
    return this.prisma.homeworkReminderBatch.upsert({
      where: {
        tenantId_idempotencyKey: {
          tenantId: actor.tenantId,
          idempotencyKey: options.idempotencyKey ?? `temp-${Date.now()}`,
        },
      },
      create: {
        tenantId: actor.tenantId,
        homeworkId,
        createdById: actor.userId,
        reminderType,
        status: 'PROCESSING',
        idempotencyKey: options.idempotencyKey,
        startedAt: new Date(),
        targetCount: options.targetCount ?? 0,
        deliveryCount: options.deliveryCount ?? 0,
      },
      update: {
        status: 'PROCESSING',
        startedAt: new Date(),
        targetCount: options.targetCount ?? 0,
        deliveryCount: options.deliveryCount ?? 0,
      },
    });
  }

  async sendHomeworkReturnedForCorrection(
    submissionId: string,
    actor: AuthContext,
  ) {
    const submission = await this.findSubmissionOrThrow(actor, submissionId);

    const idempotencyKey = `${actor.tenantId}:${submission.id}:HOMEWORK_RETURNED_FOR_CORRECTION`;

    const existingBatch = await this.prisma.homeworkReminderBatch.findFirst({
      where: {
        tenantId: actor.tenantId,
        idempotencyKey,
      },
    });

    if (existingBatch) {
      return existingBatch;
    }

    const batch = await this.createOrReuseReminderBatch(
      actor,
      submission.homeworkId,
      HomeworkReminderType.HOMEWORK_RETURNED_FOR_CORRECTION,
      { idempotencyKey },
    );

    try {
      const result = await this.notifySubmissionStudent(
        submission,
        actor,
        'homework_returned_for_correction',
        'Correction requested',
        `Please correct and resubmit "${submission.homework.title}".`,
      );

      await this.prisma.homeworkReminderBatch.update({
        where: { id: batch.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          targetCount: 1,
          deliveryCount: result.sentCount ?? 0,
        },
      });
    } catch (error) {
      await this.prisma.homeworkReminderBatch.update({
        where: { id: batch.id },
        data: {
          status: 'FAILED',
          failedReason: error instanceof Error ? error.message : String(error),
          completedAt: new Date(),
        },
      });
    }

    return batch;
  }

  private async notifyHomeworkAssigned(homeworkId: string, actor: AuthContext) {
    const assignment = await this.findAssignmentOrThrow(actor, homeworkId);
    await this.communicationsService.recordDeliveryRecords({
      actor,
      sourceType: 'homework_published',
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
    submission: { id: string; studentId: string },
    actor: AuthContext,
    sourceType: string,
    title: string,
    body: string,
  ) {
    return this.communicationsService.recordDeliveryRecords({
      actor,
      sourceType,
      sourceId: submission.id,
      audienceType: AudienceType.STUDENT,
      studentIds: [submission.studentId],
      title,
      body,
      channels: [NotificationChannel.PUSH],
      requiredConsentTypes: [ConsentType.MESSAGING],
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

    if (
      actor.roles.includes('staff') ||
      actor.roles.includes('teacher') ||
      actor.roles.includes('admin')
    ) {
      if (!requestedStudentId) return null;
      const student = await this.prisma.student.findFirst({
        where: { id: requestedStudentId, tenantId: actor.tenantId },
        select: { id: true },
      });
      return student?.id ?? null;
    }

    return requestedStudentId ?? null;
  }

  private async resolveVisibleStudentIdsForRead(actor: AuthContext) {
    if (actor.roles.includes('student')) {
      const student = await this.prisma.student.findFirst({
        where: { tenantId: actor.tenantId, userId: actor.userId },
        select: { id: true },
      });
      return student ? [student.id] : [];
    }

    if (actor.roles.includes('parent')) {
      const links = await this.prisma.studentGuardian.findMany({
        where: {
          tenantId: actor.tenantId,
          guardian: { userId: actor.userId },
        },
        select: { studentId: true },
      });

      return links.map((link) => link.studentId);
    }

    return null;
  }

  async getHomeworkCompletionReport(
    actor: AuthContext,
    academicYearId: string,
    classId?: string,
    sectionId?: string,
  ) {
    const assignments = await this.prisma.homeworkAssignment.findMany({
      where: {
        tenantId: actor.tenantId,
        academicYearId,
        ...(classId ? { classId } : {}),
        ...(sectionId ? { sectionId } : {}),
      },
      include: {
        submissions: {
          select: { id: true, status: true },
        },
        class: true,
        section: true,
        subject: true,
      },
    });

    return assignments.map((a) => {
      const totalSubmissions = a.submissions.length;
      const completed = a.submissions.filter(
        (s) =>
          s.status === HomeworkSubmissionStatus.SUBMITTED ||
          s.status === HomeworkSubmissionStatus.REVIEWED,
      ).length;
      return {
        id: a.id,
        title: a.title,
        class: a.class.name,
        section: a.section?.name,
        subject: a.subject.name,
        dueDate: a.dueDate,
        totalSubmissions,
        completed,
        completionRate:
          totalSubmissions > 0 ? (completed / totalSubmissions) * 100 : 0,
      };
    });
  }

  async getMissingLateSubmissionsReport(
    actor: AuthContext,
    academicYearId: string,
    classId?: string,
  ) {
    const submissions = await this.prisma.homeworkSubmission.findMany({
      where: {
        tenantId: actor.tenantId,
        homework: {
          academicYearId,
          ...(classId ? { classId } : {}),
        },
        status: {
          in: [
            HomeworkSubmissionStatus.NOT_SUBMITTED,
            HomeworkSubmissionStatus.LATE,
          ],
        },
      },
      include: {
        student: true,
        homework: {
          include: {
            class: true,
            section: true,
            subject: true,
          },
        },
      },
      orderBy: { student: { firstNameEn: 'asc' } },
    });

    return submissions.map((s) => ({
      submissionId: s.id,
      studentName: `${s.student.firstNameEn} ${s.student.lastNameEn}`,
      assignmentTitle: s.homework.title,
      subject: s.homework.subject.name,
      class: s.homework.class.name,
      section: s.homework.section?.name,
      dueDate: s.homework.dueDate,
      status: s.status,
    }));
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

type HomeworkOccurrence = {
  assignedDate: Date;
  dueDate: Date;
  dueAt: Date;
};

function buildHomeworkOccurrences(args: {
  assignedDate: Date;
  dueDate: Date;
  dueAt: Date;
  recurrence?: HomeworkRecurrenceDto;
}): HomeworkOccurrence[] {
  const { assignedDate, dueDate, dueAt, recurrence } = args;
  if (!recurrence) {
    return [{ assignedDate, dueDate, dueAt }];
  }

  if (!recurrence.occurrenceCount && !recurrence.repeatUntil) {
    throw new ConflictException(
      'Recurring homework requires occurrenceCount or repeatUntil',
    );
  }

  const interval = recurrence.interval ?? 1;
  const intervalDays = recurrence.frequency === 'DAILY' ? interval : interval * 7;
  const repeatUntil = recurrence.repeatUntil
    ? parseRequiredDate(recurrence.repeatUntil, 'repeatUntil')
    : null;

  if (repeatUntil && repeatUntil < assignedDate) {
    throw new ConflictException('repeatUntil cannot be before assignedDate');
  }

  const maxOccurrences = Math.min(recurrence.occurrenceCount ?? 60, 60);
  const occurrences: HomeworkOccurrence[] = [];

  for (let index = 0; index < maxOccurrences; index += 1) {
    const offsetDays = index * intervalDays;
    const nextAssignedDate = shiftDate(assignedDate, offsetDays);

    if (repeatUntil && nextAssignedDate > repeatUntil) {
      break;
    }

    occurrences.push({
      assignedDate: nextAssignedDate,
      dueDate: shiftDate(dueDate, offsetDays),
      dueAt: shiftDate(dueAt, offsetDays),
    });
  }

  if (occurrences.length < 2) {
    throw new ConflictException(
      'Recurring homework must create at least two assignments',
    );
  }

  return occurrences;
}

function buildHomeworkMetadata(
  base: Record<string, unknown> | undefined,
  options: {
    saveAsTemplate?: boolean;
    templateName?: string;
    templateSourceTitle: string;
    actorUserId: string;
    recurrence?: HomeworkRecurrenceDto;
    recurrenceSeriesId: string | null;
    occurrenceIndex: number;
    occurrenceCount: number;
  },
): Prisma.InputJsonValue | undefined {
  const metadata = normalizeJsonObject(base);

  if (options.saveAsTemplate && options.occurrenceIndex === 0) {
    metadata.homeworkTemplate = {
      isTemplate: true,
      name: options.templateName?.trim() || options.templateSourceTitle,
      savedAt: new Date().toISOString(),
      savedByUserId: options.actorUserId,
    };
  }

  if (options.recurrenceSeriesId && options.recurrence) {
    metadata.homeworkRecurrence = {
      seriesId: options.recurrenceSeriesId,
      occurrenceIndex: options.occurrenceIndex + 1,
      occurrenceCount: options.occurrenceCount,
      frequency: options.recurrence.frequency,
      interval: options.recurrence.interval ?? 1,
      repeatUntil: options.recurrence.repeatUntil ?? null,
    };
  }

  return Object.keys(metadata).length
    ? (metadata as Prisma.InputJsonValue)
    : undefined;
}

function isHomeworkTemplateMetadata(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const template = value.homeworkTemplate;
  return (
    !!template &&
    typeof template === 'object' &&
    !Array.isArray(template) &&
    template.isTemplate === true
  );
}

function normalizeJsonObject(value: Record<string, unknown> | undefined) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function shiftDate(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function cryptoRandomId(prefix: string) {
  return `${prefix}_${randomUUID()}`;
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
    attachments: {
      include: { fileAsset: true },
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
