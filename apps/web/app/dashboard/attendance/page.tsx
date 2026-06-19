'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { AttendanceForm } from '@/components/forms/attendance-form';
import { AttendanceAnalytics } from '@/components/attendance/attendance-analytics';
import { AttendanceConflictReview } from '@/components/attendance/attendance-conflict-review';
import { AttendanceCorrectionReview } from '@/components/attendance/attendance-correction-review';
import {
  AlertTriangle,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  FileText,
  RefreshCw,
  UserX,
} from 'lucide-react';
import { DashboardPageShell } from '@/components/dashboard/dashboard-page-shell';
import { ModuleHeader } from '@/components/ui/module-header';
import { ModuleTabs } from '@/components/ui/module-tabs';
import { KpiCard, KpiGrid } from '@/components/ui/kpi-card';
import { useRouter } from 'next/navigation';

export default function AttendancePage() {
  const [activeTab, setActiveTab] = useState('marking');
  const router = useRouter();

  const analyticsQuery = useQuery({
    queryKey: ['attendance-analytics'],
    queryFn: api.listAttendanceAnalytics,
  });
  const anomaliesQuery = useQuery({
    queryKey: ['attendance-anomalies'],
    queryFn: api.listAttendanceAnomalies,
  });

  const conflictsQuery = useQuery({
    queryKey: ['attendance-conflicts'],
    queryFn: api.listAttendanceConflicts,
  });
  const correctionsQuery = useQuery({
    queryKey: ['attendance-corrections', 'PENDING'],
    queryFn: () =>
      api.listAttendanceCorrections({ status: 'PENDING', limit: 25 }),
  });

  const analytics = analyticsQuery.data;
  const anomalies = anomaliesQuery.data;
  const pendingCorrections = correctionsQuery.data?.total;
  const unsubmittedWorkingDays =
    anomalies?.anomalies.unsubmittedWorkingDays.length;

  const tabItems = [
    { value: 'marking', label: 'Daily Attendance', icon: CalendarCheck },
    {
      href: '/dashboard/attendance/register',
      label: 'Monthly Register',
      icon: FileText,
    },
    {
      href: '/dashboard/attendance/corrections',
      label: 'Corrections',
      icon: FileText,
      count: pendingCorrections,
    },
    { value: 'conflicts', label: 'Offline Drafts', icon: RefreshCw },
    { value: 'analytics', label: 'Anomalies', icon: AlertTriangle },
    {
      href: '/dashboard/attendance/reports',
      label: 'Reports',
      icon: BarChart3,
    },
  ];
  return (
    <DashboardPageShell>
      <ModuleHeader
        title="Smart Attendance"
        description="Mark daily attendance, review corrections, monitor anomalies, and export registers."
        primaryAction={
          <button
            type="button"
            onClick={() => setActiveTab('marking')}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-mod-attendance-accent)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-mod-attendance-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-attendance-border)] focus:ring-offset-2"
          >
            <CalendarCheck size={18} />
            Mark Attendance
          </button>
        }
        moreActionItems={[
          {
            label: 'Monthly Register',
            icon: <FileText size={16} />,
            onClick: () => router.push('/dashboard/attendance/register'),
          },
          {
            label: 'Attendance Analytics',
            icon: <BarChart3 size={16} />,
            onClick: () => setActiveTab('analytics'),
          },
          {
            label: 'Review Conflicts',
            icon: <AlertTriangle size={16} />,
            onClick: () => setActiveTab('conflicts'),
          },
        ]}
      >
        <KpiGrid className="sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <KpiCard
            title="Present Today"
            value={
              analyticsQuery.isLoading
                ? 'Loading'
                : analytics?.todaySummary.totals.present ?? 'Unavailable'
            }
            icon={<CheckCircle2 size={20} />}
            tone="success"
            description="From the attendance analytics API."
          />
          <KpiCard
            title="Absent Today"
            value={
              analyticsQuery.isLoading
                ? 'Loading'
                : analytics?.todaySummary.totals.absent ?? 'Unavailable'
            }
            icon={<UserX size={20} />}
            tone="danger"
            description="Official daily summary when available."
          />
          <KpiCard
            title="Late Today"
            value={
              analyticsQuery.isLoading
                ? 'Loading'
                : analytics?.todaySummary.totals.late ?? 'Unavailable'
            }
            icon={<Clock3 size={20} />}
            tone="warning"
            description="Official daily summary when available."
          />
          <KpiCard
            title="Classes Not Marked"
            value={
              anomaliesQuery.isLoading
                ? 'Loading'
                : unsubmittedWorkingDays ?? 'Unavailable'
            }
            icon={<AlertTriangle size={20} />}
            tone={unsubmittedWorkingDays ? 'warning' : 'neutral'}
            description="From backend anomaly checks."
          />
          <KpiCard
            title="Correction Requests"
            value={
              correctionsQuery.isLoading
                ? 'Loading'
                : pendingCorrections ?? 'Unavailable'
            }
            icon={<FileText size={20} />}
            tone={pendingCorrections ? 'warning' : 'neutral'}
            description="Awaiting backend review."
          />
          <KpiCard
            title="Parent Alerts Sent"
            value="Unavailable"
            icon={<RefreshCw size={20} />}
            tone="neutral"
            description="Alert totals are not available yet."
          />
        </KpiGrid>
      </ModuleHeader>

      <div className="space-y-6">
        <ModuleTabs
          items={tabItems}
          activeValue={activeTab}
          onValueChange={setActiveTab}
          accentColor="emerald"
          variant="light"
        />

        <div className="min-h-[400px]">
          {activeTab === 'marking' && (
            <div className="animate-in fade-in duration-300">
              <AttendanceForm />
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <AttendanceAnalytics
                analytics={analyticsQuery.data}
                anomalies={anomaliesQuery.data}
                isLoadingAnomalies={anomaliesQuery.isLoading}
                anomaliesError={
                  anomaliesQuery.isError
                    ? 'Attendance anomaly checks could not load. Try again later.'
                    : ''
                }
              />
            </div>
          )}

          {activeTab === 'conflicts' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <AttendanceConflictReview conflicts={conflictsQuery.data ?? []} />
              <AttendanceCorrectionReview
                corrections={correctionsQuery.data?.items ?? []}
                isLoading={correctionsQuery.isLoading}
                total={correctionsQuery.data?.total ?? 0}
              />
            </div>
          )}
        </div>
      </div>
    </DashboardPageShell>
  );
}
