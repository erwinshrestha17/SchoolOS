import type { TenantSettingKey } from "./types.js";

/**
 * School settings domains. Each domain groups tenant-setting keys that share
 * one settings authority boundary. Backend authorization is the source of
 * truth: writing a key requires `settings:manage` (full school settings
 * authority) or the domain's `settings:<domain>:manage` permission.
 */
export type SchoolSettingsDomain =
  | "identity"
  | "academic"
  | "attendance"
  | "finance"
  | "hr"
  | "accounting"
  | "communication"
  | "security";

export const SCHOOL_SETTINGS_DOMAIN_MANAGE_PERMISSIONS: Record<
  SchoolSettingsDomain,
  string
> = {
  identity: "settings:identity:manage",
  academic: "settings:academic:manage",
  attendance: "settings:attendance:manage",
  finance: "settings:finance:manage",
  hr: "settings:hr:manage",
  accounting: "settings:accounting:manage",
  communication: "settings:communication:manage",
  security: "settings:security:manage",
};

/**
 * Keys that may only be written with full `settings:manage` authority.
 * `school_logo` additionally requires the protected branding upload endpoint.
 */
const FULL_MANAGE_ONLY_KEYS: TenantSettingKey[] = [
  "feature_toggles",
  "school_logo",
];

const DOMAIN_KEYS: Record<SchoolSettingsDomain, TenantSettingKey[]> = {
  identity: [
    "branding_primary_color",
    "timezone",
    "currency",
    "date_format",
    "school_name",
    "school_address",
    "school_phone",
    "school_email",
    "school_pan_number",
    "principal_name",
    "municipality",
    "ward_number",
    "district",
    "province",
    "school_type",
    "iemis_school_code",
    "receipt_header_text",
    "receipt_footer_text",
    "id_card_footer_text",
    "payslip_footer_text",
    "certificate_footer_text",
    "report_card_footer_text",
    "default_paper_size",
  ],
  academic: [
    "active_academic_year_label",
    "default_calendar",
    "attendance_working_days",
    "promotion_rule_mode",
    "grading_scheme_label",
    "grading_scale",
    "grading_rounding_policy",
    "block_report_card_on_dues",
    "block_publishing_on_dues",
  ],
  attendance: [
    "attendance_lock_hours",
    "late_threshold_minutes",
    "half_day_threshold_minutes",
    "allow_teacher_correction_request",
    "parent_attendance_visibility",
    "weekend_policy",
  ],
  finance: [
    "receipt_format",
    "fee_reminder_days",
    "active_fee_plan_required",
    "receipt_number_prefix",
    "payment_methods_enabled",
    "late_fee_enabled",
    "late_fee_grace_days",
    "waiver_approval_required",
    "discount_approval_required",
    "cashier_close_required",
  ],
  hr: [
    "payroll_month_day",
    "default_working_days_per_month",
    "pf_enabled",
    "tds_enabled",
    "leave_approval_required",
    "unpaid_leave_affects_payroll",
    "payroll_approval_required",
    "salary_payment_methods",
  ],
  accounting: [
    "active_fiscal_year_label",
    "fiscal_period_lock_policy",
    "default_cash_account_label",
    "default_bank_account_label",
    "salary_payable_account_label",
    "tds_payable_account_label",
    "pf_payable_account_label",
    "fee_income_account_label",
    "journal_number_prefix",
    "voucher_number_prefix",
  ],
  communication: [
    "sms_provider",
    "default_notice_channel",
    "parent_notification_enabled",
    "consent_required_for_media",
    "quiet_hours_enabled",
    "notification_quiet_hours_start",
    "notification_quiet_hours_end",
    "chat_availability_enabled",
    "chat_sunday_to_thursday_start",
    "chat_sunday_to_thursday_end",
    "chat_sunday_to_thursday_hours",
    "chat_friday_start",
    "chat_friday_end",
    "chat_friday_hours",
    "chat_saturday_enabled",
    "emergency_override_requires_admin",
  ],
  security: [
    "sensitive_staff_fields_masked",
    "export_requires_permission",
    "audit_log_retention_days",
    "session_timeout_minutes",
    "require_reason_for_sensitive_reveal",
  ],
};

const KEY_TO_DOMAIN = new Map<TenantSettingKey, SchoolSettingsDomain>();
for (const [domain, keys] of Object.entries(DOMAIN_KEYS) as Array<
  [SchoolSettingsDomain, TenantSettingKey[]]
>) {
  for (const key of keys) {
    KEY_TO_DOMAIN.set(key, domain);
  }
}

export function getSchoolSettingsDomainForKey(
  key: TenantSettingKey,
): SchoolSettingsDomain | null {
  return KEY_TO_DOMAIN.get(key) ?? null;
}

/**
 * Returns the permission keys that authorize writing the given tenant-setting
 * key. `settings:manage` always authorizes; domain keys additionally accept
 * the matching `settings:<domain>:manage` permission. Keys reserved for full
 * settings authority return only `settings:manage`.
 */
export function getSchoolSettingsWritePermissionsForKey(
  key: TenantSettingKey,
): string[] {
  if (FULL_MANAGE_ONLY_KEYS.includes(key)) {
    return ["settings:manage"];
  }
  const domain = getSchoolSettingsDomainForKey(key);
  return domain
    ? ["settings:manage", SCHOOL_SETTINGS_DOMAIN_MANAGE_PERMISSIONS[domain]]
    : ["settings:manage"];
}

export function canWriteSchoolSettingKey(
  permissions: readonly string[],
  key: TenantSettingKey,
): boolean {
  return getSchoolSettingsWritePermissionsForKey(key).some((permission) =>
    permissions.includes(permission),
  );
}
