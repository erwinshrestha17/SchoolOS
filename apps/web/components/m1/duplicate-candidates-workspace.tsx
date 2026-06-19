'use client';

import type { StudentDuplicateCandidate } from '@schoolos/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, GitMerge, Search, ShieldCheck, UsersRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../ui/button';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { EmptyState } from '../ui/empty-state';
import { ErrorState } from '../ui/error-state';
import { KpiCard, KpiGrid } from '../ui/kpi-card';
import { LoadingState } from '../ui/loading-state';
import { StatusBadge } from '../ui/status-badge';
import { Toast } from '../ui/toast';

type SelectedPair = StudentDuplicateCandidate & { key: string };

export function DuplicateCandidatesWorkspace() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [confidence, setConfidence] = useState('');
  const [selected, setSelected] = useState<SelectedPair | null>(null);
  const [primaryId, setPrimaryId] = useState('');
  const [reason, setReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<{ tone: 'success' | 'danger'; title: string; description: string } | null>(null);

  const candidatesQuery = useQuery({
    queryKey: ['student-duplicate-candidates', 'workspace'],
    queryFn: () => api.listDuplicateStudentCandidates({ limit: 50 }),
  });

  const previewMutation = useMutation({
    mutationFn: ({ sourceStudentId, targetStudentId }: { sourceStudentId: string; targetStudentId: string }) =>
      api.previewDuplicateStudentMerge({ sourceStudentId, targetStudentId }),
  });

  const mergeMutation = useMutation({
    mutationFn: ({ sourceStudentId, targetStudentId }: { sourceStudentId: string; targetStudentId: string }) =>
      api.mergeDuplicateStudent({ sourceStudentId, targetStudentId, reason }),
    onSuccess: (result) => {
      setToast({
        tone: 'success',
        title: 'Duplicate records merged',
        description: `${result.sourceStudent.studentSystemId} was merged into ${result.targetStudent.studentSystemId}.`,
      });
      setSelected(null);
      setConfirmOpen(false);
      setReason('');
      void queryClient.invalidateQueries({ queryKey: ['student-duplicate-candidates'] });
      void queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (error) => {
      setToast({
        tone: 'danger',
        title: 'Merge could not be completed',
        description: error instanceof Error ? error.message : 'The server rejected this merge.',
      });
    },
  });

  const candidates = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return (candidatesQuery.data?.candidates ?? []).filter((candidate) => {
      const matchesConfidence = !confidence || candidate.confidence === confidence;
      const matchesSearch =
        !normalized ||
        candidate.sourceStudent.fullNameEn.toLowerCase().includes(normalized) ||
        candidate.candidateStudent.fullNameEn.toLowerCase().includes(normalized) ||
        candidate.sourceStudent.studentSystemId.toLowerCase().includes(normalized) ||
        candidate.candidateStudent.studentSystemId.toLowerCase().includes(normalized);
      return matchesConfidence && matchesSearch;
    });
  }, [candidatesQuery.data, confidence, search]);

  function selectPair(candidate: StudentDuplicateCandidate) {
    const next = {
      ...candidate,
      key: `${candidate.sourceStudent.id}-${candidate.candidateStudent.id}`,
    };
    setSelected(next);
    setPrimaryId(candidate.sourceStudent.id);
    setReason('');
    previewMutation.mutate({
      sourceStudentId: candidate.candidateStudent.id,
      targetStudentId: candidate.sourceStudent.id,
    });
  }

  if (candidatesQuery.isLoading) return <LoadingState variant="page" label="Reviewing duplicate candidates…" />;
  if (candidatesQuery.isError) {
    return <ErrorState title="Duplicate candidates could not load" message="No records were changed." onRetry={() => void candidatesQuery.refetch()} />;
  }

  const highConfidence = (candidatesQuery.data?.candidates ?? []).filter((item) => item.confidence === 'HIGH').length;

  return (
    <div className="space-y-6">
      {toast ? <Toast {...toast} onDismiss={() => setToast(null)} /> : null}
      <KpiGrid className="sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard title="Current Candidates" value={candidatesQuery.data?.candidates.length ?? 0} icon={<UsersRound size={19} />} tone="info" description="Current server review window" />
        <KpiCard title="High Confidence" value={highConfidence} icon={<AlertTriangle size={19} />} tone={highConfidence ? 'danger' : 'success'} description="Score and confidence from backend" />
        <KpiCard title="Pending Review" value={candidatesQuery.data?.candidates.length ?? 0} icon={<Search size={19} />} tone="warning" description="No durable review-state API" />
        <KpiCard title="Merged Today" value="Unavailable" icon={<GitMerge size={19} />} tone="neutral" description="Backend does not expose a daily summary" />
        <KpiCard title="Ignored Matches" value="Unavailable" icon={<CheckCircle2 size={19} />} tone="neutral" description="Ignore state is not persisted yet" />
      </KpiGrid>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-[1fr_220px_auto]">
            <label className="relative">
              <span className="sr-only">Search duplicate candidates</span>
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or admission number" className="pl-9" />
            </label>
            <select aria-label="Filter by match confidence" value={confidence} onChange={(event) => setConfidence(event.target.value)}>
              <option value="">All confidence levels</option>
              <option value="HIGH">High confidence</option>
              <option value="MEDIUM">Medium confidence</option>
              <option value="LOW">Low confidence</option>
            </select>
            <Button type="button" variant="outline" onClick={() => { setSearch(''); setConfidence(''); }}>Clear filters</Button>
          </div>

          {candidates.length === 0 ? (
            <EmptyState title="No duplicate candidates" description="No candidate pair matches the current review window and filters." />
          ) : (
            <div className="divide-y divide-slate-100">
              {candidates.map((candidate) => {
                const key = `${candidate.sourceStudent.id}-${candidate.candidateStudent.id}`;
                const active = selected?.key === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectPair(candidate)}
                    className={`block w-full p-4 text-left transition ${active ? 'bg-primary-50 ring-1 ring-inset ring-primary-200' : 'hover:bg-slate-50'}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-950">{candidate.sourceStudent.fullNameEn} / {candidate.candidateStudent.fullNameEn}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{candidate.sourceStudent.studentSystemId} compared with {candidate.candidateStudent.studentSystemId}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={candidate.confidence} tone={candidate.confidence === 'HIGH' ? 'rejected' : 'pending'} />
                        <span className="rounded-full bg-success-50 px-2.5 py-1 text-xs font-black text-success-700">{candidate.score}% match</span>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                      <p><span className="font-bold text-slate-800">Record A:</span> DOB {candidate.sourceStudent.dateOfBirth.slice(0, 10)} · {candidate.sourceStudent.className ?? 'No class'}</p>
                      <p><span className="font-bold text-slate-800">Record B:</span> DOB {candidate.candidateStudent.dateOfBirth.slice(0, 10)} · {candidate.candidateStudent.className ?? 'No class'}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {candidate.reasons.map((item) => <span key={item} className="rounded-md border border-warning-100 bg-warning-50 px-2 py-1 text-[0.68rem] font-bold text-warning-700">{item}</span>)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-24" aria-label="Review and merge inspector">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
            <ShieldCheck className="h-5 w-5 text-primary-600" />
            <h2 className="text-base font-black text-slate-950">Review & Merge</h2>
          </div>
          {!selected ? (
            <p className="py-10 text-center text-sm font-medium text-slate-500">Select a candidate pair to compare records and request a server-side merge.</p>
          ) : (
            <div className="space-y-5 pt-5">
              <fieldset className="space-y-2">
                <legend className="text-xs font-black uppercase tracking-wide text-slate-500">Keep as primary record</legend>
                {[selected.sourceStudent, selected.candidateStudent].map((record) => (
                  <label key={record.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${primaryId === record.id ? 'border-primary-300 bg-primary-50' : 'border-slate-200'}`}>
                    <input type="radio" className="mt-1 h-4 w-4" checked={primaryId === record.id} onChange={() => {
                      setPrimaryId(record.id);
                      previewMutation.mutate({
                        sourceStudentId: record.id === selected.sourceStudent.id ? selected.candidateStudent.id : selected.sourceStudent.id,
                        targetStudentId: record.id,
                      });
                    }} />
                    <span><strong className="block text-sm text-slate-900">{record.fullNameEn}</strong><span className="text-xs text-slate-500">{record.studentSystemId} · {record.lifecycleStatus}</span></span>
                  </label>
                ))}
              </fieldset>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                {previewMutation.isPending ? 'Calculating related records…' : previewMutation.data ? (
                  <><strong className="block text-slate-900">Atomic merge preview</strong>{Object.values(previewMutation.data.mergeCounts).reduce((sum, count) => sum + count, 0)} related records will be reconciled by the backend transaction.</>
                ) : 'Select the primary record to load the server merge preview.'}
              </div>

              <label className="block text-xs font-black uppercase tracking-wide text-slate-500">Reviewer reason
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={4} placeholder="Explain why these records should be merged" className="mt-2 text-sm font-normal normal-case tracking-normal" />
              </label>

              <Button type="button" className="w-full" disabled={!reason.trim() || previewMutation.isPending} onClick={() => {
                if (!selected) return;
                setConfirmOpen(true);
              }}>
                <GitMerge className="h-4 w-4" /> Review merge confirmation
              </Button>
              <Button type="button" variant="outline" className="w-full" disabled title="A persisted not-duplicate review endpoint is not available">Mark Not Duplicate — unavailable</Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setSelected(null)}>Skip for now</Button>
            </div>
          )}
        </aside>
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Merge duplicate student records?"
        description="This is an audited, atomic server operation. The non-primary record will move to MERGED and its supported relationships will be reconciled."
        confirmLabel="Merge selected"
        destructive
        isConfirming={mergeMutation.isPending}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          if (!selected) return;
          mergeMutation.mutate({
            sourceStudentId: primaryId === selected.sourceStudent.id ? selected.candidateStudent.id : selected.sourceStudent.id,
            targetStudentId: primaryId,
          });
        }}
      />
    </div>
  );
}
