import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Prisma } from '@prisma/client';
import {
  TenantSettingKey,
  type PaginatedResponse,
  type PlatformAuditLog,
  type TenantSettingSummary,
} from '@schoolos/core';
import type { AuthContext } from '../auth/auth.types';
import { validateImageUpload } from '../common/files/image-upload-validation';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { StorageService } from '../storage/storage.service';
import { UploadTenantLogoDto } from './dto/upload-tenant-logo.dto';

const MAX_TENANT_LOGO_BYTES = 1024 * 1024;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly storageService: StorageService,
    private readonly fileRegistryService: FileRegistryService,
  ) {}

  private readonly allowedKeys: TenantSettingKey[] = [
    'school_logo',
    'branding_primary_color',
    'timezone',
    'currency',
    'date_format',
    'attendance_lock_hours',
    'receipt_format',
    'fee_reminder_days',
    'sms_provider',
    'feature_toggles',
    'school_name',
    'school_address',
    'school_phone',
    'school_email',
    'school_pan_number',
    'principal_name',
    'municipality',
    'ward_number',
    'district',
    'province',
    'school_type',
    'iemis_school_code',
    'receipt_header_text',
    'receipt_footer_text',
    'id_card_footer_text',
    'payslip_footer_text',
    'certificate_footer_text',
    'report_card_footer_text',
    'default_paper_size',
    'active_academic_year_label',
    'default_calendar',
    'attendance_working_days',
    'promotion_rule_mode',
    'grading_scheme_label',
    'grading_scale',
    'grading_rounding_policy',
    'active_fee_plan_required',
    'receipt_number_prefix',
    'payment_methods_enabled',
    'late_fee_enabled',
    'late_fee_grace_days',
    'waiver_approval_required',
    'discount_approval_required',
    'cashier_close_required',
    'late_threshold_minutes',
    'half_day_threshold_minutes',
    'allow_teacher_correction_request',
    'parent_attendance_visibility',
    'weekend_policy',
    'payroll_month_day',
    'default_working_days_per_month',
    'pf_enabled',
    'tds_enabled',
    'leave_approval_required',
    'unpaid_leave_affects_payroll',
    'payroll_approval_required',
    'salary_payment_methods',
    'active_fiscal_year_label',
    'fiscal_period_lock_policy',
    'default_cash_account_label',
    'default_bank_account_label',
    'salary_payable_account_label',
    'tds_payable_account_label',
    'pf_payable_account_label',
    'fee_income_account_label',
    'journal_number_prefix',
    'voucher_number_prefix',
    'default_notice_channel',
    'parent_notification_enabled',
    'consent_required_for_media',
    'quiet_hours_enabled',
    'chat_availability_enabled',
    'chat_sunday_to_thursday_start',
    'chat_sunday_to_thursday_end',
    'chat_sunday_to_thursday_hours',
    'chat_friday_start',
    'chat_friday_end',
    'chat_friday_hours',
    'chat_saturday_enabled',
    'emergency_override_requires_admin',
    'sensitive_staff_fields_masked',
    'export_requires_permission',
    'audit_log_retention_days',
    'session_timeout_minutes',
    'require_reason_for_sensitive_reveal',
    'block_report_card_on_dues',
    'block_publishing_on_dues',
  ];

  private readonly publicKeys: TenantSettingKey[] = [
    'school_logo',
    'branding_primary_color',
    'timezone',
    'currency',
    'date_format',
    'school_name',
    'school_address',
    'school_phone',
    'school_email',
  ];

  async getSettings(tenantId: string): Promise<TenantSettingSummary[]> {
    const settings = await this.prisma.tenantSetting.findMany({
      where: { tenantId },
    });

    return settings.map((s) => ({
      key: s.key as TenantSettingKey,
      value: s.value,
      updatedAt: s.updatedAt.toISOString(),
    }));
  }

  async getPublicSettings(tenantId: string): Promise<TenantSettingSummary[]> {
    const settings = await this.prisma.tenantSetting.findMany({
      where: {
        tenantId,
        key: { in: this.publicKeys },
      },
    });

    return settings.map((s) => ({
      key: s.key as TenantSettingKey,
      value: s.value,
      updatedAt: s.updatedAt.toISOString(),
    }));
  }

  async listTenantAuditLogs(query: {
    tenantId: string;
    action?: string;
    resource?: string;
    resourceId?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    page?: number | string;
    limit?: number | string;
  }): Promise<PaginatedResponse<PlatformAuditLog>> {
    const page = normalizePositiveInt(query.page, 1);
    const limit = Math.min(normalizePositiveInt(query.limit, 25), 100);
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {
      tenantId: query.tenantId,
    };

    if (query.action?.trim()) {
      where.action = query.action.trim();
    }
    if (query.resource?.trim()) {
      where.resource = query.resource.trim();
    }
    if (query.resourceId?.trim()) {
      where.resourceId = query.resourceId.trim();
    }
    if (query.userId?.trim()) {
      where.userId = query.userId.trim();
    }
    if (query.startDate || query.endDate) {
      where.createdAt = {
        ...(query.startDate
          ? { gte: parseAuditDate(query.startDate, 'startDate') }
          : {}),
        ...(query.endDate
          ? { lte: parseAuditDate(query.endDate, 'endDate') }
          : {}),
      };
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          action: true,
          resource: true,
          resourceId: true,
          tenantId: true,
          userId: true,
          before: true,
          after: true,
          ipAddress: true,
          userAgent: true,
          requestId: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: logs.map((log) => ({
        id: log.id,
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId,
        tenantId: log.tenantId,
        userId: log.userId,
        before: log.before,
        after: log.after,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        requestId: log.requestId,
        createdAt: log.createdAt.toISOString(),
        user: log.user,
      })),
      total,
      page,
      limit,
      hasNextPage: page * limit < total,
    };
  }

  async getSetting(
    tenantId: string,
    key: TenantSettingKey,
  ): Promise<Prisma.JsonValue | null> {
    const setting = await this.prisma.tenantSetting.findUnique({
      where: { tenantId_key: { tenantId, key } },
    });

    return setting?.value ?? null;
  }

  async updateSetting(
    tenantId: string,
    key: string,
    value: Prisma.InputJsonValue,
    userId: string,
  ): Promise<void> {
    if (!this.allowedKeys.includes(key as TenantSettingKey)) {
      throw new BadRequestException(`Invalid setting key: ${key}`);
    }

    this.validateSettingValue(key as TenantSettingKey, value);

    const existing = await this.prisma.tenantSetting.findUnique({
      where: { tenantId_key: { tenantId, key } },
    });

    await this.prisma.tenantSetting.upsert({
      where: { tenantId_key: { tenantId, key } },
      create: {
        tenantId,
        key,
        value,
      },
      update: {
        value,
      },
    });

    await this.auditService.record({
      action: 'setting_updated',
      resource: 'settings',
      resourceId: key,
      tenantId,
      userId,
      before: existing ? { value: existing.value } : null,
      after: { value },
    });
  }

  async uploadSchoolLogo(dto: UploadTenantLogoDto, actor: AuthContext) {
    const image = validateImageUpload({
      base64Content: dto.base64Content,
      fileName: dto.fileName,
      mimeType: dto.mimeType,
      maxBytes: MAX_TENANT_LOGO_BYTES,
      label: 'School logo',
    });

    const existing = await this.prisma.tenantSetting.findUnique({
      where: { tenantId_key: { tenantId: actor.tenantId, key: 'school_logo' } },
    });
    const previousFileAssetId = this.extractLogoFileAssetId(existing?.value);

    const stored = await this.storageService.saveBufferObject({
      tenantId: actor.tenantId,
      prefix: 'settings/branding/logo',
      fileName: image.safeFileName,
      contentType: image.mimeType,
      content: image.content,
    });

    const asset = await this.fileRegistryService.registerFile({
      tenantId: actor.tenantId,
      uploadedByUserId: actor.userId,
      originalFilename: image.safeFileName,
      objectKey: stored.objectKey,
      mimeType: image.mimeType,
      sizeBytes: stored.sizeBytes,
      provider: stored.provider,
      bucket: stored.bucket,
      checksumSha256: stored.checksumSha256,
      module: 'settings',
      entityId: actor.tenantId,
      metadata: {
        kind: 'SCHOOL_LOGO',
        title: 'School Logo',
        note: dto.note ?? null,
        originalFileName: dto.fileName,
      },
    });

    await this.fileRegistryService.markUploaded(
      actor.tenantId,
      asset.id,
      actor.userId,
    );

    await this.prisma.tenantSetting.upsert({
      where: { tenantId_key: { tenantId: actor.tenantId, key: 'school_logo' } },
      create: {
        tenantId: actor.tenantId,
        key: 'school_logo',
        value: asset.id,
      },
      update: {
        value: asset.id,
      },
    });

    if (previousFileAssetId && previousFileAssetId !== asset.id) {
      await this.fileRegistryService.softDeleteFile(
        actor.tenantId,
        previousFileAssetId,
        actor.userId,
      );
    }

    await this.auditService.record({
      action: previousFileAssetId
        ? 'school_logo_updated'
        : 'school_logo_uploaded',
      resource: 'settings',
      resourceId: 'school_logo',
      tenantId: actor.tenantId,
      userId: actor.userId,
      before: { fileAssetId: previousFileAssetId },
      after: {
        fileAssetId: asset.id,
        fileName: image.safeFileName,
        mimeType: image.mimeType,
        sizeBytes: stored.sizeBytes,
      },
    });

    return {
      fileAssetId: asset.id,
      fileName: asset.originalFilename,
      mimeType: asset.mimeType,
      sizeBytes: Number(asset.sizeBytes),
      previewUrl: '/api/v1/settings/branding/logo/preview',
      downloadUrl: '/api/v1/settings/branding/logo/download',
    };
  }

  async getSchoolLogoAccess(
    actor: AuthContext,
    action: 'preview' | 'download',
  ) {
    const setting = await this.prisma.tenantSetting.findUnique({
      where: { tenantId_key: { tenantId: actor.tenantId, key: 'school_logo' } },
    });
    const fileAssetId = this.extractLogoFileAssetId(setting?.value);

    if (!fileAssetId) {
      throw new BadRequestException('School logo is not configured');
    }

    const asset = await this.fileRegistryService.getFileMetadata(
      actor.tenantId,
      fileAssetId,
    );

    if (asset.module !== 'settings' || asset.entityId !== actor.tenantId) {
      throw new BadRequestException('School logo is not linked to this tenant');
    }

    await this.fileRegistryService.auditAccess(
      actor.tenantId,
      asset.id,
      actor.userId,
      action,
    );

    return {
      fileAssetId: asset.id,
      fileName: asset.originalFilename,
      mimeType: asset.mimeType,
      sizeBytes: Number(asset.sizeBytes),
      url: await this.fileRegistryService.getSignedUrl(
        actor.tenantId,
        asset.id,
      ),
      expiresInSeconds: 60,
    };
  }

  async removeSchoolLogo(actor: AuthContext) {
    const existing = await this.prisma.tenantSetting.findUnique({
      where: { tenantId_key: { tenantId: actor.tenantId, key: 'school_logo' } },
    });
    const previousFileAssetId = this.extractLogoFileAssetId(existing?.value);

    if (!previousFileAssetId) {
      return { success: true, removed: false };
    }

    await this.fileRegistryService.softDeleteFile(
      actor.tenantId,
      previousFileAssetId,
      actor.userId,
    );

    await this.prisma.tenantSetting.deleteMany({
      where: {
        tenantId: actor.tenantId,
        key: 'school_logo',
      },
    });

    await this.auditService.record({
      action: 'school_logo_removed',
      resource: 'settings',
      resourceId: 'school_logo',
      tenantId: actor.tenantId,
      userId: actor.userId,
      before: { fileAssetId: previousFileAssetId },
      after: { fileAssetId: null },
    });

    return { success: true, removed: true };
  }

  private validateSettingValue(key: TenantSettingKey, value: unknown): void {
    switch (key) {
      case 'branding_primary_color':
        if (
          typeof value !== 'string' ||
          !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value)
        ) {
          throw new BadRequestException(
            'Invalid color format. Expected hex code.',
          );
        }
        break;
      case 'attendance_lock_hours':
      case 'fee_reminder_days':
      case 'late_fee_grace_days':
      case 'late_threshold_minutes':
      case 'half_day_threshold_minutes':
      case 'payroll_month_day':
      case 'default_working_days_per_month':
      case 'audit_log_retention_days':
      case 'session_timeout_minutes':
        if (typeof value !== 'number' || value < 0) {
          throw new BadRequestException(
            `Invalid value for ${key}. Expected positive number.`,
          );
        }
        break;
      case 'pf_enabled':
      case 'tds_enabled':
      case 'leave_approval_required':
      case 'unpaid_leave_affects_payroll':
      case 'payroll_approval_required':
      case 'active_fee_plan_required':
      case 'late_fee_enabled':
      case 'waiver_approval_required':
      case 'discount_approval_required':
      case 'cashier_close_required':
      case 'allow_teacher_correction_request':
      case 'parent_attendance_visibility':
      case 'parent_notification_enabled':
      case 'consent_required_for_media':
      case 'quiet_hours_enabled':
      case 'chat_availability_enabled':
      case 'chat_saturday_enabled':
      case 'emergency_override_requires_admin':
      case 'sensitive_staff_fields_masked':
      case 'export_requires_permission':
      case 'require_reason_for_sensitive_reveal':
        if (typeof value !== 'boolean') {
          throw new BadRequestException(
            `Invalid value for ${key}. Expected boolean.`,
          );
        }
        break;
      case 'timezone':
      case 'currency':
      case 'date_format':
      case 'receipt_format':
      case 'sms_provider':
      case 'school_logo':
      case 'school_name':
      case 'school_address':
      case 'school_phone':
      case 'school_email':
      case 'school_pan_number':
      case 'principal_name':
      case 'municipality':
      case 'ward_number':
      case 'district':
      case 'province':
      case 'school_type':
      case 'iemis_school_code':
      case 'receipt_header_text':
      case 'receipt_footer_text':
      case 'id_card_footer_text':
      case 'payslip_footer_text':
      case 'certificate_footer_text':
      case 'report_card_footer_text':
      case 'default_paper_size':
      case 'active_academic_year_label':
      case 'default_calendar':
      case 'promotion_rule_mode':
      case 'grading_scheme_label':
      case 'receipt_number_prefix':
      case 'active_fiscal_year_label':
      case 'fiscal_period_lock_policy':
      case 'default_cash_account_label':
      case 'default_bank_account_label':
      case 'salary_payable_account_label':
      case 'tds_payable_account_label':
      case 'pf_payable_account_label':
      case 'fee_income_account_label':
      case 'journal_number_prefix':
      case 'voucher_number_prefix':
      case 'default_notice_channel':
      case 'chat_sunday_to_thursday_hours':
      case 'chat_friday_hours':
        if (typeof value !== 'string') {
          throw new BadRequestException(
            `Invalid value for ${key}. Expected string.`,
          );
        }
        break;
      case 'chat_sunday_to_thursday_start':
      case 'chat_sunday_to_thursday_end':
      case 'chat_friday_start':
      case 'chat_friday_end':
        if (
          typeof value !== 'string' ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)
        ) {
          throw new BadRequestException(
            `Invalid value for ${key}. Expected HH:mm time.`,
          );
        }
        break;
      case 'salary_payment_methods':
      case 'payment_methods_enabled':
      case 'attendance_working_days':
      case 'weekend_policy':
        if (!Array.isArray(value)) {
          throw new BadRequestException(
            `Invalid value for ${key}. Expected array.`,
          );
        }
        break;
      case 'feature_toggles':
        if (typeof value !== 'object' || value === null) {
          throw new BadRequestException(
            'Invalid value for feature_toggles. Expected object.',
          );
        }
        break;
      case 'grading_scale':
        this.validateGradingScale(value);
        break;
      case 'grading_rounding_policy':
        this.validateGradingRoundingPolicy(value);
        break;
      default:
        // No specific validation for others yet
        break;
    }
  }

  private validateGradingScale(value: unknown): void {
    if (!Array.isArray(value) || value.length === 0) {
      throw new BadRequestException(
        'Invalid value for grading_scale. Expected non-empty array.',
      );
    }

    let previousMin = 101;
    let hasFailingBand = false;

    for (const [index, entry] of value.entries()) {
      if (typeof entry !== 'object' || entry === null) {
        throw new BadRequestException(
          `Invalid grading_scale[${index}]. Expected object.`,
        );
      }

      const candidate = entry as Record<string, unknown>;
      const grade = candidate.grade;
      const minPercentage = candidate.minPercentage;
      const maxPercentage = candidate.maxPercentage;
      const gradePoint = candidate.gradePoint;
      const label = candidate.label;
      const passed = candidate.passed;

      if (typeof grade !== 'string' || grade.trim().length === 0) {
        throw new BadRequestException(
          `Invalid grading_scale[${index}].grade. Expected string.`,
        );
      }
      if (
        typeof minPercentage !== 'number' ||
        minPercentage < 0 ||
        minPercentage > 100
      ) {
        throw new BadRequestException(
          `Invalid grading_scale[${index}].minPercentage. Expected number between 0 and 100.`,
        );
      }
      if (
        maxPercentage !== undefined &&
        (typeof maxPercentage !== 'number' ||
          maxPercentage < minPercentage ||
          maxPercentage > 100)
      ) {
        throw new BadRequestException(
          `Invalid grading_scale[${index}].maxPercentage. Expected number between minPercentage and 100.`,
        );
      }
      if (typeof gradePoint !== 'number' || gradePoint < 0 || gradePoint > 4) {
        throw new BadRequestException(
          `Invalid grading_scale[${index}].gradePoint. Expected number between 0 and 4.`,
        );
      }
      if (typeof label !== 'string' || label.trim().length === 0) {
        throw new BadRequestException(
          `Invalid grading_scale[${index}].label. Expected string.`,
        );
      }
      if (typeof passed !== 'boolean') {
        throw new BadRequestException(
          `Invalid grading_scale[${index}].passed. Expected boolean.`,
        );
      }
      if (minPercentage >= previousMin) {
        throw new BadRequestException(
          'Invalid grading_scale. Entries must be sorted from highest minimum percentage to lowest.',
        );
      }

      previousMin = minPercentage;
      hasFailingBand = hasFailingBand || !passed;
    }

    if (!hasFailingBand) {
      throw new BadRequestException(
        'Invalid grading_scale. At least one failing band is required.',
      );
    }
  }

  private validateGradingRoundingPolicy(value: unknown): void {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new BadRequestException(
        'Invalid value for grading_rounding_policy. Expected object.',
      );
    }

    const policy = value as Record<string, unknown>;
    const mode = policy.mode;
    if (
      mode !== undefined &&
      mode !== 'HALF_UP' &&
      mode !== 'FLOOR' &&
      mode !== 'CEIL'
    ) {
      throw new BadRequestException(
        'Invalid grading_rounding_policy.mode. Expected HALF_UP, FLOOR, or CEIL.',
      );
    }

    for (const field of [
      'percentageDecimals',
      'gpaDecimals',
      'marksDecimals',
    ]) {
      const decimalPlaces = policy[field];
      if (
        decimalPlaces !== undefined &&
        (!Number.isInteger(decimalPlaces) ||
          (decimalPlaces as number) < 0 ||
          (decimalPlaces as number) > 4)
      ) {
        throw new BadRequestException(
          `Invalid grading_rounding_policy.${field}. Expected integer between 0 and 4.`,
        );
      }
    }
  }

  private extractLogoFileAssetId(value: Prisma.JsonValue | undefined | null) {
    if (typeof value !== 'string') {
      return null;
    }

    return UUID_PATTERN.test(value) ? value : null;
  }
}

function normalizePositiveInt(
  value: number | string | undefined,
  fallback: number,
) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseAuditDate(value: string, label: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`Invalid audit ${label}.`);
  }
  return parsed;
}
