'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../../../../lib/api';

const today = new Date();

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

  const getStatusColor = (status: string | null) => {
    if (!status) return 'text-gray-300';
    if (status === 'PRESENT' || status === 'LATE') return 'text-emerald-600 font-bold';
    if (status === 'ABSENT' || status === 'UNEXCUSED_LEAVE') return 'text-danger-600 font-bold';
    return 'text-amber-600 font-bold';
  };

  const getStatusLabel = (status: string | null) => {
    if (!status) return '-';
    if (status === 'PRESENT') return 'P';
    if (status === 'LATE') return 'L';
    if (status === 'ABSENT') return 'A';
    if (status === 'SICK_LEAVE') return 'S';
    if (status === 'EXCUSED_LEAVE' || status === 'UNEXCUSED_LEAVE') return 'E';
    return '-';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Monthly Attendance Register
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          View and export the daily attendance matrix for a selected class and month.
        </p>
      </div>

      <section className="rounded-[30px] border border-[var(--line)] bg-white/90 p-5 shadow-sm backdrop-blur-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5 items-end">
          <label className="grid gap-2">
            <span className="label">Academic year</span>
            <select
              value={academicYearId}
              onChange={(event) => setAcademicYearId(event.target.value)}
            >
              <option value="">Select year</option>
              {(academicYearsQuery.data ?? []).map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                  {year.isCurrent ? ' (current)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="label">Class</span>
            <select
              value={classId}
              onChange={(event) => {
                setClassId(event.target.value);
                setSectionId('');
              }}
            >
              <option value="">Select class</option>
              {(classesQuery.data ?? []).map((classroom) => (
                <option key={classroom.id} value={classroom.id}>
                  {classroom.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="label">Section</span>
            <select
              value={sectionId}
              onChange={(event) => setSectionId(event.target.value)}
            >
              <option value="">All sections</option>
              {availableSections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="label">Month</span>
            <select
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label} {year}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2 h-10">
            <button
              type="button"
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:translate-y-0 disabled:opacity-50"
              disabled={!academicYearId || !classId || registerQuery.isFetching}
              onClick={() => registerQuery.refetch()}
            >
              {registerQuery.isFetching ? 'Loading...' : 'Load'}
            </button>
            <button
              type="button"
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-gray-50 disabled:translate-y-0 disabled:opacity-50"
              disabled={!academicYearId || !classId || !registerQuery.data?.students?.length}
              onClick={handleExportCsv}
            >
              Export CSV
            </button>
          </div>
        </div>
      </section>

      {registerQuery.data ? (
        <section className="rounded-[30px] border border-[var(--line)] bg-white p-5 shadow-sm overflow-x-auto">
          {registerQuery.data.students.length > 0 ? (
            <table className="min-w-full border-collapse text-sm text-left">
              <thead>
                <tr>
                  <th className="border-b border-gray-200 py-3 px-2 font-semibold text-gray-900 sticky left-0 bg-white shadow-[1px_0_0_0_#e5e7eb] z-10">
                    Student
                  </th>
                  {registerQuery.data.days.map((day: any) => (
                    <th
                      key={day.date}
                      className={`border-b border-gray-200 py-3 px-2 text-center text-xs font-semibold ${
                        !day.isWorkingDay ? 'bg-gray-50 text-gray-400' : 'text-gray-900'
                      }`}
                      title={day.label || ''}
                    >
                      {day.date}
                    </th>
                  ))}
                  <th className="border-b border-gray-200 py-3 px-2 text-center text-xs font-semibold text-emerald-700">P</th>
                  <th className="border-b border-gray-200 py-3 px-2 text-center text-xs font-semibold text-danger-700">A</th>
                  <th className="border-b border-gray-200 py-3 px-2 text-center text-xs font-semibold text-amber-700">L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {registerQuery.data.students.map((student: any) => (
                  <tr key={student.studentId} className="hover:bg-gray-50">
                    <td className="py-2 px-2 sticky left-0 bg-inherit shadow-[1px_0_0_0_#e5e7eb] whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">{student.fullName}</span>
                        <span className="text-xs text-gray-500">Roll: {student.rollNumber || '-'}</span>
                      </div>
                    </td>
                    {student.statuses.map((status: string | null, index: number) => {
                      const day = registerQuery.data.days[index];
                      return (
                        <td
                          key={index}
                          className={`py-2 px-1 text-center text-xs ${
                            !day.isWorkingDay ? 'bg-gray-50 text-gray-300' : getStatusColor(status)
                          }`}
                        >
                          {!day.isWorkingDay ? 'H' : getStatusLabel(status)}
                        </td>
                      );
                    })}
                    <td className="py-2 px-2 text-center font-semibold text-emerald-700 bg-emerald-50/50">
                      {student.totalPresent}
                    </td>
                    <td className="py-2 px-2 text-center font-semibold text-danger-700 bg-danger-50/50">
                      {student.totalAbsent}
                    </td>
                    <td className="py-2 px-2 text-center font-semibold text-amber-700 bg-amber-50/50">
                      {student.totalLeave}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-12 text-center">
              <p className="text-gray-500">No student records found for the selected criteria.</p>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
