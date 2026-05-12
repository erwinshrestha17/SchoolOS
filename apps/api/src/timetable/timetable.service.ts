import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AudienceType,
  ConsentType,
  NotificationChannel,
  TeacherAvailabilityType,
  TimetableSubstitutionStatus,
  TimetableVersionStatus,
  TeacherWorkloadLimit,
  Prisma,
} from '@prisma/client';
import {
  ConflictSlotInput,
} from './timetable-conflict.service';
import { TimetableLifecycleService } from './timetable-lifecycle.service';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from '../communications/communications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceService } from '../attendance/attendance.service';
import { CreateTimetableSlotDto } from './dto/create-timetable-slot.dto';
import {
  AssignSubstitutionDto,
  CreateRoomDto,
  CreateSubstitutionDto,
  CreateTimetablePeriodDto,
  CreateTimetableVersionDto,
  CreateVersionSlotDto,
  SubstitutionQueryDto,
  TeacherAvailabilityDto,
  TimetableVersionQueryDto,
  UpdateRoomDto,
  UpdateSubstitutionDto,
  UpdateTimetablePeriodDto,
  UpdateVersionSlotDto,
  WorkloadQueryDto,
  ListTeacherAvailabilityQueryDto,
  ListTeacherWorkloadQueryDto,
  ListSubjectWeeklyRequirementQueryDto,
  UpsertTeacherWorkloadLimitDto,
  CreateSubjectWeeklyRequirementDto,
  UpdateSubjectWeeklyRequirementDto,
  UpdateTeacherAvailabilityDto,
} from './dto/timetable-setup.dto';

@Injectable()
export class TimetableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly communicationsService: CommunicationsService,
    private readonly auditService: AuditService,
    private readonly lifecycleService: TimetableLifecycleService,
    private readonly attendanceService: AttendanceService,
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
      const link = await this.prisma.studentGuardian.findFirst({
        where: {
          tenantId: actor.tenantId,
          guardian: { userId: actor.userId },
        },
        include: { student: true },
      });
      effectiveClassId = link?.student.classId;
    }

    return this.prisma.timetableSlot.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(effectiveClassId ? { classId: effectiveClassId } : {}),
        OR: [
          { versionId: null },
          {
            version: {
              status: {
                in: [
                  TimetableVersionStatus.PUBLISHED,
                  TimetableVersionStatus.LOCKED,
                ],
              },
            },
          },
        ],
      },
      include: timetableSlotInclude(),
      orderBy: [{ dayOfWeek: 'asc' }, { startsAt: 'asc' }],
      take: 200,
    });
  }

  async listPeriods(actor: AuthContext, academicYearId?: string) {
    return this.prisma.timetablePeriod.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(academicYearId ? { academicYearId } : {}),
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { sortOrder: 'asc' },
        { startsAt: 'asc' },
      ],
      take: 100,
    });
  }

  async createPeriod(dto: CreateTimetablePeriodDto, actor: AuthContext) {
    assertTimeRange(dto.startsAt, dto.endsAt);
    await this.ensureAcademicYear(actor, dto.academicYearId);
    const period = await this.prisma.timetablePeriod.create({
      data: {
        tenantId: actor.tenantId,
        academicYearId: dto.academicYearId,
        name: dto.name,
        dayOfWeek: dto.dayOfWeek ?? null,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    await this.audit('create', 'timetable_period', period.id, actor, period);
    return period;
  }

  async updatePeriod(
    id: string,
    dto: UpdateTimetablePeriodDto,
    actor: AuthContext,
  ) {
    const period = await this.findPeriodOrThrow(id, actor);
    const startsAt = dto.startsAt ?? period.startsAt;
    const endsAt = dto.endsAt ?? period.endsAt;
    assertTimeRange(startsAt, endsAt);
    const updated = await this.prisma.timetablePeriod.update({
      where: { id },
      data: {
        name: dto.name ?? period.name,
        dayOfWeek: dto.dayOfWeek ?? period.dayOfWeek,
        startsAt,
        endsAt,
        sortOrder: dto.sortOrder ?? period.sortOrder,
        isActive: dto.isActive ?? period.isActive,
      },
    });
    await this.audit('update', 'timetable_period', id, actor, updated);
    return updated;
  }

  async deletePeriod(id: string, actor: AuthContext) {
    await this.findPeriodOrThrow(id, actor);
    await this.prisma.timetablePeriod.delete({ where: { id } });
    await this.audit('delete', 'timetable_period', id, actor, { id });
    return { deleted: true, id };
  }

  async listRooms(actor: AuthContext) {
    return this.prisma.room.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      take: 100,
    });
  }

  async createRoom(dto: CreateRoomDto, actor: AuthContext) {
    const room = await this.prisma.room.create({
      data: {
        tenantId: actor.tenantId,
        name: dto.name,
        code: dto.code ?? null,
        capacity: dto.capacity ?? null,
      },
    });
    await this.audit('create', 'room', room.id, actor, room);
    return room;
  }

  async updateRoom(id: string, dto: UpdateRoomDto, actor: AuthContext) {
    const room = await this.findRoomOrThrow(id, actor);
    const updated = await this.prisma.room.update({
      where: { id },
      data: {
        name: dto.name ?? room.name,
        code: dto.code ?? room.code,
        capacity: dto.capacity ?? room.capacity,
        isActive: dto.isActive ?? room.isActive,
      },
    });
    await this.audit('update', 'room', id, actor, updated);
    return updated;
  }

  async deleteRoom(id: string, actor: AuthContext) {
    await this.findRoomOrThrow(id, actor);
    await this.prisma.room.delete({ where: { id } });
    await this.audit('delete', 'room', id, actor, { id });
    return { deleted: true, id };
  }

  async listVersions(actor: AuthContext, query: TimetableVersionQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 100);

    return this.prisma.timetableVersion.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(query.academicYearId
          ? { academicYearId: query.academicYearId }
          : {}),
        ...(query.classId ? { classId: query.classId } : {}),
        ...(query.sectionId ? { sectionId: query.sectionId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: {
        academicYear: true,
        class: true,
        section: true,
        slots: { include: timetableSlotInclude() },
      },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async createVersion(dto: CreateTimetableVersionDto, actor: AuthContext) {
    const effectiveFrom = parseDate(dto.effectiveFrom, 'effectiveFrom');
    const effectiveTo = dto.effectiveTo
      ? parseDate(dto.effectiveTo, 'effectiveTo')
      : null;
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new ConflictException('effectiveTo cannot be before effectiveFrom');
    }
    await this.ensureVersionRefs(
      actor,
      dto.academicYearId,
      dto.classId,
      dto.sectionId,
    );
    const version = await this.prisma.timetableVersion.create({
      data: {
        tenantId: actor.tenantId,
        academicYearId: dto.academicYearId,
        classId: dto.classId ?? null,
        sectionId: dto.sectionId ?? null,
        versionName: dto.versionName,
        effectiveFrom,
        effectiveTo,
      },
      include: {
        academicYear: true,
        class: true,
        section: true,
        slots: { include: timetableSlotInclude() },
      },
    });
    await this.audit('create', 'timetable_version', version.id, actor, version);
    return version;
  }

  async getVersion(id: string, actor: AuthContext) {
    return this.findVersionOrThrow(id, actor);
  }

  async createTimetableSlot(dto: CreateTimetableSlotDto, actor: AuthContext) {
    const version = await this.findOrCreateDraftVersion(actor, {
      academicYearId: dto.academicYearId,
      classId: dto.classId,
      sectionId: dto.sectionId ?? null,
    });
    return this.createVersionSlot(
      version.id,
      {
        classId: dto.classId,
        sectionId: dto.sectionId,
        subjectId: dto.subjectId,
        staffId: dto.staffId,
        dayOfWeek: dto.dayOfWeek,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
      },
      actor,
      dto.room,
    );
  }

  async createVersionSlot(
    versionId: string,
    dto: CreateVersionSlotDto,
    actor: AuthContext,
    legacyRoom?: string,
  ) {
    const version = await this.findVersionOrThrow(versionId, actor);
    this.ensureDraftVersion(version.status);
    assertTimeRange(dto.startsAt, dto.endsAt);
    await this.ensureSlotRefs(actor, version.academicYearId, dto);

    const candidate = {
      id: 'candidate',
      tenantId: actor.tenantId,
      versionId,
      academicYearId: version.academicYearId,
      classId: dto.classId,
      sectionId: dto.sectionId ?? null,
      subjectId: dto.subjectId,
      staffId: dto.staffId,
      periodId: dto.periodId ?? null,
      roomId: dto.roomId ?? null,
      dayOfWeek: dto.dayOfWeek,
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
      version,
    };
    const validation = await this.validateCandidateSlot(candidate, actor);
    if (!validation.valid) {
      throw new ConflictException(
        validation.errors[0]?.message ?? 'Timetable conflict',
      );
    }

    const slot = await this.prisma.timetableSlot.create({
      data: {
        tenantId: actor.tenantId,
        versionId,
        academicYearId: version.academicYearId,
        classId: dto.classId,
        sectionId: dto.sectionId ?? null,
        subjectId: dto.subjectId,
        staffId: dto.staffId,
        periodId: dto.periodId ?? null,
        roomId: dto.roomId ?? null,
        dayOfWeek: dto.dayOfWeek,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
        room: legacyRoom ?? null,
      },
      include: timetableSlotInclude(),
    });
    await this.audit('create', 'timetable_slot', slot.id, actor, {
      versionId,
      classId: slot.classId,
      staffId: slot.staffId,
      roomId: slot.roomId,
    });
    return slot;
  }

  async updateSlot(id: string, dto: UpdateVersionSlotDto, actor: AuthContext) {
    const slot = await this.findSlotOrThrow(id, actor);
    const version = slot.version;
    if (!version)
      throw new ConflictException(
        'Slot is not attached to a timetable version',
      );
    this.ensureDraftVersion(version.status);
    const updatedShape = {
      ...slot,
      subjectId: dto.subjectId ?? slot.subjectId,
      staffId: dto.staffId ?? slot.staffId,
      periodId: dto.periodId ?? slot.periodId,
      roomId: dto.roomId ?? slot.roomId,
      dayOfWeek: dto.dayOfWeek ?? slot.dayOfWeek,
      startsAt: dto.startsAt ?? slot.startsAt,
      endsAt: dto.endsAt ?? slot.endsAt,
      version,
    };
    assertTimeRange(updatedShape.startsAt, updatedShape.endsAt);
    await this.ensureSlotRefs(actor, slot.academicYearId, {
      classId: slot.classId,
      sectionId: slot.sectionId ?? undefined,
      subjectId: updatedShape.subjectId,
      staffId: updatedShape.staffId,
      periodId: updatedShape.periodId ?? undefined,
      roomId: updatedShape.roomId ?? undefined,
      dayOfWeek: updatedShape.dayOfWeek,
      startsAt: updatedShape.startsAt,
      endsAt: updatedShape.endsAt,
    });
    const validation = await this.validateCandidateSlot(updatedShape, actor);
    if (!validation.valid) {
      throw new ConflictException(
        validation.errors[0]?.message ?? 'Timetable conflict',
      );
    }
    const updated = await this.prisma.timetableSlot.update({
      where: { id },
      data: {
        subjectId: updatedShape.subjectId,
        staffId: updatedShape.staffId,
        periodId: updatedShape.periodId,
        roomId: updatedShape.roomId,
        dayOfWeek: updatedShape.dayOfWeek,
        startsAt: updatedShape.startsAt,
        endsAt: updatedShape.endsAt,
      },
      include: timetableSlotInclude(),
    });
    await this.audit('update', 'timetable_slot', id, actor, updated);
    return updated;
  }

  async deleteSlot(id: string, actor: AuthContext) {
    const slot = await this.findSlotOrThrow(id, actor);
    if (slot.version) this.ensureDraftVersion(slot.version.status);
    await this.prisma.timetableSlot.delete({ where: { id } });
    await this.audit('delete', 'timetable_slot', id, actor, { id });
    return { deleted: true, id };
  }

  async validateVersion(id: string, actor: AuthContext) {
    return this.lifecycleService.validateVersionForPublish(actor, id);
  }

  async publishVersion(id: string, actor: AuthContext) {
    const version = await this.findVersionOrThrow(id, actor);
    this.ensureDraftVersion(version.status);
    const validation = await this.validateVersion(id, actor);
    if (!validation.valid) {
      throw new ConflictException(
        validation.errors[0]?.message ?? 'Timetable validation failed',
      );
    }
    await this.ensureNoPublishedOverlap(version, actor);
    const updated = await this.prisma.timetableVersion.update({
      where: { id },
      data: {
        status: TimetableVersionStatus.PUBLISHED,
        publishedAt: new Date(),
        publishedById: actor.userId,
      },
      include: {
        academicYear: true,
        class: true,
        section: true,
        slots: { include: timetableSlotInclude() },
      },
    });
    await this.audit('publish', 'timetable_version', id, actor, {
      status: updated.status,
      slotCount: updated.slots.length,
    });
    await this.communicationsService.recordDeliveryRecords({
      actor,
      sourceType: 'timetable_published',
      sourceId: updated.id,
      audienceType: updated.sectionId
        ? AudienceType.SECTION
        : AudienceType.CLASS,
      classId: updated.classId,
      sectionId: updated.sectionId,
      title: 'Timetable published',
      body: `${updated.versionName} is now published in SchoolOS.`,
      channels: [NotificationChannel.PUSH],
      requiredConsentTypes: [ConsentType.MESSAGING],
    });
    return updated;
  }

  async lockVersion(id: string, actor: AuthContext) {
    const version = await this.findVersionOrThrow(id, actor);
    if (version.status !== TimetableVersionStatus.PUBLISHED) {
      throw new ConflictException(
        'Only published timetable versions can be locked',
      );
    }
    const updated = await this.prisma.timetableVersion.update({
      where: { id },
      data: {
        status: TimetableVersionStatus.LOCKED,
        lockedAt: new Date(),
        lockedById: actor.userId,
      },
    });
    await this.audit('lock', 'timetable_version', id, actor, updated);
    return updated;
  }

  async archiveVersion(id: string, actor: AuthContext) {
    const version = await this.findVersionOrThrow(id, actor);
    if (version.status === TimetableVersionStatus.ARCHIVED) return version;
    const updated = await this.prisma.timetableVersion.update({
      where: { id },
      data: {
        status: TimetableVersionStatus.ARCHIVED,
        archivedAt: new Date(),
        archivedById: actor.userId,
      },
    });
    await this.audit('archive', 'timetable_version', id, actor, updated);
    return updated;
  }

  async reopenVersion(id: string, actor: AuthContext) {
    const version = await this.findVersionOrThrow(id, actor);
    if (version.status !== TimetableVersionStatus.PUBLISHED) {
      throw new ConflictException(
        'Only published versions can be reopened safely',
      );
    }
    const updated = await this.prisma.timetableVersion.update({
      where: { id },
      data: { status: TimetableVersionStatus.DRAFT },
    });
    await this.audit('reopen_draft', 'timetable_version', id, actor, updated);
    return updated;
  }

  async listTeacherAvailability(
    actor: AuthContext,
    query: ListTeacherAvailabilityQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 100);

    return this.prisma.teacherAvailability.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(query.staffId ? { staffId: query.staffId } : {}),
        ...(query.academicYearId
          ? { academicYearId: query.academicYearId }
          : {}),
      },
      include: {
        staff: true,
        tenant: true,
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startsAt: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async getTeacherAvailability(teacherId: string, actor: AuthContext) {
    await this.ensureStaff(actor, teacherId);
    const [availability, limit] = await Promise.all([
      this.prisma.teacherAvailability.findMany({
        where: { tenantId: actor.tenantId, staffId: teacherId },
        orderBy: [{ dayOfWeek: 'asc' }, { startsAt: 'asc' }],
        take: 100,
      }),
      this.prisma.teacherWorkloadLimit.findFirst({
        where: { tenantId: actor.tenantId, staffId: teacherId },
      }),
    ]);
    return { availability, limit };
  }

  async createTeacherAvailability(
    teacherId: string,
    dto: TeacherAvailabilityDto,
    actor: AuthContext,
  ) {
    await this.ensureStaff(actor, teacherId);
    if (dto.academicYearId) {
      await this.ensureAcademicYear(actor, dto.academicYearId);
    }
    assertTimeRange(dto.startsAt, dto.endsAt);

    // Prevent duplicate identical availability windows
    const duplicate = await this.prisma.teacherAvailability.findFirst({
      where: {
        tenantId: actor.tenantId,
        staffId: teacherId,
        academicYearId: dto.academicYearId ?? null,
        dayOfWeek: dto.dayOfWeek,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
        type: dto.type ?? TeacherAvailabilityType.AVAILABLE,
      },
    });
    if (duplicate) {
      throw new ConflictException(
        'Identical availability window already exists',
      );
    }

    const availability = await this.prisma.teacherAvailability.create({
      data: {
        tenantId: actor.tenantId,
        staffId: teacherId,
        academicYearId: dto.academicYearId ?? null,
        dayOfWeek: dto.dayOfWeek,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
        type: dto.type ?? TeacherAvailabilityType.AVAILABLE,
        note: dto.note ?? null,
      },
    });
    await this.upsertWorkloadLimit(teacherId, dto, actor);
    await this.audit(
      'create',
      'teacher_availability',
      availability.id,
      actor,
      availability,
    );
    return availability;
  }

  async updateTeacherAvailability(
    id: string,
    dto: UpdateTeacherAvailabilityDto,
    actor: AuthContext,
  ) {
    const existing = await this.prisma.teacherAvailability.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!existing)
      throw new NotFoundException('Teacher availability not found');

    const startsAt = dto.startsAt ?? existing.startsAt;
    const endsAt = dto.endsAt ?? existing.endsAt;
    assertTimeRange(startsAt, endsAt);

    if (dto.academicYearId) {
      await this.ensureAcademicYear(actor, dto.academicYearId);
    }

    const updated = await this.prisma.teacherAvailability.update({
      where: { id },
      data: {
        academicYearId: dto.academicYearId ?? existing.academicYearId,
        dayOfWeek: dto.dayOfWeek ?? existing.dayOfWeek,
        startsAt,
        endsAt,
        type: dto.type ?? existing.type,
        note: dto.note ?? existing.note,
      },
    });

    if (dto instanceof TeacherAvailabilityDto) {
      await this.upsertWorkloadLimit(existing.staffId, dto, actor);
    }

    await this.audit('update', 'teacher_availability', id, actor, updated);
    return updated;
  }

  async deleteTeacherAvailability(id: string, actor: AuthContext) {
    const existing = await this.prisma.teacherAvailability.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!existing)
      throw new NotFoundException('Teacher availability not found');
    await this.prisma.teacherAvailability.delete({ where: { id } });
    await this.audit('delete', 'teacher_availability', id, actor, { id });
    return { deleted: true, id };
  }

  async listTeacherWorkloadRules(
    actor: AuthContext,
    query: ListTeacherWorkloadQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 100);

    return this.prisma.teacherWorkloadLimit.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(query.academicYearId
          ? { academicYearId: query.academicYearId }
          : {}),
      },
      include: {
        staff: true,
      },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async getTeacherWorkloadRule(
    teacherId: string,
    actor: AuthContext,
    academicYearId?: string,
  ) {
    await this.ensureStaff(actor, teacherId);
    return this.prisma.teacherWorkloadLimit.findFirst({
      where: {
        tenantId: actor.tenantId,
        staffId: teacherId,
        ...(academicYearId ? { academicYearId } : {}),
      },
    });
  }

  async upsertTeacherWorkloadRule(
    teacherId: string,
    dto: UpsertTeacherWorkloadLimitDto,
    actor: AuthContext,
  ) {
    await this.ensureStaff(actor, teacherId);
    if (dto.academicYearId) {
      await this.ensureAcademicYear(actor, dto.academicYearId);
    }

    if (dto.maxPeriodsPerDay && dto.maxPeriodsPerDay <= 0) {
      throw new ConflictException('maxPeriodsPerDay must be positive');
    }
    if (dto.maxPeriodsPerWeek && dto.maxPeriodsPerWeek <= 0) {
      throw new ConflictException('maxPeriodsPerWeek must be positive');
    }
    if (
      dto.maxPeriodsPerDay &&
      dto.maxPeriodsPerWeek &&
      dto.maxPeriodsPerWeek < dto.maxPeriodsPerDay
    ) {
      throw new ConflictException(
        'maxPeriodsPerWeek should not be less than maxPeriodsPerDay',
      );
    }

    const existing = await this.prisma.teacherWorkloadLimit.findFirst({
      where: {
        tenantId: actor.tenantId,
        staffId: teacherId,
        academicYearId: dto.academicYearId ?? null,
      },
    });

    let rule: TeacherWorkloadLimit;
    if (existing) {
      rule = await this.prisma.teacherWorkloadLimit.update({
        where: { id: existing.id },
        data: {
          maxPeriodsPerDay: dto.maxPeriodsPerDay ?? existing.maxPeriodsPerDay,
          maxPeriodsPerWeek:
            dto.maxPeriodsPerWeek ?? existing.maxPeriodsPerWeek,
        },
      });
      await this.audit(
        'update',
        'teacher_workload_limit',
        rule.id,
        actor,
        rule,
      );
    } else {
      rule = await this.prisma.teacherWorkloadLimit.create({
        data: {
          tenantId: actor.tenantId,
          staffId: teacherId,
          academicYearId: dto.academicYearId ?? null,
          maxPeriodsPerDay: dto.maxPeriodsPerDay ?? null,
          maxPeriodsPerWeek: dto.maxPeriodsPerWeek ?? null,
        },
      });
      await this.audit(
        'create',
        'teacher_workload_limit',
        rule.id,
        actor,
        rule,
      );
    }
    return rule;
  }

  async updateTeacherWorkloadRule(
    id: string,
    dto: UpsertTeacherWorkloadLimitDto,
    actor: AuthContext,
  ) {
    const existing = await this.prisma.teacherWorkloadLimit.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!existing) throw new NotFoundException('Workload rule not found');

    const updated = await this.prisma.teacherWorkloadLimit.update({
      where: { id },
      data: {
        maxPeriodsPerDay: dto.maxPeriodsPerDay ?? existing.maxPeriodsPerDay,
        maxPeriodsPerWeek: dto.maxPeriodsPerWeek ?? existing.maxPeriodsPerWeek,
      },
    });
    await this.audit('update', 'teacher_workload_limit', id, actor, updated);
    return updated;
  }

  async listSubjectWeeklyRequirements(
    actor: AuthContext,
    query: ListSubjectWeeklyRequirementQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 100);

    return this.prisma.subjectWeeklyRequirement.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(query.academicYearId
          ? { academicYearId: query.academicYearId }
          : {}),
        ...(query.classId ? { classId: query.classId } : {}),
        ...(query.sectionId ? { sectionId: query.sectionId } : {}),
        ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      },
      include: {
        academicYear: true,
        class: true,
        section: true,
        subject: true,
      },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async createSubjectWeeklyRequirement(
    dto: CreateSubjectWeeklyRequirementDto,
    actor: AuthContext,
  ) {
    await this.ensureAcademicYear(actor, dto.academicYearId);
    await this.ensureClass(actor, dto.classId);
    if (dto.sectionId) {
      await this.ensureSection(actor, dto.classId, dto.sectionId);
    }
    await this.ensureSubject(actor, dto.subjectId);

    if (dto.requiredPeriodsPerWeek <= 0) {
      throw new ConflictException('requiredPeriodsPerWeek must be positive');
    }

    const duplicate = await this.prisma.subjectWeeklyRequirement.findFirst({
      where: {
        tenantId: actor.tenantId,
        academicYearId: dto.academicYearId,
        classId: dto.classId,
        sectionId: dto.sectionId ?? null,
        subjectId: dto.subjectId,
      },
    });
    if (duplicate) {
      throw new ConflictException('Subject weekly requirement already exists');
    }

    const requirement = await this.prisma.subjectWeeklyRequirement.create({
      data: {
        tenantId: actor.tenantId,
        academicYearId: dto.academicYearId,
        classId: dto.classId,
        sectionId: dto.sectionId ?? null,
        subjectId: dto.subjectId,
        requiredPeriodsPerWeek: dto.requiredPeriodsPerWeek,
      },
    });
    await this.audit(
      'create',
      'subject_weekly_requirement',
      requirement.id,
      actor,
      requirement,
    );
    return requirement;
  }

  async updateSubjectWeeklyRequirement(
    id: string,
    dto: UpdateSubjectWeeklyRequirementDto,
    actor: AuthContext,
  ) {
    const existing = await this.prisma.subjectWeeklyRequirement.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!existing)
      throw new NotFoundException('Subject weekly requirement not found');

    if (
      dto.requiredPeriodsPerWeek !== undefined &&
      dto.requiredPeriodsPerWeek <= 0
    ) {
      throw new ConflictException('requiredPeriodsPerWeek must be positive');
    }

    const updated = await this.prisma.subjectWeeklyRequirement.update({
      where: { id },
      data: {
        requiredPeriodsPerWeek:
          dto.requiredPeriodsPerWeek ?? existing.requiredPeriodsPerWeek,
      },
    });
    await this.audit(
      'update',
      'subject_weekly_requirement',
      id,
      actor,
      updated,
    );
    return updated;
  }

  async deleteSubjectWeeklyRequirement(id: string, actor: AuthContext) {
    const existing = await this.prisma.subjectWeeklyRequirement.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!existing)
      throw new NotFoundException('Subject weekly requirement not found');
    await this.prisma.subjectWeeklyRequirement.delete({ where: { id } });
    await this.audit('delete', 'subject_weekly_requirement', id, actor, { id });
    return { deleted: true, id };
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
            roomRef: true,
            version: true,
          },
        },
        homeworkAssignments: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      take: 200, // Teacher workload can be larger but should be bounded
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

  async getTeacherWorkload(
    teacherId: string,
    query: WorkloadQueryDto,
    actor: AuthContext,
  ) {
    await this.ensureStaff(actor, teacherId);
    const slots = await this.prisma.timetableSlot.findMany({
      where: {
        tenantId: actor.tenantId,
        staffId: teacherId,
        ...(query.academicYearId
          ? { academicYearId: query.academicYearId }
          : {}),
        ...(query.versionId ? { versionId: query.versionId } : {}),
      },
      include: timetableSlotInclude(),
      orderBy: [{ dayOfWeek: 'asc' }, { startsAt: 'asc' }],
    });
    const byDay = new Map<number, number>();
    for (const slot of slots) {
      byDay.set(slot.dayOfWeek, (byDay.get(slot.dayOfWeek) ?? 0) + 1);
    }
    const limit = await this.prisma.teacherWorkloadLimit.findFirst({
      where: {
        tenantId: actor.tenantId,
        staffId: teacherId,
        ...(query.academicYearId
          ? { academicYearId: query.academicYearId }
          : {}),
      },
    });
    return {
      teacherId,
      slotCount: slots.length,
      weeklyPeriods: slots.length,
      dailyPeriods: Array.from(byDay.entries()).map(([dayOfWeek, count]) => ({
        dayOfWeek,
        count,
      })),
      teachingMinutes: slots.reduce(
        (sum, slot) => sum + minutesBetween(slot.startsAt, slot.endsAt),
        0,
      ),
      limit,
      slots,
    };
  }

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
    if (date.getDay() !== slot.dayOfWeek) {
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

  private async validateCandidateSlot(
    candidate: ConflictSlotInput,
    actor: AuthContext,
  ) {
    return this.lifecycleService.validateCandidateSlot(actor, candidate);
  }

  private async ensureClass(actor: AuthContext, classId: string) {
    const record = await this.prisma.class.findFirst({
      where: { id: classId, tenantId: actor.tenantId },
    });
    if (!record) throw new NotFoundException('Class not found');
    return record;
  }

  private async ensureSection(
    actor: AuthContext,
    classId: string,
    sectionId: string,
  ) {
    const record = await this.prisma.section.findFirst({
      where: { id: sectionId, classId, tenantId: actor.tenantId },
    });
    if (!record) throw new NotFoundException('Section not found in class');
    return record;
  }

  private async ensureSubject(actor: AuthContext, subjectId: string) {
    const record = await this.prisma.subject.findFirst({
      where: { id: subjectId, tenantId: actor.tenantId },
    });
    if (!record) throw new NotFoundException('Subject not found');
    return record;
  }

  private async ensureNoPublishedOverlap(
    version: Awaited<ReturnType<TimetableService['findVersionOrThrow']>>,
    actor: AuthContext,
  ) {
    const overlapping = await this.prisma.timetableVersion.findFirst({
      where: {
        tenantId: actor.tenantId,
        id: { not: version.id },
        academicYearId: version.academicYearId,
        classId: version.classId,
        sectionId: version.sectionId,
        status: {
          in: [TimetableVersionStatus.PUBLISHED, TimetableVersionStatus.LOCKED],
        },
      },
    });
    if (overlapping && dateRangesOverlap(version, overlapping)) {
      throw new ConflictException(
        'A published timetable already covers this effective date range',
      );
    }
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
    const validation = await this.validateCandidateSlot(
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
      actor,
    );

    // Check for existing assigned substitutions for this substitute teacher at the same time
    const sameTimeSubstitution =
      await this.prisma.timetableSubstitution.findFirst({
        where: {
          tenantId: actor.tenantId,
          substituteTeacherId,
          date,
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
    } catch (_error) {
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
    await this.communicationsService.recordDeliveryRecords({
      actor,
      sourceType,
      sourceId: `${substitutionId}:${sourceType}:${Date.now()}`,
      audienceType: substitution.timetableSlot.sectionId
        ? AudienceType.SECTION
        : AudienceType.CLASS,
      classId: substitution.timetableSlot.classId,
      sectionId: substitution.timetableSlot.sectionId,
      title:
        sourceType === 'substitution_cancelled'
          ? 'Substitution cancelled'
          : 'Substitution assigned',
      body: `${substitution.timetableSlot.subject.name} substitution for ${substitution.date.toLocaleDateString('en-NP')} has been updated.`,
      channels: [NotificationChannel.PUSH],
      requiredConsentTypes: [ConsentType.MESSAGING],
    });
  }

  private async upsertWorkloadLimit(
    teacherId: string,
    dto: TeacherAvailabilityDto,
    actor: AuthContext,
  ) {
    if (
      dto.maxPeriodsPerDay === undefined &&
      dto.maxPeriodsPerWeek === undefined
    ) {
      return;
    }
    const existing = await this.prisma.teacherWorkloadLimit.findFirst({
      where: {
        tenantId: actor.tenantId,
        academicYearId: dto.academicYearId ?? null,
        staffId: teacherId,
      },
    });
    if (!existing) {
      await this.prisma.teacherWorkloadLimit.create({
        data: {
          tenantId: actor.tenantId,
          academicYearId: dto.academicYearId ?? null,
          staffId: teacherId,
          maxPeriodsPerDay: dto.maxPeriodsPerDay ?? null,
          maxPeriodsPerWeek: dto.maxPeriodsPerWeek ?? null,
        },
      });
      return;
    }
    await this.prisma.teacherWorkloadLimit.update({
      where: { id: existing.id },
      data: {
        tenantId: actor.tenantId,
        academicYearId: dto.academicYearId ?? null,
        staffId: teacherId,
        maxPeriodsPerDay: dto.maxPeriodsPerDay ?? null,
        maxPeriodsPerWeek: dto.maxPeriodsPerWeek ?? null,
      },
    });
  }

  private async findOrCreateDraftVersion(
    actor: AuthContext,
    input: {
      academicYearId: string;
      classId: string;
      sectionId: string | null;
    },
  ) {
    const existing = await this.prisma.timetableVersion.findFirst({
      where: {
        tenantId: actor.tenantId,
        academicYearId: input.academicYearId,
        classId: input.classId,
        sectionId: input.sectionId,
        status: TimetableVersionStatus.DRAFT,
      },
      include: {
        academicYear: true,
        class: true,
        section: true,
        slots: { include: timetableSlotInclude() },
      },
    });
    if (existing) return existing;
    const year = await this.ensureAcademicYear(actor, input.academicYearId);
    return this.prisma.timetableVersion.create({
      data: {
        tenantId: actor.tenantId,
        academicYearId: input.academicYearId,
        classId: input.classId,
        sectionId: input.sectionId,
        versionName: 'Draft timetable',
        effectiveFrom: year.startsOn,
      },
      include: {
        academicYear: true,
        class: true,
        section: true,
        slots: { include: timetableSlotInclude() },
      },
    });
  }

  private async findVersionOrThrow(id: string, actor: AuthContext) {
    const version = await this.prisma.timetableVersion.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: {
        academicYear: true,
        class: true,
        section: true,
        slots: { include: timetableSlotInclude() },
      },
    });
    if (!version) throw new NotFoundException('Timetable version not found');
    return version;
  }

  private async findSlotOrThrow(id: string, actor: AuthContext) {
    const slot = await this.prisma.timetableSlot.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: timetableSlotInclude(),
    });
    if (!slot) throw new NotFoundException('Timetable slot not found');
    return slot;
  }

  private async findSubstitutionOrThrow(id: string, actor: AuthContext) {
    const substitution = await this.prisma.timetableSubstitution.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: substitutionInclude(),
    });
    if (!substitution) throw new NotFoundException('Substitution not found');
    return substitution;
  }

  private async findPeriodOrThrow(id: string, actor: AuthContext) {
    const period = await this.prisma.timetablePeriod.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!period) throw new NotFoundException('Timetable period not found');
    return period;
  }

  private async findRoomOrThrow(id: string, actor: AuthContext) {
    const room = await this.prisma.room.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  private async ensureAcademicYear(actor: AuthContext, academicYearId: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, tenantId: actor.tenantId },
    });
    if (!year) throw new NotFoundException('Academic year not found');
    return year;
  }

  private async ensureStaff(actor: AuthContext, staffId: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId: actor.tenantId },
    });
    if (!staff) throw new NotFoundException('Staff member not found');
    return staff;
  }

  private async ensureVersionRefs(
    actor: AuthContext,
    academicYearId: string,
    classId?: string,
    sectionId?: string,
  ) {
    await this.ensureAcademicYear(actor, academicYearId);
    if (classId) {
      const classroom = await this.prisma.class.findFirst({
        where: { id: classId, tenantId: actor.tenantId },
      });
      if (!classroom) throw new NotFoundException('Class not found');
    }
    if (sectionId) {
      const section = await this.prisma.section.findFirst({
        where: { id: sectionId, tenantId: actor.tenantId, classId },
      });
      if (!section)
        throw new NotFoundException('Section not found for this class');
    }
  }

  private async ensureSlotRefs(
    actor: AuthContext,
    academicYearId: string,
    dto: CreateVersionSlotDto,
  ) {
    await Promise.all([
      this.ensureVersionRefs(actor, academicYearId, dto.classId, dto.sectionId),
      this.ensureStaff(actor, dto.staffId),
    ]);
    const subject = await this.prisma.subject.findFirst({
      where: {
        id: dto.subjectId,
        tenantId: actor.tenantId,
        classId: dto.classId,
      },
    });
    if (!subject)
      throw new NotFoundException('Subject not found for this class');
    if (dto.periodId) await this.findPeriodOrThrow(dto.periodId, actor);
    if (dto.roomId) await this.findRoomOrThrow(dto.roomId, actor);
  }

  private ensureDraftVersion(status: TimetableVersionStatus) {
    if (status !== TimetableVersionStatus.DRAFT) {
      throw new ConflictException(
        'Only draft timetable versions can be edited',
      );
    }
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

export function stripTime(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
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

function assertTimeRange(startsAt: string, endsAt: string) {
  if (!/^\d{2}:\d{2}$/.test(startsAt) || !/^\d{2}:\d{2}$/.test(endsAt)) {
    throw new ConflictException('Time must be in HH:mm format');
  }
  if (startsAt >= endsAt) {
    throw new ConflictException('Start time must be before end time');
  }
}

function parseDate(value: string, fieldName: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ConflictException(`${fieldName} must be a valid date`);
  }
  return parsed;
}

function _sectionsConflict(a: string | null, b: string | null) {
  return a === b || a === null || b === null;
}

function _versionsOverlap(
  a: { effectiveFrom: Date; effectiveTo: Date | null } | null,
  b: { effectiveFrom: Date; effectiveTo: Date | null } | null,
) {
  if (!a || !b) return true;
  return dateRangesOverlap(a, b);
}

function dateRangesOverlap(
  a: { effectiveFrom: Date; effectiveTo: Date | null },
  b: { effectiveFrom: Date; effectiveTo: Date | null },
) {
  const aEnd = a.effectiveTo ?? new Date('9999-12-31T00:00:00.000Z');
  const bEnd = b.effectiveTo ?? new Date('9999-12-31T00:00:00.000Z');
  return a.effectiveFrom <= bEnd && b.effectiveFrom <= aEnd;
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
