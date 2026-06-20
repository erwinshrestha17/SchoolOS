import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  BrandingDocumentsSettings,
  TenantSettingKey,
} from '@schoolos/core';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateBrandingDocumentsDto } from './dto/update-branding-documents.dto';
import {
  brandingDocumentsKeyMap,
  brandingDocumentsSettingKeys,
} from './branding-documents.keys';

@Injectable()
export class BrandingDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getBranding(tenantId: string): Promise<BrandingDocumentsSettings> {
    const settings = await this.prisma.tenantSetting.findMany({
      where: { tenantId, key: { in: brandingDocumentsSettingKeys } },
      select: { key: true, value: true, updatedAt: true },
    });
    const values = new Map(settings.map((item) => [item.key, item.value]));
    const latest = settings.reduce<Date | null>(
      (current, item) => !current || item.updatedAt > current ? item.updatedAt : current,
      null,
    );
    const read = (field: keyof typeof brandingDocumentsKeyMap) =>
      values.get(brandingDocumentsKeyMap[field]) ?? null;

    return {
      logoFileAssetId: stringValue(values.get('school_logo')),
      primaryColor: colorValue(read('primaryColor')),
      receiptHeaderText: stringValue(read('receiptHeaderText')),
      receiptFooterText: stringValue(read('receiptFooterText')),
      idCardFooterText: stringValue(read('idCardFooterText')),
      payslipFooterText: stringValue(read('payslipFooterText')),
      certificateFooterText: stringValue(read('certificateFooterText')),
      reportCardFooterText: stringValue(read('reportCardFooterText')),
      defaultPaperSize: paperSizeValue(read('defaultPaperSize')),
      updatedAt: latest?.toISOString() ?? null,
    };
  }

  async updateBranding(
    tenantId: string,
    dto: UpdateBrandingDocumentsDto,
    userId: string,
  ): Promise<BrandingDocumentsSettings> {
    const updates = Object.entries(brandingDocumentsKeyMap)
      .filter(([field]) => dto[field as keyof UpdateBrandingDocumentsDto] !== undefined)
      .map(([field, key]) => ({
        key: key as TenantSettingKey,
        value: normalize(dto[field as keyof UpdateBrandingDocumentsDto]),
      }));

    if (updates.length === 0) return this.getBranding(tenantId);

    await this.prisma.$transaction(updates.map(({ key, value }) =>
      this.prisma.tenantSetting.upsert({
        where: { tenantId_key: { tenantId, key } },
        create: { tenantId, key, value },
        update: { value },
      }),
    ));

    await this.auditService.record({
      action: 'branding_documents_updated',
      resource: 'settings',
      resourceId: 'branding_documents',
      tenantId,
      userId,
      after: { changedKeys: updates.map(({ key }) => key) },
    });

    return this.getBranding(tenantId);
  }
}

function normalize(value: unknown): Prisma.InputJsonValue {
  if (value === null) return '';
  return typeof value === 'string' ? value.trim() : value as Prisma.InputJsonValue;
}
function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}
function colorValue(value: unknown) {
  return typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : null;
}
function paperSizeValue(value: unknown): BrandingDocumentsSettings['defaultPaperSize'] {
  return value === 'A4' || value === 'LEGAL' || value === '80MM' ? value : null;
}
