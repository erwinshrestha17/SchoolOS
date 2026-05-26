import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { PrismaService } from '../prisma/prisma.service';

interface StudentDocumentAccessRow {
  id: string;
  tenantId: string;
  studentId: string;
  status: string | null;
  documentFileId: string | null;
  fileName: string | null;
  kind: string | null;
}

export interface StudentDocumentAccessUrl {
  documentId: string;
  studentId: string;
  fileAssetId: string;
  fileName: string;
  kind: string | null;
  url: string;
  expiresInSeconds: number;
}

@Injectable()
export class StudentDocumentAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileRegistryService: FileRegistryService,
  ) {}

  async getDocumentAccessUrl(
    actor: AuthContext,
    studentId: string,
    documentId: string,
    action: 'preview' | 'download',
  ): Promise<StudentDocumentAccessUrl> {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId: actor.tenantId },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
    }

    const document = await this.findStudentDocument(
      actor,
      studentId,
      documentId,
    );

    if (!document.documentFileId) {
      throw new NotFoundException('Student document file not found');
    }

    if (document.status === 'ARCHIVED' || document.status === 'REPLACED') {
      throw new ForbiddenException('Student document is not active');
    }

    const asset = await this.fileRegistryService.getFileMetadata(
      actor.tenantId,
      document.documentFileId,
    );

    if (asset.status !== 'UPLOADED') {
      throw new NotFoundException('Student document file is not available');
    }

    if (
      asset.module &&
      asset.module !== 'students' &&
      asset.module !== 'student-documents'
    ) {
      throw new ForbiddenException('Student document file module is invalid');
    }

    if (asset.entityId && asset.entityId !== studentId) {
      throw new ForbiddenException(
        'Student document file is not linked to this student',
      );
    }

    await this.fileRegistryService.auditAccess(
      actor.tenantId,
      asset.id,
      actor.userId,
      action,
    );

    return {
      documentId: document.id,
      studentId,
      fileAssetId: asset.id,
      fileName: document.fileName ?? asset.originalFilename,
      kind: document.kind,
      url: await this.fileRegistryService.getSignedUrl(
        actor.tenantId,
        asset.id,
      ),
      expiresInSeconds: 60,
    };
  }

  private async findStudentDocument(
    actor: AuthContext,
    studentId: string,
    documentId: string,
  ) {
    const rows = await this.prisma.$queryRaw<StudentDocumentAccessRow[]>(
      Prisma.sql`
        SELECT
          d."id",
          d."tenantId",
          d."studentId",
          COALESCE(to_jsonb(d) ->> 'status', NULL) AS "status",
          COALESCE(
            to_jsonb(d) ->> 'fileId',
            to_jsonb(d) ->> 'fileAssetId',
            to_jsonb(d) ->> 'documentFileId'
          ) AS "documentFileId",
          COALESCE(
            to_jsonb(d) ->> 'fileName',
            to_jsonb(d) ->> 'title',
            to_jsonb(d) ->> 'name'
          ) AS "fileName",
          COALESCE(to_jsonb(d) ->> 'kind', NULL) AS "kind"
        FROM "StudentDocument" d
        WHERE d."id" = ${documentId}
          AND d."tenantId" = ${actor.tenantId}
          AND d."studentId" = ${studentId}
        LIMIT 1
      `,
    );

    const document = rows[0];

    if (!document) {
      throw new NotFoundException('Student document not found in this tenant');
    }

    return document;
  }
}
