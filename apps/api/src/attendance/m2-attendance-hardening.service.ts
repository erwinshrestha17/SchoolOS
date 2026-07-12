import { Injectable } from '@nestjs/common';
import {
  AttendanceConflictStatus,
  AttendanceStatus,
  AudienceType,
  ConsentType,
  EnrollmentStatus,
  NotificationChannel,
  Prisma,
} from '@prisma/client';
import { getNepalSchoolDay } from '@schoolos/core';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from '../communications/communications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  M2AttendanceWindowDto,
  OfflineSyncConflictRulesDto,
  RepeatedAbsenceFollowUpDto,
  RunAttendanceCutoffDto,
  UpdateM2AttendancePolicyDto,
  UpsertM2CalendarPolicyDayDto,
} from './dto/m2-attendance-hardening.dto';

const POLICY_KEY = 'attendance.m2.hardeningPolicy';

interface M2AttendancePolicy {
  lockOverrideMinReasonLength: number;
  correctionReviewMinReasonLength: number;
  repeatedAbsenceThreshold: number;
  lateFollowUpThreshold: number;
  cutoffHour: number;
  cutoffMinute: number;
  parentNotificationChannels: NotificationChannel[];
  notifyParentsForLate: boolean;
  notifyParentsForAbsence: boolean;
  absenceMessageTemplate: string;
  lateMessageTemplate: string;
}

@Injectable()
export class M2AttendanceHardeningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly communicationsService: CommunicationsService,
  ) {}

  async getPolicy(actor: AuthContext) {
    const policy = await this.loadPolicy(actor.tenantId);
    return {
      key: POLICY_KEY,
      policy,
      hardening: {
        lockWindowOverrideRequiresReason: true,
        correctionReviewRequiresBeforeAfterAudit: true,
        duplicateSessionConflictsAreQueued: true,
        offlineSyncIsIdempotentByClientSubmissionId: true,
      },
    };
  }

  async updatePolicy(dto: UpdateM2AttendancePolicyDto, actor: AuthContext) {
    const current = await this.loadPolicy(actor.tenantId);
    const next: M2AttendancePolicy = {
      ...current,
      ...stripUndefined({
        lockOverrideMinReasonLength: dto.lockOverrideMinReasonLength,
        correctionReviewMinReasonLength: dto.correctionReviewMinReasonLength,
        repeatedAbsenceThreshold: dto.repeatedAbsenceThreshold,
        lateFollowUpThreshold: dto.lateFollowUpThreshold,
        cutoffHour: dto.cutoffHour,
        cutoffMinute: dto.cutoffMinute,
        notifyParentsForLate: dto.notifyParentsForLate,
        notifyParentsForAbsence: dto.notifyParentsForAbsence,
        absenceMessageTemplate: dto.absenceMessageTemplate,
        lateMessageTemplate: dto.lateMessageTemplate,
      }),
      parentNotificationChannels: dto.parentNotificationChannels
        ? normalizeChannels(dto.parentNotificationChannels)
        : current.parentNotificationChannels,
    };

    await this.prisma.tenantSetting.upsert({
      where: { tenantId_key: { tenantId: actor.tenantId, key: POLICY_KEY } },
      update: { value: next as unknown as Prisma.InputJsonValue },
      create: {
        tenantId: actor.tenantId,
        key: POLICY_KEY,
        value: next as unknown as Prisma.InputJsonValue,
      },
    });

    await this.auditService.record({
      action: 'm2_policy_update',
      resource: 'attendance_policy',
      tenantId: actor.tenantId,
      userId: actor.userId,
      before: current,
      after: next,
    });

    return { key: POLICY_KEY, policy: next };
  }

  getSupportedStates() {
    return {
      persisted: [
        state('PRESENT', 'Present', true),
        state('ABSENT', 'Absent', true),
        state('LATE', 'Late', true),
        state('HALF_DAY', 'Half-day', true),
        state('EXCUSED_LEAVE', 'Excused', true),
        state('SICK_LEAVE', 'Sick leave', true),
        state('HOLIDAY', 'Holiday', true),
        state('LEAVE', 'Leave', true),
        state('ON_LEAVE', 'On leave', true),
        state('UNEXCUSED_LEAVE', 'Unexcused leave', true),
      ],
      virtual: [
        state('SCHOOL_EVENT', 'School event', false),
        state('NOT_MARKED', 'Not marked', false),
      ],
      supportPolicy:
        'SCHOOL_EVENT and NOT_MARKED are computed policy states. They are not written into AttendanceRecord until the Prisma enum is expanded by migration.',
    };
  }

  async getHardeningAnomalies(
    query: M2AttendanceWindowDto,
    actor: AuthContext,
  ) {
    const { fromDate, toDate } = resolveWindow(query, 30);
    const sessions = await this.prisma.attendanceSession.findMany({
      where: {
        tenantId: actor.tenantId,
        attendanceDate: { gte: fromDate, lte: toDate },
        ...(query.classId ? { classId: query.classId } : {}),
        ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      },
      include: { records: true, class: true, section: true },
      orderBy: [{ attendanceDate: 'desc' }],
      take: 250,
    });
    const calendar = await this.loadCalendarMap(
      actor.tenantId,
      fromDate,
      toDate,
    );
    const anomalies: Array<Record<string, unknown>> = [];

    for (const session of sessions) {
      const day = calendar.get(dateKey(session.attendanceDate));
      const rosterCount = await this.prisma.enrollment.count({
        where: {
          tenantId: actor.tenantId,
          academicYearId: session.academicYearId,
          classId: session.classId,
          sectionId: session.sectionId ?? null,
          status: EnrollmentStatus.ACTIVE,
        },
      });
      if (session.records.length === 0) {
        anomalies.push(
          baseAnomaly(
            'NOT_MARKED_SESSION',
            'Session exists but no student records were marked',
            session,
            'HIGH',
          ),
        );
      }
      if (rosterCount > session.records.length) {
        anomalies.push({
          ...baseAnomaly(
            'MISSING_ROSTER_RECORDS',
            'Some active roster students are missing attendance records',
            session,
            'HIGH',
          ),
          expectedRosterCount: rosterCount,
          actualRecordCount: session.records.length,
        });
      }
      if (day && !day.isWorkingDay && session.records.length > 0) {
        anomalies.push({
          ...baseAnomaly(
            'NON_WORKING_DAY_MARKED',
            'Attendance was marked on a non-working calendar day',
            session,
            'MEDIUM',
          ),
          calendarLabel: day.label,
          holidayType: day.holidayType,
        });
      }
      if (day?.holidayType === 'EXAM_DAY') {
        const invalid = session.records.filter(
          (record) => record.status === AttendanceStatus.HOLIDAY,
        );
        if (invalid.length > 0) {
          anomalies.push({
            ...baseAnomaly(
              'EXAM_DAY_HOLIDAY_STATUS',
              'Exam day should not be treated as a generic holiday for marked students',
              session,
              'MEDIUM',
            ),
            affectedRecordCount: invalid.length,
          });
        }
      }
      const totals = summarize(session.records);
      if (
        session.records.length > 0 &&
        totals.absent / session.records.length >= 0.5
      ) {
        anomalies.push({
          ...baseAnomaly(
            'HIGH_ABSENCE_RATE',
            'More than half of marked students are absent in the same session',
            session,
            'MEDIUM',
          ),
          totals,
        });
      }
    }

    await this.auditService.record({
      action: 'm2_anomaly_hardening_review',
      resource: 'attendance_session',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: { fromDate, toDate, anomalyCount: anomalies.length },
    });

    return { fromDate, toDate, total: anomalies.length, anomalies };
  }

  async getConflictAudit(query: M2AttendanceWindowDto, actor: AuthContext) {
    const { fromDate, toDate } = resolveWindow(query, 30);
    const conflicts = await this.prisma.attendanceConflict.findMany({
      where: {
        tenantId: actor.tenantId,
        attendanceSession: {
          attendanceDate: { gte: fromDate, lte: toDate },
          ...(query.classId ? { classId: query.classId } : {}),
          ...(query.sectionId ? { sectionId: query.sectionId } : {}),
        },
      },
      include: {
        attendanceSession: { include: { class: true, section: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    });

    return {
      total: conflicts.length,
      items: conflicts.map((conflict) => ({
        id: conflict.id,
        attendanceSessionId: conflict.attendanceSessionId,
        status: conflict.status,
        decision: conflict.decision,
        submittedById: conflict.submittedById,
        reviewedById: conflict.reviewedById,
        reviewedAt: conflict.reviewedAt?.toISOString() ?? null,
        createdAt: conflict.createdAt.toISOString(),
        session: formatSession(conflict.attendanceSession),
        hardeningFlags: {
          pendingReview: conflict.status === AttendanceConflictStatus.FLAGGED,
          hasPreviousPayload: Boolean(conflict.previousPayload),
          hasIncomingPayload: Boolean(conflict.incomingPayload),
          concurrentOrDuplicateLikely:
            conflict.attendanceSession.conflictStatus ===
            AttendanceConflictStatus.FLAGGED,
        },
      })),
    };
  }

  async getCorrectionAudit(query: M2AttendanceWindowDto, actor: AuthContext) {
    const { fromDate, toDate } = resolveWindow(query, 30);
    const corrections = await this.prisma.attendanceCorrectionRequest.findMany({
      where: {
        tenantId: actor.tenantId,
        attendanceDate: { gte: fromDate, lte: toDate },
        ...(query.classId || query.sectionId
          ? {
              student: {
                ...(query.classId ? { classId: query.classId } : {}),
                ...(query.sectionId ? { sectionId: query.sectionId } : {}),
              },
            }
          : {}),
      },
      include: { student: true, record: true, session: true },
      orderBy: [{ requestedAt: 'desc' }],
      take: 100,
    });

    return {
      total: corrections.length,
      items: corrections.map((request) => ({
        id: request.id,
        status: request.status,
        studentId: request.studentId,
        studentSystemId: request.student.studentSystemId,
        fullNameEn:
          `${request.student.firstNameEn} ${request.student.lastNameEn}`.trim(),
        attendanceDate: request.attendanceDate.toISOString(),
        previousStatus:
          request.previousStatus ?? request.record?.status ?? null,
        requestedStatus: request.requestedStatus,
        requestedById: request.requestedById,
        reviewedById: request.reviewedById,
        reviewedAt: request.reviewedAt?.toISOString() ?? null,
        auditFlags: {
          hasBeforeStatus: Boolean(
            request.previousStatus ?? request.record?.status,
          ),
          hasReviewReason: Boolean(request.reviewReason || request.reviewNote),
          sessionLocked: request.session
            ? request.session.lockAt <= new Date()
            : null,
          pending: request.status === 'PENDING',
        },
      })),
    };
  }

  async getCalendarPolicy(query: M2AttendanceWindowDto, actor: AuthContext) {
    const { fromDate, toDate } = resolveWindow(query, 30, 90);
    const stored = await this.loadCalendarMap(actor.tenantId, fromDate, toDate);
    const items = eachDate(fromDate, toDate).map((date) => {
      const key = dateKey(date);
      const explicit = stored.get(key);
      const weekend = isWeekend(date);
      const holidayType = explicit?.holidayType ?? (weekend ? 'WEEKEND' : null);
      return {
        date: key,
        isWorkingDay: explicit?.isWorkingDay ?? !weekend,
        label: explicit?.label ?? (weekend ? 'Weekend' : null),
        holidayType,
        isExamDay: holidayType === 'EXAM_DAY',
        isSchoolEvent: holidayType === 'SCHOOL_EVENT',
        source: explicit
          ? 'explicit_calendar_day'
          : weekend
            ? 'derived_weekend'
            : 'derived_working_day',
        policy: calendarPolicyFor(
          holidayType,
          explicit?.isWorkingDay ?? !weekend,
        ),
      };
    });
    return { fromDate, toDate, items };
  }

  async upsertCalendarPolicyDay(
    dto: UpsertM2CalendarPolicyDayDto,
    actor: AuthContext,
  ) {
    const calendarDate = stripTime(new Date(dto.calendarDate));
    const holidayType = dto.isExamDay
      ? 'EXAM_DAY'
      : dto.isSchoolEvent
        ? 'SCHOOL_EVENT'
        : (dto.holidayType ?? null);
    const isWorkingDay =
      dto.isWorkingDay ??
      (dto.isExamDay ? true : dto.isSchoolEvent ? false : true);
    const day = await this.prisma.schoolCalendarDay.upsert({
      where: {
        tenantId_calendarDate: { tenantId: actor.tenantId, calendarDate },
      },
      update: { isWorkingDay, holidayType, label: dto.label ?? null },
      create: {
        tenantId: actor.tenantId,
        calendarDate,
        isWorkingDay,
        holidayType,
        label: dto.label ?? null,
      },
    });
    await this.auditService.record({
      action: 'm2_calendar_policy_upsert',
      resource: 'school_calendar_day',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: day.id,
      after: {
        calendarDate,
        isWorkingDay,
        holidayType,
        label: day.label,
        policyMetadata: dto.policyMetadata ?? null,
      },
    });
    return {
      ...day,
      policy: calendarPolicyFor(day.holidayType, day.isWorkingDay),
    };
  }

  async runAttendanceCutoff(dto: RunAttendanceCutoffDto, actor: AuthContext) {
    const policy = await this.loadPolicy(actor.tenantId);
    const attendanceDate = stripTime(
      dto.attendanceDate ? new Date(dto.attendanceDate) : new Date(),
    );
    const cutoffAt = new Date(attendanceDate);
    cutoffAt.setHours(policy.cutoffHour, policy.cutoffMinute, 0, 0);
    const dryRun = dto.dryRun ?? true;
    const academicYear = dto.academicYearId
      ? await this.prisma.academicYear.findFirst({
          where: { tenantId: actor.tenantId, id: dto.academicYearId },
        })
      : await this.prisma.academicYear.findFirst({
          where: { tenantId: actor.tenantId, isCurrent: true },
        });
    if (!academicYear)
      return {
        dryRun,
        attendanceDate,
        cutoffAt,
        created: 0,
        missingScopes: [],
        skippedReason: 'current_academic_year_not_found',
      };
    const calendar = await this.loadCalendarMap(
      actor.tenantId,
      attendanceDate,
      attendanceDate,
    );
    const day = calendar.get(dateKey(attendanceDate));
    if ((day && !day.isWorkingDay) || (!day && isWeekend(attendanceDate))) {
      return {
        dryRun,
        attendanceDate,
        cutoffAt,
        created: 0,
        missingScopes: [],
        skippedReason: 'non_working_day',
      };
    }
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        tenantId: actor.tenantId,
        academicYearId: academicYear.id,
        status: EnrollmentStatus.ACTIVE,
        ...(dto.classId ? { classId: dto.classId } : {}),
        ...(dto.sectionId ? { sectionId: dto.sectionId } : {}),
      },
      include: { class: true, section: true },
      take: 3000,
    });
    const scopes = new Map<
      string,
      {
        academicYearId: string;
        classId: string;
        sectionId: string | null;
        className: string;
        sectionName: string | null;
        rosterCount: number;
      }
    >();
    for (const enrollment of enrollments) {
      const key = `${enrollment.academicYearId}:${enrollment.classId}:${enrollment.sectionId ?? 'none'}`;
      const existing = scopes.get(key) ?? {
        academicYearId: enrollment.academicYearId,
        classId: enrollment.classId,
        sectionId: enrollment.sectionId ?? null,
        className: enrollment.class.name,
        sectionName: enrollment.section?.name ?? null,
        rosterCount: 0,
      };
      existing.rosterCount += 1;
      scopes.set(key, existing);
    }
    const missingScopes = [] as Array<Record<string, unknown>>;
    let created = 0;
    for (const scope of scopes.values()) {
      const existing = await this.prisma.attendanceSession.findFirst({
        where: {
          tenantId: actor.tenantId,
          attendanceDate,
          classId: scope.classId,
          sectionId: scope.sectionId,
        },
      });
      if (!existing) {
        missingScopes.push({
          ...scope,
          virtualStatus: 'NOT_MARKED',
          action: dryRun
            ? 'would_create_locked_unmarked_session'
            : 'created_locked_unmarked_session',
        });
        if (!dryRun) {
          await this.prisma.attendanceSession.create({
            data: {
              tenantId: actor.tenantId,
              academicYearId: scope.academicYearId,
              classId: scope.classId,
              sectionId: scope.sectionId,
              attendanceDate,
              lockAt: cutoffAt,
              conflictStatus: AttendanceConflictStatus.FLAGGED,
            },
          });
          created += 1;
        }
      }
    }
    await this.auditService.record({
      action: dryRun ? 'm2_cutoff_preview' : 'm2_cutoff_run',
      resource: 'attendance_session',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        attendanceDate,
        cutoffAt,
        missingScopeCount: missingScopes.length,
        created,
      },
    });
    return { dryRun, attendanceDate, cutoffAt, created, missingScopes };
  }

  async getFollowUpQueue(
    query: RepeatedAbsenceFollowUpDto,
    actor: AuthContext,
  ) {
    const policy = await this.loadPolicy(actor.tenantId);
    const threshold = query.threshold ?? policy.repeatedAbsenceThreshold;
    const { fromDate, toDate } = resolveWindow(query, 30);
    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        tenantId: actor.tenantId,
        status: {
          in: [
            AttendanceStatus.ABSENT,
            AttendanceStatus.LATE,
            AttendanceStatus.SICK_LEAVE,
            AttendanceStatus.UNEXCUSED_LEAVE,
          ],
        },
        attendanceSession: {
          attendanceDate: { gte: fromDate, lte: toDate },
          ...(query.classId ? { classId: query.classId } : {}),
          ...(query.sectionId ? { sectionId: query.sectionId } : {}),
        },
      },
      include: {
        student: {
          include: {
            guardianLinks: { include: { guardian: true } },
            class: true,
            sectionRef: true,
          },
        },
        attendanceSession: true,
      },
      orderBy: { attendanceSession: { attendanceDate: 'desc' } },
      take: 3000,
    });
    const byStudent = new Map<string, typeof records>();
    for (const record of records)
      byStudent.set(record.studentId, [
        ...(byStudent.get(record.studentId) ?? []),
        record,
      ]);
    const items = Array.from(byStudent.entries())
      .map(([studentId, studentRecords]) => {
        const absences = studentRecords.filter(
          (record) =>
            record.status === AttendanceStatus.ABSENT ||
            record.status === AttendanceStatus.UNEXCUSED_LEAVE,
        ).length;
        const lates = studentRecords.filter(
          (record) => record.status === AttendanceStatus.LATE,
        ).length;
        const consecutiveAbsences = countConsecutive(
          studentRecords.map((record) => ({
            date: record.attendanceSession.attendanceDate,
            status: record.status,
          })),
        );
        const sample = studentRecords[0];
        return {
          studentId,
          studentSystemId: sample.student.studentSystemId,
          fullNameEn:
            `${sample.student.firstNameEn} ${sample.student.lastNameEn}`.trim(),
          className: sample.student.class.name,
          sectionName:
            sample.student.sectionRef?.name ?? sample.student.section ?? null,
          guardianCount: sample.student.guardianLinks.length,
          absences,
          lates,
          consecutiveAbsences,
          threshold,
          needsFollowUp:
            absences >= threshold ||
            consecutiveAbsences >= threshold ||
            lates >= policy.lateFollowUpThreshold,
          recommendedChannels: policy.parentNotificationChannels,
        };
      })
      .filter((item) => item.needsFollowUp)
      .sort(
        (a, b) =>
          b.consecutiveAbsences - a.consecutiveAbsences ||
          b.absences - a.absences,
      );
    return { fromDate, toDate, threshold, total: items.length, items };
  }

  async runFollowUpAutomation(
    query: RepeatedAbsenceFollowUpDto,
    actor: AuthContext,
  ) {
    const dryRun = query.dryRun ?? true;
    const policy = await this.loadPolicy(actor.tenantId);
    const queue = await this.getFollowUpQueue(query, actor);
    let deliveryCount = 0;
    if (!dryRun) {
      for (const item of queue.items) {
        const body = policy.absenceMessageTemplate
          .replace('{studentName}', item.fullNameEn)
          .replace('{count}', String(item.absences))
          .replace('{threshold}', String(item.threshold));
        const sourceType = 'attendance_repeated_absence_follow_up';
        const sourceId = `${dateKey(new Date())}:${item.studentId}:${item.absences}:${item.consecutiveAbsences}`;
        const alreadySent = await this.prisma.notificationDelivery.findFirst({
          where: {
            tenantId: actor.tenantId,
            sourceType,
            sourceId,
          },
        });
        if (alreadySent) {
          continue;
        }

        const delivery = await this.communicationsService.recordDeliveryRecords(
          {
            actor,
            sourceType,
            sourceId,
            audienceType: AudienceType.ALL,
            studentIds: [item.studentId],
            title: 'Attendance follow-up needed',
            body,
            channels: policy.parentNotificationChannels,
            requiredConsentTypes: [ConsentType.MESSAGING],
            communicationCategory: 'ESSENTIAL',
          },
        );
        deliveryCount += delivery.count;
      }
    }
    await this.auditService.record({
      action: dryRun ? 'm2_follow_up_preview' : 'm2_follow_up_dispatch',
      resource: 'attendance_follow_up',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: { queueCount: queue.total, deliveryCount, dryRun },
    });
    return { dryRun, deliveryCount, ...queue };
  }

  async listOfflineSyncConflicts(
    query: OfflineSyncConflictRulesDto,
    actor: AuthContext,
  ) {
    const { fromDate, toDate } = resolveWindow(query, 30);
    const submissions = await this.prisma.attendanceSyncSubmission.findMany({
      where: {
        tenantId: actor.tenantId,
        attendanceDate: { gte: fromDate, lte: toDate },
        ...(query.classId ? { classId: query.classId } : {}),
        ...(query.sectionId ? { sectionId: query.sectionId } : {}),
        ...(query.status
          ? { syncStatus: query.status.toUpperCase() as never }
          : {
              OR: [
                { syncStatus: 'CONFLICTED' },
                { syncStatus: 'REJECTED' },
                { syncAttemptCount: { gt: 1 } },
              ],
            }),
      },
      orderBy: [{ serverReceivedAt: 'desc' }],
      take: query.limit ?? 50,
    });
    return {
      total: submissions.length,
      rules: {
        idempotency:
          'tenantId + clientSubmissionId replays are not applied again; attempt count increments.',
        staleDeviceTimestamp:
          'Older device payloads must not overwrite newer submitted sessions.',
        ownerMismatch:
          'Existing sessions submitted by a different user are flagged as conflicts.',
        fingerprintMismatch:
          'Different device/session fingerprints are conflict metadata, not silent overwrites.',
      },
      items: submissions.map((submission) => ({
        id: submission.id,
        clientSubmissionId: submission.clientSubmissionId,
        attendanceSessionId: submission.attendanceSessionId,
        conflictId: submission.conflictId,
        syncStatus: submission.syncStatus,
        rejectionReason: submission.rejectionReason,
        syncAttemptCount: submission.syncAttemptCount,
        deviceId: submission.deviceId,
        deviceLabel: submission.deviceLabel,
        attendanceDate: submission.attendanceDate.toISOString(),
        serverReceivedAt: submission.serverReceivedAt.toISOString(),
      })),
    };
  }

  private async loadPolicy(tenantId: string): Promise<M2AttendancePolicy> {
    const setting = await this.prisma.tenantSetting.findUnique({
      where: { tenantId_key: { tenantId, key: POLICY_KEY } },
    });
    return coercePolicy(setting?.value);
  }

  private async loadCalendarMap(
    tenantId: string,
    fromDate: Date,
    toDate: Date,
  ) {
    const rows = await this.prisma.schoolCalendarDay.findMany({
      where: { tenantId, calendarDate: { gte: fromDate, lte: toDate } },
    });
    return new Map(rows.map((row) => [dateKey(row.calendarDate), row]));
  }
}

function defaultPolicy(): M2AttendancePolicy {
  return {
    lockOverrideMinReasonLength: 8,
    correctionReviewMinReasonLength: 8,
    repeatedAbsenceThreshold: 3,
    lateFollowUpThreshold: 4,
    cutoffHour: 16,
    cutoffMinute: 0,
    parentNotificationChannels: [
      NotificationChannel.PUSH,
      NotificationChannel.SMS,
    ],
    notifyParentsForLate: true,
    notifyParentsForAbsence: true,
    absenceMessageTemplate:
      '{studentName} has reached {count} absence marks. Please contact the school if support or correction is needed.',
    lateMessageTemplate:
      '{studentName} has repeated late marks. Please contact the school if transport or timing support is needed.',
  };
}

function coercePolicy(value: Prisma.JsonValue | undefined): M2AttendancePolicy {
  const base = defaultPolicy();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return base;
  const object = value as Record<string, unknown>;
  return {
    ...base,
    ...stripUndefined({
      lockOverrideMinReasonLength: readNumber(
        object.lockOverrideMinReasonLength,
      ),
      correctionReviewMinReasonLength: readNumber(
        object.correctionReviewMinReasonLength,
      ),
      repeatedAbsenceThreshold: readNumber(object.repeatedAbsenceThreshold),
      lateFollowUpThreshold: readNumber(object.lateFollowUpThreshold),
      cutoffHour: readNumber(object.cutoffHour),
      cutoffMinute: readNumber(object.cutoffMinute),
      notifyParentsForLate: readBoolean(object.notifyParentsForLate),
      notifyParentsForAbsence: readBoolean(object.notifyParentsForAbsence),
      absenceMessageTemplate: readString(object.absenceMessageTemplate),
      lateMessageTemplate: readString(object.lateMessageTemplate),
    }),
    parentNotificationChannels: Array.isArray(object.parentNotificationChannels)
      ? normalizeChannels(
          object.parentNotificationChannels.filter(
            (item): item is string => typeof item === 'string',
          ),
        )
      : base.parentNotificationChannels,
  };
}

function normalizeChannels(values: string[]): NotificationChannel[] {
  const allowed = new Set(Object.values(NotificationChannel));
  const channels = values
    .map((value) => value.trim().toUpperCase())
    .filter((value): value is NotificationChannel =>
      allowed.has(value as NotificationChannel),
    );
  return channels.length > 0
    ? [...new Set(channels)]
    : defaultPolicy().parentNotificationChannels;
}

function resolveWindow(
  query: M2AttendanceWindowDto,
  defaultDays: number,
  maxDays = 120,
) {
  const toDate = stripTime(query.toDate ? new Date(query.toDate) : new Date());
  const fromDate = stripTime(
    query.fromDate ? new Date(query.fromDate) : new Date(toDate),
  );
  if (!query.fromDate) fromDate.setDate(toDate.getDate() - defaultDays + 1);
  const maxFrom = new Date(toDate);
  maxFrom.setDate(toDate.getDate() - maxDays + 1);
  return { fromDate: fromDate < maxFrom ? maxFrom : fromDate, toDate };
}

function eachDate(fromDate: Date, toDate: Date) {
  const dates: Date[] = [];
  for (
    const cursor = new Date(fromDate);
    cursor <= toDate;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    dates.push(new Date(cursor));
  }
  return dates;
}

function baseAnomaly(
  code: string,
  message: string,
  session: {
    id: string;
    attendanceDate: Date;
    class: { name: string };
    section: { name: string } | null;
  },
  severity: string,
) {
  return {
    code,
    severity,
    message,
    sessionId: session.id,
    attendanceDate: session.attendanceDate.toISOString(),
    className: session.class.name,
    sectionName: session.section?.name ?? null,
  };
}

function formatSession(session: {
  id: string;
  attendanceDate: Date;
  class: { name: string };
  section: { name: string } | null;
  conflictStatus: AttendanceConflictStatus;
}) {
  return {
    id: session.id,
    attendanceDate: session.attendanceDate.toISOString(),
    className: session.class.name,
    sectionName: session.section?.name ?? null,
    conflictStatus: session.conflictStatus,
  };
}

function summarize(records: Array<{ status: AttendanceStatus }>) {
  return records.reduce(
    (totals, record) => {
      totals.total += 1;
      if (record.status === AttendanceStatus.PRESENT) totals.present += 1;
      else if (record.status === AttendanceStatus.ABSENT) totals.absent += 1;
      else if (record.status === AttendanceStatus.LATE) totals.late += 1;
      else if (record.status === AttendanceStatus.HALF_DAY) {
        totals.present += 0.5;
        totals.absent += 0.5;
        totals.halfDay += 1;
      } else if (record.status === AttendanceStatus.HOLIDAY)
        totals.holiday += 1;
      else totals.leave += 1;
      return totals;
    },
    {
      present: 0,
      absent: 0,
      late: 0,
      halfDay: 0,
      leave: 0,
      holiday: 0,
      total: 0,
    },
  );
}

function countConsecutive(
  records: Array<{ date: Date; status: AttendanceStatus }>,
) {
  const sorted = [...records].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );
  let count = 0;
  for (const record of sorted) {
    if (
      record.status === AttendanceStatus.ABSENT ||
      record.status === AttendanceStatus.UNEXCUSED_LEAVE
    )
      count += 1;
    else break;
  }
  return count;
}

function calendarPolicyFor(
  holidayType: string | null | undefined,
  isWorkingDay: boolean,
) {
  if (holidayType === 'EXAM_DAY')
    return 'exam_day_attendance_allowed_with_exam_wording';
  if (holidayType === 'SCHOOL_EVENT')
    return 'school_event_virtual_state_no_absence_penalty';
  if (!isWorkingDay)
    return 'holiday_or_weekend_attendance_blocked_unless_override';
  return 'regular_working_day';
}

function state(code: string, label: string, persisted: boolean) {
  return { code, label, persisted };
}

function stripTime(value: Date) {
  return new Date(`${getNepalSchoolDay(value).gregorianDate}T00:00:00.000Z`);
}

function dateKey(value: Date) {
  return stripTime(value).toISOString().slice(0, 10);
}

function isWeekend(value: Date) {
  const [year, month, day] = getNepalSchoolDay(value)
    .gregorianDate.split('-')
    .map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 6;
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function readBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function stripUndefined<T extends Record<string, unknown>>(
  value: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as Partial<T>;
}
