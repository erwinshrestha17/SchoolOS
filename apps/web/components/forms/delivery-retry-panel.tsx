'use client';

import type { ApiResponse } from '@schoolos/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { RefreshCcw } from 'lucide-react';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

const retryableStatuses = new Set(['FAILED', 'RETRYING', 'QUEUED']);

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
  const queryClient = useQueryClient();
  const deliveriesQuery = useQuery({
    queryKey: ['notification-deliveries'],
    queryFn: listNotificationDeliveries,
  });

  const retryMutation = useMutation({
    mutationFn: retryDelivery,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notification-deliveries'] });
      void queryClient.invalidateQueries({ queryKey: ['notification-center'] });
    },
  });

  const retryAllMutation = useMutation({
    mutationFn: retryFailedDeliveries,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notification-deliveries'] });
      void queryClient.invalidateQueries({ queryKey: ['notification-center'] });
    },
  });

  const deliveries = deliveriesQuery.data ?? [];
  const failedDeliveries = deliveries.filter((delivery) => delivery.status === 'FAILED');
  const retryingDeliveries = deliveries.filter((delivery) => delivery.status === 'RETRYING');
  const retryableDeliveries = deliveries.filter((delivery) =>
    retryableStatuses.has(delivery.status),
  );

  return (
    <section className="rounded-[30px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <span className="inline-flex rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-100">
            Delivery Retry / Resend
          </span>
          <h2 className="mt-3 text-xl font-bold text-gray-950">
            Failed and retrying delivery records
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
            Retry failed notification deliveries without rebuilding notices. All retry actions use tenant-scoped backend endpoints and are audited.
          </p>
        </div>

        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={failedDeliveries.length === 0 || retryAllMutation.isPending}
          onClick={() => retryAllMutation.mutate()}
        >
          <RefreshCcw size={16} className={retryAllMutation.isPending ? 'animate-spin' : ''} />
          {retryAllMutation.isPending
            ? 'Retrying failed...'
            : `Retry all failed (${failedDeliveries.length})`}
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <RetryMetric label="Total" value={String(deliveries.length)} />
        <RetryMetric label="Failed" value={String(failedDeliveries.length)} tone="danger" />
        <RetryMetric label="Retrying" value={String(retryingDeliveries.length)} tone="warning" />
        <RetryMetric label="Retryable" value={String(retryableDeliveries.length)} tone="info" />
      </div>

      {retryMutation.isError ? (
        <InlineRetryMessage tone="error" message={retryMutation.error.message} />
      ) : null}
      {retryAllMutation.isError ? (
        <InlineRetryMessage tone="error" message={retryAllMutation.error.message} />
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

      <div className="mt-5 overflow-hidden rounded-3xl border border-gray-100">
        {deliveriesQuery.isLoading ? (
          <div className="p-6 text-sm text-gray-500">Loading delivery records...</div>
        ) : deliveriesQuery.isError ? (
          <div className="p-6 text-sm text-rose-700">
            Could not load delivery records: {deliveriesQuery.error.message}
          </div>
        ) : retryableDeliveries.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-gray-950">No failed or retrying deliveries</p>
            <p className="mt-1 text-sm text-gray-500">
              Delivery records that need manual retry will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {retryableDeliveries.slice(0, 25).map((delivery) => (
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
                    {delivery.errorMessage || delivery.body}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                    <span>{resolveRecipientLabel(delivery)}</span>
                    {delivery.noticeId ? (
                      <Link
                        href={`/dashboard/notices/${delivery.noticeId}`}
                        className="font-semibold text-primary-700 hover:text-primary-800"
                      >
                        Open source notice
                      </Link>
                    ) : null}
                  </div>
                </div>

                <button
                  type="button"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={retryMutation.isPending}
                  onClick={() => retryMutation.mutate(delivery.id)}
                >
                  <RefreshCcw
                    size={16}
                    className={retryMutation.isPending ? 'animate-spin' : ''}
                  />
                  Retry
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function RetryMetric({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'danger' | 'warning' | 'info';
}) {
  const toneClass = {
    neutral: 'bg-gray-50 text-gray-700',
    danger: 'bg-rose-50 text-rose-700',
    warning: 'bg-amber-50 text-amber-700',
    info: 'bg-blue-50 text-blue-700',
  }[tone];

  return (
    <div className={`rounded-2xl p-4 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'FAILED'
      ? 'bg-rose-100 text-rose-700'
      : status === 'RETRYING'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-blue-100 text-blue-700';

  return (
    <span className={`rounded-full px-2 py-1 text-[0.68rem] font-bold uppercase ${tone}`}>
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

function resolveRecipientLabel(delivery: DeliveryRecord) {
  const guardianName = delivery.guardian?.fullName;
  const studentName = [delivery.student?.firstNameEn, delivery.student?.lastNameEn]
    .filter(Boolean)
    .join(' ')
    .trim();

  if (guardianName && studentName) {
    return `${guardianName} / ${studentName}`;
  }

  return guardianName || studentName || delivery.destination || 'Recipient unavailable';
}

async function listNotificationDeliveries() {
  return requestEnvelope<DeliveryRecord[]>('/communications/deliveries');
}

async function retryDelivery(deliveryId: string) {
  return requestEnvelope<DeliveryRetryResult>(
    `/communications/deliveries/${encodeURIComponent(deliveryId)}/retry`,
    { method: 'POST' },
  );
}

async function retryFailedDeliveries() {
  return requestEnvelope<BulkDeliveryRetryResult>(
    '/communications/deliveries/retry-failed',
    { method: 'POST' },
  );
}

async function requestEnvelope<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(parseApiErrorMessage(text) || `Request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as ApiResponse<T>;
  return payload.data;
}

function parseApiErrorMessage(text: string) {
  if (!text) {
    return '';
  }

  try {
    const payload = JSON.parse(text) as { message?: string | string[]; error?: string };
    return Array.isArray(payload.message)
      ? payload.message.join(', ')
      : payload.message || payload.error || text;
  } catch {
    return text;
  }
}
