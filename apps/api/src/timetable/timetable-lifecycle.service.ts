import { ConflictException, Injectable } from '@nestjs/common';
import { TimetableVersionStatus } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConflictSlotInput,
  TimetableConflictIssue,
  TimetableConflictService,
} from './timetable-conflict.service';

export interface TimetableLifecycleValidationResult {
  valid: boolean;
  errors: TimetableConflictIssue[];
  warnings: TimetableConflictIssue[];
}

@Injectable()
export class TimetableLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conflictService: TimetableConflictService,
  ) {}

  async validateCandidateSlot(
    actor: AuthContext,
    candidate: ConflictSlotInput,
  ): Promise<TimetableLifecycleValidationResult> {
    if (candidate.tenantId !== actor.tenantId) {
      throw new ConflictException('Timetable candidate tenant mismatch');
    }

    return this.conflictService.validateCandidateFromDb(
      actor.tenantId,
      candidate,
    );
  }

  async assertCandidateSlotAllowed(
    actor: AuthContext,
    candidate: ConflictSlotInput,
  ): Promise<TimetableLifecycleValidationResult> {
    const validation = await this.validateCandidateSlot(actor, candidate);
    if (!validation.valid) {
      throw new ConflictException(
        validation.errors[0]?.message ?? 'Timetable conflict detected',
      );
    }
    return validation;
  }

  async validateVersionForPublish(
    actor: AuthContext,
    versionId: string,
  ): Promise<TimetableLifecycleValidationResult> {
    const version = await this.prisma.timetableVersion.findFirst({
      where: {
        id: versionId,
        tenantId: actor.tenantId,
      },
      include: {
        slots: {
          select: {
            id: true,
            tenantId: true,
            academicYearId: true,
            versionId: true,
            classId: true,
            sectionId: true,
            subjectId: true,
            staffId: true,
            periodId: true,
            roomId: true,
            dayOfWeek: true,
            startsAt: true,
            endsAt: true,
          },
        },
      },
    });

    if (!version) {
      throw new ConflictException('Timetable version not found for tenant');
    }

    if (version.status !== TimetableVersionStatus.DRAFT) {
      throw new ConflictException(
        'Only draft timetable versions can be published',
      );
    }

    if (version.slots.length === 0) {
      return {
        valid: false,
        errors: [
          {
            type: 'CLASS_SECTION_OVERLAP',
            severity: 'BLOCKING',
            message: 'Cannot publish an empty timetable version.',
            affectedPeriodIds: [],
          },
        ],
        warnings: [],
      };
    }

    const staffIds = Array.from(new Set(version.slots.map((s) => s.staffId)));
    const subjectIds = Array.from(
      new Set(version.slots.map((s) => s.subjectId)),
    );
    const roomIds = Array.from(
      new Set(version.slots.filter((s) => s.roomId).map((s) => s.roomId!)),
    );
    const classIds = Array.from(new Set(version.slots.map((s) => s.classId)));

    const [
      availability,
      workloadLimits,
      requirements,
      allPeriods,
      rooms,
      classes,
    ] = await Promise.all([
        this.prisma.teacherAvailability.findMany({
          where: {
            tenantId: actor.tenantId,
            staffId: { in: staffIds },
            OR: [
              { academicYearId: version.academicYearId },
              { academicYearId: null },
            ],
          },
        }),
        this.prisma.teacherWorkloadLimit.findMany({
          where: {
            tenantId: actor.tenantId,
            staffId: { in: staffIds },
            OR: [
              { academicYearId: version.academicYearId },
              { academicYearId: null },
            ],
          },
        }),
        this.prisma.subjectWeeklyRequirement.findMany({
          where: {
            tenantId: actor.tenantId,
            academicYearId: version.academicYearId,
            classId: version.classId! ?? undefined,
            sectionId: version.sectionId ?? undefined,
            subjectId: { in: subjectIds },
          },
        }),
        this.prisma.timetablePeriod.findMany({
          where: {
            tenantId: actor.tenantId,
            academicYearId: version.academicYearId,
            isActive: true,
          },
          select: { id: true, startsAt: true, endsAt: true, dayOfWeek: true },
        }),
        this.prisma.room.findMany({
          where: { tenantId: actor.tenantId, id: { in: roomIds } },
          select: { id: true, capacity: true },
        }),
        this.prisma.class.findMany({
          where: { tenantId: actor.tenantId, id: { in: classIds } },
          select: {
            id: true,
            students: {
              where: { lifecycleStatus: 'ACTIVE' },
              select: { id: true },
            },
          },
        }),
      ]);

    const roomCapacities = rooms.reduce(
      (acc, r) => ({ ...acc, [r.id]: r.capacity }),
      {},
    );
    const classSizes = classes.reduce(
      (acc, c) => ({ ...acc, [c.id]: c.students.length }),
      {},
    );

    return this.conflictService.validateVersionSlots(
      version.slots.map((slot) => ({
        id: slot.id,
        tenantId: slot.tenantId,
        academicYearId: slot.academicYearId,
        versionId: slot.versionId,
        classId: slot.classId,
        sectionId: slot.sectionId,
        subjectId: slot.subjectId,
        staffId: slot.staffId,
        periodId: slot.periodId,
        roomId: slot.roomId,
        dayOfWeek: slot.dayOfWeek,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
      })),
      requirements,
      workloadLimits,
      availability,
      allPeriods,
      roomCapacities,
      classSizes,
    );
  }

  async assertVersionPublishable(
    actor: AuthContext,
    versionId: string,
  ): Promise<TimetableLifecycleValidationResult> {
    const validation = await this.validateVersionForPublish(actor, versionId);
    if (!validation.valid) {
      throw new ConflictException(
        validation.errors[0]?.message ??
          'Timetable version has blocking conflicts',
      );
    }
    return validation;
  }

  assertCanLock(status: TimetableVersionStatus): void {
    if (status !== TimetableVersionStatus.PUBLISHED) {
      throw new ConflictException(
        'Only published timetable versions can be locked',
      );
    }
  }

  assertCanArchive(status: TimetableVersionStatus): void {
    if (status === TimetableVersionStatus.ARCHIVED) return;
    if (status === TimetableVersionStatus.LOCKED) {
      throw new ConflictException(
        'Locked timetable versions cannot be archived without an explicit elevated workflow',
      );
    }
  }
}
