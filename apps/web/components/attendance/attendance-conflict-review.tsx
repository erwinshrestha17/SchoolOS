'use client';

import type { AttendanceConflict } from '@schoolos/core';
import { SectionCard } from '@/components/ui/section-card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

interface AttendanceConflictReviewProps {
  conflicts: AttendanceConflict[];
}

export function AttendanceConflictReview({
  conflicts,
}: AttendanceConflictReviewProps) {
  const queryClient = useQueryClient();

  const reviewMutation = useMutation({
    mutationFn: ({
      id,
      resolutionNote,
    }: {
      id: string;
      resolutionNote: string;
    }) => api.reviewAttendanceConflict(id, { resolutionNote }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['attendance-conflicts'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['attendance-analytics'],
      });
    },
  });

  return (
    <SectionCard
      title="Conflict Review Queue"
      description="Resolve duplicate or flagged attendance submissions"
    >
      <div className="space-y-4">
        {conflicts.map((conflict) => (
          <div
            key={conflict.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-white border border-slate-100 rounded-2xl transition-all hover:border-slate-200"
          >
            <div className="mb-4 sm:mb-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-bold text-slate-900">
                  {conflict.className ?? 'Class'}
                  {conflict.sectionName ? ` / ${conflict.sectionName}` : ''}
                </p>
                <Badge variant="warning">{conflict.status}</Badge>
              </div>
              <p className="text-xs text-slate-500">
                Submitted {formatDateTime(conflict.submittedAt)}
              </p>
            </div>

            {!conflict.reviewedAt && (
              <button
                onClick={() =>
                  reviewMutation.mutate({
                    id: conflict.id,
                    resolutionNote:
                      'Reviewed and resolved via dashboard review queue.',
                  })
                }
                disabled={reviewMutation.isPending}
                className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                {reviewMutation.isPending ? (
                  'Resolving...'
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    Mark Resolved
                  </>
                )}
              </button>
            )}
          </div>
        ))}
        {conflicts.length === 0 && (
          <div className="text-center py-8">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-500 mb-3">
              <CheckCircle2 size={24} />
            </div>
            <p className="text-sm font-bold text-slate-900">
              No Pending Conflicts
            </p>
            <p className="text-xs text-slate-500 mt-1">
              All attendance sessions are consistent.
            </p>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
