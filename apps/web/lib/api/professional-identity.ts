import type {
  TeacherEligibilitySummary,
  TeacherEligibilityWorkspace,
} from '@schoolos/core';
import { request, type JsonBody } from './client';

/** Phase 5J–5M professional identity (server: /hr/staff/:id/professional). */
export type ProfessionalRecordStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'REJECTED'
  | 'REVOKED'
  | 'ENDED';

export interface StaffEmploymentRecord {
  id: string;
  employmentType: string;
  postCategoryCode: string;
  schoolTypeCode: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: 'PENDING' | 'VERIFIED' | 'ENDED' | 'REJECTED';
  verifiedAt: string | null;
  endedAt: string | null;
  endReason: string | null;
}

export interface ProfessionalEvidenceRecord {
  id: string;
  subjectCode: string | null;
  levelCode: string | null;
  validFrom: string;
  validUntil: string | null;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'REVOKED';
  /** What eligibility sees: only VERIFIED within its window is CURRENT. */
  effectiveState:
    | 'PENDING'
    | 'REJECTED'
    | 'REVOKED'
    | 'CURRENT'
    | 'EXPIRED'
    | 'NOT_YET_VALID';
  documentId: string | null;
  sourceUri: string | null;
  revocationReason: string | null;
  qualification?: string;
  institution?: string | null;
  authorityCode?: string;
  /** Null when the viewer lacks `hr:documents:read` (Phase 7.10). */
  externalReference?: string | null;
}

export interface ProfessionalIdentityOverview {
  staffId: string;
  currentEmploymentId: string | null;
  employments: StaffEmploymentRecord[];
  teacherProfile: {
    id: string;
    status: 'ACTIVE' | 'INACTIVE';
    effectiveFrom: string;
    effectiveTo: string | null;
    /** True when evidence references are hidden from this viewer. */
    referencesRedacted?: boolean;
    qualifications: ProfessionalEvidenceRecord[];
    licences: ProfessionalEvidenceRecord[];
  } | null;
  recentAssessments: Array<{
    id: string;
    outcome: 'ELIGIBLE' | 'INELIGIBLE';
    reasonCode: string;
    evaluatedAt: string;
    policyVersionId: string;
  }>;
}

export interface EligibilityExceptionsReport {
  evaluatedAt: string;
  scanned: number;
  truncated: boolean;
  items: Array<{
    assignmentId: string;
    assignmentType: string;
    staff: { id: string; name: string; employeeId: string };
    className: string;
    sectionName: string;
    subjectName: string | null;
    currentReasonCode: string;
    createdUnder: {
      id: string;
      outcome: 'ELIGIBLE' | 'INELIGIBLE';
      reasonCode: string;
      evaluatedAt: string;
      policyVersionId: string;
    } | null;
  }>;
}

export type EvidenceKind = 'qualifications' | 'licences';

export interface EligibilityWorkspaceQuery {
  status?: 'ELIGIBLE' | 'NEEDS_REVIEW' | 'INELIGIBLE';
  search?: string;
  atRiskOnly?: boolean;
  horizonDays?: number;
  page?: number;
  limit?: number;
}

const base = (staffId: string) =>
  `/hr/staff/${encodeURIComponent(staffId)}/professional`;

export const professionalIdentityApi = {
  /** Phase 7.10: read-only school-wide eligibility workspace. */
  getEligibilityWorkspace: (query: EligibilityWorkspaceQuery = {}) => {
    const params = new URLSearchParams();
    if (query.status) params.set('status', query.status);
    if (query.search) params.set('search', query.search);
    if (query.atRiskOnly) params.set('atRiskOnly', 'true');
    if (query.horizonDays) params.set('horizonDays', String(query.horizonDays));
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    return request<TeacherEligibilityWorkspace>(
      `/hr/professional/eligibility-workspace${suffix}`,
    );
  },
  getEligibilitySummary: (staffId: string, horizonDays?: number) =>
    request<TeacherEligibilitySummary>(
      `${base(staffId)}/eligibility-summary${
        horizonDays ? `?horizonDays=${String(horizonDays)}` : ''
      }`,
    ),
  getEligibilityExceptions: () =>
    request<EligibilityExceptionsReport>(
      '/hr/professional/eligibility-exceptions',
    ),
  getProfessionalIdentity: (staffId: string) =>
    request<ProfessionalIdentityOverview>(base(staffId)),
  createStaffEmployment: (staffId: string, body: JsonBody) =>
    request<StaffEmploymentRecord>(`${base(staffId)}/employments`, {
      method: 'POST',
      json: body,
    }),
  reviewStaffEmployment: (
    staffId: string,
    employmentId: string,
    decision: 'VERIFY' | 'REJECT',
  ) =>
    request<StaffEmploymentRecord>(
      `${base(staffId)}/employments/${encodeURIComponent(employmentId)}/review`,
      { method: 'POST', json: { decision } },
    ),
  endStaffEmployment: (
    staffId: string,
    employmentId: string,
    body: { effectiveTo: string; reason: string },
  ) =>
    request<StaffEmploymentRecord>(
      `${base(staffId)}/employments/${encodeURIComponent(employmentId)}/end`,
      { method: 'POST', json: body },
    ),
  createTeacherProfile: (staffId: string, effectiveFrom: string) =>
    request(`${base(staffId)}/teacher-profile`, {
      method: 'POST',
      json: { effectiveFrom },
    }),
  addProfessionalEvidence: (
    staffId: string,
    kind: EvidenceKind,
    body: JsonBody,
  ) =>
    request<ProfessionalEvidenceRecord>(`${base(staffId)}/${kind}`, {
      method: 'POST',
      json: body,
    }),
  reviewProfessionalEvidence: (
    staffId: string,
    kind: EvidenceKind,
    evidenceId: string,
    decision: 'VERIFY' | 'REJECT',
  ) =>
    request<ProfessionalEvidenceRecord>(
      `${base(staffId)}/${kind}/${encodeURIComponent(evidenceId)}/review`,
      { method: 'POST', json: { decision } },
    ),
  revokeProfessionalEvidence: (
    staffId: string,
    kind: EvidenceKind,
    evidenceId: string,
    reason: string,
  ) =>
    request<ProfessionalEvidenceRecord>(
      `${base(staffId)}/${kind}/${encodeURIComponent(evidenceId)}/revoke`,
      { method: 'POST', json: { reason } },
    ),
};
