import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttendanceConflictStatus,
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
import { OverrideAttendanceSessionDto } from './dto/override-attendance-session.dto';
import { ReviewStaffLeaveRequestDto } from './dto/review-staff-leave-request.dto';
import { SubmitStaffAttendanceDto } from './dto/submit-staff-attendance.dto';
import { SubmitAttendanceDto } from './dto/submit-attendance.dto';
import { SyncAttendanceDto } from './dto/sync-attendance.dto';
import { UpsertCalendarDayDto } from './dto/upsert-calendar-day.dto';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly communicationsService: CommunicationsService,
    private readonly auditService: AuditService,
  ) {}

  async listAttendance(actor: AuthContext) {
    const sessions = await this.prisma.attendanceSession.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        class: true,
        section: true,
        records: true,
      },
      orderBy: [{ attendanceDate: 'desc' }],
      take: 30,
    });

    return sessions.map((session) => ({
      sessionId: session.id,
      attendanceDate: session.attendanceDate,
      className: session.class.name,
      sectionName: session.section?.name ?? null,
      submittedAt: session.submittedAt,
      lockAt: session.lockAt,
      totals: summarizeAttendance(session.records),
    }));
  }

  async submitAttendance(dto: SubmitAttendanceDto, actor: AuthContext) {
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

    const attendanceDate = new Date(dto.attendanceDate);
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
            previousPayload: existingSession.records.map((record) => ({
              studentId: record.studentId,
              status: record.status,
              remark: record.remark,
            })) as Prisma.InputJsonValue,
            incomingPayload: (dto.exceptions ??
              []) as unknown as Prisma.InputJsonValue,
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

    const absentRecords = session.records.filter(
      (record) => record.status === AttendanceStatus.ABSENT,
    );

    if (absentRecords.length > 0) {
      await this.communicationsService.recordDeliveryRecords({
        actor,
        sourceType: 'attendance_absence',
        sourceId: session.id,
        audienceType: session.sectionId
          ? AudienceType.SECTION
          : AudienceType.CLASS,
        classId: session.classId,
        sectionId: session.sectionId,
        studentIds: absentRecords.map((record) => record.studentId),
        title: 'Attendance alert',
        body: 'A student was marked absent today.',
        channels: [NotificationChannel.PUSH, NotificationChannel.SMS],
        requiredConsentTypes: [ConsentType.MESSAGING],
      });
    }

    return {
      sessionId: session.id,
      attendanceDate: session.attendanceDate,
      className: session.class.name,
      sectionName: session.section?.name ?? null,
      submittedAt: session.submittedAt,
      lockAt: session.lockAt,
      conflictStatus: session.conflictStatus,
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
      return existingSync;
    }

    try {
      const result = await this.submitAttendance(dto, actor);
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

      return this.prisma.attendanceSyncSubmission.create({
        data: {
          tenantId: actor.tenantId,
          clientSubmissionId: dto.clientSubmissionId,
          attendanceSessionId: result.sessionId,
          conflictId: conflict?.id ?? null,
          academicYearId: dto.academicYearId,
          classId: dto.classId,
          sectionId: dto.sectionId ?? null,
          attendanceDate: new Date(dto.attendanceDate),
          deviceTimestamp: new Date(dto.deviceTimestamp),
          syncStatus: conflict
            ? AttendanceSyncStatus.CONFLICTED
            : AttendanceSyncStatus.ACCEPTED,
          submittedById: actor.userId,
          payload: dto as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      await this.prisma.attendanceSyncSubmission.create({
        data: {
          tenantId: actor.tenantId,
          clientSubmissionId: dto.clientSubmissionId,
          academicYearId: dto.academicYearId,
          classId: dto.classId,
          sectionId: dto.sectionId ?? null,
          attendanceDate: new Date(dto.attendanceDate),
          deviceTimestamp: new Date(dto.deviceTimestamp),
          syncStatus: AttendanceSyncStatus.REJECTED,
          submittedById: actor.userId,
          payload: {
            dto,
            error: error instanceof Error ? error.message : 'Unknown error',
          } as unknown as Prisma.InputJsonValue,
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
    const conflict = await this.prisma.attendanceConflict.findFirst({
      where: {
        id: conflictId,
        tenantId: actor.tenantId,
      },
    });

    if (!conflict) {
      throw new NotFoundException('Attendance conflict not found');
    }

    const updated = await this.prisma.attendanceConflict.update({
      where: { id: conflict.id },
      data: {
        status: AttendanceConflictStatus.REVIEWED,
        resolutionNote: dto.resolutionNote ?? null,
        reviewedById: actor.userId,
        reviewedAt: new Date(),
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
        resolutionNote: dto.resolutionNote ?? null,
      },
    });

    return updated;
  }

  async overrideLockedSession(
    sessionId: string,
    dto: OverrideAttendanceSessionDto,
    actor: AuthContext,
  ) {
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
          previousPayload: session.records.map((record) => ({
            studentId: record.studentId,
            status: record.status,
            remark: record.remark,
          })) as Prisma.InputJsonValue,
          incomingPayload: {
            override: dto.exceptions,
            reason: dto.reason ?? null,
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
        totals: summarizeAttendance(updated.records),
      },
    });

    return {
      sessionId: updated.id,
      attendanceDate: updated.attendanceDate,
      className: updated.class.name,
      sectionName: updated.section?.name ?? null,
      conflictStatus: updated.conflictStatus,
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

  async submitStaffAttendance(
    dto: SubmitStaffAttendanceDto,
    actor: AuthContext,
  ) {
    const attendanceDate = new Date(dto.attendanceDate);
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

      if (dto.status === 'APPROVED') {
        const year = reviewed.startsOn.getFullYear();
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
      }

      return reviewed;
    });

    await this.auditService.record({
      action: 'review',
      resource: 'staff_leave_request',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      after: {
        status: updated.status,
        reviewNote: updated.reviewNote,
      },
    });

    return updated;
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

    const parsedAttendanceDate = attendanceDate
      ? new Date(attendanceDate)
      : new Date();

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

    return {
      sessionsReviewed: sessions.length,
      latestSessions: sessions.map((session) => ({
        sessionId: session.id,
        attendanceDate: session.attendanceDate,
        className: session.class.name,
        sectionName: session.section?.name ?? null,
        conflictStatus: session.conflictStatus,
        totals: summarizeAttendance(session.records),
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
