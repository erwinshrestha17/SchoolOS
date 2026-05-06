import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Prisma } from '@prisma/client';
import { TenantSettingKey, TenantSettingSummary } from '@schoolos/core';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
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
    'chat_sunday_to_thursday_hours',
    'chat_friday_hours',
    'chat_saturday_enabled',
    'emergency_override_requires_admin',
    'sensitive_staff_fields_masked',
    'export_requires_permission',
    'audit_log_retention_days',
    'session_timeout_minutes',
    'require_reason_for_sensitive_reveal',
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
      default:
        // No specific validation for others yet
        break;
    }
  }
}
