'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { AttendanceForm } from '@/components/forms/attendance-form';
import { AttendanceAnalytics } from '@/components/attendance/attendance-analytics';
import { AttendanceConflictReview } from '@/components/attendance/attendance-conflict-review';
import { AttendanceCorrectionReview } from '@/components/attendance/attendance-correction-review';
import { CalendarCheck, BarChart3, AlertTriangle } from 'lucide-react';
import { DashboardPageShell } from '@/components/dashboard/dashboard-page-shell';
import { ModuleHero } from '@/components/dashboard/module-hero';
import { ModuleTabs } from '@/components/dashboard/module-tabs';

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
      <ModuleHero
        title="Smart Attendance"
        subtitle="Daily student attendance tracking and automated absence analytics."
        badge="Attendance"
        category="Student Operations"
        icon={<CalendarCheck size={32} className="text-blue-400" />}
        accentColor="blue"
        variant="dark"
      />

      <div className="space-y-6">
        <ModuleTabs
          items={tabItems}
          activeValue={activeTab}
          onValueChange={setActiveTab}
          accentColor="blue"
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
