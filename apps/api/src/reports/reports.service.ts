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
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import {
  StudentLifecycleStatus,
  EnrollmentStatus,
  Prisma,
} from '@prisma/client';

import { FinanceService } from '../finance/finance.service';
import { FileRegistryService } from '../file-registry/file-registry.service';
import {
  buildTableReportPdf,
  getJpegDimensions,
} from '../common/pdf/simple-pdf';

export interface ReportExecutor {
  definition: ReportDefinition;
  execute: (
    actor: AuthContext,
    filters: Record<string, unknown>,
    format: string,
  ) => Promise<Array<Record<string, unknown>>>;
}

@Injectable()
export class ReportsService {
  public readonly registry = new Map<string, ReportExecutor>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly financeService: FinanceService,
    private readonly fileRegistryService: FileRegistryService,
    @InjectQueue('reports') private readonly reportsQueue: Queue,
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
        key: 'academic-class-result-summary',
        name: 'Class Result Summary',
        description: 'Class-level report-card outcomes for an exam term',
        category: 'academics',
        module: 'academics',
        formats: ['json', 'csv', 'pdf'],
        filters: [
          {
            key: 'academicYearId',
            label: 'Academic Year',
            type: 'select',
            required: true,
          },
          {
            key: 'examTermId',
            label: 'Exam Term',
            type: 'select',
            required: true,
          },
          { key: 'classId', label: 'Class', type: 'class' },
          { key: 'sectionId', label: 'Section', type: 'section' },
        ],
        requiredPermissions: ['academics:read'],
      },
      execute: async (actor, filters) => {
        const cards = await this.prisma.reportCard.findMany({
          where: {
            tenantId: actor.tenantId,
            academicYearId: String(filters.academicYearId),
            examTermId: String(filters.examTermId),
            ...(filters.classId ? { classId: String(filters.classId) } : {}),
            ...(filters.sectionId
              ? { sectionId: String(filters.sectionId) }
              : {}),
          },
          include: { student: true, class: true, section: true },
          orderBy: [
            { class: { name: 'asc' } },
            { student: { firstNameEn: 'asc' } },
          ],
        });

        return cards.map((card) => ({
          'Student ID': card.student.studentSystemId,
          Student: `${card.student.firstNameEn} ${card.student.lastNameEn}`,
          Class: card.class.name,
          Section: card.section?.name ?? '-',
          'Roll Number': card.student.rollNumber ?? '-',
          Status: card.status,
          'Publish Status': card.publishStatus ?? 'UNPUBLISHED',
          'Total Marks': Number(card.totalMarks),
          'Max Marks': Number(card.maxMarks),
          Percentage: Number(card.percentage),
          Grade: card.grade,
          GPA: Number(card.gpa),
          Version: card.version,
        }));
      },
    });

    this.register({
      definition: {
        key: 'academic-subject-performance',
        name: 'Subject-wise Performance',
        description: 'Subject marks and grade spread by exam term',
        category: 'academics',
        module: 'academics',
        formats: ['json', 'csv', 'pdf'],
        filters: [
          {
            key: 'examTermId',
            label: 'Exam Term',
            type: 'select',
            required: true,
          },
          { key: 'classId', label: 'Class', type: 'class' },
          { key: 'sectionId', label: 'Section', type: 'section' },
          { key: 'subjectId', label: 'Subject', type: 'select' },
        ],
        requiredPermissions: ['academics:read'],
      },
      execute: async (actor, filters) => {
        const marks = await this.prisma.markEntry.findMany({
          where: {
            tenantId: actor.tenantId,
            examTermId: String(filters.examTermId),
            ...(filters.subjectId
              ? { subjectId: String(filters.subjectId) }
              : {}),
            student: {
              ...(filters.classId ? { classId: String(filters.classId) } : {}),
              ...(filters.sectionId
                ? { sectionId: String(filters.sectionId) }
                : {}),
            },
          },
          include: { student: true, subject: true, assessmentComponent: true },
          orderBy: [
            { subject: { code: 'asc' } },
            { student: { firstNameEn: 'asc' } },
          ],
        });

        return marks.map((mark) => ({
          Subject: `${mark.subject.code} - ${mark.subject.name}`,
          Component: mark.assessmentComponent.name,
          'Student ID': mark.student.studentSystemId,
          Student: `${mark.student.firstNameEn} ${mark.student.lastNameEn}`,
          'Marks Obtained': Number(mark.marksObtained),
          'Max Marks': Number(mark.assessmentComponent.maxMarks),
          Percentage:
            Number(mark.assessmentComponent.maxMarks) > 0
              ? (
                  (Number(mark.marksObtained) /
                    Number(mark.assessmentComponent.maxMarks)) *
                  100
                ).toFixed(2)
              : '0.00',
          Status: mark.status,
          Locked: mark.isLocked ? 'YES' : 'NO',
        }));
      },
    });

    this.register({
      definition: {
        key: 'academic-grade-distribution',
        name: 'Grade Distribution',
        description: 'Report-card grade counts for an exam term',
        category: 'academics',
        module: 'academics',
        formats: ['json', 'csv', 'pdf'],
        filters: [
          {
            key: 'academicYearId',
            label: 'Academic Year',
            type: 'select',
            required: true,
          },
          {
            key: 'examTermId',
            label: 'Exam Term',
            type: 'select',
            required: true,
          },
          { key: 'classId', label: 'Class', type: 'class' },
          { key: 'sectionId', label: 'Section', type: 'section' },
        ],
        requiredPermissions: ['academics:read'],
      },
      execute: async (actor, filters) => {
        const groups = await this.prisma.reportCard.groupBy({
          by: ['grade'],
          where: {
            tenantId: actor.tenantId,
            academicYearId: String(filters.academicYearId),
            examTermId: String(filters.examTermId),
            ...(filters.classId ? { classId: String(filters.classId) } : {}),
            ...(filters.sectionId
              ? { sectionId: String(filters.sectionId) }
              : {}),
          },
          _count: { _all: true },
          orderBy: { grade: 'asc' },
        });

        return groups.map((group) => ({
          Grade: group.grade,
          Count: group._count._all,
        }));
      },
    });

    this.register({
      definition: {
        key: 'academic-missing-marks',
        name: 'Missing Marks Report',
        description: 'Students/components that do not yet have submitted marks',
        category: 'academics',
        module: 'academics',
        formats: ['json', 'csv', 'pdf'],
        filters: [
          {
            key: 'academicYearId',
            label: 'Academic Year',
            type: 'select',
            required: true,
          },
          {
            key: 'examTermId',
            label: 'Exam Term',
            type: 'select',
            required: true,
          },
          { key: 'classId', label: 'Class', type: 'class', required: true },
          { key: 'sectionId', label: 'Section', type: 'section' },
          { key: 'subjectId', label: 'Subject', type: 'select' },
        ],
        requiredPermissions: ['academics:read'],
      },
      execute: async (actor, filters) => {
        const [enrollments, components, marks] = await Promise.all([
          this.prisma.enrollment.findMany({
            where: {
              tenantId: actor.tenantId,
              academicYearId: String(filters.academicYearId),
              classId: String(filters.classId),
              ...(filters.sectionId
                ? { sectionId: String(filters.sectionId) }
                : {}),
              status: 'ACTIVE',
            },
            include: { student: true, class: true, section: true },
          }),
          this.prisma.assessmentComponent.findMany({
            where: {
              tenantId: actor.tenantId,
              examTermId: String(filters.examTermId),
              subject: {
                classId: String(filters.classId),
                ...(filters.subjectId ? { id: String(filters.subjectId) } : {}),
              },
            },
            include: { subject: true },
          }),
          this.prisma.markEntry.findMany({
            where: {
              tenantId: actor.tenantId,
              examTermId: String(filters.examTermId),
            },
            select: {
              studentId: true,
              assessmentComponentId: true,
              status: true,
            },
          }),
        ]);
        const markKey = new Set(
          marks
            .filter((mark) => mark.status !== 'MISSING')
            .map((mark) => `${mark.studentId}:${mark.assessmentComponentId}`),
        );

        return enrollments.flatMap((enrollment) =>
          components
            .filter(
              (component) =>
                !markKey.has(`${enrollment.studentId}:${component.id}`),
            )
            .map((component) => ({
              'Student ID': enrollment.student.studentSystemId,
              Student: `${enrollment.student.firstNameEn} ${enrollment.student.lastNameEn}`,
              Class: enrollment.class.name,
              Section: enrollment.section?.name ?? '-',
              Subject: `${component.subject.code} - ${component.subject.name}`,
              Component: component.name,
              Status: 'MISSING',
            })),
        );
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

        const classroom = await this.prisma.class.findFirst({
          where: { id: classId, tenantId: actor.tenantId },
        });
        if (!classroom) {
          throw new NotFoundException('Class not found in this school.');
        }

        if (sectionId) {
          const section = await this.prisma.section.findFirst({
            where: { id: sectionId, tenantId: actor.tenantId },
          });
          if (!section) {
            throw new NotFoundException('Section not found in this school.');
          }
        }

        const isTeacherOnly =
          actor.roles.includes('teacher') &&
          !actor.permissions.includes('attendance:read_all') &&
          !actor.permissions.includes('reports:read_all') &&
          !actor.permissions.includes('attendance:mark_all') &&
          !actor.permissions.includes('attendance:override_lock');

        if (isTeacherOnly) {
          const staff = await this.prisma.staff.findFirst({
            where: { userId: actor.userId, tenantId: actor.tenantId },
          });
          if (!staff) {
            throw new ForbiddenException('Staff record not found in this tenant');
          }

          let isAssigned = false;
          if (sectionId) {
            const section = await this.prisma.section.findFirst({
              where: {
                id: sectionId,
                classTeacherId: staff.id,
                tenantId: actor.tenantId,
              },
            });
            if (section) isAssigned = true;
          }

          if (!isAssigned) {
            const assignment = await this.prisma.subjectTeacherAssignment.findFirst({
              where: {
                staffId: staff.id,
                classId,
                ...(sectionId ? { sectionId } : {}),
                tenantId: actor.tenantId,
              },
            });
            if (assignment) isAssigned = true;
          }

          if (!isAssigned) {
            throw new ForbiddenException(
              'You are not assigned as Class Teacher or Subject Teacher for this section',
            );
          }
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
        key: 'academic-cas-summary',
        name: 'CAS Summary Report',
        description: 'Detailed CAS marks breakdown by subject and student',
        category: 'academics',
        module: 'academics',
        formats: ['json', 'csv', 'pdf'],
        filters: [
          {
            key: 'academicYearId',
            label: 'Academic Year',
            type: 'select',
            required: true,
          },
          { key: 'classId', label: 'Class', type: 'class' },
          { key: 'sectionId', label: 'Section', type: 'section' },
        ],
        requiredPermissions: ['academics:read'],
      },
      execute: async (actor, filters) => {
        const records = await this.prisma.casRecord.findMany({
          where: {
            tenantId: actor.tenantId,
            academicYearId: String(filters.academicYearId),
            ...(filters.classId ? { classId: String(filters.classId) } : {}),
            ...(filters.sectionId
              ? { sectionId: String(filters.sectionId) }
              : {}),
          },
          include: {
            student: true,
            subject: true,
          },
          orderBy: [
            { student: { firstNameEn: 'asc' } },
            { subject: { name: 'asc' } },
          ],
        });

        return records.map((r) => ({
          'Student ID': r.student.studentSystemId,
          Student: `${r.student.firstNameEn} ${r.student.lastNameEn}`,
          Subject: r.subject?.name || 'General',
          Category: r.category,
          Score: Number(r.score),
          'Max Score': Number(r.maxScore),
          Note: r.note || '-',
          'Observed On': r.observedOn.toISOString().split('T')[0],
        }));
      },
    });

    this.register({
      definition: {
        key: 'academic-promotion-readiness',
        name: 'Promotion Readiness Export',
        description:
          'Students eligibility for promotion based on final marks and attendance',
        category: 'academics',
        module: 'academics',
        formats: ['json', 'csv', 'pdf'],
        filters: [
          {
            key: 'academicYearId',
            label: 'Academic Year',
            type: 'select',
            required: true,
          },
          { key: 'classId', label: 'Class', type: 'class', required: true },
        ],
        requiredPermissions: ['academics:read', 'promotion:read'],
      },
      execute: async (actor, filters) => {
        const enrollments = await this.prisma.enrollment.findMany({
          where: {
            tenantId: actor.tenantId,
            academicYearId: String(filters.academicYearId),
            classId: String(filters.classId),
            status: 'ACTIVE',
          },
          include: {
            student: true,
            class: true,
          },
        });

        return enrollments.map((e) => ({
          'Student ID': e.student.studentSystemId,
          Student: `${e.student.firstNameEn} ${e.student.lastNameEn}`,
          'Current Class': e.class.name,
          'Roll Number': e.rollNumber || '-',
          'Promotion Status': e.status === 'ACTIVE' ? 'READY' : 'PENDING',
        }));
      },
    });

    this.register({
      definition: {
        key: 'academic-report-card-status',
        name: 'Report Card Generation Status',
        description: 'Tracking report for generated vs pending report cards',
        category: 'academics',
        module: 'academics',
        formats: ['json', 'csv'],
        filters: [
          {
            key: 'academicYearId',
            label: 'Academic Year',
            type: 'select',
            required: true,
          },
          {
            key: 'examTermId',
            label: 'Exam Term',
            type: 'select',
            required: true,
          },
          { key: 'classId', label: 'Class', type: 'class' },
        ],
        requiredPermissions: ['academics:read', 'report_cards:read'],
      },
      execute: async (actor, filters) => {
        const [enrollments, reportCards] = await Promise.all([
          this.prisma.enrollment.findMany({
            where: {
              tenantId: actor.tenantId,
              academicYearId: String(filters.academicYearId),
              ...(filters.classId ? { classId: String(filters.classId) } : {}),
              status: 'ACTIVE',
            },
            include: { student: true, class: true },
          }),
          this.prisma.reportCard.findMany({
            where: {
              tenantId: actor.tenantId,
              examTermId: String(filters.examTermId),
              ...(filters.classId ? { classId: String(filters.classId) } : {}),
            },
            select: { studentId: true, status: true },
          }),
        ]);

        const generatedMap = new Map(
          reportCards.map((rc) => [rc.studentId, rc.status]),
        );

        return enrollments.map((e) => ({
          'Student ID': e.student.studentSystemId,
          Student: `${e.student.firstNameEn} ${e.student.lastNameEn}`,
          Class: e.class.name,
          Status: generatedMap.has(e.studentId) ? 'GENERATED' : 'PENDING',
          'Card Status': generatedMap.get(e.studentId) || '-',
        }));
      },
    });

    this.register({
      definition: {
        key: 'academic-failed-students',
        name: 'Failed/Below-Threshold Students',
        description:
          'Students who failed or are below a certain grade/percentage threshold',
        category: 'academics',
        module: 'academics',
        formats: ['json', 'csv', 'pdf'],
        filters: [
          {
            key: 'academicYearId',
            label: 'Academic Year',
            type: 'select',
            required: true,
          },
          {
            key: 'examTermId',
            label: 'Exam Term',
            type: 'select',
            required: true,
          },
          { key: 'classId', label: 'Class', type: 'class' },
          {
            key: 'thresholdPercentage',
            label: 'Threshold %',
            type: 'text',
          },
        ],
        requiredPermissions: ['academics:read'],
      },
      execute: async (actor, filters) => {
        const threshold = Number(filters.thresholdPercentage || 40);
        const reportCards = await this.prisma.reportCard.findMany({
          where: {
            tenantId: actor.tenantId,
            academicYearId: String(filters.academicYearId),
            examTermId: String(filters.examTermId),
            ...(filters.classId ? { classId: String(filters.classId) } : {}),
            percentage: { lt: threshold },
          },
          include: { student: true, class: true },
          orderBy: { percentage: 'asc' },
        });

        return reportCards.map((rc) => ({
          'Student ID': rc.student.studentSystemId,
          Student: `${rc.student.firstNameEn} ${rc.student.lastNameEn}`,
          Class: rc.class.name,
          Percentage: Number(rc.percentage).toFixed(2),
          Grade: rc.grade,
          GPA: Number(rc.gpa).toFixed(2),
        }));
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
            sectionId: filters.sectionId
              ? String(filters.sectionId)
              : undefined,
            studentId: filters.studentId
              ? String(filters.studentId)
              : undefined,
            collectorUserId: filters.collectorUserId
              ? String(filters.collectorUserId)
              : undefined,
            paymentMethod: filters.paymentMethod
              ? String(filters.paymentMethod)
              : undefined,
            feeHeadId: filters.feeHeadId
              ? String(filters.feeHeadId)
              : undefined,
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

    this.register({
      definition: {
        key: 'defaulter-aging-report',
        name: 'Defaulter Aging Report',
        description: 'Aging analysis of outstanding fees as of a specific date',
        category: 'finance',
        module: 'finance',
        formats: ['json', 'csv'],
        filters: [
          {
            key: 'asOfDate',
            label: 'As Of Date',
            type: 'date',
            required: true,
          },
          { key: 'academicYearId', label: 'Academic Year', type: 'select' },
          { key: 'classId', label: 'Class', type: 'class' },
          { key: 'sectionId', label: 'Section', type: 'section' },
          { key: 'studentId', label: 'Student', type: 'student' },
          { key: 'feeHeadId', label: 'Fee Head', type: 'select' },
          { key: 'minOutstanding', label: 'Min Outstanding', type: 'text' },
          {
            key: 'agingBucket',
            label: 'Aging Bucket',
            type: 'select',
            options: [
              { label: '0-30 days', value: '0-30' },
              { label: '31-60 days', value: '31-60' },
              { label: '61-90 days', value: '61-90' },
              { label: '90+ days', value: '90+' },
            ],
          },
        ],
        requiredPermissions: ['reports:export', 'ledger:read'],
      },
      execute: async (actor, filters) => {
        const report = await this.financeService.getDefaulterAgingReportRows(
          actor,
          {
            asOfDate: String(filters.asOfDate),
            academicYearId: filters.academicYearId
              ? String(filters.academicYearId)
              : undefined,
            classId: filters.classId ? String(filters.classId) : undefined,
            sectionId: filters.sectionId
              ? String(filters.sectionId)
              : undefined,
            studentId: filters.studentId
              ? String(filters.studentId)
              : undefined,
            feeHeadId: filters.feeHeadId
              ? String(filters.feeHeadId)
              : undefined,
            minOutstanding: filters.minOutstanding
              ? Number(filters.minOutstanding)
              : undefined,
            agingBucket: filters.agingBucket
              ? String(filters.agingBucket)
              : undefined,
          },
        );

        const rows = report.rows.map((row) => ({
          'Student ID': row.studentSystemId,
          Student: row.studentName,
          Class: row.className,
          Section: row.sectionName,
          'Guardian Name': row.guardianName,
          'Guardian Phone': row.guardianPhone,
          'Invoice No': row.invoiceNumber,
          'Fee Head': row.feeHeadName || 'Multiple',
          'Due Date': row.dueDate.toISOString().split('T')[0],
          'Invoice Amt': row.invoiceAmount,
          Paid: row.paidAmount,
          Waiver: row.waiverAmount,
          Refund: row.refundAmount,
          Outstanding: row.outstandingAmount,
          'Days Overdue': row.daysOverdue,
          Bucket: row.agingBucket,
          'Last Payment': row.lastPaymentDate
            ? row.lastPaymentDate.toISOString().split('T')[0]
            : '-',
          Status: row.status,
        }));

        const divider = Object.keys(rows[0] || {}).reduce(
          (acc, key) => ({ ...acc, [key]: '---' }),
          {},
        );

        const summaryRows = [
          divider,
          {
            'Student ID': 'SUMMARY',
            Student: '',
            Class: '',
            Section: '',
            'Guardian Name': '',
            'Guardian Phone': '',
            'Invoice No': '',
            'Fee Head': '',
            'Due Date': '',
            'Invoice Amt': '',
            Paid: '',
            Waiver: '',
            Refund: '',
            Outstanding: report.summary.totalOutstanding,
            'Days Overdue': '',
            Bucket: '',
            'Last Payment': '',
            Status: '',
          },
          {
            'Student ID': 'Total Defaulters',
            Student: report.summary.totalDefaulters,
            Class: '',
            Section: '',
            'Guardian Name': '',
            'Guardian Phone': '',
            'Invoice No': '',
            'Fee Head': '',
            'Due Date': '',
            'Invoice Amt': '',
            Paid: '',
            Waiver: '',
            Refund: '',
            Outstanding: '',
            'Days Overdue': '',
            Bucket: '',
            'Last Payment': '',
            Status: '',
          },
        ];

        return [...rows, ...summaryRows];
      },
    });

    this.register({
      definition: {
        key: 'dues-table-report',
        name: 'Dues Analysis Report',
        description:
          'Detailed breakdown of outstanding fees across all students',
        category: 'finance',
        module: 'finance',
        formats: ['json', 'csv'],
        filters: [
          { key: 'academicYearId', label: 'Academic Year', type: 'select' },
          { key: 'classId', label: 'Class', type: 'class' },
          { key: 'sectionId', label: 'Section', type: 'section' },
          { key: 'feeHeadId', label: 'Fee Head', type: 'select' },
          { key: 'studentId', label: 'Student', type: 'student' },
        ],
        requiredPermissions: ['reports:export', 'ledger:read'],
      },
      execute: async (actor, filters) => {
        const report = await this.financeService.getDuesTableReport(
          {
            academicYearId: filters.academicYearId
              ? String(filters.academicYearId)
              : undefined,
            classId: filters.classId ? String(filters.classId) : undefined,
            sectionId: filters.sectionId
              ? String(filters.sectionId)
              : undefined,
            feeHeadId: filters.feeHeadId
              ? String(filters.feeHeadId)
              : undefined,
            studentId: filters.studentId
              ? String(filters.studentId)
              : undefined,
          },
          actor,
        );

        const rows = report.rows.map((row) => ({
          Student: row.studentName,
          Class: row.className,
          'Fee Head': row.feeHead,
          Billed: row.billed,
          Waived: row.waived,
          Paid: row.paid,
          Outstanding: row.outstanding,
          'Due Date': new Date(row.dueDate).toISOString().split('T')[0],
        }));

        if (rows.length === 0) return [];

        const divider = Object.keys(rows[0]).reduce(
          (acc, key) => ({ ...acc, [key]: '---' }),
          {},
        );

        const summaryRows = [
          divider,
          {
            Student: 'SUMMARY',
            Class: '',
            'Fee Head': '',
            Billed: report.summary.totalBilled,
            Waived: report.summary.totalWaived,
            Paid: report.summary.totalPaid,
            Outstanding: report.summary.totalOutstanding,
            'Due Date': '',
          },
        ];

        return [...rows, ...summaryRows];
      },
    });

    this.register({
      definition: {
        key: 'cashier-close-report',
        name: 'Cashier Close Report',
        description:
          'Daily summary of collections by cashier and payment method',
        category: 'finance',
        module: 'finance',
        formats: ['json', 'csv'],
        filters: [
          { key: 'fromDate', label: 'From Date', type: 'date', required: true },
          { key: 'toDate', label: 'To Date', type: 'date', required: true },
          { key: 'collectorUserId', label: 'Collector', type: 'select' },
        ],
        requiredPermissions: ['reports:read', 'payments:close'],
      },
      execute: async (actor, filters) => {
        const from = new Date(String(filters.fromDate));
        const to = new Date(String(filters.toDate));

        const closes = await this.prisma.cashierClose.findMany({
          where: {
            tenantId: actor.tenantId,
            openedAt: { gte: from },
            closedAt: { lte: to },
            ...(filters.collectorUserId
              ? { collectorUserId: String(filters.collectorUserId) }
              : {}),
          },
          include: {
            collectorUser: true,
            closedBy: true,
          },
          orderBy: { openedAt: 'desc' },
        });

        return closes.map((c) => ({
          'Close Number': c.closeNumber,
          'Opened At': c.openedAt.toISOString(),
          'Closed At': c.closedAt.toISOString(),
          Collector: c.collectorUser?.email || 'N/A',
          'Payment Method': c.paymentMethod || 'All',
          'Gross Collected': Number(c.grossCollected),
          'Total Refunded': Number(c.totalRefunded),
          'Net Collected': Number(c.netCollected),
          'Expected Cash': Number(c.expectedCashAmount || 0),
          'Actual Cash': Number(c.actualCashAmount || 0),
          Variance: Number(c.varianceAmount || 0),
          'Variance Reason': c.varianceReason || '-',
          'Payment Count': c.paymentCount,
          'Refund Count': c.refundCount,
          'Closed By': c.closedBy?.email || 'System',
        }));
      },
    });

    this.register({
      definition: {
        key: 'staff-attendance-report',
        name: 'Staff Attendance Report',
        description: 'Detailed attendance report for staff members',
        category: 'hr',
        module: 'hr',
        formats: ['json', 'csv'],
        filters: [
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
            key: 'staffId',
            label: 'Staff Member',
            type: 'select',
            required: false,
          },
        ],
        requiredPermissions: ['hr:staff:read'],
      },
      execute: async (actor, filters) => {
        const month = Number(filters.month);
        const year = Number(filters.year);
        const startsOn = new Date(year, month - 1, 1);
        const endsOn = new Date(year, month, 0);

        const staff = await this.prisma.staff.findMany({
          where: {
            tenantId: actor.tenantId,
            ...(filters.staffId ? { id: String(filters.staffId) } : {}),
          },
          include: {
            attendanceRecords: {
              where: {
                attendanceDate: { gte: startsOn, lte: endsOn },
              },
            },
          },
          orderBy: { firstName: 'asc' },
        });

        return staff.map((s) => {
          const present = s.attendanceRecords.filter(
            (r) => r.status === 'PRESENT',
          ).length;
          const absent = s.attendanceRecords.filter(
            (r) => r.status === 'ABSENT',
          ).length;
          const leave = s.attendanceRecords.filter(
            (r) => r.status === 'LEAVE',
          ).length;

          return {
            'Employee ID': s.employeeId,
            'Full Name': `${s.firstName} ${s.lastName}`,
            Month: `${year}-${month.toString().padStart(2, '0')}`,
            'Present Days': present,
            'Absent Days': absent,
            'Leave Days': leave,
            'Total Working Days': s.attendanceRecords.length,
          };
        });
      },
    });

    this.register({
      definition: {
        key: 'staff-leave-report',
        name: 'Staff Leave Report',
        description: 'Summary of leave requests and balances for staff',
        category: 'hr',
        module: 'hr',
        formats: ['json', 'csv'],
        filters: [
          { key: 'year', label: 'Year', type: 'text', required: true },
          {
            key: 'staffId',
            label: 'Staff Member',
            type: 'select',
            required: false,
          },
        ],
        requiredPermissions: ['hr:staff:read'],
      },
      execute: async (actor, filters) => {
        const year = Number(filters.year);
        const staff = await this.prisma.staff.findMany({
          where: {
            tenantId: actor.tenantId,
            ...(filters.staffId ? { id: String(filters.staffId) } : {}),
          },
          include: {
            leaveBalances: {
              where: { year },
            },
            leaveRequests: {
              where: {
                status: 'APPROVED',
                startsOn: {
                  gte: new Date(year, 0, 1),
                  lte: new Date(year, 11, 31),
                },
              },
            },
          },
          orderBy: { firstName: 'asc' },
        });

        return staff.flatMap((s) =>
          s.leaveBalances.map((b) => ({
            'Employee ID': s.employeeId,
            'Full Name': `${s.firstName} ${s.lastName}`,
            'Leave Type': b.leaveType,
            Allocated: Number(b.allocated),
            Used: Number(b.used),
            Remaining: Number(b.allocated) + Number(b.carried) - Number(b.used),
          })),
        );
      },
    });

    this.register({
      definition: {
        key: 'payroll-register',
        name: 'Payroll Register',
        description: 'Detailed register of all payroll runs and lines',
        category: 'payroll',
        module: 'payroll',
        formats: ['json', 'csv'],
        filters: [
          {
            key: 'month',
            label: 'Month',
            type: 'select',
            required: false,
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
          { key: 'year', label: 'Year', type: 'text', required: false },
        ],
        requiredPermissions: ['payroll:read'],
      },
      execute: async (actor, filters) => {
        const month = filters.month ? Number(filters.month) : undefined;
        const year = filters.year ? Number(filters.year) : undefined;

        const lines = await this.prisma.payrollLine.findMany({
          where: {
            tenantId: actor.tenantId,
            payrollRun: {
              ...(month ? { periodMonth: month } : {}),
              ...(year ? { periodYear: year } : {}),
            },
          },
          include: {
            staff: true,
            payrollRun: true,
          },
          orderBy: [
            { payrollRun: { periodYear: 'desc' } },
            { payrollRun: { periodMonth: 'desc' } },
            { staff: { firstName: 'asc' } },
          ],
        });

        return lines.map((l) => ({
          Period: `${l.payrollRun.periodYear}-${String(l.payrollRun.periodMonth).padStart(2, '0')}`,
          'Employee ID': l.staff.employeeId,
          'Staff Name': `${l.staff.firstName} ${l.staff.lastName}`,
          'Basic Salary': Number(l.basicSalary),
          'Gross Salary': Number(l.grossSalary),
          'PF Employee': Number(l.pfEmployee),
          'PF Employer': Number(l.pfEmployer),
          TDS: Number(l.tds),
          Deductions: Number(l.deductions),
          'Net Salary': Number(l.netSalary),
          Status: l.payrollRun.status,
        }));
      },
    });
    this.register({
      definition: {
        key: 'statutory-pf-summary',
        name: 'Statutory PF Summary',
        description:
          'Monthly summary of PF contributions (Employer & Employee)',
        category: 'payroll',
        module: 'payroll',
        formats: ['json', 'csv'],
        filters: [
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
        ],
        requiredPermissions: ['payroll:read'],
      },
      execute: async (actor, filters) => {
        const month = Number(filters.month);
        const year = Number(filters.year);

        const lines = await this.prisma.payrollLine.findMany({
          where: {
            tenantId: actor.tenantId,
            payrollRun: {
              periodMonth: month,
              periodYear: year,
              status: { in: ['POSTED', 'PAID'] },
            },
          },
          include: { staff: true },
        });

        return lines.map((l) => ({
          'Employee ID': l.staff.employeeId,
          'Staff Name': `${l.staff.firstName} ${l.staff.lastName}`,
          'Basic Salary': Number(l.basicSalary),
          'PF Employee (10%)': Number(l.pfEmployee),
          'PF Employer (10%)': Number(l.pfEmployer),
          'Total PF': Number(l.pfEmployee) + Number(l.pfEmployer),
        }));
      },
    });

    this.register({
      definition: {
        key: 'statutory-tds-summary',
        name: 'Statutory TDS Summary',
        description: 'Monthly summary of TDS deductions',
        category: 'payroll',
        module: 'payroll',
        formats: ['json', 'csv'],
        filters: [
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
        ],
        requiredPermissions: ['payroll:read'],
      },
      execute: async (actor, filters) => {
        const month = Number(filters.month);
        const year = Number(filters.year);

        const lines = await this.prisma.payrollLine.findMany({
          where: {
            tenantId: actor.tenantId,
            payrollRun: {
              periodMonth: month,
              periodYear: year,
              status: { in: ['POSTED', 'PAID'] },
            },
          },
          include: { staff: true },
        });

        return lines.map((l) => ({
          'Employee ID': l.staff.employeeId,
          'Staff Name': `${l.staff.firstName} ${l.staff.lastName}`,
          'PAN Number': l.staff.panNumber || 'N/A',
          'Gross Salary': Number(l.grossSalary),
          'TDS Deduction': Number(l.tds),
        }));
      },
    });

    // ─── Remaining Academic Reports ──────────────────────────────────

    this.register({
      definition: {
        key: 'academic-cas-summary',
        name: 'CAS Summary Report',
        description:
          'Continuous Assessment records summary by student and subject',
        category: 'academics',
        module: 'academics',
        formats: ['json', 'csv', 'pdf'],
        filters: [
          {
            key: 'academicYearId',
            label: 'Academic Year',
            type: 'select',
            required: true,
          },
          { key: 'classId', label: 'Class', type: 'class', required: true },
          { key: 'sectionId', label: 'Section', type: 'section' },
          { key: 'subjectId', label: 'Subject', type: 'select' },
        ],
        requiredPermissions: ['academics:read'],
      },
      execute: async (actor, filters) => {
        const records = await this.prisma.casRecord.findMany({
          where: {
            tenantId: actor.tenantId,
            academicYearId: String(filters.academicYearId),
            classId: String(filters.classId),
            ...(filters.sectionId
              ? { sectionId: String(filters.sectionId) }
              : {}),
            ...(filters.subjectId
              ? { subjectId: String(filters.subjectId) }
              : {}),
          },
          include: {
            student: true,
            subject: true,
          },
          orderBy: [{ observedOn: 'asc' }],
        });

        return records.map((record) => ({
          'Student ID': record.student.studentSystemId,
          Student: `${record.student.firstNameEn} ${record.student.lastNameEn}`,
          Subject: record.subject
            ? `${record.subject.code} - ${record.subject.name}`
            : 'General',
          Category: record.category,
          'Observed On': record.observedOn.toISOString().split('T')[0],
          Score: Number(record.score),
          'Max Score': Number(record.maxScore),
          Percentage:
            Number(record.maxScore) > 0
              ? (
                  (Number(record.score) / Number(record.maxScore)) *
                  100
                ).toFixed(2)
              : '0.00',
          Note: record.note ?? '-',
        }));
      },
    });

    this.register({
      definition: {
        key: 'academic-promotion-readiness',
        name: 'Promotion Readiness Report',
        description:
          'Students eligible for promotion based on report card outcomes',
        category: 'academics',
        module: 'academics',
        formats: ['json', 'csv', 'pdf'],
        filters: [
          {
            key: 'academicYearId',
            label: 'Academic Year',
            type: 'select',
            required: true,
          },
          {
            key: 'examTermId',
            label: 'Exam Term',
            type: 'select',
            required: true,
          },
          { key: 'classId', label: 'Class', type: 'class' },
          { key: 'sectionId', label: 'Section', type: 'section' },
        ],
        requiredPermissions: ['academics:read'],
      },
      execute: async (actor, filters) => {
        const cards = await this.prisma.reportCard.findMany({
          where: {
            tenantId: actor.tenantId,
            academicYearId: String(filters.academicYearId),
            examTermId: String(filters.examTermId),
            ...(filters.classId ? { classId: String(filters.classId) } : {}),
            ...(filters.sectionId
              ? { sectionId: String(filters.sectionId) }
              : {}),
            status: 'LOCKED',
          },
          include: { student: true, class: true, section: true },
          orderBy: [
            { class: { name: 'asc' } },
            { student: { firstNameEn: 'asc' } },
          ],
        });

        return cards.map((card) => {
          const percentage = Number(card.percentage);
          const passThreshold = 32; // Nepal standard minimum
          const isEligible = percentage >= passThreshold;

          return {
            'Student ID': card.student.studentSystemId,
            Student: `${card.student.firstNameEn} ${card.student.lastNameEn}`,
            Class: card.class.name,
            Section: card.section?.name ?? '-',
            'Roll Number': card.student.rollNumber ?? '-',
            Percentage: percentage.toFixed(2),
            Grade: card.grade,
            GPA: Number(card.gpa).toFixed(2),
            'Promotion Eligible': isEligible ? 'YES' : 'NO',
            Status: card.status,
            Version: card.version,
          };
        });
      },
    });

    this.register({
      definition: {
        key: 'academic-below-threshold',
        name: 'Below-Threshold Students',
        description:
          'Students failing or below the promotion threshold requiring remedial support',
        category: 'academics',
        module: 'academics',
        formats: ['json', 'csv', 'pdf'],
        filters: [
          {
            key: 'academicYearId',
            label: 'Academic Year',
            type: 'select',
            required: true,
          },
          {
            key: 'examTermId',
            label: 'Exam Term',
            type: 'select',
            required: true,
          },
          { key: 'classId', label: 'Class', type: 'class' },
          {
            key: 'threshold',
            label: 'Threshold %',
            type: 'text',
          },
        ],
        requiredPermissions: ['academics:read'],
      },
      execute: async (actor, filters) => {
        const threshold = filters.threshold ? Number(filters.threshold) : 32;

        const cards = await this.prisma.reportCard.findMany({
          where: {
            tenantId: actor.tenantId,
            academicYearId: String(filters.academicYearId),
            examTermId: String(filters.examTermId),
            ...(filters.classId ? { classId: String(filters.classId) } : {}),
          },
          include: { student: true, class: true, section: true },
          orderBy: [{ percentage: 'asc' }, { student: { firstNameEn: 'asc' } }],
        });

        return cards
          .filter((card) => Number(card.percentage) < threshold)
          .map((card) => ({
            'Student ID': card.student.studentSystemId,
            Student: `${card.student.firstNameEn} ${card.student.lastNameEn}`,
            Class: card.class.name,
            Section: card.section?.name ?? '-',
            Percentage: Number(card.percentage).toFixed(2),
            Grade: card.grade,
            GPA: Number(card.gpa).toFixed(2),
            Remarks: card.remarks ?? '-',
            'Remedial Required': 'YES',
          }));
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

    if (!request.async) {
      const data = await executor.execute(
        actor,
        request.filters,
        request.format,
      );

      await this.auditService.record({
        action: 'export_report',
        resource: 'report',
        resourceId: reportKey,
        tenantId: actor.tenantId,
        userId: actor.userId,
        after: {
          format: request.format,
          filters: request.filters,
        },
      });
      if (request.format === 'json') {
        await this.recordExportHistory({
          tenantId: actor.tenantId,
          reportKey,
          format: request.format,
          filters: request.filters,
          requestedBy: actor.userId,
        });

        return {
          format: request.format,
          status: 'COMPLETED',
          content: data,
          data,
          fileName: `${reportKey}.json`,
          contentType: 'application/json',
        };
      }

      let logoBuffer: Buffer | null = null;
      let logoDimensions: { width: number; height: number } | null = null;

      if (request.format === 'pdf') {
        const settings = await this.prisma.tenantSetting.findMany({
          where: { tenantId: actor.tenantId, key: 'school_logo' },
        });
        const logoSetting = settings[0]?.value;
        if (
          logoSetting &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            String(logoSetting),
          )
        ) {
          try {
            const { content } =
              await this.fileRegistryService.getProtectedDownload(
                actor.tenantId,
                String(logoSetting),
                actor.userId,
              );
            logoBuffer = content;
            logoDimensions = getJpegDimensions(content);
          } catch (e) {
            // Silently fail logo load
          }
        }
      }

      const content =
        request.format === 'pdf'
          ? buildTableReportPdf({
              schoolName: actor.tenantSlug,
              title: executor.definition.name,
              subtitle: `Module: ${executor.definition.module}`,
              rows: data,
              logo:
                logoBuffer && logoDimensions
                  ? {
                      buffer: logoBuffer,
                      width: logoDimensions.width,
                      height: logoDimensions.height,
                      format: 'jpeg',
                    }
                  : null,
            })
          : Buffer.from(this.convertToCsv(data));
      const contentType =
        request.format === 'pdf' ? 'application/pdf' : 'text/csv';
      const fileName = `${reportKey}.${request.format}`;

      await this.recordExportHistory({
        tenantId: actor.tenantId,
        reportKey,
        format: request.format,
        filters: request.filters,
        requestedBy: actor.userId,
        content,
        contentType,
        fileName,
        module: executor.definition.module,
      });

      return {
        format: request.format,
        status: 'COMPLETED',
        content,
        fileName,
        contentType,
      };
    }

    // Queue heavy or async export
    const exportRecord = await this.prisma.reportExport.create({
      data: {
        tenantId: actor.tenantId,
        reportKey,
        format: request.format,
        filters: request.filters,
        status: 'QUEUED',
        requestedBy: actor.userId,
      },
    });

    const job = await this.reportsQueue.add('generateReport', {
      exportId: exportRecord.id,
      reportKey,
      filters: request.filters,
      format: request.format,
      actor,
    });

    return {
      jobId: job.id,
      status: 'QUEUED',
    };
  }

  private convertToCsv(data: Array<Record<string, unknown>>): string {
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

  private async recordExportHistory(input: {
    tenantId: string;
    reportKey: string;
    format: string;
    filters: Prisma.InputJsonValue;
    requestedBy: string;
    content?: Buffer;
    contentType?: string;
    fileName?: string;
    module?: string;
  }) {
    const delegate = (
      this.prisma as unknown as {
        reportExport?: {
          create(input: unknown): Promise<unknown>;
        };
      }
    ).reportExport;
    if (!delegate?.create) {
      return;
    }
    let fileAssetId: string | undefined;
    if (input.content && input.contentType && input.fileName) {
      const asset = await this.fileRegistryService.registerGeneratedFile({
        tenantId: input.tenantId,
        generatedByUserId: input.requestedBy,
        originalFilename: input.fileName,
        content: input.content,
        mimeType: input.contentType,
        module: 'reports',
        metadata: {
          module: input.module ?? 'reports',
          reportKey: input.reportKey,
          format: input.format,
          filters: input.filters,
        },
      });
      fileAssetId = asset.id;
    }

    await delegate.create({
      data: {
        tenantId: input.tenantId,
        scope: input.tenantId === 'platform' ? 'platform' : 'tenant',
        reportKey: input.reportKey,
        format: input.format,
        filters: input.filters,
        fileAssetId,
        requestedBy: input.requestedBy,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
  }

  async getExportHistory(
    tenantId: string,
    query: { page?: number; limit?: number },
  ) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 25, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.ReportExportWhereInput = { tenantId };

    const [items, total] = await Promise.all([
      this.prisma.reportExport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.reportExport.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      hasNextPage: page * limit < total,
    };
  }

  async downloadExportSnapshot(
    exportId: string,
    actor: AuthContext,
  ): Promise<{ fileName: string; mimeType: string; content: Buffer }> {
    const exportRecord = await this.prisma.reportExport.findFirst({
      where: { id: exportId, tenantId: actor.tenantId },
    });

    if (!exportRecord) {
      throw new NotFoundException('Report snapshot not found');
    }

    if (!exportRecord.fileAssetId) {
      throw new NotFoundException('Report snapshot file is not available');
    }

    const { asset, content } =
      await this.fileRegistryService.getProtectedDownload(
        actor.tenantId,
        exportRecord.fileAssetId,
        actor.userId,
      );

    await this.auditService.record({
      action: 'download_report_snapshot',
      resource: 'report_export',
      resourceId: exportRecord.id,
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        reportKey: exportRecord.reportKey,
        format: exportRecord.format,
        fileAssetId: exportRecord.fileAssetId,
      },
    });

    return {
      fileName: asset.originalFilename,
      mimeType: asset.mimeType,
      content,
    };
  }
}
