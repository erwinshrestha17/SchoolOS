import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateSiblingGroupDto } from './dto/create-sibling-group.dto';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { UploadStudentDocumentDto } from './dto/upload-student-document.dto';

@Injectable()
export class StudentRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
    private readonly fileRegistryService: FileRegistryService,
  ) {}

  async listDocuments(actor: AuthContext, studentId?: string) {
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
        provider: true,
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

    return documents.map((document) => ({
      id: document.id,
      studentId: document.studentId,
      fileId: document.fileId,
      kind: document.kind,
      status: document.status,
      title: document.title,
      fileName: document.fileName,
      contentType: document.contentType,
      sizeBytes: document.sizeBytes,
      provider: document.provider,
      notes: document.notes,
      expiryDate: document.expiryDate?.toISOString() ?? null,
      verifiedAt: document.verifiedAt?.toISOString() ?? null,
      verifiedById: document.verifiedById,
      uploadedById: document.uploadedById,
      uploadedAt: document.createdAt.toISOString(),
    }));
  }

  async listDocumentHistory(actor: AuthContext, studentId?: string) {
    return this.prisma.studentDocumentHistory.findMany({
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
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    });
  }

  async uploadDocument(dto: UploadStudentDocumentDto, actor: AuthContext) {
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

    const stored = await this.storageService.saveBase64Object({
      tenantId: actor.tenantId,
      prefix: `students/${student.id}/documents`,
      fileName: dto.fileName,
      contentType: dto.contentType,
      base64Content: dto.base64Content,
    });

    const document = await this.prisma.studentDocument.create({
      data: {
        tenantId: actor.tenantId,
        studentId: student.id,
        kind: dto.kind,
        title: dto.title ?? dto.fileName,
        fileName: dto.fileName,
        contentType: dto.contentType,
        sizeBytes: Number(stored.sizeBytes),
        provider: stored.provider,
        objectKey: stored.objectKey,
        publicUrl: stored.publicUrl,
        status: 'ACTIVE',
        uploadedById: actor.userId,
        notes: dto.notes,
        expiryDate,
      },
    });

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
        sourceId: document.id,
      },
    });

    await this.prisma.studentDocument.update({
      where: { id: document.id },
      data: { fileId: asset.id },
    });

    await this.prisma.studentDocumentHistory.create({
      data: {
        tenantId: actor.tenantId,
        documentId: document.id,
        action: 'UPLOAD_PENDING_REVIEW',
        documentTitle: document.title,
        documentKind: document.kind,
        performedBy: actor.userId,
        reason: dto.reason,
        metadata: {
          originalFilename: dto.fileName,
          sizeBytes: stored.sizeBytes,
          expiryDate: expiryDate?.toISOString() ?? null,
        },
      },
    });

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

    return document;
  }

  async listSiblingGroups(actor: AuthContext) {
    return this.prisma.siblingGroup.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        members: {
          include: {
            student: {
              include: {
                class: true,
                sectionRef: true,
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

    return documents.map((doc) => ({
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
      expiryDate: doc.expiryDate!.toISOString(),
      isExpired: doc.expiryDate!.getTime() < now.getTime(),
      daysUntilExpiry: Math.ceil(
        (doc.expiryDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      ),
    }));
  }
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
