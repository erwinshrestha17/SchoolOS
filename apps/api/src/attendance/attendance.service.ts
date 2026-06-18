import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  AttendanceConflictDecision,
  AttendanceConflictStatus,
  AttendanceSyncRejectionReason,
  AttendanceSyncStatus,
  AttendanceStatus,
  AudienceType,
  ConsentType,
  EnrollmentStatus,
  NotificationChannel,
  Prisma,
  TimetableVersionStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from '../communications/communications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustLeaveBalanceDto } from './dto/adjust-leave-balance.dto';
import { CorrectStaffAttendanceDto } from './dto/correct-staff-attendance.dto';
import { ReviewAttendanceConflictDto } from './dto/review-attendance-conflict.dto';
import { CreateStaffLeaveRequestDto } from './dto/create-staff-leave-request.dto';
import { AttendanceConflictReviewDecision } from './dto/review-attendance-conflict.dto';
import { ListAttendanceSummaryDto } from './dto/list-attendance-summary.dto';
import {
  AttendanceOverrideSource,
  OverrideAttendanceSessionDto,
} from './dto/override-attendance-session.dto';
import { ListStaffAttendanceSummaryDto } from './dto/list-staff-attendance-summary.dto';
import { ReviewStaffLeaveRequestDto } from './dto/review-staff-leave-request.dto';
import { SubmitStaffAttendanceDto } from './dto/submit-staff-attendance.dto';
import {
  AttendanceExceptionDto,
  SubmitAttendanceDto,
} from './dto/submit-attendance.dto';
import { SyncAttendanceDto } from './dto/sync-attendance.dto';
import { UpsertCalendarDayDto } from './dto/upsert-calendar-day.dto';
import {
  buildStudentScopeFilter,
  getParentStudentIds,
  getStudentOwnId,
} from '../common/security/parent-scope';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SettingsService } from '../settings/settings.service';
import { CreateAttendanceCorrectionDto } from './dto/create-attendance-correction.dto';
import { ReviewAttendanceCorrectionDto } from './dto/review-attendance-correction.dto';
import { ListAttendanceCorrectionRequestsDto } from './dto/list-attendance-correction-requests.dto';
import { GetMonthlyRegisterDto } from './dto/get-monthly-register.dto';
import { GetStudentHistoryDto } from './dto/get-student-history.dto';
import { UpsertAttendanceDraftDto } from './dto/upsert-attendance-draft.dto';
import { buildRosterPdf } from '../common/pdf/simple-pdf';
import { FileRegistryService } from '../file-registry/file-registry.service';

const M2_ATTENDANCE_HARDENING_POLICY_KEY = 'attendance.m2.hardeningPolicy';
const DEFAULT_M2_ATTENDANCE_POLICY = {
  lockOverrideMinReasonLength: 8,
  correctionReviewMinReasonLength: 8,
  parentNotificationChannels: [
    NotificationChannel.PUSH,
    NotificationChannel.SMS,
  ],
  notifyParentsForLate: true,
  notifyParentsForAbsence: true,
  absenceMessageTemplate:
    'Your child was marked absent today. Please contact the school office if this needs review.',
  lateMessageTemplate:
    'Your child was marked late today. Please contact the school office if this needs review.',
};

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly communicationsService: CommunicationsService,
    private readonly auditService: AuditService,
    private readonly eventEmitter: EventEmitter2,
    private readonly settingsService: SettingsService,
    @Optional()
    private readonly fileRegistryService?: FileRegistryService,
  ) {}

  async listTeacherMobileClassSections(actor: AuthContext) {
    const staff = await this.prisma.staff.findFirst({
      where: { userId: actor.userId, tenantId: actor.tenantId },
      select: { id: true },
    });

    if (!staff) {
      return { items: [] };
    }

    const currentAcademicYear = await this.prisma.academicYear.findFirst({
      where: { tenantId: actor.tenantId, isCurrent: true },
      select: { id: true, name: true },
    });

    if (!currentAcademicYear) {
      return { items: [] };
    }

    const [assignments, classTeacherSections] = await Promise.all([
      this.prisma.subjectTeacherAssignment.findMany({
        where: {
          tenantId: actor.tenantId,
          staffId: staff.id,
          academicYearId: currentAcademicYear.id,
        },
        include: {
          academicYear: { select: { id: true, name: true } },
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
          subject: { select: { name: true } },
        },
        orderBy: [{ class: { level: 'asc' } }, { createdAt: 'asc' }],
        take: 100,
      }),
      this.prisma.section.findMany({
        where: { tenantId: actor.tenantId, classTeacherId: staff.id },
        include: {
          class: { select: { id: true, name: true, level: true } },
        },
        orderBy: [{ class: { level: 'asc' } }, { name: 'asc' }],
        take: 100,
      }),
    ]);

    const items = new Map<
      string,
      {
        id: string;
        academicYearId: string;
        academicYearName: string;
        classId: string;
        sectionId: string | null;
        name: string;
        subjectNames: Set<string>;
      }
    >();

    const addItem = (input: {
      academicYearId: string;
      academicYearName: string;
      classId: string;
      className: string;
      sectionId: string | null;
      sectionName?: string | null;
      subjectName: string;
    }) => {
      const key = `${input.academicYearId}:${input.classId}:${input.sectionId ?? 'none'}`;
      const existing = items.get(key);
      if (existing) {
        existing.subjectNames.add(input.subjectName);
        return;
      }

      items.set(key, {
        id: key,
        academicYearId: input.academicYearId,
        academicYearName: input.academicYearName,
        classId: input.classId,
        sectionId: input.sectionId,
        name: input.sectionName
          ? `${input.className} - ${input.sectionName}`
          : input.className,
        subjectNames: new Set([input.subjectName]),
      });
    };

    assignments.forEach((assignment) => {
      addItem({
        academicYearId: assignment.academicYearId,
        academicYearName: assignment.academicYear.name,
        classId: assignment.classId,
        className: assignment.class.name,
        sectionId: assignment.sectionId ?? null,
        sectionName: assignment.section?.name,
        subjectName: assignment.subject.name,
      });
    });

    classTeacherSections.forEach((section) => {
      addItem({
        academicYearId: currentAcademicYear.id,
        academicYearName: currentAcademicYear.name,
        classId: section.classId,
        className: section.class.name,
        sectionId: section.id,
        sectionName: section.name,
        subjectName: 'Class teacher',
      });
    });

    return {
      items: Array.from(items.values())
        .map(({ subjectNames, ...item }) => ({
          ...item,
          subject: Array.from(subjectNames).join(', '),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  async getTeacherMobileToday(actor: AuthContext, dateInput?: string) {
    const date = stripTime(dateInput ? new Date(dateInput) : new Date());
    const classesResult = await this.listTeacherMobileClassSections(actor);
    const staff = await this.prisma.staff.findFirst({
      where: { userId: actor.userId, tenantId: actor.tenantId },
      select: { id: true },
    });

    if (!staff || classesResult.items.length === 0) {
      return {
        date: date.toISOString(),
        periods: [],
        classes: [],
        pendingAttendanceCount: 0,
      };
    }

    const classScopes = classesResult.items.map((item) => ({
      classId: item.classId,
      sectionId: item.sectionId,
    }));
    const [sessions, periods] = await Promise.all([
      this.prisma.attendanceSession.findMany({
        where: {
          tenantId: actor.tenantId,
          attendanceDate: date,
          OR: classScopes,
        },
        select: {
          classId: true,
          sectionId: true,
          submittedAt: true,
          lockAt: true,
          conflictStatus: true,
        },
        take: 100,
      }),
      this.prisma.timetableSlot.findMany({
        where: {
          tenantId: actor.tenantId,
          staffId: staff.id,
          academicYearId: classesResult.items[0].academicYearId,
          dayOfWeek: toIsoWeekday(date),
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
        select: {
          id: true,
          academicYearId: true,
          classId: true,
          sectionId: true,
          startsAt: true,
          endsAt: true,
          class: { select: { name: true } },
          section: { select: { name: true } },
          subject: { select: { name: true } },
        },
        orderBy: [{ startsAt: 'asc' }],
        take: 30,
      }),
    ]);

    const sessionByScope = new Map(
      sessions.map((session) => [
        `${session.classId}:${session.sectionId ?? 'none'}`,
        session,
      ]),
    );
    const now = new Date();
    const classes = classesResult.items.map((item) => {
      const session = sessionByScope.get(
        `${item.classId}:${item.sectionId ?? 'none'}`,
      );
      return {
        ...item,
        attendance: {
          submittedAt: session?.submittedAt ?? null,
          lockAt: session?.lockAt ?? null,
          isSubmitted: Boolean(session?.submittedAt),
          isLocked: Boolean(session && session.lockAt <= now),
          conflictStatus: session?.conflictStatus ?? 'NONE',
        },
      };
    });

    return {
      date: date.toISOString(),
      periods: periods.map((period) => ({
        id: period.id,
        academicYearId: period.academicYearId,
        classId: period.classId,
        sectionId: period.sectionId,
        className: period.section?.name
          ? `${period.class.name} - ${period.section.name}`
          : period.class.name,
        subjectName: period.subject.name,
        startsAt: period.startsAt,
        endsAt: period.endsAt,
      })),
      classes,
      pendingAttendanceCount: classes.filter((item) => {
        const isClassTeacher = item.subject.includes('Class teacher');
        const isScheduledToday = periods.some(
          (period) =>
            period.classId === item.classId &&
            period.sectionId === item.sectionId,
        );
        return (
          (isClassTeacher || isScheduledToday) &&
          !item.attendance.isSubmitted &&
          !item.attendance.isLocked
        );
      }).length,
    };
  }

  async listAttendance(actor: AuthContext) {
    const studentScope = await buildStudentScopeFilter(this.prisma, actor);

    // Teacher filtering
    const teacherSectionIds = await this.getTeacherSectionIds(
      actor,
      studentScope,
    );

    const sessions = await this.prisma.attendanceSession.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(teacherSectionIds ? { sectionId: { in: teacherSectionIds } } : {}),
      },
      include: {
        class: true,
        section: true,
        records: {
          where:
            Object.keys(studentScope).length > 0 ? studentScope : undefined,
        },
      },
      orderBy: [{ attendanceDate: 'desc' }],
      take: 30,
    });

    // For parents, filter out sessions that have no matching records
    const filteredSessions =
      Object.keys(studentScope).length > 0
        ? sessions.filter((s) => s.records.length > 0)
        : sessions;

    const calendarByDate = await this.loadCalendarDayMap(
      actor.tenantId,
      filteredSessions.map((session) => session.attendanceDate),
    );

    return filteredSessions.map((session) => ({
      sessionId: session.id,
      attendanceDate: session.attendanceDate,
      className: session.class.name,
      sectionName: session.section?.name ?? null,
      submittedAt: session.submittedAt,
      lockAt: session.lockAt,
      calendarDay: calendarByDate.get(
        getDateKey(stripTime(session.attendanceDate)),
      ),
      totals: summarizeAttendance(session.records),
    }));
  }

  async submitAttendance(
    dto: SubmitAttendanceDto,
    actor: AuthContext,
    submissionContext?: AttendanceSubmissionContext,
  ) {
    await this.validateAttendanceScope(actor, {
      academicYearId: dto.academicYearId,
      classId: dto.classId,
      sectionId: dto.sectionId,
    });
    const attendanceDate = stripTime(new Date(dto.attendanceDate));
    const today = stripTime(new Date());

    if (attendanceDate > today) {
      throw new ForbiddenException('Cannot submit attendance for future dates');
    }
    const calendarDay = await this.resolveCalendarDay(
      actor.tenantId,
      attendanceDate,
    );

    if (!calendarDay.isWorkingDay) {
      throw new ForbiddenException(
        'Attendance can only be submitted for working days',
      );
    }

    const existingSession = await this.prisma.attendanceSession.findFirst({
      where: {
        tenantId: actor.tenantId,
        attendanceDate,
        classId: dto.classId,
        sectionId: dto.sectionId ?? null,
      },
      include: {
        records: true,
      },
    });

    if (
      existingSession &&
      existingSession.lockAt <= new Date() &&
      !actor.permissions.includes('attendance:override_lock')
    ) {
      throw new ForbiddenException(
        'Attendance for this date is locked. Please request a correction.',
      );
    }

    const students = await this.prisma.student.findMany({
      where: {
        tenantId: actor.tenantId,
        classId: dto.classId,
        ...(dto.sectionId ? { sectionId: dto.sectionId } : {}),
        enrollments: {
          some: {
            tenantId: actor.tenantId,
            academicYearId: dto.academicYearId,
            classId: dto.classId,
            sectionId: dto.sectionId ?? null,
            status: EnrollmentStatus.ACTIVE,
          },
        },
      },
      orderBy: [{ rollNumber: 'asc' }, { firstNameEn: 'asc' }],
    });

    if (students.length === 0) {
      throw new NotFoundException(
        'No students found for the selected class/section',
      );
    }

    const exceptionMap = new Map(
      (dto.exceptions ?? []).map((item) => [item.studentId, item]),
    );
    const rosterStudentIds = new Set(students.map((student) => student.id));
    const invalidExceptionIds = Array.from(exceptionMap.keys()).filter(
      (studentId) => !rosterStudentIds.has(studentId),
    );

    if (invalidExceptionIds.length > 0) {
      throw new ConflictException({
        message:
          'One or more attendance exceptions are outside the selected roster',
        studentIds: invalidExceptionIds,
      });
    }

    let shouldOverwrite = true;
    if (existingSession?.submittedAt) {
      // 1. deviceTimestamp checks
      const deviceTime =
        'deviceTimestamp' in dto
          ? new Date((dto as SyncAttendanceDto).deviceTimestamp)
          : null;
      if (deviceTime && existingSession.submittedAt > deviceTime) {
        shouldOverwrite = false;
      }

      // 2. Owner match checks
      if (
        existingSession.submittedById &&
        existingSession.submittedById !== actor.userId
      ) {
        shouldOverwrite = false;
      }
    }

    try {
      const session = await this.prisma.$transaction(async (tx) => {
        if (existingSession?.submittedAt) {
          await tx.attendanceConflict.create({
            data: {
              tenantId: actor.tenantId,
              attendanceSessionId: existingSession.id,
              submittedById: actor.userId,
              decision: null,
              previousPayload: existingSession.records.map((record) => ({
                studentId: record.studentId,
                status: record.status,
                remark: record.remark,
              })),
              incomingPayload: buildAttendanceIncomingPayload(
                dto,
                submissionContext,
              ) as unknown as Prisma.InputJsonValue,
            },
          });
        }

        const upserted = existingSession
          ? await tx.attendanceSession.update({
              where: { id: existingSession.id },
              data: {
                ...(shouldOverwrite
                  ? {
                      academicYearId: dto.academicYearId,
                      submittedById: actor.userId,
                      submittedAt: new Date(),
                      lockAt: await this.getAttendanceLockAt(
                        actor.tenantId,
                        attendanceDate,
                      ),
                    }
                  : {}),
                conflictStatus: existingSession.submittedAt
                  ? AttendanceConflictStatus.FLAGGED
                  : AttendanceConflictStatus.NONE,
              },
            })
          : await tx.attendanceSession.create({
              data: {
                tenantId: actor.tenantId,
                academicYearId: dto.academicYearId,
                classId: dto.classId,
                sectionId: dto.sectionId ?? null,
                attendanceDate,
                submittedById: actor.userId,
                submittedAt: new Date(),
                lockAt: await this.getAttendanceLockAt(
                  actor.tenantId,
                  attendanceDate,
                ),
                conflictStatus: AttendanceConflictStatus.NONE,
              },
            });

        if (shouldOverwrite) {
          await tx.attendanceRecord.deleteMany({
            where: { attendanceSessionId: upserted.id },
          });

          await tx.attendanceRecord.createMany({
            data: students.map((student) => {
              const exception = exceptionMap.get(student.id);

              return {
                tenantId: actor.tenantId,
                attendanceSessionId: upserted.id,
                studentId: student.id,
                status: exception?.status ?? AttendanceStatus.PRESENT,
                remark: exception?.remark ?? null,
                lateAt: exception?.lateAt ? new Date(exception.lateAt) : null,
              };
            }),
          });
        }

        return tx.attendanceSession.findUniqueOrThrow({
          where: { id: upserted.id },
          include: {
            class: true,
            section: true,
            records: true,
          },
        });
      });

      await this.auditService.record({
        action: 'submit',
        resource: 'attendance_session',
        tenantId: actor.tenantId,
        userId: actor.userId,
        resourceId: session.id,
        after: {
          attendanceDate: session.attendanceDate,
          classId: session.classId,
          sectionId: session.sectionId,
          totals: summarizeAttendance(session.records),
        },
      });

      const notifyRecords = shouldOverwrite
        ? session.records.filter(
            (record) =>
              record.status === AttendanceStatus.ABSENT ||
              record.status === AttendanceStatus.LATE ||
              record.status === AttendanceStatus.SICK_LEAVE ||
              record.status === AttendanceStatus.EXCUSED_LEAVE ||
              record.status === AttendanceStatus.UNEXCUSED_LEAVE,
          )
        : [];

      if (notifyRecords.length > 0) {
        for (const record of notifyRecords) {
          const eventType =
            record.status === AttendanceStatus.ABSENT
              ? 'attendance.student.absent'
              : record.status === AttendanceStatus.LATE
                ? 'attendance.student.late'
                : 'attendance.student.leave';

          this.eventEmitter.emit(eventType, {
            tenantId: actor.tenantId,
            actor,
            attendanceSessionId: session.id,
            attendanceDate: session.attendanceDate,
            classId: session.classId,
            sectionId: session.sectionId,
            studentId: record.studentId,
            status: record.status,
          });

          if (record.status === AttendanceStatus.ABSENT) {
            const consecutiveAbsences =
              await this.countConsecutiveAbsencesForStudent(
                actor.tenantId,
                record.studentId,
                session.attendanceDate,
              );

            if (consecutiveAbsences >= 3) {
              this.eventEmitter.emit('attendance.student.consecutive_absence', {
                tenantId: actor.tenantId,
                actor,
                attendanceSessionId: session.id,
                attendanceDate: session.attendanceDate,
                classId: session.classId,
                sectionId: session.sectionId,
                studentId: record.studentId,
                consecutiveAbsences,
              });
            }
          }
        }

        await this.recordParentStatusNotifications(
          session,
          notifyRecords,
          actor,
        );
      }

      return {
        sessionId: session.id,
        attendanceDate: session.attendanceDate,
        className: session.class.name,
        sectionName: session.section?.name ?? null,
        submittedAt: session.submittedAt,
        lockAt: session.lockAt,
        conflictStatus: session.conflictStatus,
        calendarDay,
        totals: summarizeAttendance(session.records),
      };
    } catch (error) {
      const err = error as Record<string, unknown>;
      if (err && err.code === 'P2002') {
        // Fetch concurrently created session
        const concSession = await this.prisma.attendanceSession.findFirst({
          where: {
            tenantId: actor.tenantId,
            attendanceDate,
            classId: dto.classId,
            sectionId: dto.sectionId ?? null,
          },
          include: {
            records: true,
          },
        });

        if (concSession) {
          await this.prisma.attendanceConflict.create({
            data: {
              tenantId: actor.tenantId,
              attendanceSessionId: concSession.id,
              submittedById: actor.userId,
              decision: null,
              previousPayload: concSession.records.map((record) => ({
                studentId: record.studentId,
                status: record.status,
                remark: record.remark,
              })),
              incomingPayload: buildAttendanceIncomingPayload(
                dto,
                submissionContext,
              ) as unknown as Prisma.InputJsonValue,
            },
          });

          await this.prisma.attendanceSession.update({
            where: { id: concSession.id },
            data: { conflictStatus: AttendanceConflictStatus.FLAGGED },
          });

          const updatedConcSession =
            await this.prisma.attendanceSession.findUniqueOrThrow({
              where: { id: concSession.id },
              include: {
                class: true,
                section: true,
                records: true,
              },
            });

          return {
            sessionId: updatedConcSession.id,
            attendanceDate: updatedConcSession.attendanceDate,
            className: updatedConcSession.class.name,
            sectionName: updatedConcSession.section?.name ?? null,
            submittedAt: updatedConcSession.submittedAt,
            lockAt: updatedConcSession.lockAt,
            conflictStatus: updatedConcSession.conflictStatus,
            calendarDay,
            totals: summarizeAttendance(updatedConcSession.records),
          };
        }
      }
      throw error;
    }
  }

  async syncAttendance(dto: SyncAttendanceDto, actor: AuthContext) {
    const existingSync = await this.prisma.attendanceSyncSubmission.findUnique({
      where: {
        tenantId_clientSubmissionId: {
          tenantId: actor.tenantId,
          clientSubmissionId: dto.clientSubmissionId,
        },
      },
    });

    if (existingSync) {
      const replay = await this.prisma.attendanceSyncSubmission.update({
        where: { id: existingSync.id },
        data: {
          syncAttemptCount: {
            increment: 1,
          },
        },
      });

      return mapAttendanceSyncResult(replay, true);
    }

    const attendanceDate = stripTime(new Date(dto.attendanceDate));
    const serverReceivedAt = new Date();
    const trustMetadata = await this.buildSyncTrustMetadata(
      dto,
      actor,
      attendanceDate,
    );

    try {
      const result = await this.submitAttendance(dto, actor, {
        source: 'sync_submission',
        clientSubmissionId: dto.clientSubmissionId,
        deviceId: dto.deviceId ?? null,
        deviceLabel: dto.deviceLabel ?? null,
        sessionFingerprint: dto.sessionFingerprint ?? null,
        trustMetadata,
      });
      const conflict =
        result.conflictStatus === AttendanceConflictStatus.FLAGGED
          ? await this.prisma.attendanceConflict.findFirst({
              where: {
                tenantId: actor.tenantId,
                attendanceSessionId: result.sessionId,
              },
              orderBy: { createdAt: 'desc' },
            })
          : null;

      const created = await this.prisma.attendanceSyncSubmission.create({
        data: {
          tenantId: actor.tenantId,
          clientSubmissionId: dto.clientSubmissionId,
          attendanceSessionId: result.sessionId,
          conflictId: conflict?.id ?? null,
          academicYearId: dto.academicYearId,
          classId: dto.classId,
          sectionId: dto.sectionId ?? null,
          attendanceDate,
          deviceId: dto.deviceId ?? null,
          deviceLabel: dto.deviceLabel ?? null,
          deviceTimestamp: new Date(dto.deviceTimestamp),
          sessionFingerprint: dto.sessionFingerprint ?? null,
          syncStatus: conflict
            ? AttendanceSyncStatus.CONFLICTED
            : AttendanceSyncStatus.ACCEPTED,
          syncAttemptCount: 1,
          serverReceivedAt,
          rejectionReason: null,
          submittedById: actor.userId,
          payload: JSON.parse(
            JSON.stringify({
              dto,
              result,
              trustMetadata,
            }),
          ) as Prisma.InputJsonValue,
        },
      });

      return mapAttendanceSyncResult(created, false);
    } catch (error) {
      const created = await this.prisma.attendanceSyncSubmission.create({
        data: {
          tenantId: actor.tenantId,
          clientSubmissionId: dto.clientSubmissionId,
          academicYearId: dto.academicYearId,
          classId: dto.classId,
          sectionId: dto.sectionId ?? null,
          attendanceDate,
          deviceId: dto.deviceId ?? null,
          deviceLabel: dto.deviceLabel ?? null,
          deviceTimestamp: new Date(dto.deviceTimestamp),
          sessionFingerprint: dto.sessionFingerprint ?? null,
          syncStatus: AttendanceSyncStatus.REJECTED,
          syncAttemptCount: 1,
          serverReceivedAt,
          rejectionReason: classifyAttendanceSyncRejection(error),
          submittedById: actor.userId,
          payload: {
            dto,
            error: error instanceof Error ? error.message : 'Unknown error',
            trustMetadata,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      await this.auditService.record({
        action: 'reject',
        resource: 'attendance_sync_submission',
        tenantId: actor.tenantId,
        userId: actor.userId,
        resourceId: created.id,
        after: {
          clientSubmissionId: dto.clientSubmissionId,
          rejectionReason: created.rejectionReason,
        },
      });

      throw error instanceof ForbiddenException ||
        error instanceof NotFoundException
        ? error
        : new ForbiddenException('Attendance sync was rejected');
    }
  }

  async listConflicts(actor: AuthContext) {
    const conflicts = await this.prisma.attendanceConflict.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        attendanceSession: {
          include: {
            class: true,
            section: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    });

    return conflicts.map((conflict) => ({
      id: conflict.id,
      attendanceSessionId: conflict.attendanceSessionId,
      status: conflict.status,
      decision: conflict.decision,
      submittedById: conflict.submittedById,
      reviewedById: conflict.reviewedById,
      submittedAt: conflict.createdAt,
      reviewedAt: conflict.reviewedAt,
      resolutionNote: conflict.resolutionNote,
      attendanceDate: conflict.attendanceSession.attendanceDate,
      className: conflict.attendanceSession.class.name,
      sectionName: conflict.attendanceSession.section?.name ?? null,
    }));
  }

  async reviewConflict(
    conflictId: string,
    dto: ReviewAttendanceConflictDto,
    actor: AuthContext,
  ) {
    this.ensureAttendanceReviewAuthority(actor);

    const conflict = await this.prisma.attendanceConflict.findFirst({
      where: {
        id: conflictId,
        tenantId: actor.tenantId,
      },
    });

    if (!conflict) {
      throw new NotFoundException('Attendance conflict not found');
    }

    const decision =
      dto.decision ?? AttendanceConflictReviewDecision.REVIEWED_WITHOUT_CHANGE;

    const updated = await this.prisma.attendanceConflict.update({
      where: { id: conflict.id },
      data: {
        status: AttendanceConflictStatus.REVIEWED,
        decision:
          decision === AttendanceConflictReviewDecision.REJECTED_RESUBMISSION
            ? AttendanceConflictDecision.REJECTED_RESUBMISSION
            : AttendanceConflictDecision.REVIEWED_WITHOUT_CHANGE,
        resolutionNote: dto.resolutionNote ?? null,
        reviewedById: actor.userId,
        reviewedAt: new Date(),
      },
    });

    const syncUpdate =
      decision === AttendanceConflictReviewDecision.REJECTED_RESUBMISSION
        ? await this.prisma.attendanceSyncSubmission.updateMany({
            where: {
              tenantId: actor.tenantId,
              conflictId: conflict.id,
            },
            data: {
              syncStatus: AttendanceSyncStatus.REJECTED,
              rejectionReason: AttendanceSyncRejectionReason.ROSTER_MISMATCH,
            },
          })
        : await this.prisma.attendanceSyncSubmission.updateMany({
            where: {
              tenantId: actor.tenantId,
              conflictId: conflict.id,
            },
            data: {
              syncStatus: AttendanceSyncStatus.ACCEPTED,
              rejectionReason: null,
            },
          });

    await this.prisma.attendanceSession.update({
      where: { id: conflict.attendanceSessionId },
      data: { conflictStatus: AttendanceConflictStatus.REVIEWED },
    });

    await this.auditService.record({
      action: 'review',
      resource: 'attendance_conflict',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: conflict.id,
      after: {
        decision,
        resolutionNote: dto.resolutionNote ?? null,
        affectedSyncSubmissionCount: syncUpdate.count,
      },
    });

    return {
      id: updated.id,
      attendanceSessionId: updated.attendanceSessionId,
      status: updated.status,
      decision: updated.decision,
      resolutionNote: updated.resolutionNote,
      reviewedById: updated.reviewedById,
      reviewedAt: updated.reviewedAt,
      affectedSyncSubmissionCount: syncUpdate.count,
    };
  }

  async overrideLockedSession(
    sessionId: string,
    dto: OverrideAttendanceSessionDto,
    actor: AuthContext,
  ) {
    this.ensureAttendanceReviewAuthority(actor);
    const reasonPolicy = await this.loadM2AttendancePolicy(actor.tenantId);
    const overrideReason = requireMinimumReason(
      dto.reason,
      reasonPolicy.lockOverrideMinReasonLength,
      'Attendance lock override',
    );

    const session = await this.prisma.attendanceSession.findFirst({
      where: {
        id: sessionId,
        tenantId: actor.tenantId,
      },
      include: {
        records: true,
        class: true,
        section: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Attendance session not found');
    }

    const recordByStudent = new Map(
      session.records.map((record) => [record.studentId, record]),
    );

    for (const exception of dto.exceptions) {
      if (!recordByStudent.has(exception.studentId)) {
        throw new NotFoundException(
          `Student ${exception.studentId} is not part of this attendance session`,
        );
      }
    }

    const changedRows = dto.exceptions.map((exception) => {
      const original = recordByStudent.get(exception.studentId)!;

      return {
        studentId: exception.studentId,
        fromStatus: original.status,
        toStatus: exception.status,
        fromRemark: original.remark ?? null,
        toRemark: exception.remark ?? null,
      };
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      for (const exception of dto.exceptions) {
        await tx.attendanceRecord.update({
          where: {
            attendanceSessionId_studentId: {
              attendanceSessionId: session.id,
              studentId: exception.studentId,
            },
          },
          data: {
            status: exception.status,
            remark: exception.remark ?? null,
            lateAt: exception.lateAt ? new Date(exception.lateAt) : null,
          },
        });
      }

      await tx.attendanceConflict.create({
        data: {
          tenantId: actor.tenantId,
          attendanceSessionId: session.id,
          submittedById: actor.userId,
          decision: AttendanceConflictDecision.REVIEWED_AND_OVERRIDDEN,
          previousPayload: session.records.map((record) => ({
            studentId: record.studentId,
            status: record.status,
            remark: record.remark,
          })),
          incomingPayload: {
            override: dto.exceptions,
            reason: overrideReason,
            source: dto.source ?? AttendanceOverrideSource.MANUAL_OVERRIDE,
            changedRows,
            originalLockAt: session.lockAt.toISOString(),
          } as unknown as Prisma.InputJsonValue,
          status: AttendanceConflictStatus.REVIEWED,
          reviewedById: actor.userId,
          reviewedAt: new Date(),
          resolutionNote: overrideReason,
        },
      });

      return tx.attendanceSession.update({
        where: { id: session.id },
        data: {
          conflictStatus: AttendanceConflictStatus.REVIEWED,
        },
        include: {
          records: true,
          class: true,
          section: true,
        },
      });
    });

    const syncUpdate =
      dto.source === AttendanceOverrideSource.SYNC_CONFLICT_RESOLUTION
        ? await this.prisma.attendanceSyncSubmission.updateMany({
            where: {
              tenantId: actor.tenantId,
              attendanceSessionId: session.id,
              syncStatus: AttendanceSyncStatus.CONFLICTED,
            },
            data: {
              syncStatus: AttendanceSyncStatus.ACCEPTED,
              rejectionReason: null,
            },
          })
        : { count: 0 };

    await this.auditService.record({
      action: 'override',
      resource: 'attendance_session',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: session.id,
      before: {
        records: session.records.map((record) => ({
          studentId: record.studentId,
          status: record.status,
          remark: record.remark,
        })),
      },
      after: {
        reason: overrideReason,
        source: dto.source ?? AttendanceOverrideSource.MANUAL_OVERRIDE,
        originalLockAt: session.lockAt,
        changedRows,
        affectedSyncSubmissionCount: syncUpdate.count,
        totals: summarizeAttendance(updated.records),
      },
    });

    return {
      sessionId: updated.id,
      attendanceDate: updated.attendanceDate,
      className: updated.class.name,
      sectionName: updated.section?.name ?? null,
      conflictStatus: updated.conflictStatus,
      affectedSyncSubmissionCount: syncUpdate.count,
      totals: summarizeAttendance(updated.records),
    };
  }

  async getMonthlyRegister(dto: GetMonthlyRegisterDto, actor: AuthContext) {
    await this.checkTeacherAssignment(actor, dto.classId, dto.sectionId);

    const startDate = new Date(dto.year, dto.month - 1, 1);
    const endDate = new Date(dto.year, dto.month, 0);

    const [students, sessions, calendarDays, classroom, section] =
      await Promise.all([
        this.prisma.student.findMany({
          where: {
            tenantId: actor.tenantId,
            classId: dto.classId,
            ...(dto.sectionId ? { sectionId: dto.sectionId } : {}),
            enrollments: {
              some: {
                academicYearId: dto.academicYearId,
                status: EnrollmentStatus.ACTIVE,
              },
            },
          },
          orderBy: [{ rollNumber: 'asc' }, { firstNameEn: 'asc' }],
        }),
        this.prisma.attendanceSession.findMany({
          where: {
            tenantId: actor.tenantId,
            classId: dto.classId,
            sectionId: dto.sectionId ?? null,
            attendanceDate: {
              gte: startDate,
              lte: endDate,
            },
          },
          include: {
            records: true,
          },
        }),
        this.prisma.schoolCalendarDay.findMany({
          where: {
            tenantId: actor.tenantId,
            calendarDate: {
              gte: startDate,
              lte: endDate,
            },
          },
        }),
        this.prisma.class.findFirst({
          where: { id: dto.classId, tenantId: actor.tenantId },
          select: { name: true },
        }),
        dto.sectionId
          ? this.prisma.section.findFirst({
              where: { id: dto.sectionId, tenantId: actor.tenantId },
              select: { name: true },
            })
          : Promise.resolve(null),
      ]);

    if (!classroom) {
      throw new NotFoundException('Class not found in this school.');
    }
    if (dto.sectionId && !section) {
      throw new NotFoundException('Section not found in this school.');
    }

    const sessionByDate = new Map(
      sessions.map((s) => [s.attendanceDate.toISOString().split('T')[0], s]),
    );
    const calendarByDate = new Map(
      calendarDays.map((d) => [d.calendarDate.toISOString().split('T')[0], d]),
    );

    const daysCount = endDate.getDate();
    const matrix = students.map((student) => {
      const row = {
        studentId: student.id,
        rollNumber: student.rollNumber,
        name: `${student.firstNameEn} ${student.lastNameEn}`,
        attendance: [] as Array<{ day: number; status: string }>,
        totals: {
          PRESENT: 0,
          ABSENT: 0,
          LATE: 0,
          LEAVE: 0,
          HOLIDAY: 0,
          NOT_MARKED: 0,
          totalDays: 0,
        },
      };

      for (let day = 1; day <= daysCount; day++) {
        const date = new Date(dto.year, dto.month - 1, day);
        const dateKey = date.toISOString().split('T')[0];
        const session = sessionByDate.get(dateKey);
        const calendar = calendarByDate.get(dateKey);

        let status = 'NOT_MARKED';
        if (calendar && !calendar.isWorkingDay) {
          status = 'HOLIDAY';
        } else if (session) {
          const record = session.records.find(
            (r) => r.studentId === student.id,
          );
          status = record?.status ?? 'NOT_MARKED';
        }

        row.attendance.push({ day, status });
        if (status === AttendanceStatus.PRESENT) {
          row.totals.PRESENT++;
        } else if (status === AttendanceStatus.ABSENT) {
          row.totals.ABSENT++;
        } else if (status === AttendanceStatus.LATE) {
          row.totals.LATE++;
        } else if (status === AttendanceStatus.HOLIDAY) {
          row.totals.HOLIDAY++;
        } else if (
          status === AttendanceStatus.SICK_LEAVE ||
          status === AttendanceStatus.EXCUSED_LEAVE ||
          status === AttendanceStatus.UNEXCUSED_LEAVE ||
          status === AttendanceStatus.ON_LEAVE ||
          status === AttendanceStatus.LEAVE
        ) {
          row.totals.LEAVE++;
        } else if (status === AttendanceStatus.HALF_DAY) {
          row.totals.PRESENT += 0.5;
          row.totals.ABSENT += 0.5;
        } else {
          row.totals.NOT_MARKED++;
        }
        row.totals.totalDays++;
      }

      return row;
    });

    return {
      month: dto.month,
      year: dto.year,
      className: classroom?.name ?? dto.classId,
      sectionName: section?.name ?? null,
      daysCount,
      matrix,
    };
  }

  async getStudentHistory(
    studentId: string,
    dto: GetStudentHistoryDto,
    actor: AuthContext,
  ) {
    await this.ensureStudentAttendanceAccess(studentId, actor);

    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        tenantId: actor.tenantId,
        studentId,
        attendanceSession: {
          attendanceDate: {
            ...(dto.startDate ? { gte: new Date(dto.startDate) } : {}),
            ...(dto.endDate ? { lte: new Date(dto.endDate) } : {}),
          },
        },
      },
      select: {
        id: true,
        attendanceSessionId: true,
        status: true,
        remark: true,
        lateAt: true,
        attendanceSession: {
          select: {
            attendanceDate: true,
            submittedBy: {
              select: {
                email: true,
              },
            },
          },
        },
      },
      orderBy: { attendanceSession: { attendanceDate: 'desc' } },
      take: 180,
    });

    return records.map((r) => ({
      date: r.attendanceSession.attendanceDate,
      status: r.status,
      remark: r.remark,
      lateAt: r.lateAt,
      markedBy: r.attendanceSession.submittedBy?.email ?? 'System',
      sessionId: r.attendanceSessionId,
    }));
  }

  async createCorrectionRequest(
    dto: CreateAttendanceCorrectionDto,
    actor: AuthContext,
  ) {
    const staff = await this.prisma.staff.findUnique({
      where: { userId: actor.userId },
      select: { id: true },
    });
    if (!staff) {
      throw new ForbiddenException('Only staff can create correction requests');
    }

    const attendanceDate = stripTime(new Date(dto.attendanceDate));
    const lockAt = await this.getAttendanceLockAt(
      actor.tenantId,
      attendanceDate,
    );
    const isLocked = lockAt <= new Date();

    const allowCorrection =
      ((await this.settingsService.getSetting(
        actor.tenantId,
        'allow_teacher_correction_request',
      )) as boolean) ?? true;
    if (!allowCorrection && isLocked) {
      throw new ForbiddenException(
        'Attendance corrections are not enabled for this school.',
      );
    }

    const existing = await this.prisma.attendanceCorrectionRequest.findFirst({
      where: {
        tenantId: actor.tenantId,
        studentId: dto.studentId,
        attendanceDate,
        status: 'PENDING',
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        'A pending correction request already exists for this student and date.',
      );
    }

    const student = await this.prisma.student.findUnique({
      where: { id: dto.studentId, tenantId: actor.tenantId },
      select: {
        id: true,
        classId: true,
        sectionId: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found in this school.');
    }

    await this.checkTeacherAssignment(
      actor,
      student.classId,
      student.sectionId,
    );

    const [record, session] = await Promise.all([
      dto.attendanceRecordId
        ? this.prisma.attendanceRecord.findFirst({
            where: {
              id: dto.attendanceRecordId,
              tenantId: actor.tenantId,
              studentId: dto.studentId,
            },
            select: {
              id: true,
              attendanceSessionId: true,
              status: true,
              attendanceSession: {
                select: {
                  id: true,
                  attendanceDate: true,
                  classId: true,
                  sectionId: true,
                  submittedAt: true,
                },
              },
            },
          })
        : Promise.resolve(null),
      dto.attendanceSessionId
        ? this.prisma.attendanceSession.findFirst({
            where: {
              id: dto.attendanceSessionId,
              tenantId: actor.tenantId,
              attendanceDate,
            },
            select: {
              id: true,
              attendanceDate: true,
              classId: true,
              sectionId: true,
              submittedAt: true,
            },
          })
        : Promise.resolve(null),
    ]);

    if (dto.attendanceRecordId && !record) {
      throw new NotFoundException('Attendance record not found.');
    }

    if (dto.attendanceSessionId && !session) {
      throw new NotFoundException('Attendance session not found.');
    }

    const resolvedSession = record?.attendanceSession ?? session;
    if (resolvedSession) {
      if (
        stripTime(resolvedSession.attendanceDate).getTime() !==
        attendanceDate.getTime()
      ) {
        throw new ConflictException(
          'Correction date does not match the attendance session.',
        );
      }

      if (
        resolvedSession.classId !== student.classId ||
        resolvedSession.sectionId !== student.sectionId
      ) {
        throw new ConflictException(
          'Student is not part of the selected attendance session.',
        );
      }
    }

    const request = await this.prisma.attendanceCorrectionRequest.create({
      data: {
        tenantId: actor.tenantId,
        attendanceRecordId: record?.id ?? null,
        attendanceSessionId: resolvedSession?.id ?? null,
        studentId: dto.studentId,
        attendanceDate,
        requestedStatus: dto.requestedStatus,
        previousStatus: record?.status ?? null,
        reason: dto.reason.trim(),
        requestedById: actor.userId,
        status: 'PENDING',
      },
      select: attendanceCorrectionRequestSelect,
    });

    await this.auditService.record({
      action: 'create',
      resource: 'attendance_correction_request',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: request.id,
      after: request,
    });

    return request;
  }

  async listCorrectionRequests(
    actor: AuthContext,
    query: ListAttendanceCorrectionRequestsDto = {},
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where = {
      tenantId: actor.tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.requestedById ? { requestedById: query.requestedById } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.attendanceCorrectionRequest.findMany({
        where,
        select: {
          ...attendanceCorrectionRequestSelect,
          student: {
            select: {
              id: true,
              studentSystemId: true,
              firstNameEn: true,
              lastNameEn: true,
              rollNumber: true,
            },
          },
          requestedBy: {
            select: { id: true, email: true },
          },
          reviewedBy: {
            select: { id: true, email: true },
          },
        },
        orderBy: { requestedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.attendanceCorrectionRequest.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      hasNextPage: page * limit < total,
    };
  }

  async approveCorrectionRequest(
    id: string,
    dto: ReviewAttendanceCorrectionDto,
    actor: AuthContext,
  ) {
    this.ensureAttendanceReviewAuthority(actor);
    const reviewReason = getCorrectionReviewReason(dto);
    const reasonPolicy = await this.loadM2AttendancePolicy(actor.tenantId);
    requireMinimumReason(
      reviewReason,
      reasonPolicy.correctionReviewMinReasonLength,
      'Attendance correction review',
    );
    const request = await this.prisma.attendanceCorrectionRequest.findFirst({
      where: { id, tenantId: actor.tenantId },
      select: {
        ...attendanceCorrectionRequestSelect,
        session: {
          select: {
            id: true,
            academicYearId: true,
            classId: true,
            sectionId: true,
            submittedAt: true,
          },
        },
        record: {
          select: {
            id: true,
            status: true,
            remark: true,
          },
        },
      },
    });

    if (!request) throw new NotFoundException('Correction request not found');
    if (request.status !== 'PENDING') {
      throw new ConflictException('Request is no longer pending');
    }

    if (dto.status === 'REJECTED') {
      const updated = await this.prisma.attendanceCorrectionRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewedById: actor.userId,
          reviewedAt: new Date(),
          reviewNote: reviewReason,
          reviewReason,
        },
        select: attendanceCorrectionRequestSelect,
      });

      await this.auditService.record({
        action: 'reject',
        resource: 'attendance_correction_request',
        tenantId: actor.tenantId,
        userId: actor.userId,
        resourceId: id,
        after: updated,
      });

      return updated;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (request.attendanceRecordId) {
        const updateResult = await tx.attendanceRecord.updateMany({
          where: {
            id: request.attendanceRecordId,
            tenantId: actor.tenantId,
            studentId: request.studentId,
          },
          data: {
            status: request.requestedStatus,
            remark: `Corrected: ${request.reason}`,
          },
        });
        if (updateResult.count !== 1) {
          throw new NotFoundException('Attendance record not found.');
        }
      } else {
        let sessionId = request.attendanceSessionId;
        if (!sessionId) {
          const student = await tx.student.findUnique({
            where: { id: request.studentId, tenantId: actor.tenantId },
            select: { classId: true, sectionId: true },
          });
          if (!student) {
            throw new NotFoundException('Student not found in this school.');
          }
          const existingSession = await tx.attendanceSession.findFirst({
            where: {
              tenantId: actor.tenantId,
              attendanceDate: request.attendanceDate,
              classId: student.classId,
              sectionId: student.sectionId,
            },
          });
          if (existingSession) {
            sessionId = existingSession.id;
          } else {
            const activeYear = await tx.academicYear.findFirst({
              where: { tenantId: actor.tenantId, isCurrent: true },
              select: { id: true },
            });
            if (!activeYear) {
              throw new NotFoundException('Current academic year not found.');
            }
            const newSession = await tx.attendanceSession.create({
              data: {
                tenantId: actor.tenantId,
                academicYearId: activeYear.id,
                classId: student.classId,
                sectionId: student.sectionId,
                attendanceDate: request.attendanceDate,
                lockAt: new Date(),
              },
            });
            sessionId = newSession.id;
          }
        }

        await tx.attendanceRecord.upsert({
          where: {
            attendanceSessionId_studentId: {
              attendanceSessionId: sessionId,
              studentId: request.studentId,
            },
          },
          create: {
            tenantId: actor.tenantId,
            attendanceSessionId: sessionId,
            studentId: request.studentId,
            status: request.requestedStatus,
            remark: `Corrected: ${request.reason}`,
          },
          update: {
            status: request.requestedStatus,
            remark: `Corrected: ${request.reason}`,
          },
        });
      }

      const updated = await tx.attendanceCorrectionRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedById: actor.userId,
          reviewedAt: new Date(),
          reviewNote: reviewReason,
          reviewReason,
        },
        select: attendanceCorrectionRequestSelect,
      });

      return updated;
    });

    await this.auditService.record({
      action: 'approve',
      resource: 'attendance_correction_request',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: id,
      before: {
        previousStatus:
          request.previousStatus ?? request.record?.status ?? null,
      },
      after: {
        ...updated,
        reviewReason,
      },
    });

    return updated;
  }

  async getParentSummary(
    studentId: string,
    actor: AuthContext,
    query?: { month?: number; year?: number },
  ) {
    await this.ensureStudentAttendanceAccess(studentId, actor);

    const now = new Date();
    const today = stripTime(now);
    const year = query?.year ?? now.getFullYear();
    const month = query?.month ?? now.getMonth() + 1;
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);

    const [todayRecord, monthRecords, recentHistory] = await Promise.all([
      this.prisma.attendanceRecord.findFirst({
        where: {
          tenantId: actor.tenantId,
          studentId,
          attendanceSession: {
            tenantId: actor.tenantId,
            attendanceDate: today,
          },
        },
        select: {
          status: true,
          remark: true,
          attendanceSession: {
            select: {
              attendanceDate: true,
            },
          },
        },
      }),
      this.prisma.attendanceRecord.findMany({
        where: {
          tenantId: actor.tenantId,
          studentId,
          attendanceSession: {
            tenantId: actor.tenantId,
            attendanceDate: {
              gte: firstDayOfMonth,
              lte: lastDayOfMonth,
            },
          },
        },
        select: {
          status: true,
          remark: true,
          attendanceSession: {
            select: {
              attendanceDate: true,
            },
          },
        },
      }),
      this.prisma.attendanceRecord.findMany({
        where: {
          tenantId: actor.tenantId,
          studentId,
          attendanceSession: {
            tenantId: actor.tenantId,
          },
        },
        select: {
          status: true,
          remark: true,
          attendanceSession: {
            select: {
              attendanceDate: true,
            },
          },
        },
        orderBy: { attendanceSession: { attendanceDate: 'desc' } },
        take: 10,
      }),
    ]);

    const totals = summarizeAttendance(monthRecords);
    const totalMarked = monthRecords.length;
    const percentage =
      totalMarked > 0 ? (totals.present / totalMarked) * 100 : 100;

    return {
      studentId,
      today: todayRecord
        ? {
            status: todayRecord.status,
            label: buildParentAttendanceStatusLabel(
              todayRecord.status,
              todayRecord.attendanceSession.attendanceDate,
            ),
            remark: todayRecord.remark,
          }
        : {
            status: null,
            label: 'Attendance not marked today',
            remark: null,
          },
      monthSummary: {
        ...totals,
        totalMarked,
        attendancePercentage: Math.round(percentage * 100) / 100,
      },
      monthHistory: monthRecords.map((record) => ({
        date: record.attendanceSession.attendanceDate,
        status: record.status,
        label: buildParentAttendanceStatusLabel(
          record.status,
          record.attendanceSession.attendanceDate,
        ),
        remark: record.remark,
      })),
      recentHistory: recentHistory.map((record) => ({
        date: record.attendanceSession.attendanceDate,
        status: record.status,
        label: buildParentAttendanceStatusLabel(
          record.status,
          record.attendanceSession.attendanceDate,
        ),
        remark: record.remark,
      })),
    };
  }

  private async getAttendanceLockAt(
    tenantId: string,
    attendanceDate: Date,
  ): Promise<Date> {
    const lockHours =
      ((await this.settingsService.getSetting(
        tenantId,
        'attendance_lock_hours',
      )) as number) ?? 24;
    return new Date(attendanceDate.getTime() + lockHours * 60 * 60 * 1000);
  }

  async listCalendarDays(actor: AuthContext) {
    return this.prisma.schoolCalendarDay.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: [{ calendarDate: 'asc' }],
      take: 100,
    });
  }

  async upsertCalendarDay(dto: UpsertCalendarDayDto, actor: AuthContext) {
    const calendarDate = new Date(dto.calendarDate);
    const day = await this.prisma.schoolCalendarDay.upsert({
      where: {
        tenantId_calendarDate: {
          tenantId: actor.tenantId,
          calendarDate,
        },
      },
      update: {
        isWorkingDay: dto.isWorkingDay,
        label: dto.label ?? null,
        holidayType: dto.holidayType ?? null,
      },
      create: {
        tenantId: actor.tenantId,
        calendarDate,
        isWorkingDay: dto.isWorkingDay,
        label: dto.label ?? null,
        holidayType: dto.holidayType ?? null,
      },
    });

    await this.auditService.record({
      action: 'upsert',
      resource: 'school_calendar_day',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: day.id,
      after: {
        calendarDate: day.calendarDate,
        isWorkingDay: day.isWorkingDay,
        label: day.label,
      },
    });

    return day;
  }

  async listMyAttendance(actor: AuthContext) {
    const staff = await this.prisma.staff.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
    });

    if (!staff) {
      throw new NotFoundException('Staff record not found');
    }

    return this.prisma.staffAttendance.findMany({
      where: {
        tenantId: actor.tenantId,
        staffId: staff.id,
      },
      include: {
        approvedBy: true,
      },
      orderBy: { attendanceDate: 'desc' },
      take: 100,
    });
  }

  async listMyLeaveRequests(actor: AuthContext) {
    const staff = await this.prisma.staff.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
    });

    if (!staff) {
      throw new NotFoundException('Staff record not found');
    }

    return this.prisma.staffLeaveRequest.findMany({
      where: {
        tenantId: actor.tenantId,
        staffId: staff.id,
      },
      include: {
        reviewedBy: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async listStaffAttendance(actor: AuthContext) {
    return this.prisma.staffAttendance.findMany({
      where: { tenantId: actor.tenantId },
      include: { staff: true, approvedBy: true },
      orderBy: [{ attendanceDate: 'desc' }],
      take: 100,
    });
  }

  async getStaffAttendanceHistory(staffId: string, actor: AuthContext) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId: actor.tenantId },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found in this tenant');
    }

    return this.prisma.staffAttendance.findMany({
      where: { tenantId: actor.tenantId, staffId },
      include: { approvedBy: true },
      orderBy: { attendanceDate: 'desc' },
      take: 180,
    });
  }

  async listStaffAttendanceSummary(
    query: ListStaffAttendanceSummaryDto,
    actor: AuthContext,
  ) {
    const now = new Date();
    const month = query.month ?? now.getMonth() + 1;
    const year = query.year ?? now.getFullYear();
    const startsOn = new Date(year, month - 1, 1);
    const endsOn = new Date(year, month, 1);

    const [records, approvedLeaveRequests] = await Promise.all([
      this.prisma.staffAttendance.findMany({
        where: {
          tenantId: actor.tenantId,
          attendanceDate: {
            gte: startsOn,
            lt: endsOn,
          },
        },
        include: {
          staff: true,
        },
        take: 1000, // Monthly summary can be larger but should be bounded
      }),
      this.prisma.staffLeaveRequest.findMany({
        where: {
          tenantId: actor.tenantId,
          status: 'APPROVED',
          startsOn: { lt: endsOn },
          endsOn: { gte: startsOn },
        },
        include: {
          staff: true,
        },
        take: 1000,
      }),
    ]);

    const summaryByStaff = new Map<
      string,
      {
        staffId: string;
        employeeId: string;
        fullName: string;
        presentDays: number;
        lateDays: number;
        absentDays: number;
        leaveDays: number;
        approvedLeaveDays: number;
        unresolvedOverlapAnomalies: number;
      }
    >();
    const recordStatusByStaffAndDate = new Map<string, AttendanceStatus>();

    for (const record of records) {
      const fullName =
        `${record.staff.firstName} ${record.staff.lastName}`.trim();
      const current = summaryByStaff.get(record.staffId) ?? {
        staffId: record.staffId,
        employeeId: record.staff.employeeId,
        fullName,
        presentDays: 0,
        lateDays: 0,
        absentDays: 0,
        leaveDays: 0,
        approvedLeaveDays: 0,
        unresolvedOverlapAnomalies: 0,
      };

      if (record.status === AttendanceStatus.PRESENT) {
        current.presentDays += 1;
      } else if (record.status === AttendanceStatus.LATE) {
        current.lateDays += 1;
      } else if (record.status === AttendanceStatus.ABSENT) {
        current.absentDays += 1;
      } else if (record.status === AttendanceStatus.LEAVE) {
        current.leaveDays += 1;
      }

      recordStatusByStaffAndDate.set(
        buildStaffDateKey(record.staffId, stripTime(record.attendanceDate)),
        record.status,
      );
      summaryByStaff.set(record.staffId, current);
    }

    for (const leave of approvedLeaveRequests) {
      const fullName =
        `${leave.staff.firstName} ${leave.staff.lastName}`.trim();
      const current = summaryByStaff.get(leave.staffId) ?? {
        staffId: leave.staffId,
        employeeId: leave.staff.employeeId,
        fullName,
        presentDays: 0,
        lateDays: 0,
        absentDays: 0,
        leaveDays: 0,
        approvedLeaveDays: 0,
        unresolvedOverlapAnomalies: 0,
      };

      for (const leaveDate of eachDateInclusive(leave.startsOn, leave.endsOn)) {
        if (leaveDate < startsOn || leaveDate >= endsOn) {
          continue;
        }

        current.approvedLeaveDays += 1;
        const existingStatus = recordStatusByStaffAndDate.get(
          buildStaffDateKey(leave.staffId, leaveDate),
        );

        if (existingStatus && existingStatus !== AttendanceStatus.LEAVE) {
          current.unresolvedOverlapAnomalies += 1;
        }
      }

      summaryByStaff.set(leave.staffId, current);
    }

    return {
      month,
      year,
      items: Array.from(summaryByStaff.values()).sort((a, b) =>
        a.fullName.localeCompare(b.fullName),
      ),
    };
  }

  async submitStaffAttendance(
    dto: SubmitStaffAttendanceDto,
    actor: AuthContext,
  ) {
    const attendanceDate = stripTime(new Date(dto.attendanceDate));
    const calendarDay = await this.resolveCalendarDay(
      actor.tenantId,
      attendanceDate,
    );

    if (!calendarDay.isWorkingDay) {
      throw new ForbiddenException(
        'Staff attendance can only be submitted for working days',
      );
    }

    const staffIds = dto.records.map((record) => record.staffId);
    const staffCount = await this.prisma.staff.count({
      where: {
        tenantId: actor.tenantId,
        id: { in: staffIds },
      },
    });

    if (staffCount !== staffIds.length) {
      throw new NotFoundException('One or more staff records were not found');
    }

    const records = await this.prisma.$transaction(
      dto.records.map((record) =>
        this.prisma.staffAttendance.upsert({
          where: {
            tenantId_staffId_attendanceDate: {
              tenantId: actor.tenantId,
              staffId: record.staffId,
              attendanceDate,
            },
          },
          update: {
            status: record.status,
            leaveType: record.leaveType ?? null,
            note: record.note ?? null,
            checkInAt: record.checkInAt ? new Date(record.checkInAt) : null,
            approvedById: actor.userId,
          },
          create: {
            tenantId: actor.tenantId,
            staffId: record.staffId,
            attendanceDate,
            status: record.status,
            leaveType: record.leaveType ?? null,
            note: record.note ?? null,
            checkInAt: record.checkInAt ? new Date(record.checkInAt) : null,
            approvedById: actor.userId,
          },
        }),
      ),
    );

    await this.auditService.record({
      action: 'submit',
      resource: 'staff_attendance',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        attendanceDate,
        count: records.length,
      },
    });

    return {
      attendanceDate,
      count: records.length,
      calendarDay,
      records,
    };
  }

  async correctStaffAttendance(
    attendanceId: string,
    dto: CorrectStaffAttendanceDto,
    actor: AuthContext,
  ) {
    const existing = await this.prisma.staffAttendance.findFirst({
      where: { id: attendanceId, tenantId: actor.tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Staff attendance record not found');
    }

    const corrected = await this.prisma.staffAttendance.update({
      where: { id: existing.id },
      data: {
        status: dto.status,
        leaveType: dto.leaveType ?? null,
        note: dto.note ?? existing.note,
        checkInAt: dto.checkInAt ? new Date(dto.checkInAt) : existing.checkInAt,
        approvedById: actor.userId,
      },
      include: { staff: true, approvedBy: true },
    });

    await this.auditService.record({
      action: 'correct',
      resource: 'staff_attendance',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: corrected.id,
      before: {
        status: existing.status,
        leaveType: existing.leaveType,
        note: existing.note,
      },
      after: {
        status: corrected.status,
        leaveType: corrected.leaveType,
        note: corrected.note,
        reason: dto.reason,
      },
    });

    return corrected;
  }

  async listLeaveBalances(actor: AuthContext) {
    return this.prisma.staffLeaveBalance.findMany({
      where: { tenantId: actor.tenantId },
      include: { staff: true },
      orderBy: [{ year: 'desc' }, { leaveType: 'asc' }],
      take: 100,
    });
  }

  async getStaffLeaveBalances(staffId: string, actor: AuthContext) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId: actor.tenantId },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found in this tenant');
    }

    return this.prisma.staffLeaveBalance.findMany({
      where: { tenantId: actor.tenantId, staffId },
      orderBy: [{ year: 'desc' }, { leaveType: 'asc' }],
    });
  }

  async adjustLeaveBalance(dto: AdjustLeaveBalanceDto, actor: AuthContext) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: dto.staffId, tenantId: actor.tenantId },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found in this tenant');
    }

    const adjusted = await this.prisma.staffLeaveBalance.upsert({
      where: {
        tenantId_staffId_leaveType_year: {
          tenantId: actor.tenantId,
          staffId: dto.staffId,
          leaveType: dto.leaveType,
          year: dto.year,
        },
      },
      update: {
        adjusted: { increment: new Prisma.Decimal(dto.adjustment) },
      },
      create: {
        tenantId: actor.tenantId,
        staffId: dto.staffId,
        leaveType: dto.leaveType,
        year: dto.year,
        adjusted: new Prisma.Decimal(dto.adjustment),
      },
    });

    await this.auditService.record({
      action: 'adjust',
      resource: 'staff_leave_balance',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: adjusted.id,
      after: {
        staffId: dto.staffId,
        leaveType: dto.leaveType,
        year: dto.year,
        adjustment: dto.adjustment,
        reason: dto.reason,
      },
    });

    return adjusted;
  }

  async listLeaveRequests(actor: AuthContext) {
    return this.prisma.staffLeaveRequest.findMany({
      where: { tenantId: actor.tenantId },
      include: { staff: true, reviewedBy: true },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    });
  }

  async getLeaveRequest(id: string, actor: AuthContext) {
    const leave = await this.prisma.staffLeaveRequest.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: { staff: true, reviewedBy: true },
    });

    if (!leave) {
      throw new NotFoundException('Leave request not found in this tenant');
    }

    return leave;
  }

  async createLeaveRequest(
    dto: CreateStaffLeaveRequestDto,
    actor: AuthContext,
  ) {
    const staff = await this.prisma.staff.findFirst({
      where: {
        id: dto.staffId,
        tenantId: actor.tenantId,
      },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found in this tenant');
    }

    const startsOn = new Date(dto.startsOn);
    const endsOn = new Date(dto.endsOn);

    if (endsOn < startsOn) {
      throw new ForbiddenException(
        'Leave end date cannot be before start date',
      );
    }

    const overlappingApproved = await this.prisma.staffLeaveRequest.findFirst({
      where: {
        tenantId: actor.tenantId,
        staffId: staff.id,
        status: 'APPROVED',
        startsOn: { lte: endsOn },
        endsOn: { gte: startsOn },
      },
    });

    if (overlappingApproved) {
      throw new ConflictException(
        'An approved leave request already overlaps this date range',
      );
    }

    const leave = await this.prisma.staffLeaveRequest.create({
      data: {
        tenantId: actor.tenantId,
        staffId: staff.id,
        leaveType: dto.leaveType,
        isPaid: dto.leaveType.toUpperCase() !== 'UNPAID',
        startsOn,
        endsOn,
        days: countInclusiveDays(startsOn, endsOn),
        reason: dto.reason,
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'staff_leave_request',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: leave.id,
      after: {
        staffId: staff.id,
        leaveType: leave.leaveType,
        startsOn: leave.startsOn,
        endsOn: leave.endsOn,
      },
    });

    return leave;
  }

  async reviewLeaveRequest(
    leaveRequestId: string,
    dto: ReviewStaffLeaveRequestDto,
    actor: AuthContext,
  ) {
    const leave = await this.prisma.staffLeaveRequest.findFirst({
      where: {
        id: leaveRequestId,
        tenantId: actor.tenantId,
      },
    });

    if (!leave) {
      throw new NotFoundException('Leave request not found in this tenant');
    }

    if (leave.status !== 'PENDING') {
      throw new ConflictException(
        'Only pending leave requests can be reviewed',
      );
    }

    if (dto.status === 'REJECTED' && !dto.reviewNote) {
      throw new ConflictException(
        'A review note is required when rejecting a leave request',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const reviewed = await tx.staffLeaveRequest.update({
        where: { id: leave.id },
        data: {
          status: dto.status,
          reviewedById: actor.userId,
          reviewedAt: new Date(),
          reviewNote: dto.reviewNote ?? null,
        },
      });

      const overlapAnomalies: Array<{
        date: string;
        existingStatus: AttendanceStatus;
      }> = [];

      if (dto.status === 'APPROVED' && leave.isPaid) {
        const year = reviewed.startsOn.getFullYear();
        const existingBalance = await tx.staffLeaveBalance.findUnique({
          where: {
            tenantId_staffId_leaveType_year: {
              tenantId: actor.tenantId,
              staffId: reviewed.staffId,
              leaveType: reviewed.leaveType,
              year,
            },
          },
        });
        const availableDays = Number(
          (existingBalance?.allocated ?? new Prisma.Decimal(0))
            .add(existingBalance?.carried ?? new Prisma.Decimal(0))
            .sub(existingBalance?.used ?? new Prisma.Decimal(0)),
        );

        if (availableDays < Number(reviewed.days)) {
          throw new ForbiddenException(
            'Approving this leave request would result in a negative leave balance',
          );
        }

        await tx.staffLeaveBalance.upsert({
          where: {
            tenantId_staffId_leaveType_year: {
              tenantId: actor.tenantId,
              staffId: reviewed.staffId,
              leaveType: reviewed.leaveType,
              year,
            },
          },
          update: {
            used: {
              increment: reviewed.days,
            },
          },
          create: {
            tenantId: actor.tenantId,
            staffId: reviewed.staffId,
            leaveType: reviewed.leaveType,
            year,
            allocated: new Prisma.Decimal(0),
            used: reviewed.days,
          },
        });

        for (const leaveDate of eachDateInclusive(
          reviewed.startsOn,
          reviewed.endsOn,
        )) {
          const attendanceDay = stripTime(leaveDate);
          const existingAttendance = await tx.staffAttendance.findUnique({
            where: {
              tenantId_staffId_attendanceDate: {
                tenantId: actor.tenantId,
                staffId: reviewed.staffId,
                attendanceDate: attendanceDay,
              },
            },
          });

          if (!existingAttendance) {
            await tx.staffAttendance.create({
              data: {
                tenantId: actor.tenantId,
                staffId: reviewed.staffId,
                attendanceDate: attendanceDay,
                status: AttendanceStatus.LEAVE,
                leaveType: reviewed.leaveType,
                note: `Approved leave request ${reviewed.id}`,
                approvedById: actor.userId,
              },
            });
            continue;
          }

          if (existingAttendance.status === AttendanceStatus.LEAVE) {
            await tx.staffAttendance.update({
              where: {
                tenantId_staffId_attendanceDate: {
                  tenantId: actor.tenantId,
                  staffId: reviewed.staffId,
                  attendanceDate: attendanceDay,
                },
              },
              data: {
                leaveType: reviewed.leaveType,
                note: `Approved leave request ${reviewed.id}`,
              },
            });
          } else {
            overlapAnomalies.push({
              date: attendanceDay.toISOString().split('T')[0],
              existingStatus: existingAttendance.status,
            });
          }
        }
      }

      return {
        reviewed,
        overlapAnomalies,
      };
    });

    await this.auditService.record({
      action: 'review',
      resource: 'staff_leave_request',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.reviewed.id,
      after: {
        status: updated.reviewed.status,
        reviewNote: updated.reviewed.reviewNote,
        overlapAnomalies: updated.overlapAnomalies,
      },
    });

    if (updated.reviewed.status === 'APPROVED') {
      this.eventEmitter.emit('staff.leave.approved', {
        tenantId: actor.tenantId,
        leaveRequestId: updated.reviewed.id,
        staffId: updated.reviewed.staffId,
        startsOn: updated.reviewed.startsOn,
        endsOn: updated.reviewed.endsOn,
        reviewedById: actor.userId,
      });
    }

    return {
      ...updated.reviewed,
      overlapAnomalies: updated.overlapAnomalies,
    };
  }

  async cancelLeaveRequest(leaveRequestId: string, actor: AuthContext) {
    const leave = await this.prisma.staffLeaveRequest.findFirst({
      where: {
        id: leaveRequestId,
        tenantId: actor.tenantId,
      },
    });

    if (!leave) {
      throw new NotFoundException('Leave request not found');
    }

    if (leave.status === 'CANCELLED') {
      return leave;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.staffLeaveRequest.update({
        where: { id: leave.id },
        data: {
          status: 'CANCELLED',
        },
      });

      // Restore balance if it was approved and paid
      if (leave.status === 'APPROVED' && leave.isPaid) {
        const year = leave.startsOn.getFullYear();
        await tx.staffLeaveBalance.update({
          where: {
            tenantId_staffId_leaveType_year: {
              tenantId: actor.tenantId,
              staffId: leave.staffId,
              leaveType: leave.leaveType,
              year,
            },
          },
          data: {
            used: {
              decrement: leave.days,
            },
          },
        });

        // Revert attendance records
        for (const leaveDate of eachDateInclusive(
          leave.startsOn,
          leave.endsOn,
        )) {
          const attendanceDay = stripTime(leaveDate);
          const existing = await tx.staffAttendance.findUnique({
            where: {
              tenantId_staffId_attendanceDate: {
                tenantId: actor.tenantId,
                staffId: leave.staffId,
                attendanceDate: attendanceDay,
              },
            },
          });

          if (
            existing?.status === AttendanceStatus.LEAVE &&
            existing.leaveType === leave.leaveType
          ) {
            // Either delete or mark as ABSENT if it was generated by leave
            // For safety, let's just delete it if it has the specific note
            if (existing.note?.includes(leave.id)) {
              await tx.staffAttendance.delete({
                where: { id: existing.id },
              });
            }
          }
        }
      }

      return cancelled;
    });

    await this.auditService.record({
      action: 'cancel',
      resource: 'staff_leave_request',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      before: { status: leave.status },
      after: { status: updated.status },
    });

    return updated;
  }

  /**
   * Helper for Timetable substitution to check if a teacher is absent or on leave
   */
  async getTeacherAbsenceContext(
    tenantId: string,
    staffId: string,
    date: Date,
  ) {
    const targetDate = stripTime(date);

    const [attendance, leave] = await Promise.all([
      this.prisma.staffAttendance.findUnique({
        where: {
          tenantId_staffId_attendanceDate: {
            tenantId,
            staffId,
            attendanceDate: targetDate,
          },
        },
      }),
      this.prisma.staffLeaveRequest.findFirst({
        where: {
          tenantId,
          staffId,
          status: 'APPROVED',
          startsOn: { lte: targetDate },
          endsOn: { gte: targetDate },
        },
      }),
    ]);

    return {
      isAbsent: attendance?.status === 'ABSENT' || !!leave,
      attendanceStatus: attendance?.status ?? null,
      leaveType: leave?.leaveType ?? null,
    };
  }

  async getRoster(
    actor: AuthContext,
    academicYearId: string,
    classId: string,
    sectionId?: string,
    attendanceDate?: string,
  ) {
    const { academicYear, classroom, section } =
      await this.validateAttendanceScope(actor, {
        academicYearId,
        classId,
        sectionId,
      });
    const parsedAttendanceDate = stripTime(
      attendanceDate ? new Date(attendanceDate) : new Date(),
    );
    const calendarDay = await this.resolveCalendarDay(
      actor.tenantId,
      parsedAttendanceDate,
    );

    const [students, existingSession] = await Promise.all([
      this.prisma.student.findMany({
        where: {
          tenantId: actor.tenantId,
          classId,
          ...(sectionId ? { sectionId } : {}),
          enrollments: {
            some: {
              tenantId: actor.tenantId,
              academicYearId,
              classId,
              sectionId: sectionId ?? null,
              status: EnrollmentStatus.ACTIVE,
            },
          },
        },
        include: {
          guardianLinks: {
            include: {
              guardian: true,
            },
          },
        },
        orderBy: [{ rollNumber: 'asc' }, { firstNameEn: 'asc' }],
      }),
      this.prisma.attendanceSession.findFirst({
        where: {
          tenantId: actor.tenantId,
          academicYearId,
          classId,
          sectionId: sectionId ?? null,
          attendanceDate: parsedAttendanceDate,
        },
        include: {
          records: true,
        },
      }),
    ]);
    const existingRecordByStudent = new Map(
      existingSession?.records.map((record) => [record.studentId, record]) ??
        [],
    );

    return {
      academicYear,
      class: classroom,
      section,
      attendanceDate: parsedAttendanceDate,
      calendarDay,
      attendanceState: {
        submittedAt: existingSession?.submittedAt ?? null,
        lockAt: existingSession?.lockAt ?? null,
        isSubmitted: Boolean(existingSession?.submittedAt),
        isLocked: Boolean(
          existingSession && existingSession.lockAt <= new Date(),
        ),
        conflictStatus:
          existingSession?.conflictStatus ?? AttendanceConflictStatus.NONE,
      },
      existingSession: existingSession
        ? {
            id: existingSession.id,
            submittedAt: existingSession.submittedAt,
            lockAt: existingSession.lockAt,
            conflictStatus: existingSession.conflictStatus,
          }
        : null,
      students: students.map((student) => {
        const record = existingRecordByStudent.get(student.id);

        return {
          id: student.id,
          studentSystemId: student.studentSystemId,
          fullNameEn: `${student.firstNameEn} ${student.lastNameEn}`.trim(),
          rollNumber: student.rollNumber,
          hasMedicalAlert: Boolean(
            student.severeAllergies ||
            student.medicalConditions ||
            student.specialNeeds,
          ),
          primaryGuardian:
            student.guardianLinks.find((link) => link.isPrimary)?.guardian ??
            student.guardianLinks[0]?.guardian ??
            null,
          status: record?.status ?? AttendanceStatus.PRESENT,
          remark: record?.remark ?? null,
        };
      }),
    };
  }

  async getAnalytics(actor: AuthContext) {
    const studentScope = await buildStudentScopeFilter(this.prisma, actor);
    const teacherSectionIds = await this.getTeacherSectionIds(
      actor,
      studentScope,
    );

    const sessions = await this.prisma.attendanceSession.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(teacherSectionIds ? { sectionId: { in: teacherSectionIds } } : {}),
      },
      include: {
        class: true,
        section: true,
        records: {
          where:
            Object.keys(studentScope).length > 0 ? studentScope : undefined,
          include: {
            student: true,
          },
        },
      },
      orderBy: [{ attendanceDate: 'desc' }],
      take: 60,
    });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const nextYearStart = new Date(now.getFullYear() + 1, 0, 1);
    const calendarByDate = await this.loadCalendarDayMap(
      actor.tenantId,
      sessions.map((session) => session.attendanceDate),
    );

    const commonWhere = {
      tenantId: actor.tenantId,
      attendanceSession: {
        ...(teacherSectionIds ? { sectionId: { in: teacherSectionIds } } : {}),
      },
      ...(Object.keys(studentScope).length > 0 ? studentScope : {}),
    };

    const [monthlyRecords, annualRecords] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where: {
          ...commonWhere,
          attendanceSession: {
            ...commonWhere.attendanceSession,
            attendanceDate: {
              gte: monthStart,
              lt: nextMonthStart,
            },
          },
        },
      }),
      this.prisma.attendanceRecord.findMany({
        where: {
          ...commonWhere,
          attendanceSession: {
            ...commonWhere.attendanceSession,
            attendanceDate: {
              gte: yearStart,
              lt: nextYearStart,
            },
          },
        },
      }),
    ]);

    const studentAbsenceCounts = new Map<string, number>();
    const studentTotals = new Map<
      string,
      { present: number; total: number; name: string; studentSystemId: string }
    >();
    const recordsByStudent = new Map<
      string,
      Array<{ attendanceDate: Date; status: AttendanceStatus }>
    >();

    for (const session of sessions) {
      for (const record of session.records) {
        const name =
          `${record.student.firstNameEn} ${record.student.lastNameEn}`.trim();
        const totals = studentTotals.get(record.studentId) ?? {
          present: 0,
          total: 0,
          name,
          studentSystemId: record.student.studentSystemId,
        };
        totals.total += 1;
        if (
          record.status === AttendanceStatus.PRESENT ||
          record.status === AttendanceStatus.LATE
        ) {
          totals.present += 1;
        }
        studentTotals.set(record.studentId, totals);
        recordsByStudent.set(record.studentId, [
          ...(recordsByStudent.get(record.studentId) ?? []),
          {
            attendanceDate: session.attendanceDate,
            status: record.status,
          },
        ]);

        if (record.status === AttendanceStatus.ABSENT) {
          studentAbsenceCounts.set(
            record.studentId,
            (studentAbsenceCounts.get(record.studentId) ?? 0) + 1,
          );
        }
      }
    }

    const todayKey = getDateKey(stripTime(now));
    const todaySessions = sessions.filter(
      (session) => getDateKey(stripTime(session.attendanceDate)) === todayKey,
    );
    const todayTotals = summarizeAttendance(
      todaySessions.flatMap((session) => session.records),
    );

    return {
      sessionsReviewed: sessions.length,
      todaySummary: {
        date: stripTime(now).toISOString(),
        sessionCount: todaySessions.length,
        totals: todayTotals,
      },
      monthlyAttendance: {
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        attendancePercent: calculateAttendancePercent(monthlyRecords),
      },
      annualAttendance: {
        year: now.getFullYear(),
        attendancePercent: calculateAttendancePercent(annualRecords),
      },
      latestSessions: sessions.map((session) => ({
        sessionId: session.id,
        attendanceDate: session.attendanceDate,
        className: session.class.name,
        sectionName: session.section?.name ?? null,
        conflictStatus: session.conflictStatus,
        calendarDay: calendarByDate.get(
          getDateKey(stripTime(session.attendanceDate)),
        ),
        totals: summarizeAttendance(session.records),
      })),
      classHeatmap: sessions.map((session) => ({
        attendanceDate: session.attendanceDate.toISOString(),
        className: session.class.name,
        sectionName: session.section?.name ?? null,
        attendancePercent: calculateAttendancePercent(session.records),
      })),
      absenceHotlist: Array.from(studentAbsenceCounts.entries())
        .map(([studentId, absenceCount]) => ({ studentId, absenceCount }))
        .sort((a, b) => b.absenceCount - a.absenceCount)
        .slice(0, 10),
      consecutiveAbsences: Array.from(recordsByStudent.entries())
        .map(([studentId, records]) => ({
          studentId,
          consecutiveAbsences: countConsecutiveAbsences(records),
        }))
        .filter((item) => item.consecutiveAbsences >= 2)
        .sort((a, b) => b.consecutiveAbsences - a.consecutiveAbsences),
      below80Warnings: Array.from(studentTotals.entries())
        .map(([studentId, totals]) => ({
          studentId,
          studentSystemId: totals.studentSystemId,
          fullNameEn: totals.name,
          attendancePercent:
            totals.total === 0
              ? 100
              : Math.round((totals.present / totals.total) * 10000) / 100,
        }))
        .filter((item) => item.attendancePercent < 80)
        .sort((a, b) => a.attendancePercent - b.attendancePercent),
    };
  }

  async getSummary(query: ListAttendanceSummaryDto, actor: AuthContext) {
    await this.validateAttendanceScope(actor, {
      academicYearId: query.academicYearId,
      classId: query.classId,
      sectionId: query.sectionId,
    });

    if (query.studentId) {
      await this.ensureStudentInAttendanceScope(query.studentId, actor, {
        academicYearId: query.academicYearId,
        classId: query.classId,
        sectionId: query.sectionId,
      });
    }

    const attendanceDate = stripTime(
      query.attendanceDate ? new Date(query.attendanceDate) : new Date(),
    );
    const month = query.month ?? attendanceDate.getMonth() + 1;
    const year = query.year ?? attendanceDate.getFullYear();
    const monthStart = new Date(year, month - 1, 1);
    const nextMonthStart = new Date(year, month, 1);

    const [dailySession, monthlyRecords] = await Promise.all([
      this.prisma.attendanceSession.findFirst({
        where: {
          tenantId: actor.tenantId,
          academicYearId: query.academicYearId,
          classId: query.classId,
          sectionId: query.sectionId ?? null,
          attendanceDate,
        },
        include: {
          records: true,
        },
      }),
      query.studentId
        ? this.prisma.attendanceRecord.findMany({
            where: {
              tenantId: actor.tenantId,
              studentId: query.studentId,
              attendanceSession: {
                tenantId: actor.tenantId,
                academicYearId: query.academicYearId,
                classId: query.classId,
                sectionId: query.sectionId ?? null,
                attendanceDate: {
                  gte: monthStart,
                  lt: nextMonthStart,
                },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    return {
      classDaily: {
        attendanceDate: attendanceDate.toISOString(),
        academicYearId: query.academicYearId,
        classId: query.classId,
        sectionId: query.sectionId ?? null,
        submittedAt: dailySession?.submittedAt ?? null,
        totals: summarizeAttendance(dailySession?.records ?? []),
      },
      studentMonthly: query.studentId
        ? {
            studentId: query.studentId,
            month,
            year,
            attendancePercent: calculateAttendancePercent(monthlyRecords),
            consecutiveAbsences: await this.countConsecutiveAbsencesForStudent(
              actor.tenantId,
              query.studentId,
              attendanceDate,
            ),
          }
        : null,
    };
  }

  async exportMonthlyRegister(
    dto: GetMonthlyRegisterDto,
    format: 'csv' | 'pdf',
    actor: AuthContext,
  ) {
    const data = await this.getMonthlyRegister(dto, actor);

    const headers = [
      'Roll No',
      'Student Name',
      ...Array.from({ length: data.daysCount }, (_, i) => (i + 1).toString()),
      'PRESENT',
      'ABSENT',
      'LATE',
      'LEAVE',
      'HOLIDAY',
      'TOTAL',
    ];

    const rows = data.matrix.map(
      (student: {
        rollNumber?: number | string | null;
        name: string;
        attendance: Array<{ status: string }>;
        totals: Record<string, number | string>;
      }) => [
        student.rollNumber?.toString() ?? '',
        student.name,
        ...student.attendance.map((a: { status: string }) => {
          if (a.status === 'PRESENT') return 'P';
          if (a.status === 'ABSENT') return 'A';
          if (a.status === 'LATE') return 'L';
          if (a.status === 'HOLIDAY') return 'H';
          if (a.status === 'LEAVE') return 'Lv';
          if (a.status === 'HALF_DAY') return '0.5';
          return '-';
        }),
        student.totals.PRESENT.toString(),
        student.totals.ABSENT.toString(),
        student.totals.LATE.toString(),
        student.totals.LEAVE.toString(),
        student.totals.HOLIDAY.toString(),
        student.totals.totalDays.toString(),
      ],
    );

    let content: string | Buffer;
    if (format === 'csv') {
      const escapeCsv = (str: string) => `"${str.replace(/"/g, '""')}"`;
      content = [
        headers.map(escapeCsv).join(','),
        ...rows.map((row) => row.map(escapeCsv).join(',')),
      ].join('\n');
    } else {
      // Basic PDF table generation using simple-pdf
      content = buildRosterPdf({
        schoolName: 'Attendance Register',
        className: data.className,
        sectionName: data.sectionName,
        academicYear: dto.academicYearId,
        headers,
        rows: data.matrix.map((s) => ({
          'Roll No': s.rollNumber ?? '',
          'Student Name': s.name,
          ...Object.fromEntries(
            s.attendance.map((a, i: number) => [
              (i + 1).toString(),
              a.status[0],
            ]),
          ),
          PRESENT: s.totals.PRESENT,
          ABSENT: s.totals.ABSENT,
          TOTAL: s.totals.totalDays,
        })),
      });
    }

    const fileName = `attendance-register-${dto.classId}-${dto.year}-${String(
      dto.month,
    ).padStart(2, '0')}.${format}`;
    const contentBuffer = Buffer.isBuffer(content)
      ? content
      : Buffer.from(content, 'utf8');
    const fileAsset = this.fileRegistryService
      ? await this.fileRegistryService.registerGeneratedFile({
          tenantId: actor.tenantId,
          generatedByUserId: actor.userId,
          originalFilename: fileName,
          content: contentBuffer,
          mimeType: format === 'pdf' ? 'application/pdf' : 'text/csv',
          module: 'attendance',
          metadata: {
            reportKey: 'attendance_monthly_register',
            format,
            filters: dto as unknown as Prisma.InputJsonValue,
          },
        })
      : null;

    await this.prisma.reportExport.create({
      data: {
        tenantId: actor.tenantId,
        reportKey: 'attendance_monthly_register',
        format,
        filters: dto as unknown as Prisma.InputJsonValue,
        status: 'COMPLETED',
        fileAssetId: fileAsset?.id ?? null,
        requestedBy: actor.userId,
        completedAt: new Date(),
      },
    });

    await this.auditService.record({
      action: 'export',
      resource: 'attendance_register',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        format,
        filters: dto,
      },
    });

    return content;
  }

  async processDailyEscalationWarnings(
    actor: AuthContext,
    runDate = new Date(),
  ) {
    const warningDate = stripTime(runDate);
    const warningDateKey = getDateKey(warningDate);
    const windowStart = new Date(warningDate);
    windowStart.setDate(windowStart.getDate() - 59);
    const monthStart = new Date(
      warningDate.getFullYear(),
      warningDate.getMonth(),
      1,
    );
    const nextDay = new Date(warningDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const sessions = await this.prisma.attendanceSession.findMany({
      where: {
        tenantId: actor.tenantId,
        attendanceDate: {
          gte: windowStart,
          lt: nextDay,
        },
      },
      include: {
        class: true,
        section: true,
        records: {
          include: {
            student: true,
          },
        },
      },
      orderBy: [{ attendanceDate: 'desc' }],
    });

    const recordsByStudent = new Map<
      string,
      Array<{
        attendanceDate: Date;
        status: AttendanceStatus;
        studentSystemId: string;
        fullNameEn: string;
        className: string;
        sectionName: string | null;
      }>
    >();
    const monthlyTotals = new Map<
      string,
      {
        present: number;
        total: number;
        studentSystemId: string;
        fullNameEn: string;
        className: string;
        sectionName: string | null;
      }
    >();

    for (const session of sessions) {
      for (const record of session.records) {
        const fullNameEn =
          `${record.student.firstNameEn} ${record.student.lastNameEn}`.trim();
        const className = session.class.name;
        const sectionName = session.section?.name ?? null;

        recordsByStudent.set(record.studentId, [
          ...(recordsByStudent.get(record.studentId) ?? []),
          {
            attendanceDate: session.attendanceDate,
            status: record.status,
            studentSystemId: record.student.studentSystemId,
            fullNameEn,
            className,
            sectionName,
          },
        ]);

        if (
          session.attendanceDate >= monthStart &&
          session.attendanceDate < nextDay
        ) {
          const monthly = monthlyTotals.get(record.studentId) ?? {
            present: 0,
            total: 0,
            studentSystemId: record.student.studentSystemId,
            fullNameEn,
            className,
            sectionName,
          };
          monthly.total += 1;
          if (
            record.status === AttendanceStatus.PRESENT ||
            record.status === AttendanceStatus.LATE
          ) {
            monthly.present += 1;
          }
          monthlyTotals.set(record.studentId, monthly);
        }
      }
    }

    const warnings: Array<{
      type: 'consecutive_absence' | 'below_threshold';
      sourceType: string;
      sourceId: string;
      studentId: string;
      studentSystemId: string;
      fullNameEn: string;
      className: string;
      sectionName: string | null;
      warningDate: string;
      consecutiveAbsences?: number;
      attendancePercent?: number;
      deliveryCount: number;
    }> = [];

    for (const [studentId, records] of recordsByStudent.entries()) {
      const consecutiveAbsences = countConsecutiveAbsences(records);
      const latest = records[0];

      if (consecutiveAbsences >= 3 && latest) {
        const sourceType = 'attendance_consecutive_absence_warning';
        const sourceId = `${studentId}:${warningDateKey}`;
        const alreadySent = await this.prisma.notificationDelivery.findFirst({
          where: {
            tenantId: actor.tenantId,
            sourceType,
            sourceId,
          },
        });

        if (!alreadySent) {
          const delivery =
            await this.communicationsService.recordDeliveryRecords({
              actor,
              sourceType,
              sourceId,
              audienceType: AudienceType.ROLE,
              roleNames: ['admin', 'teacher'],
              studentIds: [],
              title: 'Attendance warning',
              body: `${latest.fullNameEn} has been absent for ${consecutiveAbsences} consecutive attendance days.`,
              channels: [NotificationChannel.PUSH, NotificationChannel.SMS],
              requiredConsentTypes: [ConsentType.MESSAGING],
            });

          warnings.push({
            type: 'consecutive_absence',
            sourceType,
            sourceId,
            studentId,
            studentSystemId: latest.studentSystemId,
            fullNameEn: latest.fullNameEn,
            className: latest.className,
            sectionName: latest.sectionName,
            warningDate: warningDate.toISOString(),
            consecutiveAbsences,
            deliveryCount: delivery.count,
          });
        }
      }
    }

    for (const [studentId, totals] of monthlyTotals.entries()) {
      const attendancePercent =
        totals.total === 0
          ? 100
          : Math.round((totals.present / totals.total) * 10000) / 100;

      if (attendancePercent >= 80) {
        continue;
      }

      const sourceType = 'attendance_below_threshold_warning';
      const sourceId = `${studentId}:${warningDateKey}`;
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

      const delivery = await this.communicationsService.recordDeliveryRecords({
        actor,
        sourceType,
        sourceId,
        audienceType: AudienceType.ALL,
        studentIds: [studentId],
        title: 'Attendance threshold warning',
        body: `${totals.fullNameEn} is below the 80% monthly attendance threshold.`,
        channels: [NotificationChannel.PUSH, NotificationChannel.SMS],
        requiredConsentTypes: [ConsentType.MESSAGING],
      });

      warnings.push({
        type: 'below_threshold',
        sourceType,
        sourceId,
        studentId,
        studentSystemId: totals.studentSystemId,
        fullNameEn: totals.fullNameEn,
        className: totals.className,
        sectionName: totals.sectionName,
        warningDate: warningDate.toISOString(),
        attendancePercent,
        deliveryCount: delivery.count,
      });
    }

    await this.auditService.record({
      action: 'process',
      resource: 'attendance_escalation_warning',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        warningDate: warningDate.toISOString(),
        warningCount: warnings.length,
      },
    });

    return {
      warningDate: warningDate.toISOString(),
      warningCount: warnings.length,
      warnings,
    };
  }

  async getFollowUpQueue(actor: AuthContext) {
    const anomalies = await this.getAttendanceAnomalies(actor);
    const items = [
      ...anomalies.absenceStreaks.map((item) => ({
        type: 'consecutive_absence' as const,
        studentId: item.studentId,
        studentName: item.studentName,
        className: item.className,
        sectionName: item.sectionName,
        priority: item.streakCount >= 5 ? 'high' : 'medium',
        count: item.streakCount,
        reason: `${item.streakCount} consecutive absences`,
      })),
      ...anomalies.repeatedLates.map((item) => ({
        type: 'repeated_late' as const,
        studentId: item.studentId,
        studentName: item.studentName,
        className: item.className,
        sectionName: item.sectionName,
        priority: item.lateCount >= 5 ? 'high' : 'medium',
        count: item.lateCount,
        reason: `${item.lateCount} late marks in the last 30 days`,
      })),
    ].sort((a, b) => {
      const priority = priorityWeight(b.priority) - priorityWeight(a.priority);
      return (
        priority ||
        b.count - a.count ||
        a.studentName.localeCompare(b.studentName)
      );
    });

    return {
      generatedAt: new Date().toISOString(),
      total: items.length,
      items,
    };
  }

  private async recordParentStatusNotifications(
    session: {
      id: string;
      attendanceDate: Date;
      classId: string;
      sectionId: string | null;
      records: Array<{ studentId: string; status: AttendanceStatus }>;
    },
    records: Array<{ studentId: string; status: AttendanceStatus }>,
    actor: AuthContext,
  ) {
    const policy = await this.loadM2AttendancePolicy(actor.tenantId);
    const parentNotificationRecords = records.filter((record) => {
      if (record.status === AttendanceStatus.ABSENT) {
        return policy.notifyParentsForAbsence;
      }
      if (record.status === AttendanceStatus.LATE) {
        return policy.notifyParentsForLate;
      }
      return false;
    });

    if (parentNotificationRecords.length === 0) {
      return;
    }

    let deliveryCount = 0;
    for (const record of parentNotificationRecords) {
      const isLate = record.status === AttendanceStatus.LATE;
      const sourceType = isLate
        ? 'attendance_parent_late_notification'
        : 'attendance_parent_absence_notification';
      const sourceId = `${session.id}:${record.studentId}:${record.status}`;
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

      const delivery = await this.communicationsService.recordDeliveryRecords({
        actor,
        sourceType,
        sourceId,
        audienceType: AudienceType.ALL,
        studentIds: [record.studentId],
        title: isLate ? 'Late attendance update' : 'Absence attendance update',
        body: isLate
          ? renderM2AttendanceTemplate(policy.lateMessageTemplate)
          : renderM2AttendanceTemplate(policy.absenceMessageTemplate),
        channels: policy.parentNotificationChannels,
        requiredConsentTypes: [ConsentType.MESSAGING],
        communicationCategory: 'ESSENTIAL',
      });
      deliveryCount += delivery.count;
    }

    await this.auditService.record({
      action: 'parent_status_notifications',
      resource: 'attendance_session',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: session.id,
      after: {
        attendanceDate: session.attendanceDate.toISOString(),
        classId: session.classId,
        sectionId: session.sectionId,
        notifiedRecords: parentNotificationRecords.length,
        deliveryCount,
      },
    });
  }

  private async validateAttendanceScope(
    actor: AuthContext,
    scope: {
      academicYearId: string;
      classId: string;
      sectionId?: string | null;
    },
  ) {
    const [academicYear, classroom, section] = await Promise.all([
      this.prisma.academicYear.findFirst({
        where: { id: scope.academicYearId, tenantId: actor.tenantId },
      }),
      this.prisma.class.findFirst({
        where: { id: scope.classId, tenantId: actor.tenantId },
      }),
      scope.sectionId
        ? this.prisma.section.findFirst({
            where: { id: scope.sectionId, tenantId: actor.tenantId },
          })
        : Promise.resolve(null),
    ]);

    if (!academicYear) {
      throw new NotFoundException('Academic year not found in this tenant');
    }

    if (!classroom) {
      throw new NotFoundException('Class not found in this tenant');
    }

    if (scope.sectionId && !section) {
      throw new NotFoundException('Section not found in this tenant');
    }

    if (section && section.classId !== scope.classId) {
      throw new ConflictException(
        'Section must belong to the selected class in this tenant',
      );
    }

    // Teacher Assignment check
    await this.checkTeacherAssignment(actor, scope.classId, scope.sectionId);

    return { academicYear, classroom, section };
  }

  private async checkTeacherAssignment(
    actor: AuthContext,
    classId: string,
    sectionId?: string | null,
  ) {
    // Admins and full-permission staff can access everything
    if (
      actor.permissions.includes('attendance:mark_all') ||
      actor.permissions.includes('attendance:override_lock') ||
      actor.permissions.includes('attendance:read_all')
    ) {
      return;
    }

    const staff = await this.prisma.staff.findFirst({
      where: { userId: actor.userId, tenantId: actor.tenantId },
    });

    if (!staff) {
      throw new ForbiddenException('Staff record not found in this tenant');
    }

    // Check if class teacher of the section
    if (sectionId) {
      const section = await this.prisma.section.findFirst({
        where: {
          id: sectionId,
          classTeacherId: staff.id,
          tenantId: actor.tenantId,
        },
      });
      if (section) return;
    }

    // Check if subject teacher in this section/class
    const assignment = await this.prisma.subjectTeacherAssignment.findFirst({
      where: {
        staffId: staff.id,
        classId,
        ...(sectionId ? { sectionId } : {}),
        tenantId: actor.tenantId,
      },
    });

    if (!assignment) {
      throw new ForbiddenException(
        'You are not assigned as Class Teacher or Subject Teacher for this section',
      );
    }
  }

  private async ensureStudentInAttendanceScope(
    studentId: string,
    actor: AuthContext,
    scope: {
      academicYearId: string;
      classId: string;
      sectionId?: string | null;
    },
  ) {
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        tenantId: actor.tenantId,
        classId: scope.classId,
        ...(scope.sectionId ? { sectionId: scope.sectionId } : {}),
        enrollments: {
          some: {
            tenantId: actor.tenantId,
            academicYearId: scope.academicYearId,
            classId: scope.classId,
            sectionId: scope.sectionId ?? null,
            status: EnrollmentStatus.ACTIVE,
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found in this attendance scope');
    }
  }

  private async countConsecutiveAbsencesForStudent(
    tenantId: string,
    studentId: string,
    throughDate: Date,
  ) {
    const nextDay = new Date(stripTime(throughDate));
    nextDay.setDate(nextDay.getDate() + 1);
    const sessions = await this.prisma.attendanceSession.findMany({
      where: {
        tenantId,
        attendanceDate: {
          lt: nextDay,
        },
        records: {
          some: {
            tenantId,
            studentId,
          },
        },
      },
      include: {
        records: {
          where: {
            tenantId,
            studentId,
          },
        },
      },
      orderBy: [{ attendanceDate: 'desc' }],
      take: 30,
    });

    return countConsecutiveAbsences(
      sessions.flatMap((session) =>
        session.records.map((record) => ({
          attendanceDate: session.attendanceDate,
          status: record.status,
        })),
      ),
    );
  }

  private async buildSyncTrustMetadata(
    dto: SyncAttendanceDto,
    actor: AuthContext,
    attendanceDate: Date,
  ) {
    const priorSubmission =
      await this.prisma.attendanceSyncSubmission.findFirst({
        where: {
          tenantId: actor.tenantId,
          academicYearId: dto.academicYearId,
          classId: dto.classId,
          sectionId: dto.sectionId ?? null,
          attendanceDate,
          clientSubmissionId: {
            not: dto.clientSubmissionId,
          },
          syncStatus: {
            in: [
              AttendanceSyncStatus.ACCEPTED,
              AttendanceSyncStatus.CONFLICTED,
            ],
          },
        },
        orderBy: [{ serverReceivedAt: 'desc' }],
      });

    if (!priorSubmission) {
      return {
        firstSeen: true,
        flagged: false,
        flagReason: null,
        priorSubmissionId: null,
      };
    }

    const fingerprintMismatch =
      Boolean(dto.sessionFingerprint) &&
      Boolean(priorSubmission.sessionFingerprint) &&
      dto.sessionFingerprint !== priorSubmission.sessionFingerprint;
    const deviceMismatch =
      Boolean(dto.deviceId) &&
      Boolean(priorSubmission.deviceId) &&
      dto.deviceId !== priorSubmission.deviceId;

    return {
      firstSeen: false,
      flagged: fingerprintMismatch || deviceMismatch,
      flagReason: fingerprintMismatch
        ? 'device_fingerprint_mismatch'
        : deviceMismatch
          ? 'device_id_mismatch'
          : null,
      priorSubmissionId: priorSubmission.id,
      priorDeviceId: priorSubmission.deviceId,
      priorSessionFingerprint: priorSubmission.sessionFingerprint,
    };
  }

  private ensureAttendanceReviewAuthority(actor: AuthContext) {
    const permissions = actor.permissions ?? [];

    if (
      !permissions.includes('attendance:review_conflicts') &&
      !permissions.includes('attendance:manage_all')
    ) {
      throw new ForbiddenException(
        'You do not have permission to review attendance conflicts/corrections',
      );
    }
  }

  private async loadM2AttendancePolicy(tenantId: string) {
    const setting = await this.prisma.tenantSetting.findUnique({
      where: {
        tenantId_key: {
          tenantId,
          key: M2_ATTENDANCE_HARDENING_POLICY_KEY,
        },
      },
      select: { value: true },
    });
    const value = setting?.value;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return DEFAULT_M2_ATTENDANCE_POLICY;
    }

    const policy = value as Record<string, unknown>;
    return {
      lockOverrideMinReasonLength: readM2ReasonPolicyNumber(
        policy.lockOverrideMinReasonLength,
        DEFAULT_M2_ATTENDANCE_POLICY.lockOverrideMinReasonLength,
      ),
      correctionReviewMinReasonLength: readM2ReasonPolicyNumber(
        policy.correctionReviewMinReasonLength,
        DEFAULT_M2_ATTENDANCE_POLICY.correctionReviewMinReasonLength,
      ),
      parentNotificationChannels: readM2NotificationChannels(
        policy.parentNotificationChannels,
        DEFAULT_M2_ATTENDANCE_POLICY.parentNotificationChannels,
      ),
      notifyParentsForLate: readM2Boolean(
        policy.notifyParentsForLate,
        DEFAULT_M2_ATTENDANCE_POLICY.notifyParentsForLate,
      ),
      notifyParentsForAbsence: readM2Boolean(
        policy.notifyParentsForAbsence,
        DEFAULT_M2_ATTENDANCE_POLICY.notifyParentsForAbsence,
      ),
      absenceMessageTemplate: readM2String(
        policy.absenceMessageTemplate,
        DEFAULT_M2_ATTENDANCE_POLICY.absenceMessageTemplate,
      ),
      lateMessageTemplate: readM2String(
        policy.lateMessageTemplate,
        DEFAULT_M2_ATTENDANCE_POLICY.lateMessageTemplate,
      ),
    };
  }

  private async ensureStudentAttendanceAccess(
    studentId: string,
    actor: AuthContext,
  ) {
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        tenantId: actor.tenantId,
      },
      select: {
        id: true,
        classId: true,
        sectionId: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found in this school.');
    }

    if (actor.roles.includes('parent')) {
      const guardian = await this.prisma.guardian.findFirst({
        where: {
          tenantId: actor.tenantId,
          userId: actor.userId,
        },
        include: {
          studentLinks: true,
        },
      });
      const allowedStudentIds = guardian
        ? guardian.studentLinks.map((link) => link.studentId)
        : [];
      if (!allowedStudentIds.includes(studentId)) {
        throw new ForbiddenException(
          'Access denied to this student attendance.',
        );
      }
      return;
    }

    if (actor.roles.includes('student')) {
      const ownStudent = await this.prisma.student.findFirst({
        where: {
          tenantId: actor.tenantId,
          userId: actor.userId,
        },
        select: { id: true },
      });
      if (ownStudent?.id !== studentId) {
        throw new ForbiddenException(
          'Access denied to this student attendance.',
        );
      }
      return;
    }

    if (
      actor.permissions.includes('attendance:read_all') ||
      actor.permissions.includes('attendance:mark_all') ||
      actor.permissions.includes('attendance:override_lock')
    ) {
      return;
    }

    if (actor.roles.includes('teacher')) {
      await this.checkTeacherAssignment(
        actor,
        student.classId,
        student.sectionId,
      );
      return;
    }

    if (!actor.permissions.includes('attendance:read')) {
      throw new ForbiddenException('Access denied to this student attendance.');
    }
  }

  async getAttendanceAnomalies(actor: AuthContext) {
    const today = stripTime(new Date());
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 1. Fetch academic years, classes, and sections
    const [classes, sections, activeAcademicYear] = await Promise.all([
      this.prisma.class.findMany({ where: { tenantId: actor.tenantId } }),
      this.prisma.section.findMany({ where: { tenantId: actor.tenantId } }),
      this.prisma.academicYear.findFirst({
        where: { tenantId: actor.tenantId, isCurrent: true },
      }),
    ]);

    const classMap = new Map(classes.map((c) => [c.id, c.name]));
    const sectionMap = new Map(sections.map((s) => [s.id, s.name]));

    // 2. Fetch active enrollments
    const activeEnrollments = await this.prisma.enrollment.findMany({
      where: {
        tenantId: actor.tenantId,
        status: EnrollmentStatus.ACTIVE,
        ...(activeAcademicYear
          ? { academicYearId: activeAcademicYear.id }
          : {}),
      },
      include: {
        student: {
          select: {
            id: true,
            firstNameEn: true,
            lastNameEn: true,
          },
        },
      },
    });

    // Group expected students by classId & sectionId
    const expectedRosterMap = new Map<string, string[]>();
    const studentInfoMap = new Map<string, { id: string; name: string }>();
    activeEnrollments.forEach((e) => {
      const key = `${e.classId}:${e.sectionId ?? 'none'}`;
      if (!expectedRosterMap.has(key)) {
        expectedRosterMap.set(key, []);
      }
      expectedRosterMap.get(key)!.push(e.studentId);
      studentInfoMap.set(e.studentId, {
        id: e.student.id,
        name: `${e.student.firstNameEn} ${e.student.lastNameEn}`,
      });
    });

    // 3. Fetch attendance sessions from the last 30 days
    const sessions = await this.prisma.attendanceSession.findMany({
      where: {
        tenantId: actor.tenantId,
        attendanceDate: { gte: thirtyDaysAgo, lte: today },
      },
      include: {
        records: true,
        submittedBy: {
          select: {
            email: true,
          },
        },
      },
      orderBy: { attendanceDate: 'desc' },
    });

    // 4. Calculate Absence Streaks & Repeated Lates
    // Load attendance records for the last 45 days (buffer for streaks)
    const streakLimitDate = new Date();
    streakLimitDate.setDate(streakLimitDate.getDate() - 45);

    const allRecentRecords = await this.prisma.attendanceRecord.findMany({
      where: {
        tenantId: actor.tenantId,
        attendanceSession: {
          attendanceDate: { gte: streakLimitDate, lte: today },
        },
      },
      select: {
        studentId: true,
        status: true,
        attendanceSession: {
          select: {
            attendanceDate: true,
          },
        },
      },
    });

    const studentRecords = new Map<
      string,
      Array<{ date: Date; status: AttendanceStatus }>
    >();
    allRecentRecords.forEach((r) => {
      if (!studentRecords.has(r.studentId)) {
        studentRecords.set(r.studentId, []);
      }
      studentRecords.get(r.studentId)!.push({
        date: r.attendanceSession.attendanceDate,
        status: r.status,
      });
    });

    const absenceStreaks: Array<{
      studentId: string;
      studentName: string;
      className: string;
      sectionName: string | null;
      streakCount: number;
    }> = [];

    const repeatedLates: Array<{
      studentId: string;
      studentName: string;
      className: string;
      sectionName: string | null;
      lateCount: number;
    }> = [];

    // Find student classes/sections for returned lists
    const studentEnrollmentInfo = new Map<
      string,
      { classId: string; sectionId: string | null }
    >();
    activeEnrollments.forEach((e) => {
      studentEnrollmentInfo.set(e.studentId, {
        classId: e.classId,
        sectionId: e.sectionId,
      });
    });

    studentRecords.forEach((recordsList, studentId) => {
      const info = studentEnrollmentInfo.get(studentId);
      if (!info) return; // ignore inactive students

      const studentNameObj = studentInfoMap.get(studentId);
      const studentName = studentNameObj
        ? studentNameObj.name
        : 'Unknown Student';

      // Sort by date descending
      const sorted = [...recordsList].sort(
        (a, b) => b.date.getTime() - a.date.getTime(),
      );

      // Calculate streak
      let streakCount = 0;
      for (const r of sorted) {
        if (r.status !== AttendanceStatus.ABSENT) {
          break;
        }
        streakCount++;
      }

      if (streakCount >= 3) {
        absenceStreaks.push({
          studentId,
          studentName,
          className: classMap.get(info.classId) ?? 'Unknown Class',
          sectionName: info.sectionId
            ? (sectionMap.get(info.sectionId) ?? null)
            : null,
          streakCount,
        });
      }

      // Calculate repeated lates in last 30 days
      const lates30Days = sorted.filter(
        (r) => r.status === AttendanceStatus.LATE && r.date >= thirtyDaysAgo,
      ).length;

      if (lates30Days >= 3) {
        repeatedLates.push({
          studentId,
          studentName,
          className: classMap.get(info.classId) ?? 'Unknown Class',
          sectionName: info.sectionId
            ? (sectionMap.get(info.sectionId) ?? null)
            : null,
          lateCount: lates30Days,
        });
      }
    });

    // 5. Detect Roster Divergence & Late Submissions & Attendance Drops
    const rosterDivergences: unknown[] = [];
    const lateSubmissions: unknown[] = [];
    const attendanceDrops: unknown[] = [];

    // Group sessions by classSection key for Attendance Drops calculation
    const sessionsByClassSection = new Map<string, typeof sessions>();
    sessions.forEach((s) => {
      const key = `${s.classId}:${s.sectionId ?? 'none'}`;
      if (!sessionsByClassSection.has(key)) {
        sessionsByClassSection.set(key, []);
      }
      sessionsByClassSection.get(key)!.push(s);
    });

    sessions.forEach((session) => {
      const key = `${session.classId}:${session.sectionId ?? 'none'}`;
      const className = classMap.get(session.classId) ?? 'Unknown Class';
      const sectionName = session.sectionId
        ? (sectionMap.get(session.sectionId) ?? null)
        : null;

      // A. Roster Divergence
      const expectedIds = expectedRosterMap.get(key) ?? [];
      const actualIds = session.records.map((r) => r.studentId);
      const expectedSet = new Set(expectedIds);
      const actualSet = new Set(actualIds);

      const missing = expectedIds.filter((id) => !actualSet.has(id));
      const unexpected = actualIds.filter((id) => !expectedSet.has(id));

      if (missing.length > 0 || unexpected.length > 0) {
        rosterDivergences.push({
          sessionId: session.id,
          attendanceDate: session.attendanceDate.toISOString(),
          className,
          sectionName,
          expectedCount: expectedIds.length,
          actualCount: actualIds.length,
          missing: missing.map((id) => studentInfoMap.get(id)?.name ?? id),
          unexpected: unexpected.map(
            (id) => studentInfoMap.get(id)?.name ?? id,
          ),
        });
      }

      // B. Late Submission
      // Submitted more than 12 hours after the start of the attendance date (e.g. 12 * 60 * 60 * 1000)
      if (session.submittedAt) {
        const diffMs =
          session.submittedAt.getTime() - session.attendanceDate.getTime();
        const twelveHoursMs = 12 * 60 * 60 * 1000;
        if (diffMs > twelveHoursMs) {
          lateSubmissions.push({
            sessionId: session.id,
            attendanceDate: session.attendanceDate.toISOString(),
            className,
            sectionName,
            submittedAt: session.submittedAt.toISOString(),
            submittedBy: session.submittedBy?.email ?? 'System',
            delayHours: Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10,
          });
        }
      }
    });

    // C. Attendance Drops
    sessionsByClassSection.forEach((classSessions, key) => {
      if (classSessions.length < 2) return;
      const parts = key.split(':');
      const classId = parts[0];
      const sectionId = parts[1] === 'none' ? null : parts[1];
      const className = classMap.get(classId) ?? 'Unknown Class';
      const sectionName = sectionId
        ? (sectionMap.get(sectionId) ?? null)
        : null;

      // Most recent session
      const mostRecent = classSessions[0];
      const mostRecentRate = calculateAttendancePercent(mostRecent.records);

      // Previous sessions average
      const previousSessions = classSessions.slice(1);
      const totalPreviousRates = previousSessions.map((s) =>
        calculateAttendancePercent(s.records),
      );
      const avgPreviousRate =
        totalPreviousRates.reduce((a, b) => a + b, 0) /
        totalPreviousRates.length;

      // If drop is >= 15%
      if (avgPreviousRate - mostRecentRate >= 15) {
        attendanceDrops.push({
          classId,
          sectionId,
          className,
          sectionName,
          attendanceDate: mostRecent.attendanceDate.toISOString(),
          previousAverage: Math.round(avgPreviousRate * 10) / 10,
          currentRate: Math.round(mostRecentRate * 10) / 10,
          dropPercentage:
            Math.round((avgPreviousRate - mostRecentRate) * 10) / 10,
        });
      }
    });

    // 6. Detect Unsubmitted Working Days
    const unsubmittedWorkingDays: unknown[] = [];
    const weekendPolicy = (await this.settingsService.getSetting(
      actor.tenantId,
      'weekend_policy',
    )) as string | null;
    const attendanceWorkingDays = (await this.settingsService.getSetting(
      actor.tenantId,
      'attendance_working_days',
    )) as string[] | null;

    // Resolve working days in the last 30 days (excluding today)
    const datesToCheck: Date[] = [];
    const temp = new Date(thirtyDaysAgo);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const normalizedYesterday = stripTime(yesterday);

    while (temp <= normalizedYesterday) {
      datesToCheck.push(new Date(temp));
      temp.setDate(temp.getDate() + 1);
    }

    // Load explicit calendar days for these dates
    const explicitDays = await this.prisma.schoolCalendarDay.findMany({
      where: {
        tenantId: actor.tenantId,
        calendarDate: { in: datesToCheck },
      },
    });
    const explicitByKey = new Map(
      explicitDays.map((d) => [getDateKey(d.calendarDate), d]),
    );

    const workingDates = datesToCheck.filter((date) => {
      const key = getDateKey(date);
      const explicit = explicitByKey.get(key);
      if (explicit) {
        return explicit.isWorkingDay;
      }
      return isWorkingDayFallback(date, weekendPolicy, attendanceWorkingDays);
    });

    // For each working date, check which active classes/sections have no session
    // Find all active class/section keys
    const activeClassSections = new Set<string>();
    activeEnrollments.forEach((e) => {
      activeClassSections.add(`${e.classId}:${e.sectionId ?? 'none'}`);
    });

    const sessionKeys = new Set(
      sessions.map(
        (s) =>
          `${getDateKey(s.attendanceDate)}:${s.classId}:${s.sectionId ?? 'none'}`,
      ),
    );

    workingDates.forEach((date) => {
      const dateKey = getDateKey(date);
      activeClassSections.forEach((csKey) => {
        const checkKey = `${dateKey}:${csKey}`;
        if (!sessionKeys.has(checkKey)) {
          const parts = csKey.split(':');
          const classId = parts[0];
          const sectionId = parts[1] === 'none' ? null : parts[1];
          unsubmittedWorkingDays.push({
            attendanceDate: date.toISOString(),
            classId,
            sectionId,
            className: classMap.get(classId) ?? 'Unknown Class',
            sectionName: sectionId ? (sectionMap.get(sectionId) ?? null) : null,
          });
        }
      });
    });

    return {
      absenceStreaks,
      repeatedLates,
      anomalies: {
        rosterDivergences,
        lateSubmissions,
        attendanceDrops,
        unsubmittedWorkingDays,
      },
    };
  }

  private async resolveCalendarDay(tenantId: string, date: Date) {
    const normalizedDate = stripTime(date);
    const explicitDay = await this.prisma.schoolCalendarDay.findFirst({
      where: {
        tenantId,
        calendarDate: normalizedDate,
      },
    });

    if (explicitDay) {
      return {
        calendarDate: explicitDay.calendarDate.toISOString(),
        isWorkingDay: explicitDay.isWorkingDay,
        label: explicitDay.label,
        holidayType: explicitDay.holidayType,
        source: 'explicit' as const,
      };
    }

    const weekendPolicy = (await this.settingsService.getSetting(
      tenantId,
      'weekend_policy',
    )) as string | null;
    const workingDays = (await this.settingsService.getSetting(
      tenantId,
      'attendance_working_days',
    )) as string[] | null;

    return {
      calendarDate: normalizedDate.toISOString(),
      isWorkingDay: isWorkingDayFallback(
        normalizedDate,
        weekendPolicy,
        workingDays,
      ),
      label: null,
      holidayType: null,
      source: 'weekday_fallback' as const,
    };
  }

  private async loadCalendarDayMap(tenantId: string, dates: Date[]) {
    const normalizedDates = Array.from(
      new Set(dates.map((date) => stripTime(date).getTime())),
    ).map((time) => new Date(time));

    const [explicitDays, weekendPolicy, workingDays] = await Promise.all([
      this.prisma.schoolCalendarDay.findMany({
        where: {
          tenantId,
          calendarDate: {
            in: normalizedDates,
          },
        },
      }),
      this.settingsService.getSetting(tenantId, 'weekend_policy') as Promise<
        string | null
      >,
      this.settingsService.getSetting(
        tenantId,
        'attendance_working_days',
      ) as Promise<string[] | null>,
    ]);

    const explicitByKey = new Map(
      explicitDays.map((day) => [getDateKey(day.calendarDate), day]),
    );

    return new Map(
      normalizedDates.map((date) => {
        const key = getDateKey(date);
        const explicitDay = explicitByKey.get(key);

        return [
          key,
          explicitDay
            ? {
                calendarDate: explicitDay.calendarDate.toISOString(),
                isWorkingDay: explicitDay.isWorkingDay,
                label: explicitDay.label,
                holidayType: explicitDay.holidayType,
                source: 'explicit' as const,
              }
            : {
                calendarDate: date.toISOString(),
                isWorkingDay: isWorkingDayFallback(
                  date,
                  weekendPolicy,
                  workingDays,
                ),
                label: null,
                holidayType: null,
                source: 'weekday_fallback' as const,
              },
        ];
      }),
    );
  }

  async upsertDraft(dto: UpsertAttendanceDraftDto, actor: AuthContext) {
    const attendanceDate = stripTime(new Date(dto.attendanceDate));

    const existing = await this.prisma.attendanceDraft.findFirst({
      where: {
        tenantId: actor.tenantId,
        userId: actor.userId,
        classId: dto.classId,
        sectionId: dto.sectionId ?? null,
        attendanceDate,
      },
    });

    if (existing) {
      return this.prisma.attendanceDraft.update({
        where: { id: existing.id },
        data: {
          payload: dto.payload as Prisma.InputJsonValue,
          lastSavedAt: new Date(),
        },
      });
    }

    return this.prisma.attendanceDraft.create({
      data: {
        tenantId: actor.tenantId,
        userId: actor.userId,
        classId: dto.classId,
        sectionId: dto.sectionId ?? null,
        attendanceDate,
        academicYearId: dto.academicYearId,
        payload: dto.payload as Prisma.InputJsonValue,
      },
    });
  }

  async listDrafts(actor: AuthContext) {
    return this.prisma.attendanceDraft.findMany({
      where: {
        tenantId: actor.tenantId,
        userId: actor.userId,
      },
      include: {
        class: true,
        section: true,
      },
      orderBy: { lastSavedAt: 'desc' },
      take: 100,
    });
  }

  async deleteDraft(id: string, actor: AuthContext) {
    return this.prisma.attendanceDraft.deleteMany({
      where: {
        id,
        tenantId: actor.tenantId,
        userId: actor.userId,
      },
    });
  }

  async cleanupOldDrafts(tenantId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return this.prisma.attendanceDraft.deleteMany({
      where: {
        tenantId,
        lastSavedAt: { lt: thirtyDaysAgo },
      },
    });
  }

  async submitDraft(id: string, actor: AuthContext) {
    const draft = await this.prisma.attendanceDraft.findFirst({
      where: {
        id,
        tenantId: actor.tenantId,
        userId: actor.userId,
      },
    });

    if (!draft) {
      throw new NotFoundException('Attendance draft not found');
    }

    const payload = draft.payload as {
      exceptions?: AttendanceExceptionDto[];
    };

    // Call submitAttendance with draft payload
    const result = await this.submitAttendance(
      {
        academicYearId: draft.academicYearId,
        classId: draft.classId,
        sectionId: draft.sectionId ?? undefined,
        attendanceDate: draft.attendanceDate.toISOString(),
        exceptions: payload.exceptions,
      },
      actor,
      {
        source: 'sync_submission',
        clientSubmissionId: `draft-${draft.id}`,
        deviceId: null,
        deviceLabel: 'Web Draft',
        sessionFingerprint: null,
        trustMetadata: {},
      },
    );

    // Cleanup draft after successful submission
    await this.prisma.attendanceDraft.delete({ where: { id: draft.id } });

    return result;
  }

  private async getTeacherSectionIds(
    actor: AuthContext,
    studentScope: Record<string, unknown>,
  ): Promise<string[] | undefined> {
    if (
      actor.permissions.includes('attendance:read_all') ||
      actor.permissions.includes('attendance:manage_all') ||
      Object.keys(studentScope).length > 0
    ) {
      return undefined;
    }

    const staff = await this.prisma.staff.findFirst({
      where: { userId: actor.userId, tenantId: actor.tenantId },
    });

    if (!staff) {
      return [];
    }

    const [assignments, sections] = await Promise.all([
      this.prisma.subjectTeacherAssignment.findMany({
        where: { staffId: staff.id, tenantId: actor.tenantId },
        select: { sectionId: true },
      }),
      this.prisma.section.findMany({
        where: { classTeacherId: staff.id, tenantId: actor.tenantId },
        select: { id: true },
      }),
    ]);

    return Array.from(
      new Set([
        ...assignments
          .map((a) => a.sectionId)
          .filter((id): id is string => !!id),
        ...sections.map((s) => s.id),
      ]),
    );
  }
}

function toIsoWeekday(date: Date) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function summarizeAttendance(records: Array<{ status: AttendanceStatus }>) {
  return {
    totalStudents: records.length,
    present: records.filter(
      (record) => record.status === AttendanceStatus.PRESENT,
    ).length,
    absent: records.filter(
      (record) => record.status === AttendanceStatus.ABSENT,
    ).length,
    late: records.filter((record) => record.status === AttendanceStatus.LATE)
      .length,
    leave: records.filter((record) => record.status === AttendanceStatus.LEAVE)
      .length,
    sickLeave: records.filter(
      (record) => record.status === AttendanceStatus.SICK_LEAVE,
    ).length,
    excusedLeave: records.filter(
      (record) => record.status === AttendanceStatus.EXCUSED_LEAVE,
    ).length,
    unexcusedLeave: records.filter(
      (record) => record.status === AttendanceStatus.UNEXCUSED_LEAVE,
    ).length,
  };
}

interface AttendanceSubmissionContext {
  source: 'sync_submission';
  clientSubmissionId: string;
  deviceId: string | null;
  deviceLabel: string | null;
  sessionFingerprint: string | null;
  trustMetadata: Record<string, unknown>;
}

const attendanceCorrectionRequestSelect = {
  id: true,
  tenantId: true,
  attendanceRecordId: true,
  attendanceSessionId: true,
  studentId: true,
  attendanceDate: true,
  requestedStatus: true,
  previousStatus: true,
  reason: true,
  status: true,
  requestedById: true,
  requestedAt: true,
  reviewedById: true,
  reviewedAt: true,
  reviewNote: true,
  reviewReason: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AttendanceCorrectionRequestSelect;

function getCorrectionReviewReason(dto: ReviewAttendanceCorrectionDto) {
  const reviewReason = (dto.reviewReason ?? dto.reviewNote ?? '').trim();

  if (!reviewReason) {
    throw new ConflictException(
      'Please add a reason before approving or rejecting this correction.',
    );
  }

  return reviewReason;
}

function readM2ReasonPolicyNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1
    ? Math.min(Math.trunc(value), 30)
    : fallback;
}

function readM2Boolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function readM2String(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function readM2NotificationChannels(
  value: unknown,
  fallback: NotificationChannel[],
) {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const allowed = new Set(Object.values(NotificationChannel));
  const channels = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().toUpperCase())
    .filter((item): item is NotificationChannel =>
      allowed.has(item as NotificationChannel),
    );
  return channels.length > 0 ? [...new Set(channels)] : fallback;
}

function requireMinimumReason(
  reason: string | null | undefined,
  minLength: number,
  context: string,
) {
  const normalized = (reason ?? '').trim();
  if (normalized.length < minLength) {
    throw new ConflictException(
      `${context} requires a reason of at least ${minLength} characters.`,
    );
  }
  return normalized;
}

function renderM2AttendanceTemplate(template: string) {
  return template
    .replaceAll('{studentName}', 'Your child')
    .replaceAll('{count}', '1')
    .replaceAll('{threshold}', '1');
}

function buildParentAttendanceStatusLabel(
  status: AttendanceStatus,
  date: Date,
) {
  const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(
    date,
  );

  if (getDateKey(date) === getDateKey(new Date())) {
    if (status === AttendanceStatus.PRESENT) return 'Present today';
    if (status === AttendanceStatus.ABSENT) return 'Absent today';
    if (status === AttendanceStatus.LATE) return 'Late today';
    return 'On leave today';
  }

  if (status === AttendanceStatus.PRESENT) return `Present on ${dayName}`;
  if (status === AttendanceStatus.ABSENT) return `Absent on ${dayName}`;
  if (status === AttendanceStatus.LATE) return `Late on ${dayName}`;
  return `On leave on ${dayName}`;
}

function buildAttendanceIncomingPayload(
  dto: SubmitAttendanceDto,
  submissionContext?: AttendanceSubmissionContext,
) {
  return {
    exceptions: dto.exceptions ?? [],
    submissionContext: submissionContext ?? null,
  };
}

function countConsecutiveAbsences(
  records: Array<{ attendanceDate: Date; status: AttendanceStatus }>,
) {
  const sorted = [...records].sort(
    (a, b) => b.attendanceDate.getTime() - a.attendanceDate.getTime(),
  );
  let count = 0;

  for (const record of sorted) {
    if (record.status !== AttendanceStatus.ABSENT) {
      break;
    }

    count += 1;
  }

  return count;
}

function countInclusiveDays(startsOn: Date, endsOn: Date) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return (
    Math.floor(
      (stripTime(endsOn).getTime() - stripTime(startsOn).getTime()) /
        millisecondsPerDay,
    ) + 1
  );
}

function stripTime(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getDateKey(date: Date) {
  return stripTime(date).toISOString().slice(0, 10);
}

function isWeekdayWorkingDay(date: Date) {
  const dayOfWeek = date.getDay();
  return dayOfWeek >= 1 && dayOfWeek <= 5;
}

function isWorkingDayFallback(
  date: Date,
  weekendPolicy: string | null,
  workingDays: string[] | null,
): boolean {
  const dayOfWeek = date.getDay();
  const dayName = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ][dayOfWeek];

  if (weekendPolicy === 'SATURDAY') {
    return dayOfWeek !== 6;
  }
  if (weekendPolicy === 'FRIDAY_SATURDAY') {
    return dayOfWeek !== 5 && dayOfWeek !== 6;
  }
  if (weekendPolicy === 'CUSTOM' && Array.isArray(workingDays)) {
    return workingDays.includes(dayName);
  }

  if (Array.isArray(workingDays) && workingDays.length > 0) {
    return workingDays.includes(dayName);
  }
  return dayOfWeek >= 1 && dayOfWeek <= 5;
}

function classifyAttendanceSyncRejection(error: unknown) {
  if (error instanceof NotFoundException) {
    return AttendanceSyncRejectionReason.REFERENCE_NOT_FOUND;
  }

  if (error instanceof ForbiddenException) {
    const message = String(error.message ?? '');

    if (message.includes('locked')) {
      return AttendanceSyncRejectionReason.LOCKED_SESSION;
    }

    if (message.includes('working days')) {
      return AttendanceSyncRejectionReason.VALIDATION_ERROR;
    }
  }

  if (error instanceof ConflictException) {
    return AttendanceSyncRejectionReason.ROSTER_MISMATCH;
  }

  return AttendanceSyncRejectionReason.UNKNOWN;
}

function mapAttendanceSyncResult(
  submission: {
    id: string;
    clientSubmissionId: string;
    attendanceSessionId: string | null;
    conflictId: string | null;
    syncStatus: AttendanceSyncStatus;
    attendanceDate: Date;
    deviceId: string | null;
    deviceLabel: string | null;
    deviceTimestamp: Date | null;
    sessionFingerprint: string | null;
    syncAttemptCount: number;
    serverReceivedAt: Date;
    rejectionReason: AttendanceSyncRejectionReason | null;
    createdAt: Date;
  },
  replayed: boolean,
) {
  return {
    id: submission.id,
    clientSubmissionId: submission.clientSubmissionId,
    attendanceSessionId: submission.attendanceSessionId,
    conflictId: submission.conflictId,
    syncStatus: submission.syncStatus,
    attendanceDate: submission.attendanceDate.toISOString(),
    deviceId: submission.deviceId,
    deviceLabel: submission.deviceLabel,
    deviceTimestamp: submission.deviceTimestamp?.toISOString() ?? null,
    sessionFingerprint: submission.sessionFingerprint,
    syncAttemptCount: submission.syncAttemptCount,
    serverReceivedAt: submission.serverReceivedAt.toISOString(),
    replayed,
    rejectionReason: submission.rejectionReason,
    createdAt: submission.createdAt.toISOString(),
  };
}

function calculateAttendancePercent(
  records: Array<{ status: AttendanceStatus }>,
) {
  if (records.length === 0) {
    return 100;
  }

  const presentCount = records.filter(
    (record) =>
      record.status === AttendanceStatus.PRESENT ||
      record.status === AttendanceStatus.LATE,
  ).length;

  return Math.round((presentCount / records.length) * 10000) / 100;
}

function priorityWeight(priority: string) {
  return priority === 'high' ? 2 : priority === 'medium' ? 1 : 0;
}

function eachDateInclusive(startsOn: Date, endsOn: Date) {
  const dates: Date[] = [];
  const cursor = stripTime(startsOn);
  const last = stripTime(endsOn);

  while (cursor <= last) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function buildStaffDateKey(staffId: string, date: Date) {
  return `${staffId}:${getDateKey(date)}`;
}
