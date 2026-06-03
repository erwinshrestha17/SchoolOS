'use client';

import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  ArrowUpRight,
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
  Loader2,
  Lock,
  MessageSquare,
  Palette,
  Save,
  School,
  Search,
  Settings,
  Shield,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';

import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { Checkbox } from '../../../components/ui/checkbox';
import { ConfirmDialog } from '../../../components/ui/confirm-dialog';
import { FormField } from '../../../components/ui/form-field';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { useEntitlements } from '../../../components/entitlements-provider';
import { api, type TenantLogoAccess } from '../../../lib/api';
import { cn } from '../../../lib/utils';
import type { TenantSettingKey, TenantSettingSummary } from '@schoolos/core';

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

const TENANT_LOGO_MAX_BYTES = 1024 * 1024;
const TENANT_LOGO_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const workingDayOptions: FieldOption[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
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
    title: 'Branding & Regional Defaults',
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
      href: '/dashboard/setup',
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
    title: 'Fee Setup',
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
    id: 'payroll',
    eyebrow: 'Staff controls',
    title: 'HR & Payroll Rules',
    description: 'Configure leave approval, salary calculation defaults, PF/TDS readiness, and payroll approvals.',
    icon: Users,
    tone: 'bg-sky-50 text-sky-700 border-sky-100',
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
    id: 'security',
    eyebrow: 'Governance',
    title: 'Security & Access',
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

const UTILITY_SECTIONS = [
  {
    id: 'data',
    eyebrow: 'Data operations',
    title: 'Import / Export',
    description: 'Shortcuts for bulk data movement, official readiness, and migration workflows.',
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
] satisfies Array<Omit<SettingSectionConfig, 'fields'> & { fields?: never }>;

const ALL_SECTIONS = [...SETTINGS_SECTIONS, ...UTILITY_SECTIONS];

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

export default function TenantSettingsPage() {
  return (
    <Suspense fallback={<SettingsLoading />}> 
      <TenantSettingsContent />
    </Suspense>
  );
}

function TenantSettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSection = searchParams.get('section') || searchParams.get('tab') || 'profile';

  const [settings, setSettings] = useState<TenantSettingSummary[]>([]);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [query, setQuery] = useState('');

  const sectionIds = ALL_SECTIONS.map((section) => section.id);
  const activeSectionId = sectionIds.includes(requestedSection) ? requestedSection : 'profile';
  const activeSection = ALL_SECTIONS.find((section) => section.id === activeSectionId) ?? ALL_SECTIONS[0];
  const activeEditableSection = SETTINGS_SECTIONS.find((section) => section.id === activeSectionId);

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

  useEffect(() => {
    void fetchSettings();
  }, []);

  useEffect(() => {
    setForm(initialForm);
  }, [initialForm]);

  async function fetchSettings() {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getTenantSettings();
      setSettings(data);
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

      setNotice({ type: 'success', text: `${activeEditableSection.title} updated successfully.` });
      await fetchSettings();
    } catch {
      setNotice({ type: 'error', text: 'Failed to save this settings group.' });
    } finally {
      setSaving(false);
    }
  }

  const filteredSections = ALL_SECTIONS.filter((section) => {
    const needle = `${section.title} ${section.description} ${section.eyebrow}`.toLowerCase();
    return needle.includes(query.toLowerCase());
  });

  if (loading) return <SettingsLoading />;

  if (error) {
    return (
      <div className="p-6 md:p-8">
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
          <div className="flex items-center gap-2 font-bold">
            <AlertCircle size={20} />
            <span>Settings unavailable</span>
          </div>
          <p className="mt-2 text-sm">{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => void fetchSettings()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 pb-12">
      <SettingsHero changedCount={changedKeys.length} settingsCount={settings.length} />

      <div className="grid gap-6 px-6 md:px-8 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search settings"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-medium outline-none transition focus:border-primary-300 focus:bg-white focus:ring-4 focus:ring-primary-500/10"
              />
            </label>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-2 shadow-sm">
            {filteredSections.map((section) => {
              const Icon = section.icon;
              const isActive = section.id === activeSectionId;
              const editableSection = SETTINGS_SECTIONS.find((item) => item.id === section.id);
              const dirtyCount = editableSection
                ? editableSection.fields.filter((field) => changedKeys.includes(field.key)).length
                : 0;

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => switchSection(section.id)}
                  className={cn(
                    'group flex w-full items-start gap-3 rounded-[1.5rem] p-4 text-left transition-all',
                    isActive ? 'bg-slate-950 text-white shadow-lg shadow-slate-900/10' : 'hover:bg-slate-50',
                  )}
                >
                  <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border', isActive ? 'border-white/10 bg-white/10 text-white' : section.tone)}>
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm font-black tracking-tight', isActive ? 'text-white' : 'text-slate-900')}>
                      {section.title}
                    </span>
                    <span className={cn('mt-1 line-clamp-2 block text-xs leading-5', isActive ? 'text-slate-300' : 'text-slate-500')}>
                      {section.description}
                    </span>
                  </span>
                  {dirtyCount > 0 ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">
                      {dirtyCount}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </aside>

        <main className="min-w-0 space-y-6">
          <SectionHeader
            section={activeSection}
            changedCount={sectionChangedCount}
            saving={saving}
            onSave={() => void saveActiveSection()}
            canSave={Boolean(activeEditableSection && sectionChangedCount > 0)}
          />

          {notice ? <SettingsNotice notice={notice} /> : null}

          {activeEditableSection ? (
            <EditableSettingsSection
              section={activeEditableSection}
              form={form}
              logoFileAssetId={logoFileAssetId}
              onFieldChange={setFieldValue}
              onLogoChanged={() => void fetchSettings()}
            />
          ) : null}

          {activeSectionId === 'data' ? <DataOperations /> : null}
          {activeSectionId === 'audit' ? <AuditPanel /> : null}
          {activeSectionId === 'subscription' ? <SubscriptionPanel /> : null}
        </main>
      </div>
    </div>
  );
}

function SettingsHero({ changedCount, settingsCount }: { changedCount: number; settingsCount: number }) {
  return (
    <section className="relative mb-6 overflow-hidden border-b border-slate-200 bg-slate-950 px-6 py-8 text-white md:px-8 md:py-10">
      <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-primary-500/20 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-52 w-52 rounded-full bg-blue-400/10 blur-3xl" />

      <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
            <Settings size={14} /> Tenant Configuration Plane
          </div>
          <h1 className="text-3xl font-black tracking-tight sm:text-5xl">School Settings</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Configure school identity, document branding, operational rules, communication defaults, and governance controls from one structured settings console.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
          <HeroMetric label="Settings loaded" value={String(settingsCount)} />
          <HeroMetric label="Pending changes" value={String(changedCount)} tone={changedCount > 0 ? 'warning' : 'success'} />
          <HeroMetric label="Configuration" value="Tenant-scoped" />
        </div>
      </div>
    </section>
  );
}

function HeroMetric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'success' | 'warning' }) {
  const toneClass = {
    neutral: 'bg-white/5 text-white ring-white/10',
    success: 'bg-emerald-400/10 text-emerald-100 ring-emerald-300/20',
    warning: 'bg-amber-400/10 text-amber-100 ring-amber-300/20',
  }[tone];

  return (
    <div className={cn('rounded-3xl p-4 ring-1 backdrop-blur', toneClass)}>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">{label}</p>
      <p className="mt-2 text-xl font-black tracking-tight">{value}</p>
    </div>
  );
}

function SectionHeader({
  section,
  changedCount,
  saving,
  canSave,
  onSave,
}: {
  section: (typeof ALL_SECTIONS)[number];
  changedCount: number;
  saving: boolean;
  canSave: boolean;
  onSave: () => void;
}) {
  const Icon = section.icon;

  return (
    <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-4">
          <span className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl border', section.tone)}>
            <Icon size={24} />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{section.eyebrow}</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">{section.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{section.description}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {changedCount > 0 ? (
            <Badge className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
              {changedCount} unsaved
            </Badge>
          ) : (
            <Badge className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
              Saved
            </Badge>
          )}
          <Button onClick={onSave} disabled={!canSave || saving} className="gap-2 rounded-2xl px-5">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Saving...' : 'Save section'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SettingsNotice({ notice }: { notice: { type: 'success' | 'error'; text: string } }) {
  const isSuccess = notice.type === 'success';
  return (
    <div className={cn('flex items-center gap-3 rounded-3xl border p-4 text-sm font-semibold', isSuccess ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700')}>
      {isSuccess ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
      {notice.text}
    </div>
  );
}

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
  return (
    <div className="space-y-6">
      {section.id === 'branding' ? <LogoPanel logoFileAssetId={logoFileAssetId} onLogoChanged={onLogoChanged} /> : null}

      {section.featureLink ? (
        <Link
          href={section.featureLink.href}
          className="group flex items-center justify-between rounded-[2rem] border border-primary-100 bg-primary-50/50 p-5 transition hover:border-primary-200 hover:bg-primary-50"
        >
          <div>
            <p className="text-sm font-black text-primary-900">{section.featureLink.label}</p>
            <p className="mt-1 text-xs font-medium text-primary-600">{section.featureLink.description}</p>
          </div>
          <ExternalLink className="text-primary-500 transition group-hover:translate-x-0.5" size={18} />
        </Link>
      ) : null}

      <Card className="overflow-hidden rounded-[2.5rem] border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-5">
            <p className="text-sm font-black text-slate-950">{section.title} controls</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Related fields are grouped in one section so changes can be reviewed and saved together.</p>
          </div>

          <div className="grid gap-5 p-6 md:grid-cols-2 xl:grid-cols-3">
            {section.fields.map((field) => (
              <SettingField key={field.key} field={field} value={form[field.key]} onChange={(value) => onFieldChange(field.key, value)} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingField({ field, value, onChange }: { field: SettingFieldConfig; value: unknown; onChange: (value: unknown) => void }) {
  if (field.type === 'checkbox') {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:col-span-1">
        <Checkbox label={field.label} checked={Boolean(value)} onChange={(checked) => onChange(checked)} />
        {field.description ? <p className="mt-2 text-xs leading-5 text-slate-500">{field.description}</p> : null}
      </div>
    );
  }

  if (field.type === 'multi-check') {
    const selected = Array.isArray(value) ? value.map(String) : [];
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:col-span-2 xl:col-span-3">
        <div className="mb-3">
          <p className="text-sm font-bold text-slate-800">{field.label}</p>
          {field.description ? <p className="mt-1 text-xs leading-5 text-slate-500">{field.description}</p> : null}
        </div>
        <div className="flex flex-wrap gap-3">
          {(field.options ?? []).map((option) => (
            <Checkbox
              key={option.value}
              label={option.label}
              checked={selected.includes(option.value)}
              onChange={(checked) => {
                const next = checked ? [...selected, option.value] : selected.filter((item) => item !== option.value);
                onChange(next);
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <FormField label={field.label} description={field.description}>
        <Select value={String(value ?? field.defaultValue ?? '')} onChange={(event) => onChange(event.target.value)}>
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </FormField>
    );
  }

  if (field.type === 'color') {
    return (
      <FormField label={field.label} description={field.description}>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
          <input
            type="color"
            value={String(value || field.defaultValue || '#6366f1')}
            onChange={(event) => onChange(event.target.value)}
            className="h-10 w-16 cursor-pointer rounded-xl border border-slate-200 bg-white p-1"
          />
          <span className="font-mono text-xs font-bold uppercase text-slate-500">{String(value || field.defaultValue || '#6366f1')}</span>
        </div>
      </FormField>
    );
  }

  return (
    <FormField label={field.label} description={field.description}>
      <Input
        type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : field.type === 'time' ? 'time' : 'text'}
        value={String(value ?? '')}
        placeholder={field.placeholder}
        onChange={(event) => {
          if (field.type === 'number') {
            onChange(event.target.value === '' ? '' : Number(event.target.value));
            return;
          }
          onChange(event.target.value);
        }}
      />
    </FormField>
  );
}

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
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError(null);
    api
      .getSchoolLogoPreview()
      .then((access) => {
        if (active) setPreview(access);
      })
      .catch((err: unknown) => {
        if (active) {
          setPreview(null);
          setError(err instanceof Error ? err.message : 'Failed to load school logo preview.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
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
      <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
              {preview?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.url} alt="School logo preview" className="h-full w-full object-contain p-2" />
              ) : (
                <ImageUp className="h-8 w-8 text-slate-300" />
              )}
            </div>
            <div>
              <p className="text-sm font-black text-slate-950">School Logo</p>
              <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">
                Upload a JPG, PNG, or WEBP logo up to 1MB. The logo is stored privately and served through signed links.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge className={cn('rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest', logoFileAssetId ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500')}>
                  {logoFileAssetId ? 'Configured' : 'Not configured'}
                </Badge>
                <Badge className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Private File Registry
                </Badge>
                {preview ? (
                  <Badge className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {formatFileSize(preview.sizeBytes)}
                  </Badge>
                ) : null}
              </div>
              {preview ? <p className="mt-2 text-xs text-slate-500">{preview.fileName} · Preview expires in {preview.expiresInSeconds}s</p> : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <label className={cn('inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800', busy && 'cursor-not-allowed opacity-50')}>
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploading ? 'Uploading...' : logoFileAssetId ? 'Replace' : 'Upload'}
              <input
                aria-label="Upload school logo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={busy}
                onChange={(event) => {
                  void handleLogoSelection(event.target.files?.[0]);
                  event.currentTarget.value = '';
                }}
              />
            </label>
            {logoFileAssetId ? (
              <>
                <Button type="button" variant="outline" className="gap-2 rounded-2xl" disabled={busy} onClick={() => void openLogoDownload()}>
                  {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  Download
                </Button>
                <Button type="button" variant="outline" className="gap-2 rounded-2xl border-rose-200 text-rose-600 hover:bg-rose-50" disabled={busy} onClick={() => setRemoveOpen(true)}>
                  <Trash2 size={16} /> Remove
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {loading ? <p className="mt-4 flex items-center gap-2 text-xs font-bold text-primary-600"><Loader2 size={14} className="animate-spin" /> Loading signed preview...</p> : null}
        {message ? <p className="mt-4 flex items-center gap-2 text-xs font-bold text-emerald-700"><CheckCircle2 size={14} /> {message}</p> : null}
        {error ? <p className="mt-4 flex items-center gap-2 text-xs font-bold text-rose-600"><AlertCircle size={14} /> {error}</p> : null}
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

function DataOperations() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <UtilityColumn title="Imports" icon={Upload} items={[
        { title: 'Student Import', description: 'Import students from CSV or iEMIS-ready source files.', href: '/dashboard/admissions' },
        { title: 'Staff Import', description: 'Bulk upload staff records.', href: '/dashboard/hr/staff' },
        { title: 'Fee Ledger Import', description: 'Import historic fee data before migration close.', href: '/dashboard/fees' },
      ]} />
      <UtilityColumn title="Exports" icon={Download} items={[
        { title: 'iEMIS Export', description: 'Prepare government-ready student data files.', href: '/dashboard/students' },
        { title: 'Accounting Audit', description: 'Download journal trail and accounting reports.', href: '/dashboard/accounting' },
        { title: 'Class Roster', description: 'Export student lists by class and section.', href: '/dashboard/students' },
        { title: 'Payroll Register', description: 'Export approved payroll summaries.', href: '/dashboard/payroll/reports' },
      ]} />
      <UtilityColumn title="Integrations" icon={ExternalLink} items={[
        { title: 'Tenant API Access', description: 'Tenant API key routes are not available yet.', disabled: true },
        { title: 'Webhooks', description: 'Tenant webhook routes are not available yet.', disabled: true },
      ]} />
    </div>
  );
}

function AuditPanel() {
  return (
    <div className="rounded-[2.5rem] border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-slate-100 bg-slate-50 text-slate-400">
        <Shield size={32} />
      </div>
      <h3 className="mt-5 text-xl font-black text-slate-950">Audit Trail Ready</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Sensitive actions are being recorded. Detailed log viewing and filtering will be available in a dedicated audit release.
      </p>
      <Button variant="outline" className="mt-6 gap-2 rounded-2xl">
        <Download size={16} /> Request Archive
      </Button>
    </div>
  );
}

function UtilityColumn({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: LucideIcon;
  items: Array<{ title: string; description: string; href?: string; disabled?: boolean }>;
}) {
  return (
    <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
          <Icon size={18} />
        </div>
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">{title}</h3>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <UtilityCard key={item.title} {...item} />
        ))}
      </div>
    </div>
  );
}

function UtilityCard({ title, description, href, disabled }: { title: string; description: string; href?: string; disabled?: boolean }) {
  const content = (
    <>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className={cn('text-sm font-bold', disabled ? 'text-slate-500' : 'text-slate-900')}>{title}</p>
        {disabled ? <Lock size={14} className="text-slate-300" /> : <ExternalLink size={14} className="text-slate-300 group-hover:text-primary-500" />}
      </div>
      <p className="text-xs leading-5 text-slate-500">{description}</p>
      {disabled ? <span className="mt-3 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">Backend route pending</span> : null}
    </>
  );

  if (disabled || !href) {
    return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">{content}</div>;
  }

  return (
    <Link href={href} className="group block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-primary-200 hover:shadow-md">
      {content}
    </Link>
  );
}

function SubscriptionPanel() {
  const { entitlements, loading, error } = useEntitlements();

  if (loading) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-[2.5rem] border border-slate-200 bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error || !entitlements) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
        <div className="flex items-center gap-2 font-semibold"><AlertCircle size={20} /> Error loading subscription details</div>
        <p className="mt-1 text-sm">Please refresh the page or try again later.</p>
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

  const activeModules = (entitlements.modules ?? []).filter((module) => module !== 'm0' && module !== 'platform' && !module.includes('m0') && !module.includes('platform'));
  const tier = entitlements.tier?.toUpperCase() || 'STARTER';

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-950 p-8 text-white shadow-lg">
        <div className="absolute right-0 top-0 h-48 w-48 translate-x-12 -translate-y-12 rounded-full bg-white/[0.04] blur-xl" />
        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Current Plan</p>
            <h3 className="mt-1 flex items-center gap-3 text-3xl font-black tracking-tight">
              {tier} Plan
              <Badge className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">Active</Badge>
            </h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">Your school has access to the {tier.toLowerCase()} tier features. Add-ons can be customized by contacting support.</p>
          </div>
          <a href="mailto:support@schoolos.io?subject=SchoolOS Plan Upgrade Request" className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-slate-950 transition hover:bg-slate-100">
            Upgrade Plan <ArrowUpRight size={16} />
          </a>
        </div>
      </div>

      <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">Included Modules</h4>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {activeModules.map((module) => (
            <div key={module} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={16} />
              </div>
              <span className="text-xs font-bold text-slate-800">{moduleFriendlyNames[module] || module}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingsLoading() {
  return (
    <div className="flex h-[520px] items-center justify-center">
      <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-600 shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
        Loading school settings...
      </div>
    </div>
  );
}
