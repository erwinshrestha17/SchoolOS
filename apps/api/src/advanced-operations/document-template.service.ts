import { randomUUID, createHash } from 'crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DocumentTemplateStatus,
  GeneratedDocumentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { buildSimplePdf } from '../common/pdf/simple-pdf';
import type { AuthContext } from '../auth/auth.types';
import {
  CreateDocumentTemplateDto,
  GenerateDocumentDto,
} from './dto/document-template.dto';

@Injectable()
export class DocumentTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly fileRegistryService: FileRegistryService,
  ) {}

  async listTemplates(actor: AuthContext) {
    return this.prisma.documentTemplate.findMany({
      where: { tenantId: actor.tenantId },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
      take: 100,
    });
  }

  async createTemplate(dto: CreateDocumentTemplateDto, actor: AuthContext) {
    const mergeFields = normalizeMergeFields(dto.mergeFields);
    assertTemplateUsesOnlyDeclaredFields(dto.body, mergeFields);

    const template = await this.prisma.documentTemplate.create({
      data: {
        tenantId: actor.tenantId,
        kind: dto.kind,
        key: dto.key.trim(),
        name: dto.name.trim(),
        locale: dto.locale?.trim() || 'en',
        status: DocumentTemplateStatus.ACTIVE,
        createdById: actor.userId,
        versions: {
          create: {
            tenantId: actor.tenantId,
            version: 1,
            body: dto.body,
            mergeFields: mergeFields as Prisma.InputJsonValue,
            headerConfig: dto.headerConfig as Prisma.InputJsonValue | undefined,
            footerConfig: dto.footerConfig as Prisma.InputJsonValue | undefined,
            activatedAt: new Date(),
            createdById: actor.userId,
          },
        },
      },
      include: { versions: true },
    });

    await this.auditService.record({
      action: 'document_template_created',
      resource: 'document_template',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: template.id,
      after: {
        key: template.key,
        kind: template.kind,
        version: 1,
        mergeFields,
      },
    });

    return template;
  }

  async generateDocument(
    templateId: string,
    dto: GenerateDocumentDto,
    actor: AuthContext,
  ) {
    const template = await this.prisma.documentTemplate.findFirst({
      where: {
        id: templateId,
        tenantId: actor.tenantId,
        status: DocumentTemplateStatus.ACTIVE,
      },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!template || template.versions.length === 0) {
      throw new NotFoundException('Active document template not found');
    }

    const version = template.versions[0];
    const mergeFields = normalizeMergeFields(version.mergeFields);
    assertMergeDataAllowed(dto.mergeData, mergeFields);
    const rendered = renderTemplate(version.body, dto.mergeData, mergeFields);
    const verificationCode = randomUUID();

    const document = await this.prisma.generatedDocument.create({
      data: {
        tenantId: actor.tenantId,
        templateId: template.id,
        templateVersionId: version.id,
        subjectType: dto.subjectType.trim(),
        subjectId: dto.subjectId.trim(),
        mergeData: dto.mergeData as Prisma.InputJsonValue,
        verificationCode,
        generatedById: actor.userId,
      },
    });

    try {
      const file = await this.fileRegistryService.registerGeneratedFile({
        tenantId: actor.tenantId,
        generatedByUserId: actor.userId,
        originalFilename: `${template.key}-${document.id}.pdf`,
        content: buildSimplePdf([
          template.name,
          `Generated: ${new Date().toISOString()}`,
          `Verification: ${verificationCode}`,
          '',
          ...rendered.split('\n'),
        ]),
        mimeType: 'application/pdf',
        module: 'advanced-documents',
        entityId: document.id,
        metadata: {
          templateId: template.id,
          templateVersion: version.version,
          subjectType: dto.subjectType,
          subjectId: dto.subjectId,
        },
      });

      const updated = await this.prisma.generatedDocument.update({
        where: { id: document.id },
        data: {
          status: GeneratedDocumentStatus.GENERATED,
          fileAssetId: file.id,
          generatedAt: new Date(),
          verificationTokens: {
            create: {
              tenantId: actor.tenantId,
              tokenHash: hashToken(verificationCode),
            },
          },
        },
        include: {
          fileAsset: {
            select: {
              id: true,
              originalFilename: true,
              mimeType: true,
              sizeBytes: true,
              module: true,
              entityId: true,
              status: true,
              createdAt: true,
            },
          },
        },
      });

      await this.auditService.record({
        action: 'document_generated',
        resource: 'generated_document',
        tenantId: actor.tenantId,
        userId: actor.userId,
        resourceId: updated.id,
        after: {
          templateId: template.id,
          fileAssetId: file.id,
          subjectType: dto.subjectType,
          subjectId: dto.subjectId,
        },
      });

      return updated;
    } catch (error) {
      await this.prisma.generatedDocument.update({
        where: { id: document.id },
        data: {
          status: GeneratedDocumentStatus.FAILED,
          errorSummary:
            error instanceof Error
              ? error.message
              : 'Document generation failed',
        },
      });
      throw error;
    }
  }

  async recordPrint(documentId: string, reason: string | undefined, actor: AuthContext) {
    const document = await this.prisma.generatedDocument.findFirst({
      where: { id: documentId, tenantId: actor.tenantId },
    });
    if (!document) {
      throw new NotFoundException('Generated document not found in this tenant');
    }
    const print = await this.prisma.documentPrintHistory.create({
      data: {
        tenantId: actor.tenantId,
        documentId,
        printedById: actor.userId,
        reason: reason?.trim() || null,
      },
    });
    await this.auditService.record({
      action: 'document_print_recorded',
      resource: 'generated_document',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: documentId,
      after: { printId: print.id },
    });
    return print;
  }
}

function normalizeMergeFields(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).map((field) => field.trim()).filter(Boolean))];
}

function assertTemplateUsesOnlyDeclaredFields(body: string, fields: string[]) {
  const used = extractPlaceholders(body);
  const undeclared = used.filter((field) => !fields.includes(field));
  if (undeclared.length) {
    throw new BadRequestException(
      `Template contains undeclared merge fields: ${undeclared.join(', ')}`,
    );
  }
}

function assertMergeDataAllowed(data: Record<string, unknown>, fields: string[]) {
  const unknownFields = Object.keys(data).filter((key) => !fields.includes(key));
  if (unknownFields.length) {
    throw new BadRequestException(
      `Merge data contains unsafe fields: ${unknownFields.join(', ')}`,
    );
  }
}

function renderTemplate(
  body: string,
  data: Record<string, unknown>,
  fields: string[],
) {
  assertTemplateUsesOnlyDeclaredFields(body, fields);
  return body.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key) => {
    const value = data[String(key)];
    return value === undefined || value === null ? '' : String(value);
  });
}

function extractPlaceholders(body: string) {
  return [...body.matchAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g)].map((match) =>
    String(match[1]),
  );
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
