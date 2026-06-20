'use client';

import type {
  AdmissionApplication,
  CreateAdmissionApplicationPayload,
} from '@schoolos/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ClipboardList, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../ui/button';
import { ErrorState } from '../ui/error-state';
import { SectionCard } from '../ui/section-card';
import { StatusBadge } from '../ui/status-badge';

const EMPTY_FORM: CreateAdmissionApplicationPayload = {
  firstNameEn: '',
  lastNameEn: '',
  firstNameNp: '',
  lastNameNp: '',
  dateOfBirth: '',
  gender: 'FEMALE',
  guardianFullName: '',
  guardianRelation: 'mother',
  guardianPhone: '',
  guardianEmail: '',
  academicYearId: '',
  classId: '',
  sectionId: '',
  previousSchool: '',
  source: '',
  notes: '',
};

export function AdmissionApplicationForm() {
  const queryClient = useQueryClient();
  const [form, setForm] =
    useState<CreateAdmissionApplicationPayload>(EMPTY_FORM);
  const [created, setCreated] = useState<AdmissionApplication | null>(null);
  const [validationError, setValidationError] = useState('');

  const academicYearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: api.listAcademicYears,
  });
  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: api.listClasses,
  });
  const sectionsQuery = useQuery({
    queryKey: ['sections'],
    queryFn: api.listSections,
  });

  const availableSections = useMemo(
    () =>
      (sectionsQuery.data ?? []).filter((section) => {
        const sectionClassId = section.classId ?? section.class?.id;
        return !form.classId || sectionClassId === form.classId;
      }),
    [form.classId, sectionsQuery.data],
  );

  const mutation = useMutation({
    mutationFn: (payload: CreateAdmissionApplicationPayload) =>
      api.createAdmissionApplication(payload),
    onSuccess: (application) => {
      setCreated(application);
      setValidationError('');
      void queryClient.invalidateQueries({
        queryKey: ['admission-applications'],
      });
    },
  });

  function update<K extends keyof CreateAdmissionApplicationPayload>(
    key: K,
    value: CreateAdmissionApplicationPayload[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError('');

    if (!form.firstNameEn.trim() || !form.lastNameEn.trim()) {
      setValidationError('Enter the student’s English first and last name.');
      return;
    }

    mutation.mutate(
      Object.fromEntries(
        Object.entries(form).filter(([, value]) => value !== ''),
      ) as CreateAdmissionApplicationPayload,
    );
  }

  if (
    academicYearsQuery.isError ||
    classesQuery.isError ||
    sectionsQuery.isError
  ) {
    return (
      <ErrorState
        title="Admission setup could not load"
        message="No application was created. Retry after academic setup is available."
        onRetry={() => {
          void academicYearsQuery.refetch();
          void classesQuery.refetch();
          void sectionsQuery.refetch();
        }}
      />
    );
  }

  if (created) {
    const duplicateCount = created.duplicateReview?.matches?.length ?? 0;
    return (
      <section className="rounded-2xl border border-success-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-success-50 text-success-700">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black text-slate-950">
                Application created
              </h2>
              <StatusBadge status={created.status} />
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {created.fullNameEn} is now in the persisted admission
              application workflow.
            </p>
            {duplicateCount > 0 ? (
              <p className="mt-3 rounded-xl border border-warning-200 bg-warning-50 p-3 text-sm font-semibold text-warning-800">
                Backend duplicate review found {duplicateCount} possible
                {duplicateCount === 1 ? ' match' : ' matches'}. Review before
                acceptance or enrollment.
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/dashboard/admissions"
                className="inline-flex min-h-11 items-center rounded-xl bg-[var(--color-mod-admissions-accent)] px-4 text-sm font-bold text-white hover:bg-[var(--color-mod-admissions-text)]"
              >
                Open admissions pipeline
              </Link>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setForm(EMPTY_FORM);
                  setCreated(null);
                  mutation.reset();
                }}
              >
                Create another application
              </Button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const setupLoading =
    academicYearsQuery.isLoading ||
    classesQuery.isLoading ||
    sectionsQuery.isLoading;

  return (
    <form className="space-y-5" onSubmit={submit}>
      <SectionCard
        title="Student and application details"
        description="Create an inquiry/application record first. Enrollment remains a separate audited backend transition."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="First name (English)" required>
            <input
              value={form.firstNameEn}
              onChange={(event) => update('firstNameEn', event.target.value)}
              autoComplete="given-name"
            />
          </Field>
          <Field label="Last name (English)" required>
            <input
              value={form.lastNameEn}
              onChange={(event) => update('lastNameEn', event.target.value)}
              autoComplete="family-name"
            />
          </Field>
          <Field label="First name (Nepali)">
            <input
              value={form.firstNameNp}
              onChange={(event) => update('firstNameNp', event.target.value)}
            />
          </Field>
          <Field label="Last name (Nepali)">
            <input
              value={form.lastNameNp}
              onChange={(event) => update('lastNameNp', event.target.value)}
            />
          </Field>
          <Field label="Date of birth">
            <input
              type="date"
              value={form.dateOfBirth}
              onChange={(event) => update('dateOfBirth', event.target.value)}
            />
          </Field>
          <Field label="Gender">
            <select
              value={form.gender}
              onChange={(event) => update('gender', event.target.value)}
            >
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>
          <Field label="Academic year">
            <select
              value={form.academicYearId}
              onChange={(event) =>
                update('academicYearId', event.target.value)
              }
              disabled={setupLoading}
            >
              <option value="">Not selected</option>
              {(academicYearsQuery.data ?? []).map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Requested class">
            <select
              value={form.classId}
              onChange={(event) => {
                update('classId', event.target.value);
                update('sectionId', '');
              }}
              disabled={setupLoading}
            >
              <option value="">Not selected</option>
              {(classesQuery.data ?? []).map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>
                  {schoolClass.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Requested section">
            <select
              value={form.sectionId}
              onChange={(event) => update('sectionId', event.target.value)}
              disabled={!form.classId || setupLoading}
            >
              <option value="">Not selected</option>
              {availableSections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Previous school">
            <input
              value={form.previousSchool}
              onChange={(event) => update('previousSchool', event.target.value)}
            />
          </Field>
          <Field label="Inquiry source">
            <input
              value={form.source}
              onChange={(event) => update('source', event.target.value)}
              placeholder="Walk-in, phone, website…"
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Guardian contact"
        description="Guardian fields support duplicate review and follow-up. Portal access is not created by this form."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Guardian name">
            <input
              value={form.guardianFullName}
              onChange={(event) =>
                update('guardianFullName', event.target.value)
              }
              autoComplete="name"
            />
          </Field>
          <Field label="Relationship">
            <input
              value={form.guardianRelation}
              onChange={(event) =>
                update('guardianRelation', event.target.value)
              }
            />
          </Field>
          <Field label="Guardian phone">
            <input
              value={form.guardianPhone}
              onChange={(event) => update('guardianPhone', event.target.value)}
              inputMode="tel"
              autoComplete="tel"
            />
          </Field>
          <Field label="Guardian email">
            <input
              type="email"
              value={form.guardianEmail}
              onChange={(event) => update('guardianEmail', event.target.value)}
              autoComplete="email"
            />
          </Field>
          <Field label="Review notes" className="md:col-span-2">
            <textarea
              rows={4}
              value={form.notes}
              onChange={(event) => update('notes', event.target.value)}
              placeholder="Record only information needed for the admission review."
            />
          </Field>
        </div>
      </SectionCard>

      {validationError ? (
        <p
          className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm font-semibold text-danger-800"
          role="alert"
        >
          {validationError}
        </p>
      ) : null}
      {mutation.isError ? (
        <p
          className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm font-semibold text-danger-800"
          role="alert"
        >
          {mutation.error instanceof Error
            ? mutation.error.message
            : 'Application could not be created.'}
        </p>
      ) : null}

      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
        <p className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <ClipboardList className="h-4 w-4" />
          Creates an inquiry; it does not enroll a student.
        </p>
        <div className="flex gap-2">
          <Link
            href="/dashboard/admissions"
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <Button type="submit" disabled={mutation.isPending || setupLoading}>
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Create application
          </Button>
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  required = false,
  className = '',
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block space-y-2 text-sm font-bold text-slate-700 ${className}`}>
      <span>
        {label}
        {required ? <span className="text-danger-600"> *</span> : null}
      </span>
      {children}
    </label>
  );
}
