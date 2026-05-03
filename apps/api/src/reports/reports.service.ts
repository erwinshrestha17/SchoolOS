import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import type {
  ReportDefinition,
  ReportExportRequest,
  ReportExportResult,
} from '@schoolos/core';

import {
  StudentLifecycleStatus,
  EnrollmentStatus,
  Prisma,
} from '@prisma/client';

export interface ReportExecutor {
  definition: ReportDefinition;
  execute: (
    tenantId: string,
    filters: Record<string, unknown>,
    format: string,
  ) => Promise<Record<string, unknown>[]>;
}

@Injectable()
export class ReportsService {
  private readonly registry = new Map<string, ReportExecutor>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {
    this.registerInternalReports();
  }

  private registerInternalReports() {
    this.register({
      definition: {
        key: 'student-roster',
        name: 'Student Roster',
        description: 'Comprehensive list of students with basic details',
        category: 'students',
        module: 'students',
        formats: ['json', 'csv'],
        filters: [
          { key: 'classId', label: 'Class', type: 'class' },
          { key: 'sectionId', label: 'Section', type: 'section' },
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: [
              { label: 'Active', value: 'ACTIVE' },
              { label: 'Withdrawn', value: 'WITHDRAWN' },
              { label: 'Graduated', value: 'GRADUATED' },
            ],
          },
        ],
        requiredPermissions: ['students:read'],
      },
      execute: async (tenantId, filters) => {
        const students = await this.prisma.student.findMany({
          where: {
            tenantId,
            ...(filters.classId ? { classId: filters.classId } : {}),
            ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
            ...(filters.status
              ? { lifecycleStatus: filters.status as StudentLifecycleStatus }
              : {}),
          },
          include: {
            class: true,
            sectionRef: true,
          },
          orderBy: { firstNameEn: 'asc' },
        });

        return students.map((s) => ({
          'System ID': s.studentSystemId,
          'First Name': s.firstNameEn,
          'Last Name': s.lastNameEn,
          Gender: s.gender,
          'Date of Birth': s.dateOfBirth.toISOString().split('T')[0],
          Class: s.class.name,
          Section: s.sectionRef?.name || s.section || '-',
          'Roll Number': s.rollNumber || '-',
          'Admission Date': s.admissionDate.toISOString().split('T')[0],
          Status: s.lifecycleStatus,
        }));
      },
    });

    this.register({
      definition: {
        key: 'class-roster',
        name: 'Class Roster',
        description:
          'Detailed list of students in a class/section with guardian info',
        category: 'academics',
        module: 'academics',
        formats: ['json', 'csv'],
        filters: [
          { key: 'academicYearId', label: 'Academic Year', type: 'select' },
          { key: 'classId', label: 'Class', type: 'class' },
          { key: 'sectionId', label: 'Section', type: 'section' },
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: [
              { label: 'Active', value: 'ACTIVE' },
              { label: 'Promoted', value: 'PROMOTED' },
              { label: 'Transferred', value: 'TRANSFERRED' },
              { label: 'Exited', value: 'EXITED' },
            ],
          },
        ],
        requiredPermissions: ['classes:read', 'students:read'],
      },
      execute: async (tenantId, filters) => {
        const enrollments = await this.prisma.enrollment.findMany({
          where: {
            tenantId,
            ...(filters.classId ? { classId: String(filters.classId) } : {}),
            ...(filters.sectionId
              ? { sectionId: String(filters.sectionId) }
              : {}),
            ...(filters.academicYearId
              ? { academicYearId: String(filters.academicYearId) }
              : {}),
            ...(filters.status
              ? { status: filters.status as EnrollmentStatus }
              : {}),
          },
          include: {
            class: true,
            section: true,
            student: {
              include: {
                guardianLinks: {
                  include: {
                    guardian: true,
                  },
                },
              },
            },
          },
          orderBy: { student: { firstNameEn: 'asc' } },
        });

        return enrollments.map((e) => {
          const s = e.student;
          const primaryGuardianLink =
            s.guardianLinks.find((l) => l.isPrimary) || s.guardianLinks[0];
          const guardian = primaryGuardianLink?.guardian;

          return {
            'Student ID': s.studentSystemId,
            'Full Name': `${s.firstNameEn} ${s.lastNameEn}`,
            Gender: s.gender,
            'Date of Birth': s.dateOfBirth.toISOString().split('T')[0],
            Class: e.class.name,
            Section: e.section?.name || '-',
            'Roll Number': e.rollNumber || '-',
            'Guardian Name': guardian?.fullName || '-',
            'Guardian Phone': guardian?.primaryPhone || '-',
            'Admission Date': e.admissionDate.toISOString().split('T')[0],
            Status: e.status,
          };
        });
      },
    });

    this.register({
      definition: {
        key: 'monthly-attendance-register',
        name: 'Monthly Attendance Register',
        description:
          'Complete attendance register for a specific month and class',
        category: 'Attendance',
        module: 'attendance',
        formats: ['json', 'csv'],
        filters: [
          { key: 'academicYearId', label: 'Academic Year', type: 'select' },
          { key: 'classId', label: 'Class', type: 'class' },
          { key: 'sectionId', label: 'Section', type: 'section' },
          { key: 'month', label: 'Month (1-12)', type: 'number' },
          { key: 'year', label: 'Year', type: 'number' },
          {
            key: 'studentId',
            label: 'Student',
            type: 'student',
            optional: true,
          },
          { key: 'status', label: 'Status', type: 'select', optional: true },
        ],
        requiredPermissions: ['reports:read', 'attendance:read'],
      },
      execute: async (tenantId, filters) => {
        const month = Number(filters.month);
        const year = Number(filters.year);
        const academicYearId = filters.academicYearId
          ? String(filters.academicYearId)
          : undefined;
        const classId = filters.classId ? String(filters.classId) : undefined;
        const sectionId = filters.sectionId
          ? String(filters.sectionId)
          : undefined;

        if (!month || !year || !academicYearId || !classId) {
          throw new ForbiddenException(
            'Missing required filters: month, year, academicYearId, classId',
          );
        }

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);

        const enrollments = await this.prisma.enrollment.findMany({
          where: {
            tenantId,
            academicYearId,
            classId,
            ...(sectionId ? { sectionId } : {}),
            ...(filters.studentId
              ? { studentId: String(filters.studentId) }
              : {}),
          },
          include: {
            student: true,
            class: true,
            section: true,
          },
          orderBy: { student: { firstNameEn: 'asc' } },
        });

        const sessions = await this.prisma.attendanceSession.findMany({
          where: {
            tenantId,
            academicYearId,
            classId,
            ...(sectionId ? { sectionId } : {}),
            attendanceDate: {
              gte: startDate,
              lte: endDate,
            },
          },
          include: {
            records: true,
          },
          orderBy: { attendanceDate: 'asc' },
        });

        const totalSchoolDays = sessions.length;

        return enrollments.map((e) => {
          const s = e.student;
          const records = sessions.flatMap((session) =>
            session.records.filter((r) => r.studentId === s.id),
          );

          const presentCount = records.filter(
            (r) => r.status === 'PRESENT',
          ).length;
          const absentCount = records.filter(
            (r) => r.status === 'ABSENT',
          ).length;
          const lateCount = records.filter((r) => r.status === 'LATE').length;
          const sickLeaveCount = records.filter(
            (r) => r.status === 'SICK_LEAVE',
          ).length;
          const excusedLeaveCount = records.filter(
            (r) => r.status === 'EXCUSED_LEAVE',
          ).length;
          const unexcusedLeaveCount = records.filter(
            (r) => r.status === 'UNEXCUSED_LEAVE',
          ).length;

          const attendancePercentage =
            totalSchoolDays > 0
              ? ((presentCount + lateCount) / totalSchoolDays) * 100
              : 0;

          const dailyStatusMap: Record<string, string> = {};
          sessions.forEach((session) => {
            const dayNum = session.attendanceDate.getDate();
            const dayKey = `D${dayNum.toString().padStart(2, '0')}`;
            const record = session.records.find((r) => r.studentId === s.id);
            dailyStatusMap[dayKey] = record?.status || '-';
          });

          return {
            'Student ID': s.studentSystemId,
            'Full Name': `${s.firstNameEn} ${s.lastNameEn}`,
            Class: e.class.name,
            Section: e.section?.name || '-',
            'Roll Number': e.rollNumber || '-',
            Month: `${year}-${month.toString().padStart(2, '0')}`,
            'Total School Days': totalSchoolDays,
            'Present Count': presentCount,
            'Absent Count': absentCount,
            'Late Count': lateCount,
            'Sick Leave Count': sickLeaveCount,
            'Excused Leave Count': excusedLeaveCount,
            'Unexcused Leave Count': unexcusedLeaveCount,
            'Attendance %': attendancePercentage.toFixed(2),
            ...dailyStatusMap,
          };
        });
      },
    });
  }

  register(executor: ReportExecutor) {
    this.registry.set(executor.definition.key, executor);
  }

  listReports(actor: AuthContext): ReportDefinition[] {
    return Array.from(this.registry.values())
      .map((e) => e.definition)
      .filter((def) =>
        def.requiredPermissions.every((p) => actor.permissions.includes(p)),
      );
  }

  async exportReport(
    reportKey: string,
    request: ReportExportRequest,
    actor: AuthContext,
  ): Promise<ReportExportResult> {
    const executor = this.registry.get(reportKey);
    if (!executor) {
      throw new NotFoundException('Report not found');
    }

    if (
      !executor.definition.requiredPermissions.every((p) =>
        actor.permissions.includes(p),
      )
    ) {
      throw new ForbiddenException(
        'Insufficient permissions to run this report',
      );
    }

    if (!executor.definition.formats.includes(request.format)) {
      throw new ForbiddenException(
        `Format ${request.format} not supported for this report`,
      );
    }

    const data = await executor.execute(
      actor.tenantId,
      request.filters,
      request.format,
    );

    await this.auditService.record({
      action: 'export_report',
      resource: 'reports',
      resourceId: reportKey,
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        format: request.format,
        filterCount: Object.keys(request.filters).length,
      },
    });

    const fileName = `${reportKey}-${new Date().toISOString().split('T')[0]}`;

    if (request.format === 'json') {
      return {
        format: 'json',
        content: data,
        fileName: `${fileName}.json`,
        contentType: 'application/json',
      };
    }

    if (request.format === 'csv') {
      const csv = this.convertToCsv(data);
      return {
        format: 'csv',
        content: Buffer.from(csv),
        fileName: `${fileName}.csv`,
        contentType: 'text/csv',
      };
    }

    if (request.format === 'pdf') {
      return {
        format: 'pdf',
        content: Buffer.from('PDF Placeholder'),
        fileName: `${fileName}.pdf`,
        contentType: 'application/pdf',
      };
    }

    throw new ForbiddenException('Unsupported format');
  }

  private convertToCsv(data: Record<string, unknown>[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const rows = data.map((obj) =>
      headers
        .map((header) => {
          const val = obj[header];
          if (val === null || val === undefined) return '""';
          const stringVal = String(val).replace(/"/g, '""');
          return `"${stringVal}"`;
        })
        .join(','),
    );

    return [headers.join(','), ...rows].join('\n');
  }
}
