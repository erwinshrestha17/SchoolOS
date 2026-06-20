'use client';

import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, Loader2, UserRoundPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { admissionCasesApi } from '../../lib/api/admission-cases';
import { Button } from '../ui/button';
import { ErrorState } from '../ui/error-state';
import { AdmissionCaseWizard } from './admission-case-wizard';
import { AdmissionReviewCaseForm } from './admission-review-case-form';

export function AdmissionEntry({ initialMode }: { initialMode?: 'direct' | 'review' }) {
  const [mode, setMode] = useState<'choose' | 'direct' | 'review'>(initialMode ?? 'choose');
  const policyQuery = useQuery({ queryKey: ['admission-policy'], queryFn: admissionCasesApi.getPolicy });

  useEffect(() => {
    if (initialMode || !policyQuery.data || mode !== 'choose') return;
    setMode(policyQuery.data.defaultPolicy.admissionMode === 'DIRECT_ALLOWED' ? 'direct' : 'review');
  }, [initialMode, mode, policyQuery.data]);

  if (policyQuery.isLoading && !initialMode) {
    return <div className="flex min-h-48 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-600"><Loader2 className="h-5 w-5 animate-spin" />Checking this school’s admission policy…</div>;
  }

  if (policyQuery.isError) {
    return <ErrorState title="Admission policy could not load" message="No student has been created. Retry before starting a new admission." onRetry={() => void policyQuery.refetch()} />;
  }

  if (mode === 'direct') return <AdmissionCaseWizard />;
  if (mode === 'review') return <AdmissionReviewCaseForm />;

  return (
    <section className="grid gap-5 lg:grid-cols-2">
      <article className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><UserRoundPlus className="h-6 w-6" /></span>
        <h2 className="mt-5 text-xl font-black text-slate-950">Direct admission</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">For normal school-office or walk-in admission. Enter the student once, check policy and duplicate warnings, then admit.</p>
        <Button className="mt-6" type="button" onClick={() => setMode('direct')}>Start direct admission</Button>
      </article>
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><ClipboardCheck className="h-6 w-6" /></span>
        <h2 className="mt-5 text-xl font-black text-slate-950">Admission review</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">For online applications, interviews, scholarships, transfer review, or approval-required admissions.</p>
        <Button className="mt-6" type="button" variant="outline" onClick={() => setMode('review')}>Start admission review</Button>
      </article>
    </section>
  );
}
