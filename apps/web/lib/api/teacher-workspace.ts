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
  };
  substitutions: TeacherTodaySubstitution[];
  marksDeadlines: TeacherTodayMarksDeadline[];
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

export const teacherWorkspaceApi = {
  getTeacherToday: (date?: string) =>
    request<TeacherTodaySummary>(withQuery('/teacher-workspace/today', { date })),
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
