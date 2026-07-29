import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  AttendanceStatus,
  HomeworkAssignmentStatus,
  MarkEntryStatus,
  TeacherAssignmentType,
} from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { TeacherScopeService } from '../teacher-scope/teacher-scope.service';
import { TeacherCapability } from '../teacher-scope/teacher-capability';
import { TeacherWorkspaceModuleResolver } from './teacher-workspace-modules';

/**
 * Mark statuses a Class Teacher may see. A DRAFT mark is the Subject
 * Teacher's private working value; the homeroom summary must never surface
 * it, even in aggregate, or the Class Teacher could infer unpublished grades.
 */
const CLASS_TEACHER_VISIBLE_MARK_STATUSES: MarkEntryStatus[] = [
  MarkEntryStatus.SUBMITTED,
  MarkEntryStatus.PRESENT,
  MarkEntryStatus.ABSENT,
  MarkEntryStatus.EXCUSED,
  MarkEntryStatus.MISSING,
  MarkEntryStatus.WITHHELD,
  MarkEntryStatus.RETEST,
];

const ATTENDANCE_WINDOW_DAYS = 30;
const LOW_ATTENDANCE_THRESHOLD = 80;

interface SubjectSummary {
  id: string;
  name: string;
  code: string;
}

interface HomeworkSummaryRow {
  id: string;
  title: string;
  dueDate: Date;
  status: HomeworkAssignmentStatus;
  subjectId: string;
  subject: { id: string; name: string } | null;
  assignedByStaffId: string | null;
  assignedByStaff: { firstName: string; lastName: string } | null;
  _count: { submissions: number };
}

/**
 * The Class Teacher's cross-subject homeroom view (assignment-based access
 * control spec, "Class Teacher or Homeroom Teacher").
 *
 * This is the one place a teacher legitimately sees academic records for
 * subjects they do not teach. Three rules make that safe:
 *
 *   1. Authorization comes from HOMEROOM_ACADEMIC_SUMMARY_READ, which only a
 *      CLASS_TEACHER assignment for this exact section can satisfy.
 *   2. It is strictly read-only. No method here mutates anything, and the
 *      controller exposes no write route.
 *   3. Draft records are excluded at the query level, not filtered after the
 *      fact -- another teacher's unsubmitted marks never leave the database.
 */
@Injectable()
export class HomeroomSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teacherScopeService: TeacherScopeService,
    private readonly moduleResolver: TeacherWorkspaceModuleResolver,
  ) {}

  /** Homerooms this caller is the Class Teacher of. Empty for everyone else. */
  async listMyHomerooms(actor: AuthContext) {
    const assignments =
      await this.teacherScopeService.listActiveAssignments(actor);
    const homerooms = assignments.filter(
      (assignment) =>
        assignment.assignmentType === TeacherAssignmentType.CLASS_TEACHER &&
        assignment.source === 'ASSIGNMENT',
    );
    if (homerooms.length === 0) return [];

    const sections = await this.prisma.section.findMany({
      where: {
        tenantId: actor.tenantId,
        id: { in: homerooms.map((item) => item.sectionId) },
      },
      select: {
        id: true,
        name: true,
        classId: true,
        class: { select: { id: true, name: true } },
        _count: { select: { students: true } },
      },
    });

    return homerooms.map((assignment) => {
      const section = sections.find((item) => item.id === assignment.sectionId);
      return {
        assignmentId: assignment.assignmentId,
        academicYearId: assignment.academicYearId,
        classId: assignment.classId,
        sectionId: assignment.sectionId,
        className: section?.class?.name ?? assignment.classId,
        sectionName: section?.name ?? null,
        studentCount: section?._count.students ?? 0,
      };
    });
  }

  /**
   * Cross-subject academic picture for one homeroom: which subjects have
   * reported marks, which students are missing them, homework in flight
   * across every subject, and attendance outliers.
   */
  async getHomeroomAcademicSummary(
    actor: AuthContext,
    params: { classId: string; sectionId: string; academicYearId?: string },
  ) {
    const staffId = await this.teacherScopeService.resolveActiveStaffId(actor);
    if (!staffId) {
      throw new ForbiddenException('Active teacher profile is required');
    }

    const academicYearId =
      params.academicYearId ?? (await this.resolveCurrentAcademicYearId(actor));
    if (!academicYearId) {
      throw new ForbiddenException('No current academic year is configured');
    }

    // The single gate. Only a CLASS_TEACHER assignment for this exact section
    // satisfies it -- a Subject Teacher in the same section cannot reach this.
    await this.teacherScopeService.requireAccess(
      {
        tenantId: actor.tenantId,
        staffId,
        academicYearId,
        classId: params.classId,
        sectionId: params.sectionId,
        capability: TeacherCapability.HOMEROOM_ACADEMIC_SUMMARY_READ,
      },
      actor,
    );

    const students = await this.prisma.student.findMany({
      where: {
        tenantId: actor.tenantId,
        classId: params.classId,
        sectionId: params.sectionId,
        lifecycleStatus: 'ACTIVE',
      },
      select: {
        id: true,
        studentSystemId: true,
        firstNameEn: true,
        lastNameEn: true,
        rollNumber: true,
      },
      orderBy: [{ rollNumber: 'asc' }],
    });
    const studentIds = students.map((student) => student.id);

    const enabledModules = await this.moduleResolver.getEnabledModules(
      actor.tenantId,
    );
    const homeworkEnabled = enabledModules.has('homework');
    const examsEnabled = enabledModules.has('exams');
    const attendanceEnabled = enabledModules.has('attendance');
    const unavailableModules = this.moduleResolver.unavailableModules(
      enabledModules,
      ['homework', 'exams', 'attendance'],
    );

    const since = new Date();
    since.setDate(since.getDate() - ATTENDANCE_WINDOW_DAYS);

    const [subjects, markRows, homework, attendanceRows] = await Promise.all([
      examsEnabled
        ? this.prisma.subject.findMany({
            where: { tenantId: actor.tenantId, classId: params.classId },
            select: { id: true, name: true, code: true },
            orderBy: { name: 'asc' },
          })
        : Promise.resolve([] as SubjectSummary[]),
      examsEnabled && studentIds.length
        ? this.prisma.markEntry.groupBy({
            by: ['subjectId', 'status'],
            where: {
              tenantId: actor.tenantId,
              studentId: { in: studentIds },
              // Draft marks are excluded here, in the query -- not filtered
              // out afterwards.
              status: { in: CLASS_TEACHER_VISIBLE_MARK_STATUSES },
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      homeworkEnabled
        ? this.prisma.homeworkAssignment.findMany({
            where: {
              tenantId: actor.tenantId,
              classId: params.classId,
              OR: [{ sectionId: params.sectionId }, { sectionId: null }],
              // Only published homework: another teacher's unpublished draft is
              // not part of the homeroom picture.
              status: {
                in: [
                  HomeworkAssignmentStatus.ASSIGNED,
                  HomeworkAssignmentStatus.CLOSED,
                ],
              },
            },
            select: {
              id: true,
              title: true,
              dueDate: true,
              status: true,
              subjectId: true,
              subject: { select: { id: true, name: true } },
              assignedByStaffId: true,
              assignedByStaff: { select: { firstName: true, lastName: true } },
              _count: { select: { submissions: true } },
            },
            orderBy: { dueDate: 'desc' },
            take: 100,
          })
        : Promise.resolve([] as HomeworkSummaryRow[]),
      attendanceEnabled && studentIds.length
        ? this.prisma.attendanceRecord.groupBy({
            by: ['studentId', 'status'],
            where: {
              tenantId: actor.tenantId,
              studentId: { in: studentIds },
              attendanceSession: {
                tenantId: actor.tenantId,
                attendanceDate: { gte: since },
                submittedAt: { not: null },
              },
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);

    const marksBySubject = new Map<string, number>();
    for (const row of markRows) {
      marksBySubject.set(
        row.subjectId,
        (marksBySubject.get(row.subjectId) ?? 0) + row._count._all,
      );
    }

    const expectedPerSubject = students.length;
    const subjectCoverage = examsEnabled
      ? subjects.map((subject) => {
          const reported = marksBySubject.get(subject.id) ?? 0;
          return {
            subjectId: subject.id,
            subjectName: subject.name,
            subjectCode: subject.code,
            reportedMarkCount: reported,
            expectedStudentCount: expectedPerSubject,
            // "No marks reported yet" is a legitimate state early in a term, so
            // this is stated as coverage rather than as a fault.
            hasAnyReportedMarks: reported > 0,
          };
        })
      : null;

    const attendanceByStudent = new Map<
      string,
      { present: number; late: number; absent: number; marked: number }
    >();
    if (attendanceEnabled) {
      for (const row of attendanceRows) {
        const entry = attendanceByStudent.get(row.studentId) ?? {
          present: 0,
          late: 0,
          absent: 0,
          marked: 0,
        };
        const count = row._count._all;
        entry.marked += count;
        if (row.status === AttendanceStatus.PRESENT) entry.present += count;
        else if (row.status === AttendanceStatus.LATE) entry.late += count;
        else if (row.status === AttendanceStatus.ABSENT) entry.absent += count;
        attendanceByStudent.set(row.studentId, entry);
      }
    }

    const studentRows = students.map((student) => {
      const stats = attendanceEnabled
        ? attendanceByStudent.get(student.id)
        : undefined;
      const attendancePercent =
        stats && stats.marked > 0
          ? Math.round(((stats.present + stats.late) / stats.marked) * 1000) /
            10
          : null;
      return {
        studentId: student.id,
        studentSystemId: student.studentSystemId,
        fullNameEn: `${student.firstNameEn} ${student.lastNameEn}`.trim(),
        rollNumber: student.rollNumber,
        attendancePercent: attendanceEnabled ? attendancePercent : null,
        absencesInWindow: attendanceEnabled ? (stats?.absent ?? 0) : null,
        needsAttendanceFollowUp: attendanceEnabled
          ? attendancePercent !== null &&
            attendancePercent < LOW_ATTENDANCE_THRESHOLD
          : null,
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      academicYearId,
      classId: params.classId,
      sectionId: params.sectionId,
      studentCount: students.length,
      unavailableModules,
      // Every field below is read-only by construction. The Class Teacher
      // sees WHAT exists across subjects, never an edit affordance for a
      // record another teacher owns.
      subjectCoverage,
      subjectsWithNoMarks: subjectCoverage
        ? subjectCoverage
            .filter((subject) => !subject.hasAnyReportedMarks)
            .map((subject) => subject.subjectName)
        : null,
      homework: homeworkEnabled
        ? homework.map((item) => ({
            id: item.id,
            title: item.title,
            dueDate: item.dueDate,
            status: item.status,
            subjectId: item.subjectId,
            subjectName: item.subject?.name ?? null,
            // Named so the Class Teacher knows who to coordinate with, which is
            // the sanctioned action here -- not editing it themselves.
            setByStaffId: item.assignedByStaffId,
            setBy: item.assignedByStaff
              ? `${item.assignedByStaff.firstName} ${item.assignedByStaff.lastName}`.trim()
              : null,
            submissionCount: item._count.submissions,
            isMine: item.assignedByStaffId === staffId,
          }))
        : null,
      students: studentRows,
      studentsNeedingFollowUp: attendanceEnabled
        ? studentRows.filter((student) => student.needsAttendanceFollowUp)
            .length
        : null,
    };
  }

  private async resolveCurrentAcademicYearId(actor: AuthContext) {
    const year = await this.prisma.academicYear.findFirst({
      where: { tenantId: actor.tenantId, isCurrent: true },
      select: { id: true },
    });
    return year?.id ?? null;
  }
}
