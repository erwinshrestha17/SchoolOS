import type {
  CurriculumProgressItemRecord,
  CurriculumProgressStatus,
  CurriculumProgressSummary,
  FormativeAssessmentEvidenceRecord,
  FormativeAssessmentKind,
  LearningImprovementPage,
  LearningMasteryStatus,
  LearningOutcomeDomain,
  LearningOutcomeRecord,
  ParentLearningGuidanceRecord,
  ParentLearningGuidanceStatus,
  RemedialGroupRecord,
  RemedialGroupStatus,
  StudentEarlyWarningResponse,
  StudentInterventionCaseRecord,
  StudentInterventionEntryType,
  StudentInterventionPriority,
  StudentInterventionStatus,
} from '@schoolos/core';
import { type JsonBody, request, withQuery } from './client';

export type LearningImprovementScope = {
  academicYearId?: string;
  classId?: string;
  sectionId?: string;
  subjectId?: string;
  studentId?: string;
  page?: number;
  limit?: number;
};

export type LearningOutcomeFilters = LearningImprovementScope & {
  domain?: LearningOutcomeDomain;
  isActive?: boolean;
};

export type FormativeAssessmentFilters = LearningImprovementScope & {
  outcomeId?: string;
  masteryStatus?: LearningMasteryStatus;
  from?: string;
  to?: string;
};

export type EarlyWarningFilters = LearningImprovementScope & {
  search?: string;
  interventionStatus?: StudentInterventionStatus;
};

export type InterventionFilters = LearningImprovementScope & {
  status?: StudentInterventionStatus;
  priority?: StudentInterventionPriority;
  ownerStaffId?: string;
};

export type RemedialGroupFilters = LearningImprovementScope & {
  status?: RemedialGroupStatus;
};

export type CurriculumProgressFilters = LearningImprovementScope & {
  status?: CurriculumProgressStatus;
  from?: string;
  to?: string;
};

export type ParentGuidanceFilters = LearningImprovementScope & {
  status?: ParentLearningGuidanceStatus;
};

export type CreateLearningOutcomePayload = {
  academicYearId: string;
  classId: string;
  subjectId: string;
  code: string;
  title: string;
  description?: string;
  domain: LearningOutcomeDomain;
};

export type CreateFormativeAssessmentPayload = {
  outcomeId: string;
  studentId: string;
  academicYearId: string;
  classId: string;
  sectionId?: string;
  subjectId: string;
  kind: FormativeAssessmentKind;
  masteryStatus: LearningMasteryStatus;
  score?: number;
  maxScore?: number;
  assessedOn: string;
  note?: string;
  observationChecklist?: Record<string, boolean>;
  parentSummary?: string;
  reassessmentOfId?: string;
  clientSubmissionId: string;
};

export type CreateStudentInterventionPayload = {
  studentId: string;
  academicYearId: string;
  ownerStaffId?: string;
  sourceSignalKey?: string;
  priority: StudentInterventionPriority;
  title: string;
  concernSummary: string;
  parentVisibleSummary?: string;
  nextFollowUpOn?: string;
  clientRequestId: string;
};

export type AddInterventionEntryPayload = {
  entryType: StudentInterventionEntryType;
  body: string;
  parentVisible: boolean;
  contactedAt?: string;
  nextFollowUpOn?: string;
  clientRequestId: string;
};

export type UpdateStudentInterventionPayload = {
  status: StudentInterventionStatus;
  ownerStaffId?: string;
  priority?: StudentInterventionPriority;
  nextFollowUpOn?: string;
  parentVisibleSummary?: string;
  resolutionSummary?: string;
  reason: string;
  expectedVersion: number;
};

export type CreateRemedialGroupPayload = {
  academicYearId: string;
  classId: string;
  sectionId?: string;
  subjectId: string;
  outcomeId?: string;
  name: string;
  purpose: string;
  startsOn: string;
  endsOn?: string;
  scheduleNote?: string;
  parentSummary?: string;
  clientRequestId: string;
};

export type CreateCurriculumProgressPayload = {
  academicYearId: string;
  classId: string;
  sectionId?: string;
  subjectId: string;
  outcomeId?: string;
  title: string;
  status: CurriculumProgressStatus;
  plannedOn: string;
  completedOn?: string;
  missedReason?: string;
  reteachPlan?: string;
  resourceUrl?: string;
  note?: string;
  clientRequestId: string;
};

export type UpdateCurriculumProgressPayload = {
  status: CurriculumProgressStatus;
  completedOn?: string;
  missedReason?: string;
  reteachPlan?: string;
  resourceUrl?: string;
  reason: string;
};

export type CreateParentGuidancePayload = {
  studentId: string;
  academicYearId: string;
  subjectId: string;
  outcomeId?: string;
  remedialGroupId?: string;
  title: string;
  skillExplanation: string;
  homeActivity: string;
  visibleFrom?: string;
  visibleUntil?: string;
  clientRequestId: string;
};

export type CurriculumProgressPage =
  LearningImprovementPage<CurriculumProgressItemRecord> & {
    summary: CurriculumProgressSummary;
  };

const json = <T extends object>(body: T) => body as JsonBody;

export const learningImprovementApi = {
  getLearningEarlyWarnings: (params?: EarlyWarningFilters) =>
    request<StudentEarlyWarningResponse>(
      withQuery('/learning-improvement/early-warning', params ?? {}),
    ),
  listLearningOutcomes: (params?: LearningOutcomeFilters) =>
    request<LearningImprovementPage<LearningOutcomeRecord>>(
      withQuery('/learning-improvement/outcomes', params ?? {}),
    ),
  createLearningOutcome: (body: CreateLearningOutcomePayload) =>
    request<LearningOutcomeRecord>('/learning-improvement/outcomes', {
      method: 'POST',
      json: json(body),
    }),
  setLearningOutcomeState: (outcomeId: string, isActive: boolean) =>
    request<LearningOutcomeRecord>(
      `/learning-improvement/outcomes/${encodeURIComponent(outcomeId)}/state`,
      { method: 'PATCH', json: { isActive } },
    ),
  listFormativeAssessments: (params?: FormativeAssessmentFilters) =>
    request<LearningImprovementPage<FormativeAssessmentEvidenceRecord>>(
      withQuery('/learning-improvement/formative-assessments', params ?? {}),
    ),
  createFormativeAssessment: (body: CreateFormativeAssessmentPayload) =>
    request<FormativeAssessmentEvidenceRecord>(
      '/learning-improvement/formative-assessments',
      { method: 'POST', json: json(body) },
    ),
  listStudentInterventions: (params?: InterventionFilters) =>
    request<LearningImprovementPage<StudentInterventionCaseRecord>>(
      withQuery('/learning-improvement/interventions', params ?? {}),
    ),
  getStudentIntervention: (caseId: string) =>
    request<StudentInterventionCaseRecord>(
      `/learning-improvement/interventions/${encodeURIComponent(caseId)}`,
    ),
  createStudentIntervention: (body: CreateStudentInterventionPayload) =>
    request<StudentInterventionCaseRecord>(
      '/learning-improvement/interventions',
      { method: 'POST', json: json(body) },
    ),
  addStudentInterventionEntry: (
    caseId: string,
    body: AddInterventionEntryPayload,
  ) =>
    request<StudentInterventionCaseRecord>(
      `/learning-improvement/interventions/${encodeURIComponent(caseId)}/entries`,
      { method: 'POST', json: json(body) },
    ),
  updateStudentIntervention: (
    caseId: string,
    body: UpdateStudentInterventionPayload,
  ) =>
    request<StudentInterventionCaseRecord>(
      `/learning-improvement/interventions/${encodeURIComponent(caseId)}`,
      { method: 'PATCH', json: json(body) },
    ),
  listRemedialGroups: (params?: RemedialGroupFilters) =>
    request<LearningImprovementPage<RemedialGroupRecord>>(
      withQuery('/learning-improvement/remedial-groups', params ?? {}),
    ),
  createRemedialGroup: (body: CreateRemedialGroupPayload) =>
    request<RemedialGroupRecord>('/learning-improvement/remedial-groups', {
      method: 'POST',
      json: json(body),
    }),
  addRemedialGroupMembers: (groupId: string, studentIds: string[]) =>
    request<RemedialGroupRecord>(
      `/learning-improvement/remedial-groups/${encodeURIComponent(groupId)}/members`,
      { method: 'POST', json: { studentIds } },
    ),
  updateRemedialGroupStatus: (
    groupId: string,
    status: RemedialGroupStatus,
    reason: string,
  ) =>
    request<RemedialGroupRecord>(
      `/learning-improvement/remedial-groups/${encodeURIComponent(groupId)}/status`,
      { method: 'PATCH', json: { status, reason } },
    ),
  listCurriculumProgress: (params?: CurriculumProgressFilters) =>
    request<CurriculumProgressPage>(
      withQuery('/learning-improvement/curriculum-progress', params ?? {}),
    ),
  createCurriculumProgress: (body: CreateCurriculumProgressPayload) =>
    request<CurriculumProgressItemRecord>(
      '/learning-improvement/curriculum-progress',
      { method: 'POST', json: json(body) },
    ),
  updateCurriculumProgress: (
    itemId: string,
    body: UpdateCurriculumProgressPayload,
  ) =>
    request<CurriculumProgressItemRecord>(
      `/learning-improvement/curriculum-progress/${encodeURIComponent(itemId)}`,
      { method: 'PATCH', json: json(body) },
    ),
  listParentLearningGuidance: (params?: ParentGuidanceFilters) =>
    request<LearningImprovementPage<ParentLearningGuidanceRecord>>(
      withQuery('/learning-improvement/parent-guidance', params ?? {}),
    ),
  createParentLearningGuidance: (body: CreateParentGuidancePayload) =>
    request<ParentLearningGuidanceRecord>(
      '/learning-improvement/parent-guidance',
      { method: 'POST', json: json(body) },
    ),
  updateParentLearningGuidanceStatus: (
    guidanceId: string,
    status: ParentLearningGuidanceStatus,
    reason: string,
  ) =>
    request<ParentLearningGuidanceRecord>(
      `/learning-improvement/parent-guidance/${encodeURIComponent(guidanceId)}/status`,
      { method: 'PATCH', json: { status, reason } },
    ),
};
