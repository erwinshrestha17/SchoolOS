'use client';

import { useEffect, useState } from 'react';
import { cn } from '../../../lib/utils';
import { api } from '../../../lib/api';
import { TenantSettingSummary, TenantSettingKey } from '@schoolos/core';
import { 
  Save, 
  Globe, 
  Palette, 
  Clock,
  CheckCircle2,
  AlertCircle,
  School,
  GraduationCap,
  CreditCard,
  Users,
  Calculator,
  MessageSquare,
  Shield,
  Database,
  ExternalLink,
  Loader2,
  FileText,
  Upload,
  Download,
  ShieldCheck
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { FormField } from '../../../components/ui/form-field';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Checkbox } from '../../../components/ui/checkbox';
import Link from 'next/link';

// --- Helpers ---

/**
 * Parses a time range string like "4:00 PM–7:00 PM" or "16:00–19:00" into [start, end] in 24h format.
 */
function parseTimeRange(range: string | undefined | null, defaultStart: string, defaultEnd: string): [string, string] {
  if (!range || typeof range !== 'string') return [defaultStart, defaultEnd];
  const parts = range.split(/[–-]/); // Split by en-dash or hyphen
  if (parts.length !== 2) return [defaultStart, defaultEnd];
  
  const clean = (p: string, fallback: string) => {
    let time = p.trim();
    // 12h to 24h conversion
    if (time.toLowerCase().includes('pm') || time.toLowerCase().includes('am')) {
       const match = time.match(/(\d+):(\d+)\s*(AM|PM)/i);
       if (match) {
         let hours = parseInt(match[1]);
         const minutes = match[2];
         const ampm = match[3].toUpperCase();
         if (ampm === 'PM' && hours < 12) hours += 12;
         if (ampm === 'AM' && hours === 12) hours = 0;
         return `${hours.toString().padStart(2, '0')}:${minutes}`;
       }
    }
    // Already HH:mm?
    const hhmm = time.match(/^(\d{1,2}):(\d{2})$/);
    if (hhmm) {
      return `${hhmm[1].padStart(2, '0')}:${hhmm[2]}`;
    }
    return fallback;
  };

  return [clean(parts[0], defaultStart), clean(parts[1], defaultEnd)];
}

function formatTimeRange(start: string, end: string): string {
  if (!start || !end) return '';
  return `${start}–${end}`; // Project uses en-dash
}

const formatTimeForPreview = (time?: string | null) => {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) {
    return 'Not configured';
  }

  const [hourValue, minute] = time.split(':').map(Number);

  if (
    Number.isNaN(hourValue) ||
    Number.isNaN(minute) ||
    hourValue < 0 ||
    hourValue > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return 'Not configured';
  }

  const period = hourValue >= 12 ? 'PM' : 'AM';
  const hour12 = hourValue % 12 || 12;

  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
};

const formatTimeRangeForPreview = (
  start?: string | null,
  end?: string | null,
) => {
  const startLabel = formatTimeForPreview(start);
  const endLabel = formatTimeForPreview(end);

  if (startLabel === 'Not configured' || endLabel === 'Not configured') {
    return 'Not configured';
  }

  return `${startLabel} – ${endLabel}`;
};

// --- Constants ---

const SCHOOL_PROFILE_SETTING_KEYS: TenantSettingKey[] = [
  'school_name', 'school_address', 'school_phone', 'school_email', 
  'school_pan_number', 'principal_name', 'municipality', 'ward_number', 
  'district', 'province', 'school_type', 'iemis_school_code'
];

const BRANDING_SETTING_KEYS: TenantSettingKey[] = [
  'branding_primary_color', 'receipt_header_text', 'receipt_footer_text', 
  'id_card_footer_text', 'payslip_footer_text', 'certificate_footer_text', 
  'report_card_footer_text', 'default_paper_size', 'timezone', 'currency', 'date_format'
];

const ACADEMIC_SETTING_KEYS: TenantSettingKey[] = [
  'active_academic_year_label', 'default_calendar', 'attendance_working_days', 
  'promotion_rule_mode', 'grading_scheme_label'
];

const FEE_SETTING_KEYS: TenantSettingKey[] = [
  'active_fee_plan_required', 'receipt_number_prefix', 'payment_methods_enabled', 
  'late_fee_enabled', 'late_fee_grace_days', 'waiver_approval_required', 
  'discount_approval_required', 'cashier_close_required'
];

const ATTENDANCE_SETTING_KEYS: TenantSettingKey[] = [
  'attendance_lock_hours', 'late_threshold_minutes', 'half_day_threshold_minutes', 
  'allow_teacher_correction_request', 'parent_attendance_visibility', 'weekend_policy'
];

const PAYROLL_SETTING_KEYS: TenantSettingKey[] = [
  'payroll_month_day', 'default_working_days_per_month', 'pf_enabled', 
  'tds_enabled', 'leave_approval_required', 'unpaid_leave_affects_payroll', 
  'payroll_approval_required', 'salary_payment_methods'
];

const ACCOUNTING_SETTING_KEYS: TenantSettingKey[] = [
  'active_fiscal_year_label', 'fiscal_period_lock_policy', 'default_cash_account_label', 
  'default_bank_account_label', 'salary_payable_account_label', 'tds_payable_account_label', 
  'pf_payable_account_label', 'fee_income_account_label', 'journal_number_prefix', 
  'voucher_number_prefix'
];

const COMMUNICATION_SETTING_KEYS: TenantSettingKey[] = [
  'default_notice_channel', 'parent_notification_enabled', 'consent_required_for_media', 
  'quiet_hours_enabled', 'chat_availability_enabled', 'chat_sunday_to_thursday_hours', 
  'chat_friday_hours', 'chat_saturday_enabled', 'emergency_override_requires_admin', 'timezone'
];

const SECURITY_SETTING_KEYS: TenantSettingKey[] = [
  'sensitive_staff_fields_masked', 'export_requires_permission', 'audit_log_retention_days', 
  'session_timeout_minutes', 'require_reason_for_sensitive_reveal'
];

// --- Components ---

export default function TenantSettingsPage() {
  const [settings, setSettings] = useState<TenantSettingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await api.getTenantSettings();
      setSettings(data);
    } catch (err) {
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle size={20} />
          <span>Error</span>
        </div>
        <p className="mt-1 text-sm">{error}</p>
        <Button variant="outline" className="mt-4" onClick={fetchSettings}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">School Settings</h1>
        <p className="text-slate-500">Configure your school&apos;s profile, branding, and operational rules.</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-slate-100 p-1 overflow-x-auto flex-nowrap scrollbar-hide">
          <TabsTrigger value="profile" className="gap-2"><School size={16} /> Profile</TabsTrigger>
          <TabsTrigger value="branding" className="gap-2"><Palette size={16} /> Branding</TabsTrigger>
          <TabsTrigger value="academic" className="gap-2"><GraduationCap size={16} /> Academic</TabsTrigger>
          <TabsTrigger value="fees" className="gap-2"><CreditCard size={16} /> Fees</TabsTrigger>
          <TabsTrigger value="attendance" className="gap-2"><Clock size={16} /> Attendance</TabsTrigger>
          <TabsTrigger value="payroll" className="gap-2"><Users size={16} /> HR & Payroll</TabsTrigger>
          <TabsTrigger value="accounting" className="gap-2"><Calculator size={16} /> Accounting</TabsTrigger>
          <TabsTrigger value="communication" className="gap-2"><MessageSquare size={16} /> Comms</TabsTrigger>
          <TabsTrigger value="security" className="gap-2"><Shield size={16} /> Security</TabsTrigger>
          <TabsTrigger value="data" className="gap-2"><Download size={16} /> Import/Export</TabsTrigger>
          <TabsTrigger value="audit" className="gap-2"><FileText size={16} /> Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <SectionSchoolProfile initialValues={settings} onUpdate={fetchSettings} />
        </TabsContent>
        <TabsContent value="branding">
          <SectionBranding initialValues={settings} onUpdate={fetchSettings} />
        </TabsContent>
        <TabsContent value="academic">
          <SectionAcademic initialValues={settings} onUpdate={fetchSettings} />
        </TabsContent>
        <TabsContent value="fees">
          <SectionFees initialValues={settings} onUpdate={fetchSettings} />
        </TabsContent>
        <TabsContent value="attendance">
          <SectionAttendance initialValues={settings} onUpdate={fetchSettings} />
        </TabsContent>
        <TabsContent value="payroll">
          <SectionPayroll initialValues={settings} onUpdate={fetchSettings} />
        </TabsContent>
        <TabsContent value="accounting">
          <SectionAccounting initialValues={settings} onUpdate={fetchSettings} />
        </TabsContent>
        <TabsContent value="communication">
          <SectionCommunication initialValues={settings} onUpdate={fetchSettings} />
        </TabsContent>
        <TabsContent value="security">
          <SectionSecurity initialValues={settings} onUpdate={fetchSettings} />
        </TabsContent>
        <TabsContent value="data">
          <SectionData initialValues={settings} />
        </TabsContent>
        <TabsContent value="audit">
          <SectionAudit initialValues={settings} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SectionWrapper({ 
  title, 
  description, 
  children, 
  onSave, 
  isSaving,
  alert
}: { 
  title: string; 
  description: string; 
  children: React.ReactNode; 
  onSave?: () => void;
  isSaving?: boolean;
  alert?: { type: 'success' | 'error' | 'warning', text: string } | null;
}) {
  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden">
      <CardHeader className="bg-slate-50/50 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {onSave && (
            <Button 
              onClick={onSave} 
              disabled={isSaving}
              className="gap-2 shadow-sm"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Changes
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {alert && (
          <div className={`mb-6 flex items-center gap-2 rounded-xl p-4 text-sm ${
            alert.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 
            alert.type === 'warning' ? 'bg-amber-50 text-amber-700' :
            'bg-rose-50 text-rose-700'
          }`}>
            {alert.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            {alert.text}
          </div>
        )}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}


// --- Form Hook ---

function useSettingsForm(initialValues: TenantSettingSummary[], keys: TenantSettingKey[], onUpdate: () => void) {
  const [form, setForm] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    const initial: Record<string, any> = {};
    keys.forEach(key => {
      const s = initialValues.find(sv => sv.key === key);
      initial[key] = s ? s.value : '';
    });
    setForm(initial);
  }, [initialValues, keys]);

  const setFieldValue = (key: string, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    setIsSaving(true);
    setAlert(null);
    try {
      for (const key of Object.keys(form)) {
        const initial = initialValues.find(s => s.key === key);
        if (JSON.stringify(initial?.value) !== JSON.stringify(form[key])) {
          await api.updateTenantSetting(key, form[key]);
        }
      }
      setAlert({ type: 'success', text: 'Settings updated successfully.' });
      onUpdate();
    } catch (err) {
      setAlert({ type: 'error', text: 'Failed to update settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  return { form, setFieldValue, save, isSaving, alert };
}

// --- Sections ---

function SectionSchoolProfile({ initialValues, onUpdate }: { initialValues: TenantSettingSummary[], onUpdate: () => void }) {
  const { form, setFieldValue, save, isSaving, alert } = useSettingsForm(initialValues, SCHOOL_PROFILE_SETTING_KEYS, onUpdate);

  return (
    <SectionWrapper 
      title="School Profile" 
      description="Official administrative details for your institution."
      onSave={save}
      isSaving={isSaving}
      alert={alert}
    >
      <FormField label="School Name"><Input value={form.school_name || ''} onChange={e => setFieldValue('school_name', e.target.value)} /></FormField>
      <FormField label="School Address"><Input value={form.school_address || ''} onChange={e => setFieldValue('school_address', e.target.value)} /></FormField>
      <FormField label="Contact Phone"><Input value={form.school_phone || ''} onChange={e => setFieldValue('school_phone', e.target.value)} /></FormField>
      <FormField label="Contact Email"><Input type="email" value={form.school_email || ''} onChange={e => setFieldValue('school_email', e.target.value)} /></FormField>
      <FormField label="PAN / Registration Number"><Input value={form.school_pan_number || ''} onChange={e => setFieldValue('school_pan_number', e.target.value)} /></FormField>
      <FormField label="Principal Name"><Input value={form.principal_name || ''} onChange={e => setFieldValue('principal_name', e.target.value)} /></FormField>
      <FormField label="Municipality"><Input value={form.municipality || ''} onChange={e => setFieldValue('municipality', e.target.value)} /></FormField>
      <FormField label="Ward Number"><Input value={form.ward_number || ''} onChange={e => setFieldValue('ward_number', e.target.value)} /></FormField>
      <FormField label="District"><Input value={form.district || ''} onChange={e => setFieldValue('district', e.target.value)} /></FormField>
      <FormField label="Province"><Input value={form.province || ''} onChange={e => setFieldValue('province', e.target.value)} /></FormField>
      <FormField label="School Type"><Select value={form.school_type || ''} onChange={e => setFieldValue('school_type', e.target.value)}>
        <option value="">Select...</option>
        <option value="PRIVATE">Private / Institutional</option>
        <option value="COMMUNITY">Community / Government</option>
        <option value="TRUST">Public Trust</option>
      </Select></FormField>
      <FormField label="iEMIS School Code"><Input value={form.iemis_school_code || ''} onChange={e => setFieldValue('iemis_school_code', e.target.value)} /></FormField>
    </SectionWrapper>
  );
}

function SectionBranding({ initialValues, onUpdate }: { initialValues: TenantSettingSummary[], onUpdate: () => void }) {
  const { form, setFieldValue, save, isSaving, alert } = useSettingsForm(initialValues, BRANDING_SETTING_KEYS, onUpdate);

  return (
    <SectionWrapper 
      title="Branding & Documents" 
      description="Visual identity and document preferences."
      onSave={save}
      isSaving={isSaving}
      alert={alert}
    >
      <FormField label="Primary Color" description="Used for UI highlights.">
        <div className="flex items-center gap-3">
          <input type="color" value={form.branding_primary_color || '#6366f1'} onChange={e => setFieldValue('branding_primary_color', e.target.value)} className="h-10 w-20 rounded-lg border p-1 cursor-pointer" />
          <span className="font-mono text-xs uppercase">{form.branding_primary_color}</span>
        </div>
      </FormField>
      <FormField label="Receipt Header"><Input value={form.receipt_header_text || ''} onChange={e => setFieldValue('receipt_header_text', e.target.value)} /></FormField>
      <FormField label="Receipt Footer"><Input value={form.receipt_footer_text || ''} onChange={e => setFieldValue('receipt_footer_text', e.target.value)} /></FormField>
      <FormField label="ID Card Footer"><Input value={form.id_card_footer_text || ''} onChange={e => setFieldValue('id_card_footer_text', e.target.value)} /></FormField>
      <FormField label="Payslip Footer"><Input value={form.payslip_footer_text || ''} onChange={e => setFieldValue('payslip_footer_text', e.target.value)} /></FormField>
      <FormField label="Report Card Footer"><Input value={form.report_card_footer_text || ''} onChange={e => setFieldValue('report_card_footer_text', e.target.value)} /></FormField>
      <FormField label="Default Paper Size"><Select value={form.default_paper_size || 'A4'} onChange={e => setFieldValue('default_paper_size', e.target.value)}>
        <option value="A4">A4</option>
        <option value="LETTER">Letter</option>
        <option value="LEGAL">Legal</option>
        <option value="80MM">Thermal 80mm</option>
      </Select></FormField>
      <FormField label="Timezone"><Select value={form.timezone || 'Asia/Kathmandu'} onChange={e => setFieldValue('timezone', e.target.value)}>
        <option value="Asia/Kathmandu">Nepal (UTC+5:45)</option>
        <option value="UTC">UTC</option>
      </Select></FormField>
      <FormField label="Currency"><Select value={form.currency || 'NPR'} onChange={e => setFieldValue('currency', e.target.value)}>
        <option value="NPR">Nepalese Rupee (NPR)</option>
        <option value="USD">US Dollar (USD)</option>
      </Select></FormField>
      <FormField label="Date Format"><Select value={form.date_format || 'YYYY-MM-DD'} onChange={e => setFieldValue('date_format', e.target.value)}>
        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
      </Select></FormField>
      <div className="col-span-full border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-400">Logo and Stamp uploads are managed via the File Registry (Coming Soon).</p>
      </div>
    </SectionWrapper>
  );
}

function SectionAcademic({ initialValues, onUpdate }: { initialValues: TenantSettingSummary[], onUpdate: () => void }) {
  const { form, setFieldValue, save, isSaving, alert } = useSettingsForm(initialValues, ACADEMIC_SETTING_KEYS, onUpdate);

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <SectionWrapper 
      title="Academic Setup" 
      description="Configure academic calendars and promotion rules."
      onSave={save}
      isSaving={isSaving}
      alert={alert}
    >
      <FormField label="Active Academic Year"><Input value={form.active_academic_year_label || ''} onChange={e => setFieldValue('active_academic_year_label', e.target.value)} placeholder="e.g. 2081/82" /></FormField>
      <FormField label="Default Calendar"><Select value={form.default_calendar || 'BS'} onChange={e => setFieldValue('default_calendar', e.target.value)}>
        <option value="BS">Bikram Sambat (BS)</option>
        <option value="AD">Anno Domini (AD)</option>
      </Select></FormField>
      <FormField label="Grading Scheme"><Input value={form.grading_scheme_label || ''} onChange={e => setFieldValue('grading_scheme_label', e.target.value)} placeholder="e.g. Letter Grade 2078" /></FormField>
      <FormField label="Promotion Mode"><Select value={form.promotion_rule_mode || 'MANUAL'} onChange={e => setFieldValue('promotion_rule_mode', e.target.value)}>
        <option value="MANUAL">Manual Approval</option>
        <option value="AUTOMATIC">Auto-promote on Pass</option>
      </Select></FormField>
      <div className="col-span-full space-y-3">
        <label className="text-sm font-semibold text-slate-700">Working Days (for Attendance)</label>
        <div className="flex flex-wrap gap-4">
          {days.map(day => (
            <Checkbox 
              key={day} 
              label={day} 
              checked={Array.isArray(form.attendance_working_days) && form.attendance_working_days.includes(day)}
              onChange={(val) => {
                const current = Array.isArray(form.attendance_working_days) ? form.attendance_working_days : [];
                const updated = val ? [...current, day] : current.filter(d => d !== day);
                setFieldValue('attendance_working_days', updated);
              }}
            />
          ))}
        </div>
      </div>
      <div className="col-span-full pt-4">
        <Link 
          href="/dashboard/academics/years" 
          className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium shadow-sm hover:bg-slate-50 transition-colors gap-2"
        >
          Manage Academic Years <ExternalLink size={14} />
        </Link>
      </div>
    </SectionWrapper>
  );
}

function SectionFees({ initialValues, onUpdate }: { initialValues: TenantSettingSummary[], onUpdate: () => void }) {
  const { form, setFieldValue, save, isSaving, alert } = useSettingsForm(initialValues, FEE_SETTING_KEYS, onUpdate);

  const methods = ['Cash', 'Bank Transfer', 'eSewa', 'Khalti', 'Cheque'];

  return (
    <SectionWrapper 
      title="Fee Setup" 
      description="Billing rules and collection preferences."
      onSave={save}
      isSaving={isSaving}
      alert={alert || (!form.active_fee_plan_required ? { type: 'warning', text: 'Important: Active fee plans are recommended for automated billing.' } : null)}
    >
      <FormField label="Receipt Prefix"><Input value={form.receipt_number_prefix || ''} onChange={e => setFieldValue('receipt_number_prefix', e.target.value)} placeholder="e.g. REC-" /></FormField>
      <FormField label="Late Fee Grace Days"><Input type="number" value={form.late_fee_grace_days ?? 0} onChange={e => setFieldValue('late_fee_grace_days', parseInt(e.target.value))} /></FormField>
      
      <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Checkbox label="Active Fee Plan Required" checked={!!form.active_fee_plan_required} onChange={v => setFieldValue('active_fee_plan_required', v)} />
          <Checkbox label="Enable Late Fees" checked={!!form.late_fee_enabled} onChange={v => setFieldValue('late_fee_enabled', v)} />
          <Checkbox label="Require Waiver Approval" checked={!!form.waiver_approval_required} onChange={v => setFieldValue('waiver_approval_required', v)} />
          <Checkbox label="Require Discount Approval" checked={!!form.discount_approval_required} onChange={v => setFieldValue('discount_approval_required', v)} />
          <Checkbox label="Mandatory Cashier Close" checked={!!form.cashier_close_required} onChange={v => setFieldValue('cashier_close_required', v)} />
        </div>
        <div className="space-y-3">
          <label className="text-sm font-semibold text-slate-700">Accepted Payment Methods</label>
          <div className="grid grid-cols-2 gap-2">
            {methods.map(m => (
              <Checkbox 
                key={m} 
                label={m} 
                checked={Array.isArray(form.payment_methods_enabled) && form.payment_methods_enabled.includes(m)}
                onChange={val => {
                  const current = Array.isArray(form.payment_methods_enabled) ? form.payment_methods_enabled : [];
                  const updated = val ? [...current, m] : current.filter(x => x !== m);
                  setFieldValue('payment_methods_enabled', updated);
                }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="col-span-full pt-4">
        <Link 
          href="/dashboard/fees" 
          className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium shadow-sm hover:bg-slate-50 transition-colors gap-2"
        >
          Go to Fee Module <ExternalLink size={14} />
        </Link>
      </div>
    </SectionWrapper>
  );
}

function SectionAttendance({ initialValues, onUpdate }: { initialValues: TenantSettingSummary[], onUpdate: () => void }) {
  const { form, setFieldValue, save, isSaving, alert } = useSettingsForm(initialValues, ATTENDANCE_SETTING_KEYS, onUpdate);

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <SectionWrapper 
      title="Attendance Rules" 
      description="Locking periods and threshold settings."
      onSave={save}
      isSaving={isSaving}
      alert={alert}
    >
      <FormField label="Attendance Lock" description="Time in hours after session to lock edits."><Input type="number" value={form.attendance_lock_hours ?? 24} onChange={e => setFieldValue('attendance_lock_hours', parseInt(e.target.value))} /></FormField>
      <FormField label="Late Threshold (Mins)" description="Minutes before marking LATE."><Input type="number" value={form.late_threshold_minutes ?? 15} onChange={e => setFieldValue('late_threshold_minutes', parseInt(e.target.value))} /></FormField>
      <FormField label="Half Day Threshold (Mins)" description="Minutes missed for half-day."><Input type="number" value={form.half_day_threshold_minutes ?? 120} onChange={e => setFieldValue('half_day_threshold_minutes', parseInt(e.target.value))} /></FormField>
      
      <div className="col-span-full space-y-4">
        <Checkbox label="Allow Teacher Correction Requests" checked={!!form.allow_teacher_correction_request} onChange={v => setFieldValue('allow_teacher_correction_request', v)} />
        <Checkbox label="Parent Visibility (Live)" checked={!!form.parent_attendance_visibility} onChange={v => setFieldValue('parent_attendance_visibility', v)} />
        
        <div className="space-y-3 pt-2">
          <label className="text-sm font-semibold text-slate-700">Weekend Policy (Non-Working Days)</label>
          <div className="flex flex-wrap gap-4">
            {days.map(day => (
              <Checkbox 
                key={day} 
                label={day} 
                checked={Array.isArray(form.weekend_policy) && form.weekend_policy.includes(day)}
                onChange={(val) => {
                  const current = Array.isArray(form.weekend_policy) ? form.weekend_policy : [];
                  const updated = val ? [...current, day] : current.filter(d => d !== day);
                  setFieldValue('weekend_policy', updated);
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}

function SectionPayroll({ initialValues, onUpdate }: { initialValues: TenantSettingSummary[], onUpdate: () => void }) {
  const { form, setFieldValue, save, isSaving, alert } = useSettingsForm(initialValues, PAYROLL_SETTING_KEYS, onUpdate);

  const methods = ['Bank Transfer', 'Cash', 'Cheque'];

  return (
    <SectionWrapper 
      title="HR & Payroll Setup" 
      description="Salary generation rules and benefit defaults."
      onSave={save}
      isSaving={isSaving}
      alert={alert}
    >
      <FormField label="Payroll Generation Day" description="Default day of month to run."><Input type="number" value={form.payroll_month_day ?? 25} onChange={e => setFieldValue('payroll_month_day', parseInt(e.target.value))} /></FormField>
      <FormField label="Working Days / Month"><Input type="number" value={form.default_working_days_per_month ?? 26} onChange={e => setFieldValue('default_working_days_per_month', parseInt(e.target.value))} /></FormField>
      
      <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Checkbox label="Provident Fund (PF) Enabled" checked={!!form.pf_enabled} onChange={v => setFieldValue('pf_enabled', v)} />
          <Checkbox label="Tax Deducted at Source (TDS) Enabled" checked={!!form.tds_enabled} onChange={v => setFieldValue('tds_enabled', v)} />
          <Checkbox label="Require Leave Approval" checked={!!form.leave_approval_required} onChange={v => setFieldValue('leave_approval_required', v)} />
          <Checkbox label="Unpaid Leave Affects Payroll" checked={!!form.unpaid_leave_affects_payroll} onChange={v => setFieldValue('unpaid_leave_affects_payroll', v)} />
          <Checkbox label="Payroll Approval Required" checked={!!form.payroll_approval_required} onChange={v => setFieldValue('payroll_approval_required', v)} />
        </div>
        <div className="space-y-3">
          <label className="text-sm font-semibold text-slate-700">Salary Payment Methods</label>
          <div className="space-y-2">
            {methods.map(m => (
              <Checkbox 
                key={m} 
                label={m} 
                checked={Array.isArray(form.salary_payment_methods) && form.salary_payment_methods.includes(m)}
                onChange={val => {
                  const current = Array.isArray(form.salary_payment_methods) ? form.salary_payment_methods : [];
                  const updated = val ? [...current, m] : current.filter(x => x !== m);
                  setFieldValue('salary_payment_methods', updated);
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}

function SectionAccounting({ initialValues, onUpdate }: { initialValues: TenantSettingSummary[], onUpdate: () => void }) {
  const { form, setFieldValue, save, isSaving, alert } = useSettingsForm(initialValues, ACCOUNTING_SETTING_KEYS, onUpdate);

  return (
    <SectionWrapper 
      title="Accounting Setup" 
      description="Fiscal controls and account mapping defaults."
      onSave={save}
      isSaving={isSaving}
      alert={alert}
    >
      <FormField label="Fiscal Year"><Input value={form.active_fiscal_year_label || ''} onChange={e => setFieldValue('active_fiscal_year_label', e.target.value)} /></FormField>
      <FormField label="Lock Policy"><Select value={form.fiscal_period_lock_policy || 'MONTHLY'} onChange={e => setFieldValue('fiscal_period_lock_policy', e.target.value)}>
        <option value="MONTHLY">Monthly Lock</option>
        <option value="QUARTERLY">Quarterly Lock</option>
        <option value="ANNUAL">Annual Lock Only</option>
      </Select></FormField>
      <FormField label="Journal Prefix"><Input value={form.journal_number_prefix || ''} onChange={e => setFieldValue('journal_number_prefix', e.target.value)} /></FormField>
      <FormField label="Voucher Prefix"><Input value={form.voucher_number_prefix || ''} onChange={e => setFieldValue('voucher_number_prefix', e.target.value)} /></FormField>
      <FormField label="Cash Account"><Input value={form.default_cash_account_label || ''} onChange={e => setFieldValue('default_cash_account_label', e.target.value)} /></FormField>
      <FormField label="Bank Account"><Input value={form.default_bank_account_label || ''} onChange={e => setFieldValue('default_bank_account_label', e.target.value)} /></FormField>
      <FormField label="Fee Income Account"><Input value={form.fee_income_account_label || ''} onChange={e => setFieldValue('fee_income_account_label', e.target.value)} /></FormField>
      <FormField label="Salary Payable Account"><Input value={form.salary_payable_account_label || ''} onChange={e => setFieldValue('salary_payable_account_label', e.target.value)} /></FormField>
      
      <div className="col-span-full pt-4">
        <Link 
          href="/dashboard/accounting" 
          className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium shadow-sm hover:bg-slate-50 transition-colors gap-2"
        >
          Open Ledger Workspace <ExternalLink size={14} />
        </Link>
      </div>
    </SectionWrapper>
  );
}

function SectionCommunication({ initialValues, onUpdate }: { initialValues: TenantSettingSummary[], onUpdate: () => void }) {
  const { form, setFieldValue, save, isSaving, alert: formAlert } = useSettingsForm(initialValues, COMMUNICATION_SETTING_KEYS, onUpdate);

  // TODO: Backend schema normalization - separate these into distinct database columns (chat_start, chat_end)
  // for better reporting and filtering in future phases.
  const [sunThuStart, sunThuEnd] = parseTimeRange(form.chat_sunday_to_thursday_hours, '16:00', '19:00');
  const [friStart, friEnd] = parseTimeRange(form.chat_friday_hours, '14:00', '17:00');

  const [validationError, setValidationError] = useState<string | null>(null);

  const handleTimeChange = (key: 'chat_sunday_to_thursday_hours' | 'chat_friday_hours', start: string, end: string) => {
    if (start && end && start >= end) {
      setValidationError(`${key.includes('friday') ? 'Friday' : 'Sun–Thu'}: Start time must be before end time.`);
    } else {
      setValidationError(null);
    }
    setFieldValue(key, formatTimeRange(start, end));
  };

  const alert = validationError ? { type: 'error' as const, text: validationError } : formAlert;

  return (
    <SectionWrapper 
      title="Communication Rules" 
      description="Notification channels and chat availability."
      onSave={save}
      isSaving={isSaving}
      alert={alert}
    >
      <FormField label="Default Notice Channel" description="Primary delivery method.">
        <Select value={form.default_notice_channel || 'EMAIL'} onChange={e => setFieldValue('default_notice_channel', e.target.value)}>
          <option value="EMAIL">Email</option>
          <option value="SMS">SMS</option>
          <option value="APP">Mobile App Push</option>
        </Select>
      </FormField>
      
      <FormField label="Timezone" description="School operational timezone.">
        <Select value={form.timezone || 'Asia/Kathmandu'} onChange={e => setFieldValue('timezone', e.target.value)}>
          <option value="Asia/Kathmandu">Nepal (UTC+5:45)</option>
          <option value="UTC">UTC</option>
        </Select>
      </FormField>

      <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-100 mt-2">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-slate-700">Sunday–Thursday Hours</label>
            <Badge variant="neutral" className="text-[10px] font-bold">DEFAULT: 16:00–19:00</Badge>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Start">
              <Input type="time" value={sunThuStart} onChange={e => handleTimeChange('chat_sunday_to_thursday_hours', e.target.value, sunThuEnd)} />
            </FormField>
            <FormField label="End">
              <Input type="time" value={sunThuEnd} onChange={e => handleTimeChange('chat_sunday_to_thursday_hours', sunThuStart, e.target.value)} />
            </FormField>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-slate-700">Friday Hours</label>
            <Badge variant="neutral" className="text-[10px] font-bold">DEFAULT: 14:00–17:00</Badge>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Start">
              <Input type="time" value={friStart} onChange={e => handleTimeChange('chat_friday_hours', e.target.value, friEnd)} />
            </FormField>
            <FormField label="End">
              <Input type="time" value={friEnd} onChange={e => handleTimeChange('chat_friday_hours', friStart, e.target.value)} />
            </FormField>
          </div>
        </div>

        <div className="col-span-full rounded-2xl border border-primary-100 bg-primary-50/30 p-4">
          <div className="flex gap-3">
            <AlertCircle className="text-primary-600 shrink-0" size={18} />
            <p className="text-sm text-primary-700 leading-relaxed">
              <strong>Chat Expectations:</strong> Messages outside school chat hours will be queued. Teachers will see them once their next shift starts. Saturday is <strong>closed</strong> by default.
            </p>
          </div>
        </div>

        <div className="col-span-full rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-slate-900">Live Preview (Parent View)</p>
            <Badge variant={form.chat_availability_enabled ? 'success' : 'neutral'}>
              {form.chat_availability_enabled ? 'ONLINE' : 'OFFLINE'}
            </Badge>
          </div>

          <dl className="grid gap-6 text-sm text-slate-600 sm:grid-cols-3">
            <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
              <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sun–Thu</dt>
              <dd className="font-semibold text-slate-700">
                {formatTimeRangeForPreview(sunThuStart, sunThuEnd)}
              </dd>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
              <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Friday</dt>
              <dd className="font-semibold text-slate-700">
                {formatTimeRangeForPreview(friStart, friEnd)}
              </dd>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
              <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Saturday</dt>
              <dd className={cn("font-semibold", form.chat_saturday_enabled ? "text-emerald-600" : "text-rose-500")}>
                {form.chat_saturday_enabled ? 'Open (Special Policy)' : 'Closed'}
              </dd>
            </div>
          </dl>
        </div>
      </div>
      
      <div className="col-span-full space-y-4 pt-2 border-t border-slate-100 mt-2">
        <Checkbox label="Enable Parent Push Notifications" checked={!!form.parent_notification_enabled} onChange={v => setFieldValue('parent_notification_enabled', v)} />
        <Checkbox label="Media Consent Required (Photos/Videos)" checked={!!form.consent_required_for_media} onChange={v => setFieldValue('consent_required_for_media', v)} />
        <Checkbox label="Enable Quiet Hours (No Notifications)" checked={!!form.quiet_hours_enabled} onChange={v => setFieldValue('quiet_hours_enabled', v)} />
        <Checkbox label="Allow Direct Parent-Teacher Chat" checked={!!form.chat_availability_enabled} onChange={v => setFieldValue('chat_availability_enabled', v)} />
        <Checkbox label="Enable Saturday Chat" checked={!!form.chat_saturday_enabled} onChange={v => setFieldValue('chat_saturday_enabled', v)} />
        <Checkbox label="Emergency Broadcasts Require Admin" checked={!!form.emergency_override_requires_admin} onChange={v => setFieldValue('emergency_override_requires_admin', v)} />
      </div>
    </SectionWrapper>
  );
}

function SectionSecurity({ initialValues, onUpdate }: { initialValues: TenantSettingSummary[], onUpdate: () => void }) {
  const { form, setFieldValue, save, isSaving, alert } = useSettingsForm(initialValues, SECURITY_SETTING_KEYS, onUpdate);

  return (
    <SectionWrapper 
      title="Security & Access" 
      description="Data protection and session controls."
      onSave={save}
      isSaving={isSaving}
      alert={alert}
    >
      <FormField label="Audit Log Retention (Days)"><Input type="number" value={form.audit_log_retention_days ?? 365} onChange={e => setFieldValue('audit_log_retention_days', parseInt(e.target.value))} /></FormField>
      <FormField label="Session Timeout (Mins)"><Input type="number" value={form.session_timeout_minutes ?? 60} onChange={e => setFieldValue('session_timeout_minutes', parseInt(e.target.value))} /></FormField>
      
      <div className="col-span-full space-y-4 pt-2">
        <Checkbox label="Sensitive Staff Fields Masked" checked={!!form.sensitive_staff_fields_masked} onChange={v => setFieldValue('sensitive_staff_fields_masked', v)} />
        <Checkbox label="Exports Require Explicit Permission" checked={!!form.export_requires_permission} onChange={v => setFieldValue('export_requires_permission', v)} />
        <Checkbox label="Require Reason for Viewing Sensitive Data" checked={!!form.require_reason_for_sensitive_reveal} onChange={v => setFieldValue('require_reason_for_sensitive_reveal', v)} />
      </div>
    </SectionWrapper>
  );
}

function SectionData({ initialValues }: { initialValues: TenantSettingSummary[] }) {
  return (
    <SectionWrapper 
      title="Data Import / Export" 
      description="Bulk data operations and system integrations."
    >
      <div className="col-span-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Upload size={14} /> Imports
          </h4>
          <div className="grid gap-3">
            <DataActionCard title="Student Import" description="Import students from CSV/iEMIS." href="/dashboard/admissions/bulk-import" />
            <DataActionCard title="Staff Import" description="Bulk upload staff records." href="/dashboard/staff" />
            <DataActionCard title="Fee Ledger Import" description="Import historic fee data." href="/dashboard/fees" />
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Download size={14} /> Exports
          </h4>
          <div className="grid gap-3">
            <DataActionCard title="iEMIS Export" description="Government-ready Excel files." href="/dashboard/students" />
            <DataActionCard title="Accounting Audit" description="Download full journal trail." href="/dashboard/accounting" />
            <DataActionCard title="Class Roster" description="Student list by class." href="/dashboard/students" />
            <DataActionCard title="Payroll Register" description="Export approved payroll runs." href="/dashboard/hr/payroll" />
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <ExternalLink size={14} /> Integrations
          </h4>
          <div className="grid gap-3">
            <DataActionCard title="API Access" description="Generate keys for integration." href="/dashboard/settings/security" />
            <DataActionCard title="Webhooks" description="Configure real-time events." href="/dashboard/settings/security" />
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}

function SectionAudit({ initialValues }: { initialValues: TenantSettingSummary[] }) {
  return (
    <SectionWrapper 
      title="Audit Logs" 
      description="Track every administrative action within your school."
    >
      <div className="col-span-full flex flex-col items-center justify-center py-12 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
        <div className="h-16 w-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-400 mb-4 border border-slate-100">
          <ShieldCheck size={32} />
        </div>
        <h4 className="text-lg font-bold text-slate-900">Audit Trail Ready</h4>
        <p className="text-sm text-slate-500 max-w-sm mt-2">
          Your school activity is being recorded. Detailed log viewing and filtering will be available in the next release.
        </p>
        <Button variant="outline" className="mt-6 gap-2">
          <Download size={16} /> Request Archive
        </Button>
      </div>
    </SectionWrapper>
  );
}

function DataActionCard({ title, description, href }: { title: string, description: string, href: string }) {
  return (
    <Link href={href} className="group rounded-xl border border-slate-200 p-4 transition-all hover:border-primary-500 hover:shadow-md bg-white block">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-bold text-slate-800 text-sm">{title}</h4>
        <ExternalLink size={14} className="text-slate-300 group-hover:text-primary-500" />
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed">{description}</p>
    </Link>
  );
}
