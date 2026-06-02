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
  StudentFeeClearance,
  StudentLifecycleActionResult,
  StudentProfile,
  StudentProfileDetail,
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
    page?: number;
    limit?: number;
    search?: string;
  }) =>
    request<PaginatedResponse<StudentProfile>>(
      withQuery('/students', params ?? {}),
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
  listDuplicateStudentCandidates: (params?: {
    studentId?: string;
    limit?: number;
  }) =>
    request<StudentDuplicateCandidatesResult>(
      withQuery('/students/duplicates/candidates', params ?? {}),
    ),

  uploadStudentDocument: (body: UploadStudentDocumentPayload) =>
    request('/student-documents', {
      method: 'POST',
      json: body as JsonBody,
    }),
  previewStudentDocument: (id: string) =>
    request<{ url: string }>(`/student-documents/${id}/preview`),
  downloadStudentDocument: (id: string) =>
    request<{ url: string }>(`/student-documents/${id}/download`),
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
