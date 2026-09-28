import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FileStatus,
  Prisma,
  StaffDocumentKind,
  StudentDocumentStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FileRegistryService } from '../file-registry/file-registry.service';
import type { AuthContext } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { withSchoolAuthorizationTransaction } from '../auth/school-authorization-transaction';
import { requireDomainPermission } from '../authorization/policies/domain-permission';
import { isFinancialTransactionConflict } from '../authorization/policies/financial-transaction-conflict';

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

  private async transaction<T>(
    actor: AuthContext,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    requireDomainPermission(actor, 'hr:documents:read');
    requireDomainPermission(actor, 'hr:documents:manage');
    try {
      return await withSchoolAuthorizationTransaction(
        this.prisma,
        actor,
        ['hr:documents:read', 'hr:documents:manage'],
        [],
        work,
        false,
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        isFinancialTransactionConflict(error) ||
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002')
      )
        throw new ConflictException(
          'The staff document changed concurrently. Reload before retrying.',
        );
      throw error;
    }
  }

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
    return this.transaction(actor, async (tx) => {
      const staff = await tx.staff.findFirst({
        where: { id: staffId, tenantId: actor.tenantId },
        select: { id: true },
      });
      if (!staff) throw new NotFoundException('Staff not found');
      const file = await tx.fileAsset.findFirst({
        where: {
          id: input.fileId,
          tenantId: actor.tenantId,
          status: FileStatus.UPLOADED,
          softDeletedAt: null,
          deletedAt: null,
        },
      });
      if (!file) throw new NotFoundException('Uploaded staff file not found');
      if (
        (file.module && !['staff', 'staff-documents'].includes(file.module)) ||
        (file.entityId && file.entityId !== staffId) ||
        (file.ownerId && file.ownerId !== staffId) ||
        (!file.entityId && file.uploadedByUserId !== actor.userId)
      )
        throw new ConflictException(
          'This file is not available for the staff document',
        );
      const document = await tx.staffDocument.create({
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
      await this.fileRegistry.linkToEntityInTransaction(tx, {
        tenantId: actor.tenantId,
        assetId: input.fileId,
        module: 'staff',
        entityId: staffId,
        ownerType: 'staff',
        ownerId: staffId,
        userId: actor.userId,
      });
      await this.auditService.record(
        {
          action: 'create',
          resource: 'staff_document',
          tenantId: actor.tenantId,
          userId: actor.userId,
          resourceId: document.id,
          after: { staffId, kind: document.kind, fileId: document.fileId },
        },
        tx,
      );
      return document;
    });
  }

  async listDocuments(
    staffId: string,
    actor: AuthContext,
    query: StaffDocumentListQuery = {},
  ) {
    requireDomainPermission(actor, 'hr:documents:read');
    const page = Math.max(Number(query.page ?? 1) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit ?? 25) || 25, 1), 100);
    const where = { staffId, tenantId: actor.tenantId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.staffDocument.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.staffDocument.count({ where }),
    ]);
    await this.auditService.record({
      action: 'sensitive_access',
      resource: 'staff_document',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: staffId,
      after: { documentIds: items.map((item) => item.id), page, limit },
    });
    return { items, meta: { page, limit, total } };
  }

  async listDocumentRecords(staffId: string, actor: AuthContext) {
    return (
      await this.listDocuments(staffId, actor, { page: '1', limit: '100' })
    ).items;
  }

  async verifyDocument(documentId: string, notes: string, actor: AuthContext) {
    return this.transaction(actor, async (tx) => {
      const document = await tx.staffDocument.findFirst({
        where: { id: documentId, tenantId: actor.tenantId },
      });
      if (!document) throw new NotFoundException('Document not found');
      if (document.status !== StudentDocumentStatus.ACTIVE)
        throw new ConflictException(
          'Only active unverified staff documents can be verified',
        );
      const claim = await tx.staffDocument.updateMany({
        where: {
          id: document.id,
          tenantId: actor.tenantId,
          status: StudentDocumentStatus.ACTIVE,
          updatedAt: document.updatedAt,
        },
        data: {
          status: StudentDocumentStatus.VERIFIED,
          verifiedById: actor.userId,
          verifiedAt: new Date(),
          notes: notes || document.notes,
        },
      });
      if (claim.count !== 1)
        throw new ConflictException(
          'Document changed while verification was being recorded',
        );
      await this.auditService.record(
        {
          action: 'verify',
          resource: 'staff_document',
          tenantId: actor.tenantId,
          userId: actor.userId,
          resourceId: documentId,
          before: { status: document.status },
          after: {
            status: StudentDocumentStatus.VERIFIED,
            verifiedById: actor.userId,
          },
        },
        tx,
      );
      return tx.staffDocument.findFirstOrThrow({
        where: { id: documentId, tenantId: actor.tenantId },
      });
    });
  }

  async deleteDocument(documentId: string, actor: AuthContext) {
    return this.transaction(actor, async (tx) => {
      const document = await tx.staffDocument.findFirst({
        where: { id: documentId, tenantId: actor.tenantId },
      });
      if (!document) throw new NotFoundException('Document not found');
      if (
        ![
          StudentDocumentStatus.ACTIVE,
          StudentDocumentStatus.VERIFIED,
        ].includes(document.status as 'ACTIVE' | 'VERIFIED')
      )
        throw new ConflictException('Document is already unavailable');
      // Retain professional evidence and verification history; archive access.
      const claim = await tx.staffDocument.updateMany({
        where: {
          id: documentId,
          tenantId: actor.tenantId,
          status: document.status,
          updatedAt: document.updatedAt,
        },
        data: { status: StudentDocumentStatus.ARCHIVED },
      });
      if (claim.count !== 1)
        throw new ConflictException(
          'Document changed while archival was being recorded',
        );
      await tx.fileAsset.updateMany({
        where: {
          id: document.fileId,
          tenantId: actor.tenantId,
          entityId: document.staffId,
          module: 'staff',
        },
        data: {
          status: FileStatus.DELETED,
          softDeletedAt: new Date(),
          deletedAt: new Date(),
        },
      });
      await this.auditService.record(
        {
          action: 'archive',
          resource: 'staff_document',
          tenantId: actor.tenantId,
          userId: actor.userId,
          resourceId: documentId,
          before: {
            staffId: document.staffId,
            fileId: document.fileId,
            status: document.status,
          },
          after: { status: StudentDocumentStatus.ARCHIVED },
        },
        tx,
      );
    });
  }
}
