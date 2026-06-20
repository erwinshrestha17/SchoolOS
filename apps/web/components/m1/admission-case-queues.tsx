'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronLeft, ChevronRight, ClipboardCheck, FileWarning, Loader2, Search, UserRoundCheck } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  admissionCasesApi,
  type AdmissionCaseQueue,
} from '../../lib/api/admission-cases';
import { Button } from '../ui/button';
import { ErrorState } from '../ui/error-state';

const QUEUES: Array<{ id: AdmissionCaseQueue; label: string; icon: typeof ClipboardCheck }> = [
  { id: 'NEEDS_INFORMATION', label: 'Needs Information', icon: FileWarning },
  { id: 'WAITING_FOR_REVIEW', label: 'Waiting for Review', icon: ClipboardCheck },
  { id: 'READY_TO_ADMIT', label: 'Ready to Admit', icon: UserRoundCheck },
  { id: 'APPROVED', label: 'Approved', icon: UserRoundCheck },
  { id: 'NOT_ADMITTED', label: 'Not Admitted', icon: AlertTriangle },
  { id: 'DOCUMENTS_PENDING', label: 'Documents Pending', icon: FileWarning },
  { id: 'DUPLICATE_WARNINGS', label: 'Duplicate Warnings', icon: AlertTriangle },
];

export function AdmissionCaseQueues() {
  const [queue, setQueue] = useState<AdmissionCaseQueue>('NEEDS_INFORMATION');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');

  const query = useQuery({
    queryKey: ['admission-case-queues', queue, page, submittedSearch],
    queryFn: () => admissionCasesApi.listQueues({ queue, page, limit: 25, search: submittedSearch }),
  });

  const activeQueue = useMemo(() => QUEUES.find((item) => item.id === queue) ?? QUEUES[0], [queue]);

  if (query.isError) {
    return <ErrorState title="Admissions could not load" message="No admission details were changed. Retry to load the current school queue." onRetry={() => void query.refetch()} />;
  }

  return (
    <section className="space-y-5">
      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Admission queues">
        {QUEUES.map((item) => {
          const Icon = item.icon;
          const selected = item.id === queue;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => { setQueue(item.id); setPage(1); }}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-bold transition ${selected ? 'border-[var(--color-mod-admissions-accent)] bg-blue-50 text-slate-950' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-base font-black text-slate-950">{activeQueue.label}</h2>
          <p className="mt-1 text-sm text-slate-600">Use the next clear action. SchoolOS keeps technical stages in the backend.</p>
        </div>
        <form
          className="flex min-w-[min(100%,20rem)] items-center gap-2"
          onSubmit={(event) => { event.preventDefault(); setPage(1); setSubmittedSearch(search); }}
        >
          <label className="sr-only" htmlFor="admission-queue-search">Search admissions</label>
          <input id="admission-queue-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Student or guardian phone" />
          <Button type="submit" variant="outline"><Search className="h-4 w-4" />Search</Button>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {query.isLoading ? (
          <div className="flex min-h-52 items-center justify-center gap-2 text-sm font-semibold text-slate-600"><Loader2 className="h-5 w-5 animate-spin" />Loading admissions…</div>
        ) : query.data?.items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Student</th>
                  <th className="px-5 py-3">Guardian</th>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Warnings</th>
                  <th className="px-5 py-3 text-right">Next action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {query.data.items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4"><p className="font-bold text-slate-950">{item.fullNameEn}</p><p className="mt-1 text-xs text-slate-500">Updated {new Date(item.updatedAt).toLocaleDateString()}</p></td>
                    <td className="px-5 py-4"><p className="font-semibold text-slate-800">{item.guardianFullName ?? 'Not added'}</p><p className="mt-1 text-xs text-slate-500">{item.guardianPhone ?? 'No phone'}</p></td>
                    <td className="px-5 py-4 text-slate-600">{sourceLabel(item.source)}</td>
                    <td className="px-5 py-4"><span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{statusLabel(item.displayStatus)}</span></td>
                    <td className="px-5 py-4">{item.hasDuplicateWarning ? <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2.5 py-1 text-xs font-bold text-warning-800"><AlertTriangle className="h-3.5 w-3.5" />Duplicate</span> : item.hasDocumentsPending ? <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800">Documents pending</span> : <span className="text-xs text-slate-500">None</span>}</td>
                    <td className="px-5 py-4 text-right"><Link href={`/dashboard/admissions/cases/${item.id}`} className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">Open case</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center"><h3 className="font-black text-slate-950">No admissions in this queue</h3><p className="mt-2 max-w-md text-sm text-slate-600">Try another queue or change your search. New office admissions appear here after the backend checks their requirements.</p><Link href="/dashboard/admissions/new" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[var(--color-mod-admissions-accent)] px-4 text-sm font-bold text-white">New admission</Link></div>
        )}
      </div>

      {query.data ? (
        <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
          <span>{query.data.total} admission {query.data.total === 1 ? 'case' : 'cases'}</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={page <= 1 || query.isFetching} onClick={() => setPage((current) => current - 1)}><ChevronLeft className="h-4 w-4" />Previous</Button>
            <Button type="button" variant="outline" disabled={!query.data.hasNextPage || query.isFetching} onClick={() => setPage((current) => current + 1)}>Next<ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function sourceLabel(source: string) {
  return source.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusLabel(status: string) {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
