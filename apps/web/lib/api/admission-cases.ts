import type {
  AdmissionCase,
  AdmissionCaseEligibility,
  AdmissionPolicy,
  CreateAdmissionCasePayload,
  DirectAdmitAdmissionCasePayload,
} from '@schoolos/core';
import { request } from './client';

export type AdmissionCaseQueue =
  | 'NEEDS_INFORMATION'
  | 'WAITING_FOR_REVIEW'
  | 'READY_TO_ADMIT'
  | 'APPROVED'
  | 'NOT_ADMITTED'
  | 'DOCUMENTS_PENDING'
  | 'DUPLICATE_WARNINGS';

export type AdmissionCaseQueueItem = {
  id: string;
  displayStatus: string;
  fullNameEn: string;
  guardianFullName: string | null;
  guardianPhone: string | null;
  source: string;
  classId: string | null;
  sectionId: string | null;
  admittedStudentId: string | null;
  hasDuplicateWarning: boolean;
  hasDocumentsPending: boolean;
  updatedAt: string;
};

export type AdmissionFollowUp = {
  code: string;
  label: string;
  blocking: boolean;
};

export type ReviewAdmissionCasePayload = {
  action:
    | 'REQUEST_INFORMATION'
    | 'ASSIGN_REVIEWER'
    | 'MARK_READY_FOR_REVIEW'
    | 'APPROVE'
    | 'REJECT'
    | 'ESCALATE_TO_PRINCIPAL'
    | 'CLOSE';
  reviewerUserId?: string;
  reason?: string;
  dueDate?: string;
};

export const admissionCasesApi = {
  getPolicy: () => request<AdmissionPolicy>('/admissions/policy'),
  updatePolicy: (payload: AdmissionPolicy) =>
    request<AdmissionPolicy>('/admissions/policy', { method: 'PUT', json: payload }),
  listQueues: (query: { queue?: AdmissionCaseQueue; page?: number; limit?: number; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (query.queue) searchParams.set('queue', query.queue);
    if (query.page) searchParams.set('page', String(query.page));
    if (query.limit) searchParams.set('limit', String(query.limit));
    if (query.search?.trim()) searchParams.set('search', query.search.trim());
    const suffix = searchParams.toString();
    return request<{
      items: AdmissionCaseQueueItem[];
      total: number;
      page: number;
      limit: number;
      hasNextPage: boolean;
    }>(`/admissions/cases${suffix ? `?${suffix}` : ''}`);
  },
  getStudentFollowUps: (studentId: string) =>
    request<{ admissionCaseId: string | null; updatedAt: string | null; items: AdmissionFollowUp[] }>(
      `/admissions/students/${studentId}/follow-ups`,
    ),
  createCase: (payload: CreateAdmissionCasePayload) =>
    request<AdmissionCase>('/admissions/cases', { method: 'POST', json: payload }),
  getCase: (admissionCaseId: string) =>
    request<AdmissionCase>(`/admissions/cases/${admissionCaseId}`),
  getEligibility: (admissionCaseId: string) =>
    request<AdmissionCaseEligibility & { admissionCaseId: string; displayStatus: string }>(
      `/admissions/cases/${admissionCaseId}/eligibility`,
    ),
  updateCase: (admissionCaseId: string, payload: Partial<CreateAdmissionCasePayload>) =>
    request<AdmissionCase>(`/admissions/cases/${admissionCaseId}`, {
      method: 'PATCH',
      json: payload,
    }),
  reviewCase: (admissionCaseId: string, payload: ReviewAdmissionCasePayload) =>
    request<AdmissionCase>(`/admissions/cases/${admissionCaseId}/review`, {
      method: 'POST',
      json: payload,
    }),
  directAdmit: (admissionCaseId: string, payload: DirectAdmitAdmissionCasePayload) =>
    request<{
      admissionCaseId: string;
      alreadyAdmitted: boolean;
      student: { id: string; studentSystemId: string; fullNameEn: string };
      redirectPath: string;
    }>(`/admissions/cases/${admissionCaseId}/direct-admit`, {
      method: 'POST',
      json: payload,
    }),
  finalize: (admissionCaseId: string, payload: DirectAdmitAdmissionCasePayload) =>
    request<{
      admissionCaseId: string;
      alreadyAdmitted: boolean;
      student: { id: string; studentSystemId: string; fullNameEn: string };
      redirectPath: string;
    }>(`/admissions/cases/${admissionCaseId}/finalize`, {
      method: 'POST',
      json: payload,
    }),
};
