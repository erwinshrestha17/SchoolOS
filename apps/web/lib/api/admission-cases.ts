import type {
  AdmissionCase,
  AdmissionCaseEligibility,
  AdmissionPolicy,
  CreateAdmissionCasePayload,
  DirectAdmitAdmissionCasePayload,
} from '@schoolos/core';
import { request } from './client';

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
