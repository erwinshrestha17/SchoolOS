'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SectionCard } from '@/components/ui/section-card';
import { FilterBar } from '@/components/ui/filter-bar';
import { AttendanceHeader } from '@/components/attendance/attendance-header';
import { AttendanceRosterItem } from '@/components/attendance/attendance-roster-item';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/loading-state';
import { CheckCircle2, AlertCircle, Save, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

const today = new Date().toISOString().slice(0, 10);

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'SICK_LEAVE' | 'EXCUSED_LEAVE' | 'UNEXCUSED_LEAVE';

const statusCycle: AttendanceStatus[] = [
  'PRESENT',
  'ABSENT',
  'LATE',
  'SICK_LEAVE',
  'EXCUSED_LEAVE',
  'UNEXCUSED_LEAVE',
];

export function AttendanceForm() {
  const queryClient = useQueryClient();
  const [academicYearId, setAcademicYearId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(today);
  const [exceptions, setExceptions] = useState<Record<string, AttendanceStatus>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [submitMessage, setSubmitMessage] = useState('');

  const academicYearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: api.listAcademicYears,
  });
  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: api.listClasses,
  });
  const sectionsQuery = useQuery({
    queryKey: ['sections'],
    queryFn: api.listSections,
  });
  const rosterQuery = useQuery({
    queryKey: ['attendance-roster', academicYearId, classId, sectionId, attendanceDate],
    queryFn: () =>
      api.getAttendanceRoster({
        academicYearId,
        classId,
        sectionId: sectionId || null,
        attendanceDate: new Date(attendanceDate).toISOString(),
      }),
    enabled: Boolean(academicYearId && classId && !isFutureDate(attendanceDate)),
  });

  useEffect(() => {
    const currentAcademicYear = academicYearsQuery.data?.find((year) => year.isCurrent);
    if (currentAcademicYear && !academicYearId) {
      setAcademicYearId(currentAcademicYear.id);
    }
  }, [academicYearsQuery.data, academicYearId]);

  useEffect(() => {
    if (classesQuery.data?.[0] && !classId) {
      setClassId(classesQuery.data[0].id);
    }
  }, [classesQuery.data, classId]);

  useEffect(() => {
    if (!rosterQuery.data) return;
    const nextExceptions: Record<string, AttendanceStatus> = {};
    const nextRemarks: Record<string, string> = {};
    rosterQuery.data.students.forEach((student) => {
      const normalized = normalizeStatus(student.status);
      if (normalized !== 'PRESENT') nextExceptions[student.id] = normalized;
      if (student.remark) nextRemarks[student.id] = student.remark;
    });
    setExceptions(nextExceptions);
    setRemarks(nextRemarks);
  }, [rosterQuery.data]);

  const mutation = useMutation({
    mutationFn: api.submitAttendance,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['attendance-roster'] });
      setSubmitMessage(`Attendance submitted successfully at ${new Date().toLocaleTimeString()}.`);
    },
  });

  const syncMutation = useMutation({
    mutationFn: api.syncAttendance,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['attendance-roster'] });
      setSubmitMessage(`Offline sync envelope accepted at ${new Date().toLocaleTimeString()}.`);
    },
  });

  const availableSections = (sectionsQuery.data ?? []).filter((s) => !classId || (s.classId ?? s.class?.id) === classId);
  const roster = rosterQuery.data?.students ?? [];
  const futureDateBlocked = isFutureDate(attendanceDate);

  const totals = roster.reduce(
    (acc, s) => {
      const status = exceptions[s.id] ?? 'PRESENT';
      acc.total++;
      if (status === 'PRESENT') acc.present++;
      else acc.exceptions++;
      return acc;
    },
    { total: 0, present: 0, exceptions: 0 }
  );

  const presentPercent = totals.total > 0 ? Math.round((totals.present / totals.total) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <AttendanceHeader 
        total={totals.total} 
        presentPercent={presentPercent} 
        exceptions={totals.exceptions} 
      />

      <FilterBar label="Roster Filters">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
          <label className="space-y-1.5">
            <span className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider ml-1">Academic Year</span>
            <select
              value={academicYearId}
              onChange={(e) => setAcademicYearId(e.target.value)}
              className="w-full text-sm font-medium bg-white border-slate-200 rounded-xl"
            >
              <option value="">Select Year</option>
              {academicYearsQuery.data?.map((y) => (
                <option key={y.id} value={y.id}>{y.name}{y.isCurrent ? ' (Current)' : ''}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider ml-1">Class</span>
            <select
              value={classId}
              onChange={(e) => { setClassId(e.target.value); setSectionId(''); }}
              className="w-full text-sm font-medium bg-white border-slate-200 rounded-xl"
            >
              <option value="">Select Class</option>
              {classesQuery.data?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider ml-1">Section</span>
            <select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              className="w-full text-sm font-medium bg-white border-slate-200 rounded-xl"
            >
              <option value="">All Sections</option>
              {availableSections.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider ml-1">Date</span>
            <input
              type="date"
              value={attendanceDate}
              max={today}
              onChange={(e) => setAttendanceDate(e.target.value)}
              className="w-full text-sm font-medium bg-white border-slate-200 rounded-xl"
            />
          </label>
        </div>
      </FilterBar>

      <SectionCard 
        title="Student Roster" 
        description="Mark attendance by student. Everyone is present by default."
        headerAction={
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
              <Download size={14} />
              Export Register
            </button>
          </div>
        }
      >
        {rosterQuery.isLoading ? (
          <LoadingState label="Loading roster..." />
        ) : futureDateBlocked ? (
          <EmptyState title="Date Not Allowed" description="Please select a date that is not in the future." icon={<AlertCircle size={32} />} />
        ) : roster.length === 0 ? (
          <EmptyState title="No Students" description="No students found for the selected filters." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {roster.map((student) => (
              <AttendanceRosterItem
                key={student.id}
                student={student}
                status={exceptions[student.id] ?? 'PRESENT'}
                remark={remarks[student.id]}
                onStatusChange={(status) => {
                  setExceptions(prev => {
                    const next = { ...prev };
                    if (status === 'PRESENT') delete next[student.id];
                    else next[student.id] = status;
                    return next;
                  });
                }}
                onRemarkChange={(remark) => setRemarks(prev => ({ ...prev, [student.id]: remark }))}
              />
            ))}
          </div>
        )}
      </SectionCard>

      <div className="sticky bottom-6 flex items-center justify-between p-4 bg-slate-900 text-white rounded-2xl shadow-2xl animate-slide-up border border-slate-800">
        <div className="flex items-center gap-6 px-4">
          <div className="flex flex-col">
            <span className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest">Present</span>
            <span className="text-lg font-black text-emerald-400">{totals.present}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest">Exceptions</span>
            <span className="text-lg font-black text-amber-400">{totals.exceptions}</span>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div className="flex flex-col">
            <span className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest">Rate</span>
            <span className="text-lg font-black">{presentPercent}%</span>
          </div>
        </div>

        <button
          onClick={() => mutation.mutate({
            academicYearId,
            classId,
            sectionId: sectionId || null,
            attendanceDate: new Date(attendanceDate).toISOString(),
            exceptions: Object.entries(exceptions).map(([studentId, status]) => ({
              studentId,
              status,
              remark: remarks[studentId]?.trim() || null,
            }))
          })}
          disabled={mutation.isPending || roster.length === 0 || futureDateBlocked}
          className="flex items-center gap-2 px-8 py-3 bg-white text-slate-950 rounded-xl font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
        >
          {mutation.isPending ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
          ) : <Save size={18} />}
          Submit Attendance
        </button>
      </div>

      {submitMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-800 text-sm font-bold animate-fade-in">
          <CheckCircle2 size={18} />
          {submitMessage}
        </div>
      )}
      <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer text-sm font-bold text-slate-700">
          Offline sync
        </summary>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Use this only for a saved draft captured during a connection problem. Normal attendance should use Submit Attendance.
          </p>
          <button
            type="button"
            disabled={syncMutation.isPending || roster.length === 0 || futureDateBlocked}
            onClick={() => syncMutation.mutate({
              academicYearId,
              classId,
              sectionId: sectionId || null,
              attendanceDate: new Date(attendanceDate).toISOString(),
              clientSubmissionId: `${classId}-${sectionId || 'all'}-${attendanceDate}`,
              deviceTimestamp: new Date().toISOString(),
              deviceLabel: 'SchoolOS web attendance',
              exceptions: Object.entries(exceptions).map(([studentId, status]) => ({
                studentId,
                status,
                remark: remarks[studentId]?.trim() || null,
              })),
            })}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 disabled:opacity-50"
          >
            {syncMutation.isPending ? 'Syncing...' : 'Sync offline draft'}
          </button>
        </div>
      </details>
      {mutation.isError && (
        <div className="p-4 bg-destructive/5 border border-destructive/10 rounded-2xl flex items-center gap-3 text-destructive text-sm font-bold animate-fade-in">
          <AlertCircle size={18} />
          {mutation.error.message}
        </div>
      )}
    </div>
  );
}

function normalizeStatus(status: string | null | undefined): AttendanceStatus {
  if (status && statusCycle.includes(status as AttendanceStatus)) return status as AttendanceStatus;
  if (status === 'A' || status === 'ABSENT') return 'ABSENT';
  if (status === 'L' || status === 'LATE') return 'LATE';
  if (status === 'LS' || status === 'SICK_LEAVE') return 'SICK_LEAVE';
  if (status === 'LE' || status === 'EXCUSED_LEAVE') return 'EXCUSED_LEAVE';
  if (status === 'LU' || status === 'UNEXCUSED_LEAVE') return 'UNEXCUSED_LEAVE';
  return 'PRESENT';
}

function isFutureDate(value: string) {
  return value > today;
}
