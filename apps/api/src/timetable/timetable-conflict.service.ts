import { Injectable } from '@nestjs/common';
import { TeacherAvailabilityType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type TimetableConflictType =
  | 'TEACHER_DOUBLE_BOOKED'
  | 'ROOM_DOUBLE_BOOKED'
  | 'CLASS_SECTION_OVERLAP'
  | 'TEACHER_UNAVAILABLE'
  | 'WORKLOAD_EXCEEDED'
  | 'SUBJECT_REQUIREMENT_MISSING'
  | 'SUBJECT_REQUIREMENT_EXCEEDED'
  | 'PERIOD_MISMATCH'
  | 'OUTSIDE_SCHEDULE';

export type TimetableConflictSeverity = 'BLOCKING' | 'WARNING';

export interface TimetableConflictIssue {
  type: TimetableConflictType;
  severity: TimetableConflictSeverity;
  message: string;
  affectedPeriodIds: string[];
  teacherId?: string;
  roomId?: string;
  classId?: string;
  sectionId?: string | null;
  subjectId?: string;
  periodId?: string | null;
  dayOfWeek?: number;
  startsAt?: string;
  endsAt?: string;
}

export interface ConflictSlotInput {
  id: string;
  tenantId: string;
  academicYearId: string;
  versionId?: string | null;
  classId: string;
  sectionId?: string | null;
  subjectId: string;
  staffId: string;
  periodId?: string | null;
  roomId?: string | null;
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
}

export interface AvailabilityInput {
  id?: string;
  staffId: string;
  academicYearId?: string | null;
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
  type: TeacherAvailabilityType;
}

export interface TeacherWorkloadLimitInput {
  staffId: string;
  maxPeriodsPerDay?: number | null;
  maxPeriodsPerWeek?: number | null;
}

export interface SubjectWeeklyRequirementInput {
  subjectId: string;
  classId: string;
  sectionId?: string | null;
  requiredPeriodsPerWeek: number;
}

export interface TimetableConflictValidationInput {
  candidate: ConflictSlotInput;
  existingSlots: ConflictSlotInput[];
  teacherAvailability?: AvailabilityInput[];
  teacherWorkloadLimit?: TeacherWorkloadLimitInput | null;
  subjectWeeklyRequirement?: SubjectWeeklyRequirementInput | null;
  periodConfig?: {
    id: string;
    startsAt: string;
    endsAt: string;
    dayOfWeek: number | null;
  } | null;
  allPeriods?: {
    id: string;
    startsAt: string;
    endsAt: string;
    dayOfWeek: number | null;
  }[];
}

export interface TimetableConflictValidationResult {
  valid: boolean;
  errors: TimetableConflictIssue[];
  warnings: TimetableConflictIssue[];
}

@Injectable()
export class TimetableConflictService {
  constructor(private readonly prisma?: PrismaService) {}

  validateCandidate(
    input: TimetableConflictValidationInput,
  ): TimetableConflictValidationResult {
    const issues: TimetableConflictIssue[] = [
      ...this.detectClassSectionOverlap(input.candidate, input.existingSlots),
      ...this.detectTeacherDoubleBooking(input.candidate, input.existingSlots),
      ...this.detectRoomDoubleBooking(input.candidate, input.existingSlots),
      ...this.detectTeacherAvailabilityConflict(
        input.candidate,
        input.teacherAvailability ?? [],
      ),
      ...this.detectTeacherWorkloadConflict(
        input.candidate,
        input.existingSlots,
        input.teacherWorkloadLimit ?? null,
      ),
      ...this.detectSubjectWeeklyRequirementConflict(
        input.candidate,
        input.existingSlots,
        input.subjectWeeklyRequirement ?? null,
      ),
      ...this.detectPeriodMismatch(input.candidate, input.periodConfig ?? null),
      ...this.detectOutsideSchedule(input.candidate, input.allPeriods ?? []),
    ];

    const deduped = dedupeIssues(issues);
    const errors = deduped.filter((issue) => issue.severity === 'BLOCKING');
    const warnings = deduped.filter((issue) => issue.severity === 'WARNING');

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async validateCandidateFromDb(
    tenantId: string,
    candidate: ConflictSlotInput,
  ): Promise<TimetableConflictValidationResult> {
    if (!this.prisma) {
      throw new Error(
        'PrismaService is required for database-backed validation',
      );
    }

    const candidateScopes = [
      candidate.versionId ? { versionId: candidate.versionId } : null,
      { staffId: candidate.staffId },
      candidate.roomId ? { roomId: candidate.roomId } : null,
      {
        classId: candidate.classId,
        sectionId: candidate.sectionId ?? null,
      },
    ].filter(Boolean) as Prisma.TimetableSlotWhereInput[];

    const [
      existingSlots,
      teacherAvailability,
      teacherWorkloadLimit,
      subjectWeeklyRequirement,
      periodConfig,
      allPeriods,
    ] = await Promise.all([
      this.prisma.timetableSlot.findMany({
        where: {
          tenantId,
          academicYearId: candidate.academicYearId,
          dayOfWeek: candidate.dayOfWeek,
          id: { not: candidate.id },
          OR: candidateScopes,
        },
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
          periodId: true,
        },
      }),
      this.prisma.teacherAvailability.findMany({
        where: {
          tenantId,
          staffId: candidate.staffId,
          dayOfWeek: candidate.dayOfWeek,
          OR: [
            { academicYearId: candidate.academicYearId },
            { academicYearId: null },
          ],
        },
        select: {
          id: true,
          staffId: true,
          academicYearId: true,
          dayOfWeek: true,
          startsAt: true,
          endsAt: true,
          type: true,
        },
      }),
      this.prisma.teacherWorkloadLimit.findFirst({
        where: {
          tenantId,
          staffId: candidate.staffId,
          OR: [
            { academicYearId: candidate.academicYearId },
            { academicYearId: null },
          ],
        },
        select: {
          staffId: true,
          maxPeriodsPerDay: true,
          maxPeriodsPerWeek: true,
        },
      }),
      this.prisma.subjectWeeklyRequirement.findFirst({
        where: {
          tenantId,
          academicYearId: candidate.academicYearId,
          classId: candidate.classId,
          sectionId: candidate.sectionId ?? null,
          subjectId: candidate.subjectId,
        },
        select: {
          subjectId: true,
          classId: true,
          sectionId: true,
          requiredPeriodsPerWeek: true,
        },
      }),
      candidate.periodId
        ? this.prisma.timetablePeriod.findUnique({
            where: { id: candidate.periodId },
            select: {
              id: true,
              startsAt: true,
              endsAt: true,
              dayOfWeek: true,
              tenantId: true,
            },
          })
        : null,
      this.prisma.timetablePeriod.findMany({
        where: {
          tenantId,
          academicYearId: candidate.academicYearId,
          isActive: true,
        },
        select: { id: true, startsAt: true, endsAt: true, dayOfWeek: true },
      }),
    ]);

    if (periodConfig && periodConfig.tenantId !== tenantId) {
      throw new Error('Period tenant mismatch');
    }

    return this.validateCandidate({
      candidate,
      existingSlots,
      teacherAvailability,
      teacherWorkloadLimit,
      subjectWeeklyRequirement,
      periodConfig,
      allPeriods,
    });
  }

  validateVersionSlots(
    slots: ConflictSlotInput[],
    requirements: SubjectWeeklyRequirementInput[] = [],
    workloadLimits: TeacherWorkloadLimitInput[] = [],
    availability: AvailabilityInput[] = [],
    allPeriods: {
      id: string;
      startsAt: string;
      endsAt: string;
      dayOfWeek: number | null;
    }[] = [],
  ): TimetableConflictValidationResult {
    const issues: TimetableConflictIssue[] = [];

    // 1. Validate each slot for individual conflicts (teacher/room double booking, availability, workload)
    for (const slot of slots) {
      const result = this.validateCandidate({
        candidate: slot,
        existingSlots: slots.filter((existing) => existing.id !== slot.id),
        teacherAvailability: availability.filter(
          (item) => item.staffId === slot.staffId,
        ),
        teacherWorkloadLimit:
          workloadLimits.find((item) => item.staffId === slot.staffId) ?? null,
        periodConfig: slot.periodId
          ? (allPeriods.find((p) => p.id === slot.periodId) ?? null)
          : null,
        allPeriods,
        // We handle requirements separately to avoid duplicates
        subjectWeeklyRequirement: null,
      });
      issues.push(...result.errors, ...result.warnings);
    }

    // 2. Validate subject weekly requirements once per subject scope
    for (const req of requirements) {
      const matchingSlots = slots.filter(
        (slot) =>
          slot.subjectId === req.subjectId &&
          slot.classId === req.classId &&
          normalizeNullable(slot.sectionId) ===
            normalizeNullable(req.sectionId),
      );
      const actual = matchingSlots.length;
      if (actual < req.requiredPeriodsPerWeek) {
        issues.push({
          type: 'SUBJECT_REQUIREMENT_MISSING',
          severity: 'BLOCKING',
          message: `Subject weekly requirement not met (${actual}/${req.requiredPeriodsPerWeek}).`,
          affectedPeriodIds: matchingSlots.map((slot) => slot.id),
          classId: req.classId,
          sectionId: req.sectionId ?? null,
          subjectId: req.subjectId,
        });
      }
    }

    const deduped = dedupeIssues(issues);
    const errors = deduped.filter((issue) => issue.severity === 'BLOCKING');
    const warnings = deduped.filter((issue) => issue.severity === 'WARNING');

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private detectTeacherDoubleBooking(
    candidate: ConflictSlotInput,
    existingSlots: ConflictSlotInput[],
  ): TimetableConflictIssue[] {
    return existingSlots
      .filter(
        (slot) =>
          slot.staffId === candidate.staffId &&
          slot.dayOfWeek === candidate.dayOfWeek &&
          rangesOverlap(
            candidate.startsAt,
            candidate.endsAt,
            slot.startsAt,
            slot.endsAt,
          ),
      )
      .map((slot) => ({
        type: 'TEACHER_DOUBLE_BOOKED',
        severity: 'BLOCKING',
        message: 'Teacher is already assigned during this time slot.',
        affectedPeriodIds: [candidate.id, slot.id],
        teacherId: candidate.staffId,
        dayOfWeek: candidate.dayOfWeek,
        startsAt: candidate.startsAt,
        endsAt: candidate.endsAt,
      }));
  }

  private detectRoomDoubleBooking(
    candidate: ConflictSlotInput,
    existingSlots: ConflictSlotInput[],
  ): TimetableConflictIssue[] {
    if (!candidate.roomId) return [];

    return existingSlots
      .filter(
        (slot) =>
          slot.roomId === candidate.roomId &&
          slot.dayOfWeek === candidate.dayOfWeek &&
          rangesOverlap(
            candidate.startsAt,
            candidate.endsAt,
            slot.startsAt,
            slot.endsAt,
          ),
      )
      .map((slot) => ({
        type: 'ROOM_DOUBLE_BOOKED',
        severity: 'BLOCKING',
        message: 'Room is already booked during this time slot.',
        affectedPeriodIds: [candidate.id, slot.id],
        roomId: candidate.roomId ?? undefined,
        dayOfWeek: candidate.dayOfWeek,
        startsAt: candidate.startsAt,
        endsAt: candidate.endsAt,
      }));
  }

  private detectClassSectionOverlap(
    candidate: ConflictSlotInput,
    existingSlots: ConflictSlotInput[],
  ): TimetableConflictIssue[] {
    return existingSlots
      .filter(
        (slot) =>
          slot.classId === candidate.classId &&
          normalizeNullable(slot.sectionId) ===
            normalizeNullable(candidate.sectionId) &&
          slot.dayOfWeek === candidate.dayOfWeek &&
          rangesOverlap(
            candidate.startsAt,
            candidate.endsAt,
            slot.startsAt,
            slot.endsAt,
          ),
      )
      .map((slot) => ({
        type: 'CLASS_SECTION_OVERLAP',
        severity: 'BLOCKING',
        message:
          'Class/section already has another period during this time slot.',
        affectedPeriodIds: [candidate.id, slot.id],
        classId: candidate.classId,
        sectionId: candidate.sectionId ?? null,
        dayOfWeek: candidate.dayOfWeek,
        startsAt: candidate.startsAt,
        endsAt: candidate.endsAt,
      }));
  }

  private detectTeacherAvailabilityConflict(
    candidate: ConflictSlotInput,
    availability: AvailabilityInput[],
  ): TimetableConflictIssue[] {
    return availability
      .filter(
        (item) =>
          item.type === TeacherAvailabilityType.UNAVAILABLE &&
          item.dayOfWeek === candidate.dayOfWeek &&
          rangesOverlap(
            candidate.startsAt,
            candidate.endsAt,
            item.startsAt,
            item.endsAt,
          ),
      )
      .map((item) => ({
        type: 'TEACHER_UNAVAILABLE',
        severity: 'BLOCKING',
        message: 'Teacher is marked unavailable during this time slot.',
        affectedPeriodIds: [candidate.id, item.id].filter(Boolean) as string[],
        teacherId: candidate.staffId,
        dayOfWeek: candidate.dayOfWeek,
        startsAt: candidate.startsAt,
        endsAt: candidate.endsAt,
      }));
  }

  private detectTeacherWorkloadConflict(
    candidate: ConflictSlotInput,
    existingSlots: ConflictSlotInput[],
    limit: TeacherWorkloadLimitInput | null,
  ): TimetableConflictIssue[] {
    if (!limit) return [];

    const teacherSlots = [candidate, ...existingSlots].filter(
      (slot) => slot.staffId === candidate.staffId,
    );
    const dayCount = teacherSlots.filter(
      (slot) => slot.dayOfWeek === candidate.dayOfWeek,
    ).length;
    const weekCount = teacherSlots.length;
    const issues: TimetableConflictIssue[] = [];

    if (limit.maxPeriodsPerDay && dayCount > limit.maxPeriodsPerDay) {
      issues.push({
        type: 'WORKLOAD_EXCEEDED',
        severity: 'BLOCKING',
        message: `Teacher daily workload limit exceeded (${dayCount}/${limit.maxPeriodsPerDay}).`,
        affectedPeriodIds: teacherSlots
          .filter((slot) => slot.dayOfWeek === candidate.dayOfWeek)
          .map((slot) => slot.id),
        teacherId: candidate.staffId,
        dayOfWeek: candidate.dayOfWeek,
      });
    }

    if (limit.maxPeriodsPerWeek && weekCount > limit.maxPeriodsPerWeek) {
      issues.push({
        type: 'WORKLOAD_EXCEEDED',
        severity: 'BLOCKING',
        message: `Teacher weekly workload limit exceeded (${weekCount}/${limit.maxPeriodsPerWeek}).`,
        affectedPeriodIds: teacherSlots.map((slot) => slot.id),
        teacherId: candidate.staffId,
      });
    }

    return issues;
  }

  private detectSubjectWeeklyRequirementConflict(
    candidate: ConflictSlotInput,
    existingSlots: ConflictSlotInput[],
    requirement: SubjectWeeklyRequirementInput | null,
  ): TimetableConflictIssue[] {
    if (!requirement) return [];

    const matchingSlots = [candidate, ...existingSlots].filter(
      (slot) =>
        slot.subjectId === requirement.subjectId &&
        slot.classId === requirement.classId &&
        normalizeNullable(slot.sectionId) ===
          normalizeNullable(requirement.sectionId),
    );
    const actual = matchingSlots.length;

    if (actual < requirement.requiredPeriodsPerWeek) {
      return [
        {
          type: 'SUBJECT_REQUIREMENT_MISSING',
          severity: 'BLOCKING',
          message: `Subject weekly requirement not met (${actual}/${requirement.requiredPeriodsPerWeek}).`,
          affectedPeriodIds: matchingSlots.map((slot) => slot.id),
          classId: requirement.classId,
          sectionId: requirement.sectionId ?? null,
          subjectId: requirement.subjectId,
        },
      ];
    }

    if (actual > requirement.requiredPeriodsPerWeek) {
      return [
        {
          type: 'SUBJECT_REQUIREMENT_EXCEEDED',
          severity: 'BLOCKING',
          message: `Subject weekly requirement exceeded (${actual}/${requirement.requiredPeriodsPerWeek}).`,
          affectedPeriodIds: matchingSlots.map((slot) => slot.id),
          classId: requirement.classId,
          sectionId: requirement.sectionId ?? null,
          subjectId: requirement.subjectId,
        },
      ];
    }

    return [];
  }

  private detectPeriodMismatch(
    candidate: ConflictSlotInput,
    period: {
      startsAt: string;
      endsAt: string;
      dayOfWeek: number | null;
    } | null,
  ): TimetableConflictIssue[] {
    if (!candidate.periodId || !period) return [];

    if (
      candidate.startsAt !== period.startsAt ||
      candidate.endsAt !== period.endsAt ||
      (period.dayOfWeek !== null && candidate.dayOfWeek !== period.dayOfWeek)
    ) {
      return [
        {
          type: 'PERIOD_MISMATCH',
          severity: 'BLOCKING',
          message: `Slot times (${candidate.startsAt}-${candidate.endsAt}) do not match the selected period times (${period.startsAt}-${period.endsAt}).`,
          affectedPeriodIds: [candidate.id],
          periodId: candidate.periodId,
        },
      ];
    }

    return [];
  }

  private detectOutsideSchedule(
    candidate: ConflictSlotInput,
    allPeriods: {
      id: string;
      startsAt: string;
      endsAt: string;
      dayOfWeek: number | null;
    }[],
  ): TimetableConflictIssue[] {
    if (allPeriods.length === 0) return [];

    // If a candidate doesn't match ANY of the defined periods for that day, it's outside schedule
    const matchesAny = allPeriods.some(
      (p) =>
        p.startsAt === candidate.startsAt &&
        p.endsAt === candidate.endsAt &&
        (p.dayOfWeek === null || p.dayOfWeek === candidate.dayOfWeek),
    );

    if (!matchesAny) {
      return [
        {
          type: 'OUTSIDE_SCHEDULE',
          severity: 'WARNING',
          message:
            'Slot times do not align with any configured timetable periods.',
          affectedPeriodIds: [candidate.id],
        },
      ];
    }

    return [];
  }
}

export function rangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  return (
    toMinutes(startA) < toMinutes(endB) && toMinutes(startB) < toMinutes(endA)
  );
}

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error(`Invalid timetable time: ${value}`);
  }
  return hours * 60 + minutes;
}

function normalizeNullable(value?: string | null): string {
  return value ?? '';
}

function dedupeIssues(
  issues: TimetableConflictIssue[],
): TimetableConflictIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = [
      issue.type,
      issue.severity,
      issue.teacherId ?? '',
      issue.roomId ?? '',
      issue.classId ?? '',
      issue.sectionId ?? '',
      issue.subjectId ?? '',
      issue.dayOfWeek ?? '',
      [...issue.affectedPeriodIds].sort().join('|'),
    ].join(':');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
