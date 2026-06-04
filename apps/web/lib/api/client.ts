import type {
  AcademicYearSummary,
  AdmissionCreationResult,
  AdmissionDuplicateCheckResult,
  AdmissionSummary,
  AccountingPeriodSummary,
  AccountingReport,
  ActivityGalleryItem,
  ActivityPost,
  ActivityReaction,
  AssessmentComponentSummary,
  AttendanceAnalytics,
  AttendanceConflict,
  AttendanceConflictReviewResult,
  AttendanceCorrectionRequest,
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
  NotificationDeliveryFailureSummary,
  NoticeSummary,
  PayrollRunSummary,
  PayrollPreviewResult,
  PaymentRefundPayload,
  PaymentRefundSummary,
  PaymentGatewayReadiness,
  PaginatedResult,
  PaginatedResponse,
  ParentTeacherMessageSummary,
  ParentTeacherThreadCreateResult,
  ParentTeacherThreadSummary,
  SendParentTeacherMessageResult,
  PlatformTenantSummary,
  PlatformTenantDetail,
  PlatformAuditLog,
  PlatformDashboardSummary,
  PlatformPlanSummary,
  PlatformApiKeyCreated,
  PlatformApiKeySummary,
  PlatformProviderConfigSummary,
  PlatformProviderReadinessDetail,
  PlatformWebhookDeliverySummary,
  PlatformWebhookEndpointSummary,
  PlatformQueueSummary,
  PlatformHealthSummary,
  PlatformOnboardingChecklist,
  PlatformSaaSInvoiceSummary,
  PlatformFailedJobSummary,
  PlatformTenantSubscriptionSummary,
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
  StudentDocumentHistory,
  StudentDuplicateCandidatesResult,
  IemisExportResult,
  StudentProfileDetail,
  StudentQrStatusHistory,
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
import {
  clearStoredSession,
  getSupportOverrideTenantId,
  getSupportOverrideReason,
  setSupportOverride,
  clearSupportOverride,
} from '../session';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

let refreshPromise: Promise<boolean> | null = null;

export class ApiRequestError extends Error {
  statusCode: number;
  requestId?: string;

  constructor(message: string, statusCode: number, requestId?: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.statusCode = statusCode;
    this.requestId = requestId;
  }
}

export type JsonBody = Record<string, unknown>;

export type AuthChallengeResponse = {
  requiresMfa: true;
  challengeToken: string;
  challengeExpiresAt: string;
  delivery: string;
};

export type TenantLogoAccess = {
  fileAssetId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  expiresInSeconds: number;
};

export type TenantLogoUploadResult = Omit<
  TenantLogoAccess,
  'url' | 'expiresInSeconds'
> & {
  previewUrl: string;
  downloadUrl: string;
};

export type HomeworkAttachmentAccess = {
  attachmentId: string;
  homeworkId: string;
  submissionId: string | null;
  assignmentId: string | null;
  fileAssetId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  expiresInSeconds: number;
};

export type RequestOptions = RequestInit & {
  auth?: boolean;
  json?: JsonBody;
  retryOnUnauthorized?: boolean;
};

export type AssignPlatformTenantSubscriptionPayload = Record<
  string,
  unknown
> & {
  planId: string;
  status: 'TRIAL' | 'ACTIVE' | 'GRACE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED';
  startsAt?: string;
  endsAt?: string;
  renewsAt?: string;
  trialEndsAt?: string;
  notes?: string;
};

export type PlatformSupportOverridePayload = Record<string, unknown> & {
  tenantId: string;
  reason: string;
  durationMinutes?: number;
};

export type PlatformAuditLogFilters = {
  page?: number;
  limit?: number;
  tenantId?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
};

export type StaffLifecycleHistoryEvent = {
  id: string;
  staffId: string;
  eventType: string;
  eventDate: string;
  reason?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  createdBy?: {
    id: string;
    email: string;
    staff?: {
      firstName?: string | null;
      lastName?: string | null;
    } | null;
  } | null;
};

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
}

export async function request<T>(path: string, init?: RequestOptions) {
  const requestId = createRequestId();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Request-Id': requestId,
    ...((init?.headers as Record<string, string>) ?? {}),
  };

  const method = init?.method?.toUpperCase() ?? 'GET';
  const unsafeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (unsafeMethods.includes(method)) {
    const csrfToken =
      getCookie('__Host-schoolos_csrf') ?? getCookie('schoolos_csrf');
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
  }

  const overrideTenantId = getSupportOverrideTenantId();
  const overrideReason = getSupportOverrideReason();
  if (overrideTenantId) {
    headers['X-SchoolOS-Tenant-Id'] = overrideTenantId;
  }
  if (overrideReason) {
    headers['X-SchoolOS-Tenant-Override-Reason'] = overrideReason;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers,
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

    const responseRequestId = response.headers.get('x-request-id') ?? requestId;

    throw new ApiRequestError(
      parseApiErrorMessage(text) ||
        `Request failed with status ${response.status}`,
      response.status,
      responseRequestId,
    );
  }

  const payload = (await response.json()) as ApiResponse<T>;
  return payload.data;
}

export function createRequestId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return `web-${Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')}`;
  }

  throw new Error('Secure random request IDs are unavailable');
}

export function readFileAsBase64(file: File) {
  const reader = new FileReader();

  return new Promise<string>((resolve, reject) => {
    reader.onload = () => {
      const encoded = String(reader.result ?? '').split(',')[1] ?? '';
      resolve(encoded);
    };
    reader.onerror = () => reject(new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });
}

export function parseApiErrorMessage(text: string) {
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

export async function openPdfBlob(response: Response) {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      parseApiErrorMessage(text) ||
        `Request failed with status ${response.status}`,
    );
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

export async function downloadCsv(path: string, fileName: string) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
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
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export async function downloadReport(reportKey: string, payload: ReportExportRequest) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const csrfToken =
    getCookie('__Host-schoolos_csrf') ?? getCookie('schoolos_csrf');
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const response = await fetch(
    `${API_BASE_URL}/reports/${encodeURIComponent(reportKey)}/export`,
    {
      method: 'POST',
      credentials: 'include',
      headers,
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

  if (contentType.includes('application/json')) {
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

export async function refreshAccessCookie() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      const csrfToken =
        getCookie('__Host-schoolos_csrf') ?? getCookie('schoolos_csrf');
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers,
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

export function withQuery(path: string, params: Record<string, any>) {
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
  return 'user' in value;
}


export const filesApi = {
    uploadFile: async (file: File, module: string, entityId?: string) => {
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve) => {
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.readAsDataURL(file);
    });

    const base64Content = await base64Promise;

    return request<{
      id: string;
      fileName: string;
      publicUrl: string | null;
      protectedUrl?: string;
    }>('/files/upload', {
      method: 'POST',
      json: {
        fileName: file.name,
        contentType: file.type,
        base64Content,
        module,
        ...(entityId ? { entityId } : {}),
      },
    });
  },
    getFileView: (id: string) =>
    request<{
      id: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      url: string;
    }>(`/files/${encodeURIComponent(id)}/view`),

};


// Tail Type Definitions
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
