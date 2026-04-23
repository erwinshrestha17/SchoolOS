import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttendanceStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitAttendanceDto } from './dto/submit-attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
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
      const upserted = existingSession
        ? await tx.attendanceSession.update({
            where: { id: existingSession.id },
            data: {
              academicYearId: dto.academicYearId,
              submittedById: actor.userId,
              submittedAt: new Date(),
              lockAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
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

    return {
      sessionId: session.id,
      attendanceDate: session.attendanceDate,
      className: session.class.name,
      sectionName: session.section?.name ?? null,
      submittedAt: session.submittedAt,
      lockAt: session.lockAt,
      totals: summarizeAttendance(session.records),
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
