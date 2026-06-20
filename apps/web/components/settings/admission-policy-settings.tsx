'use client';

import type { AdmissionPolicy } from '@schoolos/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { admissionCasesApi } from '../../lib/api/admission-cases';
import { Button } from '../ui/button';
import { ErrorState } from '../ui/error-state';
import { SectionCard } from '../ui/section-card';

export function AdmissionPolicySettings() {
  const queryClient = useQueryClient();
  const policyQuery = useQuery({ queryKey: ['admission-policy'], queryFn: admissionCasesApi.getPolicy });
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

  if (policyQuery.isLoading || !policy) {
    return <div className="flex min-h-48 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-600"><Loader2 className="h-5 w-5 animate-spin" />Loading admission settings…</div>;
  }
  if (policyQuery.isError) {
    return <ErrorState title="Admission settings could not load" message="No policy has been changed. Retry to load the school’s saved admission rules." onRetry={() => void policyQuery.refetch()} />;
  }

  const defaultPolicy = policy.defaultPolicy;
  const update = <K extends keyof AdmissionPolicy['defaultPolicy']>(key: K, value: AdmissionPolicy['defaultPolicy'][K]) => {
    setSaved(false);
    setPolicy((current) => current ? { ...current, defaultPolicy: { ...current.defaultPolicy, [key]: value } } : current);
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

      {mutation.isError ? <p className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm font-semibold text-danger-800">{mutation.error instanceof Error ? mutation.error.message : 'Admission settings could not be saved.'}</p> : null}
      {saved ? <p className="flex items-center gap-2 rounded-xl border border-success-200 bg-success-50 p-3 text-sm font-semibold text-success-800"><CheckCircle2 className="h-5 w-5" />Admission policy saved and audited.</p> : null}
      <div className="sticky bottom-4 flex justify-end rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur"><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Save admission policy</Button></div>
    </form>
  );
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>;
}
