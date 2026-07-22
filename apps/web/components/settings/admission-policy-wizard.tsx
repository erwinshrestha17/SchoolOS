'use client';

import type { AdmissionPolicyApplicantType, AdmissionPolicyDetail, AdmissionPolicyRequiredField, AdmissionPolicyTemplate } from '@schoolos/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { admissionPoliciesApi } from '../../lib/api/admission-policies';
import { ErrorState } from '../ui/error-state';
import { SectionCard } from '../ui/section-card';
import { Button } from '../ui/button';
import { ApprovalChainBuilder } from './approval-chain-builder';
import { DocumentChecklistBuilder } from './document-checklist-builder';

const STEPS = ['Basic Information', 'Who Can Apply', 'Required Information', 'Required Documents', 'Assessment & Decision', 'Review & Activate'];

const REQUIRED_FIELD_OPTIONS = [
  { value: 'previousSchool', label: 'Previous school' },
  { value: 'guardianEmail', label: 'Guardian email' },
  { value: 'nationalStudentId', label: 'IEMIS student ID' },
  { value: 'emergencyName', label: 'Emergency contact name' },
  { value: 'emergencyPhone', label: 'Emergency contact phone' },
] satisfies ReadonlyArray<{
  value: AdmissionPolicyRequiredField;
  label: string;
}>;

export function AdmissionPolicyWizard({ policyId: initialPolicyId }: { policyId?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [policyId, setPolicyId] = useState<string | null>(initialPolicyId ?? null);
  const [name, setName] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [classId, setClassId] = useState('');
  const [gradeBand, setGradeBand] = useState('');
  const [applicantType, setApplicantType] = useState<AdmissionPolicyApplicantType>('BOTH');
  const [source, setSource] = useState('');
  const [requiredFields, setRequiredFields] = useState<AdmissionPolicyRequiredField[]>([]);
  const [requireSection, setRequireSection] = useState(false);
  const [admissionMode, setAdmissionMode] = useState<'DIRECT_ALLOWED' | 'REVIEW_REQUIRED'>('DIRECT_ALLOWED');
  const [requireDocumentReview, setRequireDocumentReview] = useState(false);
  const [requireInterview, setRequireInterview] = useState(false);
  const [requirePrincipalApproval, setRequirePrincipalApproval] = useState(false);
  const [requireTransferCertificate, setRequireTransferCertificate] = useState(false);
  const [requirePriorMarksheet, setRequirePriorMarksheet] = useState(false);
  const [requireStreamOrMarksReview, setRequireStreamOrMarksReview] = useState(false);
  const [allowAdmissionWithDocumentsPending, setAllowAdmissionWithDocumentsPending] = useState(true);
  const [enforceCapacityWhenAvailable, setEnforceCapacityWhenAvailable] = useState(false);
  const [notesForOffice, setNotesForOffice] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [localError, setLocalError] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<AdmissionPolicyTemplate['id'] | null>(null);

  const academicYearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: api.listAcademicYears,
  });
  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: api.listClasses,
  });
  const templatesQuery = useQuery({
    queryKey: ['admission-policy-templates'],
    queryFn: admissionPoliciesApi.listTemplates,
    enabled: !initialPolicyId && !policyId,
  });
  const policyQuery = useQuery({
    queryKey: ['admission-policy', policyId],
    queryFn: () => admissionPoliciesApi.get(policyId!),
    enabled: Boolean(policyId),
  });

  const hydrateFrom = (detail: AdmissionPolicyDetail) => {
    setName(detail.name);
    setAcademicYearId(detail.academicYearId ?? '');
    setClassId(detail.classId ?? '');
    setGradeBand(detail.gradeBand ?? '');
    setApplicantType(detail.applicantType);
    setSource(detail.source ?? '');
    const version = detail.draftVersion ?? detail.currentVersion;
    if (version) {
      setRequiredFields(version.requiredFields);
      setRequireSection(version.requireSection);
      setAdmissionMode(version.admissionMode);
      setRequireDocumentReview(version.requireDocumentReview);
      setRequireInterview(version.requireInterview);
      setRequirePrincipalApproval(version.requirePrincipalApproval);
      setRequireTransferCertificate(version.requireTransferCertificate);
      setRequirePriorMarksheet(version.requirePriorMarksheet);
      setRequireStreamOrMarksReview(version.requireStreamOrMarksReview);
      setAllowAdmissionWithDocumentsPending(version.allowAdmissionWithDocumentsPending);
      setEnforceCapacityWhenAvailable(version.enforceCapacityWhenAvailable);
      setNotesForOffice(version.notesForOffice ?? '');
    }
  };

  useEffect(() => {
    if (hydrated || !policyQuery.data) return;
    hydrateFrom(policyQuery.data);
    setHydrated(true);
  }, [policyQuery.data, hydrated]);

  const startDraftMutation = useMutation({
    mutationFn: () => admissionPoliciesApi.startDraftVersion(policyId!),
    onSuccess: (detail) => {
      hydrateFrom(detail);
      queryClient.setQueryData(['admission-policy', policyId], detail);
      void queryClient.invalidateQueries({
        queryKey: ['admission-policy', policyId],
      });
    },
  });

  useEffect(() => {
    if (initialPolicyId && hydrated && policyQuery.data && !policyQuery.data.draftVersion) {
      startDraftMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPolicyId, hydrated, policyQuery.data]);

  const createMutation = useMutation({
    mutationFn: () =>
      admissionPoliciesApi.create({
        name: name.trim(),
        academicYearId: academicYearId || undefined,
        classId: classId || undefined,
        gradeBand: gradeBand || undefined,
        applicantType,
        source: source || undefined,
        templateId: selectedTemplateId ?? undefined,
      }),
    onSuccess: (detail) => {
      setPolicyId(detail.id);
      void queryClient.invalidateQueries({
        queryKey: ['admission-policy', detail.id],
      });
      router.replace(`/dashboard/settings/admissions/${detail.id}/edit`);
    },
  });

  function applyTemplate(template: AdmissionPolicyTemplate) {
    setSelectedTemplateId(template.id);
    if (!name.trim()) setName(template.label);
    setGradeBand(template.gradeBand ?? '');
    setApplicantType(template.applicantType);
    setRequiredFields([...template.version.requiredFields]);
    setRequireSection(template.version.requireSection);
    setAdmissionMode(template.version.admissionMode);
    setRequireDocumentReview(template.version.requireDocumentReview);
    setRequireInterview(template.version.requireInterview);
    setRequirePrincipalApproval(template.version.requirePrincipalApproval);
    setRequireTransferCertificate(template.version.requireTransferCertificate);
    setRequirePriorMarksheet(template.version.requirePriorMarksheet);
    setRequireStreamOrMarksReview(template.version.requireStreamOrMarksReview);
    setAllowAdmissionWithDocumentsPending(template.version.allowAdmissionWithDocumentsPending);
    setEnforceCapacityWhenAvailable(template.version.enforceCapacityWhenAvailable);
    setNotesForOffice(template.version.notesForOffice ?? '');
  }

  function clearTemplate() {
    setSelectedTemplateId(null);
    setGradeBand('');
    setApplicantType('BOTH');
    setRequiredFields([]);
    setRequireSection(false);
    setAdmissionMode('DIRECT_ALLOWED');
    setRequireDocumentReview(false);
    setRequireInterview(false);
    setRequirePrincipalApproval(false);
    setRequireTransferCertificate(false);
    setRequirePriorMarksheet(false);
    setRequireStreamOrMarksReview(false);
    setAllowAdmissionWithDocumentsPending(true);
    setEnforceCapacityWhenAvailable(false);
    setNotesForOffice('');
  }

  const updateIdentityMutation = useMutation({
    mutationFn: () =>
      admissionPoliciesApi.updateIdentity(policyId!, {
        name: name.trim(),
        academicYearId: academicYearId || undefined,
        classId: classId || undefined,
        gradeBand: gradeBand || undefined,
        applicantType,
        source: source || undefined,
      }),
  });

  const updateVersionMutation = useMutation({
    mutationFn: () =>
      admissionPoliciesApi.updateDraftVersion(policyId!, {
        requiredFields,
        requireSection,
        admissionMode,
        requireDocumentReview,
        requireInterview,
        requirePrincipalApproval,
        requireTransferCertificate,
        requirePriorMarksheet,
        requireStreamOrMarksReview,
        allowAdmissionWithDocumentsPending,
        enforceCapacityWhenAvailable,
        notesForOffice: notesForOffice || undefined,
      }),
  });

  const activateMutation = useMutation({
    mutationFn: () => {
      const versionId = policyQuery.data?.draftVersion?.id;
      if (!versionId) throw new Error('No draft version to activate.');
      return admissionPoliciesApi.activate(policyId!, versionId);
    },
    onSuccess: () => router.push(`/dashboard/settings/admissions/${policyId}`),
  });

  const setupLoading = academicYearsQuery.isLoading || classesQuery.isLoading || templatesQuery.isLoading || (Boolean(policyId) && policyQuery.isLoading) || startDraftMutation.isPending;
  const setupError = academicYearsQuery.isError || classesQuery.isError || templatesQuery.isError || policyQuery.isError || startDraftMutation.isError;

  if (setupLoading) {
    return (
      <div className="flex min-h-48 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-600">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading admission policy…
      </div>
    );
  }

  if (setupError) {
    return (
      <ErrorState
        title="Admission policy could not load"
        message="Retry to continue building this policy."
        onRetry={() => {
          void academicYearsQuery.refetch();
          void classesQuery.refetch();
          void templatesQuery.refetch();
          void policyQuery.refetch();
          if (startDraftMutation.isError) {
            startDraftMutation.reset();
            startDraftMutation.mutate();
          }
        }}
      />
    );
  }

  async function continueStep() {
    setLocalError('');
    try {
      if (step === 0) {
        if (!name.trim()) {
          setLocalError('Enter a policy name.');
          return;
        }
        if (!policyId) {
          await createMutation.mutateAsync();
          setStep(1);
          return;
        }
        await updateIdentityMutation.mutateAsync();
      } else if (step === 1) {
        await updateIdentityMutation.mutateAsync();
      } else if (step === 2 || step === 4) {
        await updateVersionMutation.mutateAsync();
      }
      setStep((current) => Math.min(STEPS.length - 1, current + 1));
    } catch {
      // Mutation error surfaces below without losing form state.
    }
  }

  const draftVersion = policyQuery.data?.draftVersion ?? null;
  const documentRequirements = draftVersion?.documentRequirements ?? [];
  const mutationError = createMutation.error || updateIdentityMutation.error || updateVersionMutation.error || activateMutation.error;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-black text-slate-950">
          Step {step + 1} of {STEPS.length}
        </p>
        <p className="mt-1 text-sm text-slate-600">{STEPS[step]}</p>
      </div>
      <ol className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6" aria-label="Admission policy steps">
        {STEPS.map((label, index) => (
          <li key={label} aria-current={index === step ? 'step' : undefined} className={`flex items-center gap-2 rounded-xl border p-3 text-xs font-bold ${index === step ? 'border-[var(--color-mod-admissions-accent)] bg-blue-50 text-slate-900' : index < step ? 'border-success-200 bg-success-50 text-success-800' : 'border-slate-200 bg-white text-slate-500'}`}>
            <span className="flex h-6 w-6 items-center justify-center rounded-full border bg-white text-[0.65rem]">{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      {localError || mutationError ? <p className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm font-semibold text-danger-800">{localError || 'This step could not be saved. Please try again.'}</p> : null}

      {step === 0 ? (
        <div className="space-y-5">
          {!initialPolicyId && !policyId ? (
            <SectionCard title="Start from a template" description="Pick the closest match to pre-fill scope, documents, and decision defaults. Every field stays editable in the steps that follow.">
              <div className="grid gap-3 sm:grid-cols-2">
                {(templatesQuery.data ?? []).map((template) => (
                  <button key={template.id} type="button" onClick={() => applyTemplate(template)} className={`rounded-xl border p-4 text-left transition ${selectedTemplateId === template.id ? 'border-[var(--color-mod-admissions-accent)] bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                    <p className="font-bold text-slate-900">{template.label}</p>
                    <p className="mt-1 text-xs text-slate-500">{template.description}</p>
                  </button>
                ))}
                <button type="button" onClick={clearTemplate} className={`rounded-xl border p-4 text-left transition ${selectedTemplateId === null ? 'border-[var(--color-mod-admissions-accent)] bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                  <p className="font-bold text-slate-900">Blank Policy</p>
                  <p className="mt-1 text-xs text-slate-500">Start with no defaults and configure every step yourself.</p>
                </button>
              </div>
            </SectionCard>
          ) : null}

          <SectionCard title="Policy name" description="Give staff a plain-language name for this policy, e.g. Grade 1 Admission 2083.">
            <label className="block space-y-2 text-sm font-bold text-slate-700">
              <span>Policy name</span>
              <input className="block w-full max-w-lg rounded-lg border border-slate-200 px-3 py-2 text-sm" value={name} onChange={(event) => setName(event.target.value)} placeholder="Grade 11 Science Admission 2083" />
            </label>
          </SectionCard>
        </div>
      ) : null}

      {step === 1 ? (
        <SectionCard title="Who can apply" description="Scope this policy to a class, year, or applicant type. Leave a field blank to apply more broadly.">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2 text-sm font-bold text-slate-700">
              <span>Academic year</span>
              <select className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={academicYearId} onChange={(event) => setAcademicYearId(event.target.value)}>
                <option value="">Any academic year</option>
                {(academicYearsQuery.data ?? []).map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2 text-sm font-bold text-slate-700">
              <span>Class</span>
              <select className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={classId} onChange={(event) => setClassId(event.target.value)}>
                <option value="">Any class</option>
                {(classesQuery.data ?? []).map((schoolClass) => (
                  <option key={schoolClass.id} value={schoolClass.id}>
                    {schoolClass.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2 text-sm font-bold text-slate-700">
              <span>Grade band</span>
              <select className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={gradeBand} onChange={(event) => setGradeBand(event.target.value)}>
                <option value="">Any grade band</option>
                <option value="PRIMARY">Primary (Grades 1-5)</option>
                <option value="BASIC_SECONDARY">Grades 6-10</option>
                <option value="GRADE_11_12">Grades 11-12</option>
              </select>
            </label>
            <label className="block space-y-2 text-sm font-bold text-slate-700">
              <span>Applicant type</span>
              <select className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={applicantType} onChange={(event) => setApplicantType(event.target.value as AdmissionPolicyApplicantType)}>
                <option value="BOTH">New admission and transfer</option>
                <option value="NEW">New admission only</option>
                <option value="TRANSFER">Transfer only</option>
              </select>
            </label>
            <label className="block space-y-2 text-sm font-bold text-slate-700">
              <span>Admission source</span>
              <select className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={source} onChange={(event) => setSource(event.target.value)}>
                <option value="">Any source</option>
                <option value="OFFICE_WALK_IN">Office / walk-in</option>
                <option value="PARENT_ONLINE">Parent online</option>
                <option value="PHONE_INQUIRY">Phone inquiry</option>
                <option value="TRANSFER_REQUEST">Transfer request</option>
                <option value="IMPORT">Import</option>
              </select>
            </label>
          </div>
        </SectionCard>
      ) : null}

      {step === 2 ? (
        <SectionCard title="Required information" description="Choose what additional information staff must collect for this policy.">
          <div className="flex flex-wrap gap-2">
            {REQUIRED_FIELD_OPTIONS.map((option) => (
              <label key={option.value} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={requiredFields.includes(option.value)}
                  onChange={(event) => {
                    setRequiredFields((current) => (event.target.checked ? [...current, option.value] : current.filter((value) => value !== option.value)));
                  }}
                />
                {option.label}
              </label>
            ))}
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm font-bold text-slate-700">
            <input type="checkbox" checked={requireSection} onChange={(event) => setRequireSection(event.target.checked)} />
            Require a section when the class has sections
          </label>
        </SectionCard>
      ) : null}

      {step === 3 ? (
        policyId && draftVersion ? (
          <SectionCard title="Required documents" description="Build the document checklist for this policy.">
            <DocumentChecklistBuilder policyId={policyId} versionId={draftVersion.id} documentRequirements={documentRequirements} />
          </SectionCard>
        ) : (
          <p className="text-sm text-slate-500">Save the basic information step first.</p>
        )
      ) : null}

      {step === 4 ? (
        <SectionCard title="Assessment, capacity, and decision" description="Configure whether applicants need evaluation or approval.">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2 text-sm font-bold text-slate-700">
              <span>Admission mode</span>
              <select className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={admissionMode} onChange={(event) => setAdmissionMode(event.target.value as 'DIRECT_ALLOWED' | 'REVIEW_REQUIRED')}>
                <option value="DIRECT_ALLOWED">Direct admission allowed</option>
                <option value="REVIEW_REQUIRED">Review required</option>
              </select>
            </label>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Toggle checked={requireDocumentReview} label="Require document review" onChange={setRequireDocumentReview} />
            <Toggle checked={requireInterview} label="Require interview" onChange={setRequireInterview} />
            <Toggle checked={requirePrincipalApproval} label="Require principal approval" onChange={setRequirePrincipalApproval} />
            <Toggle checked={requireTransferCertificate} label="Require transfer certificate for transfers" onChange={setRequireTransferCertificate} />
            <Toggle checked={requirePriorMarksheet} label="Require prior marksheet" onChange={setRequirePriorMarksheet} />
            <Toggle checked={requireStreamOrMarksReview} label="Require Grade 11-12 stream or marks review" onChange={setRequireStreamOrMarksReview} />
            <Toggle checked={allowAdmissionWithDocumentsPending} label="Allow admission with documents pending" onChange={setAllowAdmissionWithDocumentsPending} />
            <Toggle checked={enforceCapacityWhenAvailable} label="Check section capacity when configured" onChange={setEnforceCapacityWhenAvailable} />
          </div>
          <label className="mt-4 block space-y-2 text-sm font-bold text-slate-700">
            <span>Notes for office staff</span>
            <textarea className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" rows={3} value={notesForOffice} onChange={(event) => setNotesForOffice(event.target.value)} />
          </label>
          {policyId && draftVersion ? (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <ApprovalChainBuilder policyId={policyId} versionId={draftVersion.id} chain={draftVersion.approvalChain} />
            </div>
          ) : null}
        </SectionCard>
      ) : null}

      {step === 5 ? (
        <SectionCard title="Review and activate" description="Confirm this policy before it applies to new admissions.">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Summary label="Policy name" value={name} />
            <Summary label="Applies to" value={[classId && (classesQuery.data ?? []).find((c) => c.id === classId)?.name, academicYearId && (academicYearsQuery.data ?? []).find((y) => y.id === academicYearId)?.name, gradeBand, applicantType !== 'BOTH' ? applicantType : null].filter(Boolean).join(', ') || 'All admissions'} />
            <Summary label="Required documents" value={`${documentRequirements.length} required`} />
            <Summary label="Admission mode" value={admissionMode === 'DIRECT_ALLOWED' ? 'Direct admission allowed' : 'Review required'} />
          </dl>
          {activateMutation.isSuccess ? (
            <p className="mt-4 flex items-center gap-2 rounded-xl border border-success-200 bg-success-50 p-3 text-sm font-semibold text-success-800">
              <CheckCircle2 className="h-5 w-5" />
              Policy activated.
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => router.push('/dashboard/settings/admissions')}>
              Save as Draft
            </Button>
            <Button type="button" onClick={() => activateMutation.mutate()} disabled={activateMutation.isPending}>
              {activateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Activate Policy
            </Button>
          </div>
        </SectionCard>
      ) : null}

      {step < 5 ? (
        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}>
            Back
          </Button>
          <Button type="button" onClick={continueStep} disabled={createMutation.isPending || updateIdentityMutation.isPending || updateVersionMutation.isPending}>
            {createMutation.isPending || updateIdentityMutation.isPending || updateVersionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Continue
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}
