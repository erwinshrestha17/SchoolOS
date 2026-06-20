'use client';

import type {
  OperationalModuleSummary,
  OperationalNextAction,
  OperationalSummaryMetricValue,
  OperationalSummaryRouteModule,
  OperationalSummaryStatus,
} from '@schoolos/core';
import { AlertTriangle, ArrowRight, Clock3, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { Button } from './button';
import { ErrorState } from './error-state';
import { LoadingState } from './loading-state';
import { ModuleLockedState } from './module-locked-state';
import { SectionCard } from './section-card';
import { StatusBadge } from './status-badge';

const moduleLabels: Record<OperationalSummaryRouteModule, string> = {
  students: 'Students',
  attendance: 'Attendance',
  fees: 'Fees',
  academics: 'Academics',
  activity: 'Activity Feed',
  'homework-timetable': 'Homework & Timetable',
  'hr-payroll': 'HR & Payroll',
  library: 'Library',
  transport: 'Transport',
  canteen: 'Canteen',
  accounting: 'Accounting',
  communications: 'Notices & Communication',
  intelligence: 'M11 Intelligence',
  learning: 'Learning',
};

/** Never navigate with an arbitrary route sent by an API response. */
const APPROVED_DASHBOARD_ROUTES = new Set([
  '/dashboard/students',
  '/dashboard/students/documents',
  '/dashboard/students/duplicates',
  '/dashboard/students/qr',
  '/dashboard/students/iemis',
  '/dashboard/admissions',
  '/dashboard/attendance',
  '/dashboard/attendance/daily',
  '/dashboard/attendance/corrections',
  '/dashboard/fees',
  '/dashboard/fees/dues',
  '/dashboard/fees/reversals',
  '/dashboard/fees/cashier-close',
  '/dashboard/academics',
  '/dashboard/academics/marks',
  '/dashboard/academics/report-cards',
  '/dashboard/activity',
  '/dashboard/activity/pending',
  '/dashboard/activity/gallery',
  '/dashboard/homework',
  '/dashboard/homework/submissions',
  '/dashboard/timetable/substitutions',
  '/dashboard/hr',
  '/dashboard/hr/leave',
  '/dashboard/payroll',
  '/dashboard/library',
  '/dashboard/library/overdue',
  '/dashboard/transport',
  '/dashboard/transport/trips',
  '/dashboard/transport/gps-quality',
  '/dashboard/transport/vehicles',
  '/dashboard/canteen',
  '/dashboard/canteen/inventory',
  '/dashboard/accounting',
  '/dashboard/accounting/journals',
  '/dashboard/accounting/reconciliation',
  '/dashboard/accounting/period-close',
  '/dashboard/notices',
  '/dashboard/notices/delivery',
  '/dashboard/learning',
  '/dashboard/learning/sessions',
  '/dashboard/learning/resources',
]);

export function resolveOperationalSummaryAction(
  action: OperationalNextAction,
): string | null {
  return APPROVED_DASHBOARD_ROUTES.has(action.route) ? action.route : null;
}

export function SummaryStatusBadge({
  status,
}: {
  status: OperationalSummaryStatus;
}) {
  const label = {
    ready: 'Ready',
    empty: 'No items need attention',
    partial: 'Some information unavailable',
    locked: 'Module locked',
    permissionDenied: 'Access limited',
  }[status];

  const tone = {
    ready: 'active',
    empty: 'info',
    partial: 'partial',
    locked: 'locked',
    permissionDenied: 'inactive',
  }[status] as const;

  return <StatusBadge status={status} label={label} tone={tone} />;
}

export function OperationalSummaryPanel({
  summary,
  module,
  compact = false,
}: {
  summary: OperationalModuleSummary;
  module: OperationalSummaryRouteModule;
  compact?: boolean;
}) {
  const allowedActions = useMemo(
    () =>
      summary.nextActions
        .map((action) => ({ action, href: resolveOperationalSummaryAction(action) }))
        .filter((item): item is { action: OperationalNextAction; href: string } =>
          Boolean(item.href),
        ),
    [summary.nextActions],
  );

  const moduleName = moduleLabels[module];

  if (summary.status === 'locked') {
    return <ModuleLockedState moduleName={moduleName} className="py-8" />;
  }

  if (summary.status === 'permissionDenied') {
    return (
      <SectionCard title="Operational summary" description="A safe overview of this workspace.">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          You do not have permission to view this operational summary. No module data is shown.
        </div>
      </SectionCard>
    );
  }

  const metrics = Object.entries(summary.summary).slice(0, compact ? 3 : 6);

  return (
    <SectionCard
      title="Operational summary"
      description={
        summary.status === 'partial'
          ? 'Available information is shown below. Some information is temporarily unavailable.'
          : 'A lightweight view of the work that needs attention.'
      }
      headerAction={<SummaryStatusBadge status={summary.status} />}
      footer={
        allowedActions.length ? (
          <div className="flex flex-wrap gap-2">
            {allowedActions.slice(0, compact ? 1 : 3).map(({ action, href }) => (
              <Link
                key={action.key}
                href={href}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)] focus:ring-offset-2"
              >
                {action.label}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ))}
          </div>
        ) : undefined
      }
    >
      {metrics.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {metrics.map(([key, value]) => (
            <OperationalSummaryMetric key={key} label={toLabel(key)} value={value} />
          ))}
        </div>
      ) : (
        <SummaryUnavailableState status={summary.status} />
      )}

      {!compact && summary.attentionItems.length ? (
        <AttentionItemsList items={summary.attentionItems} />
      ) : null}

      {!compact && summary.recentItems.length ? (
        <RecentSummaryItems items={summary.recentItems} />
      ) : null}
    </SectionCard>
  );
}

export function OperationalSummaryMetric({
  label,
  value,
}: {
  label: string;
  value: OperationalSummaryMetricValue;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{formatMetricValue(value)}</p>
    </div>
  );
}

export function AttentionItemsList({
  items,
}: {
  items: OperationalModuleSummary['attentionItems'];
}) {
  return (
    <div className="mt-5 border-t border-slate-100 pt-5">
      <p className="mb-3 text-sm font-bold text-slate-900">Needs attention</p>
      <div className="space-y-2">
        {items.slice(0, 5).map((item) => {
          const href = APPROVED_DASHBOARD_ROUTES.has(item.action) ? item.action : null;
          const content = (
            <>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" />
              <span className="min-w-0 flex-1 text-sm font-semibold text-slate-800">{item.label}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">{item.count}</span>
            </>
          );
          return href ? (
            <Link
              key={item.key}
              href={href}
              className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 transition hover:bg-slate-50"
            >
              {content}
            </Link>
          ) : (
            <div key={item.key} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RecentSummaryItems({
  items,
}: {
  items: OperationalModuleSummary['recentItems'];
}) {
  return (
    <div className="mt-5 border-t border-slate-100 pt-5">
      <p className="mb-3 text-sm font-bold text-slate-900">Recent activity</p>
      <div className="space-y-2">
        {items.slice(0, 5).map((item) => (
          <div key={item.id} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
            <Clock3 className="h-4 w-4 shrink-0 text-slate-500" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{item.label}</span>
            <time className="text-xs text-slate-500" dateTime={item.occurredAt}>
              {formatRecentDate(item.occurredAt)}
            </time>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SummaryUnavailableState({ status }: { status: OperationalSummaryStatus }) {
  const description = status === 'partial'
    ? 'Some information is temporarily unavailable. You can refresh the summary to try again.'
    : 'No items need attention right now.';
  return <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">{description}</p>;
}

export function OperationalSummaryLoading() {
  return <LoadingState variant="skeleton" label="Loading operational summary..." />;
}

export function OperationalSummaryError({ onRetry }: { onRetry: () => void }) {
  return (
    <ErrorState
      title="Could not load the operational summary"
      message="Please try again. Your existing workspace data has not been changed."
      onRetry={onRetry}
      retryLabel="Retry summary"
    />
  );
}

export function RefreshSummaryButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" size="sm" variant="outline" onClick={onClick}>
      <RefreshCw className="h-4 w-4" />
      Refresh
    </Button>
  );
}

function toLabel(key: string) {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (value) => value.toUpperCase());
}

function formatMetricValue(value: OperationalSummaryMetricValue) {
  if (value === null) return '—';
  return String(value);
}

function formatRecentDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return new Intl.DateTimeFormat('en-NP', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}
