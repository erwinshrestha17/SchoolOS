import type {
  AdmissionPolicyTemplate,
  AdmissionPolicyTemplateDocument,
} from '@schoolos/core';

const BASE_VERSION: AdmissionPolicyTemplate['version'] = {
  admissionMode: 'DIRECT_ALLOWED',
  transferStudent: null,
  requiredFields: [],
  requireSection: false,
  requireDocumentReview: false,
  requireInterview: false,
  requirePrincipalApproval: false,
  requireTransferCertificate: false,
  requirePriorMarksheet: false,
  requireStreamOrMarksReview: false,
  allowAdmissionWithDocumentsPending: true,
  enforceCapacityWhenAvailable: false,
  capacityOverride: null,
  notesForOffice: null,
};

function document(
  documentKind: string,
  label: string,
  sortOrder: number,
  overrides: Partial<AdmissionPolicyTemplateDocument> = {},
): AdmissionPolicyTemplateDocument {
  return {
    documentKind,
    label,
    isRequired: true,
    requiresOriginalVerification: false,
    timing: 'BEFORE_ENROLLMENT',
    expiresAfterDays: null,
    canBeWaived: false,
    waivableByRoleKeys: [],
    sortOrder,
    ...overrides,
  };
}

export const ADMISSION_POLICY_TEMPLATES = [
  {
    id: 'grade-1-10-new',
    label: 'Grade 1-10 New Admission',
    description:
      'Normal office admission for new students joining Grades 1 through 10.',
    gradeBand: null,
    applicantType: 'NEW',
    version: { ...BASE_VERSION },
    documents: [
      document('BIRTH_CERTIFICATE', 'Birth certificate', 0),
      document('STUDENT_PASSPORT_PHOTO', 'Student passport photo', 1),
      document('PARENT_GUARDIAN_CITIZENSHIP', 'Parent/guardian citizenship', 2),
      document('PREVIOUS_REPORT_CARD', 'Previous report card', 3),
    ],
  },
  {
    id: 'grade-1-10-transfer',
    label: 'Grade 1-10 Transfer Admission',
    description:
      'Document review and principal approval for students transferring from another school.',
    gradeBand: null,
    applicantType: 'TRANSFER',
    version: {
      ...BASE_VERSION,
      admissionMode: 'REVIEW_REQUIRED',
      transferStudent: true,
      requiredFields: ['previousSchool'],
      requireDocumentReview: true,
      requirePrincipalApproval: true,
      requireTransferCertificate: true,
    },
    documents: [
      document('BIRTH_CERTIFICATE', 'Birth certificate', 0),
      document('STUDENT_PASSPORT_PHOTO', 'Student passport photo', 1),
      document('PARENT_GUARDIAN_CITIZENSHIP', 'Parent/guardian citizenship', 2),
      document('PREVIOUS_REPORT_CARD', 'Previous report card', 3, {
        timing: 'BEFORE_REVIEW',
        requiresOriginalVerification: true,
      }),
      document('TRANSFER_CERTIFICATE', 'Transfer certificate', 4, {
        timing: 'BEFORE_REVIEW',
        requiresOriginalVerification: true,
      }),
      document('CHARACTER_CERTIFICATE', 'Character certificate', 5, {
        timing: 'BEFORE_REVIEW',
        requiresOriginalVerification: true,
      }),
    ],
  },
  {
    id: 'grade-11-12',
    label: 'Grade 11-12 / +2 Admission',
    description:
      'Entrance assessment, interview, and principal approval for higher secondary admission.',
    gradeBand: 'GRADE_11_12',
    applicantType: 'NEW',
    version: {
      ...BASE_VERSION,
      admissionMode: 'REVIEW_REQUIRED',
      requiredFields: ['previousSchool'],
      requireDocumentReview: true,
      requireInterview: true,
      requirePrincipalApproval: true,
      requirePriorMarksheet: true,
      requireStreamOrMarksReview: true,
    },
    documents: [
      document('SEE_MARKSHEET', 'SEE marksheet', 0, {
        timing: 'BEFORE_REVIEW',
        requiresOriginalVerification: true,
      }),
      document('CHARACTER_CERTIFICATE', 'Character certificate', 1, {
        timing: 'BEFORE_REVIEW',
        requiresOriginalVerification: true,
      }),
      document('TRANSFER_CERTIFICATE', 'Transfer certificate', 2, {
        timing: 'BEFORE_REVIEW',
        requiresOriginalVerification: true,
      }),
      document('STUDENT_PASSPORT_PHOTO', 'Student passport photo', 3),
      document('PARENT_GUARDIAN_CITIZENSHIP', 'Parent/guardian citizenship', 4),
    ],
  },
  {
    id: 'scholarship-quota',
    label: 'Scholarship / Quota Admission',
    description:
      'Committee review for scholarship or quota applicants in supported grades.',
    gradeBand: null,
    applicantType: 'BOTH',
    version: {
      ...BASE_VERSION,
      admissionMode: 'REVIEW_REQUIRED',
      requiredFields: ['previousSchool', 'guardianEmail'],
      requireDocumentReview: true,
      requirePrincipalApproval: true,
    },
    documents: [
      document('SCHOLARSHIP_PROOF', 'Scholarship proof', 0, {
        timing: 'BEFORE_REVIEW',
        requiresOriginalVerification: true,
      }),
      document('RESIDENCE_PROOF', 'Residence proof', 1, {
        timing: 'BEFORE_REVIEW',
      }),
      document('RECOMMENDATION_LETTER', 'Recommendation letter', 2, {
        timing: 'BEFORE_REVIEW',
      }),
      document('PREVIOUS_REPORT_CARD', 'Previous report card', 3, {
        timing: 'BEFORE_REVIEW',
      }),
    ],
  },
] satisfies readonly AdmissionPolicyTemplate[];

export function findAdmissionPolicyTemplate(templateId: string) {
  return ADMISSION_POLICY_TEMPLATES.find(
    (template) => template.id === templateId,
  );
}
