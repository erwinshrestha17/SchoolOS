import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { AuthContext } from '../auth/auth.types';
import { StaffDocumentKind, StudentDocumentStatus } from '@prisma/client';

@Injectable()
export class StaffDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileRegistry: FileRegistryService,
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

    return document;
  }

  async listDocuments(staffId: string, actor: AuthContext) {
    return this.prisma.staffDocument.findMany({
      where: { staffId, tenantId: actor.tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async verifyDocument(
    documentId: string,
    notes: string,
    actor: AuthContext,
  ) {
    const document = await this.prisma.staffDocument.findFirst({
      where: { id: documentId, tenantId: actor.tenantId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return this.prisma.staffDocument.update({
      where: { id: documentId },
      data: {
        status: StudentDocumentStatus.VERIFIED,
        verifiedById: actor.userId,
        verifiedAt: new Date(),
        notes: notes || document.notes,
      },
    });
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
  }
}
