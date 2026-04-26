'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

const today = new Date().toISOString().slice(0, 10);

export function AttendanceForm() {
  const queryClient = useQueryClient();
  const [academicYearId, setAcademicYearId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(today);
  const [exceptions, setExceptions] = useState<Record<string, string>>({});

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
    enabled: Boolean(academicYearId && classId),
  });
  const analyticsQuery = useQuery({
    queryKey: ['attendance-analytics'],
    queryFn: api.listAttendanceAnalytics,
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

  useEffect(() => {
    setExceptions({});
  }, [academicYearId, classId, sectionId, attendanceDate]);

  const availableSections = (sectionsQuery.data ?? []).filter((section) => {
    const sectionClassId = section.classId ?? section.class?.id;
    return !classId || sectionClassId === classId;
  });

  const mutation = useMutation({
    mutationFn: api.submitAttendance,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['attendance-roster'] });
    },
  });

  function setStatus(studentId: string, status: string) {
    setExceptions((current) => {
      if (status === 'PRESENT') {
        const next = { ...current };
        delete next[studentId];
        return next;
      }

      return {
        ...current,
        [studentId]: status,
      };
    });
  }

  const roster = rosterQuery.data?.students ?? [];
  const rosterTotals = roster.reduce(
    (totals, student) => {
      const status = exceptions[student.id] ?? student.status ?? 'PRESENT';

      return {
        ...totals,
        [status]: (totals[status] ?? 0) + 1,
      };
    },
    { PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0 } as Record<string, number>,
  );

  return (
    <div className="grid gap-4">
      <div className="rounded-[24px] border border-[var(--line)] bg-white/60 p-5">
        <p className="label mb-3">3-Tap Flow</p>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Everyone is present by default. Pick the academic year and class, mark only the exceptions, then submit once.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <label className="grid gap-2">
          <span className="label">Academic year</span>
          <select value={academicYearId} onChange={(event) => setAcademicYearId(event.target.value)}>
            <option value="">Select year</option>
            {(academicYearsQuery.data ?? []).map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
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
          <select value={sectionId} onChange={(event) => setSectionId(event.target.value)}>
            <option value="">All sections</option>
            {availableSections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2">
          <span className="label">Date</span>
          <input
            type="date"
            value={attendanceDate}
            onChange={(event) => setAttendanceDate(event.target.value)}
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {['PRESENT', 'ABSENT', 'LATE', 'LEAVE'].map((status) => (
          <div key={status} className="rounded-2xl border border-[var(--line)] bg-white/60 p-4">
            <p className="label mb-2">{status}</p>
            <p className="text-3xl font-black text-[var(--ink)]">{rosterTotals[status] ?? 0}</p>
          </div>
        ))}
      </div>

      {rosterQuery.isLoading ? (
        <p className="rounded-2xl border border-[var(--line)] bg-white/60 p-4 text-sm text-[var(--muted)]">
          Loading roster...
        </p>
      ) : null}

      {roster.length === 0 && rosterQuery.isSuccess ? (
        <p className="rounded-2xl border border-[var(--line)] bg-white/60 p-4 text-sm text-[var(--muted)]">
          No students are enrolled for this class/section yet.
        </p>
      ) : null}

      <div className="grid gap-3">
        {roster.map((student) => {
          const status = exceptions[student.id] ?? student.status ?? 'PRESENT';

          return (
            <div
              key={student.id}
              className="shell-card flex flex-col gap-4 rounded-[24px] px-5 py-4 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="font-semibold">{student.fullNameEn}</p>
                <p className="text-sm text-[var(--muted)]">
                  {student.studentSystemId}
                  {student.rollNumber ? ` / Roll ${student.rollNumber}` : ''} / {status}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {['PRESENT', 'ABSENT', 'LATE', 'LEAVE'].map((nextStatus) => (
                  <button
                    key={nextStatus}
                    type="button"
                    className={`rounded-full border px-3 py-2 text-xs ${
                      status === nextStatus
                        ? 'border-[var(--teal)] bg-[var(--teal)] text-white'
                        : 'border-[var(--line)]'
                    }`}
                    onClick={() => setStatus(student.id, nextStatus)}
                  >
                    {nextStatus}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        className="rounded-2xl bg-[var(--ink)] px-5 py-3 font-semibold text-white disabled:opacity-50"
        disabled={!academicYearId || !classId || roster.length === 0 || mutation.isPending}
        onClick={() =>
          mutation.mutate({
            academicYearId,
            classId,
            sectionId: sectionId || null,
            attendanceDate: new Date(attendanceDate).toISOString(),
            exceptions: Object.entries(exceptions).map(([studentId, status]) => ({
              studentId,
              status,
            })),
          })
        }
      >
        {mutation.isPending ? 'Submitting...' : 'Submit attendance'}
      </button>

      {rosterQuery.data?.existingSession ? (
        <div className="rounded-2xl border border-[var(--line)] bg-white/60 p-4 text-sm text-[var(--muted)]">
          <p>
            Existing session lock:{' '}
            {new Date(rosterQuery.data.existingSession.lockAt).toLocaleString()}.
          </p>
          <p>
            Conflict status: {rosterQuery.data.existingSession.conflictStatus}.
            Resubmissions before lock are flagged for review.
          </p>
        </div>
      ) : null}
      {mutation.isError ? (
        <p className="text-sm text-[var(--accent-dark)]">{mutation.error.message}</p>
      ) : null}
      {mutation.isSuccess ? (
        <p className="text-sm text-[var(--teal)]">
          Attendance submitted. Absence delivery records are queued through the communications adapter.
        </p>
      ) : null}

      <section className="shell-card rounded-[28px] p-6">
        <p className="label mb-4">Recent Attendance Analytics</p>
        <div className="grid gap-3 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="grid gap-3">
            {(analyticsQuery.data?.latestSessions ?? []).slice(0, 5).map((session) => (
              <div key={session.sessionId} className="rounded-2xl border border-[var(--line)] bg-white/55 p-4">
                <p className="font-semibold">
                  {session.className}
                  {session.sectionName ? ` / ${session.sectionName}` : ''} /{' '}
                  {new Date(session.attendanceDate).toLocaleDateString()}
                </p>
                <p className="text-sm text-[var(--muted)]">
                  Present {session.totals.present}, absent {session.totals.absent},
                  late {session.totals.late}, leave {session.totals.leave} /{' '}
                  {session.conflictStatus}
                </p>
              </div>
            ))}
            {analyticsQuery.data?.latestSessions.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No attendance sessions yet.</p>
            ) : null}
          </div>
          <div className="rounded-2xl border border-[var(--line)] bg-white/55 p-4">
            <p className="font-semibold">Absence Hotlist</p>
            <div className="mt-3 grid gap-2 text-sm text-[var(--muted)]">
              {(analyticsQuery.data?.absenceHotlist ?? []).slice(0, 5).map((item) => (
                <span key={item.studentId}>
                  {item.studentId}: {item.absenceCount} absences
                </span>
              ))}
              {analyticsQuery.data?.absenceHotlist.length === 0 ? (
                <span>No absence pattern yet.</span>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
