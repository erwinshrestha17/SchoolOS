import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttendanceConflictDecision,
  AttendanceConflictStatus,
  AttendanceSyncRejectionReason,
  AttendanceSyncStatus,
  AttendanceStatus,
  AudienceType,
  ConsentType,
  NotificationChannel,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from '../communications/communications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReviewAttendanceConflictDto } from './dto/review-attendance-conflict.dto';
import { CreateStaffLeaveRequestDto } from './dto/create-staff-leave-request.dto';
import { AttendanceConflictReviewDecision } from './dto/review-attendance-conflict.dto';
import {
  AttendanceOverrideSource,
  OverrideAttendanceSessionDto,
} from './dto/override-attendance-session.dto';
import { ListStaffAttendanceSummaryDto } from './dto/list-staff-attendance-summary.dto';
import { ReviewStaffLeaveRequestDto } from './dto/review-staff-leave-request.dto';
import { SubmitStaffAttendanceDto } from './dto/submit-staff-attendance.dto';
import { SubmitAttendanceDto } from './dto/submit-attendance.dto';
import { SyncAttendanceDto } from './dto/sync-attendance.dto';
import { UpsertCalendarDayDto } from './dto/upsert-calendar-day.dto';
import { buildStudentScopeFilter } from '../common/security/parent-scope';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly communicationsService: CommunicationsService,
    private readonly auditService: AuditService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async listAttendance(actor: AuthContext) {
    const studentScope = await buildStudentScopeFilter(this.prisma, actor);

    const sessions = await this.prisma.attendanceSession.findMany({
      where: { tenantId: actor.tenantId },
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
    const [academicYear, classroom, section] = await Promise.all([
      this.prisma.academicYear.findFirst({
        where: { id: dto.academicYearId, tenantId: actor.tenantId },
      }),
      this.prisma.class.findFirst({
        where: { id: dto.classId, tenantId: actor.tenantId },
      }),
      dto.sectionId
        ? this.prisma.section.findFirst({
            where: { id: dto.sectionId, tenantId: actor.tenantId },
          })
        : Promise.resolve(null),
    ]);

    if (!academicYear) {
      throw new NotFoundException('Academic year not found in this tenant');
    }

    if (!classroom) {
      throw new NotFoundException('Class not found in this tenant');
    }

    if (dto.sectionId && !section) {
      throw new NotFoundException('Section not found in this tenant');
    }

    const attendanceDate = stripTime(new Date(dto.attendanceDate));
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

    if (existingSession && existingSession.lockAt <= new Date()) {
      throw new ForbiddenException('Attendance session is locked');
    }

    const students = await this.prisma.student.findMany({
      where: {
        tenantId: actor.tenantId,
        classId: dto.classId,
        ...(dto.sectionId ? { sectionId: dto.sectionId } : {}),
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
            })) as unknown as Prisma.InputJsonValue,
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
              academicYearId: dto.academicYearId,
              submittedById: actor.userId,
              submittedAt: new Date(),
              lockAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
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
              lockAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
              conflictStatus: AttendanceConflictStatus.NONE,
            },
          });

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

    const notifyRecords = session.records.filter(
      (record) =>
        record.status === AttendanceStatus.ABSENT ||
        record.status === AttendanceStatus.LATE ||
        record.status === AttendanceStatus.SICK_LEAVE ||
        record.status === AttendanceStatus.EXCUSED_LEAVE ||
        record.status === AttendanceStatus.UNEXCUSED_LEAVE,
    );

    if (notifyRecords.length > 0) {
      for (const record of notifyRecords) {
        let title = 'Attendance alert';
        let body = '';
        let channels: NotificationChannel[] = [NotificationChannel.PUSH];

        if (record.status === AttendanceStatus.ABSENT) {
          body = 'A student was marked absent today.';
          channels = [NotificationChannel.PUSH, NotificationChannel.SMS];
        } else if (record.status === AttendanceStatus.LATE) {
          body = `A student was marked late today at ${record.lateAt ? record.lateAt.toISOString() : new Date().toISOString()}.`;
        } else if (
          record.status === AttendanceStatus.SICK_LEAVE ||
          record.status === AttendanceStatus.EXCUSED_LEAVE
        ) {
          body = `Excused/Sick leave confirmed for a student today.`;
        } else if (record.status === AttendanceStatus.UNEXCUSED_LEAVE) {
          body = `Unexcused leave recorded. Please contact the school immediately.`;
        }

        await this.communicationsService.recordDeliveryRecords({
          actor,
          sourceType: 'attendance_alert',
          sourceId: session.id,
          audienceType: session.sectionId
            ? AudienceType.SECTION
            : AudienceType.CLASS,
          classId: session.classId,
          sectionId: session.sectionId,
          studentIds: [record.studentId],
          title,
          body,
          channels,
          requiredConsentTypes: [ConsentType.MESSAGING],
        });
      }
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
          })) as Prisma.InputJsonValue,
          incomingPayload: {
            override: dto.exceptions,
            reason: dto.reason ?? null,
            source: dto.source ?? AttendanceOverrideSource.MANUAL_OVERRIDE,
            changedRows,
            originalLockAt: session.lockAt.toISOString(),
          } as unknown as Prisma.InputJsonValue,
          status: AttendanceConflictStatus.REVIEWED,
          reviewedById: actor.userId,
          reviewedAt: new Date(),
          resolutionNote: dto.reason ?? 'Admin override',
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
        reason: dto.reason ?? null,
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

  async listCalendarDays(actor: AuthContext) {
    return this.prisma.schoolCalendarDay.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: [{ calendarDate: 'asc' }],
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

  async listStaffAttendance(actor: AuthContext) {
    return this.prisma.staffAttendance.findMany({
      where: { tenantId: actor.tenantId },
      include: { staff: true, approvedBy: true },
      orderBy: [{ attendanceDate: 'desc' }],
      take: 100,
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

  async listLeaveBalances(actor: AuthContext) {
    return this.prisma.staffLeaveBalance.findMany({
      where: { tenantId: actor.tenantId },
      include: { staff: true },
      orderBy: [{ year: 'desc' }, { leaveType: 'asc' }],
    });
  }

  async listLeaveRequests(actor: AuthContext) {
    return this.prisma.staffLeaveRequest.findMany({
      where: { tenantId: actor.tenantId },
      include: { staff: true, reviewedBy: true },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    });
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

    const leave = await this.prisma.staffLeaveRequest.create({
      data: {
        tenantId: actor.tenantId,
        staffId: staff.id,
        leaveType: dto.leaveType,
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

      if (dto.status === 'APPROVED') {
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
                approvedById: actor.userId,
              },
            });
            continue;
          }

          overlapAnomalies.push({
            date: attendanceDay.toISOString(),
            existingStatus: existingAttendance.status,
          });
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
      });
    }

    return {
      ...updated.reviewed,
      overlapAnomalies: updated.overlapAnomalies,
    };
  }

  async getRoster(
    actor: AuthContext,
    academicYearId: string,
    classId: string,
    sectionId?: string,
    attendanceDate?: string,
  ) {
    const [academicYear, classroom, section] = await Promise.all([
      this.prisma.academicYear.findFirst({
        where: { id: academicYearId, tenantId: actor.tenantId },
      }),
      this.prisma.class.findFirst({
        where: { id: classId, tenantId: actor.tenantId },
      }),
      sectionId
        ? this.prisma.section.findFirst({
            where: { id: sectionId, tenantId: actor.tenantId },
          })
        : Promise.resolve(null),
    ]);

    if (!academicYear) {
      throw new NotFoundException('Academic year not found in this tenant');
    }

    if (!classroom) {
      throw new NotFoundException('Class not found in this tenant');
    }

    if (sectionId && !section) {
      throw new NotFoundException('Section not found in this tenant');
    }

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
    const sessions = await this.prisma.attendanceSession.findMany({
      where: { tenantId: actor.tenantId },
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
    const [monthlyRecords, annualRecords] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where: {
          tenantId: actor.tenantId,
          attendanceSession: {
            attendanceDate: {
              gte: monthStart,
              lt: nextMonthStart,
            },
          },
        },
      }),
      this.prisma.attendanceRecord.findMany({
        where: {
          tenantId: actor.tenantId,
          attendanceSession: {
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
    const allowedRoles = new Set(['super_admin', 'admin', 'principal']);

    if (!actor.roles.some((role) => allowedRoles.has(role))) {
      throw new ForbiddenException(
        'Only principal, admin, or super_admin may review attendance conflicts or override locked sessions',
      );
    }
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

    return {
      calendarDate: normalizedDate.toISOString(),
      isWorkingDay: isWeekdayWorkingDay(normalizedDate),
      label: null,
      holidayType: null,
      source: 'weekday_fallback' as const,
    };
  }

  private async loadCalendarDayMap(tenantId: string, dates: Date[]) {
    const normalizedDates = Array.from(
      new Set(dates.map((date) => stripTime(date).getTime())),
    ).map((time) => new Date(time));

    const explicitDays = await this.prisma.schoolCalendarDay.findMany({
      where: {
        tenantId,
        calendarDate: {
          in: normalizedDates,
        },
      },
    });
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
                isWorkingDay: isWeekdayWorkingDay(date),
                label: null,
                holidayType: null,
                source: 'weekday_fallback' as const,
              },
        ];
      }),
    );
  }
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
  };
}

type AttendanceSubmissionContext = {
  source: 'sync_submission';
  clientSubmissionId: string;
  deviceId: string | null;
  deviceLabel: string | null;
  sessionFingerprint: string | null;
  trustMetadata: Record<string, unknown>;
};

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
