import type {
  AcademicYearSummary,
  AssessmentComponentSummary,
  BatchPromotionResult,
  CasRecordSummary,
  ClassSummary,
  ExamTermSummary,
  HomeworkAssignmentSummary,
  HomeworkSubmissionSummary,
  MarkEntrySummary,
  PaginatedResponse,
  PromotionReadiness,
  PublishingResult,
  ReportCardSummary,
  ResultPublishingReadiness,
  RoomSummary,
  SectionSummary,
  SubjectSummary,
  SubjectWeeklyRequirementSummary,
  TeacherAssignmentSummary,
  TeacherAvailabilitySummary,
  TeacherWorkloadSummary,
  TimetablePeriodSummary,
  TimetableSlotSummary,
  TimetableSubstitutionSummary,
  TimetableValidationResult,
  TimetableVersionSummary,
} from '@schoolos/core';
import {
  CasListFilters,
  HomeworkAttachmentAccess,
  JsonBody,
  MarkLockFilters,
  MarkLockRequestSummary,
  API_BASE_URL,
  openProtectedFile,
  openPdfBlob,
  request,
  withQuery,
} from './client';

export type AcademicGradeScaleEntry = {
  grade: string;
  minPercentage: number;
  maxPercentage: number;
  gradePoint: number;
  label: string;
  passed: boolean;
};

export type AcademicGradingPolicy = {
  scale: AcademicGradeScaleEntry[];
  rounding: {
    percentageDecimals: number;
    gpaDecimals: number;
    marksDecimals: number;
    mode: 'HALF_UP' | 'FLOOR' | 'CEIL';
  };
};

export type HomeworkReminderBatchSummary = {
  id: string;
  homeworkId: string;
  reminderType: string;
  status: string;
  targetCount?: number | null;
  deliveryCount?: number | null;
  skippedCount?: number | null;
  failedReason?: string | null;
  createdAt?: string | null;
  completedAt?: string | null;
};

export type HomeworkCompletionReportRow = {
  id: string;
  title: string;
  class: string;
  section?: string | null;
  subject: string;
  dueDate: string;
  totalSubmissions: number;
  completed: number;
  completionRate: number;
};

export type HomeworkMissingLateReportRow = {
  submissionId: string;
  studentName: string;
  assignmentTitle: string;
  subject: string;
  class: string;
  section?: string | null;
  dueDate: string;
  status: string;
};

export const academicsApi = {
  listAcademicYears: () => request<AcademicYearSummary[]>('/academic-years'),
  createAcademicYear: (body: JsonBody) =>
    request<AcademicYearSummary>('/academic-years', {
      method: 'POST',
      json: body,
    }),
  listClasses: () => request<ClassSummary[]>('/classes'),
  createClass: (body: JsonBody) =>
    request<ClassSummary>('/classes', { method: 'POST', json: body }),
  listSections: () => request<SectionSummary[]>('/sections'),
  createSection: (body: JsonBody) =>
    request<SectionSummary>('/sections', { method: 'POST', json: body }),
  listSubjects: (params?: { classId?: string | null }) =>
    request<SubjectSummary[]>(withQuery('/subjects', params ?? {})),
  createSubject: (body: JsonBody) =>
    request<SubjectSummary>('/subjects', { method: 'POST', json: body }),
  listTeacherAssignments: () =>
    request<TeacherAssignmentSummary[]>('/teacher-assignments'),
  createTeacherAssignment: (body: JsonBody) =>
    request<TeacherAssignmentSummary>('/teacher-assignments', {
      method: 'POST',
      json: body,
    }),
  listExamTerms: () =>
    request<PaginatedResponse<ExamTermSummary> | ExamTermSummary[]>('/academics/exam-terms')
      .then((result) => (Array.isArray(result) ? result : result.items)),
  createExamTerm: (body: JsonBody) =>
    request<ExamTermSummary>('/academics/exam-terms', {
      method: 'POST',
      json: body,
    }),
  updateExamTerm: (id: string, body: JsonBody) =>
    request<ExamTermSummary>(
      `/academics/exam-terms/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        json: body,
      },
    ),
  deleteExamTerm: (id: string) =>
    request<{ deleted: true; examTermId: string }>(
      `/academics/exam-terms/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
    ),
  getGradingPolicy: () =>
    request<AcademicGradingPolicy>('/academics/grading-policy'),
  createAssessmentComponent: (body: JsonBody) =>
    request<AssessmentComponentSummary>('/academics/assessment-components', {
      method: 'POST',
      json: body,
    }),
  listMarks: (params?: {
    examTermId?: string | null;
    assessmentComponentId?: string | null;
    classId?: string | null;
    sectionId?: string | null;
    subjectId?: string | null;
  }) =>
    request<PaginatedResponse<MarkEntrySummary> | MarkEntrySummary[]>(
      withQuery('/academics/marks', params ?? {}),
    ).then((result) => (Array.isArray(result) ? result : result.items)),
  enterMark: (body: JsonBody) =>
    request<MarkEntrySummary>('/academics/marks', {
      method: 'POST',
      json: body,
    }),
  batchEnterMarks: (body: JsonBody) =>
    request<{ updated: number; entries: MarkEntrySummary[] }>(
      '/academics/marks/bulk-upsert',
      {
        method: 'POST',
        json: body,
      },
    ),
  listComponentsByExamTerm: (
    examTermId: string,
    params?: { subjectId?: string | null },
  ) =>
    request<
      | PaginatedResponse<AssessmentComponentSummary>
      | { items: AssessmentComponentSummary[] }
      | AssessmentComponentSummary[]
    >(
      withQuery('/academics/assessment-components', {
        ...(params ?? {}),
        examTermId,
      }),
    ).then((result) => (Array.isArray(result) ? result : result.items)),
  createCasRecord: (body: JsonBody) =>
    request<CasRecordSummary>('/academics/cas-records', {
      method: 'POST',
      json: body,
    }),
  listReportCards: (params?: {
    academicYearId?: string;
    examTermId?: string;
    classId?: string;
    sectionId?: string;
  }) =>
    request<ReportCardSummary[]>(
      withQuery('/academics/report-cards', params ?? {}),
    ),
  generateReportCard: (body: JsonBody) =>
    request<ReportCardSummary>('/academics/report-cards', {
      method: 'POST',
      json: body,
    }),
  batchGenerateReportCards: (body: JsonBody) =>
    request<BatchReportCardGenerationResult>(
      '/academics/report-cards/batch',
      {
        method: 'POST',
        json: body,
      },
    ),
  requestReportCardCorrection: (id: string, body: JsonBody) =>
    request<any>(
      `/academics/report-cards/${encodeURIComponent(id)}/corrections`,
      {
        method: 'POST',
        json: body,
      },
    ),
  regenerateReportCard: (id: string, body: JsonBody) =>
    request<ReportCardSummary>(
      `/academics/report-cards/${encodeURIComponent(id)}/regenerate`,
      {
        method: 'POST',
        json: body,
      },
    ),
  listReportCardHistory: (id: string) =>
    request<any>(`/academics/report-cards/${encodeURIComponent(id)}/history`),
  openReportCardPdf: async (id: string) => {
    const response = await fetch(
      `${API_BASE_URL}/academics/report-cards/${encodeURIComponent(id)}.pdf`,
      { credentials: 'include' },
    );

    await openPdfBlob(response);
  },
  listReportCardCorrections: (params?: { examTermId?: string; status?: string }) =>
    request<any[]>(withQuery('/academics/report-cards/corrections', params ?? {})),
  reviewReportCardCorrection: (id: string, body: { status: 'APPROVED' | 'REJECTED'; reviewNote?: string }) =>
    request<any>(
      `/academics/report-cards/corrections/${encodeURIComponent(id)}/review`,
      {
        method: 'PATCH',
        json: body,
      },
    ),
  listPromotionReadiness: (params: {
    academicYearId: string;
    classId?: string | null;
    sectionId?: string | null;
    status?: string | null;
  }) =>
    request<PromotionReadiness[]>(withQuery('/academics/promotions', params)),
  promoteStudent: (body: JsonBody) =>
    request<any>('/academics/promotions', {
      method: 'POST',
      json: body,
    }),
  batchPromote: (body: JsonBody) =>
    request<BatchPromotionResult>('/academics/promotions/batch', {
      method: 'POST',
      json: body,
    }),
  listResultPublishingReadiness: (params: {
    academicYearId?: string;
    examTermId?: string;
    classId?: string;
    sectionId?: string;
    status?: string;
  }) =>
    request<ResultPublishingReadiness[]>(
      withQuery('/academics/results/publishing', params),
    ),
  previewClassResults: (params: {
    examTermId: string;
    classId: string;
    sectionId?: string;
    includeCas?: boolean;
    page?: number;
    limit?: number;
  }) =>
    request<{
      items: Array<{
        student: {
          id: string;
          studentSystemId: string;
          name: string;
          className: string;
          sectionName: string | null;
          rollNumber: number | null;
        };
        summary: {
          totalObtained: number;
          totalFullMarks: number;
          percentage: number;
          gpa: number;
          grade: string;
          resultStatus: string;
          subjectCount: number;
          failedSubjectCount: number;
          incompleteSubjectCount: number;
          withheldSubjectCount: number;
        };
      }>;
      meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    }>(withQuery('/academics/results/preview', params)),
  publishResults: (body: JsonBody) =>
    request<PublishingResult>('/academics/results/publishing/publish', {
      method: 'POST',
      json: body,
    }),
  unpublishResults: (body: JsonBody) =>
    request<any>('/academics/results/publishing/unpublish', {
      method: 'POST',
      json: body,
    }),
  notifyResults: (body: JsonBody) =>
    request<any>('/academics/results/publishing/notify', {
      method: 'POST',
      json: body,
    }),
  listTimetable: (params?: { classId?: string | null }) =>
    request<TimetableSlotSummary[]>(withQuery('/timetable', params ?? {})),
  getTeacherTimetable: (
    teacherId: string,
    params?: { dayOfWeek?: number; academicYearId?: string },
  ) =>
    request<TimetableSlotSummary[]>(
      withQuery(
        `/timetable/reports/teacher/${encodeURIComponent(teacherId)}`,
        params ?? {},
      ),
    ),
  listTeacherWorkload: () =>
    request<TeacherWorkloadSummary[]>('/timetable/workload'),
  createTimetableSlot: (body: JsonBody) =>
    request<TimetableSlotSummary>('/timetable', { method: 'POST', json: body }),
  listTimetablePeriods: (params?: { academicYearId?: string }) =>
    request<TimetablePeriodSummary[]>(
      withQuery('/timetable/periods', params ?? {}),
    ),
  createTimetablePeriod: (body: JsonBody) =>
    request<TimetablePeriodSummary>('/timetable/periods', {
      method: 'POST',
      json: body,
    }),
  updateTimetablePeriod: (id: string, body: JsonBody) =>
    request<TimetablePeriodSummary>(
      `/timetable/periods/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        json: body,
      },
    ),
  deleteTimetablePeriod: (id: string) =>
    request<{ deleted: boolean; id: string }>(
      `/timetable/periods/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
    ),
  listRooms: () => request<RoomSummary[]>('/timetable/rooms'),
  createRoom: (body: JsonBody) =>
    request<RoomSummary>('/timetable/rooms', { method: 'POST', json: body }),
  updateRoom: (id: string, body: JsonBody) =>
    request<RoomSummary>(`/timetable/rooms/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      json: body,
    }),
  deleteRoom: (id: string) =>
    request<{ deleted: boolean; id: string }>(
      `/timetable/rooms/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
    ),
  listTimetableVersions: (params?: {
    academicYearId?: string;
    classId?: string;
    sectionId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) =>
    request<TimetableVersionSummary[]>(
      withQuery('/timetable/versions', params ?? {}),
    ),
  createTimetableVersion: (body: JsonBody) =>
    request<TimetableVersionSummary>('/timetable/versions', {
      method: 'POST',
      json: body,
    }),
  getTimetableVersion: (id: string) =>
    request<TimetableVersionSummary>(
      `/timetable/versions/${encodeURIComponent(id)}`,
    ),
  createTimetableVersionSlot: (versionId: string, body: JsonBody) =>
    request<TimetableSlotSummary>(
      `/timetable/versions/${encodeURIComponent(versionId)}/slots`,
      { method: 'POST', json: body },
    ),
  updateTimetableSlot: (id: string, body: JsonBody) =>
    request<TimetableSlotSummary>(
      `/timetable/slots/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        json: body,
      },
    ),
  deleteTimetableSlot: (id: string) =>
    request<{ deleted: boolean; id: string }>(
      `/timetable/slots/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
    ),
  validateTimetableVersion: (versionId: string) =>
    request<TimetableValidationResult>(
      `/timetable/versions/${encodeURIComponent(versionId)}/validate`,
      { method: 'POST', json: {} },
    ),
  publishTimetableVersion: (versionId: string) =>
    request<TimetableVersionSummary>(
      `/timetable/versions/${encodeURIComponent(versionId)}/publish`,
      { method: 'PATCH', json: {} },
    ),
  lockTimetableVersion: (versionId: string) =>
    request<TimetableVersionSummary>(
      `/timetable/versions/${encodeURIComponent(versionId)}/lock`,
      { method: 'PATCH', json: {} },
    ),
  archiveTimetableVersion: (versionId: string) =>
    request<TimetableVersionSummary>(
      `/timetable/versions/${encodeURIComponent(versionId)}/archive`,
      { method: 'PATCH', json: {} },
    ),
  reopenTimetableVersion: (versionId: string) =>
    request<TimetableVersionSummary>(
      `/timetable/versions/${encodeURIComponent(versionId)}/reopen-draft`,
      { method: 'PATCH', json: {} },
    ),
  listSubjectWeeklyRequirements: (params?: {
    academicYearId?: string;
    classId?: string;
    sectionId?: string;
    subjectId?: string;
  }) =>
    request<SubjectWeeklyRequirementSummary[]>(
      withQuery('/timetable/requirements', params ?? {}),
    ),
  createSubjectWeeklyRequirement: (body: JsonBody) =>
    request<SubjectWeeklyRequirementSummary>('/timetable/requirements', {
      method: 'POST',
      json: body,
    }),
  updateSubjectWeeklyRequirement: (id: string, body: JsonBody) =>
    request<SubjectWeeklyRequirementSummary>(
      `/timetable/requirements/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        json: body,
      },
    ),
  deleteSubjectWeeklyRequirement: (id: string) =>
    request<{ deleted: true; id: string }>(
      `/timetable/requirements/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
    ),
  listTeacherAvailability: (teacherId: string) =>
    request<TeacherAvailabilitySummary>(
      `/timetable/teachers/${encodeURIComponent(teacherId)}/availability`,
    ),
  createTeacherAvailability: (teacherId: string, body: JsonBody) =>
    request<TeacherAvailabilitySummary>(
      `/timetable/teachers/${encodeURIComponent(teacherId)}/availability`,
      { method: 'POST', json: body },
    ),
  getTeacherWorkload: (
    teacherId: string,
    params?: { academicYearId?: string; versionId?: string },
  ) =>
    request<unknown>(
      withQuery(
        `/timetable/teachers/${encodeURIComponent(teacherId)}/workload`,
        params ?? {},
      ),
    ),
  listSubstitutions: (params?: {
    date?: string;
    teacherId?: string;
    classId?: string;
    sectionId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) =>
    request<TimetableSubstitutionSummary[]>(
      withQuery('/timetable/substitutions', params ?? {}),
    ),
  getSubstitutionSummary: (params?: { date?: string }) =>
    request<any>(withQuery('/timetable/substitutions/summary', params ?? {})),
  createSubstitution: (body: JsonBody) =>
    request<TimetableSubstitutionSummary>('/timetable/substitutions', {
      method: 'POST',
      json: body,
    }),
  assignSubstitution: (id: string, body: JsonBody) =>
    request<TimetableSubstitutionSummary>(
      `/timetable/substitutions/${encodeURIComponent(id)}/assign`,
      { method: 'PATCH', json: body },
    ),
  cancelSubstitution: (id: string) =>
    request<TimetableSubstitutionSummary>(
      `/timetable/substitutions/${encodeURIComponent(id)}/cancel`,
      { method: 'PATCH', json: {} },
    ),
  completeSubstitution: (id: string) =>
    request<TimetableSubstitutionSummary>(
      `/timetable/substitutions/${encodeURIComponent(id)}/complete`,
      { method: 'PATCH', json: {} },
    ),
  listHomework: (params?: {
    studentId?: string;
    classId?: string;
    sectionId?: string;
    academicYearId?: string;
    subjectId?: string;
    teacherId?: string;
    status?: string;
  }) =>
    request<HomeworkAssignmentSummary[]>(withQuery('/homework', params ?? {})),
  listHomeworkTemplates: (params?: {
    classId?: string;
    subjectId?: string;
    search?: string;
    limit?: number;
  }) =>
    request<HomeworkAssignmentSummary[]>(
      withQuery('/homework/templates', params ?? {}),
    ),
  createHomework: (body: JsonBody) =>
    request<HomeworkAssignmentSummary>('/homework', {
      method: 'POST',
      json: body,
    }),
  getHomework: (id: string) =>
    request<HomeworkAssignmentSummary>(`/homework/${encodeURIComponent(id)}`),
  updateHomework: (id: string, body: JsonBody) =>
    request<HomeworkAssignmentSummary>(`/homework/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      json: body,
    }),
  publishHomework: (id: string) =>
    request<HomeworkAssignmentSummary>(
      `/homework/${encodeURIComponent(id)}/publish`,
      {
        method: 'PATCH',
        json: {},
      },
    ),
  assignHomework: (id: string) =>
    request<HomeworkAssignmentSummary>(
      `/homework/${encodeURIComponent(id)}/publish`,
      {
        method: 'PATCH',
        json: {},
      },
    ),
  closeHomework: (id: string) =>
    request<HomeworkAssignmentSummary>(
      `/homework/${encodeURIComponent(id)}/close`,
      {
        method: 'PATCH',
        json: {},
      },
    ),
  cancelHomework: (id: string) =>
    request<HomeworkAssignmentSummary>(
      `/homework/${encodeURIComponent(id)}/cancel`,
      {
        method: 'PATCH',
        json: {},
      },
    ),
  previewHomeworkReminders: (id: string) =>
    request<unknown>(`/homework/${encodeURIComponent(id)}/reminders/preview`),
  sendHomeworkReminders: (id: string) =>
    request<unknown>(`/homework/${encodeURIComponent(id)}/reminders/send`, {
      method: 'POST',
      json: {},
    }),
  listHomeworkReminderBatches: (params?: {
    homeworkId?: string;
    reminderType?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }) =>
    request<HomeworkReminderBatchSummary[]>(
      withQuery('/homework/reminders/batches', params ?? {}),
    ),
  retryHomeworkReminderBatch: (batchId: string) =>
    request<HomeworkReminderBatchSummary>(
      `/homework/reminders/batches/${encodeURIComponent(batchId)}/retry`,
      { method: 'POST', json: {} },
    ),
  getHomeworkCompletionReport: (params: {
    academicYearId: string;
    classId?: string;
    sectionId?: string;
  }) =>
    request<HomeworkCompletionReportRow[]>(
      withQuery('/homework/reports/completion', params),
    ),
  getHomeworkMissingLateReport: (params: {
    academicYearId: string;
    classId?: string;
  }) =>
    request<HomeworkMissingLateReportRow[]>(
      withQuery('/homework/reports/missing-late', params),
    ),
  getHomeworkAttachmentPreviewUrl: (attachmentId: string) =>
    request<HomeworkAttachmentAccess>(
      `/homework/attachments/${encodeURIComponent(attachmentId)}/preview-url`,
    ),
  getHomeworkAttachmentDownloadUrl: (attachmentId: string) =>
    request<HomeworkAttachmentAccess>(
      `/homework/attachments/${encodeURIComponent(attachmentId)}/download-url`,
    ),
  openHomeworkAttachmentPreview: async (attachmentId: string) => {
    const access = await request<HomeworkAttachmentAccess>(
      `/homework/attachments/${encodeURIComponent(attachmentId)}/preview-url`,
    );
    await openHomeworkAttachmentAccess(access);
  },
  openHomeworkAttachmentDownload: async (attachmentId: string) => {
    const access = await request<HomeworkAttachmentAccess>(
      `/homework/attachments/${encodeURIComponent(attachmentId)}/download-url`,
    );
    await openHomeworkAttachmentAccess(access);
  },
  listHomeworkSubmissions: () =>
    request<HomeworkSubmissionSummary[]>('/homework/submissions'),
  listHomeworkAssignmentSubmissions: (homeworkId: string) =>
    request<HomeworkSubmissionSummary[]>(
      `/homework/${encodeURIComponent(homeworkId)}/submissions`,
    ),
  reviewHomeworkSubmission: (body: JsonBody) =>
    request<HomeworkSubmissionSummary>('/homework/submissions', {
      method: 'POST',
      json: body,
    }),
  reviewHomeworkSubmissionById: (submissionId: string, body: JsonBody) =>
    request<HomeworkSubmissionSummary>(
      `/homework/submissions/${encodeURIComponent(submissionId)}/review`,
      { method: 'PATCH', json: body },
    ),
  requestHomeworkCorrection: (submissionId: string, body: JsonBody) =>
    request<HomeworkSubmissionSummary>(
      `/homework/submissions/${encodeURIComponent(submissionId)}/request-correction`,
      { method: 'PATCH', json: body },
    ),
  submitHomework: (body: { submissionId: string; content?: string }) =>
    request<HomeworkSubmissionSummary>('/homework/submit', {
      method: 'POST',
      json: body,
    }),
  listAssessmentComponents: (
    examTermId: string,
    params?: { subjectId?: string | null },
  ) =>
    request<
      | PaginatedResponse<AssessmentComponentSummary>
      | { items: AssessmentComponentSummary[] }
      | AssessmentComponentSummary[]
    >(
      withQuery('/academics/assessment-components', {
        ...(params ?? {}),
        examTermId,
      }),
    ).then((result) => (Array.isArray(result) ? result : result.items)),
  updateAssessmentComponent: (id: string, body: JsonBody) =>
    request<AssessmentComponentSummary>(
      `/academics/assessment-components/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        json: body,
      },
    ),
  deleteAssessmentComponent: (id: string) =>
    request<{ deleted: true; assessmentComponentId: string }>(
      `/academics/assessment-components/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
    ),

  // Academics - Mark Lock Requests
  listMarkLockRequests: (filters?: MarkLockFilters) =>
    request<
      | PaginatedResponse<MarkLockRequestSummary>
      | { items: MarkLockRequestSummary[] }
      | MarkLockRequestSummary[]
    >(
      withQuery('/academics/marks/lock-requests', filters ?? {}),
    ).then((result) => (Array.isArray(result) ? result : result.items)),
  createMarkLockRequest: (body: { examTermId: string; reason: string }) =>
    request<MarkLockRequestSummary>('/academics/marks/lock-requests', {
      method: 'POST',
      json: body,
    }),
  reviewMarkLockRequest: (
    id: string,
    body: { status: 'APPROVED' | 'REJECTED'; reviewNote?: string },
  ) =>
    request<MarkLockRequestSummary>(
      `/academics/marks/lock-requests/${encodeURIComponent(id)}/review`,
      {
        method: 'PATCH',
        json: body,
      },
    ),
  unlockExamTerm: (id: string, body: { reason?: string }) =>
    request<{
      examTermId: string;
      unlocked: true;
      request: MarkLockRequestSummary;
    }>(`/academics/exam-terms/${encodeURIComponent(id)}/unlock`, {
      method: 'PATCH',
      json: body,
    }),

  // Academics - CAS
  listCasRecords: (filters?: CasListFilters) =>
    request<
      | PaginatedResponse<CasRecordSummary>
      | { items: CasRecordSummary[] }
      | CasRecordSummary[]
    >(withQuery('/academics/cas-records', filters ?? {})).then((result) =>
      Array.isArray(result) ? result : result.items,
    ),
  updateCasRecord: (id: string, body: JsonBody) =>
    request<CasRecordSummary>(
      `/academics/cas-records/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        json: body,
      },
    ),
  deleteCasRecord: (id: string) =>
    request<{ deleted: true; casRecordId: string }>(
      `/academics/cas-records/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
  batchCreateCasRecords: (body: JsonBody) =>
    request<{ count: number; items: CasRecordSummary[] }>(
      '/academics/cas-records/bulk-upsert',
      {
        method: 'POST',
        json: body,
      },
    ),

  // Communications - Deliveries
};

async function openHomeworkAttachmentAccess(access: HomeworkAttachmentAccess) {
  if (!access.fileAssetId || access.expiresInSeconds <= 0) {
    throw new Error('The homework attachment link is not available.');
  }

  await openProtectedFile(access.fileAssetId, { fileName: access.fileName });
}

export type BatchReportCardGenerationResult = {
  queued: boolean;
  jobId?: string | number;
  generated: number;
  reports: ReportCardSummary[];
};
