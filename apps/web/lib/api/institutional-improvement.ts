import type {
  BoardExamReadiness,
  BoardReadinessTrack,
  InstitutionalImprovementPage,
  SchoolImprovementActionRecord,
  SchoolImprovementActionStatus,
  SchoolImprovementPlanRecord,
  SchoolImprovementPlanStatus,
  TeacherDevelopmentGoalRecord,
  TeacherDevelopmentGoalStatus,
  TeacherDevelopmentOverview,
  TeacherObservationRecord,
  TeacherObservationStatus,
  TeacherTrainingRecord,
  TeacherTrainingStatus,
} from '@schoolos/core';
import { type JsonBody, request, withQuery } from './client';

type PageFilters = {
  academicYearId?: string;
  teacherStaffId?: string;
  page?: number;
  limit?: number;
};

const json = <T extends object>(body: T) => body as JsonBody;

export const institutionalImprovementApi = {
  getTeacherDevelopmentOverview: (params?: PageFilters) =>
    request<TeacherDevelopmentOverview>(
      withQuery(
        '/institutional-improvement/teacher-development/overview',
        params ?? {},
      ),
    ),
  listTeacherObservations: (
    params?: PageFilters & { status?: TeacherObservationStatus },
  ) =>
    request<InstitutionalImprovementPage<TeacherObservationRecord>>(
      withQuery(
        '/institutional-improvement/teacher-development/observations',
        params ?? {},
      ),
    ),
  createTeacherObservation: (body: {
    teacherStaffId: string;
    academicYearId: string;
    classId?: string;
    sectionId?: string;
    subjectId?: string;
    timetableSlotId?: string;
    observedOn: string;
    strengths: string;
    developmentFocus: string;
    agreedAction?: string;
    followUpOn?: string;
    clientRequestId: string;
  }) =>
    request<TeacherObservationRecord>(
      '/institutional-improvement/teacher-development/observations',
      { method: 'POST', json: json(body) },
    ),
  updateTeacherObservation: (
    observationId: string,
    body: {
      expectedVersion: number;
      status: TeacherObservationStatus;
      reason: string;
      agreedAction?: string;
      teacherResponse?: string;
      followUpOn?: string;
    },
  ) =>
    request<TeacherObservationRecord>(
      `/institutional-improvement/teacher-development/observations/${encodeURIComponent(observationId)}`,
      { method: 'PATCH', json: json(body) },
    ),
  listTeacherDevelopmentGoals: (
    params?: PageFilters & { status?: TeacherDevelopmentGoalStatus },
  ) =>
    request<InstitutionalImprovementPage<TeacherDevelopmentGoalRecord>>(
      withQuery(
        '/institutional-improvement/teacher-development/goals',
        params ?? {},
      ),
    ),
  createTeacherDevelopmentGoal: (body: {
    teacherStaffId: string;
    mentorStaffId?: string;
    academicYearId: string;
    title: string;
    baseline: string;
    target: string;
    actionPlan: string;
    startsOn: string;
    dueOn: string;
    clientRequestId: string;
  }) =>
    request<TeacherDevelopmentGoalRecord>(
      '/institutional-improvement/teacher-development/goals',
      { method: 'POST', json: json(body) },
    ),
  updateTeacherDevelopmentGoal: (
    goalId: string,
    body: {
      expectedVersion: number;
      status: TeacherDevelopmentGoalStatus;
      reason: string;
      mentorStaffId?: string;
      progressNote?: string;
    },
  ) =>
    request<TeacherDevelopmentGoalRecord>(
      `/institutional-improvement/teacher-development/goals/${encodeURIComponent(goalId)}`,
      { method: 'PATCH', json: json(body) },
    ),
  listTeacherTraining: (
    params?: PageFilters & { status?: TeacherTrainingStatus },
  ) =>
    request<InstitutionalImprovementPage<TeacherTrainingRecord>>(
      withQuery(
        '/institutional-improvement/teacher-development/training',
        params ?? {},
      ),
    ),
  createTeacherTraining: (body: {
    teacherStaffId: string;
    title: string;
    providerName?: string;
    startsOn: string;
    endsOn?: string;
    status: TeacherTrainingStatus;
    learningSummary?: string;
    certificateFileAssetId?: string;
    clientRequestId: string;
  }) =>
    request<TeacherTrainingRecord>(
      '/institutional-improvement/teacher-development/training',
      { method: 'POST', json: json(body) },
    ),
  listSchoolImprovementPlans: (params?: {
    academicYearId?: string;
    status?: SchoolImprovementPlanStatus;
    page?: number;
    limit?: number;
  }) =>
    request<InstitutionalImprovementPage<SchoolImprovementPlanRecord>>(
      withQuery(
        '/institutional-improvement/school-improvement/plans',
        params ?? {},
      ),
    ),
  getSchoolImprovementPlan: (planId: string) =>
    request<SchoolImprovementPlanRecord>(
      `/institutional-improvement/school-improvement/plans/${encodeURIComponent(planId)}`,
    ),
  createSchoolImprovementPlan: (body: {
    academicYearId: string;
    ownerUserId: string;
    title: string;
    baselineSummary: string;
    targetSummary: string;
    startsOn: string;
    endsOn: string;
    kpis: Array<{
      ownerUserId: string;
      name: string;
      unit: string;
      baselineValue: number;
      targetValue: number;
      dueOn: string;
    }>;
    actions: Array<{
      ownerUserId: string;
      title: string;
      details: string;
      dueOn: string;
    }>;
    clientRequestId: string;
  }) =>
    request<SchoolImprovementPlanRecord>(
      '/institutional-improvement/school-improvement/plans',
      { method: 'POST', json: json(body) },
    ),
  updateSchoolImprovementPlan: (
    planId: string,
    body: {
      expectedVersion: number;
      status: SchoolImprovementPlanStatus;
      reason: string;
    },
  ) =>
    request<SchoolImprovementPlanRecord>(
      `/institutional-improvement/school-improvement/plans/${encodeURIComponent(planId)}`,
      { method: 'PATCH', json: json(body) },
    ),
  updateSchoolImprovementAction: (
    actionId: string,
    body: {
      expectedVersion: number;
      status: SchoolImprovementActionStatus;
      reason: string;
      progressNote?: string;
      evidenceFileAssetId?: string;
    },
  ) =>
    request<SchoolImprovementActionRecord>(
      `/institutional-improvement/school-improvement/actions/${encodeURIComponent(actionId)}`,
      { method: 'PATCH', json: json(body) },
    ),
  addSchoolImprovementReview: (
    planId: string,
    body: {
      reviewedOn: string;
      summary: string;
      nextActions: string;
      kpiSnapshot: Array<{ kpiId: string; value: number; note?: string }>;
      clientRequestId: string;
    },
  ) =>
    request(
      `/institutional-improvement/school-improvement/plans/${encodeURIComponent(planId)}/reviews`,
      { method: 'POST', json: json(body) },
    ),
  getBoardExamReadiness: (
    track: BoardReadinessTrack,
    academicYearId?: string,
  ) =>
    request<BoardExamReadiness>(
      withQuery('/institutional-improvement/board-exam-readiness', {
        track,
        academicYearId,
      }),
    ),
};
