import {
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
    return this.prisma.studentDocument.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(studentId ? { studentId } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
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
        uploadedById: actor.userId,
        notes: dto.notes,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
      },
    });

    const asset = await this.fileRegistryService.registerFile({
      tenantId: actor.tenantId,
      uploadedByUserId: actor.userId,
      originalFilename: dto.fileName,
      objectKey: stored.objectKey,
      mimeType: dto.contentType,
      sizeBytes: stored.sizeBytes,
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
        action: 'UPLOAD',
        documentTitle: document.title,
        documentKind: document.kind,
        performedBy: actor.userId,
        reason: dto.reason,
        metadata: {
          originalFilename: dto.fileName,
          sizeBytes: stored.sizeBytes,
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
    // 1. Audit the access via Registry
    await this.fileRegistryService.auditAccess(
      actor.tenantId,
      assetId,
      actor.userId,
      action,
    );

    // 2. Log to StudentDocumentHistory
    const asset = await this.prisma.fileAsset.findUnique({
      where: { id: assetId },
    });
    if (asset) {
      const doc = await this.prisma.studentDocument.findFirst({
        where: { tenantId: actor.tenantId, objectKey: asset.objectKey },
      });
      if (doc) {
        await this.prisma.studentDocumentHistory.create({
          data: {
            tenantId: actor.tenantId,
            documentId: doc.id,
            action: 'VIEW',
            documentTitle: doc.title,
            documentKind: doc.kind,
            performedBy: actor.userId,
            metadata: { action },
          },
        });
      }
    }

    // 3. Get the signed URL
    let url: string;
    try {
      url = await this.fileRegistryService.getSignedUrl(
        actor.tenantId,
        assetId,
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

    await this.prisma.$transaction(async (tx) => {
      await tx.studentDocument.update({
        where: { id: documentId },
        data: {
          status,
          verifiedAt: status === 'VERIFIED' ? new Date() : null,
          verifiedById: status === 'VERIFIED' ? actor.userId : null,
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
        },
      });
    });

    return { success: true };
  }
}
