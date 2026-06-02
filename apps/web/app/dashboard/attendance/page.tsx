'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AttendanceForm } from '@/components/forms/attendance-form';
import { AttendanceAnalytics } from '@/components/attendance/attendance-analytics';
import { AttendanceConflictReview } from '@/components/attendance/attendance-conflict-review';
import { AttendanceCorrectionReview } from '@/components/attendance/attendance-correction-review';
import { PageHeader } from '@/components/ui/page-header';
import { CalendarCheck, History, BarChart3, AlertTriangle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AttendancePage() {
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

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Smart Attendance"
        description="Daily student attendance tracking and automated absence analytics."
      />

      <Tabs defaultValue="marking" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="marking" className="flex items-center gap-2">
            <CalendarCheck size={14} />
            Marking
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 size={14} />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="conflicts" className="flex items-center gap-2">
            <AlertTriangle size={14} />
            Conflicts
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="marking"
          className="space-y-6 animate-in fade-in-50 duration-500"
        >
          <AttendanceForm />
        </TabsContent>

        <TabsContent
          value="analytics"
          className="space-y-6 animate-in fade-in-50 duration-500"
        >
          <AttendanceAnalytics analytics={analyticsQuery.data} />

          <div className="grid gap-6">
            {/* Additional reporting widgets can go here */}
          </div>
        </TabsContent>

        <TabsContent
          value="conflicts"
          className="space-y-6 animate-in fade-in-50 duration-500"
        >
          <AttendanceConflictReview conflicts={conflictsQuery.data ?? []} />
          <AttendanceCorrectionReview
            corrections={correctionsQuery.data?.items ?? []}
            isLoading={correctionsQuery.isLoading}
            total={correctionsQuery.data?.total ?? 0}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
