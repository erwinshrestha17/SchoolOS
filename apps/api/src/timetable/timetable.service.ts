import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AudienceType,
  HomeworkStatus,
  NotificationChannel,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from '../communications/communications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHomeworkDto } from './dto/create-homework.dto';
import { CreateTimetableSlotDto } from './dto/create-timetable-slot.dto';
import { ReviewHomeworkSubmissionDto } from './dto/review-homework-submission.dto';
import { SubmitHomeworkDto } from './dto/submit-homework.dto';

@Injectable()
export class TimetableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly communicationsService: CommunicationsService,
    private readonly auditService: AuditService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async listTimetable(actor: AuthContext, classId?: string) {
    let effectiveClassId = classId;

    if (!effectiveClassId && actor.roles.includes('student')) {
      const student = await this.prisma.student.findFirst({
        where: { tenantId: actor.tenantId, userId: actor.userId },
        select: { classId: true },
      });
      effectiveClassId = student?.classId;
    }

    if (!effectiveClassId && actor.roles.includes('parent')) {
      // For parents, we might need a studentId filter or default to the first student
      // For now, let's just use the first student linked to this parent
      const studentGuardian = await this.prisma.studentGuardian.findFirst({
        where: {
          tenantId: actor.tenantId,
          guardian: { userId: actor.userId },
        },
        include: { student: true },
      });
      effectiveClassId = studentGuardian?.student.classId;
    }

    return this.prisma.timetableSlot.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(effectiveClassId ? { classId: effectiveClassId } : {}),
      },
      include: {
        academicYear: true,
        class: true,
        section: true,
        subject: true,
        staff: true,
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startsAt: 'asc' }],
    });
  }

  async listTeacherWorkload(actor: AuthContext) {
    const staff = await this.prisma.staff.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        timetableSlots: {
          include: {
            subject: true,
            class: true,
            section: true,
          },
        },
        homeworkAssignments: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    return staff.map((member) => {
      const teachingMinutes = member.timetableSlots.reduce(
        (sum, slot) => sum + minutesBetween(slot.startsAt, slot.endsAt),
        0,
      );

      return {
        staffId: member.id,
        employeeId: member.employeeId,
        staffName: `${member.firstName} ${member.lastName}`.trim(),
        slotCount: member.timetableSlots.length,
        homeworkCount: member.homeworkAssignments.length,
        teachingMinutes,
        weeklyHours: Math.round((teachingMinutes / 60) * 10) / 10,
        slots: member.timetableSlots,
      };
    });
  }

  async createTimetableSlot(dto: CreateTimetableSlotDto, actor: AuthContext) {
    if (dto.startsAt >= dto.endsAt) {
      throw new ConflictException('Start time must be before end time');
    }

    await this.ensureScheduleRefs(actor, dto);

    const conflicts = await this.prisma.timetableSlot.findMany({
      where: {
        tenantId: actor.tenantId,
        academicYearId: dto.academicYearId,
        dayOfWeek: dto.dayOfWeek,
        OR: [
          { staffId: dto.staffId },
          {
            classId: dto.classId,
            sectionId: dto.sectionId ?? null,
          },
        ],
      },
    });

    const overlapping = conflicts.find((slot) =>
      timesOverlap(dto.startsAt, dto.endsAt, slot.startsAt, slot.endsAt),
    );

    if (overlapping) {
      throw new ConflictException(
        `Timetable conflict with ${overlapping.startsAt}-${overlapping.endsAt}`,
      );
    }

    const slot = await this.prisma.timetableSlot.create({
      data: {
        tenantId: actor.tenantId,
        academicYearId: dto.academicYearId,
        classId: dto.classId,
        sectionId: dto.sectionId ?? null,
        subjectId: dto.subjectId,
        staffId: dto.staffId,
        dayOfWeek: dto.dayOfWeek,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
        room: dto.room ?? null,
      },
      include: {
        class: true,
        section: true,
        subject: true,
        staff: true,
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'timetable_slot',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: slot.id,
      after: {
        classId: slot.classId,
        subjectId: slot.subjectId,
        staffId: slot.staffId,
        dayOfWeek: slot.dayOfWeek,
      },
    });

    return slot;
  }

  async listHomework(
    actor: AuthContext,
    filters: { studentId?: string; classId?: string; sectionId?: string } = {},
  ) {
    return this.prisma.homeworkAssignment.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(filters.classId ? { classId: filters.classId } : {}),
        ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
        ...(filters.studentId
          ? { submissions: { some: { studentId: filters.studentId } } }
          : {}),
      },
      include: {
        academicYear: true,
        class: true,
        section: true,
        subject: true,
        assignedByStaff: true,
        submissions: {
          include: {
            student: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    });
  }

  async processHomeworkReminders(actor: AuthContext) {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const assignments = await this.prisma.homeworkAssignment.findMany({
      where: {
        tenantId: actor.tenantId,
        dueAt: { lte: tomorrow },
      },
      include: {
        submissions: true,
      },
    });
    const results: Array<{ homeworkId: string; deliveryCount: number }> = [];

    for (const assignment of assignments) {
      const pendingSubmissions = assignment.submissions.filter(
        (submission) =>
          submission.status === HomeworkStatus.ASSIGNED ||
          submission.status === HomeworkStatus.LATE,
      );

      if (pendingSubmissions.length === 0) {
        continue;
      }

      if (assignment.dueAt < now) {
        await this.prisma.homeworkSubmission.updateMany({
          where: {
            tenantId: actor.tenantId,
            homeworkId: assignment.id,
            status: HomeworkStatus.ASSIGNED,
          },
          data: { status: HomeworkStatus.LATE },
        });
      }

      const delivery = await this.communicationsService.recordDeliveryRecords({
        actor,
        sourceType: 'homework_reminder',
        sourceId: assignment.id,
        audienceType: assignment.sectionId
          ? AudienceType.SECTION
          : AudienceType.CLASS,
        classId: assignment.classId,
        sectionId: assignment.sectionId,
        studentIds: pendingSubmissions.map(
          (submission) => submission.studentId,
        ),
        title:
          assignment.dueAt < now ? 'Homework overdue' : 'Homework due tomorrow',
        body: assignment.title,
        channels: [NotificationChannel.PUSH, NotificationChannel.SMS],
      });

      results.push({
        homeworkId: assignment.id,
        deliveryCount: delivery.count,
      });
    }

    await this.auditService.record({
      action: 'process',
      resource: 'homework_reminders',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: { processed: results.length },
    });

    return { processed: results.length, results };
  }

  async createHomework(dto: CreateHomeworkDto, actor: AuthContext) {
    const actorStaffId = await this.resolveActorStaffId(actor);
    const assignedByStaffId = this.resolveHomeworkAssignee(
      dto,
      actorStaffId,
      actor,
    );

    await this.ensureScheduleRefs(actor, {
      academicYearId: dto.academicYearId,
      classId: dto.classId,
      sectionId: dto.sectionId,
      subjectId: dto.subjectId,
      staffId: assignedByStaffId,
    });
    await this.ensureSubjectTeacherHomeworkScope(
      actor,
      dto.subjectId,
      actorStaffId,
    );

    const students = await this.prisma.student.findMany({
      where: {
        tenantId: actor.tenantId,
        classId: dto.classId,
        ...(dto.sectionId ? { sectionId: dto.sectionId } : {}),
      },
      select: { id: true },
    });

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
        dueAt: new Date(dto.dueAt),
        maxScore:
          dto.maxScore === undefined ? null : new Prisma.Decimal(dto.maxScore),
        submissions: {
          create: students.map((student) => ({
            tenantId: actor.tenantId,
            studentId: student.id,
          })),
        },
      },
      include: {
        class: true,
        section: true,
        subject: true,
        submissions: true,
      },
    });

    await this.communicationsService.recordDeliveryRecords({
      actor,
      sourceType: 'homework',
      sourceId: assignment.id,
      audienceType: dto.sectionId ? AudienceType.SECTION : AudienceType.CLASS,
      classId: dto.classId,
      sectionId: dto.sectionId ?? null,
      title: `Homework: ${assignment.title}`,
      body: assignment.instructions,
      channels: [NotificationChannel.PUSH],
    });

    this.eventEmitter.emit('homework.assigned', {
      tenantId: actor.tenantId,
      classId: assignment.classId,
      sectionId: assignment.sectionId ?? undefined,
      homeworkId: assignment.id,
      title: assignment.title,
      actor,
    });

    await this.auditService.record({
      action: 'create',
      resource: 'homework_assignment',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: assignment.id,
      after: {
        classId: assignment.classId,
        sectionId: assignment.sectionId,
        submissionCount: assignment.submissions.length,
      },
    });

    return assignment;
  }

  async listHomeworkSubmissions(actor: AuthContext) {
    const studentId = await this.resolveActorStudentId(actor);

    return this.prisma.homeworkSubmission.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(studentId ? { studentId } : {}),
      },
      include: {
        homework: {
          include: {
            subject: true,
            assignedByStaff: true,
          },
        },
        student: true,
        attachments: {
          include: {
            fileAsset: true,
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 100,
    });
  }

  async reviewHomeworkSubmission(
    dto: ReviewHomeworkSubmissionDto,
    actor: AuthContext,
  ) {
    const submission = await this.prisma.homeworkSubmission.findFirst({
      where: { id: dto.submissionId, tenantId: actor.tenantId },
      include: { homework: true },
    });

    if (!submission) {
      throw new NotFoundException('Homework submission not found');
    }
    await this.ensureSubjectTeacherHomeworkScope(
      actor,
      submission.homework.subjectId,
      await this.resolveActorStaffId(actor),
    );

    const updated = await this.prisma.homeworkSubmission.update({
      where: { id: submission.id },
      data: {
        status: dto.status,
        score: dto.score === undefined ? null : new Prisma.Decimal(dto.score),
        feedback: dto.feedback ?? null,
        submittedAt:
          dto.status === 'SUBMITTED' || dto.status === 'REVIEWED'
            ? (submission.submittedAt ?? new Date())
            : submission.submittedAt,
      },
      include: {
        homework: true,
        student: true,
      },
    });

    await this.auditService.record({
      action: 'review',
      resource: 'homework_submission',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      after: {
        status: updated.status,
        score: dto.score ?? null,
        homeworkId: updated.homeworkId,
      },
    });

    return updated;
  }

  async submitHomework(dto: SubmitHomeworkDto, actor: AuthContext) {
    const studentId = await this.resolveActorStudentId(actor);

    if (!studentId) {
      throw new ForbiddenException('Student profile not found');
    }

    const submission = await this.prisma.homeworkSubmission.findFirst({
      where: {
        id: dto.submissionId,
        tenantId: actor.tenantId,
        studentId,
      },
    });

    if (!submission) {
      throw new NotFoundException('Homework submission not found');
    }

    if (
      submission.status === HomeworkStatus.REVIEWED ||
      submission.status === HomeworkStatus.SUBMITTED
    ) {
      throw new ConflictException('Homework already submitted or reviewed');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const submissionUpdate = await tx.homeworkSubmission.update({
        where: { id: submission.id },
        data: {
          status: HomeworkStatus.SUBMITTED,
          submissionContent: dto.content ?? null,
          submittedAt: new Date(),
        },
        include: {
          homework: {
            include: {
              subject: true,
            },
          },
        },
      });

      if (dto.attachmentIds && dto.attachmentIds.length > 0) {
        await tx.homeworkAttachment.createMany({
          data: dto.attachmentIds.map((fileAssetId) => ({
            tenantId: actor.tenantId,
            submissionId: submission.id,
            fileAssetId,
          })),
        });
      }

      return submissionUpdate;
    });

    await this.auditService.record({
      action: 'submit',
      resource: 'homework_submission',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      after: {
        homeworkId: updated.homeworkId,
        studentId: updated.studentId,
        attachmentCount: dto.attachmentIds?.length ?? 0,
      },
    });

    return updated;
  }

  private resolveHomeworkAssignee(
    dto: CreateHomeworkDto,
    actorStaffId: string | null,
    actor: AuthContext,
  ) {
    if (this.isScopedSubjectTeacher(actor)) {
      if (!actorStaffId) {
        throw new ForbiddenException('Subject teacher staff profile not found');
      }

      return actorStaffId;
    }

    return dto.assignedByStaffId ?? actorStaffId;
  }

  private async ensureSubjectTeacherHomeworkScope(
    actor: AuthContext,
    subjectId: string,
    actorStaffId: string | null,
  ) {
    if (!this.isScopedSubjectTeacher(actor)) {
      return;
    }

    if (!actorStaffId) {
      throw new ForbiddenException('Subject teacher staff profile not found');
    }

    const assignment = await this.prisma.subjectTeacherAssignment.findFirst({
      where: {
        tenantId: actor.tenantId,
        subjectId,
        staffId: actorStaffId,
      },
    });

    if (!assignment) {
      throw new ForbiddenException('You are not assigned to this subject');
    }
  }

  private async resolveActorStaffId(actor: AuthContext) {
    const staff = await this.prisma.staff.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
      select: { id: true },
    });

    return staff?.id ?? null;
  }

  private async resolveActorStudentId(actor: AuthContext) {
    const student = await this.prisma.student.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
      select: { id: true },
    });

    return student?.id ?? null;
  }

  private isScopedSubjectTeacher(actor: AuthContext) {
    return (
      actor.roles.includes('subject_teacher') &&
      !actor.roles.some((role) =>
        ['super_admin', 'admin', 'principal'].includes(role),
      )
    );
  }

  private async ensureScheduleRefs(
    actor: AuthContext,
    dto: {
      academicYearId: string;
      classId: string;
      sectionId?: string | null;
      subjectId: string;
      staffId?: string | null;
    },
  ) {
    const [year, classroom, subject, staff] = await Promise.all([
      this.prisma.academicYear.findFirst({
        where: { id: dto.academicYearId, tenantId: actor.tenantId },
      }),
      this.prisma.class.findFirst({
        where: { id: dto.classId, tenantId: actor.tenantId },
      }),
      this.prisma.subject.findFirst({
        where: {
          id: dto.subjectId,
          tenantId: actor.tenantId,
          classId: dto.classId,
        },
      }),
      dto.staffId
        ? this.prisma.staff.findFirst({
            where: { id: dto.staffId, tenantId: actor.tenantId },
          })
        : Promise.resolve(null),
    ]);

    if (!year) {
      throw new NotFoundException('Academic year not found');
    }

    if (!classroom) {
      throw new NotFoundException('Class not found');
    }

    if (!subject) {
      throw new NotFoundException('Subject not found for this class');
    }

    if (dto.staffId && !staff) {
      throw new NotFoundException('Staff member not found');
    }

    if (dto.sectionId) {
      const section = await this.prisma.section.findFirst({
        where: {
          id: dto.sectionId,
          tenantId: actor.tenantId,
          classId: dto.classId,
        },
      });

      if (!section) {
        throw new NotFoundException('Section not found for this class');
      }
    }
  }
}

export function timesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
) {
  return startA < endB && endA > startB;
}

export function minutesBetween(startsAt: string, endsAt: string) {
  const [startHour = 0, startMinute = 0] = startsAt.split(':').map(Number);
  const [endHour = 0, endMinute = 0] = endsAt.split(':').map(Number);

  return Math.max(0, endHour * 60 + endMinute - (startHour * 60 + startMinute));
}
