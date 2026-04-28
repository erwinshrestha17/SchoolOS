import type {
  AcademicYearSummary,
  AdmissionCreationResult,
  AdmissionDuplicateCheckResult,
  AdmissionSummary,
  AccountingPeriodSummary,
  AccountingReport,
  ActivityPost,
  ActivityReaction,
  AssessmentComponentSummary,
  AttendanceAnalytics,
  AttendanceConflict,
  AttendanceOperationalSummary,
  AttendanceRoster,
  AttendanceSyncSubmission,
  AuthSession,
  BulkAdmissionImportResult,
  CasRecordSummary,
  ClassSummary,
  ConsentRecord,
  ConversationSummary,
  DefaulterReminderResult,
  DefaulterSummary,
  DiscountRule,
  DevelopmentalMilestone,
  EventSummary,
  ExamTermSummary,
  FeeBillingRun,
  FeeHeadSummary,
  FeePlanSummary,
  GuardianConsentStatus,
  HomeworkAssignmentSummary,
  HomeworkSubmissionSummary,
  InvoiceSummary,
  JournalEntryView,
  MarkEntrySummary,
  MessageReadReceiptSummary,
  MessageSummary,
  MoodLog,
  NotificationDelivery,
  NoticeSummary,
  PayrollRunSummary,
  PayslipSummary,
  PromotionReadiness,
  PromotionResult,
  ReceiptView,
  ReportCardSummary,
  RoleSummary,
  SectionSummary,
  StaffSummary,
  StaffContractSummary,
  StudentProfile,
  SubjectSummary,
  TeacherAssignmentSummary,
  TeacherWorkloadSummary,
  TimetableSlotSummary,
  WaiverRecord,
} from '@schoolos/core';
import { clearStoredSession, readStoredSession } from './session';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

type JsonBody = Record<string, unknown>;

export type AuthChallengeResponse = {
  requiresMfa: true;
  challengeToken: string;
  challengeExpiresAt: string;
  delivery: string;
};

type RequestOptions = RequestInit & {
  auth?: boolean;
  json?: JsonBody;
};

function getAccessToken() {
  return readStoredSession()?.accessToken;
}

async function request<T>(path: string, init?: RequestOptions) {
  const accessToken = init?.auth === false ? null : getAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : {}),
      ...(init?.headers ?? {}),
    },
    body: init?.json ? JSON.stringify(init.json) : init?.body,
  });

  if (!response.ok) {
    const text = await response.text();

    if (response.status === 401 && init?.auth !== false) {
      clearStoredSession();
    }

    throw new Error(text || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

function withQuery(path: string, params: Record<string, string | undefined | null>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `${path}?${queryString}` : path;
}

export function isAuthSession(
  value: AuthSession | AuthChallengeResponse,
): value is AuthSession {
  return 'accessToken' in value;
}

export const api = {
  login: (body: JsonBody) =>
    request<AuthSession | AuthChallengeResponse>('/auth/login', {
      method: 'POST',
      json: body,
      auth: false,
    }),
  refreshSession: () =>
    request<AuthSession>('/auth/refresh', {
      method: 'POST',
      json: {},
      auth: false,
    }),
  logout: () =>
    request<{ success: true }>('/auth/logout', {
      method: 'POST',
      json: {},
      auth: false,
    }),
  getProfile: () => request('/auth/me'),
  registerTenant: (body: JsonBody) =>
    request('/tenants/register', { method: 'POST', json: body, auth: false }),
  listAcademicYears: () => request<AcademicYearSummary[]>('/academic-years'),
  createAcademicYear: (body: JsonBody) =>
    request<AcademicYearSummary>('/academic-years', { method: 'POST', json: body }),
  listClasses: () => request<ClassSummary[]>('/classes'),
  createClass: (body: JsonBody) =>
    request<ClassSummary>('/classes', { method: 'POST', json: body }),
  listSections: () => request<SectionSummary[]>('/sections'),
  createSection: (body: JsonBody) =>
    request<SectionSummary>('/sections', { method: 'POST', json: body }),
  listStudents: () => request<StudentProfile[]>('/students'),
  listStaff: () => request<StaffSummary[]>('/staff'),
  createStaff: (body: JsonBody) =>
    request<StaffSummary>('/staff', { method: 'POST', json: body }),
  listRoles: () => request<RoleSummary[]>('/roles'),
  listSubjects: () => request<SubjectSummary[]>('/subjects'),
  createSubject: (body: JsonBody) =>
    request<SubjectSummary>('/subjects', { method: 'POST', json: body }),
  listTeacherAssignments: () =>
    request<TeacherAssignmentSummary[]>('/teacher-assignments'),
  createTeacherAssignment: (body: JsonBody) =>
    request<TeacherAssignmentSummary>('/teacher-assignments', {
      method: 'POST',
      json: body,
    }),
  listExamTerms: () => request<ExamTermSummary[]>('/academics/exams'),
  createExamTerm: (body: JsonBody) =>
    request<ExamTermSummary>('/academics/exams', { method: 'POST', json: body }),
  createAssessmentComponent: (body: JsonBody) =>
    request<AssessmentComponentSummary>('/academics/exams/components', {
      method: 'POST',
      json: body,
    }),
  listMarks: () => request<MarkEntrySummary[]>('/academics/marks'),
  enterMark: (body: JsonBody) =>
    request<MarkEntrySummary>('/academics/marks', { method: 'POST', json: body }),
  listCasRecords: () => request<CasRecordSummary[]>('/academics/cas'),
  createCasRecord: (body: JsonBody) =>
    request<CasRecordSummary>('/academics/cas', { method: 'POST', json: body }),
  listReportCards: () => request<ReportCardSummary[]>('/academics/report-cards'),
  generateReportCard: (body: JsonBody) =>
    request('/academics/report-cards', { method: 'POST', json: body }),
  listPromotionReadiness: (params?: {
    academicYearId?: string | null;
    classId?: string | null;
  }) => request<PromotionReadiness[]>(withQuery('/academics/promotions', params ?? {})),
  promoteStudent: (body: JsonBody) =>
    request<PromotionResult>('/academics/promotions', {
      method: 'POST',
      json: body,
    }),
  listAdmissions: () => request<AdmissionSummary[]>('/admissions'),
  createAdmission: (body: JsonBody) =>
    request<AdmissionCreationResult>('/admissions', { method: 'POST', json: body }),
  checkAdmissionDuplicates: (body: JsonBody) =>
    request<AdmissionDuplicateCheckResult>('/admissions/duplicates', {
      method: 'POST',
      json: body,
    }),
  bulkImportAdmissions: (body: JsonBody) =>
    request<BulkAdmissionImportResult>('/admissions/bulk-import', {
      method: 'POST',
      json: body,
    }),
  listStudentDocuments: (studentId: string) =>
    request(withQuery('/student-documents', { studentId })),
  openStudentDocumentPdf: async (studentId: string, kind: string) => {
    const accessToken = getAccessToken();
    const response = await fetch(
      `${API_BASE_URL}/students/${encodeURIComponent(studentId)}/documents/${encodeURIComponent(kind)}.pdf`,
      {
        credentials: 'include',
        headers: accessToken
          ? {
              Authorization: `Bearer ${accessToken}`,
            }
          : undefined,
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Request failed with status ${response.status}`);
    }

    const blob = await response.blob();
    window.open(URL.createObjectURL(blob), '_blank', 'noopener,noreferrer');
  },
  getAttendanceRoster: (params: {
    academicYearId: string;
    classId: string;
    sectionId?: string | null;
    attendanceDate?: string | null;
  }) => request<AttendanceRoster>(withQuery('/attendance/rosters', params)),
  listAttendanceAnalytics: () =>
    request<AttendanceAnalytics>('/attendance/analytics'),
  getAttendanceSummary: (params: {
    academicYearId: string;
    classId: string;
    sectionId?: string | null;
    attendanceDate?: string | null;
    studentId?: string | null;
    month?: number | null;
    year?: number | null;
  }) =>
    request<AttendanceOperationalSummary>(
      withQuery('/attendance/summary', {
        ...params,
        month: params.month ? String(params.month) : null,
        year: params.year ? String(params.year) : null,
      }),
    ),
  listAttendanceConflicts: () =>
    request<AttendanceConflict[]>('/attendance/conflicts'),
  submitAttendance: (body: JsonBody) =>
    request('/attendance/sessions', { method: 'POST', json: body }),
  syncAttendance: (body: JsonBody) =>
    request<AttendanceSyncSubmission>('/attendance/sync', {
      method: 'POST',
      json: body,
    }),
  reviewAttendanceConflict: (id: string, body: JsonBody) =>
    request<AttendanceConflict>(`/attendance/conflicts/${id}/review`, {
      method: 'PATCH',
      json: body,
    }),
  listFeeHeads: () => request<FeeHeadSummary[]>('/fees/heads'),
  listFeePlans: () => request<FeePlanSummary[]>('/fees/plans'),
  listInvoices: () => request<InvoiceSummary[]>('/fees/invoices'),
  listBillingRuns: () => request<FeeBillingRun[]>('/fees/billing-runs'),
  generateBillingRun: (body: JsonBody) =>
    request('/fees/billing-runs', { method: 'POST', json: body }),
  listDefaulters: (params?: { classId?: string | null; feeHeadId?: string | null }) =>
    request<DefaulterSummary[]>(withQuery('/fees/defaulters', params ?? {})),
  sendDefaulterReminders: (body: JsonBody) =>
    request<DefaulterReminderResult>('/fees/defaulters/reminders', {
      method: 'POST',
      json: body,
    }),
  listDiscounts: () => request<DiscountRule[]>('/fees/discounts'),
  listWaivers: () => request<WaiverRecord[]>('/fees/waivers'),
  createDiscount: (body: JsonBody) =>
    request<DiscountRule>('/fees/discounts', { method: 'POST', json: body }),
  createWaiver: (body: JsonBody) =>
    request<WaiverRecord>('/fees/waivers', { method: 'POST', json: body }),
  createFeeHead: (body: JsonBody) =>
    request('/fees/heads', { method: 'POST', json: body }),
  createFeePlan: (body: JsonBody) =>
    request('/fees/plans', { method: 'POST', json: body }),
  collectPayment: (body: JsonBody) =>
    request('/payments', { method: 'POST', json: body }),
  listReceipts: () => request<ReceiptView[]>('/receipts'),
  openReceiptPdf: async (receiptNumber: string) => {
    const accessToken = getAccessToken();
    const response = await fetch(
      `${API_BASE_URL}/receipts/${encodeURIComponent(receiptNumber)}.pdf`,
      {
        credentials: 'include',
        headers: accessToken
          ? {
              Authorization: `Bearer ${accessToken}`,
            }
          : undefined,
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Request failed with status ${response.status}`);
    }

    const blob = await response.blob();
    window.open(URL.createObjectURL(blob), '_blank', 'noopener,noreferrer');
  },
  listLedgerEntries: () => request<JournalEntryView[]>('/ledger/entries'),
  listTimetable: () => request<TimetableSlotSummary[]>('/timetable'),
  listTeacherWorkload: () =>
    request<TeacherWorkloadSummary[]>('/timetable/workload'),
  createTimetableSlot: (body: JsonBody) =>
    request<TimetableSlotSummary>('/timetable', { method: 'POST', json: body }),
  listHomework: () => request<HomeworkAssignmentSummary[]>('/homework'),
  createHomework: (body: JsonBody) =>
    request<HomeworkAssignmentSummary>('/homework', {
      method: 'POST',
      json: body,
    }),
  listHomeworkSubmissions: () =>
    request<HomeworkSubmissionSummary[]>('/homework/submissions'),
  reviewHomeworkSubmission: (body: JsonBody) =>
    request<HomeworkSubmissionSummary>('/homework/submissions', {
      method: 'POST',
      json: body,
    }),
  listStaffContracts: () => request<StaffContractSummary[]>('/hr/contracts'),
  createStaffContract: (body: JsonBody) =>
    request<StaffContractSummary>('/hr/contracts', { method: 'POST', json: body }),
  listPayrollRuns: () => request<PayrollRunSummary[]>('/payroll/runs'),
  createPayrollRun: (body: JsonBody) =>
    request<PayrollRunSummary>('/payroll/runs', { method: 'POST', json: body }),
  reviewPayrollRun: (id: string) =>
    request<PayrollRunSummary>(`/payroll/runs/${id}/review`, {
      method: 'POST',
      json: {},
    }),
  approvePayrollRun: (id: string) =>
    request<PayrollRunSummary>(`/payroll/runs/${id}/approve`, {
      method: 'POST',
      json: {},
    }),
  postPayrollRun: (id: string) =>
    request<PayrollRunSummary>(`/payroll/runs/${id}/post`, {
      method: 'POST',
      json: {},
    }),
  listPayslips: () => request<PayslipSummary[]>('/payroll/payslips'),
  listAccountingPeriods: () =>
    request<AccountingPeriodSummary[]>('/accounting/periods'),
  createAccountingPeriod: (body: JsonBody) =>
    request<AccountingPeriodSummary>('/accounting/periods', {
      method: 'POST',
      json: body,
    }),
  listAccountingReports: () => request<AccountingReport>('/accounting/reports'),
  closeAccountingPeriod: (id: string) =>
    request<AccountingPeriodSummary>(`/accounting/closing/${id}`, {
      method: 'POST',
      json: {},
    }),
  listConversations: () =>
    request<ConversationSummary[]>('/messaging/conversations'),
  createConversation: (body: JsonBody) =>
    request<ConversationSummary>('/messaging/conversations', {
      method: 'POST',
      json: body,
    }),
  listMessages: () => request<MessageSummary[]>('/messaging/messages'),
  createMessage: (body: JsonBody) =>
    request<MessageSummary>('/messaging/messages', { method: 'POST', json: body }),
  listMessageReadReceipts: () =>
    request<MessageReadReceiptSummary[]>('/messaging/read-receipts'),
  markMessageRead: (body: JsonBody) =>
    request<MessageReadReceiptSummary>('/messaging/read-receipts', {
      method: 'POST',
      json: body,
    }),
  listActivityPosts: () => request<ActivityPost[]>('/activity-feed/posts'),
  createActivityPost: (body: JsonBody) =>
    request('/activity-feed/posts', { method: 'POST', json: body }),
  createActivityReaction: (postId: string, body: JsonBody) =>
    request<ActivityReaction>(
      `/activity-feed/posts/${encodeURIComponent(postId)}/reactions`,
      { method: 'POST', json: body },
    ),
  listMoodLogs: () => request<MoodLog[]>('/activity-feed/mood-logs'),
  createMoodLog: (body: JsonBody) =>
    request('/activity-feed/mood-logs', { method: 'POST', json: body }),
  listDevelopmentalMilestones: (params?: {
    studentId?: string | null;
    month?: string | null;
  }) =>
    request<DevelopmentalMilestone[]>(
      withQuery('/activity-feed/milestones', params ?? {}),
    ),
  createDevelopmentalMilestone: (body: JsonBody) =>
    request<DevelopmentalMilestone>('/activity-feed/milestones', {
      method: 'POST',
      json: body,
    }),
  listNotices: () => request<NoticeSummary[]>('/notices'),
  createNotice: (body: JsonBody) =>
    request<NoticeSummary>('/notices', { method: 'POST', json: body }),
  listEvents: () => request<EventSummary[]>('/events'),
  createEvent: (body: JsonBody) =>
    request<EventSummary>('/events', { method: 'POST', json: body }),
  listNotificationDeliveries: () =>
    request<NotificationDelivery[]>('/communications/deliveries'),
  listConsents: () => request<ConsentRecord[]>('/consents'),
  getGuardianConsentStatus: (guardianId: string) =>
    request<GuardianConsentStatus[]>(
      `/consents/guardians/${encodeURIComponent(guardianId)}/status`,
    ),
  captureGuardianConsent: (guardianId: string, body: JsonBody) =>
    request<ConsentRecord>(
      `/consents/guardians/${encodeURIComponent(guardianId)}/capture`,
      { method: 'POST', json: body },
    ),
  revokeGuardianConsent: (guardianId: string, body: JsonBody) =>
    request<ConsentRecord>(
      `/consents/guardians/${encodeURIComponent(guardianId)}/revoke`,
      { method: 'POST', json: body },
    ),
};
