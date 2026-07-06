'use client';

import type { OperationalNextAction } from '@schoolos/core';
import { formatBsDateTime } from '@schoolos/core';
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
import { formatSchoolDate } from '../../lib/date-utils';

export default function DashboardPage() {
  const router = useRouter();
  const dashboardQuery = useQuery({
    queryKey: ['operational-dashboard-summary'],
    queryFn: api.getDashboardSummary,
    staleTime: 30_000,
  });

  const quickActions: ActionMenuItem[] = (dashboardQuery.data?.nextActions ?? [])
    .map((action) => ({ action, href: resolveOperationalSummaryAction(action) }))
    .filter((item): item is { action: OperationalNextAction; href: string } => Boolean(item.href))
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
                School day: {formatSchoolDate(dashboardQuery.data.schoolDay)}
              </span>
              <SummaryStatusBadge status={dashboardQuery.data.status} />
              <span className="text-xs font-medium text-slate-500">
                Updated {formatBsDateTime(dashboardQuery.data.generatedAt)}
              </span>
            </>
          ) : undefined
        }
        primaryAction={
          <RefreshSummaryButton
            onClick={() => void dashboardQuery.refetch()}
            isLoading={dashboardQuery.isFetching}
          />
        }
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
