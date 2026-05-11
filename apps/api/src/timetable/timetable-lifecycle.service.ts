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
      throw new ConflictException('Only draft timetable versions can be published');
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
        roomId: slot.roomId,
        dayOfWeek: slot.dayOfWeek,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
      })),
    );
  }

  async assertVersionPublishable(
    actor: AuthContext,
    versionId: string,
  ): Promise<TimetableLifecycleValidationResult> {
    const validation = await this.validateVersionForPublish(actor, versionId);
    if (!validation.valid) {
      throw new ConflictException(
        validation.errors[0]?.message ?? 'Timetable version has blocking conflicts',
      );
    }
    return validation;
  }

  assertCanLock(status: TimetableVersionStatus): void {
    if (status !== TimetableVersionStatus.PUBLISHED) {
      throw new ConflictException('Only published timetable versions can be locked');
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
