'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ChevronLeft, ClipboardCheck, Loader2, ShieldAlert, UserRoundCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { admissionCasesApi, type ReviewAdmissionCasePayload } from '../../lib/api/admission-cases';
import { Button } from '../ui/button';
import { ErrorState } from '../ui/error-state';
import { SectionCard } from '../ui/section-card';

export function AdmissionCaseDetail({ admissionCaseId }: { admissionCaseId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [reviewAction, setReviewAction] = useState<ReviewAdmissionCasePayload['action'] | null>(null);
  const [reason, setReason] = useState('');
  const [confirmDuplicateOverride, setConfirmDuplicateOverride] = useState(false);

  const caseQuery = useQuery({
    queryKey: ['admission-case', admissionCaseId],
    queryFn: () => admissionCasesApi.getCase(admissionCaseId),
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admission-case', admissionCaseId] });
    await queryClient.invalidateQueries({ queryKey: ['admission-case-queues'] });
  };

  const reviewMutation = useMutation({
    mutationFn: (payload: ReviewAdmissionCasePayload) => admissionCasesApi.reviewCase(admissionCaseId, payload),
    onSuccess: async () => { setReviewAction(null); setReason(''); await refresh(); },
  });

  const directAdmitMutation = useMutation({
    mutationFn: () => admissionCasesApi.directAdmit(admissionCaseId, confirmDuplicateOverride ? { overrideDuplicate: true, overrideReason: reason } : {}),
    onSuccess: (result) => router.push(result.redirectPath),
  });

  const finalizeMutation = useMutation({
    mutationFn: () => admissionCasesApi.finalize(admissionCaseId, confirmDuplicateOverride ? { overrideDuplicate: true, overrideReason: reason } : {}),
    onSuccess: (result) => router.push(result.redirectPath),
  });

  if (caseQuery.isLoading) {
    return <div className="flex min-h-64 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-600"><Loader2 className="h-5 w-5 animate-spin" />Loading admission case…</div>;
  }
  if (caseQuery.isError || !caseQuery.data) {
    return <ErrorState title="Admission case could not load" message="No admission details were changed. Retry to view the current case." onRetry={() => void caseQuery.refetch()} />;
  }

  const admissionCase = caseQuery.data;
  const canFinalize = admissionCase.displayStatus === 'APPROVED';
  const canDirectAdmit = admissionCase.canAdmitDirectly && admissionCase.displayStatus !== 'ADMITTED';
  const mutationError = readError(reviewMutation.error) || readError(directAdmitMutation.error) || readError(finalizeMutation.error);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-slate-500">Admission case</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">{admissionCase.student.firstNameEn} {admissionCase.student.lastNameEn}</h2>
          <p className="mt-1 text-sm text-slate-600">{admissionCase.nextActionLabel}</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-800">{statusLabel(admissionCase.displayStatus)}</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard title="Student" description="Saved admission-case information">
          <Detail label="English name" value={`${admissionCase.student.firstNameEn} ${admissionCase.student.lastNameEn}`} />
          <Detail label="Nepali name" value={[admissionCase.student.firstNameNp, admissionCase.student.lastNameNp].filter(Boolean).join(' ') || 'Not added'} />
          <Detail label="Date of birth" value={admissionCase.student.dateOfBirth ?? 'Not added'} />
          <Detail label="Gender" value={admissionCase.student.gender ? statusLabel(admissionCase.student.gender) : 'Not added'} />
        </SectionCard>
        <SectionCard title="Guardian" description="Portal access is not created by admission">
          <Detail label="Name" value={admissionCase.guardian.fullName ?? 'Not added'} />
          <Detail label="Relationship" value={admissionCase.guardian.relationship ?? 'Not added'} />
          <Detail label="Phone" value={admissionCase.guardian.phone ?? 'Not added'} />
          <Detail label="Email" value={admissionCase.guardian.email ?? 'Not added'} />
        </SectionCard>
        <SectionCard title="Placement" description="Saved academic placement">
          <Detail label="Academic year" value={admissionCase.academic.academicYearId ?? 'Not added'} />
          <Detail label="Class" value={admissionCase.academic.classId ?? 'Not added'} />
          <Detail label="Section" value={admissionCase.academic.sectionId ?? 'Not selected'} />
          <Detail label="Admission date" value={admissionCase.academic.admissionDate ?? 'Not added'} />
        </SectionCard>
      </div>

      <SectionCard title="Admission check" description="The backend decides whether this case can be admitted now.">
        <div className="space-y-3">
          {admissionCase.missingRequiredFields.length > 0 ? <Issue title="Information needed" items={admissionCase.missingRequiredFields} /> : null}
          {admissionCase.missingRequiredDocuments.length > 0 ? <Issue title="Documents needed" items={admissionCase.missingRequiredDocuments} /> : null}
          {admissionCase.duplicateRisk ? <Issue title="Possible duplicate" warning items={admissionCase.duplicateCandidates.map((candidate) => `${candidate.fullNameEn} · ${candidate.className}${candidate.sectionName ? ` ${candidate.sectionName}` : ''}`)} /> : null}
          {admissionCase.requiresReview ? <Issue title="Review required" warning items={[admissionCase.requiresApproval ? 'Principal approval is required before finalizing this admission.' : 'This admission must be reviewed before it can be finalized.']} /> : null}
          {admissionCase.capacityStatus?.state === 'FULL' ? <Issue title="Section capacity is full" items={[`Capacity: ${admissionCase.capacityStatus.capacity}; enrolled: ${admissionCase.capacityStatus.enrolled}.`]} /> : null}
          {!admissionCase.missingRequiredFields.length && !admissionCase.missingRequiredDocuments.length && !admissionCase.duplicateRisk && !admissionCase.requiresReview ? <p className="flex items-center gap-2 rounded-xl border border-success-200 bg-success-50 p-3 text-sm font-bold text-success-800"><CheckCircle2 className="h-5 w-5" />This case is ready to admit.</p> : null}
        </div>
      </SectionCard>

      {admissionCase.followUps.length > 0 ? <SectionCard title="After admission" description="These are follow-up cards, not payment or admission blockers."><ul className="space-y-2 text-sm text-slate-700">{admissionCase.followUps.map((item) => <li className="rounded-xl border border-slate-200 bg-slate-50 p-3" key={item.code}>{item.label}</li>)}</ul></SectionCard> : null}

      {admissionCase.duplicateRisk ? <SectionCard title="Duplicate override" description="Only an authorized user can continue after recording a reason."><label className="flex items-center gap-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={confirmDuplicateOverride} onChange={(event) => setConfirmDuplicateOverride(event.target.checked)} />I have reviewed the duplicate warning.</label><label className="mt-3 block space-y-2 text-sm font-bold text-slate-700"><span>Reason for override</span><textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why this is not the same student." /></label></SectionCard> : null}

      {reviewAction ? <SectionCard title={reviewAction === 'REJECT' ? 'Do not admit this case' : reviewAction === 'REQUEST_INFORMATION' ? 'Request information' : 'Review this admission'} description="A reason is recorded in the admission audit history."><label className="block space-y-2 text-sm font-bold text-slate-700"><span>Reason</span><textarea rows={4} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Write a clear school-office reason." /></label><div className="mt-4 flex gap-2"><Button type="button" variant="outline" onClick={() => { setReviewAction(null); setReason(''); }}>Cancel</Button><Button type="button" disabled={reviewMutation.isPending || !reason.trim()} onClick={() => reviewMutation.mutate({ action: reviewAction, reason })}>{reviewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Confirm</Button></div></SectionCard> : null}

      {mutationError ? <p className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm font-semibold text-danger-800" role="alert">{mutationError}</p> : null}

      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
        <Link href="/dashboard/admissions" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" />Back to admissions</Link>
        <div className="flex flex-wrap gap-2">
          {admissionCase.displayStatus !== 'ADMITTED' && admissionCase.displayStatus !== 'NOT_ADMITTED' && admissionCase.displayStatus !== 'CLOSED' ? <Button type="button" variant="outline" onClick={() => setReviewAction('REQUEST_INFORMATION')}><ShieldAlert className="h-4 w-4" />Request information</Button> : null}
          {admissionCase.displayStatus === 'WAITING_FOR_REVIEW' ? <Button type="button" variant="outline" onClick={() => reviewMutation.mutate({ action: 'APPROVE', reason: 'Admission review approved.' })}><ClipboardCheck className="h-4 w-4" />Approve</Button> : null}
          {admissionCase.displayStatus === 'WAITING_FOR_REVIEW' ? <Button type="button" variant="outline" onClick={() => setReviewAction('REJECT')}><AlertTriangle className="h-4 w-4" />Not admit</Button> : null}
          {canFinalize ? <Button type="button" disabled={finalizeMutation.isPending || (admissionCase.duplicateRisk && (!confirmDuplicateOverride || !reason.trim()))} onClick={() => finalizeMutation.mutate()}>{finalizeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRoundCheck className="h-4 w-4" />}Finalize admission</Button> : null}
          {canDirectAdmit ? <Button type="button" disabled={directAdmitMutation.isPending || (admissionCase.duplicateRisk && (!confirmDuplicateOverride || !reason.trim()))} onClick={() => directAdmitMutation.mutate()}>{directAdmitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRoundCheck className="h-4 w-4" />}Admit student</Button> : null}
          {admissionCase.displayStatus === 'ADMITTED' && admissionCase.admittedStudentId ? <Link href={`/dashboard/students/${admissionCase.admittedStudentId}`} className="inline-flex min-h-11 items-center rounded-xl bg-[var(--color-mod-admissions-accent)] px-4 text-sm font-bold text-white">Open student profile</Link> : null}
        </div>
      </div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="border-b border-slate-100 py-2.5 last:border-b-0"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold text-slate-900">{value}</p></div>;
}

function Issue({ title, items, warning = false }: { title: string; items: string[]; warning?: boolean }) {
  return <div className={`rounded-xl border p-3 text-sm ${warning ? 'border-warning-200 bg-warning-50 text-warning-900' : 'border-danger-200 bg-danger-50 text-danger-900'}`}><p className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" />{title}</p><ul className="mt-2 list-disc space-y-1 pl-5">{items.map((item) => <li key={item}>{humanize(item)}</li>)}</ul></div>;
}

function statusLabel(value: string) { return humanize(value); }
function humanize(value: string) { return value.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function readError(error: unknown) { return error instanceof Error ? error.message : error ? 'The admission action could not be completed.' : ''; }
