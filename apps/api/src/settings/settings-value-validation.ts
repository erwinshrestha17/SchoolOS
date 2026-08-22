import { BadRequestException } from '@nestjs/common';
import type { TenantSettingKey } from '@schoolos/core';

export function validateSchoolSettingValue(
  key: TenantSettingKey,
  value: unknown,
): void {
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
      return;
    case 'attendance_lock_hours':
    case 'fee_reminder_days':
    case 'late_fee_grace_days':
    case 'late_threshold_minutes':
    case 'half_day_threshold_minutes':
    case 'payroll_month_day':
    case 'default_working_days_per_month':
    case 'audit_log_retention_days':
    case 'session_timeout_minutes':
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new BadRequestException(
          `Invalid value for ${key}. Expected a non-negative number.`,
        );
      }
      return;
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
    case 'block_report_card_on_dues':
    case 'block_publishing_on_dues':
      if (typeof value !== 'boolean') {
        throw new BadRequestException(
          `Invalid value for ${key}. Expected boolean.`,
        );
      }
      return;
    case 'notification_quiet_hours_start':
    case 'notification_quiet_hours_end':
    case 'chat_sunday_to_thursday_start':
    case 'chat_sunday_to_thursday_end':
    case 'chat_friday_start':
    case 'chat_friday_end':
      if (
        typeof value !== 'string' ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)
      ) {
        throw new BadRequestException(
          `Invalid value for ${key}. Expected 24-hour HH:mm time.`,
        );
      }
      return;
    case 'salary_payment_methods':
    case 'payment_methods_enabled':
    case 'attendance_working_days':
      if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
        throw new BadRequestException(
          `Invalid value for ${key}. Expected a string array.`,
        );
      }
      return;
    case 'weekend_policy':
      if (
        value !== 'SATURDAY' &&
        value !== 'FRIDAY_SATURDAY' &&
        value !== 'CUSTOM'
      ) {
        throw new BadRequestException(
          'Invalid value for weekend_policy. Expected SATURDAY, FRIDAY_SATURDAY, or CUSTOM.',
        );
      }
      return;
    case 'grading_scale':
      validateGradingScale(value);
      return;
    case 'grading_rounding_policy':
      validateGradingRoundingPolicy(value);
      return;
    case 'feature_toggles':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new BadRequestException(
          'Invalid value for feature_toggles. Expected object.',
        );
      }
      return;
    default:
      if (
        [
          'timezone',
          'currency',
          'date_format',
          'receipt_format',
          'sms_provider',
          'school_logo',
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
          'promotion_rule_mode',
          'grading_scheme_label',
          'receipt_number_prefix',
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
          'chat_sunday_to_thursday_hours',
          'chat_friday_hours',
        ].includes(key)
      ) {
        if (typeof value !== 'string') {
          throw new BadRequestException(
            `Invalid value for ${key}. Expected string.`,
          );
        }
      }
  }
}

function validateGradingScale(value: unknown): void {
  if (!Array.isArray(value) || value.length === 0) {
    throw new BadRequestException(
      'Invalid value for grading_scale. Expected non-empty array.',
    );
  }

  let previousMin = 101;
  let hasFailingBand = false;
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new BadRequestException(
        `Invalid grading_scale[${index}]. Expected object.`,
      );
    }
    const candidate = entry as Record<string, unknown>;
    const minPercentage = candidate.minPercentage;
    const maxPercentage = candidate.maxPercentage;
    if (typeof candidate.grade !== 'string' || !candidate.grade.trim()) {
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
        `Invalid grading_scale[${index}].maxPercentage.`,
      );
    }
    if (
      typeof candidate.gradePoint !== 'number' ||
      candidate.gradePoint < 0 ||
      candidate.gradePoint > 4
    ) {
      throw new BadRequestException(
        `Invalid grading_scale[${index}].gradePoint. Expected number between 0 and 4.`,
      );
    }
    if (typeof candidate.label !== 'string' || !candidate.label.trim()) {
      throw new BadRequestException(
        `Invalid grading_scale[${index}].label. Expected string.`,
      );
    }
    if (typeof candidate.passed !== 'boolean') {
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
    hasFailingBand = hasFailingBand || !candidate.passed;
  }

  if (!hasFailingBand) {
    throw new BadRequestException(
      'Invalid grading_scale. At least one failing band is required.',
    );
  }
}

function validateGradingRoundingPolicy(value: unknown): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestException(
      'Invalid value for grading_rounding_policy. Expected object.',
    );
  }
  const policy = value as Record<string, unknown>;
  if (
    policy.mode !== undefined &&
    policy.mode !== 'HALF_UP' &&
    policy.mode !== 'FLOOR' &&
    policy.mode !== 'CEIL'
  ) {
    throw new BadRequestException(
      'Invalid grading_rounding_policy.mode. Expected HALF_UP, FLOOR, or CEIL.',
    );
  }
  for (const field of ['percentageDecimals', 'gpaDecimals', 'marksDecimals']) {
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
