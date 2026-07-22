import type {
  AdmissionPolicyAuditEvent,
  ArchiveAdmissionPolicyPayload,
  AdmissionPolicyDetail,
  AdmissionPolicyListResponse,
  AdmissionPolicyTemplate,
  AdmissionPolicyVersionSummary,
  CreateAdmissionPolicyPayload,
  DuplicateAdmissionPolicyPayload,
  UpdateAdmissionPolicyIdentityPayload,
  UpdateAdmissionPolicyVersionPayload,
  UpsertApprovalChainPayload,
  UpsertDocumentRequirementPayload,
} from "@schoolos/core";
import { request } from "./client";

export const admissionPoliciesApi = {
  list: () => request<AdmissionPolicyListResponse>("/admissions/policies"),
  listTemplates: () =>
    request<AdmissionPolicyTemplate[]>("/admissions/policies/templates"),
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
  archive: (policyId: string, payload: ArchiveAdmissionPolicyPayload) =>
    request<AdmissionPolicyDetail>(`/admissions/policies/${policyId}/archive`, {
      method: "POST",
      json: payload,
    }),
  duplicate: (policyId: string, payload: DuplicateAdmissionPolicyPayload = {}) =>
    request<AdmissionPolicyDetail>(`/admissions/policies/${policyId}/duplicate`, {
      method: "POST",
      json: payload,
    }),
  replaceApprovalChain: (
    policyId: string,
    versionId: string,
    payload: UpsertApprovalChainPayload,
  ) =>
    request<AdmissionPolicyDetail>(
      `/admissions/policies/${policyId}/versions/${versionId}/approval-chain`,
      { method: "PUT", json: payload },
    ),
  deleteApprovalChain: (policyId: string, versionId: string) =>
    request<AdmissionPolicyDetail>(
      `/admissions/policies/${policyId}/versions/${versionId}/approval-chain`,
      { method: "DELETE" },
    ),
};
