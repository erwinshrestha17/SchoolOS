'use client';

import type { AdmissionCase, CreateAdmissionCasePayload } from '@schoolos/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, FileText, Loader2, ShieldCheck, UserRoundPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { api } from '../../lib/api';
import { admissionCasesApi } from '../../lib/api/admission-cases';
import { ApiRequestError } from '../../lib/api/client';
import { Button } from '../ui/button';
import { ErrorState } from '../ui/error-state';
import { SectionCard } from '../ui/section-card';

const EMPTY_FORM: CreateAdmissionCasePayload = {
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
  guardianReceivesAlerts: true,
  academicYearId: '',
  classId: '',
  sectionId: '',
  source: 'OFFICE_WALK_IN',
  transferStudent: false,
  previousSchool: '',
  notes: '',
  admissionDate: new Date().toISOString().slice(0, 10),
  mediumOfInstruction: 'English',
};

const STEPS = ['Student & guardian', 'Class & documents', 'Review & admit'];

export function AdmissionCaseWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<CreateAdmissionCasePayload>(EMPTY_FORM);
  const [caseData, setCaseData] = useState<AdmissionCase | null>(null);
  const [localError, setLocalError] = useState('');

  const academicYearsQuery = useQuery({ queryKey: ['academic-years'], queryFn: api.listAcademicYears });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: api.listClasses });
  const sectionsQuery = useQuery({ queryKey: ['sections'], queryFn: api.listSections });

  const availableSections = useMemo(
    () =>
      (sectionsQuery.data ?? []).filter((section) => {
        const sectionClassId = section.classId ?? section.class?.id;
        return !form.classId || sectionClassId === form.classId;
      }),
    [form.classId, sectionsQuery.data],
  );

  const createCaseMutation = useMutation({
    mutationFn: admissionCasesApi.createCase,
    onSuccess: (created) => {
      setCaseData(created);
      setLocalError('');
    },
  });

  const directAdmitMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CreateAdmissionCasePayload }) =>
      admissionCasesApi.directAdmit(id, payload),
    onSuccess: (result) => {
      router.push(result.redirectPath);
    },
  });

  const setupError = academicYearsQuery.isError || classesQuery.isError || sectionsQuery.isError;
  const setupLoading = academicYearsQuery.isLoading || classesQuery.isLoading || sectionsQuery.isLoading;

  function update<K extends keyof CreateAdmissionCasePayload>(key: K, value: CreateAdmissionCasePayload[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setCaseData(null);
  }

  function payload(): CreateAdmissionCasePayload {
    return Object.fromEntries(
      Object.entries(form).filter(([, value]) => value !== '' && value !== undefined),
    ) as CreateAdmissionCasePayload;
  }

  function validateCurrentStep() {
    if (step === 0) {
      if (!form.firstNameEn.trim() || !form.lastNameEn.trim()) return 'Enter the student’s English first and last name.';
      if (!form.dateOfBirth) return 'Enter the student’s date of birth.';
      if (!form.guardianFullName?.trim() || !form.guardianRelation?.trim() || !form.guardianPhone?.trim()) {
        return 'Enter the guardian name, relationship, and phone number.';
      }
    }
    if (step === 1) {
      if (!form.academicYearId || !form.classId || !form.admissionDate) return 'Choose the academic year, class, and admission date.';
      if (availableSections.length > 0 && !form.sectionId) return 'Choose a section for this class.';
    }
    return '';
  }

  function continueStep(event?: FormEvent) {
    event?.preventDefault();
    const message = validateCurrentStep();
    if (message) {
      setLocalError(message);
      return;
    }
    setLocalError('');
    setStep((current) => Math.min(2, current + 1));
  }

  function prepareReview() {
    const message = validateCurrentStep();
    if (message) {
      setLocalError(message);
      return;
    }
    createCaseMutation.mutate(payload());
  }

  if (setupError) {
    return (
      <ErrorState
        title="Admission setup could not load"
        message="No admission case was created. Check academic setup and try again."
        onRetry={() => {
          void academicYearsQuery.refetch();
          void classesQuery.refetch();
          void sectionsQuery.refetch();
        }}
      />
    );
  }

  if (directAdmitMutation.isSuccess) {
    return null;
  }

  const error = localError || readError(createCaseMutation.error) || readError(directAdmitMutation.error);
  const requiresReview = caseData?.requiresReview && caseData.displayStatus !== 'APPROVED';
  const canAdmit = caseData?.canAdmitDirectly && !requiresReview;

  return (
    <form className="space-y-5" onSubmit={(event) => event.preventDefault()}>
      <ol className="grid gap-2 sm:grid-cols-3" aria-label="Admission steps">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={`flex items-center gap-3 rounded-xl border p-3 text-sm font-bold ${index === step ? 'border-[var(--color-mod-admissions-accent)] bg-blue-50 text-slate-900' : index < step ? 'border-success-200 bg-success-50 text-success-800' : 'border-slate-200 bg-white text-slate-500'}`}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full border bg-white text-xs">{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <SectionCard title="Student and guardian" description="Start with the information the school office needs for a normal admission.">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="First name (English)" required><input value={form.firstNameEn} onChange={(event) => update('firstNameEn', event.target.value)} autoComplete="given-name" /></Field>
            <Field label="Last name (English)" required><input value={form.lastNameEn} onChange={(event) => update('lastNameEn', event.target.value)} autoComplete="family-name" /></Field>
            <Field label="First name (Nepali)"><input value={form.firstNameNp ?? ''} onChange={(event) => update('firstNameNp', event.target.value)} /></Field>
            <Field label="Last name (Nepali)"><input value={form.lastNameNp ?? ''} onChange={(event) => update('lastNameNp', event.target.value)} /></Field>
            <Field label="Date of birth" required><input type="date" value={form.dateOfBirth ?? ''} onChange={(event) => update('dateOfBirth', event.target.value)} /></Field>
            <Field label="Gender" required>
              <select value={form.gender} onChange={(event) => update('gender', event.target.value as CreateAdmissionCasePayload['gender'])}>
                <option value="FEMALE">Female</option><option value="MALE">Male</option><option value="OTHER">Other</option>
              </select>
            </Field>
            <Field label="Guardian full name" required><input value={form.guardianFullName ?? ''} onChange={(event) => update('guardianFullName', event.target.value)} autoComplete="name" /></Field>
            <Field label="Relationship" required><input value={form.guardianRelation ?? ''} onChange={(event) => update('guardianRelation', event.target.value)} /></Field>
            <Field label="Guardian phone" required><input value={form.guardianPhone ?? ''} onChange={(event) => update('guardianPhone', event.target.value)} inputMode="tel" autoComplete="tel" /></Field>
            <Field label="Guardian email"><input type="email" value={form.guardianEmail ?? ''} onChange={(event) => update('guardianEmail', event.target.value)} autoComplete="email" /></Field>
          </div>
        </SectionCard>
      ) : null}

      {step === 1 ? (
        <SectionCard title="Class and documents" description="Choose the student’s placement. Documents can be linked now when uploaded through the protected file flow, or added later from the student profile.">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Academic year" required>
              <select value={form.academicYearId ?? ''} disabled={setupLoading} onChange={(event) => update('academicYearId', event.target.value)}>
                <option value="">Select academic year</option>
                {(academicYearsQuery.data ?? []).map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
              </select>
            </Field>
            <Field label="Class" required>
              <select value={form.classId ?? ''} disabled={setupLoading} onChange={(event) => { update('classId', event.target.value); update('sectionId', ''); }}>
                <option value="">Select class</option>
                {(classesQuery.data ?? []).map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}
              </select>
            </Field>
            <Field label="Section">
              <select value={form.sectionId ?? ''} disabled={!form.classId || setupLoading} onChange={(event) => update('sectionId', event.target.value)}>
                <option value="">Select section</option>
                {availableSections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
              </select>
            </Field>
            <Field label="Admission date" required><input type="date" value={form.admissionDate ?? ''} onChange={(event) => update('admissionDate', event.target.value)} /></Field>
            <Field label="Admission source">
              <select value={form.source} onChange={(event) => update('source', event.target.value as CreateAdmissionCasePayload['source'])}>
                <option value="OFFICE_WALK_IN">Office / walk-in</option><option value="PARENT_ONLINE">Parent online application</option><option value="PHONE_INQUIRY">Phone inquiry</option><option value="TRANSFER_REQUEST">Transfer request</option><option value="IMPORT">Import</option>
              </select>
            </Field>
            <Field label="Previous school"><input value={form.previousSchool ?? ''} onChange={(event) => update('previousSchool', event.target.value)} /></Field>
            <Field label="Medium of instruction"><input value={form.mediumOfInstruction ?? ''} onChange={(event) => update('mediumOfInstruction', event.target.value)} /></Field>
            <Field label="Roll number"><input inputMode="numeric" value={form.rollNumber ?? ''} onChange={(event) => update('rollNumber', event.target.value ? Number(event.target.value) : undefined)} /></Field>
            <Field label="Office notes" className="md:col-span-2"><textarea rows={3} value={form.notes ?? ''} onChange={(event) => update('notes', event.target.value)} placeholder="Only record information needed for admission." /></Field>
          </div>
          <div className="mt-5 flex gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"><FileText className="mt-0.5 h-5 w-5 shrink-0" /><p><strong>Documents are not a payment step.</strong> Required document checks are shown on the next step. Missing permitted documents become follow-up work after admission.</p></div>
        </SectionCard>
      ) : null}

      {step === 2 ? (
        <div className="space-y-5">
          <SectionCard title="Review and admit" description="SchoolOS checks placement, policy requirements, and possible duplicates before it creates a student.">
            <div className="grid gap-4 md:grid-cols-3">
              <Summary label="Student" value={`${form.firstNameEn} ${form.lastNameEn}`.trim()} />
              <Summary label="Guardian" value={`${form.guardianFullName ?? ''} · ${form.guardianPhone ?? ''}`.trim()} />
              <Summary label="Placement" value={`${(academicYearsQuery.data ?? []).find((year) => year.id === form.academicYearId)?.name ?? 'Academic year'} · ${(classesQuery.data ?? []).find((schoolClass) => schoolClass.id === form.classId)?.name ?? 'Class'}${availableSections.find((section) => section.id === form.sectionId) ? ` · ${availableSections.find((section) => section.id === form.sectionId)?.name}` : ''}`} />
            </div>
          </SectionCard>

          {caseData ? <EligibilityPanel admissionCase={caseData} /> : null}
          {requiresReview ? (
            <SectionCard title="Admission review required" description="This class or admission type needs review before the student can be admitted.">
              <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">The details are saved once. Continue to the review queue without re-entering the student or guardian information.</p><Button type="button" onClick={() => router.push(`/dashboard/admissions?admissionCaseId=${caseData?.id ?? ''}`)}>Open review queue</Button></div>
            </SectionCard>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm font-semibold text-danger-800" role="alert">{error}</p> : null}

      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
        <p className="flex items-center gap-2 text-xs font-semibold text-slate-500"><ShieldCheck className="h-4 w-4" />Student records are created only after the backend confirms the admission.</p>
        <div className="flex flex-wrap gap-2">
          {step > 0 ? <Button type="button" variant="outline" onClick={() => { setLocalError(''); setStep((current) => current - 1); }}><ChevronLeft className="h-4 w-4" />Back</Button> : <Link className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50" href="/dashboard/admissions">Cancel</Link>}
          {step < 2 ? <Button type="button" onClick={() => continueStep()}><ChevronRight className="h-4 w-4" />Continue</Button> : !caseData ? <Button type="button" disabled={createCaseMutation.isPending} onClick={prepareReview}>{createCaseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRoundPlus className="h-4 w-4" />}Check admission</Button> : canAdmit ? <Button type="button" disabled={directAdmitMutation.isPending} onClick={() => directAdmitMutation.mutate({ id: caseData.id, payload: payload() })}>{directAdmitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Admit student</Button> : null}
        </div>
      </div>
    </form>
  );
}

function EligibilityPanel({ admissionCase }: { admissionCase: AdmissionCase }) {
  const blocked = admissionCase.missingRequiredFields.length > 0 || admissionCase.missingRequiredDocuments.length > 0;
  return (
    <SectionCard title="Admission check" description={admissionCase.nextActionLabel}>
      <div className="space-y-3 text-sm">
        {blocked ? <Issue title="Information needed" items={[...admissionCase.missingRequiredFields, ...admissionCase.missingRequiredDocuments]} /> : null}
        {admissionCase.duplicateRisk ? <Issue title="Possible duplicate" items={admissionCase.duplicateCandidates.map((candidate) => `${candidate.fullNameEn} · ${candidate.className}${candidate.sectionName ? ` ${candidate.sectionName}` : ''}`)} warning /> : null}
        {admissionCase.requiresReview ? <Issue title="Policy review" items={[admissionCase.requiresApproval ? 'Principal approval is required.' : 'This case needs the school’s admission review.']} warning /> : null}
        {!blocked && !admissionCase.duplicateRisk && !admissionCase.requiresReview ? <div className="flex items-center gap-2 rounded-xl border border-success-200 bg-success-50 p-3 font-semibold text-success-800"><CheckCircle2 className="h-5 w-5" />Ready to admit. Optional documents and IEMIS details will remain as follow-up items.</div> : null}
      </div>
    </SectionCard>
  );
}

function Issue({ title, items, warning = false }: { title: string; items: string[]; warning?: boolean }) {
  return <div className={`rounded-xl border p-3 ${warning ? 'border-warning-200 bg-warning-50 text-warning-900' : 'border-danger-200 bg-danger-50 text-danger-900'}`}><div className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" />{title}</div><ul className="mt-2 list-disc space-y-1 pl-5">{items.map((item) => <li key={item}>{humanize(item)}</li>)}</ul></div>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-900">{value || 'Not provided'}</p></div>;
}

function Field({ label, required = false, className = '', children }: { label: string; required?: boolean; className?: string; children: ReactNode }) {
  return <label className={`block space-y-2 text-sm font-bold text-slate-700 ${className}`}><span>{label}{required ? <span className="text-danger-600"> *</span> : null}</span>{children}</label>;
}

function humanize(value: string) {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function readError(error: unknown) {
  if (!error) return '';
  if (error instanceof ApiRequestError) return error.message;
  return error instanceof Error ? error.message : 'The admission could not be completed. Please try again.';
}
