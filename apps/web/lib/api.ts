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
  CashierClosePreview,
  CashierCloseSummary,
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
  InvoiceDetail,
  InvoiceSummary,
  JournalEntryView,
  MarkEntrySummary,
  MessageReadReceiptSummary,
  MessageSummary,
  MoodLog,
  NotificationDelivery,
  NoticeSummary,
  PayrollRunSummary,
  PaymentRefundPayload,
  PaymentRefundSummary,
  PlatformTenantSummary,
  PlatformTenantDetail,
  TenantSettingSummary,
  PayslipSummary,
  PromotionReadiness,
  PromotionResult,
  ReceiptView,
  ReportCardSummary,
  RoleSummary,
  SectionSummary,
  StaffSummary,
  StaffContractSummary,
  RevokeGeneratedStudentDocumentPayload,
  StudentProfileDetail,
  StudentArchivePayload,
  StudentDeletePayload,
  StudentFeeClearance,
  StudentFeeLedger,
  StudentLifecycleActionResult,
  StudentProfile,
  StudentTransferPayload,
  SubjectSummary,
  TeacherAssignmentSummary,
  TeacherWorkloadSummary,
  TimetableSlotSummary,
  UpdateStudentGuardianPayload,
  UpdateStudentProfilePayload,
  UploadStudentDocumentPayload,
  WaiverRecord,
} from '@schoolos/core';
import { clearStoredSession } from './session';

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
  retryOnUnauthorized?: boolean;
};

async function request<T>(path: string, init?: RequestOptions) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    body: init?.json ? JSON.stringify(init.json) : init?.body,
  });

  if (!response.ok) {
    if (
      response.status === 401 &&
      init?.auth !== false &&
      init?.retryOnUnauthorized !== false &&
      (await refreshAccessCookie())
    ) {
      return request<T>(path, { ...init, retryOnUnauthorized: false });
    }

    const text = await response.text();

    if (response.status === 401 && init?.auth !== false) {
      clearStoredSession();
    }

    throw new Error(parseApiErrorMessage(text) || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

function parseApiErrorMessage(text: string) {
  if (!text) {
    return '';
  }

  try {
    const payload = JSON.parse(text) as {
      message?: string | string[];
      error?: string;
    };
    const message = Array.isArray(payload.message)
      ? payload.message.join(', ')
      : payload.message;

    return message || payload.error || text;
  } catch {
    return text;
  }
}

async function openPdfBlob(response: Response) {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(parseApiErrorMessage(text) || `Request failed with status ${response.status}`);
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';

  if (!contentType.includes('application/pdf')) {
    const text = await response.text();
    throw new Error(
      parseApiErrorMessage(text) ||
        'The server did not return a PDF document. Please try again or contact support.',
    );
  }

  const blob = await response.blob();

  if (blob.size === 0) {
    throw new Error('The server returned an empty PDF document.');
  }

  const header = await blob.slice(0, 5).text();

  if (header !== '%PDF-') {
    throw new Error('The server returned an invalid PDF document.');
  }

  window.open(URL.createObjectURL(blob), '_blank', 'noopener,noreferrer');
}

async function refreshAccessCookie() {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  return response.ok;
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
  getStudentProfile: (studentId: string) =>
    request<StudentProfileDetail>(`/students/${encodeURIComponent(studentId)}`),
  updateStudent: (studentId: string, body: UpdateStudentProfilePayload) =>
    request<StudentProfileDetail>(`/students/${encodeURIComponent(studentId)}`, {
      method: 'PATCH',
      json: body as JsonBody,
    }),
  updateStudentGuardian: (
    studentId: string,
    guardianId: string,
    body: UpdateStudentGuardianPayload,
  ) =>
    request<StudentProfileDetail>(
      `/students/${encodeURIComponent(studentId)}/guardians/${encodeURIComponent(guardianId)}`,
      {
        method: 'PATCH',
        json: body as JsonBody,
      },
    ),
  getStudentFeeClearance: (studentId: string) =>
    request<StudentFeeClearance>(
      `/students/${encodeURIComponent(studentId)}/fee-clearance`,
    ),
  transferStudent: (studentId: string, body: StudentTransferPayload) =>
    request<StudentLifecycleActionResult>(
      `/students/${encodeURIComponent(studentId)}/transfer`,
      {
        method: 'POST',
        json: body as JsonBody,
      },
    ),
  archiveStudent: (studentId: string, body: StudentArchivePayload) =>
    request<StudentLifecycleActionResult>(
      `/students/${encodeURIComponent(studentId)}/archive`,
      {
        method: 'POST',
        json: body as JsonBody,
      },
    ),
  archiveStudentAsAlumni: (studentId: string, body: StudentArchivePayload) =>
    request<StudentLifecycleActionResult>(
      `/students/${encodeURIComponent(studentId)}/archive-alumni`,
      {
        method: 'POST',
        json: body as JsonBody,
      },
    ),
  softDeleteStudent: (studentId: string, body: StudentDeletePayload) =>
    request<StudentLifecycleActionResult>(
      `/students/${encodeURIComponent(studentId)}/delete`,
      {
        method: 'POST',
        json: body as JsonBody,
      },
    ),
  revokeGeneratedStudentDocument: (
    studentId: string,
    documentId: string,
    body: RevokeGeneratedStudentDocumentPayload,
  ) =>
    request(
      `/students/${encodeURIComponent(studentId)}/generated-documents/${encodeURIComponent(documentId)}/revoke`,
      {
        method: 'POST',
        json: body as JsonBody,
      },
    ),
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
  uploadStudentDocument: (body: UploadStudentDocumentPayload) =>
    request('/student-documents', {
      method: 'POST',
      json: body as JsonBody,
    }),
  previewStudentDocument: (id: string) =>
    request<{ url: string }>(`/student-documents/${id}/preview`),
  downloadStudentDocument: (id: string) =>
    request<{ url: string }>(`/student-documents/${id}/download`),
  deleteStudentDocument: (id: string) =>
    request(`/student-documents/${id}`, { method: 'DELETE' }),
  openStudentDocumentPdf: async (studentId: string, kind: string) => {
    const response = await fetch(
      `${API_BASE_URL}/students/${encodeURIComponent(studentId)}/documents/${encodeURIComponent(kind)}.pdf`,
      {
        credentials: 'include',
      },
    );

    await openPdfBlob(response);
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
  getInvoiceDetail: (invoiceId: string) =>
    request<InvoiceDetail>(`/fees/invoices/${encodeURIComponent(invoiceId)}`),
  getStudentFeeLedger: (studentId: string) =>
    request<StudentFeeLedger>(
      `/fees/students/${encodeURIComponent(studentId)}/ledger`,
    ),
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
  refundPayment: (paymentId: string, body: PaymentRefundPayload) =>
    request<PaymentRefundSummary>(
      `/payments/${encodeURIComponent(paymentId)}/refund`,
      {
        method: 'POST',
        json: body as JsonBody,
      },
    ),
  previewCashierClose: (params: {
    openedAt: string;
    closedAt: string;
    collectorUserId?: string | null;
    paymentMethod?: string | null;
  }) => request<CashierClosePreview>(withQuery('/payments/cashier-close/preview', params)),
  listCashierCloses: (params?: {
    openedFrom?: string | null;
    closedTo?: string | null;
    collectorUserId?: string | null;
    paymentMethod?: string | null;
  }) =>
    request<CashierCloseSummary[]>(
      withQuery('/payments/cashier-close', params ?? {}),
    ),
  finalizeCashierClose: (body: {
    openedAt: string;
    closedAt: string;
    collectorUserId?: string | null;
    paymentMethod?: string | null;
    notes?: string | null;
  }) =>
    request<CashierCloseSummary>('/payments/cashier-close', {
      method: 'POST',
      json: body as JsonBody,
    }),
  listReceipts: () => request<ReceiptView[]>('/receipts'),
  openReceiptPdf: async (receiptNumber: string) => {
    const response = await fetch(
      `${API_BASE_URL}/receipts/${encodeURIComponent(receiptNumber)}.pdf`,
      {
        credentials: 'include',
      },
    );

    await openPdfBlob(response);
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
  listPlatformTenants: () => request<PlatformTenantSummary[]>('/platform/tenants'),
  getPlatformTenantDetail: (tenantId: string) =>
    request<PlatformTenantDetail>(`/platform/tenants/${encodeURIComponent(tenantId)}`),
  updatePlatformTenantStatus: (tenantId: string, isActive: boolean) =>
    request<{ success: true }>(`/platform/tenants/${encodeURIComponent(tenantId)}/status`, {
      method: 'PATCH',
      json: { isActive },
    }),
  getTenantSettings: () => request<TenantSettingSummary[]>('/settings'),
  getPublicTenantSettings: () => request<TenantSettingSummary[]>('/settings/public'),
  updateTenantSetting: (key: string, value: any) =>
    request<{ success: true }>(`/settings/${encodeURIComponent(key)}`, {
      method: 'PATCH',
      json: { value },
    }),
};
