import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AudienceType,
  ChatAbuseReportStatus,
  ChatAvailabilityAppliesToRole,
  ChatEscalationStatus,
  MessageStatus,
  NotificationChannel,
  NotificationStatus,
  ParentTeacherMessagePriority,
  ParentTeacherSenderRole,
  ParentTeacherThreadStatus,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { isParentOnly } from '../common/security/parent-scope';
import { CommunicationsService } from '../communications/communications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ChatAvailabilityRuleDto,
  CloseParentTeacherThreadDto,
  CreateChatAbuseReportDto,
  CreateParentTeacherMessageDto,
  CreateParentTeacherThreadDto,
  EscalateParentTeacherThreadDto,
  ListParentTeacherMessagesDto,
  ListParentTeacherThreadsDto,
  ResolveChatEscalationDto,
  ReviewChatAbuseReportDto,
  UpdateChatAvailabilityDto,
} from './dto/parent-teacher-chat.dto';

const NEPAL_TIME_OFFSET_MINUTES = 5 * 60 + 45;
const OUTSIDE_HOURS_NOTICE =
  'Your message has been sent. The class teacher usually replies during school chat hours: Sunday-Thursday, 4 PM-7 PM, and Friday, 2 PM-5 PM.';
const SLA_NOTICE = 'Usually replies within 1 school day.';
const MAX_PAGE_SIZE = 100;

interface ThreadRecord {
  id: string;
  tenantId: string;
  academicYearId: string;
  studentId: string;
  guardianId: string;
  classTeacherId: string;
  status: ParentTeacherThreadStatus;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
  closedByUserId: string | null;
  closeReason: string | null;
}

@Injectable()
export class ParentTeacherChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly communicationsService: CommunicationsService,
    private readonly auditService: AuditService,
  ) {}

  async listThreads(query: ListParentTeacherThreadsDto, actor: AuthContext) {
    const { skip, take, page, limit } = getPagination(query);
    const scopeWhere = await this.buildThreadScope(actor);
    const where: Prisma.ParentTeacherThreadWhereInput = {
      tenantId: actor.tenantId,
      ...scopeWhere,
      ...(query.status ? { status: query.status } : {}),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.guardianId ? { guardianId: query.guardianId } : {}),
      ...(query.classTeacherId ? { classTeacherId: query.classTeacherId } : {}),
    };

    const [total, threads] = await this.prisma.$transaction([
      this.prisma.parentTeacherThread.count({ where }),
      this.prisma.parentTeacherThread.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        skip,
        take,
      }),
    ]);

    const enriched = await this.enrichThreads(threads);
    const filtered = query.search
      ? filterThreadSearch(enriched, query.search)
      : enriched;

    return {
      items: filtered,
      page,
      limit,
      total,
      hasNextPage: skip + take < total,
    };
  }

  async getThread(threadId: string, actor: AuthContext) {
    const thread = await this.prisma.parentTeacherThread.findFirst({
      where: { id: threadId, tenantId: actor.tenantId },
    });

    if (!thread) {
      throw new NotFoundException('Parent-teacher thread not found');
    }

    await this.ensureThreadAccess(thread, actor);
    const [enriched] = await this.enrichThreads([thread]);
    return enriched;
  }

  async createOrGetThread(
    dto: CreateParentTeacherThreadDto,
    actor: AuthContext,
  ) {
    const input = await this.resolveThreadInput(dto, actor);

    const existing = await this.prisma.parentTeacherThread.findFirst({
      where: {
        tenantId: actor.tenantId,
        academicYearId: input.academicYearId,
        studentId: input.studentId,
        guardianId: input.guardianId,
        classTeacherId: input.classTeacherId,
        status: ParentTeacherThreadStatus.OPEN,
      },
    });

    if (existing) {
      const [enriched] = await this.enrichThreads([existing]);
      return { thread: enriched, created: false };
    }

    try {
      const thread = await this.prisma.$transaction(async (tx) => {
        const active = await tx.parentTeacherThread.findFirst({
          where: {
            tenantId: actor.tenantId,
            academicYearId: input.academicYearId,
            studentId: input.studentId,
            guardianId: input.guardianId,
            classTeacherId: input.classTeacherId,
            status: ParentTeacherThreadStatus.OPEN,
          },
        });

        if (active) {
          return active;
        }

        return tx.parentTeacherThread.create({
          data: {
            tenantId: actor.tenantId,
            academicYearId: input.academicYearId,
            studentId: input.studentId,
            guardianId: input.guardianId,
            classTeacherId: input.classTeacherId,
          },
        });
      });

      await this.auditService.record({
        action: 'create',
        resource: 'parent_teacher_thread',
        tenantId: actor.tenantId,
        userId: actor.userId,
        resourceId: thread.id,
        after: input,
      });

      const [enriched] = await this.enrichThreads([thread]);
      return { thread: enriched, created: true };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const thread = await this.prisma.parentTeacherThread.findFirst({
          where: {
            tenantId: actor.tenantId,
            academicYearId: input.academicYearId,
            studentId: input.studentId,
            guardianId: input.guardianId,
            classTeacherId: input.classTeacherId,
            status: ParentTeacherThreadStatus.OPEN,
          },
        });

        if (thread) {
          const [enriched] = await this.enrichThreads([thread]);
          return { thread: enriched, created: false };
        }
      }

      throw error;
    }
  }

  async closeThread(
    threadId: string,
    dto: CloseParentTeacherThreadDto,
    actor: AuthContext,
  ) {
    this.ensureModerator(actor);
    const thread = await this.getThreadForModeration(threadId, actor);

    if (thread.status === ParentTeacherThreadStatus.CLOSED) {
      return this.getThread(thread.id, actor);
    }

    const updated = await this.prisma.parentTeacherThread.update({
      where: { id: thread.id },
      data: {
        status: ParentTeacherThreadStatus.CLOSED,
        closedAt: new Date(),
        closedByUserId: actor.userId,
        closeReason: dto.reason,
      },
    });

    await this.auditService.record({
      action: 'close',
      resource: 'parent_teacher_thread',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: thread.id,
      before: { status: thread.status },
      after: { status: updated.status, reason: dto.reason },
    });

    return this.getThread(updated.id, actor);
  }

  async escalateThread(
    threadId: string,
    dto: EscalateParentTeacherThreadDto,
    actor: AuthContext,
  ) {
    const thread = await this.getThreadByIdForActor(threadId, actor);

    if (
      isParentOnly(actor) &&
      dto.escalatedToUserId &&
      !this.isModerator(actor)
    ) {
      throw new ForbiddenException(
        'Parents cannot choose escalation assignees',
      );
    }

    const escalation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.chatEscalation.create({
        data: {
          tenantId: actor.tenantId,
          threadId: thread.id,
          escalatedByUserId: actor.userId,
          escalatedToUserId: this.isModerator(actor)
            ? (dto.escalatedToUserId ?? null)
            : null,
          reason: dto.reason,
        },
      });

      await tx.parentTeacherThread.update({
        where: { id: thread.id },
        data: { status: ParentTeacherThreadStatus.ESCALATED },
      });

      return created;
    });

    await this.auditService.record({
      action: 'escalate',
      resource: 'parent_teacher_thread',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: thread.id,
      after: {
        escalationId: escalation.id,
        reason: dto.reason,
      },
    });

    return escalation;
  }

  async listMessages(
    threadId: string,
    query: ListParentTeacherMessagesDto,
    actor: AuthContext,
  ) {
    const thread = await this.getThreadByIdForActor(threadId, actor);
    const { skip, take, page, limit } = getPagination(query);
    const where = { tenantId: actor.tenantId, threadId: thread.id };

    const [total, messages] = await this.prisma.$transaction([
      this.prisma.parentTeacherMessage.count({ where }),
      this.prisma.parentTeacherMessage.findMany({
        where,
        orderBy: [{ sentAt: 'asc' }],
        skip,
        take,
      }),
    ]);

    return {
      items: messages,
      page,
      limit,
      total,
      hasNextPage: skip + take < total,
    };
  }

  async sendMessage(
    threadId: string,
    dto: CreateParentTeacherMessageDto,
    actor: AuthContext,
  ) {
    const thread = await this.getThreadByIdForActor(threadId, actor);

    if (thread.status === ParentTeacherThreadStatus.CLOSED) {
      throw new ConflictException(
        'Closed parent-teacher threads reject new messages',
      );
    }

    const senderRole = await this.resolveSenderRole(thread, actor);
    const priority = dto.priority ?? ParentTeacherMessagePriority.NORMAL;

    if (
      priority === ParentTeacherMessagePriority.EMERGENCY &&
      !this.isModerator(actor) &&
      senderRole !== ParentTeacherSenderRole.TEACHER
    ) {
      throw new ForbiddenException(
        'Emergency parent-teacher messages require teacher or admin role',
      );
    }

    const availability = await this.getAvailabilityStatus(actor);
    const message = await this.prisma.parentTeacherMessage.create({
      data: {
        tenantId: actor.tenantId,
        threadId: thread.id,
        senderUserId: actor.userId,
        senderRole,
        message: dto.message.trim(),
        priority,
        status: MessageStatus.SENT,
      },
    });

    await this.prisma.parentTeacherThread.update({
      where: { id: thread.id },
      data: { updatedAt: new Date() },
    });

    await this.recordMessageNotification(
      actor,
      thread,
      message,
      availability.isAvailable,
    );

    await this.auditService.record({
      action: 'send',
      resource: 'parent_teacher_message',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: message.id,
      after: {
        threadId: thread.id,
        senderRole,
        priority,
        outsideHours: !availability.isAvailable,
      },
    });

    return {
      message,
      availability,
      queuedNotice: availability.isAvailable ? null : OUTSIDE_HOURS_NOTICE,
      sla: SLA_NOTICE,
    };
  }

  async markMessageRead(messageId: string, actor: AuthContext) {
    const message = await this.prisma.parentTeacherMessage.findFirst({
      where: { id: messageId, tenantId: actor.tenantId },
    });

    if (!message) {
      throw new NotFoundException('Parent-teacher message not found');
    }

    const thread = await this.getThreadByIdForActor(message.threadId, actor);

    if (message.senderUserId === actor.userId) {
      return message;
    }

    const updated = await this.prisma.parentTeacherMessage.update({
      where: { id: message.id },
      data: {
        status: MessageStatus.READ,
        readAt: message.readAt ?? new Date(),
      },
    });

    await this.auditService.record({
      action: 'read',
      resource: 'parent_teacher_message',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: message.id,
      after: { threadId: thread.id },
    });

    return updated;
  }

  async markThreadRead(threadId: string, actor: AuthContext) {
    const thread = await this.getThreadByIdForActor(threadId, actor);
    const result = await this.prisma.parentTeacherMessage.updateMany({
      where: {
        tenantId: actor.tenantId,
        threadId: thread.id,
        senderUserId: { not: actor.userId },
        readAt: null,
      },
      data: {
        status: MessageStatus.READ,
        readAt: new Date(),
      },
    });

    if (result.count > 0) {
      await this.auditService.record({
        action: 'read_many',
        resource: 'parent_teacher_message',
        tenantId: actor.tenantId,
        userId: actor.userId,
        resourceId: thread.id,
        after: { count: result.count },
      });
    }

    return result;
  }

  async listAvailability(actor: AuthContext) {
    const rules = await this.prisma.chatAvailabilityRule.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: [{ dayOfWeek: 'asc' }, { appliesToRole: 'asc' }],
      take: 100,
    });

    return rules.length > 0
      ? rules
      : getDefaultAvailabilityRules(actor.tenantId);
  }

  async updateAvailability(dto: UpdateChatAvailabilityDto, actor: AuthContext) {
    this.ensureModerator(actor);
    validateAvailabilityRules(dto.rules);

    await this.prisma.$transaction(
      dto.rules.map((rule) =>
        this.prisma.chatAvailabilityRule.upsert({
          where: {
            tenantId_dayOfWeek_appliesToRole: {
              tenantId: actor.tenantId,
              dayOfWeek: rule.dayOfWeek,
              appliesToRole: rule.appliesToRole,
            },
          },
          create: { tenantId: actor.tenantId, ...rule },
          update: {
            enabled: rule.enabled,
            startTime: rule.startTime,
            endTime: rule.endTime,
          },
        }),
      ),
    );

    await this.auditService.record({
      action: 'update',
      resource: 'chat_availability_rule',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: { rules: dto.rules },
    });

    return this.listAvailability(actor);
  }

  async getAvailabilityStatus(actor: AuthContext) {
    const rules = await this.listAvailability(actor);
    const now = getNepalWallClock(new Date());
    const applicable = rules.find(
      (rule) =>
        rule.dayOfWeek === now.dayOfWeek &&
        (rule.appliesToRole === ChatAvailabilityAppliesToRole.BOTH ||
          rule.appliesToRole === ChatAvailabilityAppliesToRole.PARENT),
    );

    const isAvailable = Boolean(
      applicable?.enabled &&
      timeToMinutes(now.time) >= timeToMinutes(applicable.startTime) &&
      timeToMinutes(now.time) <= timeToMinutes(applicable.endTime),
    );

    return {
      isAvailable,
      timezone: 'Asia/Kathmandu',
      currentDayOfWeek: now.dayOfWeek,
      currentTime: now.time,
      notice: isAvailable
        ? 'School chat hours are open now.'
        : OUTSIDE_HOURS_NOTICE,
      sla: SLA_NOTICE,
      nextWindow: isAvailable ? null : describeDefaultNextWindow(now.dayOfWeek),
    };
  }

  async createAbuseReport(
    threadId: string,
    dto: CreateChatAbuseReportDto,
    actor: AuthContext,
  ) {
    const thread = await this.getThreadByIdForActor(threadId, actor);

    if (dto.messageId) {
      const message = await this.prisma.parentTeacherMessage.findFirst({
        where: {
          id: dto.messageId,
          tenantId: actor.tenantId,
          threadId: thread.id,
        },
      });

      if (!message) {
        throw new NotFoundException('Message not found in this thread');
      }
    }

    const report = await this.prisma.chatAbuseReport.create({
      data: {
        tenantId: actor.tenantId,
        threadId: thread.id,
        messageId: dto.messageId ?? null,
        reportedByUserId: actor.userId,
        reason: dto.reason,
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'chat_abuse_report',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: report.id,
      after: { threadId: thread.id, messageId: dto.messageId ?? null },
    });

    return report;
  }

  async listAbuseReports(actor: AuthContext) {
    this.ensureModerator(actor);
    return this.prisma.chatAbuseReport.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    });
  }

  async reviewAbuseReport(
    reportId: string,
    dto: ReviewChatAbuseReportDto,
    actor: AuthContext,
  ) {
    this.ensureModerator(actor);

    if (dto.status === ChatAbuseReportStatus.OPEN) {
      throw new BadRequestException('Review status must move beyond OPEN');
    }

    const report = await this.prisma.chatAbuseReport.findFirst({
      where: { id: reportId, tenantId: actor.tenantId },
    });

    if (!report) {
      throw new NotFoundException('Abuse report not found');
    }

    const updated = await this.prisma.chatAbuseReport.update({
      where: { id: report.id },
      data: {
        status: dto.status,
        reviewedByUserId: actor.userId,
        reviewedAt: new Date(),
      },
    });

    await this.auditService.record({
      action: 'review',
      resource: 'chat_abuse_report',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: report.id,
      before: { status: report.status },
      after: { status: updated.status },
    });

    return updated;
  }

  async resolveEscalation(
    escalationId: string,
    dto: ResolveChatEscalationDto,
    actor: AuthContext,
  ) {
    this.ensureModerator(actor);
    const escalation = await this.prisma.chatEscalation.findFirst({
      where: { id: escalationId, tenantId: actor.tenantId },
    });

    if (!escalation) {
      throw new NotFoundException('Escalation not found');
    }

    const updated = await this.prisma.chatEscalation.update({
      where: { id: escalation.id },
      data: {
        status: ChatEscalationStatus.RESOLVED,
        resolvedAt: new Date(),
        resolvedByUserId: actor.userId,
      },
    });

    await this.auditService.record({
      action: 'resolve',
      resource: 'chat_escalation',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: escalation.id,
      before: { status: escalation.status },
      after: {
        status: updated.status,
        resolutionNote: dto.resolutionNote,
      },
    });

    return updated;
  }

  private async resolveThreadInput(
    dto: CreateParentTeacherThreadDto,
    actor: AuthContext,
  ) {
    const academicYearId =
      dto.academicYearId ?? (await this.getCurrentAcademicYearId(actor));
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, tenantId: actor.tenantId },
      select: { id: true, classId: true, sectionId: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
    }

    const guardianId = await this.resolveGuardianId(dto, actor, student.id);
    const classTeacherId =
      dto.classTeacherId ??
      (await this.inferAssignedTeacherId(actor, student, academicYearId));

    await this.ensureGuardianLinkedToStudent(actor, guardianId, student.id);
    await this.ensureTeacherAssignedToStudent(
      actor,
      classTeacherId,
      student,
      academicYearId,
    );

    if (isParentOnly(actor)) {
      const guardian = await this.getGuardianForActor(actor);
      if (guardian.id !== guardianId) {
        throw new ForbiddenException(
          'Parents can only open threads for their own guardian profile',
        );
      }
    }

    if (this.isTeacherOnly(actor)) {
      const staff = await this.getStaffForActor(actor);
      if (staff.id !== classTeacherId) {
        throw new ForbiddenException(
          'Teachers can only open assigned class threads',
        );
      }
    }

    return {
      academicYearId,
      studentId: student.id,
      guardianId,
      classTeacherId,
    };
  }

  private async resolveGuardianId(
    dto: CreateParentTeacherThreadDto,
    actor: AuthContext,
    studentId: string,
  ) {
    if (isParentOnly(actor)) {
      const guardian = await this.getGuardianForActor(actor);
      if (dto.guardianId && dto.guardianId !== guardian.id) {
        throw new ForbiddenException(
          'Parents cannot open threads for another guardian',
        );
      }
      return guardian.id;
    }

    if (dto.guardianId) {
      return dto.guardianId;
    }

    const link = await this.prisma.studentGuardian.findFirst({
      where: { tenantId: actor.tenantId, studentId, isPrimary: true },
    });

    if (!link) {
      throw new ConflictException('Student has no primary guardian linked');
    }

    return link.guardianId;
  }

  private async getCurrentAcademicYearId(actor: AuthContext) {
    const year = await this.prisma.academicYear.findFirst({
      where: { tenantId: actor.tenantId, isCurrent: true },
      orderBy: [{ startsOn: 'desc' }],
    });

    if (!year) {
      throw new ConflictException('No current academic year is configured');
    }

    return year.id;
  }

  private async inferAssignedTeacherId(
    actor: AuthContext,
    student: { classId: string; sectionId: string | null },
    academicYearId: string,
  ) {
    const assignment = await this.prisma.subjectTeacherAssignment.findFirst({
      where: {
        tenantId: actor.tenantId,
        academicYearId,
        classId: student.classId,
        OR: [{ sectionId: student.sectionId }, { sectionId: null }],
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    if (!assignment) {
      throw new ConflictException(
        'No assigned class teacher found for this student',
      );
    }

    return assignment.staffId;
  }

  private async ensureGuardianLinkedToStudent(
    actor: AuthContext,
    guardianId: string,
    studentId: string,
  ) {
    const link = await this.prisma.studentGuardian.findFirst({
      where: { tenantId: actor.tenantId, guardianId, studentId },
    });

    if (!link) {
      throw new ForbiddenException('Guardian is not linked to this student');
    }
  }

  private async ensureTeacherAssignedToStudent(
    actor: AuthContext,
    classTeacherId: string,
    student: { classId: string; sectionId: string | null },
    academicYearId: string,
  ) {
    const assignment = await this.prisma.subjectTeacherAssignment.findFirst({
      where: {
        tenantId: actor.tenantId,
        staffId: classTeacherId,
        academicYearId,
        classId: student.classId,
        OR: [{ sectionId: student.sectionId }, { sectionId: null }],
      },
    });

    if (!assignment) {
      throw new ForbiddenException(
        'Teacher is not assigned to this student class/section',
      );
    }
  }

  private async buildThreadScope(actor: AuthContext) {
    if (this.isModerator(actor)) {
      return {};
    }

    if (isParentOnly(actor)) {
      const guardian = await this.getGuardianForActor(actor);
      return { guardianId: guardian.id };
    }

    if (this.isTeacherOnly(actor)) {
      const staff = await this.getStaffForActor(actor);
      return { classTeacherId: staff.id };
    }

    throw new ForbiddenException(
      'Parent-teacher messaging is restricted to parents, assigned teachers, and moderators',
    );
  }

  private async getThreadByIdForActor(threadId: string, actor: AuthContext) {
    const thread = await this.prisma.parentTeacherThread.findFirst({
      where: { id: threadId, tenantId: actor.tenantId },
    });

    if (!thread) {
      throw new NotFoundException('Parent-teacher thread not found');
    }

    await this.ensureThreadAccess(thread, actor);
    return thread;
  }

  private async getThreadForModeration(threadId: string, actor: AuthContext) {
    const thread = await this.prisma.parentTeacherThread.findFirst({
      where: { id: threadId, tenantId: actor.tenantId },
    });

    if (!thread) {
      throw new NotFoundException('Parent-teacher thread not found');
    }

    return thread;
  }

  private async ensureThreadAccess(thread: ThreadRecord, actor: AuthContext) {
    if (this.isModerator(actor)) {
      return;
    }

    if (isParentOnly(actor)) {
      const guardian = await this.getGuardianForActor(actor);
      if (thread.guardianId === guardian.id) {
        return;
      }
    }

    if (this.isTeacherOnly(actor)) {
      const staff = await this.getStaffForActor(actor);
      if (thread.classTeacherId === staff.id) {
        return;
      }
    }

    throw new ForbiddenException(
      'You cannot access this parent-teacher thread',
    );
  }

  private async resolveSenderRole(thread: ThreadRecord, actor: AuthContext) {
    if (this.isModerator(actor)) {
      return ParentTeacherSenderRole.ADMIN;
    }

    if (isParentOnly(actor)) {
      const guardian = await this.getGuardianForActor(actor);
      if (thread.guardianId === guardian.id) {
        return ParentTeacherSenderRole.PARENT;
      }
    }

    if (this.isTeacherOnly(actor)) {
      const staff = await this.getStaffForActor(actor);
      if (thread.classTeacherId === staff.id) {
        return ParentTeacherSenderRole.TEACHER;
      }
    }

    throw new ForbiddenException('You cannot send messages in this thread');
  }

  private async getGuardianForActor(actor: AuthContext) {
    const guardian = await this.prisma.guardian.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
    });

    if (!guardian) {
      throw new ForbiddenException(
        'No guardian profile is linked to this account',
      );
    }

    return guardian;
  }

  private async getStaffForActor(actor: AuthContext) {
    const staff = await this.prisma.staff.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
    });

    if (!staff) {
      throw new ForbiddenException(
        'No staff profile is linked to this account',
      );
    }

    return staff;
  }

  private isModerator(actor: AuthContext) {
    return actor.roles.some((role) =>
      ['platform_super_admin', 'admin', 'principal'].includes(role),
    );
  }

  private ensureModerator(actor: AuthContext) {
    if (!this.isModerator(actor)) {
      throw new ForbiddenException(
        'Only admin or principal can moderate parent-teacher chat',
      );
    }
  }

  private isTeacherOnly(actor: AuthContext) {
    return (
      actor.roles.some((role) =>
        ['teacher', 'subject_teacher'].includes(role),
      ) && !this.isModerator(actor)
    );
  }

  private async enrichThreads(threads: ThreadRecord[]) {
    if (threads.length === 0) {
      return [];
    }

    const studentIds = unique(threads.map((thread) => thread.studentId));
    const guardianIds = unique(threads.map((thread) => thread.guardianId));
    const teacherIds = unique(threads.map((thread) => thread.classTeacherId));
    const academicYearIds = unique(
      threads.map((thread) => thread.academicYearId),
    );
    const [students, guardians, teachers, academicYears, latestMessages] =
      await Promise.all([
        this.prisma.student.findMany({
          where: { id: { in: studentIds } },
          select: {
            id: true,
            firstNameEn: true,
            lastNameEn: true,
            studentSystemId: true,
            classId: true,
            sectionId: true,
            class: { select: { name: true } },
            sectionRef: { select: { name: true } },
          },
        }),
        this.prisma.guardian.findMany({
          where: { id: { in: guardianIds } },
          select: { id: true, fullName: true, relation: true, userId: true },
        }),
        this.prisma.staff.findMany({
          where: { id: { in: teacherIds } },
          select: { id: true, firstName: true, lastName: true, userId: true },
        }),
        this.prisma.academicYear.findMany({
          where: { id: { in: academicYearIds } },
          select: { id: true, name: true },
        }),
        this.prisma.parentTeacherMessage.findMany({
          where: {
            threadId: { in: threads.map((thread) => thread.id) },
          },
          orderBy: [{ sentAt: 'desc' }],
        }),
      ]);

    const studentById = new Map(
      students.map((student) => [student.id, student]),
    );
    const guardianById = new Map(
      guardians.map((guardian) => [guardian.id, guardian]),
    );
    const teacherById = new Map(
      teachers.map((teacher) => [teacher.id, teacher]),
    );
    const yearById = new Map(academicYears.map((year) => [year.id, year]));
    const messagesByThread = new Map<string, typeof latestMessages>();

    for (const message of latestMessages) {
      const current = messagesByThread.get(message.threadId) ?? [];
      if (current.length < 3) {
        current.push(message);
        messagesByThread.set(message.threadId, current);
      }
    }

    return threads.map((thread) => ({
      ...thread,
      student: studentById.get(thread.studentId) ?? null,
      guardian: guardianById.get(thread.guardianId) ?? null,
      classTeacher: teacherById.get(thread.classTeacherId) ?? null,
      academicYear: yearById.get(thread.academicYearId) ?? null,
      latestMessages: messagesByThread.get(thread.id) ?? [],
      sla: SLA_NOTICE,
    }));
  }

  private async recordMessageNotification(
    actor: AuthContext,
    thread: ThreadRecord,
    message: {
      id: string;
      message: string;
      senderRole: ParentTeacherSenderRole;
    },
    isInsideAvailability: boolean,
  ) {
    if (
      message.senderRole === ParentTeacherSenderRole.PARENT &&
      !isInsideAvailability
    ) {
      await this.prisma.notificationDelivery.create({
        data: {
          tenantId: actor.tenantId,
          channel: NotificationChannel.PUSH,
          status: NotificationStatus.QUEUED,
          sourceType: 'parent_teacher_message',
          sourceId: message.id,
          audienceType: AudienceType.ALL,
          recipientUserId: null,
          guardianId: null,
          studentId: thread.studentId,
          destination: null,
          title: 'Parent message queued for chat hours',
          body: message.message,
          errorMessage: OUTSIDE_HOURS_NOTICE,
          sentAt: null,
        },
      });
      return;
    }

    if (message.senderRole === ParentTeacherSenderRole.TEACHER) {
      await this.communicationsService.recordDeliveryRecords({
        actor,
        sourceType: 'parent_teacher_message',
        sourceId: message.id,
        audienceType: AudienceType.ALL,
        studentIds: [thread.studentId],
        title: 'Class teacher replied',
        body: message.message,
        channels: [NotificationChannel.PUSH],
      });
      return;
    }

    const teacher = await this.prisma.staff.findFirst({
      where: { id: thread.classTeacherId, tenantId: actor.tenantId },
      select: { userId: true },
    });

    await this.prisma.notificationDelivery.create({
      data: {
        tenantId: actor.tenantId,
        channel: NotificationChannel.PUSH,
        status: NotificationStatus.QUEUED,
        sourceType: 'parent_teacher_message',
        sourceId: message.id,
        audienceType: AudienceType.ALL,
        recipientUserId: teacher?.userId ?? null,
        guardianId: null,
        studentId: thread.studentId,
        destination: teacher?.userId ?? null,
        title: 'New parent message',
        body: message.message,
        sentAt: null,
      },
    });
  }
}

function getPagination(query: { page?: number; limit?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, query.limit ?? 20));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

function isUniqueViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function filterThreadSearch<
  T extends {
    student?: {
      firstNameEn: string;
      lastNameEn: string;
      studentSystemId: string;
    } | null;
    guardian?: { fullName: string } | null;
    classTeacher?: { firstName: string; lastName: string } | null;
  },
>(threads: T[], search: string) {
  const term = search.trim().toLowerCase();
  if (!term) return threads;

  return threads.filter((thread) =>
    [
      thread.student?.firstNameEn,
      thread.student?.lastNameEn,
      thread.student?.studentSystemId,
      thread.guardian?.fullName,
      thread.classTeacher?.firstName,
      thread.classTeacher?.lastName,
    ]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(term)),
  );
}

function getDefaultAvailabilityRules(tenantId: string) {
  const weekdays: ChatAvailabilityRuleDto[] = [0, 1, 2, 3, 4].map(
    (dayOfWeek) => ({
      tenantId,
      id: `default-${dayOfWeek}`,
      dayOfWeek,
      enabled: true,
      startTime: '16:00',
      endTime: '19:00',
      appliesToRole: ChatAvailabilityAppliesToRole.BOTH,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    }),
  );

  return [
    ...weekdays,
    {
      id: 'default-5',
      tenantId,
      dayOfWeek: 5,
      enabled: true,
      startTime: '14:00',
      endTime: '17:00',
      appliesToRole: ChatAvailabilityAppliesToRole.BOTH,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    },
    {
      id: 'default-6',
      tenantId,
      dayOfWeek: 6,
      enabled: false,
      startTime: '00:00',
      endTime: '00:00',
      appliesToRole: ChatAvailabilityAppliesToRole.BOTH,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    },
  ];
}

function validateAvailabilityRules(rules: ChatAvailabilityRuleDto[]) {
  const seen = new Set<string>();

  for (const rule of rules) {
    const key = `${rule.dayOfWeek}:${rule.appliesToRole}`;
    if (seen.has(key)) {
      throw new BadRequestException(
        'Duplicate availability rule for day and role',
      );
    }
    seen.add(key);

    if (
      rule.enabled &&
      timeToMinutes(rule.startTime) >= timeToMinutes(rule.endTime)
    ) {
      throw new BadRequestException(
        'Availability start time must be before end time',
      );
    }
  }
}

function getNepalWallClock(now: Date) {
  const nepal = new Date(now.getTime() + NEPAL_TIME_OFFSET_MINUTES * 60_000);
  const hours = String(nepal.getUTCHours()).padStart(2, '0');
  const minutes = String(nepal.getUTCMinutes()).padStart(2, '0');

  return {
    dayOfWeek: nepal.getUTCDay(),
    time: `${hours}:${minutes}`,
  };
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function describeDefaultNextWindow(dayOfWeek: number) {
  if (dayOfWeek === 5) {
    return 'Sunday 4 PM-7 PM';
  }

  if (dayOfWeek === 6) {
    return 'Sunday 4 PM-7 PM';
  }

  return 'Next school chat window';
}
