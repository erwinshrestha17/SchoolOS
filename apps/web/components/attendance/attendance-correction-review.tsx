'use client';

import type { AttendanceCorrectionRequest } from '@schoolos/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { CheckCircle2, ClipboardCheck, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/loading-state';
import { SectionCard } from '@/components/ui/section-card';

interface AttendanceCorrectionReviewProps {
  corrections: AttendanceCorrectionRequest[];
  isLoading: boolean;
  total: number;
}

type ReviewAction = 'APPROVED' | 'REJECTED';

export function AttendanceCorrectionReview({
  corrections,
  isLoading,
  total,
}: AttendanceCorrectionReviewProps) {
  const queryClient = useQueryClient();
  const [reviewReasons, setReviewReasons] = useState<Record<string, string>>(
    {},
  );
  const [activeReview, setActiveReview] = useState<{
    id: string;
    action: ReviewAction;
  } | null>(null);

  const approveMutation = useMutation({
    mutationFn: ({ id, reviewReason }: { id: string; reviewReason: string }) =>
      api.approveAttendanceCorrection(id, {
        status: 'APPROVED',
        reviewReason,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['attendance-corrections'],
      });
      void queryClient.invalidateQueries({ queryKey: ['attendance-roster'] });
      void queryClient.invalidateQueries({
        queryKey: ['attendance-analytics'],
      });
      setActiveReview(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reviewReason }: { id: string; reviewReason: string }) =>
      api.rejectAttendanceCorrection(id, {
        status: 'REJECTED',
        reviewReason,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['attendance-corrections'],
      });
      setActiveReview(null);
    },
  });

  const reviewCorrection = (id: string, action: ReviewAction) => {
    const reviewReason = (reviewReasons[id] ?? '').trim();
    if (reviewReason.length < 3) {
      setReviewReasons((current) => ({
        ...current,
        [id]: reviewReason,
      }));
      return;
    }

    setActiveReview({ id, action });

    if (action === 'APPROVED') {
      approveMutation.mutate({ id, reviewReason });
      return;
    }

    rejectMutation.mutate({ id, reviewReason });
  };

  return (
    <SectionCard
      title="Correction Review Queue"
      description="Approve or reject teacher-requested attendance corrections with an audit reason."
      headerAction={
        <Badge variant={total > 0 ? 'warning' : 'success'}>
          {total} pending
        </Badge>
      }
    >
      {isLoading ? (
        <LoadingState label="Loading correction requests..." />
      ) : corrections.length === 0 ? (
        <EmptyState
          title="No pending corrections"
          description="Teacher correction requests will appear here for review."
          icon={<ClipboardCheck size={32} />}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {corrections.map((correction) => {
            const reviewReason = reviewReasons[correction.id] ?? '';
            const isBusy = activeReview?.id === correction.id;
            const reasonMissing =
              reviewReason.trim().length > 0 && reviewReason.trim().length < 3;

            return (
              <article
                key={correction.id}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-black uppercase tracking-tight text-slate-950">
                        {correctionStudentName(correction)}
                      </h3>
                      <Badge variant="warning">{correction.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {formatDateTime(correction.attendanceDate)} · Requested{' '}
                      {formatDateTime(correction.requestedAt)}
                    </p>
                  </div>
                  <div className="rounded-md bg-slate-50 px-3 py-2 text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Status change
                    </p>
                    <p className="mt-1 text-xs font-black text-slate-800">
                      {correction.previousStatus ?? 'No record'} -&gt;{' '}
                      {correction.requestedStatus}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Teacher reason
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {correction.reason}
                  </p>
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Requested by{' '}
                    {correction.requestedBy?.email ?? 'school staff'}
                  </p>
                </div>

                <div className="mt-4 space-y-2">
                  <label
                    htmlFor={`correction-review-${correction.id}`}
                    className="text-[10px] font-black uppercase tracking-widest text-slate-500"
                  >
                    Review reason
                  </label>
                  <textarea
                    id={`correction-review-${correction.id}`}
                    value={reviewReason}
                    onChange={(event) =>
                      setReviewReasons((current) => ({
                        ...current,
                        [correction.id]: event.target.value,
                      }))
                    }
                    rows={3}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    placeholder="Required audit reason before approval or rejection..."
                  />
                  {reasonMissing ? (
                    <p className="text-xs font-semibold text-danger-700">
                      Add a clearer review reason before submitting.
                    </p>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => reviewCorrection(correction.id, 'APPROVED')}
                    disabled={isBusy || reviewReason.trim().length < 3}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CheckCircle2 size={15} />
                    {activeReview?.action === 'APPROVED' && isBusy
                      ? 'Approving...'
                      : 'Approve'}
                  </button>
                  <button
                    type="button"
                    onClick={() => reviewCorrection(correction.id, 'REJECTED')}
                    disabled={isBusy || reviewReason.trim().length < 3}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-danger-100 bg-danger-50 px-4 text-xs font-black uppercase tracking-widest text-danger-700 transition-colors hover:bg-danger-100 disabled:opacity-50"
                  >
                    <XCircle size={15} />
                    {activeReview?.action === 'REJECTED' && isBusy
                      ? 'Rejecting...'
                      : 'Reject'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

function correctionStudentName(correction: AttendanceCorrectionRequest) {
  const student = correction.student;
  const name = [student?.firstNameEn, student?.lastNameEn]
    .filter(Boolean)
    .join(' ')
    .trim();

  if (name) {
    return name;
  }

  return student?.studentSystemId ?? 'Student record';
}
