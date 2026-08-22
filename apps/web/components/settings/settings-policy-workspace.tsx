'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  CircleAlert,
  FileClock,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import {
  buildSchoolSettingsDomainVersion,
  formatBsDateTime,
  type TenantSettingSummary,
} from '@schoolos/core';
import { Button } from '../ui/button';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { ErrorState } from '../ui/error-state';
import { PermissionDenied } from '../ui/permission-denied';
import { api } from '../../lib/api';
import { schoolSettingsApi } from '../../lib/api/school-settings';
import { canEditSchoolSettings } from './school-settings-catalog';
import {
  SchoolSettingsPageHeader,
  SettingsPermissionNotice,
} from './settings-page-header';
import {
  getSchoolSettingsPolicy,
  type SchoolSettingsPolicyField,
} from './settings-policy-catalog';

export function SettingsPolicyWorkspace({ policyId }: { policyId: string }) {
  const policy = getSchoolSettingsPolicy(policyId);
  const client = useQueryClient();
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [reason, setReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notice, setNotice] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);
  const lastAttemptRef = useRef<{ signature: string; idempotencyKey: string } | null>(
    null,
  );

  const settingsQuery = useQuery({
    queryKey: ['school-settings', 'all'],
    queryFn: api.getTenantSettings,
  });
  const navigationQuery = useQuery({
    queryKey: ['school-settings', 'navigation'],
    queryFn: schoolSettingsApi.getSchoolSettingsNavigation,
  });

  const initialForm = useMemo(
    () =>
      policy ? buildPolicyForm(policy.fields, settingsQuery.data ?? []) : {},
    [policy, settingsQuery.data],
  );
  useEffect(() => setForm(initialForm), [initialForm]);

  const navigationItem = (
    navigationQuery.data?.groups.flatMap((group) => group.items) ?? []
  ).find((item) => item.id === policy?.navigationItemId);
  const canOpenAuditLog = (
    navigationQuery.data?.groups.flatMap((group) => group.items) ?? []
  ).some((item) => item.id === 'audit-export');
  const canManage = canEditSchoolSettings(navigationItem?.access);
  const changedFields =
    policy?.fields.filter(
      (field) => !sameValue(form[field.key], initialForm[field.key]),
    ) ?? [];
  const expectedVersion = useMemo(
    () =>
      policy
        ? buildSchoolSettingsDomainVersion(
            settingsQuery.data ?? [],
            policy.domain,
          )
        : 'empty',
    [policy, settingsQuery.data],
  );
  const lastUpdatedAt = useMemo(() => {
    if (!policy || !settingsQuery.data) return null;
    const stamps = settingsQuery.data
      .filter((setting) =>
        policy.fields.some((field) => field.key === setting.key),
      )
      .map((setting) => setting.updatedAt)
      .sort();
    return stamps.length ? stamps[stamps.length - 1] : null;
  }, [policy, settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!policy || !changedFields.length) return null;
      const changes = changedFields.map((field) => ({
        key: field.key,
        value: form[field.key],
      }));
      const signature = JSON.stringify({
        domain: policy.domain,
        expectedVersion,
        reason: reason.trim(),
        changes,
      });
      const prior = lastAttemptRef.current;
      const idempotencyKey =
        prior?.signature === signature ? prior.idempotencyKey : crypto.randomUUID();
      lastAttemptRef.current = { signature, idempotencyKey };

      return schoolSettingsApi.updateSchoolSettingsDomain(policy.domain, {
        expectedVersion,
        idempotencyKey,
        reason: reason.trim(),
        changes,
      });
    },
    onSuccess: async () => {
      lastAttemptRef.current = null;
      setConfirmOpen(false);
      setReason('');
      setNotice({
        kind: 'success',
        text: `${policy?.title ?? 'School policy'} saved for this school.`,
      });
      await Promise.all([
        client.invalidateQueries({ queryKey: ['school-settings', 'all'] }),
        client.invalidateQueries({ queryKey: ['school-settings', 'overview'] }),
        client.invalidateQueries({ queryKey: ['school-settings', 'navigation'] }),
      ]);
    },
    onError: (error) => {
      setConfirmOpen(false);
      setNotice({
        kind: 'error',
        text: isForbidden(error)
          ? 'Save blocked: your role cannot change this school policy.'
          : isConflict(error)
            ? 'This school policy changed after you opened it. Reload the latest settings before saving again.'
            : 'Save failed. Your changes were not confirmed. Review the values and retry.',
      });
    },
  });

  if (!policy) {
    return (
      <div className="p-6">
        <ErrorState
          title="Settings area unavailable"
          message="This school policy does not exist or is not available for this school."
        />
      </div>
    );
  }

  if (settingsQuery.isLoading || navigationQuery.isLoading) {
    return (
      <div className="space-y-5 p-6">
        <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  if (isForbidden(settingsQuery.error)) {
    return (
      <div className="p-6">
        <PermissionDenied
          title="School Settings access needed"
          description="Your role cannot view this school policy. Ask a School Configuration Owner if you need access."
        />
      </div>
    );
  }

  if (settingsQuery.isError || navigationQuery.isError) {
    return (
      <div className="p-6">
        <ErrorState
          title={`Could not load ${policy.title}`}
          message="Please retry to load the school policy."
          error={settingsQuery.error ?? navigationQuery.error}
          onRetry={() => {
            void settingsQuery.refetch();
            void navigationQuery.refetch();
          }}
        />
      </div>
    );
  }

  const reset = () => {
    setForm(initialForm);
    setReason('');
    setNotice(null);
    lastAttemptRef.current = null;
  };

  return (
    <div className="space-y-6 p-6 pb-24">
      <SchoolSettingsPageHeader
        title={policy.title}
        description={policy.description}
        access={canManage ? 'can-manage' : 'view-only'}
        status={
          lastUpdatedAt
            ? `Configured · Updated ${formatBsDateTime(lastUpdatedAt)}`
            : 'Using platform default'
        }
        actions={
          canOpenAuditLog ? (
            <Link
              href="/dashboard/settings/system/audit-log"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
            >
              <FileClock className="h-4 w-4" aria-hidden="true" />
              Change history
            </Link>
          ) : undefined
        }
      />

      {!canManage ? <SettingsPermissionNotice access="view-only" /> : null}
      {notice ? (
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${notice.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}
          role={notice.kind === 'error' ? 'alert' : 'status'}
        >
          {notice.kind === 'success' ? (
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          ) : (
            <CircleAlert className="h-4 w-4" aria-hidden="true" />
          )}
          {notice.text}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
              {policy.eyebrow}
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-950">
              Configure policy
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              {policy.operationalImpact}
            </p>
          </div>
          {policy.operationalLink ? (
            <Link
              href={policy.operationalLink.href}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {policy.operationalLink.label}
            </Link>
          ) : null}
        </div>
        <div className="grid gap-x-8 gap-y-6 p-5 lg:grid-cols-2">
          {policy.fields.map((field) => (
            <PolicyField
              key={field.key}
              field={field}
              value={form[field.key]}
              disabled={!canManage || saveMutation.isPending}
              onChange={(value) => {
                setNotice(null);
                lastAttemptRef.current = null;
                setForm((current) => ({ ...current, [field.key]: value }));
              }}
            />
          ))}
        </div>
        <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-slate-200 bg-white/95 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            {changedFields.length
              ? `${changedFields.length} unsaved ${changedFields.length === 1 ? 'change' : 'changes'}`
              : 'No unsaved changes'}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={reset}
              disabled={!changedFields.length || saveMutation.isPending}
            >
              <RotateCcw className="h-4 w-4" />
              Discard
            </Button>
            <Button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={
                !canManage || !changedFields.length || saveMutation.isPending
              }
            >
              <Save className="h-4 w-4" />
              Save policy
            </Button>
          </div>
        </div>
      </section>

      <ConfirmDialog
        isOpen={confirmOpen}
        title={`Save ${policy.title}?`}
        description={`This changes ${changedFields.length} school-wide ${changedFields.length === 1 ? 'setting' : 'settings'}. The update is applied atomically and recorded in the school audit history.`}
        confirmLabel="Confirm and save"
        variant="warning"
        isConfirming={saveMutation.isPending}
        preventCloseWhileConfirming
        confirmDisabled={reason.trim().length < 3}
        onConfirm={() => saveMutation.mutate()}
        onClose={() => {
          if (!saveMutation.isPending) setConfirmOpen(false);
        }}
      >
        <label className="block" htmlFor={`settings-change-reason-${policy.id}`}>
          <span className="text-sm font-semibold text-slate-900">
            Reason for change
          </span>
          <span className="mt-1 block text-sm leading-5 text-slate-600">
            Explain why this school-wide policy is being changed. This reason is
            retained with the audit record.
          </span>
          <textarea
            id={`settings-change-reason-${policy.id}`}
            rows={3}
            value={reason}
            disabled={saveMutation.isPending}
            onChange={(event) => {
              setReason(event.target.value);
              lastAttemptRef.current = null;
            }}
            placeholder="Example: Updated for the 2083/84 academic year"
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-900/5 disabled:bg-slate-100"
          />
        </label>
      </ConfirmDialog>
    </div>
  );
}

function statusCodeOf(error: unknown): number | undefined {
  return error && typeof error === 'object' && 'statusCode' in error
    ? (error as { statusCode?: number }).statusCode
    : undefined;
}

function isForbidden(error: unknown): boolean {
  return statusCodeOf(error) === 403;
}

function isConflict(error: unknown): boolean {
  return statusCodeOf(error) === 409;
}

function PolicyField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: SchoolSettingsPolicyField;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled: boolean;
}) {
  const inputId = `setting-${field.key}`;

  if (field.key === 'grading_scale') {
    return (
      <GradingScaleField
        field={field}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }

  if (field.type === 'checkbox') {
    return (
      <label className="flex gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-slate-300">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-slate-300"
          checked={Boolean(value)}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>
          <span className="block text-sm font-bold text-slate-900">
            {field.label}
          </span>
          {field.description ? (
            <span className="mt-1 block text-sm leading-5 text-slate-600">
              {field.description}
            </span>
          ) : null}
        </span>
      </label>
    );
  }

  if (field.type === 'multi-check') {
    const selected = Array.isArray(value) ? value.map(String) : [];
    return (
      <fieldset className="rounded-xl border border-slate-200 p-4">
        <legend className="px-1 text-sm font-bold text-slate-900">
          {field.label}
        </legend>
        {field.description ? (
          <p className="mt-1 text-sm leading-5 text-slate-600">
            {field.description}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {(field.options ?? []).map((option) => {
            const active = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                disabled={disabled}
                onClick={() =>
                  onChange(
                    active
                      ? selected.filter((item) => item !== option.value)
                      : [...selected, option.value],
                  )
                }
                className={`rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>
    );
  }

  if (field.type === 'json') {
    const textValue =
      typeof value === 'string'
        ? value
        : JSON.stringify(value ?? field.defaultValue ?? {}, null, 2);
    return (
      <label className="block lg:col-span-2" htmlFor={inputId}>
        <span className="text-sm font-bold text-slate-900">{field.label}</span>
        {field.description ? (
          <span className="mt-1 block text-sm leading-5 text-slate-600">
            {field.description}
          </span>
        ) : null}
        <textarea
          id={inputId}
          rows={8}
          disabled={disabled}
          value={textValue}
          onChange={(event) => {
            try {
              onChange(JSON.parse(event.target.value));
            } catch {
              onChange(event.target.value);
            }
          }}
          className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-900/5 disabled:bg-slate-100"
        />
      </label>
    );
  }

  return (
    <label className="block" htmlFor={inputId}>
      <span className="text-sm font-bold text-slate-900">{field.label}</span>
      {field.description ? (
        <span className="mt-1 block text-sm leading-5 text-slate-600">
          {field.description}
        </span>
      ) : null}
      {field.type === 'select' ? (
        <select
          id={inputId}
          value={String(value ?? '')}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-900/5 disabled:bg-slate-100"
        >
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={inputId}
          type={
            field.type === 'number'
              ? 'number'
              : field.type === 'time'
                ? 'time'
                : 'text'
          }
          value={String(value ?? '')}
          disabled={disabled}
          placeholder={field.placeholder}
          onChange={(event) =>
            onChange(
              field.type === 'number'
                ? Number(event.target.value)
                : event.target.value,
            )
          }
          className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-900/5 disabled:bg-slate-100"
        />
      )}
    </label>
  );
}

type GradingBand = {
  grade: string;
  minPercentage: number;
  maxPercentage: number;
  gradePoint: number;
  label: string;
  passed: boolean;
};

function GradingScaleField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: SchoolSettingsPolicyField;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled: boolean;
}) {
  const rows = toGradingBands(value, field.defaultValue);
  const update = (index: number, patch: Partial<GradingBand>) =>
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));

  return (
    <fieldset className="lg:col-span-2 rounded-xl border border-slate-200 p-4">
      <legend className="px-1 text-sm font-bold text-slate-900">
        {field.label}
      </legend>
      {field.description ? (
        <p className="mt-1 text-sm leading-5 text-slate-600">
          {field.description}
        </p>
      ) : null}
      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[820px] space-y-2">
          <div className="grid grid-cols-[90px_110px_110px_100px_minmax(160px,1fr)_90px_44px] gap-2 px-1 text-xs font-bold uppercase tracking-wide text-slate-500">
            <span>Grade</span>
            <span>Min %</span>
            <span>Max %</span>
            <span>GPA</span>
            <span>Label</span>
            <span>Result</span>
            <span className="sr-only">Remove</span>
          </div>
          {rows.map((row, index) => (
            <div
              key={`${row.grade}-${index}`}
              className="grid grid-cols-[90px_110px_110px_100px_minmax(160px,1fr)_90px_44px] gap-2 rounded-lg bg-slate-50 p-2"
            >
              <input
                aria-label={`Grade ${index + 1}`}
                value={row.grade}
                disabled={disabled}
                onChange={(event) => update(index, { grade: event.target.value })}
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
              />
              <input
                aria-label={`Minimum percentage ${index + 1}`}
                type="number"
                min={0}
                max={100}
                value={row.minPercentage}
                disabled={disabled}
                onChange={(event) =>
                  update(index, { minPercentage: Number(event.target.value) })
                }
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
              />
              <input
                aria-label={`Maximum percentage ${index + 1}`}
                type="number"
                min={0}
                max={100}
                value={row.maxPercentage}
                disabled={disabled}
                onChange={(event) =>
                  update(index, { maxPercentage: Number(event.target.value) })
                }
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
              />
              <input
                aria-label={`Grade point ${index + 1}`}
                type="number"
                min={0}
                max={4}
                step="0.1"
                value={row.gradePoint}
                disabled={disabled}
                onChange={(event) =>
                  update(index, { gradePoint: Number(event.target.value) })
                }
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
              />
              <input
                aria-label={`Grade label ${index + 1}`}
                value={row.label}
                disabled={disabled}
                onChange={(event) => update(index, { label: event.target.value })}
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
              />
              <select
                aria-label={`Pass status ${index + 1}`}
                value={row.passed ? 'PASS' : 'FAIL'}
                disabled={disabled}
                onChange={(event) =>
                  update(index, { passed: event.target.value === 'PASS' })
                }
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
              >
                <option value="PASS">Pass</option>
                <option value="FAIL">Fail</option>
              </select>
              <button
                type="button"
                aria-label={`Remove grade band ${index + 1}`}
                disabled={disabled || rows.length <= 1}
                onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        className="mt-3"
        disabled={disabled}
        onClick={() =>
          onChange([
            ...rows,
            {
              grade: '',
              minPercentage: 0,
              maxPercentage: 0,
              gradePoint: 0,
              label: '',
              passed: false,
            },
          ])
        }
      >
        <Plus className="h-4 w-4" />
        Add grade band
      </Button>
    </fieldset>
  );
}

function toGradingBands(value: unknown, fallback: unknown): GradingBand[] {
  const source = Array.isArray(value)
    ? value
    : Array.isArray(fallback)
      ? fallback
      : [];
  return source.map((entry) => {
    const item =
      entry && typeof entry === 'object' && !Array.isArray(entry)
        ? (entry as Record<string, unknown>)
        : {};
    return {
      grade: String(item.grade ?? ''),
      minPercentage: Number(item.minPercentage ?? 0),
      maxPercentage: Number(item.maxPercentage ?? 0),
      gradePoint: Number(item.gradePoint ?? 0),
      label: String(item.label ?? ''),
      passed: Boolean(item.passed),
    };
  });
}

function buildPolicyForm(
  fields: SchoolSettingsPolicyField[],
  settings: TenantSettingSummary[],
) {
  return Object.fromEntries(
    fields.map((field) => {
      const saved = settings.find(
        (setting) => setting.key === field.key,
      )?.value;
      return [field.key, saved ?? defaultValue(field)];
    }),
  );
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
