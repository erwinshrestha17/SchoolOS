'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

const today = new Date().toISOString().slice(0, 10);

const statusCycle = [
  'PRESENT',
  'ABSENT',
  'LATE',
  'SICK_LEAVE',
  'EXCUSED_LEAVE',
  'UNEXCUSED_LEAVE',
] as const;

type AttendanceStatus = (typeof statusCycle)[number];

const statusLabels: Record<AttendanceStatus, string> = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  LATE: 'Late',
  SICK_LEAVE: 'Sick leave',
  EXCUSED_LEAVE: 'Excused leave',
  UNEXCUSED_LEAVE: 'Unexcused leave',
};

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
  const analyticsQuery = useQuery({
    queryKey: ['attendance-analytics'],
    queryFn: api.listAttendanceAnalytics,
  });
  const conflictsQuery = useQuery({
    queryKey: ['attendance-conflicts'],
    queryFn: api.listAttendanceConflicts,
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
    setRemarks({});
    setSubmitMessage('');
  }, [academicYearId, classId, sectionId, attendanceDate]);

  useEffect(() => {
    if (!rosterQuery.data) {
      return;
    }

    const existingExceptions = rosterQuery.data.students.reduce(
      (next, student) => {
        const normalized = normalizeStatus(student.status);

        if (normalized !== 'PRESENT') {
          next[student.id] = normalized;
        }

        return next;
      },
      {} as Record<string, AttendanceStatus>,
    );
    const existingRemarks = rosterQuery.data.students.reduce(
      (next, student) => {
        if (student.remark) {
          next[student.id] = student.remark;
        }

        return next;
      },
      {} as Record<string, string>,
    );

    setExceptions(existingExceptions);
    setRemarks(existingRemarks);
  }, [rosterQuery.data]);

  const availableSections = (sectionsQuery.data ?? []).filter((section) => {
    const sectionClassId = section.classId ?? section.class?.id;
    return !classId || sectionClassId === classId;
  });
  const hasAcademicYears = (academicYearsQuery.data ?? []).length > 0;
  const hasClasses = (classesQuery.data ?? []).length > 0;
  const setupIsLoading = academicYearsQuery.isLoading || classesQuery.isLoading;
  const setupIsMissing = !hasAcademicYears || !hasClasses;
  const futureDateBlocked = isFutureDate(attendanceDate);

  const mutation = useMutation({
    mutationFn: api.submitAttendance,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['attendance-roster'] });
      void queryClient.invalidateQueries({ queryKey: ['attendance-analytics'] });
      void queryClient.invalidateQueries({ queryKey: ['attendance-conflicts'] });
      setSubmitMessage(
        `Submitted at ${new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}. Parent notifications queued.`,
      );
    },
  });
  const syncMutation = useMutation({
    mutationFn: api.syncAttendance,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['attendance-roster'] });
      void queryClient.invalidateQueries({ queryKey: ['attendance-analytics'] });
      void queryClient.invalidateQueries({ queryKey: ['attendance-conflicts'] });
    },
  });
  const reviewMutation = useMutation({
    mutationFn: ({ id, resolutionNote }: { id: string; resolutionNote: string }) =>
      api.reviewAttendanceConflict(id, { resolutionNote }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['attendance-conflicts'] });
      void queryClient.invalidateQueries({ queryKey: ['attendance-analytics'] });
      void queryClient.invalidateQueries({ queryKey: ['attendance-roster'] });
    },
  });

  function cycleStudentStatus(studentId: string) {
    const currentStatus = exceptions[studentId] ?? 'PRESENT';
    const nextStatus =
      statusCycle[(statusCycle.indexOf(currentStatus) + 1) % statusCycle.length];
    setStudentStatus(studentId, nextStatus);
  }

  function setStudentStatus(studentId: string, status: AttendanceStatus) {
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

    if (status === 'PRESENT') {
      setRemarks((current) => {
        const next = { ...current };
        delete next[studentId];
        return next;
      });
    }
  }

  const roster = rosterQuery.data?.students ?? [];
  const exceptionPayload = Object.entries(exceptions).map(([studentId, status]) => ({
    studentId,
    status,
    remark: remarks[studentId]?.trim() || null,
  }));
  const attendancePayload = {
    academicYearId,
    classId,
    sectionId: sectionId || null,
    attendanceDate: new Date(attendanceDate).toISOString(),
    exceptions: exceptionPayload,
  };
  const rosterTotals = roster.reduce(
    (totals, student) => {
      const status = exceptions[student.id] ?? 'PRESENT';
      const leaveIncrement = isLeaveStatus(status) ? 1 : 0;

      return {
        total: totals.total + 1,
        present: totals.present + (status === 'PRESENT' ? 1 : 0),
        absent: totals.absent + (status === 'ABSENT' ? 1 : 0),
        late: totals.late + (status === 'LATE' ? 1 : 0),
        leave: totals.leave + leaveIncrement,
      };
    },
    { total: 0, present: 0, absent: 0, late: 0, leave: 0 },
  );
  const sessionBadge = resolveSessionBadge(rosterQuery.data?.existingSession);

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="label mb-2">3-Tap Flow</p>
            <h2 className="text-xl font-bold text-gray-900">
              Open class → tap exceptions → submit
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              All students are present by default. Tap only exceptions.
            </p>
          </div>
          <span
            className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold ${sessionBadge.className}`}
          >
            {sessionBadge.label}
          </span>
        </div>

        {setupIsLoading ? <SetupSkeleton /> : null}
        {!setupIsLoading && setupIsMissing ? (
          <SetupRequiredCard
            hasAcademicYears={hasAcademicYears}
            hasClasses={hasClasses}
          />
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
            <span className="label">Date</span>
            <input
              type="date"
              value={attendanceDate}
              max={today}
              onChange={(event) => setAttendanceDate(event.target.value)}
            />
            {futureDateBlocked ? (
              <span className="text-xs text-danger-600">
                Future dates cannot be submitted.
              </span>
            ) : null}
          </label>
        </div>

        {rosterQuery.data?.existingSession ? (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
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
      </section>

      <section className="grid gap-3">
        {rosterQuery.isLoading ? <RosterSkeleton /> : null}
        {futureDateBlocked ? (
          <EmptyRosterState message="Pick today or a past date to load and submit attendance." />
        ) : null}
        {roster.length === 0 && rosterQuery.isSuccess ? (
          <EmptyRosterState message="No students are enrolled for this class/section yet." />
        ) : null}
        {roster.map((student) => {
          const status = exceptions[student.id] ?? 'PRESENT';
          const style = rowStyle(status);

          return (
            <article
              key={student.id}
              className={`rounded-2xl border ${style.card} p-4 shadow-sm`}
            >
              <button
                type="button"
                className="flex min-h-16 w-full items-center gap-4 text-left"
                onClick={() => cycleStudentStatus(student.id)}
                aria-label={`Cycle attendance status for ${student.fullNameEn}. Current status: ${statusLabels[status]}`}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-gray-700 ring-1 ring-gray-200">
                  {student.rollNumber ?? student.fullNameEn[0]?.toUpperCase() ?? 'S'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-gray-900">
                      {student.fullNameEn}
                    </p>
                    {student.hasMedicalAlert ? (
                      <span className="rounded-full bg-danger-50 px-2 py-0.5 text-xs font-semibold text-danger-600">
                        Health alert
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {student.studentSystemId}
                    {student.rollNumber ? ` / Roll ${student.rollNumber}` : ''}
                  </p>
                </div>
                <span
                  className={`inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold ${style.badge}`}
                >
                  {statusLabels[status]}
                </span>
              </button>

              <div className="mt-3 flex flex-wrap gap-2">
                {statusCycle.map((nextStatus) => (
                  <button
                    key={nextStatus}
                    type="button"
                    className={`inline-flex min-h-11 items-center rounded-xl border px-3 text-xs font-semibold ${
                      status === nextStatus
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 bg-white text-gray-600'
                    }`}
                    aria-label={`Mark ${student.fullNameEn} as ${statusLabels[nextStatus]}`}
                    onClick={() => setStudentStatus(student.id, nextStatus)}
                  >
                    {statusLabels[nextStatus]}
                  </button>
                ))}
              </div>

              {status !== 'PRESENT' ? (
                <label className="mt-3 block">
                  <span className="label mb-2 block">Remark</span>
                  <input
                    value={remarks[student.id] ?? ''}
                    placeholder="Optional note for this exception"
                    onChange={(event) =>
                      setRemarks((current) => ({
                        ...current,
                        [student.id]: event.target.value,
                      }))
                    }
                  />
                </label>
              ) : null}
            </article>
          );
        })}
      </section>

      <SummaryBar
        canSubmit={
          Boolean(academicYearId && classId) &&
          roster.length > 0 &&
          !futureDateBlocked &&
          !setupIsMissing
        }
        isSubmitting={mutation.isPending}
        onSubmit={() => mutation.mutate(attendancePayload)}
        totals={rosterTotals}
      />

      {mutation.isError ? (
        <InlineMessage
          tone="danger"
          message={`${mutation.error.message} ${
            rosterQuery.data?.existingSession
              ? `Locked at ${new Date(rosterQuery.data.existingSession.lockAt).toLocaleString()}.`
              : ''
          }`}
        />
      ) : null}
      {submitMessage ? <InlineMessage tone="success" message={submitMessage} /> : null}

      <details className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer text-sm font-bold text-gray-900">
          Sync offline draft
        </summary>
        <p className="mt-3 text-sm leading-6 text-gray-500">
          Use this only when a saved browser draft needs to be reconciled with the
          server. Normal daily attendance should use Submit attendance.
        </p>
        <button
          type="button"
          className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-700 disabled:opacity-50"
          disabled={
            !academicYearId ||
            !classId ||
            roster.length === 0 ||
            syncMutation.isPending ||
            futureDateBlocked
          }
          onClick={() =>
            syncMutation.mutate({
              ...attendancePayload,
              clientSubmissionId: `web-${Date.now()}`,
              deviceTimestamp: new Date().toISOString(),
              deviceLabel: 'SchoolOS web dashboard',
            })
          }
        >
          {syncMutation.isPending ? 'Syncing draft...' : 'Sync offline draft'}
        </button>
        {syncMutation.isError ? (
          <InlineMessage tone="danger" message={syncMutation.error.message} />
        ) : null}
        {syncMutation.data ? (
          <InlineMessage
            tone="success"
            message={`Offline draft synced as ${syncMutation.data.syncStatus}${
              syncMutation.data.conflictId
                ? ` with conflict ${syncMutation.data.conflictId}`
                : ''
            }.`}
          />
        ) : null}
      </details>

      <AttendanceAnalyticsSection analyticsQuery={analyticsQuery} />
      <ConflictReviewSection
        analyticsQuery={analyticsQuery}
        conflictsQuery={conflictsQuery}
        reviewMutation={reviewMutation}
      />
    </div>
  );
}

function SummaryBar({
  canSubmit,
  isSubmitting,
  onSubmit,
  totals,
}: {
  canSubmit: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
  totals: {
    absent: number;
    late: number;
    leave: number;
    present: number;
    total: number;
  };
}) {
  const exceptionsOnly = totals.absent + totals.late + totals.leave;

  return (
    <div className="sticky bottom-3 z-10 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <SummaryCount label="Present" value={totals.present} />
          <SummaryCount label="Absent" value={totals.absent} />
          <SummaryCount label="Late" value={totals.late} />
          <SummaryCount label="Leave" value={totals.leave} />
          <SummaryCount label="Total" value={totals.total} />
        </div>
        <button
          type="button"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-gray-900 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
          disabled={!canSubmit || isSubmitting}
          onClick={onSubmit}
        >
          {isSubmitting
            ? 'Submitting...'
            : `Submit attendance (${exceptionsOnly} exceptions only)`}
        </button>
      </div>
    </div>
  );
}

function SummaryCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}

function AttendanceAnalyticsSection({
  analyticsQuery,
}: {
  analyticsQuery: ReturnType<typeof useQuery<Awaited<ReturnType<typeof api.listAttendanceAnalytics>>, Error>>;
}) {
  return (
    <section className="shell-card rounded-[28px] p-6">
      <p className="label mb-4">Recent Attendance Analytics</p>
      {analyticsQuery.isLoading ? <RosterSkeleton /> : null}
      {analyticsQuery.isError ? (
        <InlineMessage tone="danger" message={analyticsQuery.error.message} />
      ) : null}
      {analyticsQuery.data ? (
        <div className="grid gap-3 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="grid gap-3">
            {(analyticsQuery.data.latestSessions ?? []).slice(0, 5).map((session) => (
              <div key={session.sessionId} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="font-semibold text-gray-900">
                  {session.className}
                  {session.sectionName ? ` / ${session.sectionName}` : ''} /{' '}
                  {new Date(session.attendanceDate).toLocaleDateString()}
                </p>
                <p className="text-sm text-gray-500">
                  Present {session.totals.present}, absent {session.totals.absent},
                  late {session.totals.late}, leave {session.totals.leave} /{' '}
                  {session.conflictStatus}
                </p>
              </div>
            ))}
            {analyticsQuery.data.latestSessions.length === 0 ? (
              <p className="text-sm text-gray-500">No attendance sessions yet.</p>
            ) : null}
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="font-semibold text-gray-900">Absence Hotlist</p>
            <div className="mt-3 grid gap-2 text-sm text-gray-500">
              {(analyticsQuery.data.absenceHotlist ?? []).slice(0, 5).map((item) => (
                <span key={item.studentId}>
                  {item.studentId}: {item.absenceCount} absences
                </span>
              ))}
              {analyticsQuery.data.absenceHotlist.length === 0 ? (
                <span>No absence pattern yet.</span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ConflictReviewSection({
  analyticsQuery,
  conflictsQuery,
  reviewMutation,
}: {
  analyticsQuery: ReturnType<typeof useQuery<Awaited<ReturnType<typeof api.listAttendanceAnalytics>>, Error>>;
  conflictsQuery: ReturnType<typeof useQuery<Awaited<ReturnType<typeof api.listAttendanceConflicts>>, Error>>;
  reviewMutation: ReturnType<typeof useMutation<unknown, Error, { id: string; resolutionNote: string }>>;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="shell-card rounded-[28px] p-6">
        <p className="label mb-4">Conflict Review</p>
        {conflictsQuery.isLoading ? <RosterSkeleton /> : null}
        {conflictsQuery.isError ? (
          <InlineMessage tone="danger" message={conflictsQuery.error.message} />
        ) : null}
        <div className="grid gap-3">
          {(conflictsQuery.data ?? []).slice(0, 5).map((conflict) => (
            <div key={conflict.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="font-semibold text-gray-900">
                {conflict.className ?? 'Attendance session'}
                {conflict.sectionName ? ` / ${conflict.sectionName}` : ''}
              </p>
              <p className="text-sm text-gray-500">
                {conflict.status} / submitted {new Date(conflict.submittedAt).toLocaleString()}
                {conflict.reviewedAt
                  ? ` / reviewed ${new Date(conflict.reviewedAt).toLocaleString()}`
                  : ''}
              </p>
              {!conflict.reviewedAt ? (
                <button
                  type="button"
                  className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-primary-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
                  disabled={reviewMutation.isPending}
                  onClick={() =>
                    reviewMutation.mutate({
                      id: conflict.id,
                      resolutionNote: 'Reviewed from admin attendance screen.',
                    })
                  }
                >
                  Mark reviewed
                </button>
              ) : null}
            </div>
          ))}
          {conflictsQuery.data?.length === 0 ? (
            <p className="text-sm text-gray-500">No attendance conflicts waiting.</p>
          ) : null}
        </div>
        {reviewMutation.isError ? (
          <InlineMessage tone="danger" message={reviewMutation.error.message} />
        ) : null}
      </section>

      <section className="shell-card rounded-[28px] p-6">
        <p className="label mb-4">Attendance Risk Alerts</p>
        <AttendanceRiskAlerts analyticsQuery={analyticsQuery} />
      </section>
    </div>
  );
}

function AttendanceRiskAlerts({
  analyticsQuery,
}: {
  analyticsQuery: ReturnType<typeof useQuery<Awaited<ReturnType<typeof api.listAttendanceAnalytics>>, Error>>;
}) {
  if (analyticsQuery.isLoading) {
    return <RosterSkeleton />;
  }

  if (analyticsQuery.isError) {
    return <InlineMessage tone="danger" message={analyticsQuery.error.message} />;
  }

  return (
    <div className="grid gap-4">
      <div>
        <p className="font-semibold text-gray-900">Below 80 percent</p>
        <div className="mt-2 grid gap-2 text-sm text-gray-500">
          {(analyticsQuery.data?.below80Warnings ?? []).slice(0, 5).map((item) => (
            <span key={item.studentId}>
              {item.fullNameEn} / {item.studentSystemId} / {item.attendancePercent}%
            </span>
          ))}
          {analyticsQuery.data?.below80Warnings?.length === 0 ? (
            <span>No below-80 warning yet.</span>
          ) : null}
        </div>
      </div>
      <div>
        <p className="font-semibold text-gray-900">Consecutive absences</p>
        <div className="mt-2 grid gap-2 text-sm text-gray-500">
          {(analyticsQuery.data?.consecutiveAbsences ?? []).slice(0, 5).map((item) => (
            <span key={item.studentId}>
              {item.studentId}: {item.consecutiveAbsences} consecutive absences
            </span>
          ))}
          {analyticsQuery.data?.consecutiveAbsences?.length === 0 ? (
            <span>No consecutive absence pattern yet.</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SetupRequiredCard({
  hasAcademicYears,
  hasClasses,
}: {
  hasAcademicYears: boolean;
  hasClasses: boolean;
}) {
  return (
    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-semibold">Setup required before marking attendance</p>
      <p className="mt-2">
        {!hasAcademicYears ? 'Create an academic year. ' : ''}
        {!hasClasses ? 'Create at least one class. ' : ''}
      </p>
      <Link
        href="/dashboard/settings"
        className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-amber-900 px-4 text-sm font-semibold text-white"
      >
        Open Settings
      </Link>
    </div>
  );
}

function SetupSkeleton() {
  return (
    <div className="mb-4 grid gap-3 md:grid-cols-3">
      <div className="h-12 animate-pulse rounded-xl bg-gray-100" />
      <div className="h-12 animate-pulse rounded-xl bg-gray-100" />
      <div className="h-12 animate-pulse rounded-xl bg-gray-100" />
    </div>
  );
}

function RosterSkeleton() {
  return (
    <div className="grid gap-3">
      <div className="h-24 animate-pulse rounded-2xl bg-gray-100" />
      <div className="h-24 animate-pulse rounded-2xl bg-gray-100" />
      <div className="h-24 animate-pulse rounded-2xl bg-gray-100" />
    </div>
  );
}

function EmptyRosterState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-5 text-center text-sm text-gray-500">
      {message}
    </div>
  );
}

function InlineMessage({
  message,
  tone,
}: {
  message: string;
  tone: 'danger' | 'success';
}) {
  const className =
    tone === 'danger'
      ? 'border-danger-200 bg-danger-50 text-danger-600'
      : 'border-success-200 bg-success-50 text-success-600';

  return <p className={`rounded-2xl border p-4 text-sm ${className}`}>{message}</p>;
}

function normalizeStatus(status: string | null | undefined): AttendanceStatus {
  if (status === 'A' || status === 'ABSENT') {
    return 'ABSENT';
  }

  if (status === 'L' || status === 'LATE') {
    return 'LATE';
  }

  if (status === 'LS' || status === 'SICK_LEAVE') {
    return 'SICK_LEAVE';
  }

  if (status === 'LE' || status === 'EXCUSED_LEAVE') {
    return 'EXCUSED_LEAVE';
  }

  if (status === 'LU' || status === 'UNEXCUSED_LEAVE') {
    return 'UNEXCUSED_LEAVE';
  }

  return 'PRESENT';
}

function isLeaveStatus(status: AttendanceStatus) {
  return ['SICK_LEAVE', 'EXCUSED_LEAVE', 'UNEXCUSED_LEAVE'].includes(status);
}

function isFutureDate(value: string) {
  return value > today;
}

function rowStyle(status: AttendanceStatus) {
  if (status === 'ABSENT') {
    return {
      card: 'border-danger-200 border-l-4 border-l-danger-500 bg-danger-50',
      badge: 'bg-danger-500 text-white',
    };
  }

  if (status === 'LATE') {
    return {
      card: 'border-warning-200 border-l-4 border-l-warning-500 bg-warning-50',
      badge: 'bg-warning-500 text-white',
    };
  }

  if (isLeaveStatus(status)) {
    return {
      card: 'border-primary-200 border-l-4 border-l-primary-500 bg-primary-50',
      badge: 'bg-primary-500 text-white',
    };
  }

  return {
    card: 'border-gray-200 bg-white',
    badge: 'bg-gray-100 text-gray-700',
  };
}

function resolveSessionBadge(
  existingSession:
    | {
        conflictStatus: string;
        lockAt: string;
      }
    | null
    | undefined,
) {
  if (!existingSession) {
    return {
      label: 'Pending',
      className: 'bg-gray-100 text-gray-700',
    };
  }

  if (
    existingSession.conflictStatus &&
    !['NONE', 'RESOLVED', 'REVIEWED'].includes(
      existingSession.conflictStatus.toUpperCase(),
    )
  ) {
    return {
      label: 'Conflict Review',
      className: 'bg-warning-50 text-warning-600',
    };
  }

  if (new Date(existingSession.lockAt).getTime() <= Date.now()) {
    return {
      label: 'Locked',
      className: 'bg-danger-50 text-danger-600',
    };
  }

  return {
    label: 'Submitted',
    className: 'bg-success-50 text-success-600',
  };
}
