import type {
  AdmissionCase,
  AdmissionCaseEligibility,
  AdmissionCaseQueueItem,
  AdmissionCaseQueueName,
  AdmissionCaseQueuePage,
  AdmissionAssessmentCandidatePage,
  AdmissionAssessmentMode,
  AdmissionAssessmentResult,
  AdmissionAssessmentSessionSummary,
  AdmissionAssessmentSessionPage,
  AdmissionAssessmentTab,
  AdmissionDocumentRequestPage,
  AdmissionDocumentReminderBatchResult,
  AdmissionDocumentTiming,
  CreateAdmissionCasePayload,
  DirectAdmitAdmissionCasePayload,
  ReviewAdmissionCasePayload,
  WaiveCaseDocumentPayload,
} from "@schoolos/core";
import { request } from "./client";

export type AdmissionCaseQueue = AdmissionCaseQueueName;
export type { AdmissionCaseQueueItem };

export type AdmissionFollowUp = {
  code: string;
  label: string;
  blocking: boolean;
};

export const admissionCasesApi = {
  listAssessmentSessions: (query: {
    tab?: AdmissionAssessmentTab;
    policyId?: string;
    classId?: string;
    page?: number;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (query.tab) searchParams.set("tab", query.tab);
    if (query.policyId) searchParams.set("policyId", query.policyId);
    if (query.classId) searchParams.set("classId", query.classId);
    if (query.page) searchParams.set("page", String(query.page));
    if (query.limit) searchParams.set("limit", String(query.limit));
    const suffix = searchParams.toString();
    return request<AdmissionAssessmentSessionPage>(
      `/admissions/assessment-sessions${suffix ? `?${suffix}` : ""}`,
    );
  },
  listAssessmentCandidates: (query: {
    admissionCaseId?: string;
    policyId?: string;
    classId?: string;
    page?: number;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (query.admissionCaseId)
      searchParams.set("admissionCaseId", query.admissionCaseId);
    if (query.policyId) searchParams.set("policyId", query.policyId);
    if (query.classId) searchParams.set("classId", query.classId);
    if (query.page) searchParams.set("page", String(query.page));
    if (query.limit) searchParams.set("limit", String(query.limit));
    const suffix = searchParams.toString();
    return request<AdmissionAssessmentCandidatePage>(
      `/admissions/assessment-candidates${suffix ? `?${suffix}` : ""}`,
    );
  },
  scheduleAssessmentSession: (
    admissionCaseId: string,
    payload: {
      bsDate: string;
      startTime: string;
      durationMinutes?: number;
      mode?: AdmissionAssessmentMode;
      location?: string;
      notes?: string;
    },
  ) =>
    request<AdmissionAssessmentSessionSummary>(
      `/admissions/cases/${admissionCaseId}/assessment-session`,
      {
        method: "POST",
        json: payload,
      },
    ),
  recordAssessmentResult: (
    assessmentSessionId: string,
    payload: {
      result: AdmissionAssessmentResult;
      score?: number;
      notes?: string;
    },
  ) =>
    request<AdmissionAssessmentSessionSummary>(
      `/admissions/assessment-sessions/${assessmentSessionId}/result`,
      {
        method: "POST",
        json: payload,
      },
    ),
  listDocumentRequests: (query: {
    policyId?: string;
    classId?: string;
    documentKind?: string;
    timing?: AdmissionDocumentTiming | "";
    minDaysPending?: number;
    page?: number;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (query.policyId) searchParams.set("policyId", query.policyId);
    if (query.classId) searchParams.set("classId", query.classId);
    if (query.documentKind?.trim()) {
      searchParams.set("documentKind", query.documentKind.trim());
    }
    if (query.timing) searchParams.set("timing", query.timing);
    if (query.minDaysPending !== undefined) {
      searchParams.set("minDaysPending", String(query.minDaysPending));
    }
    if (query.page) searchParams.set("page", String(query.page));
    if (query.limit) searchParams.set("limit", String(query.limit));
    const suffix = searchParams.toString();
    return request<AdmissionDocumentRequestPage>(
      `/admissions/document-requests${suffix ? `?${suffix}` : ""}`,
    );
  },
  requestDocumentReminders: (admissionCaseIds: string[]) =>
    request<AdmissionDocumentReminderBatchResult>(
      "/admissions/document-requests/reminders",
      {
        method: "POST",
        json: { admissionCaseIds },
      },
    ),
  listQueues: (query: {
    queue?: AdmissionCaseQueue;
    page?: number;
    limit?: number;
    search?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (query.queue) searchParams.set("queue", query.queue);
    if (query.page) searchParams.set("page", String(query.page));
    if (query.limit) searchParams.set("limit", String(query.limit));
    if (query.search?.trim()) searchParams.set("search", query.search.trim());
    const suffix = searchParams.toString();
    return request<AdmissionCaseQueuePage>(
      `/admissions/cases${suffix ? `?${suffix}` : ""}`,
    );
  },
  getStudentFollowUps: (studentId: string) =>
    request<{
      admissionCaseId: string | null;
      updatedAt: string | null;
      items: AdmissionFollowUp[];
    }>(`/admissions/students/${studentId}/follow-ups`),
  createCase: (payload: CreateAdmissionCasePayload) =>
    request<AdmissionCase>("/admissions/cases", {
      method: "POST",
      json: payload,
    }),
  getCase: (admissionCaseId: string) =>
    request<AdmissionCase>(`/admissions/cases/${admissionCaseId}`),
  getEligibility: (admissionCaseId: string) =>
    request<
      AdmissionCaseEligibility & {
        admissionCaseId: string;
        displayStatus: string;
      }
    >(`/admissions/cases/${admissionCaseId}/eligibility`),
  updateCase: (
    admissionCaseId: string,
    payload: Partial<CreateAdmissionCasePayload>,
  ) =>
    request<AdmissionCase>(`/admissions/cases/${admissionCaseId}`, {
      method: "PATCH",
      json: payload,
    }),
  waiveDocument: (admissionCaseId: string, payload: WaiveCaseDocumentPayload) =>
    request<AdmissionCase>(
      `/admissions/cases/${admissionCaseId}/documents/waive`,
      { method: "POST", json: payload },
    ),
  removeDocumentWaiver: (
    admissionCaseId: string,
    payload: WaiveCaseDocumentPayload,
  ) =>
    request<AdmissionCase>(
      `/admissions/cases/${admissionCaseId}/documents/unwaive`,
      { method: "POST", json: payload },
    ),
  reviewCase: (admissionCaseId: string, payload: ReviewAdmissionCasePayload) =>
    request<AdmissionCase>(`/admissions/cases/${admissionCaseId}/review`, {
      method: "POST",
      json: payload,
    }),
  directAdmit: (
    admissionCaseId: string,
    payload: DirectAdmitAdmissionCasePayload,
  ) =>
    request<{
      admissionCaseId: string;
      alreadyAdmitted: boolean;
      student: { id: string; studentSystemId: string; fullNameEn: string };
      redirectPath: string;
    }>(`/admissions/cases/${admissionCaseId}/direct-admit`, {
      method: "POST",
      json: payload,
    }),
  finalize: (
    admissionCaseId: string,
    payload: DirectAdmitAdmissionCasePayload,
  ) =>
    request<{
      admissionCaseId: string;
      alreadyAdmitted: boolean;
      student: { id: string; studentSystemId: string; fullNameEn: string };
      redirectPath: string;
    }>(`/admissions/cases/${admissionCaseId}/finalize`, {
      method: "POST",
      json: payload,
    }),
};
