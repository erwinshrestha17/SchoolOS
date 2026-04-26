import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AudienceType, NotificationChannel, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from '../communications/communications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHomeworkDto } from './dto/create-homework.dto';
import { CreateTimetableSlotDto } from './dto/create-timetable-slot.dto';
import { ReviewHomeworkSubmissionDto } from './dto/review-homework-submission.dto';

@Injectable()
export class TimetableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly communicationsService: CommunicationsService,
    private readonly auditService: AuditService,
  ) {}

  async listTimetable(actor: AuthContext) {
    return this.prisma.timetableSlot.findMany({
      where: { tenantId: actor.tenantId },
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

  async listHomework(actor: AuthContext) {
    return this.prisma.homeworkAssignment.findMany({
      where: { tenantId: actor.tenantId },
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

  async createHomework(dto: CreateHomeworkDto, actor: AuthContext) {
    await this.ensureScheduleRefs(actor, {
      academicYearId: dto.academicYearId,
      classId: dto.classId,
      sectionId: dto.sectionId,
      subjectId: dto.subjectId,
      staffId: dto.assignedByStaffId,
    });

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
        assignedByStaffId: dto.assignedByStaffId ?? null,
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
    return this.prisma.homeworkSubmission.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        homework: {
          include: {
            subject: true,
          },
        },
        student: true,
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
    });

    if (!submission) {
      throw new NotFoundException('Homework submission not found');
    }

    return this.prisma.homeworkSubmission.update({
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
