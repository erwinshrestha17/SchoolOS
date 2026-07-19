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

export const teacherWorkspaceApi = {
  getTeacherToday: (date?: string) =>
    request<TeacherTodaySummary>(withQuery('/teacher-workspace/today', { date })),
};
