'use client';

import type { AdmissionPolicy } from '@schoolos/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { admissionCasesApi } from '../../lib/api/admission-cases';
import { Button } from '../ui/button';
import { ErrorState } from '../ui/error-state';
import { SectionCard } from '../ui/section-card';

export function AdmissionPolicySettings() {
  const queryClient = useQueryClient();
  const policyQuery = useQuery({ queryKey: ['admission-policy'], queryFn: admissionCasesApi.getPolicy });
  const academicYearsQuery = useQuery({ queryKey: ['academic-years'], queryFn: api.listAcademicYears });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: api.listClasses });
  const [policy, setPolicy] = useState<AdmissionPolicy | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (policyQuery.data) setPolicy(policyQuery.data);
  }, [policyQuery.data]);

  const mutation = useMutation({
    mutationFn: admissionCasesApi.updatePolicy,
    onSuccess: (updated) => {
      setPolicy(updated);
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ['admission-policy'] });
    },
  });

  if (policyQuery.isLoading || academicYearsQuery.isLoading || classesQuery.isLoading || !policy) {
    return <div className="flex min-h-48 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-600"><Loader2 className="h-5 w-5 animate-spin" />Loading admission settings…</div>;
  }
  if (policyQuery.isError || academicYearsQuery.isError || classesQuery.isError) {
    return <ErrorState title="Admission settings could not load" message="No policy has been changed. Retry to load the school’s saved admission rules." onRetry={() => void policyQuery.refetch()} />;
  }

  const defaultPolicy = policy.defaultPolicy;
  const update = <K extends keyof AdmissionPolicy['defaultPolicy']>(key: K, value: AdmissionPolicy['defaultPolicy'][K]) => {
    setSaved(false);
    setPolicy((current) => current ? { ...current, defaultPolicy: { ...current.defaultPolicy, [key]: value } } : current);
  };
  const updateOverride = <K extends keyof AdmissionPolicy['overrides'][number]>(index: number, key: K, value: AdmissionPolicy['overrides'][number][K] | undefined) => {
    setSaved(false);
    setPolicy((current) => {
      if (!current) return current;
      const overrides = current.overrides.map((rule, ruleIndex) => {
        if (ruleIndex !== index) return rule;
        const next = { ...rule };
        if (typeof value === 'undefined' || value === '') delete next[key];
        else next[key] = value;
        return next;
      });
      return { ...current, overrides };
    });
  };

  return (
    <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); mutation.mutate(policy); }}>
      <SectionCard title="How this school admits students" description="Keep normal office admission simple. Turn on review only where the school genuinely needs it.">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2 text-sm font-bold text-slate-700">
            <span>Default admission mode</span>
            <select value={defaultPolicy.admissionMode} onChange={(event) => update('admissionMode', event.target.value as 'DIRECT_ALLOWED' | 'REVIEW_REQUIRED')}>
              <option value="DIRECT_ALLOWED">Direct admission allowed</option>
              <option value="REVIEW_REQUIRED">Review required</option>
            </select>
            <span className="block text-xs font-medium text-slate-500">Montessori, Primary, and Grades 1–10 normally use direct admission. Grade 11–12 or competitive schools may require review.</span>
          </label>
          <label className="block space-y-2 text-sm font-bold text-slate-700">
            <span>Required documents</span>
            <input value={(defaultPolicy.requiredDocuments ?? []).join(', ')} onChange={(event) => update('requiredDocuments', event.target.value.split(',').map((value) => value.trim()).filter(Boolean))} placeholder="Transfer certificate, prior marksheet" />
            <span className="block text-xs font-medium text-slate-500">Use clear school terms. Documents can stay as follow-up work when the policy allows it.</span>
          </label>
        </div>
        <div className="mt-4">
          <p className="text-sm font-bold text-slate-700">Additional required information</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {REQUIRED_FIELD_OPTIONS.map((option) => (
              <label key={option.value} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                <input type="checkbox" checked={(defaultPolicy.requiredFields ?? []).includes(option.value)} onChange={(event) => { const current = new Set(defaultPolicy.requiredFields ?? []); if (event.target.checked) current.add(option.value); else current.delete(option.value); update('requiredFields', [...current]); }} />
                {option.label}
              </label>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Review requirements" description="Only enable controls that the school actually uses.">
        <div className="grid gap-3 md:grid-cols-2">
          <Toggle checked={Boolean(defaultPolicy.requireDocumentReview)} label="Require document review before admission" onChange={(value) => update('requireDocumentReview', value)} />
          <Toggle checked={Boolean(defaultPolicy.requireInterview)} label="Require interview before admission" onChange={(value) => update('requireInterview', value)} />
          <Toggle checked={Boolean(defaultPolicy.requirePrincipalApproval)} label="Require principal approval" onChange={(value) => update('requirePrincipalApproval', value)} />
          <Toggle checked={Boolean(defaultPolicy.requireTransferCertificate)} label="Require transfer certificate for transfers" onChange={(value) => update('requireTransferCertificate', value)} />
          <Toggle checked={Boolean(defaultPolicy.requirePriorMarksheet)} label="Require prior marksheet where selected" onChange={(value) => update('requirePriorMarksheet', value)} />
          <Toggle checked={Boolean(defaultPolicy.requireStreamOrMarksReview)} label="Require Grade 11–12 stream or marks review" onChange={(value) => update('requireStreamOrMarksReview', value)} />
        </div>
      </SectionCard>

      <SectionCard title="Office-friendly follow-up" description="These controls keep incomplete optional records from blocking ordinary school-office admission.">
        <div className="grid gap-3 md:grid-cols-2">
          <Toggle checked={Boolean(defaultPolicy.allowAdmissionWithDocumentsPending)} label="Allow admission with documents pending" onChange={(value) => update('allowAdmissionWithDocumentsPending', value)} />
          <Toggle checked={Boolean(defaultPolicy.enforceCapacityWhenAvailable)} label="Check section capacity when it is configured" onChange={(value) => update('enforceCapacityWhenAvailable', value)} />
          <Toggle checked={Boolean(defaultPolicy.requireSection)} label="Require a section when the class has sections" onChange={(value) => update('requireSection', value)} />
        </div>
      </SectionCard>

      <SectionCard title="Rules for selected admissions" description="Add a rule only when an academic year, grade band, class, source, or transfer case needs different handling from the school default.">
        <div className="space-y-4">
          {policy.overrides.map((rule, index) => (
            <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <SelectField label="Academic year" value={rule.academicYearId ?? ''} onChange={(value) => updateOverride(index, 'academicYearId', value || undefined)}>
                  <option value="">Any academic year</option>
                  {(academicYearsQuery.data ?? []).map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
                </SelectField>
                <SelectField label="Grade band" value={rule.gradeBand ?? ''} onChange={(value) => updateOverride(index, 'gradeBand', value || undefined)}>
                  <option value="">Any grade band</option><option value="MONTESSORI">Montessori / ECD</option><option value="PRIMARY">Primary (Grades 1–5)</option><option value="BASIC_SECONDARY">Grades 6–10</option><option value="GRADE_11_12">Grades 11–12</option>
                </SelectField>
                <SelectField label="Class" value={rule.classId ?? ''} onChange={(value) => updateOverride(index, 'classId', value || undefined)}>
                  <option value="">Any class</option>
                  {(classesQuery.data ?? []).map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}
                </SelectField>
                <SelectField label="Admission source" value={rule.source ?? ''} onChange={(value) => updateOverride(index, 'source', (value || undefined) as typeof rule.source)}>
                  <option value="">Any source</option><option value="OFFICE_WALK_IN">Office / walk-in</option><option value="PARENT_ONLINE">Parent online</option><option value="PHONE_INQUIRY">Phone inquiry</option><option value="TRANSFER_REQUEST">Transfer request</option><option value="IMPORT">Import</option>
                </SelectField>
                <SelectField label="Transfer student" value={typeof rule.transferStudent === 'boolean' ? String(rule.transferStudent) : ''} onChange={(value) => updateOverride(index, 'transferStudent', value === '' ? undefined : value === 'true')}>
                  <option value="">Any admission</option><option value="true">Transfer students only</option><option value="false">Non-transfer students only</option>
                </SelectField>
                <SelectField label="Admission mode" value={rule.admissionMode} onChange={(value) => updateOverride(index, 'admissionMode', value as typeof rule.admissionMode)}>
                  <option value="DIRECT_ALLOWED">Direct admission allowed</option><option value="REVIEW_REQUIRED">Review required</option>
                </SelectField>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <PolicyChoice label="Document review" value={rule.requireDocumentReview} onChange={(value) => updateOverride(index, 'requireDocumentReview', value)} />
                <PolicyChoice label="Interview" value={rule.requireInterview} onChange={(value) => updateOverride(index, 'requireInterview', value)} />
                <PolicyChoice label="Principal approval" value={rule.requirePrincipalApproval} onChange={(value) => updateOverride(index, 'requirePrincipalApproval', value)} />
                <PolicyChoice label="Grade 11–12 marks / stream review" value={rule.requireStreamOrMarksReview} onChange={(value) => updateOverride(index, 'requireStreamOrMarksReview', value)} />
                <PolicyChoice label="Allow documents pending" value={rule.allowAdmissionWithDocumentsPending} onChange={(value) => updateOverride(index, 'allowAdmissionWithDocumentsPending', value)} />
                <PolicyChoice label="Require section" value={rule.requireSection} onChange={(value) => updateOverride(index, 'requireSection', value)} />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="block space-y-2 text-sm font-bold text-slate-700"><span>Required documents for this rule</span><input value={(rule.requiredDocuments ?? []).join(', ')} onChange={(event) => updateOverride(index, 'requiredDocuments', event.target.value.split(',').map((value) => value.trim()).filter(Boolean))} placeholder="Transfer certificate, prior marksheet" /></label>
                <div><p className="text-sm font-bold text-slate-700">Additional required information</p><div className="mt-2 flex flex-wrap gap-2">{REQUIRED_FIELD_OPTIONS.map((option) => <label key={option.value} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={(rule.requiredFields ?? []).includes(option.value)} onChange={(event) => { const current = new Set(rule.requiredFields ?? []); if (event.target.checked) current.add(option.value); else current.delete(option.value); updateOverride(index, 'requiredFields', [...current]); }} />{option.label}</label>)}</div></div>
              </div>
              <div className="mt-4 flex justify-end"><Button type="button" variant="outline" onClick={() => { setSaved(false); setPolicy((current) => current ? { ...current, overrides: current.overrides.filter((_, ruleIndex) => ruleIndex !== index) } : current); }}>Remove rule</Button></div>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={() => { setSaved(false); setPolicy((current) => current ? { ...current, overrides: [...current.overrides, { admissionMode: 'REVIEW_REQUIRED' }] } : current); }}>Add selected-admission rule</Button>
        </div>
      </SectionCard>

      {mutation.isError ? <p className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm font-semibold text-danger-800">{mutation.error instanceof Error ? mutation.error.message : 'Admission settings could not be saved.'}</p> : null}
      {saved ? <p className="flex items-center gap-2 rounded-xl border border-success-200 bg-success-50 p-3 text-sm font-semibold text-success-800"><CheckCircle2 className="h-5 w-5" />Admission policy saved and audited.</p> : null}
      <div className="sticky bottom-4 flex justify-end rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur"><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Save admission policy</Button></div>
    </form>
  );
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>;
}

const REQUIRED_FIELD_OPTIONS = [
  { value: 'previousSchool', label: 'Previous school' },
  { value: 'guardianEmail', label: 'Guardian email' },
  { value: 'nationalStudentId', label: 'IEMIS student ID' },
  { value: 'emergencyName', label: 'Emergency contact name' },
  { value: 'emergencyPhone', label: 'Emergency contact phone' },
];

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <label className="block space-y-2 text-sm font-bold text-slate-700"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{children}</select></label>;
}

function PolicyChoice({ label, value, onChange }: { label: string; value: boolean | undefined; onChange: (value: boolean | undefined) => void }) {
  return <SelectField label={label} value={typeof value === 'boolean' ? String(value) : ''} onChange={(next) => onChange(next === '' ? undefined : next === 'true')}><option value="">Use school default</option><option value="true">Required / enabled</option><option value="false">Not required / disabled</option></SelectField>;
}
