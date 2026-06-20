'use client';

import { useQuery } from '@tanstack/react-query';
import type { StudentProfileDetail } from '@schoolos/core';
import { api } from '@/lib/api';
import { SectionCard } from '@/components/ui/section-card';
import { StatCard } from '@/components/ui/stat-card';
import { LoadingState } from '@/components/ui/loading-state';
import { ArrowLeft, CalendarCheck, UserCheck, UserX, Clock, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type AttendanceTabProps = {
  profile: StudentProfileDetail;
  onBackToProfile: () => void;
};

const formatDate = (date: string | Date) => {
  return new Intl.DateTimeFormat('en-NP', {
    dateStyle: 'medium',
  }).format(new Date(date));
};

export function AttendanceTab({ profile, onBackToProfile }: AttendanceTabProps) {
  const { student } = profile;
  const studentId = student.id;
  const studentName =
    student.fullNameEn || `${student.firstNameEn ?? ''} ${student.lastNameEn ?? ''}`.trim() || 'Student';
  const currentEnrollment =
    profile.enrollments.find((enrollment) => enrollment.status.toUpperCase() === 'ACTIVE') ??
    profile.enrollments[0] ??
    null;
  const classSection = [
    currentEnrollment?.className ?? student.className ?? student.class?.name,
    currentEnrollment?.sectionName ?? student.sectionName ?? student.section,
  ]
    .filter(Boolean)
    .join(' / ');

  const historyQuery = useQuery({
    queryKey: ['student-attendance-history', studentId],
    queryFn: () => api.getStudentAttendanceHistory(studentId),
    enabled: Boolean(studentId),
  });

  const data = historyQuery.data;
  const summary = data?.summary;
  const records = data?.records ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--color-mod-admissions-border)] bg-[var(--color-mod-admissions-bg)] px-5 py-4 text-[var(--color-mod-admissions-text)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black">
            {studentName} · {student.studentSystemId} · {classSection || 'Class not assigned'}
          </p>
          <p className="mt-1 text-xs font-semibold opacity-75">
            Attendance summary and records are loaded from the backend attendance history contract.
          </p>
        </div>
        <button
          type="button"
          onClick={onBackToProfile}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[var(--color-mod-admissions-border)] bg-white px-4 text-xs font-black uppercase tracking-widest text-[var(--color-mod-admissions-text)] shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft size={15} />
          Back to profile
        </button>
      </div>

      {historyQuery.isLoading ? <LoadingState label="Loading attendance history..." /> : null}

      {historyQuery.isError ? (
        <div className="rounded-2xl border border-danger-100 bg-danger-50 p-5">
          <p className="text-sm font-bold text-danger-800">Attendance history could not load.</p>
          <p className="mt-1 text-xs font-medium text-danger-700">
            No attendance values are shown until the backend responds.
          </p>
          <button
            type="button"
            onClick={() => void historyQuery.refetch()}
            className="mt-4 rounded-xl bg-danger-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white"
          >
            Retry
          </button>
        </div>
      ) : null}

      {!historyQuery.isLoading && !historyQuery.isError ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Days" value={summary?.totalRecords ?? 0} icon={<CalendarCheck size={20} />} />
            <StatCard title="Present" value={summary?.presentCount ?? 0} icon={<UserCheck size={20} className="text-success-500" />} />
            <StatCard title="Absent" value={summary?.absentCount ?? 0} icon={<UserX size={20} className="text-danger-500" />} />
            <StatCard title="Late" value={summary?.lateCount ?? 0} icon={<Clock size={20} className="text-warning-500" />} />
          </div>

          <SectionCard title="Attendance Register" description="Detailed daily presence records" noPadding>
            {records.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {records.map((row) => (
                  <div key={row.date} className="flex items-center justify-between p-5 transition hover:bg-slate-50/50">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                        <Calendar size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{formatDate(row.date)}</p>
                        <p className="text-[0.7rem] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Academic Session Day</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {row.remarks && <span className="hidden text-xs text-slate-400 italic lg:block">{row.remarks}</span>}
                      <Badge variant={
                        row.status === 'PRESENT' ?
                          'success' :
                          row.status === 'ABSENT' ?
                            'destructive' :
                            row.status === 'LATE' ? 'warning' : 'info'
                      }>
                        {row.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
                  <CalendarCheck size={32} />
                </div>
                <p className="text-sm font-bold text-slate-900">No attendance data</p>
                <p className="mt-1 text-xs text-slate-400">Attendance records will appear once class starts.</p>
              </div>
            )}
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
