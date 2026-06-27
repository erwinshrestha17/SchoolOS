'use client';

import { useQuery } from '@tanstack/react-query';
import { formatBsDate } from '@schoolos/core';
import { api } from '../../lib/api';
import {
  Users,
  Briefcase,
  CalendarDays,
  Calculator,
  AlertCircle,
  UserCheck,
} from 'lucide-react';
import { StatCard } from '../ui/stat-card';
import { Badge } from '../ui/badge';
import Link from 'next/link';

export function HROverview() {
  const summaryQuery = useQuery({
    queryKey: ['payroll-dashboard-summary', 'hr-overview'],
    queryFn: () => api.getPayrollDashboardSummary({ contractWindowDays: 30 }),
  });

  const staffQuery = useQuery({
    queryKey: ['staff-directory', 'hr-overview'],
    queryFn: () => api.listStaffDirectory({ page: 1, limit: 5 }),
  });

  const summary = summaryQuery.data;
  const staff = staffQuery.data?.items ?? [];
  const latestPayrollRun = summary?.latestPayrollRun ?? null;
  const runsPendingReview = ['GENERATED', 'UNDER_REVIEW', 'REVIEWED'].reduce(
    (total, status) => total + (summary?.payrollRunsByStatus?.[status] ?? 0),
    0,
  );
  const formatAssignedText = (value: string | null | undefined, fallback: string) =>
    value?.trim() || fallback;

  const isLoading = summaryQuery.isLoading || staffQuery.isLoading;

  return (
    <div className="space-y-8">
      {/* Metrics Row */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Staff"
          value={summaryQuery.isError ? 'Unavailable' : summary?.activeStaffCount ?? 0}
          description="Backend-owned staff count"
          icon={<UserCheck className="h-5 w-5 text-emerald-500" />}
          loading={isLoading}
        />
        <StatCard
          title="Contracts Expiring"
          value={
            summaryQuery.isError
              ? 'Unavailable'
              : summary?.contractsExpiringWithinWindow ?? 0
          }
          description="Within the next 30 days"
          icon={<Briefcase className="h-5 w-5 text-[var(--color-mod-hr-text)]" />}
          loading={isLoading}
        />
        <StatCard
          title="Pending Leaves"
          value={summaryQuery.isError ? 'Unavailable' : summary?.pendingLeaveRequests ?? 0}
          description={`${summary?.onLeaveTodayCount ?? 0} on leave today`}
          icon={<CalendarDays className="h-5 w-5 text-amber-500" />}
          loading={isLoading}
        />
        <StatCard
          title="Missing Salary Structure"
          value={
            summaryQuery.isError
              ? 'Unavailable'
              : summary?.activeStaffWithoutActiveSalaryStructureCount ?? 0
          }
          description="Active staff without structures"
          icon={<AlertCircle className="h-5 w-5 text-rose-500" />}
          loading={isLoading}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Payroll Status Card */}
        <section className="rounded-2xl border border-[var(--color-mod-hr-border)] bg-[var(--color-mod-hr-soft)]/70 p-8 text-slate-900 shadow-sm lg:col-span-1 flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-3">
              <Calculator className="text-[var(--color-mod-hr-text)]" />
              Payroll Status
            </h3>
            <p className="text-slate-600 text-xs mt-2">Current month processing overview.</p>
            
            <div className="mt-8 space-y-4">
              <div className="flex justify-between items-center py-2.5 border-b border-[var(--color-mod-hr-border)]/70">
                <span className="text-sm text-slate-600">Latest Processed Run</span>
                <span className="font-bold text-slate-950">
                  {latestPayrollRun
                    ? `${latestPayrollRun.periodMonth}/${latestPayrollRun.periodYear}`
                    : 'None'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-[var(--color-mod-hr-border)]/70">
                <span className="text-sm text-slate-600">Run Status</span>
                {latestPayrollRun ? (
                  <Badge variant="phase2" className="bg-emerald-50 text-emerald-700 border-emerald-200/70">
                    {latestPayrollRun.status}
                  </Badge>
                ) : (
                  <span className="text-slate-500 font-bold">No run processed</span>
                )}
              </div>
              <div className="flex justify-between items-center py-2.5">
                <span className="text-sm text-slate-600">Runs Pending Review</span>
                <span className="font-bold text-amber-400">
                  {summaryQuery.isError ? 'Unavailable' : runsPendingReview}
                </span>
              </div>
            </div>
          </div>
          <Link
            href="/dashboard/payroll/runs"
            className="mt-8 inline-flex items-center justify-center w-full px-5 py-3 rounded-2xl bg-[var(--color-mod-hr-accent)] hover:bg-[var(--color-mod-hr-text)] text-white font-bold text-sm transition-all border border-[var(--color-mod-hr-accent)]"
          >
            Manage Payroll Runs
          </Link>
        </section>

        {/* Recently Joined Staff */}
        <section className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold flex items-center gap-3">
              <Users className="text-indigo-500" />
              Recently Joined Staff
            </h3>
            <Link href="/dashboard/hr/staff" className="text-xs font-bold text-[var(--color-mod-hr-text)] hover:underline">
              View Directory
            </Link>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-100">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3.5 font-bold text-slate-500 uppercase tracking-wider">Staff Member</th>
                  <th className="px-5 py-3.5 font-bold text-slate-500 uppercase tracking-wider">Joined Date</th>
                  <th className="px-5 py-3.5 font-bold text-slate-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="px-5 py-4"><div className="h-4 w-28 bg-slate-100 rounded" /></td>
                      <td className="px-5 py-4"><div className="h-4 w-20 bg-slate-100 rounded" /></td>
                      <td className="px-5 py-4"><div className="h-5 w-16 bg-slate-100 rounded-full" /></td>
                    </tr>
                  ))
                ) : staff.length > 0 ? (
                  [...staff]
                    .sort((a, b) => new Date(b.joiningDate).getTime() - new Date(a.joiningDate).getTime())
                    .slice(0, 5)
                    .map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-900">{item.firstName} {item.lastName}</p>
                          <p className="text-[10px] text-slate-400 mt-1">
                            {formatAssignedText(item.designation, 'Designation not set')} &bull; {formatAssignedText(item.department, 'Department not set')}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-slate-500 font-medium">
                          {formatBsDate(item.joiningDate)}
                        </td>
                        <td className="px-5 py-4">
                          <Badge className={item.status === 'ACTIVE' || !item.status ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/10" : "bg-slate-100 text-slate-500"}>
                            {item.status || 'ACTIVE'}
                          </Badge>
                        </td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-slate-400 italic">
                      No staff records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
