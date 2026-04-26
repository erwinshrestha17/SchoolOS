import type {
  AcademicYearSummary,
  ActivityPost,
  AttendanceRoster,
  AuthSession,
  ClassSummary,
  ConsentRecord,
  DefaulterSummary,
  DiscountRule,
  FeeBillingRun,
  FeeHeadSummary,
  FeePlanSummary,
  InvoiceSummary,
  JournalEntryView,
  MoodLog,
  NotificationDelivery,
  ReceiptView,
  SectionSummary,
  StudentProfile,
  WaiverRecord,
} from '@schoolos/core';
import { readStoredSession } from './session';

const API_BASE_URL =
process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1'

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
  listClasses: () => request<ClassSummary[]>('/classes'),
  listSections: () => request<SectionSummary[]>('/sections'),
  listStudents: () => request<StudentProfile[]>('/students'),
  createAdmission: (body: JsonBody) =>
    request('/admissions', { method: 'POST', json: body }),
  listStudentDocuments: (studentId: string) =>
    request(withQuery('/student-documents', { studentId })),
  getAttendanceRoster: (params: {
    academicYearId: string;
    classId: string;
    sectionId?: string | null;
    attendanceDate?: string | null;
  }) => request<AttendanceRoster>(withQuery('/attendance/rosters', params)),
  listAttendanceAnalytics: () => request('/attendance/analytics'),
  submitAttendance: (body: JsonBody) =>
    request('/attendance/sessions', { method: 'POST', json: body }),
  listFeeHeads: () => request<FeeHeadSummary[]>('/fees/heads'),
  listFeePlans: () => request<FeePlanSummary[]>('/fees/plans'),
  listInvoices: () => request<InvoiceSummary[]>('/fees/invoices'),
  listBillingRuns: () => request<FeeBillingRun[]>('/fees/billing-runs'),
  generateBillingRun: (body: JsonBody) =>
    request('/fees/billing-runs', { method: 'POST', json: body }),
  listDefaulters: () => request<DefaulterSummary[]>('/fees/defaulters'),
  listDiscounts: () => request<DiscountRule[]>('/fees/discounts'),
  listWaivers: () => request<WaiverRecord[]>('/fees/waivers'),
  createFeeHead: (body: JsonBody) =>
    request('/fees/heads', { method: 'POST', json: body }),
  createFeePlan: (body: JsonBody) =>
    request('/fees/plans', { method: 'POST', json: body }),
  collectPayment: (body: JsonBody) =>
    request('/payments', { method: 'POST', json: body }),
  listReceipts: () => request<ReceiptView[]>('/receipts'),
  listLedgerEntries: () => request<JournalEntryView[]>('/ledger/entries'),
  listActivityPosts: () => request<ActivityPost[]>('/activity-feed/posts'),
  createActivityPost: (body: JsonBody) =>
    request('/activity-feed/posts', { method: 'POST', json: body }),
  listMoodLogs: () => request<MoodLog[]>('/activity-feed/mood-logs'),
  createMoodLog: (body: JsonBody) =>
    request('/activity-feed/mood-logs', { method: 'POST', json: body }),
  createNotice: (body: JsonBody) =>
    request('/notices', { method: 'POST', json: body }),
  createEvent: (body: JsonBody) =>
    request('/events', { method: 'POST', json: body }),
  listNotificationDeliveries: () =>
    request<NotificationDelivery[]>('/communications/deliveries'),
  listConsents: () => request<ConsentRecord[]>('/consents'),
};
