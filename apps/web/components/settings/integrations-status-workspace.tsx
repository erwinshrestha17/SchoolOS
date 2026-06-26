'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type {
  SchoolIntegrationStatusItem,
  SchoolIntegrationStatusLabel,
  SchoolIntegrationStatusSignal,
} from '@schoolos/core';
import {
  ArrowLeft,
  BellRing,
  Cable,
  CheckCircle2,
  CreditCard,
  RefreshCcw,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { Badge, type BadgeProps } from '../ui/badge';
import { Button } from '../ui/button';
import { ErrorState } from '../ui/error-state';
import { LoadingState } from '../ui/loading-state';
import { ModuleLockedState } from '../ui/module-locked-state';
import { PageHeader } from '../ui/page-header';
import { ApiRequestError } from '../../lib/api/client';
import { schoolSettingsApi } from '../../lib/api/school-settings';
import { formatDateTime } from '../../lib/utils';

const statusOrder: SchoolIntegrationStatusLabel[] = [
  'disabled',
  'dev-log',
  'mock',
  'configured',
  'needs attention',
  'unavailable',
];

const iconByItem = {
  'payment-gateway': CreditCard,
  'notification-providers': BellRing,
  'attendance-devices': Smartphone,
} as const;

export function IntegrationsStatusWorkspace() {
  const integrationsQuery = useQuery({
    queryKey: ['school-settings', 'integrations'],
    queryFn: schoolSettingsApi.getSchoolIntegrationsStatus,
  });

  if (integrationsQuery.isLoading) {
    return (
      <div className="p-6">
        <LoadingState variant="skeleton" label="Loading integration status" />
      </div>
    );
  }

  if (integrationsQuery.isError || !integrationsQuery.data) {
    if (isLockedError(integrationsQuery.error)) {
      return (
        <div className="p-6">
          <ModuleLockedState
            moduleName="Integrations settings"
            description="This settings workspace is blocked by school permissions or module entitlements. No integration provider details are shown."
            secondaryAction={
              <Button
                type="button"
                variant="outline"
                onClick={() => void integrationsQuery.refetch()}
              >
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </Button>
            }
          />
        </div>
      );
    }

    return (
      <div className="p-6">
        <ErrorState
          title="Could not load integrations"
          message="Please retry to load school-visible integration status."
          error={integrationsQuery.error}
          onRetry={() => void integrationsQuery.refetch()}
        />
      </div>
    );
  }

  const status = integrationsQuery.data;
  const attentionCount = status.items.filter(
    (item) => item.status === 'needs attention',
  ).length;

  return (
    <div className="space-y-6 p-6 pb-24">
      <PageHeader
        title="Integrations"
        description="Review safe school-visible integration modes for this school without credentials or platform controls."
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => void integrationsQuery.refetch()}
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
            <Link
              href="/dashboard/settings"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              All settings
            </Link>
          </>
        }
      />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-blue-950">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
            <div>
              <p className="font-bold">Secret-free school status</p>
              <p className="mt-1 text-sm leading-6">
                This page only shows tenant-scoped labels: disabled, dev-log,
                mock, configured, needs attention, or unavailable.
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">Needs attention</p>
          <p className="mt-2 text-3xl font-black text-slate-950">
            {attentionCount}
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Provider areas that need backend validation before live use.
          </p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {status.items.map((item) => (
          <IntegrationCard key={item.id} item={item} />
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <Cable className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
          <div>
            <h2 className="font-bold text-slate-950">Boundary</h2>
            <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-600 md:grid-cols-2">
              {status.safetyNotes.map((note) => (
                <li key={note} className="flex gap-2">
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs font-semibold text-slate-500">
              Last checked {formatDateTime(status.generatedAt)}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function IntegrationCard({ item }: { item: SchoolIntegrationStatusItem }) {
  const Icon = iconByItem[item.id];
  return (
    <article className="flex min-h-[360px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>
        <StatusBadge status={item.status} />
      </div>
      <div className="mt-5">
        <h2 className="text-lg font-bold text-slate-950">{item.title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {item.description}
        </p>
        <p className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
          {item.message}
        </p>
      </div>
      <div className="mt-5 flex-1 space-y-3">
        {item.signals.map((signal) => (
          <SignalRow key={signal.id} signal={signal} />
        ))}
      </div>
      <p className="mt-5 border-t border-slate-100 pt-3 text-xs font-semibold text-slate-500">
        Checked {formatDateTime(item.checkedAt)}
        {item.observedAt ? ` / observed ${formatDateTime(item.observedAt)}` : ''}
      </p>
    </article>
  );
}

function SignalRow({ signal }: { signal: SchoolIntegrationStatusSignal }) {
  return (
    <div className="rounded-xl border border-slate-100 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-slate-900">{signal.label}</p>
        <StatusBadge status={signal.status} />
      </div>
      <p className="mt-2 text-sm leading-5 text-slate-600">{signal.message}</p>
      {signal.observedAt ? (
        <p className="mt-2 text-xs font-semibold text-slate-500">
          Observed {formatDateTime(signal.observedAt)}
        </p>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: SchoolIntegrationStatusLabel }) {
  return <Badge variant={badgeVariant(status)}>{status}</Badge>;
}

function badgeVariant(
  status: SchoolIntegrationStatusLabel,
): BadgeProps['variant'] {
  if (status === 'configured') return 'success';
  if (status === 'needs attention') return 'warning';
  if (status === 'unavailable') return 'neutral';
  if (status === 'disabled') return 'outline';
  if (status === 'mock' || status === 'dev-log') return 'info';
  return 'neutral';
}

export function isKnownIntegrationStatus(value: string) {
  return statusOrder.includes(value as SchoolIntegrationStatusLabel);
}

function isLockedError(error: unknown) {
  return (
    error instanceof ApiRequestError &&
    (error.statusCode === 403 || error.statusCode === 423)
  );
}
