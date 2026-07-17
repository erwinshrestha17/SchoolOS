'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, CircleAlert, FileClock, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import { formatBsDateTime } from '@schoolos/core';
import type { TenantSettingSummary } from '@schoolos/core';
import { Button } from '../ui/button';
import { ErrorState } from '../ui/error-state';
import { PageHeader } from '../ui/page-header';
import { PermissionDenied } from '../ui/permission-denied';
import { api } from '../../lib/api';
import { schoolSettingsApi } from '../../lib/api/school-settings';
import { SCHOOL_SETTINGS_ACCESS_LABELS, canEditSchoolSettings } from './school-settings-catalog';
import { getSchoolSettingsPolicy, type SchoolSettingsPolicyField } from './settings-policy-catalog';

export function SettingsPolicyWorkspace({ policyId }: { policyId: string }) {
  const policy = getSchoolSettingsPolicy(policyId);
  const client = useQueryClient();
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const settingsQuery = useQuery({ queryKey: ['school-settings', 'all'], queryFn: api.getTenantSettings });
  const navigationQuery = useQuery({ queryKey: ['school-settings', 'navigation'], queryFn: schoolSettingsApi.getSchoolSettingsNavigation });

  const initialForm = useMemo(() => policy ? buildPolicyForm(policy.fields, settingsQuery.data ?? []) : {}, [policy, settingsQuery.data]);
  useEffect(() => setForm(initialForm), [initialForm]);

  const navigationItem = (navigationQuery.data?.groups.flatMap((group) => group.items) ?? []).find((item) => item.id === policy?.navigationItemId);
  const canManage = canEditSchoolSettings(navigationItem?.access);
  const changedFields = policy?.fields.filter((field) => !sameValue(form[field.key], initialForm[field.key])) ?? [];
  const lastUpdatedAt = useMemo(() => {
    if (!policy || !settingsQuery.data) return null;
    const stamps = settingsQuery.data
      .filter((setting) => policy.fields.some((field) => field.key === setting.key))
      .map((setting) => setting.updatedAt)
      .sort();
    return stamps.length ? stamps[stamps.length - 1] : null;
  }, [policy, settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!policy) return;
      for (const field of changedFields) {
        await api.updateTenantSetting(field.key, form[field.key]);
      }
    },
    onSuccess: async () => {
      setNotice({ kind: 'success', text: `${policy?.title ?? 'School policy'} saved for this school.` });
      await client.invalidateQueries({ queryKey: ['school-settings', 'all'] });
      await client.invalidateQueries({ queryKey: ['school-settings', 'overview'] });
    },
    onError: (error) => setNotice({
      kind: 'error',
      text: isForbidden(error)
        ? 'Save blocked: your role cannot change this school policy.'
        : 'Save failed. Please review the policy values and try again.',
    }),
  });

  if (!policy) {
    return <div className="p-6"><ErrorState title="Settings area unavailable" message="This school policy does not exist or is not available for this school." /></div>;
  }

  if (settingsQuery.isLoading || navigationQuery.isLoading) {
    return <div className="space-y-5 p-6"><div className="h-28 animate-pulse rounded-2xl bg-slate-100" /><div className="h-96 animate-pulse rounded-2xl bg-slate-100" /></div>;
  }

  if (isForbidden(settingsQuery.error)) {
    return <div className="p-6"><PermissionDenied title="School Settings access needed" description="Your role cannot view this school policy. Ask a School Configuration Owner if you need access." /></div>;
  }

  if (settingsQuery.isError || navigationQuery.isError) {
    return <div className="p-6"><ErrorState title={`Could not load ${policy.title}`} message="Please retry to load the school policy." error={settingsQuery.error ?? navigationQuery.error} onRetry={() => { void settingsQuery.refetch(); void navigationQuery.refetch(); }} /></div>;
  }

  const reset = () => {
    setForm(initialForm);
    setNotice(null);
  };

  return <div className="space-y-6 p-6 pb-24">
    <PageHeader
      title={policy.title}
      description={policy.description}
      actions={<Link href="/dashboard/settings" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"><ArrowLeft className="h-4 w-4" />All settings</Link>}
    />

    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 font-bold text-blue-800"><ShieldCheck className="h-3.5 w-3.5" />Applies only to this school</span>
      <span className={`inline-flex items-center rounded-full px-3 py-1 font-bold ring-1 ${canManage ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-slate-200'}`}>Your access: {navigationItem ? SCHOOL_SETTINGS_ACCESS_LABELS[navigationItem.access] : 'View only'}</span>
      {lastUpdatedAt ? <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">Last updated {formatBsDateTime(lastUpdatedAt)}</span> : <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">Not configured yet</span>}
      <Link href="/dashboard/settings/audit-export" className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 font-bold text-slate-700 transition hover:bg-slate-50"><FileClock className="h-3.5 w-3.5" />Change history</Link>
    </div>

    {!canManage ? <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-bold">View-only access</p><p className="mt-1 leading-6">You can review this policy, but your role cannot change it. The backend enforces this on every save.</p></div></div> : null}
    {notice ? <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${notice.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>{notice.kind === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}{notice.text}</div> : null}

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{policy.eyebrow}</p><h2 className="mt-1 text-lg font-bold text-slate-950">Configure policy</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{policy.operationalImpact}</p></div>{policy.operationalLink ? <Link href={policy.operationalLink.href} className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">{policy.operationalLink.label}</Link> : null}</div>
      <div className="grid gap-x-8 gap-y-6 p-5 lg:grid-cols-2">{policy.fields.map((field) => <PolicyField key={field.key} field={field} value={form[field.key]} disabled={!canManage || saveMutation.isPending} onChange={(value) => setForm((current) => ({ ...current, [field.key]: value }))} />)}</div>
      <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-slate-200 bg-white/95 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate-600">{changedFields.length ? `${changedFields.length} unsaved ${changedFields.length === 1 ? 'change' : 'changes'}` : 'No unsaved changes'}</p><div className="flex gap-2"><Button type="button" variant="outline" onClick={reset} disabled={!changedFields.length || saveMutation.isPending}><RotateCcw className="h-4 w-4" />Discard</Button><Button type="button" onClick={() => saveMutation.mutate()} disabled={!canManage || !changedFields.length || saveMutation.isPending}><Save className="h-4 w-4" />{saveMutation.isPending ? 'Saving…' : 'Save policy'}</Button></div></div>
    </section>
  </div>;
}

function isForbidden(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'statusCode' in error &&
    (error as { statusCode?: number }).statusCode === 403,
  );
}

function PolicyField({ field, value, onChange, disabled }: { field: SchoolSettingsPolicyField; value: unknown; onChange: (value: unknown) => void; disabled: boolean }) {
  if (field.type === 'checkbox') {
    return <label className="flex gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-slate-300"><input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300" checked={Boolean(value)} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /><span><span className="block text-sm font-bold text-slate-900">{field.label}</span>{field.description ? <span className="mt-1 block text-sm leading-5 text-slate-600">{field.description}</span> : null}</span></label>;
  }

  if (field.type === 'multi-check') {
    const selected = Array.isArray(value) ? value.map(String) : [];
    return <fieldset className="rounded-xl border border-slate-200 p-4"><legend className="px-1 text-sm font-bold text-slate-900">{field.label}</legend>{field.description ? <p className="mt-1 text-sm leading-5 text-slate-600">{field.description}</p> : null}<div className="mt-3 flex flex-wrap gap-2">{(field.options ?? []).map((option) => { const active = selected.includes(option.value); return <button key={option.value} type="button" disabled={disabled} onClick={() => onChange(active ? selected.filter((item) => item !== option.value) : [...selected, option.value])} className={`rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}>{option.label}</button>; })}</div></fieldset>;
  }

  const inputId = `setting-${field.key}`;
  return <label className="block" htmlFor={inputId}><span className="text-sm font-bold text-slate-900">{field.label}</span>{field.description ? <span className="mt-1 block text-sm leading-5 text-slate-600">{field.description}</span> : null}{field.type === 'select' ? <select id={inputId} value={String(value ?? '')} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-900/5 disabled:bg-slate-100">{(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input id={inputId} type={field.type === 'number' ? 'number' : field.type === 'time' ? 'time' : 'text'} value={field.type === 'number' ? String(value ?? '') : String(value ?? '')} disabled={disabled} placeholder={field.placeholder} onChange={(event) => onChange(field.type === 'number' ? Number(event.target.value) : event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-900/5 disabled:bg-slate-100" />}</label>;
}

function buildPolicyForm(fields: SchoolSettingsPolicyField[], settings: TenantSettingSummary[]) {
  return Object.fromEntries(fields.map((field) => {
    const saved = settings.find((setting) => setting.key === field.key)?.value;
    return [field.key, saved ?? defaultValue(field)];
  }));
}

function defaultValue(field: SchoolSettingsPolicyField) {
  if (field.defaultValue !== undefined) return field.defaultValue;
  if (field.type === 'checkbox') return false;
  if (field.type === 'multi-check') return [];
  if (field.type === 'number') return 0;
  return '';
}

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}
