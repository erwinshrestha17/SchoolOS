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
  AttendanceSyncSubmission,
  AuthSession,
  BulkAdmissionImportResult,
  CasRecordSummary,
  ClassSummary,
  ConsentRecord,
  ConversationSummary,
  CashierCloseSummary,
  ChartAccountSummary,
  DefaulterReminderResult,
  DefaulterSummary,
  DiscountRule,
  DevelopmentalMilestone,
  EventSummary,
  ExamTermSummary,
  FeeBillingRun,
  FeeHeadSummary,
  FeePlanSummary,
  FiscalYearSummary,
  FiscalPeriodSummary,
  GuardianConsentStatus,
  HomeworkAssignmentSummary,
  HomeworkSubmissionSummary,
  InvoiceSummary,
  JournalEntryView,
  MarkEntrySummary,
  MarkLockRequestSummary as MarkLockRequestCore,
  MessageReadReceiptSummary,
  MessageSummary,
  ChatAvailabilityRuleSummary,
  ChatAvailabilityStatus,
  MoodLog,
  NotificationDelivery,
  NoticeSummary,
  PayrollRunSummary,
  PayrollPreviewResult,
  PaymentRefundPayload,
  PaymentRefundSummary,
  PaginatedResult,
  ParentTeacherMessageSummary,
  ParentTeacherThreadCreateResult,
  ParentTeacherThreadSummary,
  SendParentTeacherMessageResult,
  PlatformTenantSummary,
  PlatformTenantDetail,
  PlatformAuditLog,
  PlatformDashboardSummary,
  PlatformPlanSummary,
  PlatformProviderConfigSummary,
  PlatformQueueSummary,
  PlatformHealthSummary,
  PlatformOnboardingChecklist,
  PlatformSaaSInvoiceSummary,
  TenantSettingSummary,
  PayslipSummary,
  PromotionReadiness,
  PromotionResult,
  BatchPromotionResult,
  ResultPublishingReadiness,
  PublishingResult,
  ReceiptView,
  ReportCardSummary,
  RoleSummary,
  SectionSummary,
  StaffSummary,
  StaffDetail,
  SalaryStructureSummary,
  StaffContractSummary,
  StaffLeaveRequestSummary,
  StaffLeaveBalanceSummary,
  StaffLeaveReviewResult,
  StaffAttendanceMonthlySummary,
  RevokeGeneratedStudentDocumentPayload,
  StudentAttendanceHistory,
  StudentAttendanceHistoryFilters,
  StudentProfileDetail,
  StudentArchivePayload,
  StudentDeletePayload,
  StudentFeeClearance,
  StudentFeeLedger,
  StudentLifecycleActionResult,
  StudentTransferPayload,
  SubjectSummary,
  TeacherAssignmentSummary,
  TeacherWorkloadSummary,
  TeacherAvailabilitySummary,
  TimetablePeriodSummary,
  TimetableSubstitutionSummary,
  TimetableValidationResult,
  TimetableVersionSummary,
  TimetableSlotSummary,
  RoomSummary,
  UpdateStudentGuardianPayload,
  UpdateStudentProfilePayload,
  UploadStudentDocumentPayload,
  WaiverRecord,
  ReportDefinition,
  ReportExportRequest,
  SubjectWeeklyRequirementSummary,
  ApiResponse,
  StudentProfile,
  AttendanceRoster,
  CashierClosePreview,
  InvoiceDetail,
} from '@schoolos/core';
import { clearStoredSession } from './session';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

let refreshPromise: Promise<boolean> | null = null;

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

  const payload = (await response.json()) as ApiResponse<T>;
  return payload.data;
}

function parseApiErrorMessage(text: string) {
  if (!text) {
    return '';
  }

  try {
    const payload = JSON.parse(text) as ApiResponse<unknown> & {
      error?: string;
      statusCode?: number;
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

async function downloadReport(reportKey: string, payload: ReportExportRequest) {
  const response = await fetch(
    `${API_BASE_URL}/reports/${encodeURIComponent(reportKey)}/export`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      parseApiErrorMessage(text) ||
        `Export failed with status ${response.status}`,
    );
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';

  if (contentType.includes('application/pdf')) {
    return openPdfBlob(response);
  }

  if (contentType.includes('application/json') && payload.format === 'json') {
    const blob = await response.blob();
    const text = await blob.text();
    return JSON.parse(text).data;
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;

  const contentDisposition = response.headers.get('content-disposition');
  let fileName = `${reportKey}-export.${payload.format}`;
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="(.+)"/);
    if (match) fileName = match[1];
  }

  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

async function refreshAccessCookie() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to refresh access cookie:', error);
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function withQuery(path: string, params: Record<string, any>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      searchParams.set(key, String(value));
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
  listStudents: (params?: { classId?: string; sectionId?: string; status?: string }) =>
    request<StudentProfile[]>(withQuery('/students', params ?? {})),
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
  getStudentAttendanceHistory: (
    studentId: string,
    params?: StudentAttendanceHistoryFilters,
  ) =>
    request<StudentAttendanceHistory>(
      withQuery(
        `/students/${encodeURIComponent(studentId)}/attendance-history`,
        params ?? {},
      ),
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
  generateStudentQr: (studentId: string) =>
    request<{ credential: any; rawToken: string }>(
      `/students/${encodeURIComponent(studentId)}/qr`,
      { method: 'POST' },
    ),
  rotateStudentQr: (studentId: string, body: { reason: string }) =>
    request<{ credential: any; rawToken: string }>(
      `/students/${encodeURIComponent(studentId)}/qr/rotate`,
      {
        method: 'POST',
        json: body,
      },
    ),
  revokeStudentQr: (studentId: string, body: { reason: string }) =>
    request<any>(`/students/${encodeURIComponent(studentId)}/qr/revoke`, {
      method: 'POST',
      json: body,
    }),
  resolveStudentQr: (body: { token: string; purpose: string }) =>
    request<any>('/students/qr/resolve', {
      method: 'POST',
      json: body,
    }),
  getStudentQrImageUrl: (studentId: string, token: string) =>
    `${API_BASE_URL}/students/${encodeURIComponent(studentId)}/qr-image?token=${encodeURIComponent(token)}`,
  listStaff: () => request<StaffSummary[]>('/staff'),
  getStaffDetail: (staffId: string) =>
    request<StaffDetail>(`/hr/staff/${encodeURIComponent(staffId)}`),
  updateStaffDetail: (staffId: string, body: JsonBody) =>
    request<StaffDetail>(`/hr/staff/${encodeURIComponent(staffId)}`, {
      method: 'PATCH',
      json: body,
    }),
  updateStaffLifecycle: (staffId: string, body: JsonBody) =>
    request<StaffDetail>(`/hr/staff/${encodeURIComponent(staffId)}/lifecycle`, {
      method: 'POST',
      json: body,
    }),
  createStaff: (body: JsonBody) =>
    request<StaffSummary>('/staff', { method: 'POST', json: body }),
  listRoles: () => request<RoleSummary[]>('/roles'),
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
  listExamTerms: () => request<ExamTermSummary[]>('/academics/exams'),
  createExamTerm: (body: JsonBody) =>
    request<ExamTermSummary>('/academics/exams', { method: 'POST', json: body }),
  updateExamTerm: (id: string, body: JsonBody) =>
    request<ExamTermSummary>(`/academics/exams/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      json: body,
    }),
  deleteExamTerm: (id: string) =>
    request<{ deleted: true; examTermId: string }>(`/academics/exams/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  createAssessmentComponent: (body: JsonBody) =>
    request<AssessmentComponentSummary>('/academics/exams/components', {
      method: 'POST',
      json: body,
    }),
  listMarks: (params?: {
    examTermId?: string | null;
    assessmentComponentId?: string | null;
    classId?: string | null;
    sectionId?: string | null;
    subjectId?: string | null;
  }) => request<MarkEntrySummary[]>(withQuery('/academics/marks', params ?? {})),
  enterMark: (body: JsonBody) =>
    request<MarkEntrySummary>('/academics/marks', { method: 'POST', json: body }),
  batchEnterMarks: (body: JsonBody) =>
    request<{ saved: number; entries: MarkEntrySummary[] }>('/academics/marks/batch', {
      method: 'POST',
      json: body,
    }),
  listComponentsByExamTerm: (examTermId: string, params?: { subjectId?: string | null }) =>
    request<AssessmentComponentSummary[]>(
      withQuery(`/academics/exams/${encodeURIComponent(examTermId)}/components`, params ?? {}),
    ),
  createCasRecord: (body: JsonBody) =>
    request<CasRecordSummary>('/academics/cas', { method: 'POST', json: body }),
  listReportCards: (params?: {
    academicYearId?: string;
    examTermId?: string;
    classId?: string;
    sectionId?: string;
  }) => request<ReportCardSummary[]>(withQuery('/academics/report-cards', params ?? {})),
  generateReportCard: (body: JsonBody) =>
    request<ReportCardSummary>('/academics/report-cards', { method: 'POST', json: body }),
  batchGenerateReportCards: (body: JsonBody) =>
    request<ReportCardSummary[]>('/academics/report-cards/batch', { method: 'POST', json: body }),
  listPromotionReadiness: (params: {
    academicYearId: string;
    classId?: string | null;
    sectionId?: string | null;
    status?: string | null;
  }) => request<PromotionReadiness[]>(withQuery('/academics/promotions', params)),
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
  uploadFile: async (file: File, module: string) => {
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve) => {
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.readAsDataURL(file);
    });

    const base64Content = await base64Promise;

    return request<{ id: string; fileName: string; publicUrl: string | null }>(
      '/files/upload',
      {
        method: 'POST',
        json: {
          fileName: file.name,
          contentType: file.type,
          base64Content,
          module,
        },
      },
    );
  },

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
  getAttendanceRegister: (params: {
    academicYearId: string;
    classId: string;
    sectionId?: string | null;
    month?: number;
    year?: number;
  }) => request<any>(withQuery('/attendance/register', {
    ...params,
    month: params.month ? String(params.month) : undefined,
    year: params.year ? String(params.year) : undefined,
  })),
  exportRoster: async (params?: {
    academicYearId?: string;
    classId?: string;
    sectionId?: string;
  }) => {
    const response = await fetch(
      `${API_BASE_URL}${withQuery('/students/roster/export', params ?? {})}`,
      {
        credentials: 'include',
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(parseApiErrorMessage(text) || 'Export failed');
    }

    const text = await response.text();
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `class-roster-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
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
  downloadReport: (reportKey: string, payload: ReportExportRequest) =>
    downloadReport(reportKey, payload),
  getDuesTableReport: (params?: {
    academicYearId?: string;
    classId?: string;
    sectionId?: string;
    feeHeadId?: string;
    studentId?: string;
    month?: number;
    year?: number;
  }) =>
    request<{ rows: any[]; summary: any }>(
      withQuery('/fees/reports/dues', {
        ...params,
        month: params?.month ? String(params.month) : undefined,
        year: params?.year ? String(params.year) : undefined,
      }),
    ),
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
    actualCashAmount?: number | null;
    varianceReason?: string | null;
    denominationBreakdown?: Record<string, unknown> | null;
    notes?: string | null;
  }) =>
    request<CashierCloseSummary>('/payments/cashier-close', {
      method: 'POST',
      json: body as JsonBody,
    }),
  reversePayment: (paymentId: string, body: { reason: string }) =>
    request<{ success: true }>(`/payments/${encodeURIComponent(paymentId)}/reverse`, {
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
  reprintReceipt: async (receiptId: string, reason: string) => {
    const response = await fetch(
      `${API_BASE_URL}/receipts/${encodeURIComponent(receiptId)}/reprint`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      },
    );

    await openPdfBlob(response);
  },
  listLedgerEntries: () => request<JournalEntryView[]>('/ledger/entries'),
  listTimetable: (params?: { classId?: string | null }) =>
    request<TimetableSlotSummary[]>(withQuery('/timetable', params ?? {})),
  listTeacherWorkload: () =>
    request<TeacherWorkloadSummary[]>('/timetable/workload'),
  createTimetableSlot: (body: JsonBody) =>
    request<TimetableSlotSummary>('/timetable', { method: 'POST', json: body }),
  listTimetablePeriods: (params?: { academicYearId?: string }) =>
    request<TimetablePeriodSummary[]>(withQuery('/timetable/periods', params ?? {})),
  createTimetablePeriod: (body: JsonBody) =>
    request<TimetablePeriodSummary>('/timetable/periods', { method: 'POST', json: body }),
  updateTimetablePeriod: (id: string, body: JsonBody) =>
    request<TimetablePeriodSummary>(`/timetable/periods/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      json: body,
    }),
  deleteTimetablePeriod: (id: string) =>
    request<{ deleted: boolean; id: string }>(`/timetable/periods/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  listRooms: () => request<RoomSummary[]>('/timetable/rooms'),
  createRoom: (body: JsonBody) =>
    request<RoomSummary>('/timetable/rooms', { method: 'POST', json: body }),
  updateRoom: (id: string, body: JsonBody) =>
    request<RoomSummary>(`/timetable/rooms/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      json: body,
    }),
  deleteRoom: (id: string) =>
    request<{ deleted: boolean; id: string }>(`/timetable/rooms/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  listTimetableVersions: (params?: {
    academicYearId?: string;
    classId?: string;
    sectionId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) => request<TimetableVersionSummary[]>(withQuery('/timetable/versions', params ?? {})),
  createTimetableVersion: (body: JsonBody) =>
    request<TimetableVersionSummary>('/timetable/versions', { method: 'POST', json: body }),
  getTimetableVersion: (id: string) =>
    request<TimetableVersionSummary>(`/timetable/versions/${encodeURIComponent(id)}`),
  createTimetableVersionSlot: (versionId: string, body: JsonBody) =>
    request<TimetableSlotSummary>(
      `/timetable/versions/${encodeURIComponent(versionId)}/slots`,
      { method: 'POST', json: body },
    ),
  updateTimetableSlot: (id: string, body: JsonBody) =>
    request<TimetableSlotSummary>(`/timetable/slots/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      json: body,
    }),
  deleteTimetableSlot: (id: string) =>
    request<{ deleted: boolean; id: string }>(`/timetable/slots/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
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
  getTeacherWorkload: (teacherId: string, params?: { academicYearId?: string; versionId?: string }) =>
    request<unknown>(
      withQuery(`/timetable/teachers/${encodeURIComponent(teacherId)}/workload`, params ?? {}),
    ),
  listSubstitutions: (params?: {
    date?: string;
    teacherId?: string;
    classId?: string;
    sectionId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) => request<TimetableSubstitutionSummary[]>(withQuery('/timetable/substitutions', params ?? {})),
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
  assignHomework: (id: string) =>
    request<HomeworkAssignmentSummary>(`/homework/${encodeURIComponent(id)}/assign`, {
      method: 'PATCH',
      json: {},
    }),
  closeHomework: (id: string) =>
    request<HomeworkAssignmentSummary>(`/homework/${encodeURIComponent(id)}/close`, {
      method: 'PATCH',
      json: {},
    }),
  cancelHomework: (id: string) =>
    request<HomeworkAssignmentSummary>(`/homework/${encodeURIComponent(id)}/cancel`, {
      method: 'PATCH',
      json: {},
    }),
  previewHomeworkReminders: (id: string) =>
    request<unknown>(`/homework/${encodeURIComponent(id)}/reminders/preview`),
  sendHomeworkReminders: (id: string) =>
    request<unknown>(`/homework/${encodeURIComponent(id)}/reminders/send`, {
      method: 'POST',
      json: {},
    }),
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
  listStaffContracts: () => request<StaffContractSummary[]>('/hr/contracts'),
  createStaffContract: (body: JsonBody) =>
    request<StaffContractSummary>('/hr/contracts', { method: 'POST', json: body }),
  listPayrollRuns: () => request<PayrollRunSummary[]>('/payroll/runs'),
  getPayrollRun: (id: string) =>
    request<PayrollRunSummary>(`/payroll/runs/${encodeURIComponent(id)}`),
  previewPayrollRun: (body: JsonBody) =>
    request<PayrollPreviewResult[]>('/payroll/runs/preview', {
      method: 'POST',
      json: body,
    }),
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
  submitPayrollRunReview: (id: string) =>
    request<PayrollRunSummary>(`/payroll/runs/${id}/submit-review`, {
      method: 'POST',
      json: {},
    }),
  rejectPayrollRun: (id: string, body: JsonBody) =>
    request<PayrollRunSummary>(`/payroll/runs/${id}/reject`, {
      method: 'POST',
      json: body,
    }),
  markPayrollRunPaid: (id: string, body: JsonBody) =>
    request<PayrollRunSummary>(`/payroll/runs/${id}/mark-paid`, {
      method: 'POST',
      json: body,
    }),
  listSalaryStructures: () =>
    request<SalaryStructureSummary[]>('/payroll/salary-structures'),
  createSalaryStructure: (body: JsonBody) =>
    request<SalaryStructureSummary>('/payroll/salary-structures', {
      method: 'POST',
      json: body,
    }),
  activateSalaryStructure: (id: string) =>
    request<SalaryStructureSummary>(
      `/payroll/salary-structures/${encodeURIComponent(id)}/activate`,
      { method: 'POST', json: {} },
    ),
  archiveSalaryStructure: (id: string) =>
    request<SalaryStructureSummary>(
      `/payroll/salary-structures/${encodeURIComponent(id)}/archive`,
      { method: 'POST', json: {} },
    ),
  getPayrollRegister: () => request<unknown[]>('/payroll/reports/register'),
  getPayrollReportSummary: () => request<unknown>('/payroll/reports/summary'),
  exportPayrollRegisterCsv: async () => {
    const response = await fetch(`${API_BASE_URL}/payroll/reports/register.csv`, {
      credentials: 'include',
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(parseApiErrorMessage(text) || 'Export failed');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-register-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
  listPayslips: () => request<PayslipSummary[]>('/payroll/payslips'),
  openPayrollRunStaffPayslipPdf: async (runId: string, staffId: string) => {
    const response = await fetch(
      `${API_BASE_URL}/payroll/runs/${encodeURIComponent(runId)}/staff/${encodeURIComponent(staffId)}/payslip.pdf`,
      { credentials: 'include' },
    );

    await openPdfBlob(response);
  },
  listStaffAttendanceSummary: (params: { month?: number; year?: number }) =>
    request<StaffAttendanceMonthlySummary>(
      withQuery('/hr/staff-attendance/summary', {
        month: params.month ? String(params.month) : undefined,
        year: params.year ? String(params.year) : undefined,
      }),
    ),
  listStaffAttendance: (staffId: string) =>
    request<any[]>(`/hr/staff/${encodeURIComponent(staffId)}/attendance`),
  listLeaveRequests: () =>
    request<StaffLeaveRequestSummary[]>('/hr/leave-requests'),
  createLeaveRequest: (body: JsonBody) =>
    request<StaffLeaveRequestSummary>('/hr/leave-requests', {
      method: 'POST',
      json: body,
    }),
  approveLeaveRequest: (id: string, body: JsonBody) =>
    request<StaffLeaveReviewResult>(`/hr/leaves/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      json: body,
    }),
  rejectLeaveRequest: (id: string, body: JsonBody) =>
    request<StaffLeaveReviewResult>(`/hr/leaves/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      json: body,
    }),
  listStaffLeaveBalances: (staffId: string) =>
    request<StaffLeaveBalanceSummary[]>(`/hr/staff/${encodeURIComponent(staffId)}/leave-balances`),
  listAllLeaveBalances: () =>
    request<StaffLeaveBalanceSummary[]>('/hr/leave-balances'),
  getPayrollPreview: (params: {
    year: number;
    month: number;
    workingDays?: number;
  }) =>
    request<PayrollPreviewResult[]>(
      withQuery('/payroll/preview', {
        year: String(params.year),
        month: String(params.month),
        workingDays: params.workingDays ? String(params.workingDays) : undefined,
      }),
    ),
  listAccountingPeriods: () =>
    request<AccountingPeriodSummary[]>('/accounting/periods'),
  listChartAccounts: () =>
    request<ChartAccountSummary[]>('/accounting/accounts'),
  listChartAccountTree: () =>
    request<ChartAccountSummary[]>('/accounting/accounts/tree'),
  createChartAccount: (body: JsonBody) =>
    request<ChartAccountSummary>('/accounting/accounts', {
      method: 'POST',
      json: body,
    }),
  archiveChartAccount: (id: string) =>
    request<ChartAccountSummary>(
      `/accounting/accounts/${encodeURIComponent(id)}/archive`,
      { method: 'POST', json: {} },
    ),
  seedDefaultChartAccounts: () =>
    request<ChartAccountSummary[]>('/accounting/accounts/seed-defaults', {
      method: 'POST',
      json: {},
    }),
  createAccountingPeriod: (body: JsonBody) =>
    request<AccountingPeriodSummary>('/accounting/periods', {
      method: 'POST',
      json: body,
    }),
  createFiscalYear: (body: JsonBody) =>
    request<FiscalYearSummary>('/accounting/fiscal-years', {
      method: 'POST',
      json: body,
    }),
  listFiscalYears: () =>
    request<FiscalYearSummary[]>('/accounting/fiscal-years'),
  listFiscalPeriods: (id: string) =>
    request<FiscalPeriodSummary[]>(
      `/accounting/fiscal-years/${encodeURIComponent(id)}/periods`,
    ),
  lockFiscalPeriod: (id: string, body: JsonBody) =>
    request<FiscalPeriodSummary>(
      `/accounting/fiscal-periods/${encodeURIComponent(id)}/lock`,
      { method: 'POST', json: body },
    ),
  closeFiscalPeriod: (id: string, body: JsonBody) =>
    request<FiscalPeriodSummary>(
      `/accounting/fiscal-periods/${encodeURIComponent(id)}/close`,
      { method: 'POST', json: body },
    ),
  reopenFiscalPeriod: (id: string, body: JsonBody) =>
    request<FiscalPeriodSummary>(
      `/accounting/fiscal-periods/${encodeURIComponent(id)}/reopen`,
      { method: 'POST', json: body },
    ),
  listAccountingReports: (params?: JsonBody) =>
    request<AccountingReport>(withQuery('/accounting/reports', params ?? {})),
  listTrialBalance: (params?: JsonBody) =>
    request<AccountingReport['trialBalance']>(
      withQuery('/accounting/reports/trial-balance', params ?? {}),
    ),
  listGeneralLedger: (params?: JsonBody) =>
    request<unknown[]>(withQuery('/accounting/reports/general-ledger', params ?? {})),
  listIncomeStatement: (params?: JsonBody) =>
    request<AccountingReport['incomeStatement']>(
      withQuery('/accounting/reports/income-statement', params ?? {}),
    ),
  listBalanceSheet: (params?: JsonBody) =>
    request<AccountingReport['balanceSheet']>(
      withQuery('/accounting/reports/balance-sheet', params ?? {}),
    ),
  listCashBook: (params?: JsonBody) =>
    request<unknown>(withQuery('/accounting/reports/cash-book', params ?? {})),
  listVatSummary: () => request<any>('/accounting/reports/vat-summary'),
  listTdsSummary: () => request<any>('/accounting/reports/tds-summary'),
  listPfSummary: () => request<any>('/accounting/reports/pf-summary'),
  exportAccountingCsv: async (report: string) => {
    const response = await fetch(
      `${API_BASE_URL}/accounting/exports/${encodeURIComponent(report)}.csv`,
      { credentials: 'include' },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(parseApiErrorMessage(text) || 'Export failed');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
  closeAccountingPeriod: (id: string) =>
    request<AccountingPeriodSummary>(`/accounting/closing/${id}`, {
      method: 'POST',
      json: {},
    }),
  createOpeningBalance: (body: JsonBody) =>
    request<any>('/accounting/opening-balance', { method: 'POST', json: body }),
  getOpeningBalance: (fiscalYearId: string) =>
    request<any>(`/accounting/opening-balance/${fiscalYearId}`),
  createExpenseVoucher: (body: JsonBody) =>
    request<any>('/accounting/vouchers/expense', { method: 'POST', json: body }),
  createPaymentVoucher: (body: JsonBody) =>
    request<any>('/accounting/vouchers/payment', { method: 'POST', json: body }),
  createReceiptVoucher: (body: JsonBody) =>
    request<any>('/accounting/vouchers/receipt', { method: 'POST', json: body }),
  createContraVoucher: (body: JsonBody) =>
    request<any>('/accounting/vouchers/contra', { method: 'POST', json: body }),
  closeFiscalYear: (id: string) =>
    request<any>(`/accounting/fiscal-years/${id}/close`, { method: 'POST' }),
  reopenFiscalYear: (id: string, body: JsonBody) =>
    request<any>(`/accounting/fiscal-years/${id}/reopen`, {
      method: 'POST',
      json: body,
    }),
  importBankStatement: (accountId: string, lines: any[]) =>
    request<any>(`/accounting/bank-reconciliation/accounts/${accountId}/import`, {
      method: 'POST',
      json: { lines },
    }),
  getUnreconciledStatements: (accountId: string) =>
    request<any[]>(`/accounting/bank-reconciliation/accounts/${accountId}/unreconciled`),
  reconcileStatement: (statementId: string, journalLineId: string) =>
    request<any>(`/accounting/bank-reconciliation/statements/${statementId}/reconcile`, {
      method: 'POST',
      json: { journalLineId },
    }),
  getReconciliationSummary: (accountId: string) =>
    request<any>(`/accounting/bank-reconciliation/accounts/${accountId}/summary`),
  listJournalEntries: () => request<JournalEntryView[]>('/accounting/journals'),
  createManualJournal: (body: JsonBody) =>
    request<JournalEntryView>('/accounting/journals', {
      method: 'POST',
      json: body,
    }),
  submitJournal: (id: string, body: JsonBody) =>
    request<JournalEntryView>(`/accounting/journals/${encodeURIComponent(id)}/submit`, {
      method: 'POST',
      json: body,
    }),
  postJournal: (id: string) =>
    request<JournalEntryView>(`/accounting/journals/${encodeURIComponent(id)}/post`, {
      method: 'POST',
    }),
  reverseJournal: (id: string, body: JsonBody) =>
    request<JournalEntryView>(`/accounting/journals/${encodeURIComponent(id)}/reverse`, {
      method: 'POST',
      json: body,
    }),
  correctJournal: (id: string, body: JsonBody) =>
    request<JournalEntryView>(`/accounting/journals/${encodeURIComponent(id)}/correct`, {
      method: 'POST',
      json: body,
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
  listParentTeacherThreads: (params?: {
    status?: string;
    studentId?: string;
    guardianId?: string;
    classTeacherId?: string;
    search?: string;
    page?: string;
    limit?: string;
  }) =>
    request<PaginatedResult<ParentTeacherThreadSummary>>(
      withQuery('/messaging/parent-teacher/threads', params ?? {}),
    ),
  getParentTeacherThread: (threadId: string) =>
    request<ParentTeacherThreadSummary>(
      `/messaging/parent-teacher/threads/${encodeURIComponent(threadId)}`,
    ),
  createParentTeacherThread: (body: JsonBody) =>
    request<ParentTeacherThreadCreateResult>('/messaging/parent-teacher/threads', {
      method: 'POST',
      json: body,
    }),
  closeParentTeacherThread: (threadId: string, body: JsonBody) =>
    request<ParentTeacherThreadSummary>(
      `/messaging/parent-teacher/threads/${encodeURIComponent(threadId)}/close`,
      { method: 'PATCH', json: body },
    ),
  escalateParentTeacherThread: (threadId: string, body: JsonBody) =>
    request(
      `/messaging/parent-teacher/threads/${encodeURIComponent(threadId)}/escalate`,
      { method: 'PATCH', json: body },
    ),
  listParentTeacherMessages: (threadId: string, params?: { page?: string; limit?: string }) =>
    request<PaginatedResult<ParentTeacherMessageSummary>>(
      withQuery(
        `/messaging/parent-teacher/threads/${encodeURIComponent(threadId)}/messages`,
        params ?? {},
      ),
    ),
  sendParentTeacherMessage: (threadId: string, body: JsonBody) =>
    request<SendParentTeacherMessageResult>(
      `/messaging/parent-teacher/threads/${encodeURIComponent(threadId)}/messages`,
      { method: 'POST', json: body },
    ),
  markParentTeacherThreadRead: (threadId: string) =>
    request(`/messaging/parent-teacher/threads/${encodeURIComponent(threadId)}/read`, {
      method: 'PATCH',
      json: {},
    }),
  markParentTeacherMessageRead: (messageId: string) =>
    request<ParentTeacherMessageSummary>(
      `/messaging/parent-teacher/messages/${encodeURIComponent(messageId)}/read`,
      { method: 'PATCH', json: {} },
    ),
  listChatAvailability: () =>
    request<ChatAvailabilityRuleSummary[]>('/messaging/parent-teacher/availability'),
  updateChatAvailability: (body: JsonBody) =>
    request<ChatAvailabilityRuleSummary[]>('/messaging/parent-teacher/availability', {
      method: 'PUT',
      json: body,
    }),
  getChatAvailabilityStatus: () =>
    request<ChatAvailabilityStatus>('/messaging/parent-teacher/availability/status'),
  createChatAbuseReport: (threadId: string, body: JsonBody) =>
    request(
      `/messaging/parent-teacher/threads/${encodeURIComponent(threadId)}/abuse-report`,
      { method: 'POST', json: body },
    ),
  listChatAbuseReports: () => request('/messaging/parent-teacher/abuse-reports'),
  reviewChatAbuseReport: (reportId: string, body: JsonBody) =>
    request(`/messaging/parent-teacher/abuse-reports/${encodeURIComponent(reportId)}/review`, {
      method: 'PATCH',
      json: body,
    }),
  resolveChatEscalation: (escalationId: string, body: JsonBody) =>
    request(
      `/messaging/parent-teacher/escalations/${encodeURIComponent(escalationId)}/resolve`,
      { method: 'PATCH', json: body },
    ),
  listActivityPosts: () => request<ActivityPost[]>('/activity-feed/posts'),
  previewActivityAttachment: async (attachmentId: string) => {
    const response = await fetch(
      `${API_BASE_URL}/activity-feed/attachments/${encodeURIComponent(attachmentId)}/preview`,
      { credentials: 'include' }
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(parseApiErrorMessage(text) || `Preview failed with status ${response.status}`);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60000); // Cleanup after a minute
  },
  downloadActivityAttachment: async (attachmentId: string, fileName: string) => {
    const response = await fetch(
      `${API_BASE_URL}/activity-feed/attachments/${encodeURIComponent(attachmentId)}/download`,
      { credentials: 'include' },
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        parseApiErrorMessage(text) ||
          `Download failed with status ${response.status}`,
      );
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
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
  listPlatformTenantsPage: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    plan?: string;
  }) =>
    request<PaginatedResult<PlatformTenantSummary>>(
      withQuery('/platform/tenants/page', {
        ...params,
        page: params?.page?.toString(),
        limit: params?.limit?.toString(),
      }),
    ),
  getPlatformTenantDetail: (tenantId: string) =>
    request<PlatformTenantDetail>(
      `/platform/tenants/${encodeURIComponent(tenantId)}`,
    ),
  updatePlatformTenantStatus: (
    tenantId: string,
    isActive: boolean,
    reason?: string,
  ) =>
    request<{ success: true }>(
      `/platform/tenants/${encodeURIComponent(tenantId)}/status`,
      {
        method: 'PATCH',
        json: { isActive, reason },
      },
    ),
  listPlatformAuditLogs: (params?: {
    page?: number;
    limit?: number;
    tenantId?: string;
    action?: string;
    userId?: string;
  }) =>
    request<PaginatedResult<PlatformAuditLog>>(
      withQuery('/platform/audit-logs', {
        ...params,
        page: params?.page?.toString(),
        limit: params?.limit?.toString(),
      }),
    ),
  getPlatformDashboard: () =>
    request<PlatformDashboardSummary>('/platform/dashboard'),
  listPlatformPlans: () => request<PlatformPlanSummary[]>('/platform/plans'),
  createPlatformPlan: (body: JsonBody) =>
    request<PlatformPlanSummary>('/platform/plans', { method: 'POST', json: body }),
  updatePlatformPlan: (planId: string, body: JsonBody) =>
    request<PlatformPlanSummary>(`/platform/plans/${encodeURIComponent(planId)}`, {
      method: 'PATCH',
      json: body,
    }),
  assignPlatformSubscription: (tenantId: string, body: JsonBody) =>
    request(
      `/platform/tenants/${encodeURIComponent(tenantId)}/subscriptions`,
      { method: 'POST', json: body },
    ),
  setPlatformFeatureOverride: (tenantId: string, body: JsonBody) =>
    request(
      `/platform/tenants/${encodeURIComponent(tenantId)}/feature-overrides`,
      { method: 'POST', json: body },
    ),
  listPlatformUsageCounters: (tenantId: string) =>
    request(`/platform/tenants/${encodeURIComponent(tenantId)}/usage-counters`),
  getPlatformBillingProfile: (tenantId: string) =>
    request(`/platform/tenants/${encodeURIComponent(tenantId)}/billing-profile`),
  updatePlatformBillingProfile: (tenantId: string, body: JsonBody) =>
    request(`/platform/tenants/${encodeURIComponent(tenantId)}/billing-profile`, {
      method: 'PATCH',
      json: body,
    }),
  listPlatformSaaSInvoices: (tenantId: string) =>
    request<PlatformSaaSInvoiceSummary[]>(
      `/platform/tenants/${encodeURIComponent(tenantId)}/saas-invoices`,
    ),
  createPlatformSaaSInvoice: (tenantId: string, body: JsonBody) =>
    request<PlatformSaaSInvoiceSummary>(
      `/platform/tenants/${encodeURIComponent(tenantId)}/saas-invoices`,
      { method: 'POST', json: body },
    ),
  recordPlatformSaaSPayment: (tenantId: string, invoiceId: string, body: JsonBody) =>
    request<PlatformSaaSInvoiceSummary>(
      `/platform/tenants/${encodeURIComponent(tenantId)}/saas-invoices/${encodeURIComponent(invoiceId)}/payments`,
      { method: 'POST', json: body },
    ),
  listPlatformProviders: () =>
    request<PlatformProviderConfigSummary[]>('/platform/providers'),
  upsertPlatformProvider: (body: JsonBody) =>
    request<PlatformProviderConfigSummary>('/platform/providers', {
      method: 'POST',
      json: body,
    }),
  getPlatformQueueHealth: () =>
    request<PlatformQueueSummary[]>('/platform/queues'),
  retryPlatformFailedJob: (body: JsonBody) =>
    request('/platform/queues/retry', { method: 'POST', json: body }),
  getPlatformHealth: () => request<PlatformHealthSummary>('/platform/health'),
  listPlatformReportExports: (params?: { tenantId?: string }) =>
    request(withQuery('/platform/report-exports', params ?? {})),
  getTenantOnboardingChecklist: (tenantId: string) =>
    request<PlatformOnboardingChecklist>(
      `/platform/tenants/${encodeURIComponent(tenantId)}/onboarding`,
    ),
  setTenantOnboardingOverride: (tenantId: string, body: JsonBody) =>
    request<PlatformOnboardingChecklist>(
      `/platform/tenants/${encodeURIComponent(tenantId)}/onboarding/override`,
      { method: 'POST', json: body },
    ),
  getTenantSettings: () => request<TenantSettingSummary[]>('/settings'),
  getPublicTenantSettings: () => request<TenantSettingSummary[]>('/settings/public'),
  getSchoolOnboardingChecklist: () =>
    request<PlatformOnboardingChecklist>('/settings/onboarding'),
  updateTenantSetting: (key: string, value: any) =>
    request<{ success: true }>(`/settings/${encodeURIComponent(key)}`, {
      method: 'PATCH',
      json: { value },
    }),
  listReports: () => request<ReportDefinition[]>('/reports'),
  exportReport: (reportKey: string, payload: ReportExportRequest) =>
    downloadReport(reportKey, payload),

  // Staff Self-Service
  getMyProfile: () => request<any>('/staff/me'),
  listMyPayslips: () => request<any[]>('/payroll/me/payslips'),
  listMyAttendance: () => request<any[]>('/attendance/me/attendance'),
  listMyLeaveRequests: () => request<any[]>('/attendance/me/leave-requests'),
  openPayslipPdf: async (payslipNumber: string) => {
    const response = await fetch(
      `${API_BASE_URL}/payroll/payslips/${encodeURIComponent(payslipNumber)}.pdf`,
      {
        credentials: 'include',
      },
    );

    await openPdfBlob(response);
  },

  // Accounting Verification
  getJournalEntry: (id: string) =>
    request<JournalEntryView>(`/accounting/journals/${encodeURIComponent(id)}`),

  // Notification Center
  getNotificationCenter: () =>
    request<NotificationCenterSummary>('/communications/notifications'),
  markNotificationRead: (id: string) =>
    request<{ success: true }>(
      `/communications/notifications/${encodeURIComponent(id)}/read`,
      { method: 'POST' },
    ),
  markAllNotificationsRead: () =>
    request<{ success: true; markedCount: number }>(
      '/communications/notifications/mark-all-read',
      { method: 'POST' },
    ),

  // Academics - Assessment Components
  listAssessmentComponents: (
    examTermId: string,
    params?: { subjectId?: string | null },
  ) =>
    request<AssessmentComponentSummary[]>(
      withQuery(
        `/academics/exams/${encodeURIComponent(examTermId)}/components`,
        params ?? {},
      ),
    ),
  updateAssessmentComponent: (id: string, body: JsonBody) =>
    request<AssessmentComponentSummary>(
      `/academics/exams/components/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        json: body,
      },
    ),
  deleteAssessmentComponent: (id: string) =>
    request<{ deleted: true; assessmentComponentId: string }>(
      `/academics/exams/components/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
    ),

  // Academics - Mark Lock Requests
  listMarkLockRequests: (filters?: MarkLockFilters) =>
    request<MarkLockRequestSummary[]>(
      withQuery('/academics/marks/lock-requests', filters ?? {}),
    ),
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
    }>(`/academics/exams/${encodeURIComponent(id)}/unlock`, {
      method: 'PATCH',
      json: body,
    }),

  // Academics - CAS
  listCasRecords: (filters?: CasListFilters) =>
    request<CasRecordSummary[]>(withQuery('/academics/cas', filters ?? {})),
  updateCasRecord: (id: string, body: JsonBody) =>
    request<CasRecordSummary>(`/academics/cas/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      json: body,
    }),
  deleteCasRecord: (id: string) =>
    request<{ deleted: true; casRecordId: string }>(
      `/academics/cas/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
  batchCreateCasRecords: (body: JsonBody) =>
    request<{ created: number; entries: CasRecordSummary[] }>(
      '/academics/cas/batch',
      {
        method: 'POST',
        json: body,
      },
    ),

  // Communications - Deliveries
  retryNotificationDelivery: (deliveryId: string) =>
    request<any>(`/communications/deliveries/${encodeURIComponent(deliveryId)}/retry`, {
      method: 'POST',
    }),
  retryFailedNotificationDeliveries: () =>
    request<any>('/communications/deliveries/retry-failed', { method: 'POST' }),

  // Payroll - PDFs
  openApprovedSalarySlipPdf: async (runId: string, lineId: string) => {
    const response = await fetch(
      `${API_BASE_URL}/payroll/runs/${encodeURIComponent(runId)}/lines/${encodeURIComponent(lineId)}/salary-slip.pdf`,
      { credentials: 'include' },
    );
    await openPdfBlob(response);
  },
};

export type NotificationCenterItem = {
  id: string;
  channel: string;
  status: string;
  sourceType: string;
  sourceId: string;
  title: string;
  body: string;
  createdAt: string;
  sentAt: string | null;
  readAt: string | null;
  isRead: boolean;
  linkHref: string;
};

export type NotificationCenterSummary = {
  unreadCount: number;
  items: NotificationCenterItem[];
};

export type MarkLockFilters = {
  examTermId?: string | null;
  status?: string | null;
  requestedById?: string | null;
};

export type CasListFilters = {
  academicYearId?: string | null;
  classId?: string | null;
  sectionId?: string | null;
  subjectId?: string | null;
  studentId?: string | null;
};
export type MarkLockRequestSummary = {
  id: string;
  tenantId: string;
  examTermId: string;
  requestedById: string;
  reviewedById?: string | null;
  status: string;
  reason: string;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  examTerm?: {
    id: string;
    name: string;
    isLocked: boolean;
    academicYear?: {
      id: string;
      name: string;
    } | null;
  } | null;
  requestedBy?: {
    id: string;
    email?: string | null;
    phone?: string | null;
  } | null;
  reviewedBy?: {
    id: string;
    email?: string | null;
    phone?: string | null;
  } | null;
};
