'use client';

import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, Loader2, UserRoundPlus } from 'lucide-react';
import { useState } from 'react';
import { admissionCasesApi } from '../../lib/api/admission-cases';
import { Button } from '../ui/button';
import { ErrorState } from '../ui/error-state';
import { AdmissionCaseWizard } from './admission-case-wizard';
import { AdmissionReviewCaseForm } from './admission-review-case-form';

export function AdmissionEntry({ initialMode }: { initialMode?: 'direct' | 'review' }) {
  const [mode, setMode] = useState<'choose' | 'direct' | 'review'>(initialMode ?? 'choose');
  const policyQuery = useQuery({ queryKey: ['admission-policy'], queryFn: admissionCasesApi.getPolicy });

  if (policyQuery.isLoading && !initialMode) {
    return <div className="flex min-h-48 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-600"><Loader2 className="h-5 w-5 animate-spin" />Checking this school’s admission policy…</div>;
  }

  if (policyQuery.isError) {
    return <ErrorState title="Admission policy could not load" message="No student has been created. Retry before starting a new admission." onRetry={() => void policyQuery.refetch()} />;
  }

  if (mode === 'direct') return <AdmissionCaseWizard />;
  if (mode === 'review') return <AdmissionReviewCaseForm />;

  const directIsDefault = policyQuery.data?.defaultPolicy.admissionMode === 'DIRECT_ALLOWED';

  return (
    <section>
      <div className="mb-5">
        <h2 className="text-xl font-black text-slate-950">Choose how to add a student</h2>
        <p className="mt-1 text-sm text-slate-600">Both choices create one admission case. School policy makes the final admission decision.</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
      <article className={`rounded-2xl border bg-white p-6 shadow-sm ${directIsDefault ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200'}`}>
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><UserRoundPlus className="h-6 w-6" /></span>
        <div className="mt-5 flex items-center gap-2"><h3 className="text-xl font-black text-slate-950">Direct admission</h3>{directIsDefault ? <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800">School default</span> : null}</div>
        <p className="mt-2 text-sm leading-6 text-slate-600">For normal school-office or walk-in admission. Enter the student once, check policy and duplicate warnings, then admit.</p>
        <Button className="mt-6" type="button" onClick={() => setMode('direct')}>Start direct admission</Button>
      </article>
      <article className={`rounded-2xl border bg-white p-6 shadow-sm ${!directIsDefault ? 'border-violet-300 ring-2 ring-violet-100' : 'border-slate-200'}`}>
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><ClipboardCheck className="h-6 w-6" /></span>
        <div className="mt-5 flex items-center gap-2"><h3 className="text-xl font-black text-slate-950">Admission review</h3>{!directIsDefault ? <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-800">School default</span> : null}</div>
        <p className="mt-2 text-sm leading-6 text-slate-600">For online applications, interviews, scholarships, transfer review, or approval-required admissions.</p>
        <Button className="mt-6" type="button" variant="outline" onClick={() => setMode('review')}>Start admission review</Button>
      </article>
      </div>
    </section>
  );
}
