'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import { SectionCard } from '@/components/ui/section-card';
import { AttendanceHeader } from '@/components/attendance/attendance-header';
import { AttendanceRosterItem } from '@/components/attendance/attendance-roster-item';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/loading-state';
import { CheckCircle2, AlertCircle, Save, Download, Eraser, CheckSquare, Loader2, Info } from 'lucide-react';
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
    setSubmitMessage('');
  }, [rosterQuery.data]);

  const mutation = useMutation({
    mutationFn: api.submitAttendance,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['attendance-roster'] });
      setSubmitMessage(`Attendance submitted successfully at ${new Date().toLocaleTimeString()}.`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
  });

  const syncMutation = useMutation({
    mutationFn: api.syncAttendance,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['attendance-analytics'] });
      void queryClient.invalidateQueries({ queryKey: ['attendance-conflicts'] });
      setSubmitMessage(`Offline draft synchronized successfully at ${new Date().toLocaleTimeString()}.`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
  });

  const availableSections = (sectionsQuery.data ?? []).filter((s) => !classId || (s.classId ?? s.class?.id) === classId);
  const roster = useMemo(() => rosterQuery.data?.students ?? [], [rosterQuery.data?.students]);
  const futureDateBlocked = isFutureDate(attendanceDate);

  const totals = useMemo(() => {
    return roster.reduce(
      (acc, s) => {
        const status = exceptions[s.id] ?? 'PRESENT';
        acc.total++;
        if (status === 'PRESENT') acc.present++;
        else if (status === 'ABSENT') acc.absent++;
        else if (status === 'LATE') acc.late++;
        else acc.leave++;
        return acc;
      },
      { total: 0, present: 0, absent: 0, late: 0, leave: 0 }
    );
  }, [roster, exceptions]);

  const presentPercent = totals.total > 0 ? Math.round((totals.present / totals.total) * 100) : 0;
  const submissionStatus = rosterQuery.data?.status || 'NOT_STARTED';

  const markAllPresent = () => {
    setExceptions({});
  };

  const clearAll = () => {
    setExceptions({});
    setRemarks({});
  };

  return (
    <div className="space-y-8 animate-fade-in pb-24">
      {submitMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-[2rem] flex items-center gap-4 text-emerald-800 text-sm font-bold animate-in slide-in-from-top-4 duration-500">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
            <CheckCircle2 size={20} />
          </div>
          {submitMessage}
        </div>
      )}

      <AttendanceHeader 
        total={totals.total} 
        presentPercent={presentPercent} 
        exceptions={totals.absent + totals.late + totals.leave} 
      />

      <section className="rounded-[3rem] border border-slate-100 bg-white/50 p-6 backdrop-blur-xl shadow-xl shadow-slate-200/50">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="space-y-2">
            <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Academic Year</label>
            <select
              value={academicYearId}
              onChange={(e) => setAcademicYearId(e.target.value)}
              className="premium-input bg-white"
              aria-label="Academic Year"
            >
              <option value="">Select Year</option>
              {academicYearsQuery.data?.map((y) => (
                <option key={y.id} value={y.id}>{y.name}{y.isCurrent ? ' (Current)' : ''}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Class</label>
            <select
              value={classId}
              onChange={(e) => { setClassId(e.target.value); setSectionId(''); }}
              className="premium-input bg-white"
              aria-label="Class"
            >
              <option value="">Select Class</option>
              {classesQuery.data?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Section</label>
            <select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              className="premium-input bg-white"
              aria-label="Section"
            >
              <option value="">All Sections</option>
              {availableSections.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Date</label>
            <input
              type="date"
              value={attendanceDate}
              max={today}
              onChange={(e) => setAttendanceDate(e.target.value)}
              className="premium-input bg-white"
              aria-label="Date"
            />
          </div>
        </div>
      </section>

      <SectionCard 
        title="Attendance Roster" 
        description="Mark student attendance status. Multi-tap for quick changes."
        headerAction={
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 mr-4 px-4 py-2 rounded-2xl bg-slate-100 border border-slate-200">
               <span className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">Status:</span>
               <StatusBadge status={submissionStatus} className="h-6" />
             </div>
             {roster.length > 0 && (
               <>
                <button 
                  type="button"
                  onClick={markAllPresent}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-xl hover:bg-emerald-100 transition-colors"
                >
                  <CheckSquare size={14} />
                  Mark All Present
                </button>
                <button 
                  type="button"
                  onClick={clearAll}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <Eraser size={14} />
                  Clear Exceptions
                </button>
               </>
             )}
          </div>
        }
      >
        {rosterQuery.isLoading ? (
          <LoadingState label="Loading roster..." />
        ) : futureDateBlocked ? (
          <EmptyState title="Date Not Allowed" description="Please select a date that is not in the future." icon={<AlertCircle size={32} />} />
        ) : roster.length === 0 ? (
          <EmptyState 
            title="No Students Found" 
            description={classId ? "The selected class/section appears to be empty." : "Please select a class to view the roster."} 
            action={!classId ? undefined : (
              <button className="text-primary-600 font-bold text-sm hover:underline">Setup Class Roster</button>
            )}
          />
        ) : (
          <div className="space-y-6">
            <div
              className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-4"
              data-testid="attendance-count-summary"
            >
              <SummaryPill label="Present" value={totals.present} className="text-emerald-700" />
              <SummaryPill label="Absent" value={totals.absent} className="text-danger-700" />
              <SummaryPill label="Late" value={totals.late} className="text-warning-700" />
              <SummaryPill label="Leave / Other" value={totals.leave} className="text-info-700" />
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              Everyone is present by default. Mark exceptions only when a student is absent,
              late, sick leave, excused leave, or unexcused leave.
            </div>

            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {roster.map((student) => (
                <AttendanceRosterItem
                  key={student.id}
                  student={student}
                  status={exceptions[student.id] ?? 'PRESENT'}
                  remark={remarks[student.id] ?? ''}
                  onStatusChange={(status) => {
                    setExceptions((current) => {
                      const next = { ...current };
                      if (status === 'PRESENT') {
                        delete next[student.id];
                      } else {
                        next[student.id] = status;
                      }
                      return next;
                    });
                  }}
                  onRemarkChange={(remark) => {
                    setRemarks((current) => ({
                      ...current,
                      [student.id]: remark,
                    }));
                  }}
                />
              ))}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <strong>Offline sync:</strong> Sync offline draft changes and review conflicts
              before final submission.
            </div>
          </div>
        )}
      </SectionCard>

      {/* Summary Floating Bar */}
      {roster.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-8 p-6 bg-slate-900/95 backdrop-blur-xl text-white rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] animate-in slide-in-from-bottom-8 duration-700 border border-white/10 z-50">
          <div className="flex items-center gap-8 px-4">
            <SummaryStat label="Present" value={totals.present} color="text-emerald-400" />
            <SummaryStat label="Absent" value={totals.absent} color="text-danger-400" />
            <SummaryStat label="Late" value={totals.late} color="text-warning-400" />
            <div className="h-10 w-px bg-white/10 mx-2" />
            <div className="flex flex-col">
              <span className="text-[0.6rem] font-bold text-slate-500 uppercase tracking-[0.2em]">Completion</span>
              <span className="text-xl font-black">{presentPercent}%</span>
            </div>
          </div>

          <button
            type="button"
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
            className="flex items-center gap-3 px-10 py-4 bg-primary-500 text-white rounded-[2rem] font-black text-sm transition-all hover:scale-105 hover:bg-primary-600 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 shadow-xl shadow-primary-500/30"
          >
            {mutation.isPending ? (
              <Loader2 size={20} className="animate-spin" />
            ) : <Save size={20} />}
            Submit Attendance
          </button>
        </div>
      )}

      {mutation.isError && (
        <div className="p-6 bg-danger-50 border border-danger-100 rounded-[2rem] flex items-center gap-4 text-danger-800 text-sm font-bold animate-fade-in shadow-lg">
          <AlertCircle size={24} className="text-danger-500" />
          <div className="flex flex-col">
             <span className="text-[0.65rem] uppercase tracking-widest text-danger-600 mb-1">Submission Error</span>
             {mutation.error.message}
          </div>
        </div>
      )}

      <div className="rounded-[2.5rem] border border-slate-200 bg-slate-50 p-6 shadow-sm flex items-center justify-between mb-4">
         <div className="flex items-center gap-4 text-slate-600">
           <div className="h-10 w-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center">
             <Download size={20} className="text-slate-400" />
           </div>
           <div>
             <p className="text-xs font-bold text-slate-900">Offline sync</p>
             <p className="text-[0.65rem] mt-0.5">Sync offline draft and review conflicts before final submission.</p>
           </div>
         </div>
         <button 
           type="button"
           onClick={() => syncMutation.mutate({
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
           className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-primary-600 bg-white border border-primary-200 rounded-xl hover:bg-primary-50 transition-colors"
         >
            <Save size={14} />
            Save / Sync Draft
          </button>
      </div>
      
      <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm flex items-center justify-between">
         <div className="flex items-center gap-4 text-slate-500">
           <div className="h-10 w-10 rounded-2xl bg-slate-50 flex items-center justify-center">
             <Info size={20} />
           </div>
           <div>
             <p className="text-xs font-bold text-slate-900">Attendance Policy</p>
             <p className="text-[0.65rem] mt-0.5">Final submission locks records for the day. Corrections require administrative approval.</p>
           </div>
         </div>
         <button type="button" className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
            <Download size={14} />
            Download Sheet
          </button>
      </div>
    </div>
  );
}

function SummaryStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[0.6rem] font-bold text-slate-500 uppercase tracking-[0.2em]">{label}</span>
      <span className={cn("text-xl font-black", color)}>{value}</span>
    </div>
  );
}

function SummaryPill({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className="rounded-xl border border-white bg-white px-4 py-3 shadow-sm">
      <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className={cn('mt-1 text-2xl font-black tracking-tight', className)}>{value}</p>
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
