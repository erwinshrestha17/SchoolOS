'use client';

import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Calculator,
  CheckCircle2,
  Clock,
  CreditCard,
  Database,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  ImageUp,
  Key,
  LayoutDashboard,
  Loader2,
  Lock,
  MessageSquare,
  Palette,
  RotateCcw,
  Save,
  School,
  Search,
  Shield,
  Upload,
  UserCog,
  Users,
  X,
  Check,
  ChevronRight,
  Plus,
  Wallet,
} from 'lucide-react';

import { Button } from '../../../components/ui/button';
import { ConfirmDialog } from '../../../components/ui/confirm-dialog';
import { SetupForm } from '../../../components/forms/setup-form';
import { Badge } from '../../../components/ui/badge';
import { useEntitlements } from '../../../components/entitlements-provider';
import { api, type TenantLogoAccess } from '../../../lib/api';
import { cn } from '../../../lib/utils';
import { systemRoleDefinitions, systemRolePermissions } from '@schoolos/core';
import type { TenantSettingKey, TenantSettingSummary } from '@schoolos/core';

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldType = 'text' | 'email' | 'number' | 'select' | 'checkbox' | 'multi-check' | 'color' | 'time';

type FieldOption = {
  label: string;
  value: string;
};

type SettingFieldConfig = {
  key: TenantSettingKey;
  label: string;
  description?: string;
  type: FieldType;
  placeholder?: string;
  defaultValue?: unknown;
  options?: FieldOption[];
};

type SettingSectionConfig = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  fields: SettingFieldConfig[];
  tone: string;
  featureLink?: {
    label: string;
    href: string;
    description: string;
  };
};

type NavGroup = {
  label: string;
  items: string[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TENANT_LOGO_MAX_BYTES = 1024 * 1024;
const TENANT_LOGO_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const workingDayOptions: FieldOption[] = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
].map((day) => ({ label: day, value: day }));

const paymentMethodOptions: FieldOption[] = ['Cash', 'Bank Transfer', 'eSewa', 'Khalti', 'Cheque'].map((method) => ({
  label: method,
  value: method,
}));

const SETTINGS_SECTIONS: SettingSectionConfig[] = [
  {
    id: 'profile',
    eyebrow: 'Identity',
    title: 'School Profile',
    description: 'Official school details used on records, receipts, certificates, and reporting exports.',
    icon: School,
    tone: 'bg-blue-50 text-blue-700 border-blue-100',
    fields: [
      { key: 'school_name', label: 'School Name', type: 'text', placeholder: 'SchoolOS Academy' },
      { key: 'school_address', label: 'School Address', type: 'text', placeholder: 'Kathmandu, Nepal' },
      { key: 'school_phone', label: 'Contact Phone', type: 'text', placeholder: '+977-1-XXXXXXX' },
      { key: 'school_email', label: 'Contact Email', type: 'email', placeholder: 'admin@school.edu.np' },
      { key: 'school_pan_number', label: 'PAN / Registration Number', type: 'text' },
      { key: 'principal_name', label: 'Principal Name', type: 'text' },
      { key: 'municipality', label: 'Municipality', type: 'text' },
      { key: 'ward_number', label: 'Ward Number', type: 'number' },
      { key: 'district', label: 'District', type: 'text' },
      { key: 'province', label: 'Province', type: 'text' },
      {
        key: 'school_type',
        label: 'School Type',
        type: 'select',
        options: [
          { label: 'Select...', value: '' },
          { label: 'Private / Institutional', value: 'PRIVATE' },
          { label: 'Community / Government', value: 'COMMUNITY' },
          { label: 'Public Trust', value: 'TRUST' },
        ],
      },
      { key: 'iemis_school_code', label: 'iEMIS School Code', type: 'text' },
    ],
  },
  {
    id: 'branding',
    eyebrow: 'Documents',
    title: 'Branding & Documents',
    description: 'Control the school logo, document copy, currency, date format, and default paper size.',
    icon: Palette,
    tone: 'bg-violet-50 text-violet-700 border-violet-100',
    fields: [
      { key: 'branding_primary_color', label: 'Primary Color', type: 'color', defaultValue: '#6366f1' },
      { key: 'receipt_header_text', label: 'Receipt Header', type: 'text' },
      { key: 'receipt_footer_text', label: 'Receipt Footer', type: 'text' },
      { key: 'id_card_footer_text', label: 'ID Card Footer', type: 'text' },
      { key: 'payslip_footer_text', label: 'Payslip Footer', type: 'text' },
      { key: 'certificate_footer_text', label: 'Certificate Footer', type: 'text' },
      { key: 'report_card_footer_text', label: 'Report Card Footer', type: 'text' },
      {
        key: 'default_paper_size',
        label: 'Default Paper Size',
        type: 'select',
        defaultValue: 'A4',
        options: [
          { label: 'A4', value: 'A4' },
          { label: 'Letter', value: 'LETTER' },
          { label: 'Legal', value: 'LEGAL' },
          { label: 'Thermal 80mm', value: '80MM' },
        ],
      },
      {
        key: 'timezone',
        label: 'Timezone',
        type: 'select',
        defaultValue: 'Asia/Kathmandu',
        options: [
          { label: 'Nepal (UTC+5:45)', value: 'Asia/Kathmandu' },
          { label: 'UTC', value: 'UTC' },
        ],
      },
      {
        key: 'currency',
        label: 'Currency',
        type: 'select',
        defaultValue: 'NPR',
        options: [
          { label: 'Nepalese Rupee (NPR)', value: 'NPR' },
          { label: 'US Dollar (USD)', value: 'USD' },
        ],
      },
      {
        key: 'date_format',
        label: 'Date Format',
        type: 'select',
        defaultValue: 'YYYY-MM-DD',
        options: [
          { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
          { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
          { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
        ],
      },
    ],
  },
  {
    id: 'academic',
    eyebrow: 'Academic rules',
    title: 'Academic Defaults',
    description: 'Define academic-year labels, grading defaults, promotion behavior, and working days.',
    icon: GraduationCap,
    tone: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    featureLink: {
      href: '/dashboard/settings?section=school-setup',
      label: 'Open School Setup',
      description: 'Create academic years, classes, and sections.',
    },
    fields: [
      { key: 'active_academic_year_label', label: 'Active Academic Year', type: 'text', placeholder: '2081/82' },
      {
        key: 'default_calendar',
        label: 'Default Calendar',
        type: 'select',
        defaultValue: 'BS',
        options: [
          { label: 'Bikram Sambat (BS)', value: 'BS' },
          { label: 'Anno Domini (AD)', value: 'AD' },
        ],
      },
      { key: 'grading_scheme_label', label: 'Grading Scheme', type: 'text', placeholder: 'Letter Grade 2078' },
      {
        key: 'promotion_rule_mode',
        label: 'Promotion Mode',
        type: 'select',
        defaultValue: 'MANUAL',
        options: [
          { label: 'Manual Approval', value: 'MANUAL' },
          { label: 'Auto-promote on Pass', value: 'AUTOMATIC' },
        ],
      },
      {
        key: 'attendance_working_days',
        label: 'Working Days',
        description: 'Used by attendance, calendar, and reporting workflows.',
        type: 'multi-check',
        defaultValue: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        options: workingDayOptions,
      },
    ],
  },
  {
    id: 'fees',
    eyebrow: 'Billing rules',
    title: 'Fee & Payment Rules',
    description: 'Configure receipt numbering, late fee behavior, approval requirements, and accepted payment methods.',
    icon: CreditCard,
    tone: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    featureLink: {
      href: '/dashboard/fees',
      label: 'Open Fee Module',
      description: 'Manage fee plans, invoices, ledgers, and receipts.',
    },
    fields: [
      { key: 'receipt_number_prefix', label: 'Receipt Prefix', type: 'text', placeholder: 'REC-' },
      { key: 'late_fee_grace_days', label: 'Late Fee Grace Days', type: 'number', defaultValue: 0 },
      { key: 'active_fee_plan_required', label: 'Active Fee Plan Required', type: 'checkbox', defaultValue: true },
      { key: 'late_fee_enabled', label: 'Enable Late Fees', type: 'checkbox' },
      { key: 'waiver_approval_required', label: 'Require Waiver Approval', type: 'checkbox', defaultValue: true },
      { key: 'discount_approval_required', label: 'Require Discount Approval', type: 'checkbox', defaultValue: true },
      { key: 'cashier_close_required', label: 'Mandatory Cashier Close', type: 'checkbox', defaultValue: true },
      {
        key: 'payment_methods_enabled',
        label: 'Accepted Payment Methods',
        type: 'multi-check',
        defaultValue: ['Cash', 'Bank Transfer', 'eSewa'],
        options: paymentMethodOptions,
      },
    ],
  },
  {
    id: 'attendance',
    eyebrow: 'Daily operations',
    title: 'Attendance Rules',
    description: 'Set attendance lock windows, late thresholds, parent visibility, and correction policies.',
    icon: Clock,
    tone: 'bg-amber-50 text-amber-700 border-amber-100',
    fields: [
      { key: 'attendance_lock_hours', label: 'Attendance Lock Window (Hours)', type: 'number', defaultValue: 24 },
      { key: 'late_threshold_minutes', label: 'Late Threshold (Minutes)', type: 'number', defaultValue: 15 },
      { key: 'half_day_threshold_minutes', label: 'Half-day Threshold (Minutes)', type: 'number', defaultValue: 180 },
      { key: 'allow_teacher_correction_request', label: 'Allow Teacher Correction Request', type: 'checkbox', defaultValue: true },
      { key: 'parent_attendance_visibility', label: 'Parent Attendance Visibility', type: 'checkbox', defaultValue: true },
      {
        key: 'weekend_policy',
        label: 'Weekend Policy',
        type: 'select',
        defaultValue: 'SATURDAY',
        options: [
          { label: 'Saturday only', value: 'SATURDAY' },
          { label: 'Friday and Saturday', value: 'FRIDAY_SATURDAY' },
          { label: 'Custom / school calendar', value: 'CUSTOM' },
        ],
      },
    ],
  },
  {
    id: 'communication',
    eyebrow: 'Parent engagement',
    title: 'Communication Rules',
    description: 'Configure notification defaults, consent requirements, quiet hours, and teacher chat availability.',
    icon: MessageSquare,
    tone: 'bg-cyan-50 text-cyan-700 border-cyan-100',
    fields: [
      {
        key: 'default_notice_channel',
        label: 'Default Notice Channel',
        type: 'select',
        defaultValue: 'EMAIL',
        options: [
          { label: 'Email', value: 'EMAIL' },
          { label: 'SMS', value: 'SMS' },
          { label: 'Mobile App Push', value: 'APP' },
        ],
      },
      { key: 'parent_notification_enabled', label: 'Enable Parent Notifications', type: 'checkbox', defaultValue: true },
      { key: 'consent_required_for_media', label: 'Media Consent Required', type: 'checkbox', defaultValue: true },
      { key: 'quiet_hours_enabled', label: 'Enable Quiet Hours', type: 'checkbox' },
      { key: 'chat_availability_enabled', label: 'Allow Parent-Teacher Chat', type: 'checkbox', defaultValue: true },
      { key: 'chat_sunday_to_thursday_start', label: 'Sun–Thu Chat Start', type: 'time', defaultValue: '16:00' },
      { key: 'chat_sunday_to_thursday_end', label: 'Sun–Thu Chat End', type: 'time', defaultValue: '19:00' },
      { key: 'chat_friday_start', label: 'Friday Chat Start', type: 'time', defaultValue: '14:00' },
      { key: 'chat_friday_end', label: 'Friday Chat End', type: 'time', defaultValue: '17:00' },
      { key: 'chat_saturday_enabled', label: 'Enable Saturday Chat', type: 'checkbox' },
      { key: 'emergency_override_requires_admin', label: 'Emergency Broadcasts Require Admin', type: 'checkbox', defaultValue: true },
    ],
  },
  {
    id: 'payroll',
    eyebrow: 'Staff controls',
    title: 'HR & Payroll Rules',
    description: 'Configure leave approval, salary calculation defaults, PF/TDS readiness, and payroll approvals.',
    icon: Users,
    tone: 'bg-sky-50 text-sky-700 border-sky-100',
    featureLink: {
      href: '/dashboard/hr',
      label: 'Open HR Module',
      description: 'Manage staff, leave, and payroll runs.',
    },
    fields: [
      { key: 'payroll_month_day', label: 'Payroll Day of Month', type: 'number', defaultValue: 28 },
      { key: 'default_working_days_per_month', label: 'Default Working Days / Month', type: 'number', defaultValue: 26 },
      { key: 'pf_enabled', label: 'Enable PF', type: 'checkbox' },
      { key: 'tds_enabled', label: 'Enable TDS', type: 'checkbox' },
      { key: 'leave_approval_required', label: 'Leave Approval Required', type: 'checkbox', defaultValue: true },
      { key: 'unpaid_leave_affects_payroll', label: 'Unpaid Leave Affects Payroll', type: 'checkbox', defaultValue: true },
      { key: 'payroll_approval_required', label: 'Payroll Approval Required', type: 'checkbox', defaultValue: true },
      {
        key: 'salary_payment_methods',
        label: 'Salary Payment Methods',
        type: 'multi-check',
        defaultValue: ['Bank Transfer'],
        options: [
          { label: 'Bank Transfer', value: 'Bank Transfer' },
          { label: 'Cash', value: 'Cash' },
          { label: 'Cheque', value: 'Cheque' },
        ],
      },
    ],
  },
  {
    id: 'accounting',
    eyebrow: 'Finance control',
    title: 'Accounting Defaults',
    description: 'Set fiscal labels, account mappings, voucher numbering, and period lock behavior.',
    icon: Calculator,
    tone: 'bg-rose-50 text-rose-700 border-rose-100',
    featureLink: {
      href: '/dashboard/accounting',
      label: 'Open Accounting Module',
      description: 'Manage journals, accounts, and fiscal periods.',
    },
    fields: [
      { key: 'active_fiscal_year_label', label: 'Active Fiscal Year', type: 'text', placeholder: '2081/82' },
      {
        key: 'fiscal_period_lock_policy',
        label: 'Fiscal Period Lock Policy',
        type: 'select',
        defaultValue: 'MANUAL',
        options: [
          { label: 'Manual close', value: 'MANUAL' },
          { label: 'Monthly close', value: 'MONTHLY' },
          { label: 'Quarterly close', value: 'QUARTERLY' },
        ],
      },
      { key: 'default_cash_account_label', label: 'Default Cash Account', type: 'text' },
      { key: 'default_bank_account_label', label: 'Default Bank Account', type: 'text' },
      { key: 'salary_payable_account_label', label: 'Salary Payable Account', type: 'text' },
      { key: 'tds_payable_account_label', label: 'TDS Payable Account', type: 'text' },
      { key: 'pf_payable_account_label', label: 'PF Payable Account', type: 'text' },
      { key: 'fee_income_account_label', label: 'Fee Income Account', type: 'text' },
      { key: 'journal_number_prefix', label: 'Journal Number Prefix', type: 'text', placeholder: 'JV-' },
      { key: 'voucher_number_prefix', label: 'Voucher Number Prefix', type: 'text', placeholder: 'VCH-' },
    ],
  },
  {
    id: 'security',
    eyebrow: 'Governance',
    title: 'Security & Privacy',
    description: 'Control export permissions, data masking, sensitive reveal reasons, and session timeout.',
    icon: Shield,
    tone: 'bg-slate-100 text-slate-700 border-slate-200',
    fields: [
      { key: 'audit_log_retention_days', label: 'Audit Log Retention (Days)', type: 'number', defaultValue: 365 },
      { key: 'session_timeout_minutes', label: 'Session Timeout (Minutes)', type: 'number', defaultValue: 60 },
      { key: 'sensitive_staff_fields_masked', label: 'Mask Sensitive Staff Fields', type: 'checkbox', defaultValue: true },
      { key: 'export_requires_permission', label: 'Exports Require Explicit Permission', type: 'checkbox', defaultValue: true },
      { key: 'require_reason_for_sensitive_reveal', label: 'Require Reason for Sensitive Reveal', type: 'checkbox', defaultValue: true },
    ],
  },
];

// ─── Utility section definitions (no editable fields) ─────────────────────────

const SPECIAL_SECTIONS = [
  {
    id: 'overview',
    eyebrow: 'Console',
    title: 'Overview',
    description: 'Settings readiness dashboard. Review and configure your school\'s core operational setup.',
    icon: LayoutDashboard,
    tone: 'bg-slate-100 text-slate-600 border-slate-200',
  },
  {
    id: 'school-setup',
    eyebrow: 'Academic structure',
    title: 'School Setup',
    description: 'Configure academic years, classes, sections, and foundational academic structure.',
    icon: BookOpen,
    tone: 'bg-green-50 text-green-700 border-green-100',
  },
  {
    id: 'users-access',
    eyebrow: 'Access control',
    title: 'Users & Access',
    description: 'Manage admin, staff, parent, and student access to SchoolOS.',
    icon: UserCog,
    tone: 'bg-blue-50 text-blue-700 border-blue-100',
  },
  {
    id: 'roles-permissions',
    eyebrow: 'Access control',
    title: 'Roles & Permissions',
    description: 'Review preset roles, permission coverage, and module-level access.',
    icon: Key,
    tone: 'bg-purple-50 text-purple-700 border-purple-100',
  },
  {
    id: 'fee-setup',
    eyebrow: 'Billing structure',
    title: 'Active Fee Plans',
    description: 'Configure fee heads and class/year-specific fee plans.',
    icon: Wallet,
    tone: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  },
  {
    id: 'data',
    eyebrow: 'Data operations',
    title: 'Import / Export',
    description: 'Bulk data movement, official readiness, and migration workflows.',
    icon: Database,
    tone: 'bg-teal-50 text-teal-700 border-teal-100',
  },
  {
    id: 'audit',
    eyebrow: 'Governance',
    title: 'Audit Logs',
    description: 'Track sensitive admin activity and request audit archives.',
    icon: FileText,
    tone: 'bg-orange-50 text-orange-700 border-orange-100',
  },
  {
    id: 'subscription',
    eyebrow: 'Plan',
    title: 'Subscription',
    description: 'View current SaaS tier, included modules, and add-on status.',
    icon: CreditCard,
    tone: 'bg-purple-50 text-purple-700 border-purple-100',
  },
] as const;

type SpecialSectionId = (typeof SPECIAL_SECTIONS)[number]['id'];

const ALL_SECTIONS = [...SPECIAL_SECTIONS, ...SETTINGS_SECTIONS] as const;

// Left nav groups define the visual grouping in the sidebar
const NAV_GROUPS: NavGroup[] = [
  { label: 'School', items: ['overview', 'school-setup', 'profile', 'branding'] },
  { label: 'Access Control', items: ['users-access', 'roles-permissions'] },
  { label: 'Academic & Operations', items: ['academic', 'attendance', 'fee-setup', 'fees', 'communication'] },
  { label: 'Staff & Finance', items: ['payroll', 'accounting'] },
  { label: 'Security & Data', items: ['security', 'data', 'audit', 'subscription'] },
];

// Map old/legacy tab/section values to new ids
const SECTION_ALIASES: Record<string, string> = {
  setup: 'school-setup',
  'school-setup': 'school-setup',
  branding: 'branding',
  profile: 'profile',
  academic: 'academic',
  attendance: 'attendance',
  fees: 'fees',
  fee: 'fees',
  'fee-setup': 'fee-setup',
  'fee-plans': 'fee-setup',
  'fee-plan': 'fee-setup',
  communication: 'communication',
  payroll: 'payroll',
  hr: 'payroll',
  accounting: 'accounting',
  security: 'security',
  data: 'data',
  audit: 'audit',
  subscription: 'subscription',
  'users-access': 'users-access',
  users: 'users-access',
  'roles-permissions': 'roles-permissions',
  roles: 'roles-permissions',
};

const ALL_SECTION_IDS = ALL_SECTIONS.map((s) => s.id);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatFileSize = (sizeBytes: number) => {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return '0 B';
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
};

const defaultValueForField = (field: SettingFieldConfig) => {
  if (field.defaultValue !== undefined) return field.defaultValue;
  if (field.type === 'checkbox') return false;
  if (field.type === 'multi-check') return [];
  if (field.type === 'number') return 0;
  return '';
};

const normalizeFieldValue = (field: SettingFieldConfig, value: unknown) => {
  if (value === undefined || value === null) return defaultValueForField(field);
  if (field.type === 'multi-check') return Array.isArray(value) ? value : [];
  if (field.type === 'checkbox') return Boolean(value);
  return value;
};

function buildInitialForm(settings: TenantSettingSummary[]) {
  const next: Record<string, unknown> = {};
  for (const section of SETTINGS_SECTIONS) {
    for (const field of section.fields) {
      const setting = settings.find((item) => item.key === field.key);
      next[field.key] = normalizeFieldValue(field, setting?.value);
    }
  }
  return next;
}

const valuesEqual = (left: unknown, right: unknown) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

function resolveSection(raw: string | null): string {
  if (!raw) return 'overview';
  const aliased = SECTION_ALIASES[raw.toLowerCase()] ?? raw;
  return ALL_SECTION_IDS.includes(aliased) ? aliased : 'overview';
}

// ─── Page Entry ───────────────────────────────────────────────────────────────

export default function TenantSettingsPage() {
  return (
    <Suspense fallback={<SettingsLoading />}>
      <TenantSettingsContent />
    </Suspense>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────

function TenantSettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSection = searchParams.get('section') ?? searchParams.get('tab');
  const activeSectionId = resolveSection(requestedSection);

  const [settings, setSettings] = useState<TenantSettingSummary[]>([]);
  const [feePlans, setFeePlans] = useState<any[]>([]);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [query, setQuery] = useState('');

  const activeSection = ALL_SECTIONS.find((s) => s.id === activeSectionId) ?? ALL_SECTIONS[0];
  const activeEditableSection = SETTINGS_SECTIONS.find((s) => s.id === activeSectionId);

  const initialForm = useMemo(() => buildInitialForm(settings), [settings]);
  const editableKeys = useMemo(
    () => SETTINGS_SECTIONS.flatMap((section) => section.fields.map((field) => field.key)),
    [],
  );
  const changedKeys = editableKeys.filter((key) => !valuesEqual(form[key], initialForm[key]));
  const sectionChangedCount = activeEditableSection
    ? activeEditableSection.fields.filter((field) => changedKeys.includes(field.key)).length
    : 0;

  const logoSetting = settings.find((setting) => setting.key === 'school_logo');
  const logoFileAssetId = typeof logoSetting?.value === 'string' ? logoSetting.value : null;
  const schoolName = String(form['school_name'] ?? '');

  useEffect(() => {
    void fetchSettings();
  }, []);

  useEffect(() => {
    setForm(initialForm);
  }, [initialForm]);

  // Auto-dismiss notice after 4s
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  async function fetchSettings() {
    try {
      setLoading(true);
      setError(null);
      const [settingsData, feePlansData] = await Promise.all([
        api.getTenantSettings(),
        api.listFeePlans().catch(() => []),
      ]);
      setSettings(settingsData);
      setFeePlans(feePlansData);
    } catch {
      setError('Failed to load school settings.');
    } finally {
      setLoading(false);
    }
  }

  function switchSection(sectionId: string) {
    setNotice(null);
    router.replace(`/dashboard/settings?section=${sectionId}`, { scroll: false });
  }

  function setFieldValue(key: TenantSettingKey, value: unknown) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetSection() {
    if (!activeEditableSection) return;
    const reset: Record<string, unknown> = { ...form };
    for (const field of activeEditableSection.fields) {
      reset[field.key] = initialForm[field.key];
    }
    setForm(reset);
  }

  async function saveActiveSection() {
    if (!activeEditableSection || sectionChangedCount === 0) return;

    try {
      setSaving(true);
      setNotice(null);

      for (const field of activeEditableSection.fields) {
        const nextValue = form[field.key];
        const previousValue = initialForm[field.key];
        if (!valuesEqual(nextValue, previousValue)) {
          await api.updateTenantSetting(field.key, nextValue);
        }
      }

      setNotice({ type: 'success', text: `${activeEditableSection.title} saved successfully.` });
      await fetchSettings();
    } catch {
      setNotice({ type: 'error', text: 'Failed to save this settings group.' });
    } finally {
      setSaving(false);
    }
  }

  const filteredSections = ALL_SECTIONS.filter((section) => {
    if (!query.trim()) return true;
    const needle = `${section.title} ${section.description} ${section.eyebrow}`.toLowerCase();
    return needle.includes(query.toLowerCase());
  });

  const filteredSectionIds = new Set(filteredSections.map((s) => s.id));

  if (loading) return <SettingsLoading />;

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-700">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle size={18} />
            <span>Settings unavailable</span>
          </div>
          <p className="mt-1.5 text-sm text-rose-600">{error}</p>
          <Button variant="outline" size="sm" className="mt-4 rounded-lg" onClick={() => void fetchSettings()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* ── Compact Page Header ─────────────────────────────── */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Settings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage school profile, rules, permissions, documents, and tenant configuration.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500">
            Tenant-scoped
          </span>
          {changedKeys.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              {changedKeys.length} unsaved
            </span>
          )}
        </div>
      </div>

      {/* ── Mobile Section Selector (visible on < xl screens) ── */}
      <div className="mb-4 xl:hidden">
        <MobileSectionSelector
          allSections={ALL_SECTIONS}
          navGroups={NAV_GROUPS}
          activeSectionId={activeSectionId}
          changedKeys={changedKeys}
          settingsSections={SETTINGS_SECTIONS}
          onSwitchSection={switchSection}
        />
      </div>

      {/* ── Two-column Settings Shell ────────────────────────── */}
      <div className="flex gap-6 xl:gap-8">
        {/* Left Sidebar Nav */}
        <SettingsSidebar
          navGroups={NAV_GROUPS}
          allSections={ALL_SECTIONS}
          settingsSections={SETTINGS_SECTIONS}
          activeSectionId={activeSectionId}
          changedKeys={changedKeys}
          query={query}
          filteredSectionIds={filteredSectionIds}
          onQueryChange={setQuery}
          onSwitchSection={switchSection}
        />

        {/* Right Content */}
        <main className="min-w-0 flex-1">
          {/* Toast Notice */}
          {notice && (
            <div
              className={cn(
                'mb-4 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium',
                notice.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-rose-200 bg-rose-50 text-rose-700',
              )}
            >
              {notice.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span className="flex-1">{notice.text}</span>
              <button type="button" onClick={() => setNotice(null)} className="opacity-60 hover:opacity-100">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Section Content */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            {/* Section Header */}
            <SectionHeader section={activeSection} settingsSections={SETTINGS_SECTIONS} />

            {/* Editable Settings Fields */}
            {activeEditableSection && (
              <EditableSettingsSection
                section={activeEditableSection}
                form={form}
                logoFileAssetId={logoFileAssetId}
                onFieldChange={setFieldValue}
                onLogoChanged={() => void fetchSettings()}
              />
            )}

            {/* Special Panels */}
            {activeSectionId === 'overview' && (
              <div className="p-6">
                <OverviewPanel
                  settings={settings}
                  schoolName={schoolName}
                  logoFileAssetId={logoFileAssetId}
                  activeFeePlanCount={feePlans.filter((p: any) => p.isActive).length}
                  onSwitchSection={switchSection}
                />
              </div>
            )}
            {activeSectionId === 'school-setup' && (
              <div className="p-6">
                <SchoolSetupPanel />
              </div>
            )}
            {activeSectionId === 'users-access' && (
              <div className="p-6">
                <UsersAccessPanel />
              </div>
            )}
            {activeSectionId === 'roles-permissions' && (
              <div className="p-6">
                <RolesPermissionsPanel />
              </div>
            )}
            {activeSectionId === 'fee-setup' && (
              <div className="p-6">
                <FeeSetupPanel onPlanCreated={fetchSettings} />
              </div>
            )}
            {activeSectionId === 'data' && <div className="p-6"><DataOperations /></div>}
            {activeSectionId === 'audit' && <div className="p-6"><AuditPanel /></div>}
            {activeSectionId === 'subscription' && <div className="p-6"><SubscriptionPanel /></div>}
          </div>
        </main>
      </div>

      {/* ── Sticky Unsaved Changes Bar ───────────────────────── */}
      {sectionChangedCount > 0 && (
        <UnsavedBar
          sectionTitle={activeEditableSection?.title ?? ''}
          changedCount={sectionChangedCount}
          saving={saving}
          onReset={resetSection}
          onSave={() => void saveActiveSection()}
        />
      )}
    </div>
  );
}

// ─── Settings Sidebar ─────────────────────────────────────────────────────────

function SettingsSidebar({
  navGroups,
  allSections,
  settingsSections,
  activeSectionId,
  changedKeys,
  query,
  filteredSectionIds,
  onQueryChange,
  onSwitchSection,
}: {
  navGroups: NavGroup[];
  allSections: typeof ALL_SECTIONS;
  settingsSections: SettingSectionConfig[];
  activeSectionId: string;
  changedKeys: string[];
  query: string;
  filteredSectionIds: Set<string>;
  onQueryChange: (q: string) => void;
  onSwitchSection: (id: string) => void;
}) {
  return (
    <aside className="hidden w-[240px] shrink-0 xl:block xl:sticky xl:top-4 xl:self-start">
      {/* Search */}
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search settings…"
          className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs font-medium text-slate-700 placeholder-slate-400 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-900/5"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Nav Groups */}
      <nav className="space-y-4">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((id) => filteredSectionIds.has(id));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label}>
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map((sectionId) => {
                  const section = allSections.find((s) => s.id === sectionId);
                  if (!section) return null;
                  const Icon = section.icon;
                  const isActive = sectionId === activeSectionId;
                  const editableSection = settingsSections.find((s) => s.id === sectionId);
                  const dirtyCount = editableSection
                    ? editableSection.fields.filter((f) => changedKeys.includes(f.key)).length
                    : 0;

                  return (
                    <button
                      key={sectionId}
                      type="button"
                      onClick={() => onSwitchSection(sectionId)}
                      className={cn(
                        'group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
                        isActive
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                      )}
                    >
                      <Icon
                        size={14}
                        className={cn(
                          'shrink-0',
                          isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600',
                        )}
                      />
                      <span className="flex-1 truncate font-medium leading-none">{section.title}</span>
                      {dirtyCount > 0 && (
                        <span
                          className={cn(
                            'flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold',
                            isActive ? 'bg-amber-400 text-amber-900' : 'bg-amber-100 text-amber-700',
                          )}
                        >
                          {dirtyCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

// ─── Mobile Section Selector ─────────────────────────────────────────────────

function MobileSectionSelector({
  allSections,
  navGroups,
  activeSectionId,
  changedKeys,
  settingsSections,
  onSwitchSection,
}: {
  allSections: typeof ALL_SECTIONS;
  navGroups: NavGroup[];
  activeSectionId: string;
  changedKeys: string[];
  settingsSections: SettingSectionConfig[];
  onSwitchSection: (id: string) => void;
}) {
  const activeSection = allSections.find((s) => s.id === activeSectionId);

  return (
    <div className="space-y-2">
      <div className="-mx-1 overflow-x-auto pb-1 pt-0.5">
        <div className="flex min-w-max gap-1 px-1">
          {navGroups.map((group) => (
            <div key={group.label} className="flex items-center gap-1">
              <span className="px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {group.label}
              </span>
              {group.items.map((sectionId) => {
                const section = allSections.find((s) => s.id === sectionId);
                if (!section) return null;
                const isActive = sectionId === activeSectionId;
                const editableSection = settingsSections.find((s) => s.id === sectionId);
                const dirtyCount = editableSection
                  ? editableSection.fields.filter((f) => changedKeys.includes(f.key)).length
                  : 0;
                const Icon = section.icon;

                return (
                  <button
                    key={sectionId}
                    type="button"
                    onClick={() => onSwitchSection(sectionId)}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition',
                      isActive
                        ? 'bg-slate-900 text-white'
                        : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900',
                    )}
                  >
                    <Icon size={12} className="shrink-0" />
                    {section.title}
                    {dirtyCount > 0 && (
                      <span
                        className={cn(
                          'flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold',
                          isActive ? 'bg-amber-400 text-amber-900' : 'bg-amber-100 text-amber-700',
                        )}
                      >
                        {dirtyCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {activeSection && (
        <p className="text-xs text-slate-400">
          Viewing: <span className="font-medium text-slate-600">{activeSection.title}</span>
        </p>
      )}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
  section,
  settingsSections,
}: {
  section: (typeof ALL_SECTIONS)[number];
  settingsSections: SettingSectionConfig[];
}) {
  const Icon = section.icon;
  const settingsSection = settingsSections.find((s) => s.id === section.id);
  const featureLink = settingsSection?.featureLink ?? null;

  return (
    <div className="border-b border-slate-100 px-6 py-5">
      <div className="flex items-start gap-3">
        <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', section.tone)}>
          <Icon size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">{section.title}</h2>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{section.eyebrow}</span>
          </div>
          <p className="mt-0.5 text-sm text-slate-500">{section.description}</p>
        </div>
        {featureLink ? (
          <Link
            href={featureLink.href}
            className="group ml-auto flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          >
            {featureLink.label}
            <ExternalLink size={11} className="text-slate-400 group-hover:text-slate-600" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

// ─── Unsaved Changes Bar ──────────────────────────────────────────────────────

function UnsavedBar({
  sectionTitle,
  changedCount,
  saving,
  onReset,
  onSave,
}: {
  sectionTitle: string;
  changedCount: number;
  saving: boolean;
  onReset: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white px-4 py-3 shadow-lg sm:px-6">
      <div className="mx-auto flex max-w-[1600px] items-center gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
          </span>
          <p className="truncate text-sm font-medium text-slate-700">
            {changedCount} unsaved {changedCount === 1 ? 'change' : 'changes'} in{' '}
            <span className="font-semibold text-slate-900">{sectionTitle}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            disabled={saving}
            className="gap-1.5 rounded-lg text-slate-600 hover:text-slate-900"
          >
            <RotateCcw size={13} />
            Reset
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onSave}
            disabled={saving}
            className="gap-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Editable Settings Section ────────────────────────────────────────────────

function EditableSettingsSection({
  section,
  form,
  logoFileAssetId,
  onFieldChange,
  onLogoChanged,
}: {
  section: SettingSectionConfig;
  form: Record<string, unknown>;
  logoFileAssetId: string | null;
  onFieldChange: (key: TenantSettingKey, value: unknown) => void;
  onLogoChanged: () => void;
}) {
  const textLikeFields = section.fields.filter(
    (f) => f.type !== 'checkbox' && f.type !== 'multi-check',
  );
  const checkboxFields = section.fields.filter((f) => f.type === 'checkbox');
  const multiCheckFields = section.fields.filter((f) => f.type === 'multi-check');

  return (
    <div className="divide-y divide-slate-100">
      {/* Branding: Logo Panel */}
      {section.id === 'branding' && (
        <div className="px-6 py-5">
          <LogoPanel logoFileAssetId={logoFileAssetId} onLogoChanged={onLogoChanged} />
        </div>
      )}

      {/* Branding: Document preview */}
      {section.id === 'branding' && (
        <div className="px-6 py-5">
          <BrandingPreview
            schoolName={String(form['school_name'] ?? '')}
            primaryColor={String(form['branding_primary_color'] ?? '#6366f1')}
            headerText={String(form['receipt_header_text'] ?? '')}
            footerText={String(form['receipt_footer_text'] ?? '')}
            logoFileAssetId={logoFileAssetId}
          />
        </div>
      )}

      {textLikeFields.length > 0 && (
        <div className="divide-y divide-slate-100">
          {textLikeFields.map((field) => (
            <FieldRow key={field.key} field={field} value={form[field.key]} onChange={(v) => onFieldChange(field.key, v)} />
          ))}
        </div>
      )}

      {checkboxFields.length > 0 && (
        <div className="divide-y divide-slate-100">
          {checkboxFields.map((field) => (
            <ToggleRow key={field.key} field={field} value={form[field.key]} onChange={(v) => onFieldChange(field.key, v)} />
          ))}
        </div>
      )}

      {multiCheckFields.map((field) => (
        <MultiCheckRow key={field.key} field={field} value={form[field.key]} onChange={(v) => onFieldChange(field.key, v)} />
      ))}
    </div>
  );
}

// ─── Field Row ────────────────────────────────────────────────────────────────

function FieldRow({
  field,
  value,
  onChange,
}: {
  field: SettingFieldConfig;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  return (
    <div className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="sm:w-[240px] sm:shrink-0">
        <p className="text-sm font-medium text-slate-800">{field.label}</p>
        {field.description && (
          <p className="mt-0.5 text-xs leading-5 text-slate-500">{field.description}</p>
        )}
      </div>
      <div className="w-full sm:max-w-sm">
        {field.type === 'color' ? (
          <ColorField value={String(value || field.defaultValue || '#6366f1')} onChange={onChange} />
        ) : field.type === 'select' ? (
          <select
            value={String(value ?? field.defaultValue ?? '')}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 disabled:opacity-50"
          >
            {(field.options ?? []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : field.type === 'time' ? 'time' : 'text'}
            value={String(value ?? '')}
            placeholder={field.placeholder}
            onChange={(e) => {
              if (field.type === 'number') {
                onChange(e.target.value === '' ? '' : Number(e.target.value));
                return;
              }
              onChange(e.target.value);
            }}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 placeholder-slate-400 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5"
          />
        )}
      </div>
    </div>
  );
}

// ─── Color Field ──────────────────────────────────────────────────────────────

function ColorField({ value, onChange }: { value: string; onChange: (v: unknown) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-14 cursor-pointer rounded-lg border border-slate-200 bg-white p-1 outline-none"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          if (/^#[0-9a-f]{6}$/i.test(v)) onChange(v);
          else onChange(v);
        }}
        maxLength={7}
        placeholder="#6366f1"
        className="h-9 w-[110px] rounded-lg border border-slate-200 bg-white px-3 font-mono text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5"
      />
      <div className="h-9 w-14 rounded-lg border border-slate-200" style={{ backgroundColor: value }} />
    </div>
  );
}

// ─── Toggle Row ───────────────────────────────────────────────────────────────

function ToggleRow({
  field,
  value,
  onChange,
}: {
  field: SettingFieldConfig;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const checked = Boolean(value);
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4">
      <div>
        <p className="text-sm font-medium text-slate-800">{field.label}</p>
        {field.description && (
          <p className="mt-0.5 text-xs leading-5 text-slate-500">{field.description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2',
          checked ? 'bg-slate-900' : 'bg-slate-200',
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  );
}

// ─── Multi-Check Row ──────────────────────────────────────────────────────────

function MultiCheckRow({
  field,
  value,
  onChange,
}: {
  field: SettingFieldConfig;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const selected = Array.isArray(value) ? value.map(String) : [];

  return (
    <div className="px-6 py-4">
      <div className="mb-3">
        <p className="text-sm font-medium text-slate-800">{field.label}</p>
        {field.description && (
          <p className="mt-0.5 text-xs leading-5 text-slate-500">{field.description}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {(field.options ?? []).map((option) => {
          const isSelected = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                const next = isSelected
                  ? selected.filter((item) => item !== option.value)
                  : [...selected, option.value];
                onChange(next);
              }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition',
                isSelected
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900',
              )}
            >
              {isSelected && <Check size={11} />}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Branding Preview ─────────────────────────────────────────────────────────

function BrandingPreview({
  schoolName,
  primaryColor,
  headerText,
  footerText,
}: {
  schoolName: string;
  primaryColor: string;
  headerText: string;
  footerText: string;
  logoFileAssetId: string | null;
}) {
  const displayName = schoolName || 'Your School Name';
  const displayHeader = headerText || 'Official Receipt';
  const displayFooter = footerText || 'Thank you for your payment.';

  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Document Branding Preview</p>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `3px solid ${primaryColor}` }}>
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${primaryColor}18` }}
          >
            <School size={18} style={{ color: primaryColor }} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">{displayName}</p>
            <p className="text-xs text-slate-500">{displayHeader}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Receipt</p>
            <p className="font-mono text-xs font-semibold text-slate-700">REC-2081-0001</p>
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="space-y-1.5">
            {['Student Fee', 'Transport Fee', 'Exam Fee'].map((item, i) => (
              <div key={item} className="flex justify-between text-xs text-slate-600">
                <span>{item}</span>
                <span className="font-medium text-slate-800">NPR {[5000, 1500, 800][i]?.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-xs font-semibold">
            <span style={{ color: primaryColor }}>Total</span>
            <span className="text-slate-900">NPR 7,300</span>
          </div>
        </div>
        <div className="border-t border-slate-100 px-4 py-2 text-center text-[10px] text-slate-400">
          {displayFooter}
        </div>
      </div>
    </div>
  );
}

// ─── Logo Panel ───────────────────────────────────────────────────────────────

function LogoPanel({ logoFileAssetId, onLogoChanged }: { logoFileAssetId: string | null; onLogoChanged: () => void }) {
  const [preview, setPreview] = useState<TenantLogoAccess | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);

  useEffect(() => {
    let active = true;

    if (!logoFileAssetId) {
      setPreview(null);
      setError(null);
      return () => { active = false; };
    }

    setLoading(true);
    setError(null);
    api
      .getSchoolLogoPreview()
      .then((access) => { if (active) setPreview(access); })
      .catch((err: unknown) => {
        if (active) {
          setPreview(null);
          setError(err instanceof Error ? err.message : 'Failed to load school logo preview.');
        }
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [logoFileAssetId]);

  const busy = loading || uploading || removing || downloading;

  async function handleLogoSelection(file: File | undefined) {
    setMessage(null);
    setError(null);
    if (!file) return;

    if (!TENANT_LOGO_MIME_TYPES.has(file.type)) {
      setError('Use JPG, PNG, or WEBP for the school logo.');
      return;
    }
    if (file.size > TENANT_LOGO_MAX_BYTES) {
      setError('School logo must be 1MB or smaller.');
      return;
    }

    try {
      setUploading(true);
      await api.uploadSchoolLogo(file);
      const access = await api.getSchoolLogoPreview();
      setPreview(access);
      setMessage('School logo uploaded through the private File Registry.');
      onLogoChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload the school logo.');
    } finally {
      setUploading(false);
    }
  }

  async function openLogoDownload() {
    try {
      setDownloading(true);
      setError(null);
      const access = await api.getSchoolLogoDownload();
      window.open(access.url, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to open logo download.');
    } finally {
      setDownloading(false);
    }
  }

  async function removeLogo() {
    try {
      setRemoving(true);
      setError(null);
      await api.removeSchoolLogo();
      setPreview(null);
      setMessage('School logo removed.');
      setRemoveOpen(false);
      onLogoChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove school logo.');
    } finally {
      setRemoving(false);
    }
  }

  return (
    <>
      <div data-testid="school-logo-upload-panel">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">School Logo</p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {loading ? (
              <Loader2 size={20} className="animate-spin text-slate-300" />
            ) : preview?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.url} alt="School logo" className="h-full w-full object-contain p-2" />
            ) : (
              <ImageUp className="h-7 w-7 text-slate-300" />
            )}
          </div>

          <div className="flex-1">
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              <span
                className={cn(
                  'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold',
                  logoFileAssetId
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-100 text-slate-500',
                )}
              >
                {logoFileAssetId ? 'Logo configured' : 'No logo uploaded'}
              </span>
              <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                Private File Registry
              </span>
              {preview && (
                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                  {formatFileSize(preview.sizeBytes)}
                </span>
              )}
            </div>
            <p className="text-xs leading-5 text-slate-500">
              Upload a JPG, PNG, or WEBP logo up to 1MB. Stored privately and served through signed links.
            </p>
            {preview && (
              <p className="mt-1 text-[11px] text-slate-400">
                {preview.fileName} · Preview expires in {preview.expiresInSeconds}s
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <label
                className={cn(
                  'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800',
                  busy && 'cursor-not-allowed opacity-50',
                )}
              >
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                {uploading ? 'Uploading…' : logoFileAssetId ? 'Replace' : 'Upload logo'}
                <input
                  aria-label="Upload school logo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={busy}
                  onChange={(e) => { void handleLogoSelection(e.target.files?.[0]); e.currentTarget.value = ''; }}
                />
              </label>
              {logoFileAssetId && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void openLogoDownload()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-50"
                  >
                    {downloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                    Download
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setRemoveOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                  >
                    <X size={12} />
                    Remove
                  </button>
                </>
              )}
            </div>

            {message && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 size={12} /> {message}
              </p>
            )}
            {error && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-600">
                <AlertCircle size={12} /> {error}
              </p>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={removeOpen}
        title="Remove School Logo"
        description="Remove the current school logo from document branding? Existing audit history and file records are retained."
        confirmLabel="Remove Logo"
        destructive
        isConfirming={removing}
        onConfirm={() => void removeLogo()}
        onClose={() => setRemoveOpen(false)}
      />
    </>
  );
}

// ─── Overview Panel ───────────────────────────────────────────────────────────

function OverviewPanel({
  settings,
  schoolName,
  logoFileAssetId,
  activeFeePlanCount,
  onSwitchSection,
}: {
  settings: TenantSettingSummary[];
  schoolName: string;
  logoFileAssetId: string | null;
  activeFeePlanCount: number;
  onSwitchSection: (id: string) => void;
}) {
  function getSettingValue(key: TenantSettingKey): string | null {
    const s = settings.find((item) => item.key === key);
    if (!s || s.value === null || s.value === undefined || s.value === '') return null;
    return String(s.value);
  }

  const hasSchoolName = Boolean(getSettingValue('school_name'));
  const hasSchoolPhone = Boolean(getSettingValue('school_phone'));
  const hasAcademicYear = Boolean(getSettingValue('active_academic_year_label'));
  const hasBranding = Boolean(logoFileAssetId) || Boolean(getSettingValue('branding_primary_color'));

  const readinessItems: Array<{
    label: string;
    description: string;
    sectionId: string;
    status: 'ok' | 'review' | 'pending';
  }> = [
    {
      label: 'School Profile',
      description: hasSchoolName && hasSchoolPhone ? `${getSettingValue('school_name') ?? ''} · ${getSettingValue('school_phone') ?? ''}` : 'School name and contact not set',
      sectionId: 'profile',
      status: hasSchoolName ? 'ok' : 'review',
    },
    {
      label: 'Branding & Logo',
      description: logoFileAssetId ? 'Logo uploaded, primary color configured' : 'No logo uploaded yet',
      sectionId: 'branding',
      status: hasBranding ? 'ok' : 'review',
    },
    {
      label: 'Academic Setup',
      description: hasAcademicYear ? `Active year: ${getSettingValue('active_academic_year_label') ?? ''}` : 'Set up academic years, classes, and sections',
      sectionId: 'school-setup',
      status: hasAcademicYear ? 'ok' : 'review',
    },
    {
      label: 'Academic Defaults',
      description: 'Grading scheme, calendar, promotion mode',
      sectionId: 'academic',
      status: hasAcademicYear ? 'ok' : 'review',
    },
    {
      label: 'Active Fee Plans',
      description: activeFeePlanCount > 0 ? `${activeFeePlanCount} active fee plan(s) configured` : 'No active fee plans configured',
      sectionId: 'fee-setup',
      status: activeFeePlanCount > 0 ? 'ok' : 'review',
    },
    {
      label: 'Fee & Payment Rules',
      description: 'Receipt numbering, late fees, approval flow',
      sectionId: 'fees',
      status: getSettingValue('receipt_number_prefix') ? 'ok' : 'review',
    },
    {
      label: 'Users & Access',
      description: 'User management — coming soon',
      sectionId: 'users-access',
      status: 'pending',
    },
    {
      label: 'Roles & Permissions',
      description: 'Role catalog reviewed',
      sectionId: 'roles-permissions',
      status: 'review',
    },
    {
      label: 'Security & Privacy',
      description: 'Session timeout, data masking',
      sectionId: 'security',
      status: getSettingValue('session_timeout_minutes') ? 'ok' : 'review',
    },
    {
      label: 'Subscription',
      description: 'Plan and module entitlements',
      sectionId: 'subscription',
      status: 'ok',
    },
  ];

  const okCount = readinessItems.filter((i) => i.status === 'ok').length;

  return (
    <div className="space-y-5">
      {/* Readiness bar */}
      <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
        <div className="flex-1">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-700">Setup readiness</p>
            <p className="text-xs font-semibold text-slate-500">{okCount} / {readinessItems.length} ready</p>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.round((okCount / readinessItems.length) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Readiness grid */}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {readinessItems.map((item) => (
          <button
            key={item.sectionId}
            type="button"
            onClick={() => onSwitchSection(item.sectionId)}
            className="group flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3.5 text-left transition hover:border-slate-300 hover:shadow-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {item.status === 'ok' && <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />}
                {item.status === 'review' && <AlertCircle size={13} className="shrink-0 text-amber-500" />}
                {item.status === 'pending' && <Clock size={13} className="shrink-0 text-slate-400" />}
                <p className="truncate text-sm font-semibold text-slate-800">{item.label}</p>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
            </div>
            <ChevronRight size={14} className="mt-0.5 shrink-0 text-slate-300 group-hover:text-slate-500 transition" />
          </button>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Quick Access</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'School Profile', id: 'profile' },
            { label: 'School Setup', id: 'school-setup' },
            { label: 'Branding', id: 'branding' },
            { label: 'Users & Access', id: 'users-access' },
            { label: 'Roles', id: 'roles-permissions' },
            { label: 'Subscription', id: 'subscription' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSwitchSection(item.id)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              {item.label}
              <ArrowRight size={11} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── School Setup Panel ───────────────────────────────────────────────────────

function SchoolSetupPanel() {
  return (
    <div className="space-y-4">
      {/* Readiness notice */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
        <BookOpen size={15} className="mt-0.5 shrink-0 text-blue-600" />
        <p className="text-sm leading-6 text-blue-700">
          <span className="font-semibold">Complete this before other workflows.</span>{' '}
          Academic years, classes, and sections must be configured before admissions, attendance,
          exams, fees, and timetable workflows can begin.
        </p>
      </div>
      {/* Render the existing SetupForm — it manages its own data fetching and mutations */}
      <SetupForm />
    </div>
  );
}

// ─── Fee Setup Panel ──────────────────────────────────────────────────────────

function FeeSetupPanel({ onPlanCreated }: { onPlanCreated: () => void }) {
  const queryClient = useQueryClient();

  const [feeHead, setFeeHead] = useState({
    code: '',
    name: '',
    frequency: 'MONTHLY',
    defaultAmount: 0,
    vatApplicable: false,
  });

  const [feePlan, setFeePlan] = useState({
    academicYearId: '',
    classId: '',
    feeHeadId: '',
    code: '',
    name: '',
    amount: 0,
  });

  const [headSuccess, setHeadSuccess] = useState(false);
  const [planSuccess, setPlanSuccess] = useState(false);

  const academicYearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: api.listAcademicYears,
  });

  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: api.listClasses,
  });

  const feeHeadsQuery = useQuery({
    queryKey: ['fee-heads'],
    queryFn: api.listFeeHeads,
  });

  const feePlansQuery = useQuery({
    queryKey: ['fee-plans'],
    queryFn: api.listFeePlans,
  });

  useEffect(() => {
    if (academicYearsQuery.data && !feePlan.academicYearId) {
      const currentYear = academicYearsQuery.data.find(y => y.isCurrent) ?? academicYearsQuery.data[0];
      if (currentYear) {
        setFeePlan((prev) => ({ ...prev, academicYearId: currentYear.id }));
      }
    }
  }, [academicYearsQuery.data]);

  const feeHeadMutation = useMutation({
    mutationFn: api.createFeeHead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-heads'] });
      setFeeHead({
        code: '',
        name: '',
        frequency: 'MONTHLY',
        defaultAmount: 0,
        vatApplicable: false,
      });
      setHeadSuccess(true);
      setTimeout(() => setHeadSuccess(false), 3000);
    },
  });

  const feePlanMutation = useMutation({
    mutationFn: api.createFeePlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-plans'] });
      setFeePlan((prev) => ({
        ...prev,
        classId: '',
        feeHeadId: '',
        code: '',
        name: '',
        amount: 0,
      }));
      setPlanSuccess(true);
      onPlanCreated();
      setTimeout(() => setPlanSuccess(false), 3000);
    },
  });

  const handleCreateFeeHead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feeHead.code || !feeHead.name) return;
    feeHeadMutation.mutate(feeHead);
  };

  const handleCreateFeePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feePlan.academicYearId || !feePlan.feeHeadId || !feePlan.code || !feePlan.name) return;
    feePlanMutation.mutate({
      academicYearId: feePlan.academicYearId,
      classId: feePlan.classId || null,
      code: feePlan.code,
      name: feePlan.name,
      items: [{ feeHeadId: feePlan.feeHeadId, amount: feePlan.amount }],
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NP', {
      style: 'currency',
      currency: 'NPR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {/* Forms Column */}
      <div className="space-y-6">
        {/* Create Fee Head Form */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Create Fee Head</h3>
            <p className="mt-0.5 text-xs text-slate-500">Define reusable heads of account like Tuition, Exam, or Transportation.</p>
          </div>

          <form onSubmit={handleCreateFeeHead} className="space-y-4">
            {headSuccess && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                <Check size={14} />
                Fee head created successfully!
              </div>
            )}
            {feeHeadMutation.isError && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                <AlertCircle size={14} />
                {feeHeadMutation.error.message || 'Failed to create fee head.'}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Code</label>
                <input
                  type="text"
                  placeholder="e.g. TUITION"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-slate-50"
                  value={feeHead.code}
                  onChange={(e) => setFeeHead((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  required
                  disabled={feeHeadMutation.isPending}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Name</label>
                <input
                  type="text"
                  placeholder="e.g. Tuition Fee"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-slate-50"
                  value={feeHead.name}
                  onChange={(e) => setFeeHead((prev) => ({ ...prev, name: e.target.value }))}
                  required
                  disabled={feeHeadMutation.isPending}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Frequency</label>
                <select
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none bg-white disabled:bg-slate-50"
                  value={feeHead.frequency}
                  onChange={(e) => setFeeHead((prev) => ({ ...prev, frequency: e.target.value }))}
                  disabled={feeHeadMutation.isPending}
                >
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="YEARLY">Yearly</option>
                  <option value="ONE_TIME">One Time</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Default Amount</label>
                <input
                  type="number"
                  placeholder="0"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-slate-50"
                  value={feeHead.defaultAmount || ''}
                  onChange={(e) => setFeeHead((prev) => ({ ...prev, defaultAmount: Number(e.target.value) }))}
                  disabled={feeHeadMutation.isPending}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 py-1">
              <input
                type="checkbox"
                id="vatApplicable"
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                checked={feeHead.vatApplicable}
                onChange={(e) => setFeeHead((prev) => ({ ...prev, vatApplicable: e.target.checked }))}
                disabled={feeHeadMutation.isPending}
              />
              <label htmlFor="vatApplicable" className="text-xs font-medium text-slate-700 select-none">
                VAT / Taxes Applicable
              </label>
            </div>

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
              disabled={feeHeadMutation.isPending}
            >
              {feeHeadMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Create Fee Head
                </>
              )}
            </button>
          </form>
        </div>

        {/* Create Fee Plan Form */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Create Fee Plan</h3>
            <p className="mt-0.5 text-xs text-slate-500">Map fee heads to specific academic years and classes with custom rates.</p>
          </div>

          <form onSubmit={handleCreateFeePlan} className="space-y-4">
            {planSuccess && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                <Check size={14} />
                Fee plan created successfully!
              </div>
            )}
            {feePlanMutation.isError && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                <AlertCircle size={14} />
                {feePlanMutation.error.message || 'Failed to create fee plan.'}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Academic Year</label>
                <select
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none bg-white disabled:bg-slate-50"
                  value={feePlan.academicYearId}
                  onChange={(e) => setFeePlan((prev) => ({ ...prev, academicYearId: e.target.value }))}
                  required
                  disabled={feePlanMutation.isPending}
                >
                  <option value="">Select Academic Year</option>
                  {academicYearsQuery.data?.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name} {y.isCurrent ? '(Current)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Class (Optional)</label>
                <select
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none bg-white disabled:bg-slate-50"
                  value={feePlan.classId}
                  onChange={(e) => setFeePlan((prev) => ({ ...prev, classId: e.target.value }))}
                  disabled={feePlanMutation.isPending}
                >
                  <option value="">All Classes</option>
                  {classesQuery.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fee Head</label>
                <select
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none bg-white disabled:bg-slate-50"
                  value={feePlan.feeHeadId}
                  onChange={(e) => {
                    const headId = e.target.value;
                    const selectedHead = feeHeadsQuery.data?.find(h => h.id === headId);
                    setFeePlan((prev) => ({
                      ...prev,
                      feeHeadId: headId,
                      amount: selectedHead?.defaultAmount ?? 0,
                    }));
                  }}
                  required
                  disabled={feePlanMutation.isPending}
                >
                  <option value="">Select Fee Head</option>
                  {feeHeadsQuery.data?.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.code} · {h.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Plan Code</label>
                <input
                  type="text"
                  placeholder="e.g. PLAN-TUITION-GR1"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-slate-50"
                  value={feePlan.code}
                  onChange={(e) => setFeePlan((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  required
                  disabled={feePlanMutation.isPending}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Plan Name</label>
                <input
                  type="text"
                  placeholder="e.g. Grade 1 Monthly Tuition Plan"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-slate-50"
                  value={feePlan.name}
                  onChange={(e) => setFeePlan((prev) => ({ ...prev, name: e.target.value }))}
                  required
                  disabled={feePlanMutation.isPending}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Amount</label>
                <input
                  type="number"
                  placeholder="0"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-slate-50"
                  value={feePlan.amount || ''}
                  onChange={(e) => setFeePlan((prev) => ({ ...prev, amount: Number(e.target.value) }))}
                  required
                  disabled={feePlanMutation.isPending}
                />
              </div>
            </div>

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
              disabled={feePlanMutation.isPending}
            >
              {feePlanMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Create Fee Plan
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Lists Column */}
      <div className="space-y-6">
        {/* Fee Heads List */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">Active Fee Heads</h3>
          {feeHeadsQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : !feeHeadsQuery.data?.length ? (
            <div className="py-6 text-center text-slate-400 text-xs font-medium">
              No fee heads configured. Use the form to add one.
            </div>
          ) : (
            <div className="overflow-hidden border border-slate-200 rounded-lg bg-slate-50">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Frequency</th>
                    <th className="px-3 py-2 text-right">Default Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 bg-white">
                  {feeHeadsQuery.data.map((head: any) => (
                    <tr key={head.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2 font-semibold text-slate-700">{head.code}</td>
                      <td className="px-3 py-2 text-slate-900">{head.name}</td>
                      <td className="px-3 py-2">
                        <Badge variant="neutral" className="uppercase tracking-wider text-[8px] font-black px-1.5 py-0.5">
                          {head.frequency}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-slate-700">
                        {formatCurrency(head.defaultAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Fee Plans List */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">Active Fee Plans</h3>
          {feePlansQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : !feePlansQuery.data?.length ? (
            <div className="py-6 text-center text-slate-400 text-xs font-medium">
              No fee plans created yet. Setup a plan above.
            </div>
          ) : (
            <div className="overflow-hidden border border-slate-200 rounded-lg bg-slate-50">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="px-3 py-2">Plan Details</th>
                    <th className="px-3 py-2">Applicability</th>
                    <th className="px-3 py-2 text-right">Plan Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 bg-white">
                  {feePlansQuery.data.map((plan: any) => (
                    <tr key={plan.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-700">{plan.code}</span>
                          <span className="text-[10px] text-slate-400">{plan.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1 items-center">
                          <Badge variant="phase2" className="text-[8px] font-black px-1 py-0">
                            {plan.academicYear?.name || 'Current Year'}
                          </Badge>
                          {plan.class && (
                            <Badge className="bg-indigo-50 text-indigo-700 border-indigo-100 text-[8px] font-black px-1 py-0">
                              Class {plan.class.name}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-slate-700">
                        {formatCurrency(plan.amount ?? plan.items?.[0]?.amount ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Users & Access Panel ─────────────────────────────────────────────────────

function UsersAccessPanel() {
  const userCategories = [
    {
      title: 'Admin & Staff',
      description: 'School administrators, teachers, subject teachers, support staff, and accountants.',
      icon: UserCog,
      accent: 'bg-blue-50 text-blue-700 border-blue-100',
      count: null,
    },
    {
      title: 'Parent Accounts',
      description: 'Parents and guardians with access to student records, notices, and messaging.',
      icon: Users,
      accent: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      count: null,
    },
    {
      title: 'Student Accounts',
      description: 'Students with portal access for timetable, homework, activity, and notices.',
      icon: BookOpen,
      accent: 'bg-violet-50 text-violet-700 border-violet-100',
      count: null,
    },
    {
      title: 'Pending Invitations',
      description: 'Invitations sent and awaiting user acceptance.',
      icon: Key,
      accent: 'bg-amber-50 text-amber-700 border-amber-100',
      count: null,
    },
    {
      title: 'Disabled Accounts',
      description: 'Suspended or deactivated user accounts. Records preserved.',
      icon: Lock,
      accent: 'bg-rose-50 text-rose-700 border-rose-100',
      count: null,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Status notice */}
      <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <Lock size={15} className="mt-0.5 shrink-0 text-slate-500" />
        <div>
          <p className="text-sm font-semibold text-slate-700">User management backend pending</p>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">
            User invitation, password reset, and account management actions will be available once the Users API routes are deployed.
            All role assignments and permission scoping are already defined in the role catalog.
          </p>
        </div>
      </div>

      {/* Action buttons (disabled — pending backend) */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Invite User', icon: Users },
          { label: 'Manage Parent Access', icon: Key },
          { label: 'Reset Password', icon: Lock },
          { label: 'Disable Account', icon: Shield },
        ].map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            disabled
            title="Backend route pending"
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-400 opacity-60"
          >
            <Icon size={14} />
            {label}
            <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Pending
            </span>
          </button>
        ))}
      </div>

      {/* User category cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {userCategories.map((cat) => {
          const Icon = cat.icon;
          return (
            <div key={cat.title} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-start gap-3">
                <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', cat.accent)}>
                  <Icon size={15} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{cat.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">{cat.description}</p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-xs text-slate-400">Count unavailable</span>
                <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  API pending
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* MFA / security readiness */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Security Readiness</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { label: 'MFA enforcement status', value: 'Not configured' },
            { label: 'Last login review', value: 'API pending' },
            { label: 'Session timeout', value: 'Configured in Security & Privacy' },
            { label: 'Sensitive field masking', value: 'Configured in Security & Privacy' },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
              <span className="text-xs font-medium text-slate-600">{item.label}</span>
              <span className="text-xs text-slate-400">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Roles & Permissions Panel ────────────────────────────────────────────────

// Build a role category map from systemRoleDefinitions
const PLATFORM_ROLE_NAMES = new Set(['platform_super_admin', 'platform_support', 'platform_billing_admin']);

const ROLE_MODULE_MAP: Record<string, string[]> = {
  admin: ['Full tenant access'],
  principal: ['Full tenant access'],
  teacher: ['Academics', 'Attendance', 'Homework', 'Messaging', 'HR leave'],
  subject_teacher: ['Academics', 'Homework', 'Messaging', 'Timetable'],
  support_staff: ['Students (read)', 'Staff (read)', 'Notices'],
  student: ['Timetable', 'Homework', 'Notices', 'Activity'],
  parent: ['Students (read)', 'Messaging', 'Transport tracking'],
  accountant: ['Fees', 'Payments', 'Accounting', 'Payroll', 'Reports'],
  librarian: ['Library', 'Fees (manage)', 'Classes (read)'],
  driver: ['Transport', 'Students (read)'],
  platform_super_admin: ['All permissions'],
  platform_support: ['Platform read', 'Tenant support'],
  platform_billing_admin: ['Billing', 'Subscriptions', 'Plans'],
};

function RolesPermissionsPanel() {
  const [expandedRole, setExpandedRole] = useState<string | null>(null);

  const tenantRoles = systemRoleDefinitions.filter((r) => !PLATFORM_ROLE_NAMES.has(r.name));
  const platformRoles = systemRoleDefinitions.filter((r) => PLATFORM_ROLE_NAMES.has(r.name));

  function getPermissionCount(roleName: string): number {
    const perms = systemRolePermissions[roleName];
    return Array.isArray(perms) ? perms.length : 0;
  }

  return (
    <div className="space-y-5">
      {/* Notice */}
      <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <Key size={15} className="mt-0.5 shrink-0 text-slate-500" />
        <div>
          <p className="text-sm font-semibold text-slate-700">Read-only permissions overview</p>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">
            All roles are preset by SchoolOS. Custom role creation and permission editing will be available once the Roles API routes are deployed.
            Role assignments are managed through the HR Staff module.
          </p>
        </div>
      </div>

      {/* Action buttons (disabled) */}
      <div className="flex flex-wrap gap-2">
        {['Create Custom Role', 'Edit Permissions', 'Preview Access'].map((label) => (
          <button
            key={label}
            type="button"
            disabled
            title="Backend route pending"
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-400 opacity-60"
          >
            {label}
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Pending
            </span>
          </button>
        ))}
      </div>

      {/* Tenant roles */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          School Roles ({tenantRoles.length})
        </p>
        <div className="space-y-1.5">
          {tenantRoles.map((role) => {
            const permCount = getPermissionCount(role.name);
            const modules = ROLE_MODULE_MAP[role.name] ?? [];
            const isExpanded = expandedRole === role.name;
            const perms = systemRolePermissions[role.name] ?? [];

            return (
              <div key={role.name} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => setExpandedRole(isExpanded ? null : role.name)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                    <Key size={13} className="text-slate-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold capitalize text-slate-800">
                        {role.name.replace(/_/g, ' ')}
                      </p>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                        {role.name}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{role.description}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-right">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{permCount}</p>
                      <p className="text-[10px] text-slate-400">perms</p>
                    </div>
                    <ChevronRight
                      size={14}
                      className={cn('text-slate-400 transition-transform', isExpanded && 'rotate-90')}
                    />
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 px-4 py-3">
                    {/* Module coverage */}
                    {modules.length > 0 && (
                      <div className="mb-3">
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Module Coverage</p>
                        <div className="flex flex-wrap gap-1.5">
                          {modules.map((mod) => (
                            <span key={mod} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                              <Check size={10} />
                              {mod}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Permission list (first 20) */}
                    <div>
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Permissions ({permCount}){permCount > 20 ? ' — showing first 20' : ''}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {perms.slice(0, 20).map((perm) => (
                          <span key={perm} className="rounded bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 ring-1 ring-slate-100">
                            {perm}
                          </span>
                        ))}
                        {permCount > 20 && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                            +{permCount - 20} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Platform roles */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Platform Roles ({platformRoles.length})
        </p>
        <div className="space-y-1.5">
          {platformRoles.map((role) => {
            const permCount = getPermissionCount(role.name);
            const modules = ROLE_MODULE_MAP[role.name] ?? [];

            return (
              <div key={role.name} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-purple-100 bg-purple-50">
                  <Shield size={13} className="text-purple-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800">{role.name.replace(/_/g, ' ')}</p>
                    <span className="rounded bg-purple-50 px-1.5 py-0.5 font-mono text-[10px] text-purple-600">
                      {role.name}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{role.description}</p>
                  {modules.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {modules.map((mod) => (
                        <span key={mod} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                          {mod}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-slate-900">{permCount}</p>
                  <p className="text-[10px] text-slate-400">perms</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Data Operations ──────────────────────────────────────────────────────────

function DataOperations() {
  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-500">
        Use the shortcuts below to navigate to the relevant module for bulk imports, exports, and integrations.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <DataOpColumn
          title="Imports"
          icon={Upload}
          accent="bg-teal-50 text-teal-600 border-teal-100"
          items={[
            { title: 'Student Import', description: 'Import students from CSV or iEMIS-ready source files.', href: '/dashboard/admissions', status: 'available' },
            { title: 'Staff Import', description: 'Bulk upload staff records.', href: '/dashboard/hr/staff', status: 'available' },
            { title: 'Fee Ledger Import', description: 'Import historic fee data before migration close.', href: '/dashboard/fees', status: 'available' },
          ]}
        />
        <DataOpColumn
          title="Exports"
          icon={Download}
          accent="bg-blue-50 text-blue-600 border-blue-100"
          items={[
            { title: 'iEMIS Export', description: 'Prepare government-ready student data files.', href: '/dashboard/students', status: 'available' },
            { title: 'Accounting Audit', description: 'Download journal trail and accounting reports.', href: '/dashboard/accounting', status: 'available' },
            { title: 'Class Roster', description: 'Export student lists by class and section.', href: '/dashboard/students', status: 'available' },
            { title: 'Payroll Register', description: 'Export approved payroll summaries.', href: '/dashboard/payroll/reports', status: 'available' },
          ]}
        />
        <DataOpColumn
          title="Integrations"
          icon={ExternalLink}
          accent="bg-purple-50 text-purple-600 border-purple-100"
          items={[
            { title: 'Tenant API Access', description: 'API key management for tenant integrations.', status: 'pending' },
            { title: 'Webhooks', description: 'Configure event webhooks for external systems.', status: 'pending' },
          ]}
        />
      </div>
    </div>
  );
}

function DataOpColumn({
  title,
  icon: Icon,
  accent,
  items,
}: {
  title: string;
  icon: LucideIcon;
  accent: string;
  items: Array<{ title: string; description: string; href?: string; status: 'available' | 'pending' }>;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className={cn('flex h-6 w-6 items-center justify-center rounded-md border', accent)}>
          <Icon size={13} />
        </span>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      <div className="space-y-2">
        {items.map((item) =>
          item.status === 'available' && item.href ? (
            <Link
              key={item.title}
              href={item.href}
              className="group flex items-start justify-between rounded-lg border border-slate-200 bg-white p-3 transition hover:border-slate-300 hover:shadow-sm"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{item.title}</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">{item.description}</p>
              </div>
              <ExternalLink size={12} className="ml-2 mt-0.5 shrink-0 text-slate-300 transition group-hover:text-slate-500" />
            </Link>
          ) : (
            <div key={item.title} className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-500">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-400">{item.description}</p>
                </div>
                <Lock size={12} className="ml-2 mt-0.5 shrink-0 text-slate-300" />
              </div>
              <span className="mt-2 inline-flex items-center rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Coming soon
              </span>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

// ─── Audit Panel ──────────────────────────────────────────────────────────────

function AuditPanel() {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4 rounded-xl border border-orange-100 bg-orange-50 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-orange-200 bg-white text-orange-500">
          <Shield size={18} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Audit Trail Active</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Sensitive admin actions (user creation, setting changes, fee waivers, payroll approvals) are being recorded in real time. Detailed log browsing and filtering will be available in an upcoming dedicated audit release.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Log Filters (Coming Soon)</p>
        <div className="flex flex-wrap gap-2 opacity-40">
          {['Date range', 'Actor', 'Action type', 'Resource', 'Severity'].map((f) => (
            <div key={f} className="h-8 w-24 animate-pulse rounded-lg bg-slate-200" />
          ))}
        </div>
        <div className="mt-4 space-y-2 opacity-40">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 w-4 rounded-full bg-slate-200" />
              <div className="h-3 flex-1 rounded-full bg-slate-200" />
              <div className="h-3 w-20 rounded-full bg-slate-200" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-400 opacity-60"
        >
          <Download size={14} />
          Request Audit Archive
        </button>
        <p className="text-xs text-slate-400">Audit export will be available after the audit module release.</p>
      </div>
    </div>
  );
}

// ─── Subscription Panel ───────────────────────────────────────────────────────

function SubscriptionPanel() {
  const { entitlements, loading, error } = useEntitlements();

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !entitlements) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-700">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle size={18} />
          Error loading subscription details
        </div>
        <p className="mt-1 text-sm text-rose-600">Please refresh the page or try again later.</p>
      </div>
    );
  }

  const moduleFriendlyNames: Record<string, string> = {
    students: 'M1 Admissions & Student Profiles',
    attendance: 'M2 Smart Attendance',
    fees: 'M3 Fees & Receipts',
    exams: 'M4 Exams, CAS & Report Cards',
    activity: 'M5 Activity Feed & Milestones',
    homework: 'M6 Homework & Timetable',
    hr: 'M7 HR & Payroll',
    library: 'M8A Library Management',
    transport: 'M8B Transport Management',
    canteen: 'M8C Canteen Management',
    accounting: 'M9 Accounting & Finance',
    notices: 'M10 Notices & Communication',
  };

  const activeModules = (entitlements.modules ?? []).filter(
    (module) => module !== 'm0' && module !== 'platform' && !module.includes('m0') && !module.includes('platform'),
  );
  const tier = entitlements.tier?.toUpperCase() || 'STARTER';

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Current Plan</p>
          <div className="mt-1.5 flex items-center gap-2">
            <h3 className="text-xl font-bold text-slate-900">{tier}</h3>
            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              Active
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Your school has access to the {tier.toLowerCase()} tier features and included modules.
          </p>
        </div>
        <a
          href="mailto:support@schoolos.io?subject=SchoolOS Plan Upgrade Request"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Upgrade Plan
          <ArrowUpRight size={14} />
        </a>
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Included Modules ({activeModules.length})
        </p>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {activeModules.map((module) => (
            <div key={module} className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
              <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
              <span className="text-xs font-medium text-slate-700">{moduleFriendlyNames[module] || module}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Loading State ────────────────────────────────────────────────────────────

function SettingsLoading() {
  return (
    <div className="flex h-60 items-center justify-center">
      <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-500 shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        Loading school settings…
      </div>
    </div>
  );
}

