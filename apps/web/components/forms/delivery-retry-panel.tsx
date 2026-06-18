'use client';

import type { NotificationDeliveryFailureSummary } from '@schoolos/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { RefreshCcw, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { LoadingState } from '../ui/loading-state';
import { EmptyState } from '../ui/empty-state';
import { cn } from '../../lib/utils';

import { api } from '../../lib/api';
import { useSession } from '../session-provider';

const retryableStatuses = new Set([
  'FAILED',
  'RETRYING',
  'RETRY_PENDING',
  'QUEUED',
]);

type DeliveryRecord = {
  id: string;
  status: string;
  channel: string;
  sourceType: string;
  sourceId: string;
  noticeId?: string | null;
  eventId?: string | null;
  activityPostId?: string | null;
  destination?: string | null;
  title: string;
  body: string;
  errorMessage?: string | null;
  sentAt?: string | null;
  createdAt?: string | null;
  guardian?: {
    fullName?: string | null;
    primaryPhone?: string | null;
    email?: string | null;
  } | null;
  student?: {
    firstNameEn?: string | null;
    lastNameEn?: string | null;
    studentSystemId?: string | null;
  } | null;
};

type DeliveryRetryResult = {
  deliveryId: string;
  status: string;
  errorMessage: string | null;
  retriedAt: string;
};

type BulkDeliveryRetryResult = {
  requested: number;
  retried: number;
  results: DeliveryRetryResult[];
};

export function DeliveryRetryPanel() {
  const { status } = useSession();
  const queryClient = useQueryClient();
  const [batchRetryReason, setBatchRetryReason] = useState('');
  const [retryReasons, setRetryReasons] = useState<Record<string, string>>({});
  const deliveriesQuery = useQuery({
    queryKey: ['notification-deliveries'],
    queryFn: async () =>
      (await api.listNotificationDeliveries()) as DeliveryRecord[],
    enabled: status === 'authenticated',
  });
  const failuresQuery = useQuery({
    queryKey: ['notification-delivery-failures'],
    queryFn: api.listNotificationDeliveryFailures,
    enabled: status === 'authenticated',
  });

  const retryMutation = useMutation({
    mutationFn: ({
      deliveryId,
      reason,
    }: {
      deliveryId: string;
      reason: string;
    }) => api.retryNotificationDelivery(deliveryId, { reason }),
    onSuccess: (data) => {
      setRetryReasons((current) => {
        const next = { ...current };
        delete next[data.deliveryId];
        return next;
      });
      void queryClient.invalidateQueries({
        queryKey: ['notification-deliveries'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['notification-delivery-failures'],
      });
      void queryClient.invalidateQueries({ queryKey: ['notification-center'] });
    },
  });

  const retryAllMutation = useMutation({
    mutationFn: (reason: string) =>
      api.retryFailedNotificationDeliveries({ reason }),
    onSuccess: () => {
      setBatchRetryReason('');
      void queryClient.invalidateQueries({
        queryKey: ['notification-deliveries'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['notification-delivery-failures'],
      });
      void queryClient.invalidateQueries({ queryKey: ['notification-center'] });
    },
  });

  const deliveries = deliveriesQuery.data ?? [];
  const failureItems = failuresQuery.data?.items ?? [];
  const failureById = new Map<string, NotificationDeliveryFailureSummary>(
    failureItems.map((item) => [item.id, item]),
  );
  const failedDeliveries = deliveries.filter(
    (delivery) => delivery.status === 'FAILED',
  );
  const retryingDeliveries = deliveries.filter((delivery) =>
    ['RETRYING', 'RETRY_PENDING'].includes(delivery.status),
  );
  const retryableDeliveries = deliveries.filter((delivery) =>
    retryableStatuses.has(delivery.status),
  );

  return (
    <section className="shell-card rounded-2xl border border-[var(--color-mod-notices-border)] bg-white p-8 shadow-sm">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <span className="inline-flex rounded-full bg-rose-50 px-4 py-1.5 text-[0.65rem] font-black uppercase tracking-widest text-rose-700 border border-rose-100">
            Delivery Health
          </span>
          <h2 className="mt-4 text-2xl font-black text-slate-900">
            Retry failed records
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500">
            Manage and resolve delivery gaps. Failed notifications can be
            retried individually or in batches.
          </p>
        </div>

        <div className="w-full max-w-md space-y-3">
          <label className="block text-xs font-black uppercase tracking-widest text-slate-500">
            Batch retry reason
            <textarea
              value={batchRetryReason}
              onChange={(event) => setBatchRetryReason(event.target.value)}
              className="mt-2 min-h-20 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium normal-case tracking-normal text-slate-700 shadow-sm outline-none transition focus:border-[var(--color-mod-notices-accent)] focus:ring-2 focus:ring-[var(--color-mod-notices-accent)]/15"
              placeholder="Provider outage resolved after status check"
              maxLength={500}
            />
          </label>
          <button
            type="button"
            className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl bg-[var(--color-mod-notices-accent)] px-8 font-black text-xs uppercase tracking-widest text-white transition-all hover:bg-[var(--color-mod-notices-text)] shadow-sm active:scale-95 disabled:opacity-50"
            disabled={
              failedDeliveries.length === 0 ||
              !batchRetryReason.trim() ||
              retryAllMutation.isPending
            }
            onClick={() => retryAllMutation.mutate(batchRetryReason.trim())}
          >
            <RefreshCcw
              size={14}
              className={cn(
                'stroke-[3]',
                retryAllMutation.isPending ? 'animate-spin' : '',
              )}
            />
            {retryAllMutation.isPending
              ? 'Retrying Batch...'
              : `Retry All Failed (${failedDeliveries.length})`}
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        <RetryMetric
          label="Total Records"
          value={String(deliveries.length)}
          icon={<Clock size={16} />}
        />
        <RetryMetric
          label="Failed"
          value={String(failureItems.length || failedDeliveries.length)}
          tone="danger"
          icon={<AlertCircle size={16} />}
        />
        <RetryMetric
          label="Retrying"
          value={String(retryingDeliveries.length)}
          tone="warning"
          icon={<RefreshCcw size={16} />}
        />
        <RetryMetric
          label="Recoverable"
          value={String(retryableDeliveries.length)}
          tone="info"
          icon={<CheckCircle2 size={16} />}
        />
      </div>

      {retryMutation.isError ? (
        <InlineRetryMessage
          tone="error"
          message="This delivery could not be retried. Check the provider state and your permission, then try again."
        />
      ) : null}
      {retryAllMutation.isError ? (
        <InlineRetryMessage
          tone="error"
          message="Failed deliveries could not be retried. The backend may have blocked the provider or retry state."
        />
      ) : null}
      {retryMutation.isSuccess ? (
        <InlineRetryMessage
          tone="success"
          message={`Delivery retry completed with status ${retryMutation.data.status}.`}
        />
      ) : null}
      {retryAllMutation.isSuccess ? (
        <InlineRetryMessage
          tone="success"
          message={`Retry batch completed for ${retryAllMutation.data.retried} delivery record${retryAllMutation.data.retried === 1 ? '' : 's'}.`}
        />
      ) : null}
      <p className="mt-4 text-xs font-semibold text-slate-500">
        Retry reason is recorded in delivery audit metadata.
      </p>

      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/50">
        {deliveriesQuery.isLoading ? (
          <LoadingState
            variant="spinner"
            label="Gathering delivery history..."
          />
        ) : deliveriesQuery.isError ? (
          <div className="p-8 text-center">
            <p className="text-sm font-bold text-rose-600">
              Failed to sync delivery records.
            </p>
          </div>
        ) : failuresQuery.isError ? (
          <div className="p-8 text-center">
            <p className="text-sm font-bold text-rose-600">
              Failed to load delivery failure detail.
            </p>
          </div>
        ) : retryableDeliveries.length === 0 ? (
          <EmptyState
            title="All systems clear"
            description="No failed or retrying notifications found in recent history."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {retryableDeliveries.slice(0, 25).map((delivery) =>
              (() => {
                const failureDetail = failureById.get(delivery.id);
                return (
                  <article
                    key={delivery.id}
                    className="grid gap-4 bg-white p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={delivery.status} />
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-[0.68rem] font-semibold uppercase text-gray-500">
                          {delivery.channel}
                        </span>
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-[0.68rem] font-semibold text-gray-500">
                          {delivery.sourceType}
                        </span>
                      </div>
                      <h3 className="mt-2 truncate text-sm font-semibold text-gray-950">
                        {delivery.title}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-gray-500">
                        {failureDetail?.lastFailureReason ||
                          delivery.errorMessage ||
                          delivery.body}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                        <span>
                          {resolveRecipientLabel(
                            delivery,
                            failureDetail?.recipientSummary.destinationMasked,
                          )}
                        </span>
                        {failureDetail ? (
                          <span>
                            Retries: {failureDetail.retryCount} /{' '}
                            {formatRetryStatus(failureDetail.retryStatus)}
                          </span>
                        ) : null}
                        {delivery.noticeId ? (
                          <Link
                            href={`/dashboard/notices/${delivery.noticeId}`}
                            className="font-semibold text-[var(--color-mod-notices-text)] hover:text-[var(--color-mod-notices-accent)]"
                          >
                            Open source notice
                          </Link>
                        ) : null}
                      </div>
                    </div>

                    <div className="w-full max-w-xs space-y-2">
                      <label className="block text-[0.68rem] font-black uppercase tracking-widest text-slate-500">
                        Retry reason
                        <textarea
                          value={retryReasons[delivery.id] ?? ''}
                          onChange={(event) =>
                            setRetryReasons((current) => ({
                              ...current,
                              [delivery.id]: event.target.value,
                            }))
                          }
                          className="mt-2 min-h-20 w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm font-medium normal-case tracking-normal text-gray-700 outline-none transition focus:border-[var(--color-mod-notices-accent)] focus:ring-2 focus:ring-[var(--color-mod-notices-accent)]/15"
                          placeholder="Reason for retry"
                          maxLength={500}
                        />
                      </label>
                      <button
                        type="button"
                        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={
                          retryMutation.isPending ||
                          !(retryReasons[delivery.id] ?? '').trim()
                        }
                        onClick={() =>
                          retryMutation.mutate({
                            deliveryId: delivery.id,
                            reason: (retryReasons[delivery.id] ?? '').trim(),
                          })
                        }
                      >
                        <RefreshCcw
                          size={16}
                          className={
                            retryMutation.isPending ? 'animate-spin' : ''
                          }
                        />
                        Retry
                      </button>
                    </div>
                  </article>
                );
              })(),
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function RetryMetric({
  label,
  value,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: 'neutral' | 'danger' | 'warning' | 'info';
}) {
  const toneClass = {
    neutral: 'bg-slate-50 text-slate-700 border-slate-100',
    danger: 'bg-rose-50 text-rose-700 border-rose-100',
    warning: 'bg-amber-50 text-amber-700 border-amber-100',
    info: 'bg-[var(--color-mod-notices-bg)] text-[var(--color-mod-notices-text)] border-[var(--color-mod-notices-border)]',
  }[tone];

  return (
    <div
      className={cn(
        'rounded-2xl p-5 border transition-all hover:shadow-md hover:shadow-slate-200/50 group',
        toneClass,
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">
          {label}
        </p>
        <span className="opacity-40 group-hover:opacity-100 transition-opacity">
          {icon}
        </span>
      </div>
      <p className="mt-2 text-2xl font-black tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'FAILED'
      ? 'bg-rose-100 text-rose-700'
      : status === 'RETRYING' || status === 'RETRY_PENDING'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-blue-100 text-blue-700';

  return (
    <span
      className={`rounded-full px-2 py-1 text-[0.68rem] font-bold uppercase ${tone}`}
    >
      {status}
    </span>
  );
}

function InlineRetryMessage({
  tone,
  message,
}: {
  tone: 'success' | 'error';
  message: string;
}) {
  return (
    <div
      className={`mt-4 rounded-2xl px-4 py-3 text-sm font-medium ${
        tone === 'success'
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-rose-50 text-rose-700'
      }`}
    >
      {message}
    </div>
  );
}

function resolveRecipientLabel(
  delivery: DeliveryRecord,
  maskedDestination?: string | null,
) {
  const guardianName = delivery.guardian?.fullName;
  const studentName = [
    delivery.student?.firstNameEn,
    delivery.student?.lastNameEn,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  if (guardianName && studentName) {
    return `${guardianName} / ${studentName}`;
  }

  return (
    guardianName ||
    studentName ||
    maskedDestination ||
    'Recipient unavailable'
  );
}

function formatRetryStatus(status: string) {
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
