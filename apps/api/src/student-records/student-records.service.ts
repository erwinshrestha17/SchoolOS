import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  FileStatus,
  Prisma,
  StudentDocumentKind,
  type StudentDocument,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateSiblingGroupDto } from './dto/create-sibling-group.dto';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { UploadStudentDocumentDto } from './dto/upload-student-document.dto';
import { assertProtectedFileAccessAllowed } from '../common/security/support-override-file-access';
import { toStudentDocumentResponse } from './student-document-response';

@Injectable()
export class StudentRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
    private readonly fileRegistryService: FileRegistryService,
  ) {}

  async listDocuments(actor: AuthContext, studentId?: string) {
    assertProtectedFileAccessAllowed(actor);
    const documents = await this.prisma.studentDocument.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(studentId ? { studentId } : {}),
      },
      select: {
        id: true,
        studentId: true,
        fileId: true,
        kind: true,
        status: true,
        title: true,
        fileName: true,
        contentType: true,
        sizeBytes: true,
        notes: true,
        expiryDate: true,
        verifiedAt: true,
        verifiedById: true,
        uploadedById: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    });

    return documents.map(toStudentDocumentResponse);
  }

  async listDocumentHistory(actor: AuthContext, studentId?: string) {
    assertProtectedFileAccessAllowed(actor);
    const history = await this.prisma.studentDocumentHistory.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(studentId
          ? {
              document: {
                studentId,
                tenantId: actor.tenantId,
              },
            }
          : {}),
      },
      select: {
        id: true,
        documentId: true,
        action: true,
        documentTitle: true,
        documentKind: true,
        performedBy: true,
        reason: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    });

    return history.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    }));
  }

  async attachRegisteredAdmissionDocuments(
    tx: Prisma.TransactionClient,
    input: {
      tenantId: string;
      studentId: string;
      admissionCaseId: string;
      documents: Array<{ fileId: string; kind: string; title?: string }>;
      userId: string;
    },
  ) {
    for (const reference of input.documents) {
      const existing = await tx.studentDocument.findFirst({
        where: {
          tenantId: input.tenantId,
          studentId: input.studentId,
          fileId: reference.fileId,
        },
        select: { id: true },
      });
      if (existing) continue;

      const asset = await tx.fileAsset.findFirst({
        where: {
          id: reference.fileId,
          tenantId: input.tenantId,
          softDeletedAt: null,
          deletedAt: null,
        },
      });
      if (
        asset?.status !== FileStatus.UPLOADED ||
        asset.module !== 'admissions' ||
        (asset.entityId !== input.admissionCaseId &&
          (asset.entityId !== null || asset.uploadedByUserId !== input.userId))
      ) {
        throw new BadRequestException(
          'One or more admission documents are unavailable for this school.',
        );
      }

      await this.fileRegistryService.linkToEntityInTransaction(tx, {
        tenantId: input.tenantId,
        assetId: asset.id,
        module: 'students',
        entityId: input.studentId,
        ownerType: 'student',
        ownerId: input.studentId,
        userId: input.userId,
      });

      const document = await tx.studentDocument.create({
        data: {
          tenantId: input.tenantId,
          studentId: input.studentId,
          fileId: asset.id,
          kind: normalizeAdmissionDocumentKind(reference.kind),
          title: reference.title?.trim() || asset.originalFilename,
          fileName: asset.originalFilename,
          contentType: asset.mimeType,
          sizeBytes: Number(asset.sizeBytes),
          provider: asset.storageProvider,
          objectKey: asset.objectKey,
          uploadedById: input.userId,
          notes: `Linked from admission case ${input.admissionCaseId}`,
        },
      });

      await tx.studentDocumentHistory.create({
        data: {
          tenantId: input.tenantId,
          documentId: document.id,
          action: 'UPLOAD',
          documentTitle: document.title,
          documentKind: document.kind,
          performedBy: input.userId,
          reason: 'Linked during admission finalization',
          metadata: { admissionCaseId: input.admissionCaseId },
        },
      });
    }
  }

  async uploadDocument(
    dto: UploadStudentDocumentDto,
    actor: AuthContext,
    options: { idempotencyKey?: string } = {},
  ) {
    const student = await this.prisma.student.findFirst({
      where: {
        id: dto.studentId,
        tenantId: actor.tenantId,
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
    }

    const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]);

    if (
      dto.contentType &&
      !ALLOWED_DOCUMENT_MIME_TYPES.has(dto.contentType.toLowerCase())
    ) {
      throw new BadRequestException(
        `File type ${dto.contentType} is not allowed for student documents. Only PDF, JPEG, PNG, WEBP, and DOC/DOCX are permitted.`,
      );
    }

    const expiryDate = parseOptionalDocumentExpiryDate(dto.expiryDate);
    const contentChecksumSha256 = createHash('sha256')
      .update(Buffer.from(dto.base64Content, 'base64'))
      .digest('hex');
    const idempotencyKey = options.idempotencyKey?.trim() || null;
    if (idempotencyKey) {
      const replay = await this.prisma.studentDocument.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId: actor.tenantId,
            idempotencyKey,
          },
        },
      });
      if (replay) {
        this.assertDocumentReplayMatches(replay, {
          studentId: student.id,
          kind: dto.kind,
          contentChecksumSha256,
        });
        return toStudentDocumentResponse(replay);
      }
    }

    const stored = await this.storageService.saveBase64Object({
      tenantId: actor.tenantId,
      prefix: `students/${student.id}/documents`,
      fileName: dto.fileName,
      contentType: dto.contentType,
      base64Content: dto.base64Content,
    });

    let assetId: string | null = null;
    let document: StudentDocument;
    try {
      const asset = await this.fileRegistryService.registerFile({
        tenantId: actor.tenantId,
        uploadedByUserId: actor.userId,
        originalFilename: dto.fileName,
        objectKey: stored.objectKey,
        mimeType: dto.contentType,
        sizeBytes: stored.sizeBytes,
        provider: stored.provider,
        bucket: stored.bucket,
        checksumSha256: stored.checksumSha256,
        module: 'students',
        entityId: student.id,
        metadata: {
          kind: dto.kind,
          title: dto.title ?? dto.fileName,
          source: 'student_document',
          idempotencyKey,
        },
      });
      assetId = asset.id;
      await this.fileRegistryService.markUploaded(
        actor.tenantId,
        asset.id,
        actor.userId,
      );

      document = await this.prisma.$transaction(async (tx) => {
        const created = await tx.studentDocument.create({
          data: {
            tenantId: actor.tenantId,
            studentId: student.id,
            fileId: asset.id,
            idempotencyKey,
            contentChecksumSha256,
            kind: dto.kind,
            title: dto.title ?? dto.fileName,
            fileName: dto.fileName,
            contentType: dto.contentType,
            sizeBytes: stored.sizeBytes,
            provider: stored.provider,
            objectKey: stored.objectKey,
            publicUrl: stored.publicUrl,
            status: 'ACTIVE',
            uploadedById: actor.userId,
            notes: dto.notes,
            expiryDate,
          },
        });

        await tx.studentDocumentHistory.create({
          data: {
            tenantId: actor.tenantId,
            documentId: created.id,
            action: 'UPLOAD_PENDING_REVIEW',
            documentTitle: created.title,
            documentKind: created.kind,
            performedBy: actor.userId,
            reason: dto.reason,
            metadata: {
              originalFilename: dto.fileName,
              sizeBytes: stored.sizeBytes,
              expiryDate: expiryDate?.toISOString() ?? null,
            },
          },
        });

        return created;
      });
    } catch (error) {
      if (assetId) {
        await this.fileRegistryService
          .softDeleteFile(actor.tenantId, assetId, actor.userId)
          .catch(() => undefined);
      }
      await this.storageService
        .deleteObject(stored.objectKey)
        .catch(() => undefined);

      if (!idempotencyKey || !isPrismaUniqueConstraintError(error)) {
        throw error;
      }

      const concurrentReplay = await this.prisma.studentDocument.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId: actor.tenantId,
            idempotencyKey,
          },
        },
      });
      if (!concurrentReplay) throw error;

      this.assertDocumentReplayMatches(concurrentReplay, {
        studentId: student.id,
        kind: dto.kind,
        contentChecksumSha256,
      });
      return toStudentDocumentResponse(concurrentReplay);
    }

    await this.auditService.record({
      action: 'upload',
      resource: 'student_document',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: document.id,
      after: {
        studentId: student.id,
        kind: document.kind,
        fileName: document.fileName,
        status: 'ACTIVE',
        expiryDate: expiryDate?.toISOString() ?? null,
      },
    });

    return toStudentDocumentResponse(document);
  }

  private assertDocumentReplayMatches(
    document: {
      studentId: string;
      kind: StudentDocumentKind;
      contentChecksumSha256: string | null;
    },
    expected: {
      studentId: string;
      kind: StudentDocumentKind;
      contentChecksumSha256: string;
    },
  ) {
    if (
      document.studentId !== expected.studentId ||
      document.kind !== expected.kind ||
      document.contentChecksumSha256 !== expected.contentChecksumSha256
    ) {
      throw new ConflictException(
        'Document upload idempotency key is linked to different document content.',
      );
    }
  }

  async listSiblingGroups(actor: AuthContext) {
    return this.prisma.siblingGroup.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        members: {
          include: {
            student: {
              select: {
                id: true,
                studentSystemId: true,
                firstNameEn: true,
                lastNameEn: true,
                firstNameNp: true,
                lastNameNp: true,
                class: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                sectionRef: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    });
  }

  async createSiblingGroup(dto: CreateSiblingGroupDto, actor: AuthContext) {
    const students = await this.prisma.student.findMany({
      where: {
        tenantId: actor.tenantId,
        id: {
          in: dto.members.map((member) => member.studentId),
        },
      },
    });

    if (students.length !== dto.members.length) {
      throw new NotFoundException(
        'One or more students were not found in this tenant',
      );
    }

    const group = await this.prisma.siblingGroup.create({
      data: {
        tenantId: actor.tenantId,
        name: dto.name,
        notes: dto.notes ?? null,
        members: {
          create: dto.members.map((member) => ({
            tenantId: actor.tenantId,
            studentId: member.studentId,
            relationship: member.relationship ?? null,
          })),
        },
      },
      include: {
        members: {
          include: {
            student: true,
          },
        },
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'sibling_group',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: group.id,
      after: {
        name: group.name,
        studentIds: dto.members.map((member) => member.studentId),
      },
    });

    return group;
  }

  async getSignedUrl(
    actor: AuthContext,
    assetId: string,
    action: 'preview' | 'download',
  ) {
    assertProtectedFileAccessAllowed(actor);
    const asset = await this.prisma.fileAsset.findFirst({
      where: {
        id: assetId,
        tenantId: actor.tenantId,
      },
    });

    if (!asset) {
      throw new NotFoundException('File not found');
    }

    const doc = await this.prisma.studentDocument.findFirst({
      where: {
        tenantId: actor.tenantId,
        OR: [{ fileId: asset.id }, { objectKey: asset.objectKey }],
      },
    });

    if (!doc) {
      throw new NotFoundException('Student document not found in this tenant');
    }

    await this.fileRegistryService.auditAccess(
      actor.tenantId,
      asset.id,
      actor.userId,
      action,
    );

    await this.prisma.studentDocumentHistory.create({
      data: {
        tenantId: actor.tenantId,
        documentId: doc.id,
        action: action === 'preview' ? 'PREVIEW' : 'DOWNLOAD',
        documentTitle: doc.title,
        documentKind: doc.kind,
        performedBy: actor.userId,
        metadata: {
          fileAssetId: asset.id,
          result: 'SIGNED_URL_CREATED',
        },
      },
    });

    let url: string;
    try {
      url = await this.fileRegistryService.getSignedUrl(
        actor.tenantId,
        asset.id,
      );
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw new NotFoundException('File not found');
      }
      throw error;
    }

    return { url };
  }

  async deleteDocument(actor: AuthContext, assetId: string, reason?: string) {
    const asset = await this.prisma.fileAsset.findFirst({
      where: {
        id: assetId,
        tenantId: actor.tenantId,
      },
    });

    if (!asset) {
      throw new NotFoundException('File asset not found');
    }

    const document = await this.prisma.studentDocument.findFirst({
      where: {
        tenantId: actor.tenantId,
        objectKey: asset.objectKey,
      },
    });

    await this.prisma.$transaction(async (tx) => {
      if (document) {
        await tx.studentDocumentHistory.create({
          data: {
            tenantId: actor.tenantId,
            documentId: document.id,
            action: 'DELETE',
            documentTitle: document.title,
            documentKind: document.kind,
            performedBy: actor.userId,
            reason: reason ?? 'Manual deletion',
          },
        });
      }

      await this.fileRegistryService.softDeleteFile(
        actor.tenantId,
        assetId,
        actor.userId,
      );
    });

    return { success: true };
  }

  async archiveDocument(
    actor: AuthContext,
    documentId: string,
    reason?: string,
  ) {
    const document = await this.prisma.studentDocument.findFirst({
      where: { id: documentId, tenantId: actor.tenantId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.studentDocument.update({
        where: { id: documentId },
        data: { status: 'ARCHIVED' },
      });

      await tx.studentDocumentHistory.create({
        data: {
          tenantId: actor.tenantId,
          documentId: document.id,
          action: 'ARCHIVE',
          documentTitle: document.title,
          documentKind: document.kind,
          performedBy: actor.userId,
          reason: reason ?? 'Archived for record keeping',
        },
      });
    });

    return { success: true };
  }

  async verifyDocument(
    actor: AuthContext,
    documentId: string,
    status: 'VERIFIED' | 'REJECTED',
    notes?: string,
  ) {
    const document = await this.prisma.studentDocument.findFirst({
      where: { id: documentId, tenantId: actor.tenantId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }
    if (status === 'REJECTED' && !notes?.trim()) {
      throw new BadRequestException('Rejection reason is required.');
    }
    const reviewedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.studentDocument.update({
        where: { id: documentId },
        data: {
          status,
          verifiedAt: status === 'VERIFIED' ? reviewedAt : null,
          verifiedById: actor.userId,
          notes: notes
            ? `${document.notes ?? ''}\nVerification Note: ${notes}`.trim()
            : document.notes,
        },
      });

      await tx.studentDocumentHistory.create({
        data: {
          tenantId: actor.tenantId,
          documentId: document.id,
          action: status,
          documentTitle: document.title,
          documentKind: document.kind,
          performedBy: actor.userId,
          reason: notes,
          metadata: {
            reviewedById: actor.userId,
            reviewedAt: reviewedAt.toISOString(),
            status,
          },
        },
      });
    });

    return { success: true };
  }

  async getExpiringDocuments(
    actor: AuthContext,
    options: { days?: number; excludeExpired?: boolean },
  ) {
    assertProtectedFileAccessAllowed(actor);
    const days = options.days ?? 30;
    const excludeExpired = options.excludeExpired ?? false;
    const now = new Date();
    const thresholdDate = new Date();
    thresholdDate.setDate(now.getDate() + days);

    const documents = await this.prisma.studentDocument.findMany({
      where: {
        tenantId: actor.tenantId,
        expiryDate: {
          not: null,
          lte: thresholdDate,
          ...(excludeExpired ? { gte: now } : {}),
        },
        status: { not: 'ARCHIVED' },
      },
      include: {
        student: {
          select: {
            id: true,
            studentSystemId: true,
            firstNameEn: true,
            lastNameEn: true,
          },
        },
      },
      orderBy: [{ expiryDate: 'asc' }],
      take: 100,
    });

    return documents.map((doc) => {
      const expiryDate = doc.expiryDate;
      if (!expiryDate) {
        throw new BadRequestException(
          'An expiring student document is missing its expiry date.',
        );
      }
      return {
        id: doc.id,
        studentId: doc.studentId,
        studentSystemId: doc.student.studentSystemId,
        studentName:
          `${doc.student.firstNameEn} ${doc.student.lastNameEn}`.trim(),
        fileId: doc.fileId,
        kind: doc.kind,
        status: doc.status,
        title: doc.title,
        fileName: doc.fileName,
        expiryDate: expiryDate.toISOString(),
        isExpired: expiryDate.getTime() < now.getTime(),
        daysUntilExpiry: Math.ceil(
          (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        ),
      };
    });
  }
}

function normalizeAdmissionDocumentKind(value: string): StudentDocumentKind {
  const normalized = value
    .trim()
    .replace(/[\s-]+/g, '_')
    .toUpperCase();
  if (normalized === 'BIRTH_CERTIFICATE') {
    return StudentDocumentKind.BIRTH_CERTIFICATE;
  }
  if (normalized === 'TRANSFER_CERTIFICATE') {
    return StudentDocumentKind.TRANSFER_CERTIFICATE;
  }
  if (
    normalized === 'PRIOR_MARKSHEET' ||
    normalized === 'PREVIOUS_REPORT_CARD'
  ) {
    return StudentDocumentKind.PREVIOUS_REPORT_CARD;
  }
  return StudentDocumentKind.OTHER;
}

function parseOptionalDocumentExpiryDate(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException('Document expiry date must be a valid date');
  }

  return parsed;
}

function isPrismaUniqueConstraintError(error: unknown) {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'P2002'
  );
}
