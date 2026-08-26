import { request, withQuery } from './client';

export interface TeacherTodayPeriod {
  id: string;
  academicYearId: string;
  classId: string;
  sectionId: string | null;
  className: string;
  subjectName: string;
  startsAt: string;
  endsAt: string;
  coverageStatus?: 'SCHEDULED' | 'SUBSTITUTING' | 'COVERED';
}

export interface TeacherTodayAssignedClass {
  id: string;
  academicYearId: string;
  academicYearName: string;
  classId: string;
  sectionId: string | null;
  name: string;
  subject: string;
  attendance: {
    submittedAt: string | null;
    lockAt: string | null;
    isSubmitted: boolean;
    isLocked: boolean;
    conflictStatus: string;
  };
}

export interface TeacherTodaySubstitution {
  id: string;
  date: string;
  status: string;
  reason: string | null;
  role: 'SUBSTITUTE' | 'ABSENT_TEACHER';
  className: string;
  sectionName: string | null;
  subjectName: string;
  startsAt: string;
  endsAt: string;
  room: string | null;
  absentTeacherName: string | null;
  substituteTeacherName: string | null;
}

export interface TeacherTodayMarksDeadline {
  examTermId: string;
  examTermName: string;
  endsOn: string;
}

export interface TeacherTodaySummary {
  generatedAt: string;
  date: string;
  currentPeriod: TeacherTodayPeriod | null;
  nextPeriod: TeacherTodayPeriod | null;
  todaysPeriods: TeacherTodayPeriod[];
  assignedClasses: TeacherTodayAssignedClass[];
  pendingAttendanceCount: number;
  homework: {
    givenToday: number;
    dueToday: number;
    awaitingReviewCount: number;
  } | null;
  substitutions: TeacherTodaySubstitution[] | null;
  marksDeadlines: TeacherTodayMarksDeadline[] | null;
  unavailableModules?: string[];
}

/**
 * One period on the teacher's own schedule. There is deliberately no teacher,
 * class or room selector on this contract: the backend resolves the caller's
 * Staff row and returns only slots they teach (P0.5).
 */
export interface TeacherScheduleSlot {
  id: string;
  date: string;
  dayOfWeek: number;
  academicYearId: string;
  classId: string;
  sectionId: string | null;
  subjectId: string;
  className: string;
  sectionName: string | null;
  subjectName: string;
  room: string | null;
  startsAt: string;
  endsAt: string;
  status: 'SCHEDULED' | 'SUBSTITUTED' | 'CHANGED';
  substitution: TeacherTodaySubstitution | null;
}

export interface TeacherSchedule {
  range: { startsOn: string; endsOn: string };
  items: TeacherScheduleSlot[];
  substitutions: TeacherTodaySubstitution[];
}

/**
 * One entry in the teacher's own assignment context. Subject assignments
 * carry academic write access; homerooms carry cross-subject read plus
 * homeroom-record write.
 */
export interface TeacherAssignmentContextEntry {
  assignmentId: string;
  assignmentType:
    | 'CLASS_TEACHER'
    | 'SUBJECT_TEACHER'
    | 'ASSISTANT_TEACHER'
    | 'SUBSTITUTE_TEACHER'
    | 'EXAM_INVIGILATOR'
    | 'COORDINATOR';
  academicYearId: string;
  classId: string;
  className: string;
  sectionId: string;
  sectionName: string | null;
  subjectId: string | null;
  subjectName: string | null;
  isPrimary: boolean;
  effectiveFrom: string;
  effectiveUntil: string | null;
  /** True for a time-bounded substitution. */
  isTemporary: boolean;
}

export interface TeacherAssignmentContext {
  hasAnyAssignment: boolean;
  subjectAssignments: TeacherAssignmentContextEntry[];
  homerooms: TeacherAssignmentContextEntry[];
}

export interface HomeroomSummarySubjectCoverage {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  reportedMarkCount: number;
  expectedStudentCount: number;
  hasAnyReportedMarks: boolean;
}

export interface HomeroomAcademicSummary {
  generatedAt: string;
  academicYearId: string;
  classId: string;
  sectionId: string;
  studentCount: number;
  unavailableModules?: string[];
  subjectCoverage: HomeroomSummarySubjectCoverage[] | null;
  subjectsWithNoMarks: string[] | null;
  homework: Array<{
    id: string;
    title: string;
    dueDate: string;
    status: string;
    subjectId: string;
    subjectName: string | null;
    setByStaffId: string | null;
    setBy: string | null;
    submissionCount: number;
    /** Only homework the caller authored is theirs to edit. */
    isMine: boolean;
  }> | null;
  students: Array<{
    studentId: string;
    studentSystemId: string;
    fullNameEn: string;
    rollNumber: number | null;
    attendancePercent: number | null;
    absencesInWindow: number | null;
    needsAttendanceFollowUp: boolean | null;
  }>;
  studentsNeedingFollowUp: number | null;
}

export interface TeacherHomeroom {
  assignmentId: string;
  academicYearId: string;
  classId: string;
  sectionId: string;
  className: string;
  sectionName: string | null;
  studentCount: number;
}

export const teacherWorkspaceApi = {
  getTeacherToday: (date?: string) =>
    request<TeacherTodaySummary>(withQuery('/teacher-workspace/today', { date })),
  getMyAssignmentContext: () =>
    request<TeacherAssignmentContext>('/teacher-workspace/assignments'),
  getMyHomerooms: () =>
    request<TeacherHomeroom[]>('/teacher-workspace/homeroom'),
  getHomeroomAcademicSummary: (params: {
    classId: string;
    sectionId: string;
    academicYearId?: string;
  }) =>
    request<HomeroomAcademicSummary>(
      withQuery('/teacher-workspace/homeroom/academic-summary', params),
    ),
  getTeacherSchedule: (params: {
    date?: string;
    weekStart?: string;
    days?: number;
  } = {}) =>
    request<TeacherSchedule>(
      withQuery('/teacher-workspace/schedule', {
        date: params.date,
        weekStart: params.weekStart,
        days: params.days,
      }),
    ),
};
