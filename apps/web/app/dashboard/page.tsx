'use client';

import type { OperationalNextAction } from '@schoolos/core';
import { formatBsDateTime } from '@schoolos/core';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
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

  const safeNextActions = (dashboardQuery.data?.nextActions ?? [])
    .map((action) => ({ action, href: resolveOperationalSummaryAction(action) }))
    .filter((item): item is { action: OperationalNextAction; href: string } => Boolean(item.href));

  // The backend already orders nextActions by priority for the current
  // session, so its first authorized entry is this user's single
  // highest-value workflow today — promote that one to the page's primary
  // action instead of a generic refresh button, per the "one primary action"
  // header rule. Everything else stays reachable from More Actions.
  const [primaryNextAction, ...remainingNextActions] = safeNextActions;

  const quickActions: ActionMenuItem[] = remainingNextActions
    .slice(0, 5)
    .map(({ action, href }) => ({
      label: action.label,
      onClick: () => router.push(href),
    }));

  return (
    <div className="space-y-6">
      <ModuleHeader
        eyebrow="School operations"
        title="School Overview"
        description="Daily operating snapshot for your school."
        metadata={
          dashboardQuery.data ? (
            <>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
                School day: {formatSchoolDate(dashboardQuery.data.schoolDay)}
              </span>
              <SummaryStatusBadge status={dashboardQuery.data.status} />
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                Updated {formatBsDateTime(dashboardQuery.data.generatedAt)}
                <RefreshSummaryButton
                  onClick={() => void dashboardQuery.refetch()}
                  isLoading={dashboardQuery.isFetching}
                />
              </span>
            </>
          ) : undefined
        }
        primaryAction={
          primaryNextAction ? (
            <Link
              href={primaryNextAction.href}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-6 text-sm font-bold text-white shadow-sm transition-all hover:bg-[var(--primary-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
            >
              {primaryNextAction.action.label}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : undefined
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
