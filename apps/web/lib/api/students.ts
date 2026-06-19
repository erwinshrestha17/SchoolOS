import type {
  AdmissionCreationResult,
  AdmissionDuplicateCheckResult,
  AdmissionSummary,
  BulkAdmissionImportResult,
  IemisExportResult,
  PaginatedResponse,
  RevokeGeneratedStudentDocumentPayload,
  StudentArchivePayload,
  StudentAttendanceHistory,
  StudentAttendanceHistoryFilters,
  StudentDeletePayload,
  StudentDocumentHistory,
  StudentDuplicateCandidatesResult,
  DuplicateStudentMergeResult,
  StudentFeeClearance,
  StudentIemisReadinessSummary,
  StudentLifecycleActionResult,
  StudentProfile,
  StudentProfileDetail,
  StudentModuleSummary,
  StudentQrStatusHistory,
  StudentTransferPayload,
  UpdateStudentGuardianPayload,
  UpdateStudentProfilePayload,
  UploadStudentDocumentPayload,
} from '@schoolos/core';
import {
  API_BASE_URL,
  JsonBody,
  openPdfBlob,
  readFileAsBase64,
  request,
  withQuery,
} from './client';

export const studentsApi = {
  listStudents: (params?: {
    classId?: string;
    sectionId?: string;
    status?: string;
    academicYearId?: string;
    page?: number;
    limit?: number;
    search?: string;
  }) =>
    request<PaginatedResponse<StudentProfile>>(
      withQuery('/students', params ?? {}),
    ),
  getStudentModuleSummary: (params?: {
    classId?: string;
    sectionId?: string;
    status?: string;
    academicYearId?: string;
    search?: string;
  }) =>
    request<StudentModuleSummary>(
      withQuery('/students/summary', params ?? {}),
    ),
  getStudentProfile: (studentId: string) =>
    request<StudentProfileDetail>(`/students/${encodeURIComponent(studentId)}`),
  updateStudent: (studentId: string, body: UpdateStudentProfilePayload) =>
    request<StudentProfileDetail>(
      `/students/${encodeURIComponent(studentId)}`,
      {
        method: 'PATCH',
        json: body as JsonBody,
      },
    ),
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
    request<{
      credential: any;
      qrImageSvg?: string;
      qrImageAvailable: boolean;
      qrImageMessage?: string;
      rawToken?: string;
    }>(`/students/${encodeURIComponent(studentId)}/qr`, { method: 'POST' }),
  getStudentQrStatus: (studentId: string) =>
    request<StudentQrStatusHistory>(
      `/students/${encodeURIComponent(studentId)}/qr`,
    ),
  listStudentQrScans: (studentId: string) =>
    request<StudentQrScanAudit[]>(
      `/students/${encodeURIComponent(studentId)}/qr/scans`,
    ),
  rotateStudentQr: (studentId: string, body: { reason: string }) =>
    request<{
      credential: any;
      qrImageSvg?: string;
      qrImageAvailable: boolean;
      rawToken?: string;
    }>(`/students/${encodeURIComponent(studentId)}/qr/rotate`, {
      method: 'POST',
      json: body,
    }),
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
  listAdmissions: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    academicYearId?: string;
    classId?: string;
  }) =>
    request<PaginatedResponse<AdmissionSummary>>(
      withQuery('/admissions', params ?? {}),
    ),
  createAdmission: (body: JsonBody) =>
    request<AdmissionCreationResult>('/admissions', {
      method: 'POST',
      json: body,
    }),
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
    request<any[]>(withQuery('/student-documents', { studentId })),
  listStudentDocumentHistory: (studentId: string) =>
    request<StudentDocumentHistory[]>(
      withQuery('/student-documents/history', { studentId }),
    ),
  uploadStudentPhoto: async (studentId: string, file: File, note?: string) => {
    const base64Content = await readFileAsBase64(file);

    return request<{
      studentId: string;
      photoFileId: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      previewUrl: string;
      downloadUrl: string;
    }>(`/students/${encodeURIComponent(studentId)}/photo`, {
      method: 'POST',
      json: {
        fileName: file.name,
        mimeType: file.type,
        base64Content,
        ...(note ? { note } : {}),
      },
    });
  },
  removeStudentPhoto: (studentId: string) =>
    request<{ success: true; deleted: boolean }>(
      `/students/${encodeURIComponent(studentId)}/photo`,
      { method: 'DELETE' },
    ),
  getStudentPhotoPreview: (studentId: string) =>
    request<{
      studentId: string;
      photoFileId: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      url: string;
      expiresInSeconds: number;
    }>(`/students/${encodeURIComponent(studentId)}/photo/preview`),

  exportIemisStudents: () =>
    request<IemisExportResult>('/students/iemis/export'),
  listIemisReadiness: (params?: {
    classId?: string;
    sectionId?: string;
    status?: 'all' | 'ready' | 'has_issues';
  }) =>
    request<StudentIemisReadinessSummary[]>(
      withQuery('/students/iemis/validation', params ?? {}),
    ),
  getIemisReadiness: (studentId: string) =>
    request<{
      studentId: string;
      studentSystemId: string;
      fullNameEn: string;
      eligible: boolean;
      score: number;
      issues: Array<{ field: string; message: string }>;
    }>(`/students/${encodeURIComponent(studentId)}/iemis-readiness`),
  getStudentLifecycleTimeline: (studentId: string) =>
    request<any[]>(`/students/${encodeURIComponent(studentId)}/lifecycle-timeline`),
  listDuplicateStudentCandidates: (params?: {
    studentId?: string;
    limit?: number;
  }) =>
    request<StudentDuplicateCandidatesResult>(
      withQuery('/students/duplicates/candidates', params ?? {}),
    ),
  previewDuplicateStudentMerge: (body: {
    sourceStudentId: string;
    targetStudentId: string;
  }) =>
    request<{
      sourceStudent: { id: string; studentSystemId: string; fullNameEn: string; lifecycleStatus: string };
      targetStudent: { id: string; studentSystemId: string; fullNameEn: string; lifecycleStatus: string };
      mergeCounts: Record<string, number>;
      isProbableDuplicate: boolean;
    }>('/students/duplicates/merge/preview', { method: 'POST', json: body }),
  mergeDuplicateStudent: (body: {
    sourceStudentId: string;
    targetStudentId: string;
    reason: string;
  }) =>
    request<DuplicateStudentMergeResult>('/students/duplicates/merge', {
      method: 'POST',
      json: body,
    }),
  saveAdmissionDraft: (body: {
    draftKey: string;
    firstNameEn?: string;
    lastNameEn?: string;
    dateOfBirth?: string;
    guardianFullName?: string;
    guardianPhone?: string;
    academicYearId?: string;
    classId?: string;
    sectionId?: string;
    previousSchool?: string;
    payload?: Record<string, unknown>;
  }) =>
    request('/admissions/m1/drafts/autosave', {
      method: 'POST',
      json: body,
    }),
  recoverAdmissionDrafts: (params?: { draftKey?: string; guardianPhone?: string; limit?: number }) =>
    request<any[]>(withQuery('/admissions/m1/drafts/recover', params ?? {})),
  listAdmissionImportBatches: (params?: { page?: number; limit?: number; status?: string }) =>
    request<PaginatedResponse<AdmissionImportBatchSummary>>(
      withQuery('/admissions/bulk-import/batches', params ?? {}),
    ),
  getAdmissionImportBatch: (batchId: string) =>
    request<AdmissionImportBatchDetail>(
      `/admissions/bulk-import/batches/${encodeURIComponent(batchId)}`,
    ),
  listAdmissionImportReviewQueue: (params?: { status?: string; limit?: number }) =>
    request<{ items: AdmissionImportReviewRow[]; total: number; policy: string }>(
      withQuery('/admissions/m1/import-review/queue', params ?? {}),
    ),
  listDocumentExpiryTemplates: () =>
    request<DocumentExpiryTemplate[]>('/students/document-expiry/templates'),
  upsertDocumentExpiryTemplate: (body: {
    channel: 'email' | 'sms';
    reminderStatus: 'expired' | 'expiring';
    subjectTemplate?: string;
    messageTemplate: string;
    daysBeforeExpiry?: number;
    isActive?: boolean;
  }) =>
    request<DocumentExpiryTemplate>('/students/document-expiry/templates', {
      method: 'POST',
      json: body,
    }),
  removeStudentGuardianAccess: (
    studentId: string,
    guardianId: string,
    body: { reason: string; confirmFileAccessReview: true },
  ) =>
    request<{ removed: true }>(
      `/admissions/m1/students/${encodeURIComponent(studentId)}/guardians/${encodeURIComponent(guardianId)}`,
      { method: 'DELETE', json: body },
    ),

  uploadStudentDocument: (body: UploadStudentDocumentPayload) =>
    request('/student-documents', {
      method: 'POST',
      json: body as JsonBody,
    }),
  previewStudentDocument: (studentId: string, documentId: string) =>
    request<{
      documentId: string;
      studentId: string;
      fileAssetId: string;
      fileName: string;
      kind: string | null;
      url: string;
      expiresInSeconds: number;
    }>(
      `/students/${encodeURIComponent(studentId)}/documents/${encodeURIComponent(documentId)}/preview-url`,
    ),
  downloadStudentDocument: (studentId: string, documentId: string) =>
    request<{
      documentId: string;
      studentId: string;
      fileAssetId: string;
      fileName: string;
      kind: string | null;
      url: string;
      expiresInSeconds: number;
    }>(
      `/students/${encodeURIComponent(studentId)}/documents/${encodeURIComponent(documentId)}/download-url`,
    ),
  deleteStudentDocument: (id: string) =>
    request(`/student-documents/${id}`, { method: 'DELETE' }),
  verifyStudentDocument: (
    documentId: string,
    body: { status: 'VERIFIED' | 'REJECTED'; notes: string },
  ) =>
    request<{ success: boolean }>(
      `/student-documents/${encodeURIComponent(documentId)}/verify`,
      {
        method: 'POST',
        json: body,
      },
    ),
  archiveStudentDocument: (documentId: string, body: { reason: string }) =>
    request<{ success: boolean }>(
      `/student-documents/${encodeURIComponent(documentId)}/archive`,
      {
        method: 'POST',
        json: body,
      },
    ),
  openStudentDocumentPdf: async (
    studentId: string,
    kind: string,
    token?: string,
  ) => {
    const url = new URL(
      `${API_BASE_URL}/students/${encodeURIComponent(studentId)}/documents/${encodeURIComponent(kind)}.pdf`,
    );
    if (token) {
      url.searchParams.set('token', token);
    }

    const response = await fetch(url.toString(), {
      credentials: 'include',
    });

    await openPdfBlob(response);
  },
};

export type StudentQrScanAudit = {
  id: string;
  action: string;
  scannedBy: string | null;
  scannedByEmail: string | null;
  performedBy: string | null;
  performedByEmail: string | null;
  purpose: string | null;
  success: boolean | null;
  failureCode: string | null;
  reason: string | null;
  timestamp: string;
};

export type AdmissionImportBatchSummary = {
  id: string;
  sourceFileName: string;
  dryRun: boolean;
  confirmDuplicates: boolean;
  status: string;
  totalRows: number;
  createdRows: number;
  validatedRows: number;
  failedRows: number;
  createdById: string;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
};

export type AdmissionImportBatchDetail = AdmissionImportBatchSummary & {
  created: number;
  validated: number;
  failed: number;
  errorReportCsv: string;
  rows: Array<{
    rowNumber: number;
    status: string;
    studentId?: string;
    studentSystemId?: string;
    errors: unknown[];
    duplicates: unknown[];
    rawData: unknown;
  }>;
};

export type AdmissionImportReviewRow = {
  id: string;
  batchId: string;
  sourceFileName: string;
  rowNumber: number;
  status: string;
  workflowLabel: string;
  errors: unknown[];
  duplicates: unknown[];
  rawData: unknown;
  createdAt: string;
};

export type DocumentExpiryTemplate = {
  id: string;
  channel: 'email' | 'sms';
  reminderStatus: 'expired' | 'expiring';
  subjectTemplate: string | null;
  messageTemplate: string;
  daysBeforeExpiry: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
