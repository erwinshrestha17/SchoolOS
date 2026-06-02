import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AudienceType,
  ConsentType,
  NotificationChannel,
  TimetableSubstitutionStatus,
  TimetableVersionStatus,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from '../communications/communications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceService } from '../attendance/attendance.service';
import { TimetableLifecycleService } from './timetable-lifecycle.service';
import {
  AssignSubstitutionDto,
  CreateSubstitutionDto,
  SubstitutionQueryDto,
  UpdateSubstitutionDto,
} from './dto/timetable-setup.dto';
import { toTimetableDayOfWeek } from './timetable-calendar';

@Injectable()
export class TimetableSubstitutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly communicationsService: CommunicationsService,
    private readonly auditService: AuditService,
    private readonly lifecycleService: TimetableLifecycleService,
    private readonly attendanceService: AttendanceService,
  ) {}

  async listSubstitutions(actor: AuthContext, query: SubstitutionQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 100);
    const date = query.date ? parseDate(query.date, 'date') : null;

    return this.prisma.timetableSubstitution.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(date ? { date } : {}),
        ...(query.teacherId
          ? {
              OR: [
                { absentTeacherId: query.teacherId },
                { substituteTeacherId: query.teacherId },
              ],
            }
          : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.classId || query.sectionId
          ? {
              timetableSlot: {
                ...(query.classId ? { classId: query.classId } : {}),
                ...(query.sectionId ? { sectionId: query.sectionId } : {}),
              },
            }
          : {}),
      },
      include: substitutionInclude(),
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async getDailySubstitutionSummary(dateStr: string, actor: AuthContext) {
    const date = stripTime(parseDate(dateStr, 'date'));
    const dayOfWeek = toTimetableDayOfWeek(date);

    // 1. Fetch all slots for this day of week from PUBLISHED/LOCKED versions
    const slots = await this.prisma.timetableSlot.findMany({
      where: {
        tenantId: actor.tenantId,
        dayOfWeek,
        version: {
          status: {
            in: [
              TimetableVersionStatus.PUBLISHED,
              TimetableVersionStatus.LOCKED,
            ],
          },
        },
      },
      include: timetableSlotInclude(),
    });

    // 2. Fetch existing substitutions for this date
    const existingSubstitutions =
      await this.prisma.timetableSubstitution.findMany({
        where: {
          tenantId: actor.tenantId,
          date,
          status: { not: TimetableSubstitutionStatus.CANCELLED },
        },
      });

    const substitutionBySlotId = new Map(
      existingSubstitutions.map((s) => [s.timetableSlotId, s]),
    );

    // 3. For each slot, check if teacher is absent
    const results = await Promise.all(
      slots.map(async (slot) => {
        const absenceContext = await this.getTeacherAbsenceContext(
          actor,
          slot.staffId,
          date,
        );
        const existing = substitutionBySlotId.get(slot.id);

        return {
          slotId: slot.id,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          subjectName: slot.subject.name,
          className: slot.class.name,
          sectionName: slot.section?.name ?? null,
          originalTeacherId: slot.staffId,
          originalTeacherName: `${slot.staff.firstName} ${slot.staff.lastName}`,
          isTeacherAbsent: absenceContext.isAbsent,
          absenceReason:
            absenceContext.leaveType ?? absenceContext.attendanceStatus ?? null,
          hasSubstitution: !!existing,
          substitutionStatus: existing?.status ?? null,
          substituteTeacherId: existing?.substituteTeacherId ?? null,
          needsAction: absenceContext.isAbsent && !existing,
        };
      }),
    );

    return {
      date: date.toISOString(),
      totalSlots: results.length,
      absentSlots: results.filter((r) => r.isTeacherAbsent).length,
      needsSubstitution: results.filter((r) => r.needsAction).length,
      slots: results,
    };
  }

  async createSubstitution(dto: CreateSubstitutionDto, actor: AuthContext) {
    const date = stripTime(parseDate(dto.date, 'date'));
    const slot = await this.findSlotOrThrow(dto.timetableSlotId, actor);

    // 1. Validation: Slot version status
    if (
      !slot.version ||
      !(
        [
          TimetableVersionStatus.PUBLISHED,
          TimetableVersionStatus.LOCKED,
        ] as TimetableVersionStatus[]
      ).includes(slot.version.status)
    ) {
      throw new ConflictException(
        'Substitutions can only be created for PUBLISHED or LOCKED timetable versions',
      );
    }

    // 2. Validation: Date matches day of week
    if (toTimetableDayOfWeek(date) !== slot.dayOfWeek) {
      throw new ConflictException(
        `Substitution date ${dto.date} does not fall on the slot's day of week (${slot.dayOfWeek})`,
      );
    }

    // 3. Validation: Absent teacher check
    await this.ensureStaff(actor, dto.absentTeacherId);
    if (slot.staffId !== dto.absentTeacherId) {
      throw new ConflictException(
        'Absent teacher must match the original teacher assigned to this slot',
      );
    }

    // 4. Validation: No duplicate active substitutions
    const existing = await this.prisma.timetableSubstitution.findFirst({
      where: {
        tenantId: actor.tenantId,
        timetableSlotId: dto.timetableSlotId,
        date,
        status: {
          in: [
            TimetableSubstitutionStatus.DRAFT,
            TimetableSubstitutionStatus.ASSIGNED,
          ],
        },
      },
    });
    if (existing) {
      throw new ConflictException(
        'An active substitution already exists for this slot and date',
      );
    }

    // 5. Validation: Absence/Leave check (Warning/Context)
    const absenceContext = await this.getTeacherAbsenceContext(
      actor,
      dto.absentTeacherId,
      date,
    );

    if (dto.substituteTeacherId) {
      await this.ensureSubstituteAllowed(
        slot,
        dto.substituteTeacherId,
        date,
        actor,
      );
    }

    const substitution = await this.prisma.timetableSubstitution.create({
      data: {
        tenantId: actor.tenantId,
        timetableSlotId: dto.timetableSlotId,
        absentTeacherId: dto.absentTeacherId,
        substituteTeacherId: dto.substituteTeacherId ?? null,
        date,
        reason: dto.reason,
        status: dto.substituteTeacherId
          ? TimetableSubstitutionStatus.ASSIGNED
          : TimetableSubstitutionStatus.DRAFT,
        createdById: actor.userId,
        assignedAt: dto.substituteTeacherId ? new Date() : null,
        approvedById: dto.substituteTeacherId ? actor.userId : null,
      },
      include: substitutionInclude(),
    });

    await this.audit(
      'create',
      'timetable_substitution',
      substitution.id,
      actor,
      {
        ...substitution,
        absenceContext,
      },
    );

    if (substitution.status === TimetableSubstitutionStatus.ASSIGNED) {
      await this.notifySubstitution(
        substitution.id,
        'substitution_assigned',
        actor,
      );
    }

    return substitution;
  }

  async updateSubstitution(
    id: string,
    dto: UpdateSubstitutionDto,
    actor: AuthContext,
  ) {
    const substitution = await this.findSubstitutionOrThrow(id, actor);

    if (substitution.status !== TimetableSubstitutionStatus.DRAFT) {
      throw new ConflictException(
        'Only DRAFT substitutions can be modified. Use the assign endpoint for assignment updates.',
      );
    }

    if (dto.substituteTeacherId) {
      await this.ensureSubstituteAllowed(
        substitution.timetableSlot,
        dto.substituteTeacherId,
        substitution.date,
        actor,
      );
    }

    const updated = await this.prisma.timetableSubstitution.update({
      where: { id },
      data: {
        substituteTeacherId:
          dto.substituteTeacherId ?? substitution.substituteTeacherId,
        reason: dto.reason ?? substitution.reason,
        status: dto.substituteTeacherId
          ? TimetableSubstitutionStatus.ASSIGNED
          : TimetableSubstitutionStatus.DRAFT,
        assignedAt: dto.substituteTeacherId ? new Date() : null,
        approvedById: dto.substituteTeacherId ? actor.userId : null,
      },
      include: substitutionInclude(),
    });

    await this.audit('update', 'timetable_substitution', id, actor, updated);

    if (updated.status === TimetableSubstitutionStatus.ASSIGNED) {
      await this.notifySubstitution(id, 'substitution_assigned', actor);
    }

    return updated;
  }

  async assignSubstitution(
    id: string,
    dto: AssignSubstitutionDto,
    actor: AuthContext,
  ) {
    const substitution = await this.findSubstitutionOrThrow(id, actor);

    if (
      substitution.status === TimetableSubstitutionStatus.CANCELLED ||
      substitution.status === TimetableSubstitutionStatus.COMPLETED
    ) {
      throw new ConflictException(
        `Cannot assign a substitution that is already ${substitution.status}`,
      );
    }

    await this.ensureSubstituteAllowed(
      substitution.timetableSlot,
      dto.substituteTeacherId,
      substitution.date,
      actor,
    );

    const updated = await this.prisma.timetableSubstitution.update({
      where: { id },
      data: {
        substituteTeacherId: dto.substituteTeacherId,
        status: TimetableSubstitutionStatus.ASSIGNED,
        assignedAt: new Date(),
        approvedById: actor.userId,
      },
      include: substitutionInclude(),
    });

    await this.audit('assign', 'timetable_substitution', id, actor, updated);
    await this.notifySubstitution(id, 'substitution_assigned', actor);

    return updated;
  }

  async cancelSubstitution(id: string, actor: AuthContext) {
    const substitution = await this.findSubstitutionOrThrow(id, actor);
    if (substitution.status === TimetableSubstitutionStatus.COMPLETED) {
      throw new ConflictException('Cannot cancel a completed substitution');
    }
    if (substitution.status === TimetableSubstitutionStatus.CANCELLED) {
      return substitution;
    }

    const updated = await this.prisma.timetableSubstitution.update({
      where: { id },
      data: {
        status: TimetableSubstitutionStatus.CANCELLED,
        cancelledAt: new Date(),
      },
      include: substitutionInclude(),
    });
    await this.audit('cancel', 'timetable_substitution', id, actor, updated);
    await this.notifySubstitution(id, 'substitution_cancelled', actor);
    return updated;
  }

  async completeSubstitution(id: string, actor: AuthContext) {
    const substitution = await this.findSubstitutionOrThrow(id, actor);
    if (substitution.status !== TimetableSubstitutionStatus.ASSIGNED) {
      throw new ConflictException(
        'Only ASSIGNED substitutions can be marked as COMPLETED',
      );
    }

    const updated = await this.prisma.timetableSubstitution.update({
      where: { id },
      data: {
        status: TimetableSubstitutionStatus.COMPLETED,
        completedAt: new Date(),
      },
      include: substitutionInclude(),
    });
    await this.audit('complete', 'timetable_substitution', id, actor, updated);
    return updated;
  }

  private async ensureSubstituteAllowed(
    slot: {
      id: string;
      staffId: string;
      academicYearId: string;
      dayOfWeek: number;
      startsAt: string;
      endsAt: string;
    },
    substituteTeacherId: string,
    date: Date,
    actor: AuthContext,
  ) {
    const targetDate = stripTime(date);
    await this.ensureStaff(actor, substituteTeacherId);
    if (substituteTeacherId === slot.staffId) {
      throw new ConflictException(
        'Substitute teacher cannot be the absent teacher',
      );
    }

    // Check for leave/absence of the substitute teacher
    const absenceContext = await this.getTeacherAbsenceContext(
      actor,
      substituteTeacherId,
      targetDate,
    );
    if (absenceContext.isAbsent) {
      throw new ConflictException(
        `Substitute teacher is unavailable on ${date.toDateString()} due to ${
          absenceContext.leaveType ? 'leave' : 'absence'
        }`,
      );
    }

    // Check for timetable conflicts (double booking, unavailability)
    const validation = await this.lifecycleService.validateCandidateSlot(
      actor,
      {
        id: `substitution:${slot.id}`,
        tenantId: actor.tenantId,
        versionId: null,
        academicYearId: slot.academicYearId,
        classId: '',
        sectionId: null,
        subjectId: '',
        staffId: substituteTeacherId,
        roomId: null,
        dayOfWeek: slot.dayOfWeek,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
      },
    );

    // Check for existing assigned substitutions for this substitute teacher at the same time
    const sameTimeSubstitution =
      await this.prisma.timetableSubstitution.findFirst({
        where: {
          tenantId: actor.tenantId,
          substituteTeacherId,
          date: targetDate,
          status: TimetableSubstitutionStatus.ASSIGNED,
          timetableSlot: {
            dayOfWeek: slot.dayOfWeek,
            startsAt: { lt: slot.endsAt },
            endsAt: { gt: slot.startsAt },
          },
        },
      });

    if (!validation.valid || sameTimeSubstitution) {
      throw new ConflictException(
        validation.errors[0]?.message ??
          'Substitute teacher has a conflicting timetable assignment or substitution',
      );
    }
  }

  private async getTeacherAbsenceContext(
    actor: AuthContext,
    teacherId: string,
    date: Date,
  ) {
    try {
      return await this.attendanceService.getTeacherAbsenceContext(
        actor.tenantId,
        teacherId,
        date,
      );
    } catch {
      // Fallback if attendance service fails or has issues
      return { isAbsent: false, attendanceStatus: null, leaveType: null };
    }
  }

  private async notifySubstitution(
    substitutionId: string,
    sourceType: string,
    actor: AuthContext,
  ) {
    const substitution = await this.findSubstitutionOrThrow(
      substitutionId,
      actor,
    );
    const substituteName = substitution.substituteTeacher
      ? `${substitution.substituteTeacher.firstName} ${substitution.substituteTeacher.lastName}`
      : 'a substitute teacher';

    // Notify Class/Section
    await this.communicationsService.recordDeliveryRecords({
      actor,
      sourceType,
      sourceId: `${substitutionId}:${sourceType}:class`,
      audienceType: substitution.timetableSlot.sectionId
        ? AudienceType.SECTION
        : AudienceType.CLASS,
      classId: substitution.timetableSlot.classId,
      sectionId: substitution.timetableSlot.sectionId,
      title:
        sourceType === 'substitution_cancelled'
          ? 'Class Substitution Update'
          : 'New Substitute Teacher',
      body: `Your ${substitution.timetableSlot.subject.name} class on ${substitution.date.toLocaleDateString('en-NP')} will be handled by ${substituteName}.`,
      channels: [NotificationChannel.PUSH],
      requiredConsentTypes: [ConsentType.MESSAGING],
    });

    // Notify Substitute Teacher
    if (substitution.substituteTeacherId) {
      await this.communicationsService.recordDeliveryRecords({
        actor,
        sourceType,
        sourceId: `${substitutionId}:${sourceType}:teacher`,
        audienceType: AudienceType.ALL,
        staffIds: [substitution.substituteTeacherId],
        title:
          sourceType === 'substitution_cancelled'
            ? 'Substitution Cancelled'
            : 'New Substitution Assigned',
        body: `You have been assigned as a substitute for ${substitution.timetableSlot.subject.name} (${substitution.timetableSlot.class.name}${substitution.timetableSlot.section ? ' ' + substitution.timetableSlot.section.name : ''}) on ${substitution.date.toLocaleDateString('en-NP')} at ${substitution.timetableSlot.startsAt}.`,
        channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
        requiredConsentTypes: [ConsentType.MESSAGING],
      });
    }
  }

  private async findSubstitutionOrThrow(id: string, actor: AuthContext) {
    const substitution = await this.prisma.timetableSubstitution.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: substitutionInclude(),
    });
    if (!substitution) throw new NotFoundException('Substitution not found');
    return substitution;
  }

  private async findSlotOrThrow(id: string, actor: AuthContext) {
    const slot = await this.prisma.timetableSlot.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: {
        version: true,
      },
    });
    if (!slot) throw new NotFoundException('Timetable slot not found');
    return slot;
  }

  private async ensureStaff(actor: AuthContext, staffId: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId: actor.tenantId },
    });
    if (!staff) throw new NotFoundException('Staff member not found');
    return staff;
  }

  private async audit(
    action: string,
    resource: string,
    resourceId: string,
    actor: AuthContext,
    after: unknown,
  ) {
    await this.auditService.record({
      action,
      resource,
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId,
      after,
    });
  }
}

function stripTime(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDate(value: string, fieldName: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ConflictException(`${fieldName} must be a valid date`);
  }
  return parsed;
}

function timetableSlotInclude() {
  return {
    academicYear: true,
    class: true,
    section: true,
    subject: true,
    staff: true,
    period: true,
    roomRef: true,
    version: true,
  } satisfies Prisma.TimetableSlotInclude;
}

function substitutionInclude() {
  return {
    timetableSlot: { include: timetableSlotInclude() },
    absentTeacher: true,
    substituteTeacher: true,
  } satisfies Prisma.TimetableSubstitutionInclude;
}
