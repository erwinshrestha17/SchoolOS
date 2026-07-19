import { Injectable } from '@nestjs/common';
import type { AuthContext } from '../auth/auth.types';
import { AttendanceService } from '../attendance/attendance.service';

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
  constructor(private readonly attendanceService: AttendanceService) {}

  async getMyStudents(actor: AuthContext): Promise<MyStudentsClassGroup[]> {
    const { items: assignedClasses } =
      await this.attendanceService.listTeacherMobileClassSections(actor);

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
        return {
          classId: item.classId,
          sectionId: item.sectionId,
          className: item.name,
          subject: item.subject,
          students: roster.students.map((student) => ({
            id: student.id,
            studentSystemId: student.studentSystemId,
            fullNameEn: student.fullNameEn,
            rollNumber: student.rollNumber,
            hasMedicalAlert: student.hasMedicalAlert,
          })),
        };
      }),
    );

    return groups.filter((group) => group !== null) as MyStudentsClassGroup[];
  }
}
