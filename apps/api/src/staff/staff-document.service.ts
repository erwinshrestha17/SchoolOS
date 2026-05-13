import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { AuthContext } from '../auth/auth.types';
import { StaffDocumentKind, StudentDocumentStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

interface StaffDocumentListQuery {
  page?: string;
  limit?: string;
}

@Injectable()
export class StaffDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileRegistry: FileRegistryService,
    private readonly auditService: AuditService,
  ) {}

  async addDocument(
    staffId: string,
    input: {
      kind: StaffDocumentKind;
      fileId: string;
      name: string;
      notes?: string;
    },
    actor: AuthContext,
  ) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId: actor.tenantId },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    // Verify file exists and belongs to tenant
    await this.fileRegistry.getFileMetadata(actor.tenantId, input.fileId);

    const document = await this.prisma.staffDocument.create({
      data: {
        tenantId: actor.tenantId,
        staffId,
        kind: input.kind,
        fileId: input.fileId,
        name: input.name,
        notes: input.notes,
        status: StudentDocumentStatus.ACTIVE,
      },
    });

    // Link file to staff entity in registry
    await this.fileRegistry.linkToEntity(
      actor.tenantId,
      input.fileId,
      'staff',
      staffId,
      actor.userId,
    );

    await this.auditService.record({
      action: 'create',
      resource: 'staff_document',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: document.id,
      after: { staffId, kind: document.kind, fileId: document.fileId },
    });

    return document;
  }

  async listDocuments(
    staffId: string,
    actor: AuthContext,
    query: StaffDocumentListQuery = {},
  ) {
    const page = Math.max(Number(query.page ?? 1) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit ?? 25) || 25, 1), 100);
    const skip = (page - 1) * limit;
    const where = { staffId, tenantId: actor.tenantId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.staffDocument.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.staffDocument.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total },
    };
  }

  async listDocumentRecords(staffId: string, actor: AuthContext) {
    return this.prisma.staffDocument.findMany({
      where: { staffId, tenantId: actor.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async verifyDocument(documentId: string, notes: string, actor: AuthContext) {
    const document = await this.prisma.staffDocument.findFirst({
      where: { id: documentId, tenantId: actor.tenantId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const updated = await this.prisma.staffDocument.update({
      where: { id: documentId },
      data: {
        status: StudentDocumentStatus.VERIFIED,
        verifiedById: actor.userId,
        verifiedAt: new Date(),
        notes: notes || document.notes,
      },
    });

    await this.auditService.record({
      action: 'verify',
      resource: 'staff_document',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: documentId,
      after: { status: updated.status, verifiedById: actor.userId },
    });

    return updated;
  }

  async deleteDocument(documentId: string, actor: AuthContext) {
    const document = await this.prisma.staffDocument.findFirst({
      where: { id: documentId, tenantId: actor.tenantId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    await this.prisma.staffDocument.delete({
      where: { id: documentId },
    });

    await this.fileRegistry.softDeleteFile(
      actor.tenantId,
      document.fileId,
      actor.userId,
    );

    await this.auditService.record({
      action: 'delete',
      resource: 'staff_document',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: documentId,
      before: { staffId: document.staffId, fileId: document.fileId },
    });
  }
}
