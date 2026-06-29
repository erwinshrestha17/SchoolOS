import {
  ConflictException,
  ForbiddenException,
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
import { ConflictSlotInput } from './timetable-conflict.service';
import { TimetableLifecycleService } from './timetable-lifecycle.service';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from '../communications/communications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceService } from '../attendance/attendance.service';
import { toTimetableDayOfWeek } from './timetable-calendar';
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
  TimetableQueryDto,
  TimetableVersionQueryDto,
  UpdateRoomDto,
  UpdateSubstitutionDto,
  UpdateTimetablePeriodDto,
  UpdateTimetableVersionDto,
  RestoreTimetableVersionDto,
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

const TEACHER_VISIBLE_TIMETABLE_VERSION_STATUSES: readonly TimetableVersionStatus[] =
  [TimetableVersionStatus.PUBLISHED, TimetableVersionStatus.LOCKED] as const;

@Injectable()
export class TimetableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly communicationsService: CommunicationsService,
    private readonly auditService: AuditService,
    private readonly lifecycleService: TimetableLifecycleService,
    private readonly attendanceService: AttendanceService,
  ) {}

  async listTimetable(actor: AuthContext, query: TimetableQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 100);
    const and: Prisma.TimetableSlotWhereInput[] = [];
    const where: Prisma.TimetableSlotWhereInput = {
      tenantId: actor.tenantId,
      ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      ...(query.teacherId ? { staffId: query.teacherId } : {}),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.roomId ? { roomId: query.roomId } : {}),
      ...(query.dayOfWeek ? { dayOfWeek: query.dayOfWeek } : {}),
      ...(query.versionId ? { versionId: query.versionId } : {}),
    };

    const privileged = isPrivilegedTimetableActor(actor);
    if (!privileged && isTeacherActor(actor)) {
      const staff = await this.resolveActorStaff(actor);
      if (!staff || (query.teacherId && query.teacherId !== staff.id)) {
        return emptyPage(page, limit);
      }
      where.staffId = staff.id;
      and.push(publishedTimetableScope());
    } else if (actor.roles.includes('student')) {
      const student = await this.prisma.student.findFirst({
        where: {
          tenantId: actor.tenantId,
          userId: actor.userId,
          lifecycleStatus: 'ACTIVE',
        },
        select: { id: true, classId: true, sectionId: true },
      });
      if (
        !student ||
        (query.studentId && query.studentId !== student.id) ||
        (query.classId && query.classId !== student.classId) ||
        (query.sectionId && query.sectionId !== student.sectionId)
      ) {
        return emptyPage(page, limit);
      }
      where.classId = student.classId;
      and.push(
        student.sectionId
          ? { OR: [{ sectionId: student.sectionId }, { sectionId: null }] }
          : { sectionId: null },
        publishedTimetableScope(),
      );
    } else if (actor.roles.includes('parent')) {
      const link = await this.prisma.studentGuardian.findFirst({
        where: {
          tenantId: actor.tenantId,
          guardian: { userId: actor.userId },
          ...(query.studentId ? { studentId: query.studentId } : {}),
          student: { lifecycleStatus: 'ACTIVE' },
        },
        select: {
          student: {
            select: { id: true, classId: true, sectionId: true },
          },
        },
      });
      const student = link?.student;
      if (
        !student ||
        (query.classId && query.classId !== student.classId) ||
        (query.sectionId && query.sectionId !== student.sectionId)
      ) {
        return emptyPage(page, limit);
      }
      where.classId = student.classId;
      and.push(
        student.sectionId
          ? { OR: [{ sectionId: student.sectionId }, { sectionId: null }] }
          : { sectionId: null },
        publishedTimetableScope(),
      );
    } else if (!query.versionId) {
      and.push(publishedTimetableScope());
    }

    if (and.length) where.AND = and;
    const [items, total] = await Promise.all([
      this.prisma.timetableSlot.findMany({
        where,
        include: timetableSlotInclude(),
        orderBy: [{ dayOfWeek: 'asc' }, { startsAt: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.timetableSlot.count({ where }),
    ]);

    return { items, meta: buildPageMeta(total, page, limit) };
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
    const period = await this.findPeriodOrThrow(id, actor);
    await this.ensurePeriodNotLocked(id, actor);
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
    const room = await this.findRoomOrThrow(id, actor);
    await this.ensureRoomNotLocked(id, actor);
    await this.prisma.room.delete({ where: { id } });
    await this.audit('delete', 'room', id, actor, { id });
    return { deleted: true, id };
  }

  async listVersions(actor: AuthContext, query: TimetableVersionQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 100);
    this.assertOperationalTimetableRead(actor);
    const staff = isTeacherActor(actor)
      ? await this.resolveActorStaff(actor)
      : null;
    if (isTeacherActor(actor) && !staff) {
      return emptyPage(page, limit);
    }
    const where: Prisma.TimetableVersionWhereInput = {
      tenantId: actor.tenantId,
      ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(staff
        ? {
            status: {
              in: [
                TimetableVersionStatus.PUBLISHED,
                TimetableVersionStatus.LOCKED,
              ],
            },
            slots: { some: { staffId: staff.id } },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.timetableVersion.findMany({
        where,
        include: {
          academicYear: true,
          class: true,
          section: true,
          slots: {
            ...(staff ? { where: { staffId: staff.id } } : {}),
            include: timetableSlotInclude(),
          },
        },
        orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.timetableVersion.count({ where }),
    ]);
    return { items, meta: buildPageMeta(total, page, limit) };
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
        status: TimetableVersionStatus.DRAFT,
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

  async updateVersion(
    id: string,
    dto: UpdateTimetableVersionDto,
    actor: AuthContext,
  ) {
    const version = await this.findVersionOrThrow(id, actor);
    this.ensureDraftVersion(version.status);

    const effectiveFrom = dto.effectiveFrom
      ? parseDate(dto.effectiveFrom, 'effectiveFrom')
      : version.effectiveFrom;
    const effectiveTo = dto.effectiveTo
      ? parseDate(dto.effectiveTo, 'effectiveTo')
      : version.effectiveTo;

    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new ConflictException('effectiveTo cannot be before effectiveFrom');
    }

    const updated = await this.prisma.timetableVersion.update({
      where: { id },
      data: {
        versionName: dto.versionName ?? version.versionName,
        effectiveFrom,
        effectiveTo,
        status: dto.status ?? version.status,
      },
      include: {
        academicYear: true,
        class: true,
        section: true,
        slots: { include: timetableSlotInclude() },
      },
    });

    await this.audit('update', 'timetable_version', id, actor, updated);
    return updated;
  }

  async restoreVersion(
    id: string,
    dto: RestoreTimetableVersionDto,
    actor: AuthContext,
  ) {
    const source = await this.findVersionOrThrow(dto.sourceVersionId, actor);
    const draft = await this.findVersionOrThrow(id, actor);
    this.ensureDraftVersion(draft.status);

    return this.prisma.$transaction(async (tx) => {
      await tx.timetableSlot.deleteMany({ where: { versionId: id } });
      const slots = source.slots.map((s) => ({
        tenantId: actor.tenantId,
        versionId: id,
        academicYearId: s.academicYearId,
        classId: s.classId,
        sectionId: s.sectionId,
        subjectId: s.subjectId,
        staffId: s.staffId,
        periodId: s.periodId,
        roomId: s.roomId,
        dayOfWeek: s.dayOfWeek,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
      }));
      await tx.timetableSlot.createMany({ data: slots });
      const updated = await tx.timetableVersion.update({
        where: { id },
        data: {
          versionName: dto.versionName ?? `Restored from ${source.versionName}`,
        },
        include: { slots: { include: timetableSlotInclude() } },
      });
      await this.audit('restore', 'timetable_version', id, actor, updated);
      return updated;
    });
  }

  async compareVersions(id1: string, id2: string, actor: AuthContext) {
    const [v1, v2] = await Promise.all([
      this.findVersionOrThrow(id1, actor),
      this.findVersionOrThrow(id2, actor),
    ]);

    const slots1 = v1.slots;
    const slots2 = v2.slots;

    const added = slots2.filter(
      (s2) =>
        !slots1.some(
          (s1) =>
            s1.dayOfWeek === s2.dayOfWeek &&
            s1.startsAt === s2.startsAt &&
            s1.subjectId === s2.subjectId &&
            s1.staffId === s2.staffId &&
            s1.roomId === s2.roomId,
        ),
    );

    const removed = slots1.filter(
      (s1) =>
        !slots2.some(
          (s2) =>
            s2.dayOfWeek === s1.dayOfWeek &&
            s2.startsAt === s1.startsAt &&
            s2.subjectId === s1.subjectId &&
            s2.staffId === s1.staffId &&
            s2.roomId === s1.roomId,
        ),
    );

    const modified = slots1.filter((s1) => {
      const match = slots2.find(
        (s2) =>
          s2.dayOfWeek === s1.dayOfWeek &&
          s2.startsAt === s1.startsAt &&
          (s1.subjectId !== s2.subjectId ||
            s1.staffId !== s2.staffId ||
            s1.roomId !== s2.roomId),
      );
      return !!match;
    });

    return {
      version1: { id: v1.id, name: v1.versionName },
      version2: { id: v2.id, name: v2.versionName },
      summary: {
        added: added.length,
        removed: removed.length,
        modified: modified.length,
      },
      added,
      removed,
      modified,
    };
  }

  async getVersion(id: string, actor: AuthContext) {
    this.assertOperationalTimetableRead(actor);
    const version = await this.findVersionOrThrow(id, actor);
    if (!isTeacherActor(actor)) return version;
    const staff = await this.resolveActorStaff(actor);
    if (!staff) throw new NotFoundException('Timetable version not found');
    const slots = version.slots.filter((slot) => slot.staffId === staff.id);
    if (slots.length === 0) {
      throw new NotFoundException('Timetable version not found');
    }
    if (!TEACHER_VISIBLE_TIMETABLE_VERSION_STATUSES.includes(version.status)) {
      throw new NotFoundException('Timetable version not found');
    }
    return { ...version, slots };
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
    this.lifecycleService.assertCanArchive(version.status);
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
    this.assertOperationalTimetableRead(actor);
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 100);
    const actorStaff = isTeacherActor(actor)
      ? await this.resolveActorStaff(actor)
      : null;
    if (
      (isTeacherActor(actor) && !actorStaff) ||
      (actorStaff && query.staffId && query.staffId !== actorStaff.id)
    ) {
      return [];
    }

    return this.prisma.teacherAvailability.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(actorStaff
          ? { staffId: actorStaff.id }
          : query.staffId
            ? { staffId: query.staffId }
            : {}),
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
    await this.ensureStaffReadable(actor, teacherId);
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
    this.assertOperationalTimetableRead(actor);
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 100);
    const actorStaff = isTeacherActor(actor)
      ? await this.resolveActorStaff(actor)
      : null;
    if (isTeacherActor(actor) && !actorStaff) return [];

    return this.prisma.teacherWorkloadLimit.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(actorStaff ? { staffId: actorStaff.id } : {}),
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
    await this.ensureStaffReadable(actor, teacherId);
    return this.prisma.teacherWorkloadLimit.findFirst({
      where: {
        tenantId: actor.tenantId,
        staffId: teacherId,
        ...(academicYearId ? { academicYearId } : {}),
      },
    });
  }

  async getTeacherWorkload(
    teacherId: string,
    query: WorkloadQueryDto,
    actor: AuthContext,
  ) {
    await this.ensureStaffReadable(actor, teacherId);
    const [slots, rule] = await Promise.all([
      this.prisma.timetableSlot.findMany({
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
      }),
      this.getTeacherWorkloadRule(teacherId, actor, query.academicYearId),
    ]);
    const teachingMinutes = slots.reduce(
      (sum, slot) => sum + minutesBetween(slot.startsAt, slot.endsAt),
      0,
    );

    return {
      teacherId,
      weeklyPeriods: slots.length,
      teachingMinutes,
      weeklyHours: Math.round((teachingMinutes / 60) * 10) / 10,
      rule,
      slots,
    };
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
    this.assertOperationalTimetableRead(actor);
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 100);
    const teacherScope = isTeacherActor(actor)
      ? await this.getTeacherTimetableScope(actor)
      : null;
    if (teacherScope?.length === 0) return [];

    const requirements = await this.prisma.subjectWeeklyRequirement.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(query.academicYearId
          ? { academicYearId: query.academicYearId }
          : {}),
        ...(query.classId ? { classId: query.classId } : {}),
        ...(query.sectionId ? { sectionId: query.sectionId } : {}),
        ...(query.subjectId ? { subjectId: query.subjectId } : {}),
        ...(teacherScope ? { OR: teacherScope } : {}),
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
    if (requirements.length === 0) return [];
    const slots = await this.prisma.timetableSlot.findMany({
      where: {
        tenantId: actor.tenantId,
        academicYearId: {
          in: Array.from(
            new Set(requirements.map((item) => item.academicYearId)),
          ),
        },
        ...(query.versionId
          ? { versionId: query.versionId }
          : {
              version: {
                status: {
                  in: [
                    TimetableVersionStatus.PUBLISHED,
                    TimetableVersionStatus.LOCKED,
                  ],
                },
              },
            }),
        OR: requirements.map((requirement) => ({
          classId: requirement.classId,
          sectionId: requirement.sectionId,
          subjectId: requirement.subjectId,
        })),
      },
      select: {
        academicYearId: true,
        classId: true,
        sectionId: true,
        subjectId: true,
      },
    });
    return requirements.map((requirement) => {
      const assignedPeriods = slots.filter(
        (slot) =>
          slot.academicYearId === requirement.academicYearId &&
          slot.classId === requirement.classId &&
          slot.sectionId === requirement.sectionId &&
          slot.subjectId === requirement.subjectId,
      ).length;
      return {
        ...requirement,
        assignedPeriods,
        gapPeriods: Math.max(
          requirement.requiredPeriodsPerWeek - assignedPeriods,
          0,
        ),
      };
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

  async listTeacherWorkload(
    actor: AuthContext,
    query: ListTeacherWorkloadQueryDto,
  ) {
    this.assertOperationalTimetableRead(actor);
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 100);
    const actorStaff = isTeacherActor(actor)
      ? await this.resolveActorStaff(actor)
      : null;
    if (
      (isTeacherActor(actor) && !actorStaff) ||
      (actorStaff && query.teacherId && query.teacherId !== actorStaff.id)
    ) {
      return { ...emptyPage(page, limit), summary: emptyWorkloadSummary() };
    }

    const slotFilters: Prisma.TimetableSlotWhereInput = {
      tenantId: actor.tenantId,
      ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
      ...(query.versionId ? { versionId: query.versionId } : {}),
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
    };
    const staffWhere: Prisma.StaffWhereInput = {
      tenantId: actor.tenantId,
      ...(actorStaff
        ? { id: actorStaff.id }
        : query.teacherId
          ? { id: query.teacherId }
          : {}),
      timetableSlots: { some: slotFilters },
    };
    const [staff, total] = await Promise.all([
      this.prisma.staff.findMany({
        where: staffWhere,
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.staff.count({ where: staffWhere }),
    ]);
    const staffIds = staff.map((member) => member.id);
    if (staffIds.length === 0) {
      return {
        items: [],
        meta: buildPageMeta(total, page, limit),
        summary: emptyWorkloadSummary(total),
      };
    }

    const [slots, homeworkCounts] = await Promise.all([
      this.prisma.timetableSlot.findMany({
        where: {
          ...slotFilters,
          staffId: { in: staffIds },
        },
        include: timetableSlotInclude(),
        orderBy: [
          { staffId: 'asc' },
          { dayOfWeek: 'asc' },
          { startsAt: 'asc' },
        ],
      }),
      this.prisma.homeworkAssignment.groupBy({
        by: ['assignedByStaffId'],
        where: {
          tenantId: actor.tenantId,
          assignedByStaffId: { in: staffIds },
          ...(query.academicYearId
            ? { academicYearId: query.academicYearId }
            : {}),
          ...(query.classId ? { classId: query.classId } : {}),
          ...(query.sectionId ? { sectionId: query.sectionId } : {}),
          ...(query.subjectId ? { subjectId: query.subjectId } : {}),
        },
        _count: { _all: true },
      }),
    ]);
    const homeworkCountByStaff = new Map(
      homeworkCounts.map((row) => [row.assignedByStaffId, row._count._all]),
    );
    const items = staff.map((member) => {
      const teacherSlots = slots.filter((slot) => slot.staffId === member.id);
      const teachingMinutes = teacherSlots.reduce(
        (sum, slot) => sum + minutesBetween(slot.startsAt, slot.endsAt),
        0,
      );
      return {
        staffId: member.id,
        employeeId: member.employeeId,
        staffName: `${member.firstName} ${member.lastName}`.trim(),
        slotCount: teacherSlots.length,
        homeworkCount: homeworkCountByStaff.get(member.id) ?? 0,
        teachingMinutes,
        weeklyHours: Math.round((teachingMinutes / 60) * 10) / 10,
        slots: teacherSlots,
      };
    });
    const totalTeachingMinutes = items.reduce(
      (sum, item) => sum + item.teachingMinutes,
      0,
    );
    return {
      items,
      meta: buildPageMeta(total, page, limit),
      summary: {
        teacherCount: total,
        totalPeriods: items.reduce((sum, item) => sum + item.slotCount, 0),
        totalTeachingMinutes,
        totalWeeklyHours: Math.round((totalTeachingMinutes / 60) * 10) / 10,
      },
    };
  }

  async getTeacherTimetable(
    teacherId: string,
    query: WorkloadQueryDto,
    actor: AuthContext,
  ) {
    await this.ensureStaffReadable(actor, teacherId);
    return this.prisma.timetableSlot.findMany({
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
  }

  async getTeacherMobileTimetable(
    actor: AuthContext,
    query: { date?: string; weekStart?: string; days?: number },
  ) {
    const staff = await this.prisma.staff.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
      select: { id: true },
    });
    if (!staff) {
      throw new ForbiddenException('Active teacher profile is required');
    }

    const baseDate = stripTime(
      query.weekStart
        ? parseDate(query.weekStart, 'weekStart')
        : query.date
          ? parseDate(query.date, 'date')
          : new Date(),
    );
    const days = Math.min(query.days ?? 7, 7);
    const dates = Array.from({ length: days }, (_, index) => {
      const date = new Date(baseDate);
      date.setDate(baseDate.getDate() + index);
      return stripTime(date);
    });
    const dayOfWeeks = Array.from(
      new Set(dates.map((date) => toTimetableDayOfWeek(date))),
    );

    const [slots, substitutions] = await Promise.all([
      this.prisma.timetableSlot.findMany({
        where: {
          tenantId: actor.tenantId,
          staffId: staff.id,
          dayOfWeek: { in: dayOfWeeks },
          version: {
            status: {
              in: [
                TimetableVersionStatus.PUBLISHED,
                TimetableVersionStatus.LOCKED,
              ],
            },
            effectiveFrom: { lte: dates[dates.length - 1] },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: dates[0] } }],
          },
        },
        include: timetableSlotInclude(),
        orderBy: [{ dayOfWeek: 'asc' }, { startsAt: 'asc' }],
      }),
      this.prisma.timetableSubstitution.findMany({
        where: {
          tenantId: actor.tenantId,
          date: { gte: dates[0], lte: dates[dates.length - 1] },
          status: { not: TimetableSubstitutionStatus.CANCELLED },
          OR: [
            { absentTeacherId: staff.id },
            { substituteTeacherId: staff.id },
          ],
        },
        include: substitutionInclude(),
        orderBy: [{ date: 'asc' }, { createdAt: 'desc' }],
      }),
    ]);

    const substitutionBySlotDate = new Map(
      substitutions.map((substitution) => [
        `${substitution.timetableSlotId}:${toDateKey(substitution.date)}`,
        substitution,
      ]),
    );

    return {
      range: {
        startsOn: dates[0],
        endsOn: dates[dates.length - 1],
      },
      items: dates.flatMap((date) => {
        const dayOfWeek = toTimetableDayOfWeek(date);
        return slots
          .filter((slot) => slot.dayOfWeek === dayOfWeek)
          .filter(
            (slot) =>
              slot.version !== null &&
              slot.version.effectiveFrom <= date &&
              (!slot.version.effectiveTo || slot.version.effectiveTo >= date),
          )
          .map((slot) => {
            const substitution = substitutionBySlotDate.get(
              `${slot.id}:${toDateKey(date)}`,
            );
            return this.mapTeacherMobileTimetableSlot(
              slot,
              date,
              staff.id,
              substitution ?? null,
            );
          });
      }),
      substitutions: substitutions.map((substitution) =>
        this.mapTeacherMobileSubstitution(substitution, staff.id),
      ),
    };
  }

  async exportClassTimetable(
    classId: string,
    sectionId: string | null,
    academicYearId: string,
    actor: AuthContext,
  ) {
    const version = await this.prisma.timetableVersion.findFirst({
      where: {
        tenantId: actor.tenantId,
        academicYearId,
        classId,
        sectionId,
        status: {
          in: [TimetableVersionStatus.PUBLISHED, TimetableVersionStatus.LOCKED],
        },
      },
      include: {
        slots: {
          include: timetableSlotInclude(),
          orderBy: [{ dayOfWeek: 'asc' }, { startsAt: 'asc' }],
        },
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!version) {
      throw new NotFoundException('No active timetable found for this class');
    }

    // Format for easy consumption (grouped by day)
    const schedule: Record<number, any[]> = {};
    for (let day = 1; day <= 7; day++) {
      schedule[day] = version.slots.filter((s) => s.dayOfWeek === day);
    }

    return {
      version: {
        id: version.id,
        name: version.versionName,
        effectiveFrom: version.effectiveFrom,
      },
      schedule,
    };
  }

  private mapTeacherMobileTimetableSlot(
    slot: Prisma.TimetableSlotGetPayload<{
      include: ReturnType<typeof timetableSlotInclude>;
    }>,
    date: Date,
    staffId: string,
    substitution: Prisma.TimetableSubstitutionGetPayload<{
      include: ReturnType<typeof substitutionInclude>;
    }> | null,
  ) {
    return {
      id: slot.id,
      date,
      dayOfWeek: slot.dayOfWeek,
      academicYearId: slot.academicYearId,
      classId: slot.classId,
      sectionId: slot.sectionId,
      subjectId: slot.subjectId,
      className: slot.class.name,
      sectionName: slot.section?.name ?? null,
      subjectName: slot.subject.name,
      room: slot.roomRef?.name ?? null,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      status: substitution
        ? substitution.status === TimetableSubstitutionStatus.ASSIGNED
          ? 'SUBSTITUTED'
          : 'CHANGED'
        : 'SCHEDULED',
      substitution: substitution
        ? this.mapTeacherMobileSubstitution(substitution, staffId)
        : null,
    };
  }

  private mapTeacherMobileSubstitution(
    substitution: Prisma.TimetableSubstitutionGetPayload<{
      include: ReturnType<typeof substitutionInclude>;
    }>,
    staffId: string,
  ) {
    return {
      id: substitution.id,
      date: substitution.date,
      status: substitution.status,
      reason: substitution.reason,
      timetableSlotId: substitution.timetableSlotId,
      role:
        substitution.substituteTeacherId === staffId
          ? 'SUBSTITUTE'
          : 'ABSENT_TEACHER',
      className: substitution.timetableSlot.class.name,
      sectionName: substitution.timetableSlot.section?.name ?? null,
      subjectName: substitution.timetableSlot.subject.name,
      startsAt: substitution.timetableSlot.startsAt,
      endsAt: substitution.timetableSlot.endsAt,
      room: substitution.timetableSlot.roomRef?.name ?? null,
      absentTeacherName: substitution.absentTeacher
        ? `${substitution.absentTeacher.firstName} ${substitution.absentTeacher.lastName}`.trim()
        : null,
      substituteTeacherName: substitution.substituteTeacher
        ? `${substitution.substituteTeacher.firstName} ${substitution.substituteTeacher.lastName}`.trim()
        : null,
    };
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
        ...(version.sectionId
          ? { OR: [{ sectionId: version.sectionId }, { sectionId: null }] }
          : {}),
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

  private async resolveActorStaff(actor: AuthContext) {
    return this.prisma.staff.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
      select: { id: true },
    });
  }

  private assertOperationalTimetableRead(actor: AuthContext) {
    if (actor.roles.includes('student') || actor.roles.includes('parent')) {
      throw new ForbiddenException(
        'Operational timetable data is limited to authorized staff',
      );
    }
    if (
      isPrivilegedTimetableActor(actor) ||
      isTeacherActor(actor) ||
      actor.permissions.some((permission) =>
        [
          'timetable:manage',
          'timetable:publish',
          'timetable:substitute',
        ].includes(permission),
      )
    ) {
      return;
    }
    throw new ForbiddenException(
      'Operational timetable data is limited to authorized staff',
    );
  }

  private async ensureStaffReadable(actor: AuthContext, staffId: string) {
    this.assertOperationalTimetableRead(actor);
    const staff = await this.ensureStaff(actor, staffId);
    if (isTeacherActor(actor) && !isPrivilegedTimetableActor(actor)) {
      const actorStaff = await this.resolveActorStaff(actor);
      if (!actorStaff || actorStaff.id !== staffId) {
        throw new ForbiddenException(
          'Teachers can only view their own timetable workload',
        );
      }
    }
    return staff;
  }

  private async getTeacherTimetableScope(
    actor: AuthContext,
  ): Promise<Prisma.SubjectWeeklyRequirementWhereInput[]> {
    const staff = await this.resolveActorStaff(actor);
    if (!staff) return [];
    const assignments = await this.prisma.subjectTeacherAssignment.findMany({
      where: { tenantId: actor.tenantId, staffId: staff.id },
      select: {
        academicYearId: true,
        classId: true,
        sectionId: true,
        subjectId: true,
      },
      take: 200,
    });
    return assignments.map((assignment) => ({
      academicYearId: assignment.academicYearId,
      classId: assignment.classId,
      subjectId: assignment.subjectId,
      OR: assignment.sectionId
        ? [{ sectionId: assignment.sectionId }, { sectionId: null }]
        : [{ sectionId: null }],
    }));
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
        `Cannot modify a ${status.toLowerCase()} timetable version. Only draft versions can be edited.`,
      );
    }
  }

  private async ensurePeriodNotLocked(periodId: string, actor: AuthContext) {
    const lockedVersion = await this.prisma.timetableVersion.findFirst({
      where: {
        tenantId: actor.tenantId,
        status: TimetableVersionStatus.LOCKED,
        slots: { some: { periodId } },
      },
    });
    if (lockedVersion) {
      throw new ConflictException(
        'Cannot delete period because it is used in a locked timetable version',
      );
    }
  }

  private async ensureRoomNotLocked(roomId: string, actor: AuthContext) {
    const lockedVersion = await this.prisma.timetableVersion.findFirst({
      where: {
        tenantId: actor.tenantId,
        status: TimetableVersionStatus.LOCKED,
        slots: { some: { roomId } },
      },
    });
    if (lockedVersion) {
      throw new ConflictException(
        'Cannot delete room because it is used in a locked timetable version',
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

function isTeacherActor(actor: AuthContext) {
  return (
    actor.roles.includes('teacher') || actor.roles.includes('subject_teacher')
  );
}

function isPrivilegedTimetableActor(actor: AuthContext) {
  return actor.roles.some((role) =>
    ['admin', 'principal', 'platform_super_admin'].includes(role),
  );
}

function publishedTimetableScope(): Prisma.TimetableSlotWhereInput {
  return {
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
  };
}

function buildPageMeta(total: number, page: number, limit: number) {
  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

function emptyPage(page: number, limit: number) {
  return {
    items: [],
    meta: buildPageMeta(0, page, limit),
  };
}

function emptyWorkloadSummary(teacherCount = 0) {
  return {
    teacherCount,
    totalPeriods: 0,
    totalTeachingMinutes: 0,
    totalWeeklyHours: 0,
  };
}

function parseDate(value: string, fieldName: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ConflictException(`${fieldName} must be a valid date`);
  }
  return parsed;
}

function toDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
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
