'use client';

import type { ActionMenuItem } from '../../components/ui/action-menu';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { DashboardCommandCenter } from '../../components/dashboard/dashboard-command-center';
import { ModuleHeader } from '../../components/ui/module-header';
import {
  OperationalSummaryError,
  OperationalSummaryLoading,
  RefreshSummaryButton,
  resolveOperationalSummaryAction,
  SummaryStatusBadge,
} from '../../components/ui/operational-summary';
import { api } from '../../lib/api';

export default function DashboardPage() {
  const router = useRouter();
  const dashboardQuery = useQuery({
    queryKey: ['operational-dashboard-summary'],
    queryFn: api.getDashboardSummary,
    staleTime: 30_000,
  });

  const quickActions: ActionMenuItem[] = (dashboardQuery.data?.nextActions ?? [])
    .map((action) => ({ action, href: resolveOperationalSummaryAction(action) }))
    .filter((item): item is { action: typeof dashboardQuery.data.nextActions[number]; href: string } => Boolean(item.href))
    .slice(0, 6)
    .map(({ action, href }) => ({
      label: action.label,
      onClick: () => router.push(href),
    }));

  return (
    <div className="space-y-6">
      <ModuleHeader
        eyebrow="School operations"
        title="Dashboard"
        description="A permission-filtered view of today’s school operations, approvals, and priorities."
        metadata={
          dashboardQuery.data ? (
            <>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
                School day: {formatSchoolDay(dashboardQuery.data.schoolDay)}
              </span>
              <SummaryStatusBadge status={dashboardQuery.data.status} />
              <span className="text-xs font-medium text-slate-500">
                Updated {formatUpdatedAt(dashboardQuery.data.generatedAt)}
              </span>
            </>
          ) : undefined
        }
        primaryAction={<RefreshSummaryButton onClick={() => void dashboardQuery.refetch()} />}
        moreActionItems={quickActions.length ? quickActions : undefined}
      />

      {dashboardQuery.isLoading ? <OperationalSummaryLoading /> : null}
      {dashboardQuery.isError ? (
        <OperationalSummaryError onRetry={() => void dashboardQuery.refetch()} />
      ) : null}
      {dashboardQuery.data ? <DashboardCommandCenter dashboard={dashboardQuery.data} /> : null}
    </div>
  );
}

function formatSchoolDay(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-NP', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'recently';
  return new Intl.DateTimeFormat('en-NP', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
