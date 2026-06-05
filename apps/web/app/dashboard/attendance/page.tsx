'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { AttendanceForm } from '@/components/forms/attendance-form';
import { AttendanceAnalytics } from '@/components/attendance/attendance-analytics';
import { AttendanceConflictReview } from '@/components/attendance/attendance-conflict-review';
import { AttendanceCorrectionReview } from '@/components/attendance/attendance-correction-review';
import { CalendarCheck, BarChart3, AlertTriangle, FileText } from 'lucide-react';
import { DashboardPageShell } from '@/components/dashboard/dashboard-page-shell';
import { ModuleTabs } from '@/components/dashboard/module-tabs';
import { PageHeader } from '@/components/ui/page-header';
import Link from 'next/link';

export default function AttendancePage() {
  const [activeTab, setActiveTab] = useState('marking');

  const analyticsQuery = useQuery({
    queryKey: ['attendance-analytics'],
    queryFn: api.listAttendanceAnalytics,
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

  const tabItems = [
    { value: 'marking', label: 'Marking', icon: CalendarCheck },
    { value: 'analytics', label: 'Analytics', icon: BarChart3 },
    { value: 'conflicts', label: 'Conflicts', icon: AlertTriangle },
  ];

  return (
    <DashboardPageShell>
      <PageHeader
        title="Attendance"
        description="Daily student attendance tracking, exception review, and absence analytics."
        actions={
          <Link
            href="/dashboard/attendance/register"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-mod-attendance-accent)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-mod-attendance-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-attendance-border)] focus:ring-offset-2"
          >
            <FileText size={18} />
            Monthly Register
          </Link>
        }
      />

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
              <AttendanceAnalytics analytics={analyticsQuery.data} />
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
