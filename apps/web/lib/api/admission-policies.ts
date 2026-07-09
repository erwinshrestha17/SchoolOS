import type {
  AdmissionPolicyAuditEvent,
  AdmissionPolicyDetail,
  AdmissionPolicyListResponse,
  AdmissionPolicyVersionSummary,
  CreateAdmissionPolicyPayload,
  DuplicateAdmissionPolicyPayload,
  UpdateAdmissionPolicyIdentityPayload,
  UpdateAdmissionPolicyVersionPayload,
  UpsertDocumentRequirementPayload,
} from "@schoolos/core";
import { request } from "./client";

export const admissionPoliciesApi = {
  list: () => request<AdmissionPolicyListResponse>("/admissions/policies"),
  get: (policyId: string) =>
    request<AdmissionPolicyDetail>(`/admissions/policies/${policyId}`),
  listVersions: (policyId: string) =>
    request<AdmissionPolicyVersionSummary[]>(
      `/admissions/policies/${policyId}/versions`,
    ),
  listAuditTrail: (policyId: string) =>
    request<AdmissionPolicyAuditEvent[]>(
      `/admissions/policies/${policyId}/audit`,
    ),
  create: (payload: CreateAdmissionPolicyPayload) =>
    request<AdmissionPolicyDetail>("/admissions/policies", {
      method: "POST",
      json: payload,
    }),
  updateIdentity: (
    policyId: string,
    payload: UpdateAdmissionPolicyIdentityPayload,
  ) =>
    request<AdmissionPolicyDetail>(`/admissions/policies/${policyId}`, {
      method: "PATCH",
      json: payload,
    }),
  updateDraftVersion: (
    policyId: string,
    payload: UpdateAdmissionPolicyVersionPayload,
  ) =>
    request<AdmissionPolicyDetail>(
      `/admissions/policies/${policyId}/draft-version`,
      { method: "PATCH", json: payload },
    ),
  startDraftVersion: (policyId: string) =>
    request<AdmissionPolicyDetail>(
      `/admissions/policies/${policyId}/draft-version`,
      { method: "POST" },
    ),
  upsertDocumentRequirement: (
    policyId: string,
    versionId: string,
    payload: UpsertDocumentRequirementPayload,
  ) =>
    request(
      `/admissions/policies/${policyId}/versions/${versionId}/document-requirements`,
      { method: "POST", json: payload },
    ),
  deleteDocumentRequirement: (
    policyId: string,
    versionId: string,
    requirementId: string,
  ) =>
    request(
      `/admissions/policies/${policyId}/versions/${versionId}/document-requirements/${requirementId}`,
      { method: "DELETE" },
    ),
  activate: (policyId: string, versionId: string) =>
    request<AdmissionPolicyDetail>(`/admissions/policies/${policyId}/activate`, {
      method: "POST",
      json: { versionId },
    }),
  archive: (policyId: string) =>
    request<AdmissionPolicyDetail>(`/admissions/policies/${policyId}/archive`, {
      method: "POST",
    }),
  duplicate: (policyId: string, payload: DuplicateAdmissionPolicyPayload = {}) =>
    request<AdmissionPolicyDetail>(`/admissions/policies/${policyId}/duplicate`, {
      method: "POST",
      json: payload,
    }),
};
