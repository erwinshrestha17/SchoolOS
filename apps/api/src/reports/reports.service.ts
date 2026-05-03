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

import { FinanceService } from '../finance/finance.service';

export interface ReportExecutor {
  definition: ReportDefinition;
  execute: (
    actor: AuthContext,
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
    private readonly financeService: FinanceService,
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
      execute: async (actor, filters) => {
        const students = await this.prisma.student.findMany({
          where: {
            tenantId: actor.tenantId,
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
      execute: async (actor, filters) => {
        const enrollments = await this.prisma.enrollment.findMany({
          where: {
            tenantId: actor.tenantId,
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
        category: 'attendance',
        module: 'attendance',
        formats: ['json', 'csv'],
        filters: [
          {
            key: 'academicYearId',
            label: 'Academic Year',
            type: 'select',
            required: true,
          },
          { key: 'classId', label: 'Class', type: 'class', required: true },
          {
            key: 'sectionId',
            label: 'Section',
            type: 'section',
            required: false,
          },
          {
            key: 'month',
            label: 'Month',
            type: 'select',
            required: true,
            options: [
              { label: 'January', value: '1' },
              { label: 'February', value: '2' },
              { label: 'March', value: '3' },
              { label: 'April', value: '4' },
              { label: 'May', value: '5' },
              { label: 'June', value: '6' },
              { label: 'July', value: '7' },
              { label: 'August', value: '8' },
              { label: 'September', value: '9' },
              { label: 'October', value: '10' },
              { label: 'November', value: '11' },
              { label: 'December', value: '12' },
            ],
          },
          { key: 'year', label: 'Year', type: 'text', required: true },
          {
            key: 'studentId',
            label: 'Student',
            type: 'student',
            required: false,
          },
          { key: 'status', label: 'Status', type: 'select', required: false },
        ],
        requiredPermissions: ['reports:read', 'attendance:read'],
      },
      execute: async (actor, filters) => {
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
            tenantId: actor.tenantId,
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
            tenantId: actor.tenantId,
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

    this.register({
      definition: {
        key: 'student-fee-ledger',
        name: 'Student Fee Ledger',
        description: 'Complete financial ledger for a specific student',
        category: 'finance',
        module: 'finance',
        formats: ['json', 'csv'],
        filters: [
          {
            key: 'studentId',
            label: 'Student',
            type: 'student',
            required: true,
          },
          { key: 'academicYearId', label: 'Academic Year', type: 'select' },
          { key: 'fromDate', label: 'From Date', type: 'date' },
          { key: 'toDate', label: 'To Date', type: 'date' },
          { key: 'status', label: 'Invoice Status', type: 'select' },
        ],
        requiredPermissions: ['reports:export', 'ledger:read'],
      },
      execute: async (actor, filters) => {
        const studentId = filters.studentId
          ? String(filters.studentId)
          : undefined;
        if (!studentId) {
          throw new ForbiddenException('studentId filter is required');
        }

        const ledger = await this.financeService.getStudentFeeLedger(
          studentId,
          actor,
          {
            academicYearId: filters.academicYearId
              ? String(filters.academicYearId)
              : undefined,
            fromDate: filters.fromDate ? String(filters.fromDate) : undefined,
            toDate: filters.toDate ? String(filters.toDate) : undefined,
            status: filters.status ? String(filters.status) : undefined,
          },
        );

        return ledger.rows.map((row) => ({
          'Student ID': ledger.student.studentSystemId,
          'Student Name': ledger.student.name,
          Class: ledger.student.className,
          Section: ledger.student.sectionName || '-',
          'Guardian Name': ledger.student.guardianName || '-',
          'Guardian Phone': ledger.student.guardianPhone || '-',
          Date: row.date.toISOString().split('T')[0],
          Type: row.type,
          Reference: row.reference,
          Description: row.description,
          Debit: row.debit,
          Credit: row.credit,
          Balance: row.runningBalance,
          'Invoice Number': row.invoiceNumber || '-',
          'Receipt Number': row.receiptNumber || '-',
          Status: row.status || '-',
        }));
      },
    });

    this.register({
      definition: {
        key: 'fee-collection-report',
        name: 'Fee Collection Report',
        description:
          'Detailed collection report for a specific period with breakdown',
        category: 'finance',
        module: 'finance',
        formats: ['json', 'csv'],
        filters: [
          { key: 'fromDate', label: 'From Date', type: 'date', required: true },
          { key: 'toDate', label: 'To Date', type: 'date', required: true },
          { key: 'academicYearId', label: 'Academic Year', type: 'select' },
          { key: 'classId', label: 'Class', type: 'class' },
          { key: 'sectionId', label: 'Section', type: 'section' },
          { key: 'studentId', label: 'Student', type: 'student' },
          { key: 'collectorUserId', label: 'Collector', type: 'select' },
          { key: 'paymentMethod', label: 'Payment Method', type: 'select' },
          { key: 'feeHeadId', label: 'Fee Head', type: 'select' },
        ],
        requiredPermissions: ['reports:export', 'ledger:read'],
      },
      execute: async (actor, filters) => {
        const report = await this.financeService.getFeeCollectionReportRows(
          actor,
          {
            fromDate: String(filters.fromDate),
            toDate: String(filters.toDate),
            academicYearId: filters.academicYearId
              ? String(filters.academicYearId)
              : undefined,
            classId: filters.classId ? String(filters.classId) : undefined,
            sectionId: filters.sectionId ? String(filters.sectionId) : undefined,
            studentId: filters.studentId ? String(filters.studentId) : undefined,
            collectorUserId: filters.collectorUserId
              ? String(filters.collectorUserId)
              : undefined,
            paymentMethod: filters.paymentMethod
              ? String(filters.paymentMethod)
              : undefined,
            feeHeadId: filters.feeHeadId ? String(filters.feeHeadId) : undefined,
          },
        );

        const rows = report.rows.map((row) => ({
          'Receipt No': row.receiptNumber,
          Date: row.paymentDate.toISOString().split('T')[0],
          'Student ID': row.studentSystemId,
          Student: row.studentName,
          Class: row.className,
          Section: row.sectionName,
          'Guardian Name': row.guardianName,
          'Guardian Phone': row.guardianPhone,
          'Invoice No': row.invoiceNumber,
          'Fee Head': row.feeHeadName || 'Multiple',
          Method: row.paymentMethod,
          Collector: row.collectedBy,
          Gross: row.grossAmount,
          Discount: row.discountAmount,
          Waiver: row.waiverAmount,
          Paid: row.paidAmount,
          Refund: row.refundAmount,
          Net: row.netCollectedAmount,
          Status: row.status,
        }));

        // Add summary rows at the bottom for CSV
        const divider = Object.keys(rows[0] || {}).reduce(
          (acc, key) => ({ ...acc, [key]: '---' }),
          {},
        );

        const summaryRows = [
          divider,
          {
            'Receipt No': 'SUMMARY',
            Date: '',
            'Student ID': '',
            Student: '',
            Class: '',
            Section: '',
            'Guardian Name': '',
            'Guardian Phone': '',
            'Invoice No': '',
            'Fee Head': '',
            Method: '',
            Collector: '',
            Gross: report.summary.totalGrossAmount,
            Discount: report.summary.totalDiscountAmount,
            Waiver: report.summary.totalWaiverAmount,
            Paid: report.summary.totalPaidAmount,
            Refund: report.summary.totalRefundAmount,
            Net: report.summary.totalNetCollectedAmount,
            Status: '',
          },
          {
            'Receipt No': 'Total Receipts',
            Date: report.summary.totalReceipts,
            'Student ID': '',
            Student: '',
            Class: '',
            Section: '',
            'Guardian Name': '',
            'Guardian Phone': '',
            'Invoice No': '',
            'Fee Head': '',
            Method: '',
            Collector: '',
            Gross: '',
            Discount: '',
            Waiver: '',
            Paid: '',
            Refund: '',
            Net: '',
            Status: '',
          },
        ];

        return [...rows, ...summaryRows];
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

    const data = await executor.execute(actor, request.filters, request.format);

    await this.auditService.record({
      action: 'export_report',
      resource: 'report',
      resourceId: reportKey,
      tenantId: actor.tenantId,
      userId: actor.userId,
      metadata: {
        reportKey,
        format: request.format,
        filters: request.filters,
        fromDate: request.filters.fromDate,
        toDate: request.filters.toDate,
      },
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
