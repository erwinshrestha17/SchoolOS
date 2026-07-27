import { Injectable } from '@nestjs/common';
import { AttendanceStatus } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { AttendanceService } from '../attendance/attendance.service';
import { PrismaService } from '../prisma/prisma.service';

/** How far back the roster's attendance signal looks. */
const ATTENDANCE_WINDOW_DAYS = 30;
/** Below this, the roster flags the student for follow-up. */
const LOW_ATTENDANCE_THRESHOLD = 80;

export interface MyStudentsClassGroup {
  classId: string;
  sectionId: string | null;
  className: string;
  subject: string;
  students: Array<{
    id: string;
    studentSystemId: string;
    fullNameEn: string;
    rollNumber: number | null;
    // Redacted to a flag, not the raw medical text -- matches the same
    // privacy-scoping attendanceService.getRoster already applies (spec
    // B12: teachers get an approved safety alert, not full medical records).
    hasMedicalAlert: boolean;
    /**
     * Percentage over the last 30 marked school days, or null when nothing
     * has been marked yet. Null means "no data", never 0 -- an unmarked
     * roster must not read as perfect absence.
     */
    attendancePercent: number | null;
    /** Absences in the same window, so the teacher can see the raw count. */
    absencesInWindow: number;
    /** attendancePercent is known and below the follow-up threshold. */
    needsAttendanceFollowUp: boolean;
  }>;
}

/**
 * "My Students" (Teacher Persona spec M1 -- assigned-student projection
 * only). Deliberately does not query Student directly: every roster comes
 * from attendanceService.getRoster(), which already verifies the caller
 * holds an active Class Teacher or Subject Teacher assignment for that exact
 * class/section before returning anything (validateAttendanceScope). This
 * guarantees the same invariant as attendance/homework marking -- no active
 * assignment, no student data -- without re-implementing that check here.
 */
@Injectable()
export class TeacherStudentsService {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly prisma: PrismaService,
  ) {}

  async getMyStudents(actor: AuthContext): Promise<MyStudentsClassGroup[]> {
    const { items: assignedClasses } =
      await this.attendanceService.listTeacherMobileClassSections(actor);

    const since = new Date();
    since.setDate(since.getDate() - ATTENDANCE_WINDOW_DAYS);

    const groups = await Promise.all(
      assignedClasses.map(async (item) => {
        if (!item.sectionId) {
          return null;
        }
        const roster = await this.attendanceService.getRoster(
          actor,
          item.academicYearId,
          item.classId,
          item.sectionId,
        );

        // getRoster has already proven this caller is assigned to this exact
        // class/section, so the ids below are safe to aggregate over.
        const attendance = await this.summarizeRecentAttendance(
          actor,
          roster.students.map((student) => student.id),
          since,
        );

        return {
          classId: item.classId,
          sectionId: item.sectionId,
          className: item.name,
          subject: item.subject,
          students: roster.students.map((student) => {
            const stats = attendance.get(student.id);
            const marked = stats?.marked ?? 0;
            const attendancePercent =
              marked > 0
                ? Math.round(((stats!.present + stats!.late) / marked) * 1000) /
                  10
                : null;
            return {
              id: student.id,
              studentSystemId: student.studentSystemId,
              fullNameEn: student.fullNameEn,
              rollNumber: student.rollNumber,
              hasMedicalAlert: student.hasMedicalAlert,
              attendancePercent,
              absencesInWindow: stats?.absent ?? 0,
              needsAttendanceFollowUp:
                attendancePercent !== null &&
                attendancePercent < LOW_ATTENDANCE_THRESHOLD,
            };
          }),
        };
      }),
    );

    return groups.filter((group) => group !== null) as MyStudentsClassGroup[];
  }

  /**
   * One grouped aggregate for the whole section rather than a query per
   * student, so a 60-student roster stays a single round trip.
   */
  private async summarizeRecentAttendance(
    actor: AuthContext,
    studentIds: string[],
    since: Date,
  ) {
    const summary = new Map<
      string,
      { present: number; late: number; absent: number; marked: number }
    >();
    if (studentIds.length === 0) return summary;

    const rows = await this.prisma.attendanceRecord.groupBy({
      by: ['studentId', 'status'],
      where: {
        tenantId: actor.tenantId,
        studentId: { in: studentIds },
        attendanceSession: {
          tenantId: actor.tenantId,
          attendanceDate: { gte: since },
          // Drafts are not yet a fact about the student; only submitted
          // sessions count towards a percentage the teacher may act on.
          submittedAt: { not: null },
        },
      },
      _count: { _all: true },
    });

    for (const row of rows) {
      const entry = summary.get(row.studentId) ?? {
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
      summary.set(row.studentId, entry);
    }

    return summary;
  }
}
