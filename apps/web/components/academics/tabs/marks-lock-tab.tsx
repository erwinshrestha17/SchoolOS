'use client';

import type { ExamTermSummary } from '@schoolos/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api, type MarkLockRequestSummary } from '../../../lib/api';
import { useSession } from '../../session-provider';

type Props = {
  exams: ExamTermSummary[];
};

type ReviewAction = {
  id: string;
  status: 'APPROVED' | 'REJECTED';
};

function actorLabel(actor?: MarkLockRequestSummary['requestedBy']) {
  return actor?.email || actor?.phone || actor?.id || 'Unknown user';
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function statusClass(status: string) {
  switch (status) {
    case 'APPROVED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    case 'REJECTED':
      return 'bg-red-50 text-red-700 border-red-100';
    case 'UNLOCKED':
      return 'bg-indigo-50 text-indigo-700 border-indigo-100';
    default:
      return 'bg-amber-50 text-amber-700 border-amber-100';
  }
}

export function MarksLockTab({ exams }: Props) {
  const { status } = useSession();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ examTermId: '', status: '' });
  const [requestForm, setRequestForm] = useState({ examTermId: '', reason: '' });
  const [unlockForm, setUnlockForm] = useState({ examTermId: '', reason: '' });
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState('');

  const requestsQuery = useQuery({
    queryKey: ['mark-lock-requests', filters],
    queryFn: () =>
      api.listMarkLockRequests({
        examTermId: filters.examTermId || null,
        status: filters.status || null,
      }),
    enabled: status === 'authenticated',
  });

  const selectedRequestExam = useMemo(
    () => exams.find((exam) => exam.id === requestForm.examTermId),
    [exams, requestForm.examTermId],
  );
  const selectedUnlockExam = useMemo(
    () => exams.find((exam) => exam.id === unlockForm.examTermId),
    [exams, unlockForm.examTermId],
  );

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['mark-lock-requests'] });
    void queryClient.invalidateQueries({ queryKey: ['exam-terms'] });
    void queryClient.invalidateQueries({ queryKey: ['marks-grid'] });
    void queryClient.invalidateQueries({ queryKey: ['marks'] });
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    window.setTimeout(() => setSuccessMessage(''), 3000);
  };

  const createMutation = useMutation({
    mutationFn: api.createMarkLockRequest,
    onSuccess: () => {
      invalidate();
      setRequestForm((current) => ({ ...current, reason: '' }));
      showSuccess('Mark lock review request submitted.');
    },
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: ReviewAction) =>
      api.reviewMarkLockRequest(id, {
        status,
        reviewNote: reviewNote[id]?.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate();
      showSuccess('Mark lock request reviewed.');
    },
  });

  const unlockMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.unlockExamTerm(id, { reason }),
    onSuccess: () => {
      invalidate();
      setUnlockForm((current) => ({ ...current, reason: '' }));
      showSuccess('Exam term unlocked successfully.');
    },
  });

  const pendingRequests = (requestsQuery.data ?? []).filter(
    (request) => request.status === 'PENDING',
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Marks lock</p>
            <h2 className="mt-1 text-lg font-bold text-gray-950">Lock / Unlock Workflow</h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Manage mark correction requests, approve final locks, and unlock exam terms with an audit trail.
            </p>
          </div>
          {successMessage && (
            <p className="rounded-2xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
              {successMessage}
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select
            value={filters.examTermId}
            onChange={(event) => setFilters((current) => ({ ...current, examTermId: event.target.value }))}
          >
            <option value="">All exam terms</option>
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.name}{exam.isLocked ? ' · Locked' : ' · Open'}
              </option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="UNLOCKED">Unlocked</option>
          </select>
          <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-500">
            Pending: <span className="font-semibold text-gray-950">{pendingRequests.length}</span>
          </div>
          <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-500">
            Locked terms:{' '}
            <span className="font-semibold text-gray-950">
              {exams.filter((exam) => exam.isLocked).length}
            </span>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Request</p>
          <h3 className="mt-1 text-lg font-bold text-gray-950">Request mark review / lock</h3>
          <p className="mt-1 text-sm text-gray-500">
            Submit a reason for admin review before marks are locked or corrected.
          </p>
          <div className="mt-4 grid gap-3">
            <select
              value={requestForm.examTermId}
              onChange={(event) => setRequestForm((current) => ({ ...current, examTermId: event.target.value }))}
            >
              <option value="">Exam term</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.name}{exam.isLocked ? ' · Locked' : ' · Open'}
                </option>
              ))}
            </select>
            {selectedRequestExam && (
              <p className="text-sm text-gray-500">
                Current state:{' '}
                <span className="font-semibold text-gray-950">
                  {selectedRequestExam.isLocked ? 'LOCKED' : 'OPEN'}
                </span>
              </p>
            )}
            <textarea
              rows={3}
              value={requestForm.reason}
              onChange={(event) => setRequestForm((current) => ({ ...current, reason: event.target.value }))}
              placeholder="Reason for lock/review request"
            />
            <button
              type="button"
              className="rounded-2xl bg-indigo-950 px-6 py-3 font-semibold text-white transition hover:bg-indigo-900 disabled:opacity-50"
              disabled={!requestForm.examTermId || !requestForm.reason.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate(requestForm)}
            >
              {createMutation.isPending ? 'Submitting…' : 'Submit request'}
            </button>
            {createMutation.isError && (
              <p className="text-sm text-red-600">{createMutation.error.message}</p>
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Unlock</p>
          <h3 className="mt-1 text-lg font-bold text-gray-950">Unlock exam term</h3>
          <p className="mt-1 text-sm text-gray-500">
            Authorized users can reopen locked marks with a reason. This creates an audit record.
          </p>
          <div className="mt-4 grid gap-3">
            <select
              value={unlockForm.examTermId}
              onChange={(event) => setUnlockForm((current) => ({ ...current, examTermId: event.target.value }))}
            >
              <option value="">Locked exam term</option>
              {exams
                .filter((exam) => exam.isLocked)
                .map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.name}
                  </option>
                ))}
            </select>
            {selectedUnlockExam && (
              <p className="text-sm text-gray-500">
                This will reopen marks for{' '}
                <span className="font-semibold text-gray-950">{selectedUnlockExam.name}</span>.
              </p>
            )}
            <textarea
              rows={3}
              value={unlockForm.reason}
              onChange={(event) => setUnlockForm((current) => ({ ...current, reason: event.target.value }))}
              placeholder="Unlock reason"
            />
            <button
              type="button"
              className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-3 font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
              disabled={!unlockForm.examTermId || unlockMutation.isPending}
              onClick={() =>
                unlockMutation.mutate({
                  id: unlockForm.examTermId,
                  reason: unlockForm.reason || undefined,
                })
              }
            >
              {unlockMutation.isPending ? 'Unlocking…' : 'Unlock exam term'}
            </button>
            {unlockMutation.isError && (
              <p className="text-sm text-red-600">{unlockMutation.error.message}</p>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Requests · {requestsQuery.data?.length ?? 0} shown
        </p>
        {requestsQuery.isLoading ? (
          <div className="py-8 text-center text-sm text-gray-400">Loading lock requests…</div>
        ) : requestsQuery.isError ? (
          <p className="py-8 text-center text-sm text-red-600">{requestsQuery.error.message}</p>
        ) : (requestsQuery.data ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">No mark lock requests found.</p>
        ) : (
          <div className="grid gap-3">
            {(requestsQuery.data ?? []).map((request) => (
              <article key={request.id} className="rounded-2xl border border-[var(--line)] bg-white p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-gray-950">
                        {request.examTerm?.name ?? 'Exam term'}
                      </h4>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass(request.status)}`}>
                        {request.status}
                      </span>
                      {request.examTerm?.isLocked && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                          Locked
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-gray-600">{request.reason}</p>
                    <p className="mt-2 text-xs text-gray-400">
                      Requested by {actorLabel(request.requestedBy)} · {formatDate(request.createdAt)}
                    </p>
                    {request.reviewNote && (
                      <p className="mt-2 text-sm text-gray-500">Review note: {request.reviewNote}</p>
                    )}
                    {request.reviewedAt && (
                      <p className="mt-1 text-xs text-gray-400">
                        Reviewed by {actorLabel(request.reviewedBy)} · {formatDate(request.reviewedAt)}
                      </p>
                    )}
                  </div>
                  {request.status === 'PENDING' && (
                    <div className="grid min-w-[280px] gap-2">
                      <textarea
                        rows={2}
                        value={reviewNote[request.id] ?? ''}
                        onChange={(event) =>
                          setReviewNote((current) => ({ ...current, [request.id]: event.target.value }))
                        }
                        placeholder="Review note"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                          disabled={reviewMutation.isPending}
                          onClick={() => reviewMutation.mutate({ id: request.id, status: 'APPROVED' })}
                        >
                          Approve & lock
                        </button>
                        <button
                          type="button"
                          className="flex-1 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
                          disabled={reviewMutation.isPending}
                          onClick={() => reviewMutation.mutate({ id: request.id, status: 'REJECTED' })}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        {reviewMutation.isError && (
          <p className="mt-3 text-sm text-red-600">{reviewMutation.error.message}</p>
        )}
      </section>
    </div>
  );
}
