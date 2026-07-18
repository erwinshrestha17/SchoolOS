'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Save } from 'lucide-react';
import {
  formatBsDateTime,
  isValidEmail,
  isValidPersonName,
  normalizeEmail,
  normalizeNepalPhone,
  normalizePersonName,
  tryNormalizeNepalPhone,
  type SchoolProfileSettings,
  type UpdateSchoolProfilePayload,
} from '@schoolos/core';
import { SchoolSettingsPageHeader } from './settings-page-header';
import { Button } from '../ui/button';
import { ErrorState } from '../ui/error-state';
import { schoolSettingsApi } from '../../lib/api/school-settings';

type ProfileForm = Omit<SchoolProfileSettings, 'updatedAt'>;
const emptyProfile: ProfileForm = {
  schoolName: null,
  schoolAddress: null,
  schoolPhone: null,
  schoolEmail: null,
  schoolPanNumber: null,
  principalName: null,
  municipality: null,
  wardNumber: null,
  district: null,
  province: null,
  schoolType: null,
  iemisSchoolCode: null,
};

export function SchoolProfileWorkspace() {
  const client = useQueryClient();
  const profileQuery = useQuery({
    queryKey: ['school-settings', 'school-profile'],
    queryFn: schoolSettingsApi.getSchoolProfile,
  });
  const [form, setForm] = useState<ProfileForm>(emptyProfile);
  const [notice, setNotice] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  useEffect(() => {
    if (profileQuery.data) setForm(withoutUpdatedAt(profileQuery.data));
  }, [profileQuery.data]);
  const changed = useMemo(
    () =>
      profileQuery.data
        ? JSON.stringify(form) !==
          JSON.stringify(withoutUpdatedAt(profileQuery.data))
        : false,
    [form, profileQuery.data],
  );
  const updateMutation = useMutation({
    mutationFn: schoolSettingsApi.updateSchoolProfile,
    onSuccess: async (profile) => {
      client.setQueryData(['school-settings', 'school-profile'], profile);
      await client.invalidateQueries({
        queryKey: ['school-settings', 'overview'],
      });
      setNotice('School profile saved.');
    },
  });

  if (profileQuery.isLoading)
    return (
      <div className="space-y-4 p-6">
        <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-[520px] animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  if (profileQuery.isError || !profileQuery.data)
    return (
      <ErrorState
        error={profileQuery.error}
        onRetry={() => void profileQuery.refetch()}
      />
    );

  const profile = profileQuery.data;
  const setValue = <K extends keyof ProfileForm>(
    key: K,
    value: ProfileForm[K],
  ) => setForm((current) => ({ ...current, [key]: value }));
  const save = () => {
    setValidationError(null);
    if (form.principalName && !isValidPersonName(form.principalName)) {
      setValidationError('Enter a valid principal name.');
      return;
    }
    if (form.schoolPhone && !tryNormalizeNepalPhone(form.schoolPhone)) {
      setValidationError('Enter a valid NTC or Ncell contact number.');
      return;
    }
    if (form.schoolEmail && !isValidEmail(form.schoolEmail)) {
      setValidationError('Enter a valid contact email address.');
      return;
    }
    const normalized = {
      ...form,
      principalName: form.principalName
        ? normalizePersonName(form.principalName)
        : form.principalName,
      schoolPhone: form.schoolPhone
        ? normalizeNepalPhone(form.schoolPhone)
        : form.schoolPhone,
      schoolEmail: form.schoolEmail
        ? normalizeEmail(form.schoolEmail)
        : form.schoolEmail,
    };
    const payload = changedPayload(normalized, withoutUpdatedAt(profile));
    if (Object.keys(payload).length) updateMutation.mutate(payload);
  };

  return (
    <div className="space-y-6 p-6 pb-28">
      <SchoolSettingsPageHeader
        title="Identity & general"
        description="Official school information used in records, receipts, certificates, and reports."
        access="can-manage"
      />
      <section className="rounded-2xl border border-sky-100 bg-sky-50 p-5 text-sm text-sky-900">
        <p className="font-bold">SchoolOS Nepal operating standard</p>
        <p className="mt-1">
          School time uses Asia/Kathmandu, operational dates use Bikram Sambat,
          and school currency is NPR. These standards are enforced and are not
          changed here.
        </p>
      </section>
      {notice ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          {notice}
        </div>
      ) : null}
      {validationError ? (
        <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm font-semibold text-danger-800">
          {validationError}
        </div>
      ) : null}
      {updateMutation.isError ? (
        <ErrorState
          title="Could not save the school profile"
          error={updateMutation.error}
          onRetry={save}
          className="min-h-[180px]"
        />
      ) : null}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <Section
          title="Official identity"
          description="Legal school information. Changes are audited."
        >
          <TextField
            label="School name"
            value={form.schoolName ?? ''}
            onChange={(value) => setValue('schoolName', value)}
            required
          />
          <SelectField
            label="School type"
            value={form.schoolType ?? ''}
            onChange={(value) => setValue('schoolType', parseSchoolType(value))}
            options={[
              ['', 'Select school type'],
              ['PRIVATE', 'Private / Institutional'],
              ['COMMUNITY', 'Community / Government'],
              ['TRUST', 'Public Trust'],
            ]}
          />
          <TextField
            label="PAN / registration number"
            value={form.schoolPanNumber ?? ''}
            onChange={(value) => setValue('schoolPanNumber', value)}
          />
          <TextField
            label="iEMIS school code"
            value={form.iemisSchoolCode ?? ''}
            onChange={(value) => setValue('iemisSchoolCode', value)}
          />
          <TextField
            label="Principal name"
            value={form.principalName ?? ''}
            onChange={(value) => setValue('principalName', value)}
            required
          />
        </Section>
        <Section
          title="Contact & location"
          description="Use the official contact information parents and staff should rely on."
        >
          <TextField
            label="School address"
            value={form.schoolAddress ?? ''}
            onChange={(value) => setValue('schoolAddress', value)}
            required
            className="md:col-span-2"
          />
          <TextField
            label="Contact phone"
            value={form.schoolPhone ?? ''}
            onChange={(value) => setValue('schoolPhone', value)}
            required
          />
          <TextField
            label="Contact email"
            type="email"
            value={form.schoolEmail ?? ''}
            onChange={(value) => setValue('schoolEmail', value)}
            required
          />
          <TextField
            label="Municipality"
            value={form.municipality ?? ''}
            onChange={(value) => setValue('municipality', value)}
          />
          <TextField
            label="Ward number"
            type="number"
            value={form.wardNumber?.toString() ?? ''}
            onChange={(value) =>
              setValue('wardNumber', value ? Number(value) : null)
            }
          />
          <TextField
            label="District"
            value={form.district ?? ''}
            onChange={(value) => setValue('district', value)}
          />
          <TextField
            label="Province"
            value={form.province ?? ''}
            onChange={(value) => setValue('province', value)}
          />
        </Section>
      </section>
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
        <p className="font-bold">
          Additional school profile preferences are not editable yet
        </p>
        <p className="mt-1 leading-6">
          Short name, language preference, office hours, offered school levels,
          and expanded principal or owner details need a tenant-scoped backend
          contract before they can be saved here. Timezone remains fixed to
          Asia/Kathmandu by the current SchoolOS Nepal operating standard.
        </p>
        <p className="sr-only">needs API contract</p>
      </section>
      <p className="text-xs text-slate-500">
        Last updated:{' '}
        {profile.updatedAt
          ? formatBsDateTime(profile.updatedAt)
          : 'Not yet configured'}
      </p>
      {changed ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-6 py-4 shadow-lg backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <p className="text-sm font-semibold text-slate-700">
              You have unsaved school profile changes.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setForm(withoutUpdatedAt(profile))}
              >
                Discard
              </Button>
              <Button onClick={save} disabled={updateMutation.isPending}>
                <Save className="h-4 w-4" />
                {updateMutation.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function withoutUpdatedAt(profile: SchoolProfileSettings): ProfileForm {
  const { updatedAt: _updatedAt, ...form } = profile;
  return form;
}
function changedPayload(
  next: ProfileForm,
  previous: ProfileForm,
): UpdateSchoolProfilePayload {
  return Object.fromEntries(
    Object.entries(next).filter(
      ([key, value]) => value !== previous[key as keyof ProfileForm],
    ),
  ) as UpdateSchoolProfilePayload;
}
function parseSchoolType(value: string): ProfileForm['schoolType'] {
  return value === 'PRIVATE' || value === 'COMMUNITY' || value === 'TRUST'
    ? value
    : null;
}
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-slate-100 p-6 last:border-b-0">
      <h2 className="font-bold text-slate-950">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">{children}</div>
    </div>
  );
}
function TextField({
  label,
  value,
  onChange,
  required,
  type = 'text',
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="text-sm font-semibold text-slate-700">
        {label}
        {required ? <span className="text-rose-600"> *</span> : null}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5"
      />
    </label>
  );
}
function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label>
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
