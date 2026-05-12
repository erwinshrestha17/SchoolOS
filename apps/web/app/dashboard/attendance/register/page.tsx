'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../../../../lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { Download, Calendar, Filter, Users, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoadingState } from '@/components/ui/loading-state';

const today = new Date();

interface AttendanceRegisterDay {
  date: string;
  isWorkingDay: boolean;
  label: string | null;
}

interface AttendanceRegisterStudent {
  studentId: string;
  fullName: string;
  rollNumber: string | null;
  statuses: (string | null)[];
  totalPresent: number;
  totalAbsent: number;
  totalLeave: number;
}

export default function AttendanceRegisterPage() {
  const [academicYearId, setAcademicYearId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());

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

  const registerQuery = useQuery({
    queryKey: ['attendance-register', academicYearId, classId, sectionId, month, year],
    queryFn: () =>
      api.getAttendanceRegister({
        academicYearId,
        classId,
        sectionId: sectionId || null,
        month,
        year,
      }),
    enabled: Boolean(academicYearId && classId && month && year),
  });

  useEffect(() => {
    const currentAcademicYear = academicYearsQuery.data?.find((year) => year.isCurrent);
    const firstAcademicYear = currentAcademicYear ?? academicYearsQuery.data?.[0];

    if (firstAcademicYear && !academicYearId) {
      setAcademicYearId(firstAcademicYear.id);
    }
  }, [academicYearId, academicYearsQuery.data]);

  useEffect(() => {
    const firstClass = classesQuery.data?.[0];

    if (firstClass && !classId) {
      setClassId(firstClass.id);
    }
  }, [classId, classesQuery.data]);

  const availableSections = (sectionsQuery.data ?? []).filter((section) => {
    const sectionClassId = section.classId ?? section.class?.id;
    return !classId || sectionClassId === classId;
  });

  const handleExportCsv = () => {
    if (!academicYearId || !classId || !month || !year) return;
    const url = new URL(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1'}/attendance/register/export`);
    url.searchParams.set('academicYearId', academicYearId);
    url.searchParams.set('classId', classId);
    if (sectionId) url.searchParams.set('sectionId', sectionId);
    url.searchParams.set('month', month.toString());
    url.searchParams.set('year', year.toString());
    window.open(url.toString(), '_blank');
  };

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  const getStatusLabel = (status: string | null) => {
    if (!status) return '-';
    if (status === 'PRESENT') return 'P';
    if (status === 'LATE') return 'L';
    if (status === 'ABSENT') return 'A';
    if (status === 'SICK_LEAVE') return 'S';
    if (status === 'EXCUSED_LEAVE' || status === 'UNEXCUSED_LEAVE') return 'E';
    return '-';
  };

  const getStatusColorClass = (status: string | null) => {
    if (!status) return 'text-slate-200';
    if (status === 'PRESENT') return 'text-emerald-600 bg-emerald-50';
    if (status === 'LATE') return 'text-warning-600 bg-warning-50';
    if (status === 'ABSENT') return 'text-danger-600 bg-danger-50';
    return 'text-info-600 bg-info-50';
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader 
        title="Attendance Register" 
        description="Comprehensive monthly attendance matrix for classroom management."
      />

      <section className="rounded-[3rem] border border-slate-100 bg-white/50 p-6 backdrop-blur-xl shadow-xl shadow-slate-200/50">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5 items-end">
          <div className="space-y-2">
            <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest ml-2">Academic Year</label>
            <select
              value={academicYearId}
              onChange={(e) => setAcademicYearId(e.target.value)}
              className="premium-input bg-white"
            >
              <option value="">Select Year</option>
              {(academicYearsQuery.data ?? []).map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                  {year.isCurrent ? ' (Current)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest ml-2">Class</label>
            <select
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setSectionId('');
              }}
              className="premium-input bg-white"
            >
              <option value="">Select Class</option>
              {(classesQuery.data ?? []).map((classroom) => (
                <option key={classroom.id} value={classroom.id}>
                  {classroom.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest ml-2">Section</label>
            <select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              className="premium-input bg-white"
            >
              <option value="">All Sections</option>
              {availableSections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest ml-2">Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="premium-input bg-white"
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label} {year}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 h-12 flex items-center justify-center gap-2 rounded-2xl bg-slate-900 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800 disabled:opacity-50"
              disabled={!academicYearId || !classId || registerQuery.isFetching}
              onClick={() => registerQuery.refetch()}
            >
              {registerQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter size={16} />}
              Apply
            </button>
            <button
              type="button"
              className="flex-1 h-12 flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              disabled={!academicYearId || !classId || !registerQuery.data?.students?.length}
              onClick={handleExportCsv}
            >
              <Download size={16} />
              CSV
            </button>
          </div>
        </div>
      </section>

      {registerQuery.isFetching ? (
        <LoadingState label="Preparing attendance matrix..." />
      ) : registerQuery.data ? (
        <div className="rounded-[2.5rem] border border-slate-100 bg-white p-6 shadow-xl overflow-x-auto relative">
          {registerQuery.data.students.length > 0 ? (
            <table className="min-w-full border-separate border-spacing-0 text-left">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white z-20 border-b-2 border-slate-100 py-4 px-4 font-black text-slate-900 text-[0.65rem] uppercase tracking-widest shadow-[4px_0_10px_-5px_rgba(0,0,0,0.05)]">
                    Student Information
                  </th>
                  {registerQuery.data.days.map((day: AttendanceRegisterDay) => (
                    <th
                      key={day.date}
                      className={cn(
                        "border-b-2 border-slate-100 py-4 px-2 text-center text-[0.65rem] font-black uppercase tracking-tighter min-w-[36px]",
                        !day.isWorkingDay ? 'bg-slate-50 text-slate-400' : 'text-slate-600'
                      )}
                      title={day.label || ''}
                    >
                      {day.date}
                    </th>
                  ))}
                  <th className="border-b-2 border-slate-100 py-4 px-3 text-center text-[0.65rem] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50/50">P</th>
                  <th className="border-b-2 border-slate-100 py-4 px-3 text-center text-[0.65rem] font-black uppercase tracking-widest text-danger-600 bg-danger-50/50">A</th>
                  <th className="border-b-2 border-slate-100 py-4 px-3 text-center text-[0.65rem] font-black uppercase tracking-widest text-warning-600 bg-warning-50/50">L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {registerQuery.data.students.map((student: AttendanceRegisterStudent) => (
                  <tr key={student.studentId} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="sticky left-0 bg-inherit z-10 py-3 px-4 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.05)]">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900 leading-tight">{student.fullName}</span>
                        <span className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest mt-0.5">ID: {student.studentId.slice(0, 8)} • Roll: {student.rollNumber || '-'}</span>
                      </div>
                    </td>
                    {student.statuses.map((status: string | null, index: number) => {
                      const day = registerQuery.data.days[index];
                      return (
                        <td
                          key={index}
                          className={cn(
                            "py-3 px-1 text-center text-[0.65rem] font-black transition-all",
                            !day.isWorkingDay ? 'bg-slate-50/50 text-slate-200' : getStatusColorClass(status)
                          )}
                        >
                          {!day.isWorkingDay ? '•' : getStatusLabel(status)}
                        </td>
                      );
                    })}
                    <td className="py-3 px-3 text-center font-black text-emerald-700 bg-emerald-50/30">
                      {student.totalPresent}
                    </td>
                    <td className="py-3 px-3 text-center font-black text-danger-700 bg-danger-50/30">
                      {student.totalAbsent}
                    </td>
                    <td className="py-3 px-3 text-center font-black text-warning-700 bg-warning-50/30">
                      {student.totalLeave}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-20 flex flex-col items-center text-center">
               <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 mb-4">
                 <Users size={32} />
               </div>
               <p className="text-sm font-bold text-slate-900 tracking-tight">No Students Found</p>
               <p className="text-xs text-slate-500 mt-1 max-w-[240px]">We couldn't find any students for the selected class and month. Please check your filters.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-[3rem] border-2 border-dashed border-slate-100 p-20 flex flex-col items-center text-center">
           <div className="h-20 w-20 rounded-[2rem] bg-slate-50 flex items-center justify-center text-slate-400 mb-6">
             <Calendar size={40} />
           </div>
           <h3 className="text-xl font-bold text-slate-900 tracking-tight">Generate Monthly Register</h3>
           <p className="text-sm text-slate-500 mt-2 max-w-md">Select an academic year and class from the filters above to load the attendance matrix.</p>
           <div className="mt-8 flex gap-3">
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-[0.65rem] font-bold text-slate-500 uppercase tracking-widest">
                <Users size={14} />
                Student Roster
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-[0.65rem] font-bold text-slate-500 uppercase tracking-widest">
                <FileText size={14} />
                PDF Export
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
