import type { TenantSettingKey } from '@schoolos/core';

export type SchoolSettingsPolicyId =
  | 'academic'
  | 'attendance'
  | 'fees'
  | 'communication'
  | 'activity-consent'
  | 'payroll'
  | 'accounting'
  | 'security';

export type SchoolSettingsPolicyField = {
  key: TenantSettingKey;
  label: string;
  description?: string;
  type: 'text' | 'number' | 'select' | 'checkbox' | 'multi-check' | 'time';
  placeholder?: string;
  defaultValue?: unknown;
  options?: Array<{ label: string; value: string }>;
};

export type SchoolSettingsPolicy = {
  id: SchoolSettingsPolicyId;
  eyebrow: string;
  title: string;
  description: string;
  /** Backend navigation item id used to resolve this page's access level. */
  navigationItemId: string;
  /** What changing this policy affects in daily school operations. */
  operationalImpact: string;
  operationalLink?: { href: string; label: string };
  fields: SchoolSettingsPolicyField[];
};

const workingDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((value) => ({ label: value, value }));
const paymentMethods = ['Cash', 'Bank Transfer', 'eSewa', 'Khalti', 'Cheque'].map((value) => ({ label: value, value }));

export const SCHOOL_SETTINGS_POLICIES: SchoolSettingsPolicy[] = [
  {
    id: 'academic', eyebrow: 'Academic operations', title: 'Academic & grading rules', description: 'Set school-wide academic defaults. Academic years, classes, sections, and holidays are managed separately in the school calendar workspace.', navigationItemId: 'exams-report-cards', operationalImpact: 'These defaults shape grading, promotion, and result workflows in Academics (M4). Settings define the policy; Academics publishes results.', operationalLink: { href: '/dashboard/academics', label: 'Open Academics' }, fields: [
      { key: 'active_academic_year_label', label: 'Active academic year label', type: 'text', placeholder: '2083/84' },
      { key: 'default_calendar', label: 'Default calendar', type: 'select', defaultValue: 'BS', options: [{ label: 'Bikram Sambat (BS)', value: 'BS' }, { label: 'Anno Domini (AD)', value: 'AD' }] },
      { key: 'grading_scheme_label', label: 'Grading scheme label', type: 'text', placeholder: 'Letter Grade 2078' },
      { key: 'promotion_rule_mode', label: 'Promotion mode', type: 'select', defaultValue: 'MANUAL', options: [{ label: 'Manual approval', value: 'MANUAL' }, { label: 'Auto-promote on pass', value: 'AUTOMATIC' }] },
      { key: 'attendance_working_days', label: 'Normal working days', description: 'Calendar closures and exception days belong in the academic calendar.', type: 'multi-check', defaultValue: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], options: workingDays },
    ],
  },
  {
    id: 'attendance', eyebrow: 'Daily operations', title: 'Attendance rules', description: 'Set safe attendance lock, correction, and visibility policies for this school.', navigationItemId: 'attendance', operationalImpact: 'These rules control when teachers can mark or correct attendance in Smart Attendance (M2). Correction approvals stay in the Attendance workspace.', operationalLink: { href: '/dashboard/attendance', label: 'Open Attendance' }, fields: [
      { key: 'attendance_lock_hours', label: 'Attendance lock window', description: 'Hours after the school-day record before normal changes are blocked.', type: 'number', defaultValue: 24 },
      { key: 'late_threshold_minutes', label: 'Late threshold', type: 'number', defaultValue: 15 },
      { key: 'half_day_threshold_minutes', label: 'Half-day threshold', type: 'number', defaultValue: 180 },
      { key: 'allow_teacher_correction_request', label: 'Allow teacher correction requests', type: 'checkbox', defaultValue: true },
      { key: 'parent_attendance_visibility', label: 'Allow parent attendance visibility', type: 'checkbox', defaultValue: true },
      { key: 'weekend_policy', label: 'Weekend policy', type: 'select', defaultValue: 'SATURDAY', options: [{ label: 'Saturday only', value: 'SATURDAY' }, { label: 'Friday and Saturday', value: 'FRIDAY_SATURDAY' }, { label: 'Custom school calendar', value: 'CUSTOM' }] },
    ],
  },
  {
    id: 'fees', eyebrow: 'Fee operations', title: 'Fee & payment rules', description: 'Set policy defaults for receipts, approvals, cash closing, late fees and supported collection methods.', navigationItemId: 'fees', operationalImpact: 'These rules govern how Fees & Receipts (M3) issues receipts and collects payments. Payment collection and reversals stay in the Fees workspace.', operationalLink: { href: '/dashboard/fees', label: 'Open Fees' }, fields: [
      { key: 'receipt_number_prefix', label: 'Receipt number prefix', type: 'text', placeholder: 'REC-' },
      { key: 'late_fee_grace_days', label: 'Late-fee grace days', type: 'number', defaultValue: 0 },
      { key: 'active_fee_plan_required', label: 'Require an active fee plan', type: 'checkbox', defaultValue: true },
      { key: 'late_fee_enabled', label: 'Enable late fees', type: 'checkbox' },
      { key: 'waiver_approval_required', label: 'Require waiver approval', type: 'checkbox', defaultValue: true },
      { key: 'discount_approval_required', label: 'Require discount approval', type: 'checkbox', defaultValue: true },
      { key: 'cashier_close_required', label: 'Require cashier close', type: 'checkbox', defaultValue: true },
      { key: 'payment_methods_enabled', label: 'Accepted payment methods', type: 'multi-check', defaultValue: ['Cash', 'Bank Transfer', 'eSewa'], options: paymentMethods },
    ],
  },
  {
    id: 'communication', eyebrow: 'School communication', title: 'Communication rules', description: 'Configure controlled notice delivery, quiet hours, and parent-teacher chat boundaries.', navigationItemId: 'communication', operationalImpact: 'These rules control how Notices (M15) and Delivery (M12) reach families. Sending and tracking messages stays in the Notices workspace.', operationalLink: { href: '/dashboard/notices', label: 'Open Notices' }, fields: [
      { key: 'default_notice_channel', label: 'Default notice channel', type: 'select', defaultValue: 'EMAIL', options: [{ label: 'Email', value: 'EMAIL' }, { label: 'SMS', value: 'SMS' }, { label: 'Mobile app push', value: 'APP' }] },
      { key: 'parent_notification_enabled', label: 'Enable parent notifications', type: 'checkbox', defaultValue: true },
      { key: 'quiet_hours_enabled', label: 'Enable quiet hours', type: 'checkbox' },
      { key: 'chat_availability_enabled', label: 'Allow parent-teacher chat', type: 'checkbox', defaultValue: true },
      { key: 'chat_sunday_to_thursday_start', label: 'Sunday–Thursday chat start', type: 'time', defaultValue: '16:00' },
      { key: 'chat_sunday_to_thursday_end', label: 'Sunday–Thursday chat end', type: 'time', defaultValue: '19:00' },
      { key: 'chat_friday_start', label: 'Friday chat start', type: 'time', defaultValue: '14:00' },
      { key: 'chat_friday_end', label: 'Friday chat end', type: 'time', defaultValue: '17:00' },
      { key: 'chat_saturday_enabled', label: 'Enable Saturday chat', type: 'checkbox' },
      { key: 'emergency_override_requires_admin', label: 'Require administrator approval for emergency broadcasts', type: 'checkbox', defaultValue: true },
    ],
  },
  {
    id: 'activity-consent', eyebrow: 'Student activity', title: 'Activity, media & consent', description: 'Control whether student media requires recorded consent before it can be published to families.', navigationItemId: 'activity-consent', operationalImpact: 'When consent is required, Activity Feed (M5) blocks publishing student media without recorded consent. Post moderation stays in the Activity workspace. More granular activity and media policies need backend verification before they can be edited here.', operationalLink: { href: '/dashboard/activity', label: 'Open Activity' }, fields: [
      { key: 'consent_required_for_media', label: 'Require media consent', description: 'Block publishing student photos and videos without recorded consent.', type: 'checkbox', defaultValue: true },
    ],
  },
  {
    id: 'payroll', eyebrow: 'Staff and payroll', title: 'HR & payroll rules', description: 'Set staff leave and payroll policy defaults. Payroll results, salary structures, and payslips remain in HR & Payroll.', navigationItemId: 'hr-payroll', operationalImpact: 'These defaults shape leave approval and payroll runs in HR & Payroll (M7). Salary records and payslips stay permission-gated in the HR workspace.', operationalLink: { href: '/dashboard/hr', label: 'Open HR' }, fields: [
      { key: 'payroll_month_day', label: 'Payroll day of month', type: 'number', defaultValue: 28 },
      { key: 'default_working_days_per_month', label: 'Default working days per month', type: 'number', defaultValue: 26 },
      { key: 'pf_enabled', label: 'Enable PF', type: 'checkbox' },
      { key: 'tds_enabled', label: 'Enable TDS', type: 'checkbox' },
      { key: 'leave_approval_required', label: 'Require leave approval', type: 'checkbox', defaultValue: true },
      { key: 'unpaid_leave_affects_payroll', label: 'Unpaid leave affects payroll', type: 'checkbox', defaultValue: true },
      { key: 'payroll_approval_required', label: 'Require payroll approval', type: 'checkbox', defaultValue: true },
      { key: 'salary_payment_methods', label: 'Salary payment methods', type: 'multi-check', defaultValue: ['Bank Transfer'], options: [{ label: 'Bank transfer', value: 'Bank Transfer' }, { label: 'Cash', value: 'Cash' }, { label: 'Cheque', value: 'Cheque' }] },
    ],
  },
  {
    id: 'accounting', eyebrow: 'School finance', title: 'Accounting defaults', description: 'Set school accounting policy defaults. Journals, fiscal close, and reports remain inside Accounting.', navigationItemId: 'accounting', operationalImpact: 'These defaults guide posting and numbering in Accounting (M11). Journal posting, approval, and fiscal close stay in the Accounting workspace.', operationalLink: { href: '/dashboard/accounting', label: 'Open Accounting' }, fields: [
      { key: 'active_fiscal_year_label', label: 'Active fiscal year label', type: 'text', placeholder: '2083/84' },
      { key: 'fiscal_period_lock_policy', label: 'Fiscal period lock policy', type: 'select', defaultValue: 'MANUAL', options: [{ label: 'Manual close', value: 'MANUAL' }, { label: 'Monthly close', value: 'MONTHLY' }, { label: 'Quarterly close', value: 'QUARTERLY' }] },
      { key: 'default_cash_account_label', label: 'Default cash account', type: 'text' },
      { key: 'default_bank_account_label', label: 'Default bank account', type: 'text' },
      { key: 'salary_payable_account_label', label: 'Salary payable account', type: 'text' },
      { key: 'tds_payable_account_label', label: 'TDS payable account', type: 'text' },
      { key: 'pf_payable_account_label', label: 'PF payable account', type: 'text' },
      { key: 'fee_income_account_label', label: 'Fee income account', type: 'text' },
      { key: 'journal_number_prefix', label: 'Journal number prefix', type: 'text', placeholder: 'JV-' },
      { key: 'voucher_number_prefix', label: 'Voucher number prefix', type: 'text', placeholder: 'VCH-' },
    ],
  },
  {
    id: 'security', eyebrow: 'School governance', title: 'Security & privacy', description: 'Set session, privacy, data masking, and controlled-export defaults for this school.', navigationItemId: 'security', operationalImpact: 'These defaults control sensitive-field masking, session length, and export permission checks across every school workspace.', fields: [
      { key: 'audit_log_retention_days', label: 'Audit log retention days', type: 'number', defaultValue: 365 },
      { key: 'session_timeout_minutes', label: 'Session timeout minutes', type: 'number', defaultValue: 60 },
      { key: 'sensitive_staff_fields_masked', label: 'Mask sensitive staff fields', type: 'checkbox', defaultValue: true },
      { key: 'export_requires_permission', label: 'Require explicit export permission', type: 'checkbox', defaultValue: true },
      { key: 'require_reason_for_sensitive_reveal', label: 'Require reason to reveal sensitive fields', type: 'checkbox', defaultValue: true },
    ],
  },
];

export function getSchoolSettingsPolicy(id: string | undefined) {
  return SCHOOL_SETTINGS_POLICIES.find((policy) => policy.id === id);
}
