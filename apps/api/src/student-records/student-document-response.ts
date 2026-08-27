import type { StudentDocument } from '@prisma/client';

type StudentDocumentResponseSource = Pick<
  StudentDocument,
  | 'id'
  | 'studentId'
  | 'fileId'
  | 'kind'
  | 'status'
  | 'title'
  | 'fileName'
  | 'contentType'
  | 'sizeBytes'
  | 'notes'
  | 'expiryDate'
  | 'verifiedAt'
  | 'verifiedById'
  | 'uploadedById'
  | 'createdAt'
>;

export function toStudentDocumentResponse(
  document: StudentDocumentResponseSource,
) {
  return {
    id: document.id,
    studentId: document.studentId,
    fileId: document.fileId,
    kind: document.kind,
    status: document.status,
    title: document.title,
    fileName: document.fileName,
    contentType: document.contentType,
    sizeBytes: document.sizeBytes,
    notes: document.notes,
    expiryDate: document.expiryDate?.toISOString() ?? null,
    verifiedAt: document.verifiedAt?.toISOString() ?? null,
    verifiedById: document.verifiedById,
    uploadedById: document.uploadedById,
    uploadedAt: document.createdAt.toISOString(),
  };
}
