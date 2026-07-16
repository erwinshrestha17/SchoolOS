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

  // Context-aware primary action from real permitted dashboard data: when
  // anything needs review, the header's one primary action is the attention
  // queue itself ("Review N attention items"); otherwise the backend's
  // highest-priority authorized next action. Never a hard-coded workflow.
  const attentionCount = (dashboardQuery.data?.attentionItems ?? []).filter(
    (item) => item.count > 0,
  ).length;
  const [firstNextAction, ...remainingNextActions] = safeNextActions;
  const primaryAction =
    attentionCount > 0
      ? {
          label: `Review ${attentionCount} attention item${attentionCount === 1 ? '' : 's'}`,
          href: '#needs-attention',
        }
      : firstNextAction
        ? { label: firstNextAction.action.label, href: firstNextAction.href }
        : null;

  // Everything else stays reachable from More Actions. When the primary
  // action is the attention queue, the backend's first next action still
  // belongs in the menu rather than disappearing.
  const menuNextActions =
    attentionCount > 0 ? safeNextActions : remainingNextActions;
  const quickActions: ActionMenuItem[] = menuNextActions
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
          primaryAction ? (
            <Link
              href={primaryAction.href}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-6 text-sm font-bold text-white shadow-sm transition-all hover:bg-[var(--primary-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
            >
              {primaryAction.label}
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
