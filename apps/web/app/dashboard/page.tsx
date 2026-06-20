'use client';

import type { OperationalSummaryModule, OperationalSummaryRouteModule } from '@schoolos/core';
import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard } from 'lucide-react';
import { ModuleHeader } from '../../components/ui/module-header';
import {
  OperationalSummaryError,
  OperationalSummaryLoading,
  OperationalSummaryPanel,
  RefreshSummaryButton,
  SummaryStatusBadge,
} from '../../components/ui/operational-summary';
import { SectionCard } from '../../components/ui/section-card';
import { api } from '../../lib/api';

const moduleRouteAliases: Record<OperationalSummaryModule, OperationalSummaryRouteModule> = {
  m1_students: 'students',
  m2_attendance: 'attendance',
  m3_fees: 'fees',
  m4_academics: 'academics',
  m5_activity: 'activity',
  m6_homework_timetable: 'homework-timetable',
  m7_hr_payroll: 'hr-payroll',
  m8a_library: 'library',
  m8b_transport: 'transport',
  m8c_canteen: 'canteen',
  m9_accounting: 'accounting',
  m10_communications: 'communications',
  m11_intelligence: 'intelligence',
  m12_learning: 'learning',
};

export default function DashboardPage() {
  const dashboardQuery = useQuery({
    queryKey: ['operational-dashboard-summary'],
    queryFn: api.getDashboardSummary,
    staleTime: 30_000,
  });

  return (
    <div className="space-y-6">
      <ModuleHeader
        eyebrow="School operations"
        title="Dashboard"
        description="A real-time, permission-filtered view of today’s school operations."
        metadata={
          dashboardQuery.data ? (
            <SummaryStatusBadge status={dashboardQuery.data.status} />
          ) : undefined
        }
        primaryAction={<RefreshSummaryButton onClick={() => void dashboardQuery.refetch()} />}
      />

      {dashboardQuery.isLoading ? <OperationalSummaryLoading /> : null}
      {dashboardQuery.isError ? (
        <OperationalSummaryError onRetry={() => void dashboardQuery.refetch()} />
      ) : null}

      {dashboardQuery.data ? (
        <>
          <SectionCard
            title="Today’s attention"
            description={
              dashboardQuery.data.attentionItems.length
                ? 'Start with the most important items below.'
                : 'No school-wide items need attention right now.'
            }
            headerAction={<LayoutDashboard className="h-5 w-5 text-slate-500" />}
          >
            {dashboardQuery.data.attentionItems.length ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {dashboardQuery.data.attentionItems.slice(0, 9).map((item) => (
                  <div key={`${item.module}-${item.key}`} className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-bold text-slate-900">{item.label}</p>
                    <p className="mt-2 text-2xl font-black text-slate-950">{item.count}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                No items need attention right now.
              </p>
            )}
          </SectionCard>

          <section aria-label="Module operational summaries" className="grid gap-5 xl:grid-cols-2">
            {dashboardQuery.data.modules.map((summary) => (
              <OperationalSummaryPanel
                key={summary.module}
                summary={summary}
                module={moduleRouteAliases[summary.module]}
                compact
              />
            ))}
          </section>
        </>
      ) : null}
    </div>
  );
}
