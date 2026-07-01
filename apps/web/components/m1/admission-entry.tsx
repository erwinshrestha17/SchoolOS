'use client';

import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, FileUp, History, Loader2, UserRoundPlus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { admissionCasesApi } from '../../lib/api/admission-cases';
import { useSession } from '../session-provider';
import { Button } from '../ui/button';
import { ErrorState } from '../ui/error-state';
import { PageState } from '../ui/page-state';
import { AdmissionCaseWizard } from './admission-case-wizard';
import { AdmissionReviewCaseForm } from './admission-review-case-form';

export function AdmissionEntry({ initialMode, initialCaseId }: { initialMode?: 'direct' | 'review'; initialCaseId?: string }) {
  const { hasPermissions } = useSession();
  const [mode, setMode] = useState<'choose' | 'direct' | 'review'>(initialMode ?? 'choose');
  const policyQuery = useQuery({ queryKey: ['admission-policy'], queryFn: admissionCasesApi.getPolicy });
  const canCreateAdmission = hasPermissions(['enrollments:create', 'students:create', 'guardians:create']);

  if (policyQuery.isLoading && !initialMode) {
    return <div className="flex min-h-48 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-600"><Loader2 className="h-5 w-5 animate-spin" />Checking this school’s admission policy…</div>;
  }

  if (policyQuery.isError) {
    return <ErrorState title="Admission policy could not load" message="No student has been created. Retry before starting a new admission." onRetry={() => void policyQuery.refetch()} />;
  }

  if (!canCreateAdmission) {
    return (
      <PageState
        tone="permission"
        title="You do not have permission to start an admission."
        description="You can return to the admission queue to review work allowed for your role."
        secondaryAction={
          <Link
            href="/dashboard/admissions"
            className="inline-flex h-11 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white px-6 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Return to admissions
          </Link>
        }
      />
    );
  }

  if (mode === 'direct') return <AdmissionCaseWizard initialCaseId={initialCaseId} />;
  if (mode === 'review') return <AdmissionReviewCaseForm />;

  const directIsDefault = policyQuery.data?.defaultPolicy.admissionMode === 'DIRECT_ALLOWED';

  return (
    <section>
      <div className="mb-5">
        <h2 className="text-xl font-black text-slate-950">Choose the admission path</h2>
        <p className="mt-1 text-sm text-slate-600">Start with the path that matches the school-office task. School policy makes the final admission decision.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
      <article className={`rounded-2xl border bg-white p-6 shadow-sm ${directIsDefault ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200'}`}>
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><UserRoundPlus className="h-6 w-6" /></span>
        <div className="mt-5 flex items-center gap-2"><h3 className="text-lg font-black text-slate-950">School-office admission</h3>{directIsDefault ? <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800">School default</span> : null}</div>
        <p className="mt-2 text-sm leading-6 text-slate-600">For a parent currently at the front desk.</p>
        <Button className="mt-6" type="button" onClick={() => setMode('direct')}>Start school-office admission</Button>
      </article>
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><History className="h-6 w-6" /></span>
        <h3 className="mt-5 text-lg font-black text-slate-950">Continue an existing application</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">Find and continue an application that was already started.</p>
        <Link href="/dashboard/admissions" className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white px-6 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">Open admission queue</Link>
      </article>
      <article className={`rounded-2xl border bg-white p-6 shadow-sm ${!directIsDefault ? 'border-violet-300 ring-2 ring-violet-100' : 'border-slate-200'}`}>
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><ClipboardCheck className="h-6 w-6" /></span>
        <div className="mt-5 flex items-center gap-2"><h3 className="text-lg font-black text-slate-950">Transfer or special review</h3>{!directIsDefault ? <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-800">School default</span> : null}</div>
        <p className="mt-2 text-sm leading-6 text-slate-600">For transfers, exceptions, or admissions needing approval.</p>
        <Button className="mt-6" type="button" variant="outline" onClick={() => setMode('review')}>Start review case</Button>
      </article>
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><FileUp className="h-6 w-6" /></span>
        <h3 className="mt-5 text-lg font-black text-slate-950">Import admissions</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">Validate and review a school-prepared admission CSV before creating records.</p>
        <Link href="/dashboard/admissions/iemis" className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white px-6 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">Open import workspace</Link>
      </article>
      </div>
    </section>
  );
}
