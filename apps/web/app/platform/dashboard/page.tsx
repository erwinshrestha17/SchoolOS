'use client';

import type { PlatformDashboardSummary } from '@schoolos/core';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BellRing,
  CheckCircle2,
  Clock3,
  CreditCard,
  Database,
  FileClock,
  School,
  ShieldCheck,
  Users,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '../../../lib/api';

export default function PlatformDashboard() {
  const [summary, setSummary] = useState<PlatformDashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .getPlatformDashboard()
      .then(setSummary)
      .catch((err) => setError(err.message ?? 'Failed to load platform dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (error) {
    return (
      <div className="rounded-2xl border border-danger-200 bg-danger-50 p-8 text-danger-900">
        <div className="flex items-center gap-3 font-bold">
          <AlertTriangle size={20} />
          Dashboard unavailable
        </div>
        <p className="mt-2 text-sm">{error}</p>
        <Button className="mt-4" variant="outline" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </div>
    );
  }

  if (loading || !summary) {
    return <PlatformDashboardSkeleton />;
  }

  const s = summary as any;
  const usageWarnings = asArray(s.usageWarnings);
  const recentAudit = asArray(s.recentAudit ?? s.recentAuditLogs);
  const overdueInvoices = Number(
    s.saasInvoices?.overdueCount ?? s.invoiceSummary?.overdueCount ?? s.overdueInvoicesCount ?? 0,
  );
  const unpaidAmount = Number(
    s.saasInvoices?.unpaidAmount ?? s.invoiceSummary?.unpaidAmount ?? s.unpaidInvoiceAmount ?? 0,
  );
  const failedJobs = Number(s.failedJobsCount ?? s.queues?.failedJobsCount ?? 0);
  const providerIssues = getProviderIssueCount(s);
  const onboardingIncomplete = Number(
    s.onboardingIncompleteTenants ?? s.onboarding?.incompleteTenants ?? 0,
  );

  const kpis = [
    {
      label: 'Active schools',
      value: s.activeTenants ?? 0,
      helper: `${s.totalTenants ?? 0} total schools`,
      icon: ShieldCheck,
      tone: 'text-success-700',
    },
    {
      label: 'Suspended schools',
      value: s.suspendedTenants ?? 0,
      helper: 'Require lifecycle review',
      icon: Activity,
      tone: 'text-amber-700',
    },
    {
      label: 'Overdue SaaS invoices',
      value: overdueInvoices,
      helper: formatMoney(unpaidAmount),
      icon: CreditCard,
      tone: overdueInvoices > 0 ? 'text-danger-700' : 'text-slate-600',
    },
    {
      label: 'Failed jobs',
      value: failedJobs,
      helper: 'Retry actions are audited',
      icon: Zap,
      tone: failedJobs > 0 ? 'text-danger-700' : 'text-slate-600',
    },
  ];

  const attentionItems = [
    failedJobs > 0
      ? {
          title: `${failedJobs} failed background job${failedJobs === 1 ? '' : 's'}`,
          description: 'Inspect redacted payloads and retry only with an audit reason.',
          href: '/platform/settings?tab=queues',
          badge: 'Queues',
          urgent: true,
        }
      : null,
    overdueInvoices > 0
      ? {
          title: `${overdueInvoices} overdue SaaS invoice${overdueInvoices === 1 ? '' : 's'}`,
          description: 'Review SchoolOS subscription billing risk. This is not student fee collection.',
          href: '/platform/billing/invoices',
          badge: 'Billing',
          urgent: true,
        }
      : null,
    providerIssues > 0
      ? {
          title: `${providerIssues} provider readiness issue${providerIssues === 1 ? '' : 's'}`,
          description: 'Check SMS, email, storage, and infrastructure readiness before pilot use.',
          href: '/platform/settings/providers',
          badge: 'Providers',
          urgent: true,
        }
      : null,
    usageWarnings.length > 0
      ? {
          title: `${usageWarnings.length} usage warning${usageWarnings.length === 1 ? '' : 's'}`,
          description: 'Some tenants are near configured plan limits and may need review.',
          href: '/platform/schools',
          badge: 'Usage',
          urgent: false,
        }
      : null,
    onboardingIncomplete > 0
      ? {
          title: `${onboardingIncomplete} onboarding checklist${onboardingIncomplete === 1 ? '' : 's'} incomplete`,
          description: 'Help schools complete setup before live pilot operations.',
          href: '/platform/schools',
          badge: 'Onboarding',
          urgent: false,
        }
      : null,
  ].filter(Boolean) as Array<{
    title: string;
    description: string;
    href: string;
    badge: string;
    urgent: boolean;
  }>;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Badge variant="neutral">Platform Control Plane</Badge>
          <h1 className="mt-3 text-[30px] font-extrabold leading-[38px] text-slate-900">
            Operator Attention Dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-slate-500">
            A focused command center for tenant lifecycle, SaaS billing risk,
            provider readiness, queue failures, usage warnings, and audited
            platform activity.
          </p>
        </div>
        <Link href="/platform/schools">
          <Button className="gap-2 rounded-2xl bg-[var(--color-mod-platform-accent)] px-6 font-bold hover:bg-[var(--color-mod-platform-text)]">
            View Schools
            <ArrowRight size={18} />
          </Button>
        </Link>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  {kpi.label}
                </p>
                <p className="mt-2 text-[30px] font-extrabold leading-[38px] text-slate-900 tabular-nums">
                  {formatValue(kpi.value)}
                </p>
                <p className="mt-1 text-sm font-medium text-slate-500">{kpi.helper}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <kpi.icon className={kpi.tone} size={24} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-mod-platform-text">
                <BellRing size={16} />
                Attention queue
              </div>
              <h2 className="mt-2 text-xl font-bold leading-7 text-slate-900">
                What needs operator action
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Prioritized platform risks across billing, queues, providers,
                onboarding, and usage limits.
              </p>
            </div>
            <Link href="/platform/schools" className="text-sm font-bold text-indigo-600 hover:text-indigo-700">
              Open tenant directory
            </Link>
          </div>

          <div className="mt-6 space-y-3">
            {attentionItems.length > 0 ? (
              attentionItems.map((item) => (
                <Link
                  key={`${item.badge}:${item.title}`}
                  href={item.href}
                  className="group flex items-start justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-colors hover:border-mod-platform-border hover:bg-mod-platform-soft focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={item.urgent ? 'destructive' : 'neutral'}>{item.badge}</Badge>
                      <h3 className="font-bold text-slate-900">{item.title}</h3>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                  </div>
                  <ArrowRight className="mt-1 shrink-0 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-mod-platform-text" size={18} />
                </Link>
              ))
            ) : (
              <div className="rounded-2xl border border-success-100 bg-success-50 p-5 text-success-900">
                <div className="flex items-center gap-3 font-bold">
                  <CheckCircle2 size={20} />
                  No urgent platform actions right now
                </div>
                <p className="mt-2 text-sm text-success-700">
                  Queue failures, provider readiness, usage warnings, overdue
                  SaaS invoices, and onboarding issues are currently clear.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold leading-7 text-slate-900">System readiness</h2>
                <p className="mt-1 text-sm text-slate-500">Operational dependencies for platform workflows.</p>
              </div>
              <Link href="/platform/settings?tab=health" className="text-sm font-bold text-indigo-600 hover:text-indigo-700">
                Details
              </Link>
            </div>
            <div className="mt-5 space-y-3">
              <ReadinessRow label="Queue health" value={`${failedJobs} failed`} warning={failedJobs > 0} />
              <ReadinessRow label="Provider issues" value={`${providerIssues} issue${providerIssues === 1 ? '' : 's'}`} warning={providerIssues > 0} />
              <ReadinessRow label="Storage tracked" value={formatBytes(s.usage?.totalStorageBytes || 0)} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              <CreditCard size={16} />
              SaaS billing boundary
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Platform billing is SchoolOS-to-school subscription billing. It is
              intentionally separate from M3 student fee collection and M11 school
              accounting ledgers.
            </p>
            <Link href="/platform/billing" className="mt-4 inline-flex text-sm font-bold text-indigo-600 hover:text-indigo-700">
              Open SaaS billing
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              <FileClock size={16} />
              Recent platform audit
            </div>
            <h2 className="mt-2 text-xl font-bold leading-7 text-slate-900">Who did what recently</h2>
          </div>
          <Link href="/platform/audit" className="text-sm font-bold text-indigo-600 hover:text-indigo-700">
            View full audit
          </Link>
        </div>
        <div className="mt-6 space-y-3">
          {recentAudit.length ? (
            recentAudit.slice(0, 5).map((log: any) => (
              <div key={log.id} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-bold text-slate-900">{formatAction(log.action)}</p>
                  <span className="flex items-center gap-1 text-xs font-semibold text-slate-400">
                    <Clock3 size={13} />
                    {formatDate(log.createdAt)}
                  </span>
                </div>
                <p className="mt-1">
                  {log.user?.email ?? log.actorEmail ?? 'System'} acted on {log.resource ?? log.resourceType ?? 'platform resource'}{' '}
                  <span className="font-medium text-slate-500">
                    {String(log.resourceId ?? '').slice(0, 8)}
                  </span>
                </p>
              </div>
            ))
          ) : (
            <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
              No recent platform audit activity recorded.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function PlatformDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-2xl bg-slate-100" />
    </div>
  );
}

function ReadinessRow({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <Badge variant={warning ? 'destructive' : 'neutral'}>{value}</Badge>
    </div>
  );
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function formatAction(action: unknown) {
  return String(action ?? 'Platform action').replace(/_/g, ' ');
}

function formatDate(value: unknown) {
  if (!value) return 'recently';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'recently';
  return date.toLocaleString();
}

function formatBytes(value: number) {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatMoney(value: number) {
  if (!value) return 'No unpaid balance';
  return `NPR ${value.toLocaleString()}`;
}

function formatValue(value: unknown) {
  if (typeof value === 'number') return value.toLocaleString();
  return String(value ?? 0);
}

function getProviderIssueCount(summary: any) {
  const readiness = asArray(summary.providerReadiness ?? summary.providers);
  if (readiness.length > 0) {
    return readiness.filter((provider) =>
      ['failed', 'degraded', 'not_configured'].includes(String(provider.status ?? '').toLowerCase()),
    ).length;
  }

  return Number(summary.providerIssuesCount ?? summary.health?.providerIssuesCount ?? 0);
}
