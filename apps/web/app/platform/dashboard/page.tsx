'use client';

import { useQuery } from '@tanstack/react-query';
import { Link2, ServerCog, ShieldCheck, Users } from 'lucide-react';
import { ErrorState } from '../../../components/ui/error-state';
import { LoadingState } from '../../../components/ui/loading-state';
import { ModuleHeader } from '../../../components/ui/module-header';
import { RefreshSummaryButton } from '../../../components/ui/operational-summary';
import { SectionCard } from '../../../components/ui/section-card';
import { api } from '../../../lib/api';

export default function PlatformDashboard() {
  const summaryQuery = useQuery({
    queryKey: ['platform-operational-summary'],
    queryFn: api.getPlatformSummary,
    staleTime: 30_000,
  });

  if (summaryQuery.isLoading) {
    return <PlatformDashboardSkeleton />;
  }

  if (summaryQuery.isError || !summaryQuery.data) {
    return (
      <ErrorState
        title="Could not load platform operations"
        message="Please retry. Tenant, provider, and queue data remain protected."
        onRetry={() => void summaryQuery.refetch()}
      />
    );
  }

  const summary = summaryQuery.data as unknown as Record<string, unknown>;
  const cards = [
    { label: 'Active schools', key: 'activeTenants', icon: Users },
    { label: 'Suspended schools', key: 'suspendedTenants', icon: ShieldCheck },
    { label: 'Failed jobs', key: 'failedJobsCount', icon: ServerCog },
    { label: 'Onboarding follow-up', key: 'onboardingIncompleteTenants', icon: Link2 },
  ];
  const usageWarnings = asArray(summary.usageWarnings);
  const recentAudit = asArray(summary.recentAudit ?? summary.recentAuditLogs).slice(0, 5);

  return (
    <div className="space-y-6">
      <ModuleHeader
        eyebrow="Platform control plane"
        title="Operator Attention Dashboard"
        description="Tenant lifecycle, provider readiness, queues, usage warning review, and SchoolOS SaaS operations. School fee collection is not shown here."
        primaryAction={
          <RefreshSummaryButton
            onClick={() => void summaryQuery.refetch()}
            isLoading={summaryQuery.isFetching}
          />
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <SectionCard key={card.key} className="min-h-[144px]" noPadding>
              <div className="flex h-full items-start justify-between p-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{card.label}</p>
                  <p className="mt-3 text-3xl font-black text-slate-950">{displayValue(summary[card.key])}</p>
                </div>
                <Icon className="h-5 w-5 text-slate-500" />
              </div>
            </SectionCard>
          );
        })}
      </div>

      <SectionCard
        title="Attention queue"
        description="Prioritized operator follow-up across tenant lifecycle, provider issues, queue health, and the SaaS billing boundary."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <AttentionQueueItem
            label="Overdue SaaS invoices"
            value={displayValue(summary.overdueSaasInvoices ?? summary.overdueInvoices)}
            detail="SchoolOS subscription billing only. M3 student fee collection and M11 school accounting stay inside the school workspace."
          />
          <AttentionQueueItem
            label="Provider issues"
            value={displayValue(summary.providerIssues ?? summary.providerIssueCount)}
            detail="Provider readiness is reviewed without exposing credentials, callback secrets, or tenant-private records."
          />
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Usage and readiness follow-up"
          description="Provider and plan warnings are presented without credentials or private tenant payloads."
        >
          {usageWarnings.length ? (
            <ul className="space-y-2">
              {usageWarnings.slice(0, 8).map((warning, index) => (
                <li key={index} className="rounded-lg border border-warning-100 bg-warning-50 p-3 text-sm text-warning-900">
                  {safeText(warning)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No usage warnings need attention right now.</p>
          )}
        </SectionCard>

        <SectionCard
          title="Recent platform activity"
          description="Bounded audit activity without secret values, raw provider payloads, or tenant-private records."
        >
          {recentAudit.length ? (
            <ul className="space-y-2">
              {recentAudit.map((item, index) => (
                <li key={index} className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
                  {safeText(item)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No recent platform activity is available.</p>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="SaaS billing boundary"
        description="Platform operators manage SchoolOS subscriptions, provider readiness, and tenant lifecycle here. M3 student fee collection and M11 school accounting remain separate school-owned workflows."
      >
        <p className="rounded-xl border border-[var(--color-mod-platform-accent)] bg-[var(--color-mod-platform-bg)] p-4 text-sm font-semibold text-[var(--color-mod-platform-text)]">
          Use this page for operator attention only; do not inspect or reconcile school-private fee, payroll, or journal data from the platform plane.
        </p>
      </SectionCard>
    </div>
  );
}

function PlatformDashboardSkeleton() {
  return <LoadingState variant="page" label="Loading platform operations..." />;
}

function AttentionQueueItem({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-black uppercase tracking-wide text-[var(--color-mod-platform-text)]">
        {label}
      </p>
      <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
    </div>
  );
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function displayValue(value: unknown): string {
  if (typeof value === 'number' || typeof value === 'string') return String(value);
  return '—';
}

function safeText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['label', 'message', 'action', 'eventType', 'description']) {
      if (typeof record[key] === 'string') return record[key] as string;
    }
  }
  return 'Platform update available.';
}
