'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, Ban, Clock, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { Progress } from '@/components/ui/primitives/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/primitives/alert';
import { Button } from '@/components/ui/primitives/button';

export type BackgroundJobStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'PARTIALLY_SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

export type BackgroundJobCounts = {
  total: number;
  processed: number;
  failed?: number;
};

export type QueuedJobStateProps = {
  status: BackgroundJobStatus;
  /** School-friendly description of what the job does, e.g. "Generating report cards". */
  label: string;
  counts?: BackgroundJobCounts;
  /** Backend-provided failure reasons for a partial failure — never invented in the browser. */
  failureItems?: { label: string; reason: string }[];
  errorMessage?: string;
  queuedAt?: string;
  updatedAt?: string;
  onRetry?: () => void;
  onCancel?: () => void;
  onViewDetails?: () => void;
  className?: string;
};

const statusCopy: Record<BackgroundJobStatus, string> = {
  QUEUED: 'Waiting in the queue. This will start shortly.',
  PROCESSING: 'This is running now. You can keep working — it will finish in the background.',
  SUCCEEDED: 'Completed successfully.',
  PARTIALLY_SUCCEEDED: 'Finished, but some items need attention.',
  FAILED: 'This did not complete. You can try again.',
  CANCELLED: 'This was cancelled before it finished.',
  EXPIRED: 'This is no longer available. Please start it again.',
};

/**
 * Backend-owned background-job status for exports, imports, generation and
 * dispatch jobs (report cards, payroll, bank statement imports, iEMIS
 * exports, notice dispatch, ...). Never simulates progress client-side —
 * `counts`/`status` must come from the job's real backend state.
 */
export function QueuedJobState({
  status,
  label,
  counts,
  failureItems,
  errorMessage,
  queuedAt,
  updatedAt,
  onRetry,
  onCancel,
  onViewDetails,
  className,
}: QueuedJobStateProps) {
  const percent =
    counts && counts.total > 0 ? Math.round((counts.processed / counts.total) * 100) : undefined;
  const isTerminal = status === 'SUCCEEDED' || status === 'FAILED' || status === 'CANCELLED' || status === 'EXPIRED';
  const canRetry = onRetry && (status === 'FAILED' || status === 'EXPIRED' || status === 'PARTIALLY_SUCCEEDED');
  const canCancel = onCancel && (status === 'QUEUED' || status === 'PROCESSING');

  return (
    <div className={cn('rounded-2xl border border-slate-100 bg-white p-4', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-slate-900">{label}</p>
            <StatusBadge status={status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">{statusCopy[status]}</p>
        </div>
        <div className="flex items-center gap-2">
          {canCancel ? (
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              <Ban className="size-3.5" />
              Cancel
            </Button>
          ) : null}
          {canRetry ? (
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="size-3.5" />
              Retry
            </Button>
          ) : null}
          {onViewDetails ? (
            <Button type="button" variant="ghost" size="sm" onClick={onViewDetails}>
              View details
            </Button>
          ) : null}
        </div>
      </div>

      {!isTerminal && counts ? (
        <div className="mt-3 space-y-1.5">
          <Progress value={percent} />
          <p className="text-xs font-medium text-slate-400">
            {counts.processed} of {counts.total} processed
            {typeof counts.failed === 'number' && counts.failed > 0 ? ` · ${counts.failed} failed` : ''}
          </p>
        </div>
      ) : null}

      {status === 'FAILED' && errorMessage ? (
        <Alert variant="destructive" className="mt-3">
          <AlertTriangle />
          <AlertTitle>This job failed</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {status === 'PARTIALLY_SUCCEEDED' && failureItems && failureItems.length > 0 ? (
        <Alert className="mt-3">
          <AlertTriangle />
          <AlertTitle>
            {failureItems.length} {failureItems.length === 1 ? 'item needs' : 'items need'} attention
          </AlertTitle>
          <AlertDescription>
            <ul className="w-full list-disc space-y-1 pl-4">
              {failureItems.slice(0, 5).map((item, index) => (
                <li key={index}>
                  <span className="font-semibold text-foreground">{item.label}:</span> {item.reason}
                </li>
              ))}
            </ul>
            {failureItems.length > 5 ? (
              <p className="mt-1 text-xs">
                +{failureItems.length - 5} more — {onViewDetails ? 'view details for the full list.' : 'download the report for the full list.'}
              </p>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {(queuedAt || updatedAt) ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
          <Clock className="size-3.5" />
          {queuedAt ? `Queued ${queuedAt}` : null}
          {queuedAt && updatedAt ? ' · ' : null}
          {updatedAt ? `Updated ${updatedAt}` : null}
        </p>
      ) : null}
    </div>
  );
}

export type JobHistoryRow = {
  id: string;
  label: string;
  status: BackgroundJobStatus;
  requestedBy?: string;
  queuedAt: string;
  finishedAt?: string;
};

export type JobHistoryListProps = {
  jobs: JobHistoryRow[];
  onSelectJob?: (job: JobHistoryRow) => void;
  emptyMessage?: string;
  className?: string;
};

/** Bounded recent-job list. For a growing/filterable job log, use PaginatedDataTable instead. */
export function JobHistoryList({ jobs, onSelectJob, emptyMessage = 'No recent jobs.', className }: JobHistoryListProps) {
  if (jobs.length === 0) {
    return <p className={cn('py-6 text-center text-sm text-slate-400', className)}>{emptyMessage}</p>;
  }

  return (
    <ul className={cn('divide-y divide-slate-100', className)}>
      {jobs.map((job) => (
        <JobHistoryRowItem key={job.id} job={job} onSelect={onSelectJob} />
      ))}
    </ul>
  );
}

function JobHistoryRowItem({ job, onSelect }: { job: JobHistoryRow; onSelect?: (job: JobHistoryRow) => void }) {
  const content: ReactNode = (
    <>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-800">{job.label}</p>
        <p className="mt-0.5 text-xs text-slate-400">
          {job.requestedBy ? `${job.requestedBy} · ` : ''}
          {job.queuedAt}
          {job.finishedAt ? ` → ${job.finishedAt}` : ''}
        </p>
      </div>
      <StatusBadge status={job.status} />
    </>
  );

  if (onSelect) {
    return (
      <li>
        <button
          type="button"
          onClick={() => onSelect(job)}
          className="flex w-full items-center justify-between gap-3 px-1 py-3 text-left transition-colors hover:bg-slate-50/70"
        >
          {content}
        </button>
      </li>
    );
  }

  return <li className="flex items-center justify-between gap-3 px-1 py-3">{content}</li>;
}
