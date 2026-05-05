'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../../lib/api';
import type {
  AcademicYearSummary,
  ClassSummary,
  RoomSummary,
  SectionSummary,
  StaffSummary,
  SubjectSummary,
  TimetableSlotSummary,
  TimetableValidationResult,
  TimetableVersionSummary,
} from '@schoolos/core';

type Props = {
  academicYears: AcademicYearSummary[];
  classes: ClassSummary[];
  allSections: SectionSummary[];
  subjects: SubjectSummary[];
  staff: StaffSummary[];
  timetable: TimetableSlotSummary[];
  isLoadingTimetable: boolean;
  classId: string;
  setClassId: (id: string) => void;
};

const daysOfWeek = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
];

export function TimetableBuilderTab({
  academicYears,
  classes,
  allSections,
  subjects,
  staff,
  timetable,
  isLoadingTimetable,
  classId,
  setClassId,
}: Props) {
  const queryClient = useQueryClient();
  const currentYear = academicYears.find((year) => year.isCurrent) ?? academicYears[0];
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [validationResult, setValidationResult] = useState<TimetableValidationResult | null>(null);

  const [slot, setSlot] = useState({
    academicYearId: currentYear?.id ?? '',
    sectionId: '',
    subjectId: '',
    staffId: '',
    dayOfWeek: 1,
    startsAt: '09:00',
    endsAt: '09:45',
    room: '',
  });

  const slotMut = useMutation({
    mutationFn: api.createTimetableSlot,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['timetable', classId] });
      void queryClient.invalidateQueries({ queryKey: ['teacher-workload'] });
      // Reset some fields to make rapid entry easier
      setSlot((c) => ({ ...c, subjectId: '', startsAt: c.endsAt, endsAt: calculateNextEnd(c.endsAt) }));
    },
  });

  const periodsQuery = useQuery({
    queryKey: ['timetable-periods', currentYear?.id],
    queryFn: () => api.listTimetablePeriods({ academicYearId: currentYear?.id }),
    enabled: Boolean(currentYear?.id),
  });

  const roomsQuery = useQuery({
    queryKey: ['timetable-rooms'],
    queryFn: api.listRooms,
  });

  const versionsQuery = useQuery({
    queryKey: ['timetable-versions', currentYear?.id, classId],
    queryFn: () =>
      api.listTimetableVersions({
        academicYearId: currentYear?.id,
        classId,
      }),
    enabled: Boolean(currentYear?.id && classId),
  });

  const substitutionsQuery = useQuery({
    queryKey: ['timetable-substitutions', classId],
    queryFn: () => api.listSubstitutions({ classId }),
    enabled: Boolean(classId),
  });

  const createVersionMut = useMutation({
    mutationFn: () =>
      api.createTimetableVersion({
        academicYearId: currentYear?.id ?? '',
        classId,
        versionName: `Draft timetable ${new Date().toLocaleDateString()}`,
        effectiveFrom: currentYear?.startsOn ?? new Date().toISOString(),
      }),
    onSuccess: (version: TimetableVersionSummary) => {
      setSelectedVersionId(version.id);
      void queryClient.invalidateQueries({ queryKey: ['timetable-versions'] });
    },
  });

  const validateVersionMut = useMutation({
    mutationFn: api.validateTimetableVersion,
    onSuccess: setValidationResult,
  });

  const publishVersionMut = useMutation({
    mutationFn: api.publishTimetableVersion,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['timetable-versions'] }),
  });

  const lockVersionMut = useMutation({
    mutationFn: api.lockTimetableVersion,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['timetable-versions'] }),
  });

  const archiveVersionMut = useMutation({
    mutationFn: api.archiveTimetableVersion,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['timetable-versions'] }),
  });

  // Helper to add 45 minutes to a time string (HH:MM)
  const calculateNextEnd = (time: string) => {
    if (!time) return '';
    const [h, m] = time.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m + 45, 0, 0);
    return date.toTimeString().slice(0, 5);
  };

  const sectionsForClass = allSections.filter((section) => section.classId === classId);
  const rooms = roomsQuery.data ?? [];
  const versions = versionsQuery.data ?? [];
  const activeVersionId = selectedVersionId || versions[0]?.id || '';

  // Group timetable by day
  const gridByDay = daysOfWeek.reduce((acc, day) => {
    acc[day.value] = timetable
      .filter((entry) => entry.dayOfWeek === day.value)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return acc;
  }, {} as Record<number, any[]>);

  return (
    <div className="space-y-6">
      {/* Class Context Selector */}
      <section className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm flex items-end gap-4">
        <div className="flex-1">
          <label className="mb-2 block text-sm font-semibold text-gray-700">Select Class</label>
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className="w-full">
            <option value="">Choose a class to view/build timetable</option>
            {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </section>

      {classId && (
        <div className="space-y-6">
          <section className="grid gap-4 rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm xl:grid-cols-4">
            <SetupColumn
              title="Periods"
              body={`${periodsQuery.data?.length ?? 0} configured`}
              detail="Create and edit periods from the setup API; slots can link to these period records."
            />
            <SetupColumn
              title="Rooms"
              body={`${rooms.length} active room records`}
              detail={rooms.slice(0, 3).map((room: RoomSummary) => room.name).join(', ') || 'No rooms configured'}
            />
            <div className="space-y-3 rounded-2xl border border-[var(--line)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Version Workflow</p>
              <select value={activeVersionId} onChange={(event) => setSelectedVersionId(event.target.value)}>
                <option value="">Select version</option>
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.versionName} · {version.status}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700"
                  onClick={() => createVersionMut.mutate()}
                  disabled={createVersionMut.isPending || !currentYear?.id}
                >
                  New Draft
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700"
                  onClick={() => activeVersionId && validateVersionMut.mutate(activeVersionId)}
                  disabled={!activeVersionId || validateVersionMut.isPending}
                >
                  Validate
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"
                  onClick={() => activeVersionId && publishVersionMut.mutate(activeVersionId)}
                  disabled={!activeVersionId || publishVersionMut.isPending}
                >
                  Publish
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700"
                  onClick={() => activeVersionId && lockVersionMut.mutate(activeVersionId)}
                  disabled={!activeVersionId || lockVersionMut.isPending}
                >
                  Lock
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
                  onClick={() => activeVersionId && archiveVersionMut.mutate(activeVersionId)}
                  disabled={!activeVersionId || archiveVersionMut.isPending}
                >
                  Archive
                </button>
              </div>
            </div>
            <div className="space-y-3 rounded-2xl border border-[var(--line)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-red-600">Conflict Validation</p>
              {validationResult ? (
                <div className="space-y-2 text-xs">
                  <p className={validationResult.valid ? 'font-semibold text-emerald-700' : 'font-semibold text-red-700'}>
                    {validationResult.valid ? 'No blocking conflicts' : `${validationResult.errors.length} conflict(s) found`}
                  </p>
                  {validationResult.errors.slice(0, 3).map((issue) => (
                    <p key={`${issue.type}-${issue.conflictingSlotId ?? issue.message}`} className="rounded-xl bg-red-50 p-2 text-red-700">
                      {issue.message}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Run backend validation before publishing.</p>
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-purple-600">Substitution Management</p>
                <h2 className="text-lg font-bold text-gray-950">Absent Teacher Substitutions</h2>
              </div>
              <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
                {substitutionsQuery.data?.length ?? 0} records
              </span>
            </div>
            {substitutionsQuery.data?.length ? (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {substitutionsQuery.data.slice(0, 6).map((item) => (
                  <div key={item.id} className="rounded-2xl border border-[var(--line)] p-3 text-sm">
                    <p className="font-semibold text-gray-950">{item.status}</p>
                    <p className="text-xs text-gray-500">{new Date(item.date).toLocaleDateString()} · {item.reason}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No substitutions recorded for this class.</p>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-3">
          {/* Slot Entry Form */}
          <section className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm lg:col-span-1">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Schedule</p>
              <h2 className="mt-1 text-lg font-bold text-gray-950">Add Slot</h2>
            </div>

            <div className="space-y-4">
              <select value={slot.academicYearId} onChange={(e) => setSlot((c) => ({ ...c, academicYearId: e.target.value }))}>
                <option value="">Academic Year</option>
                {academicYears.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
              </select>

              <select value={slot.sectionId} onChange={(e) => setSlot((c) => ({ ...c, sectionId: e.target.value }))}>
                <option value="">All Sections (Whole Class)</option>
                {sectionsForClass.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
              </select>

              <select value={slot.subjectId} onChange={(e) => setSlot((c) => ({ ...c, subjectId: e.target.value }))}>
                <option value="">Subject</option>
                {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.code} - {subject.name}</option>)}
              </select>

              <select value={slot.staffId} onChange={(e) => setSlot((c) => ({ ...c, staffId: e.target.value }))}>
                <option value="">Teacher</option>
                {staff.map((member) => <option key={member.id} value={member.id}>{member.firstName} {member.lastName}</option>)}
              </select>

              <select value={slot.dayOfWeek} onChange={(e) => setSlot((c) => ({ ...c, dayOfWeek: Number(e.target.value) }))}>
                {daysOfWeek.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>

              <div className="grid grid-cols-2 gap-3">
                <input type="time" value={slot.startsAt} onChange={(e) => setSlot((c) => ({ ...c, startsAt: e.target.value }))} />
                <input type="time" value={slot.endsAt} onChange={(e) => setSlot((c) => ({ ...c, endsAt: e.target.value }))} />
              </div>

              <input type="text" placeholder="Room (optional)" value={slot.room} onChange={(e) => setSlot((c) => ({ ...c, room: e.target.value }))} />
              <select value="" onChange={(e) => setSlot((c) => ({ ...c, room: rooms.find((room) => room.id === e.target.value)?.name ?? c.room }))}>
                <option value="">Use room record</option>
                {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
              </select>

              {slotMut.isError && (
                <div className="rounded-xl bg-red-50 p-3 border border-red-100">
                  <p className="text-sm text-red-700 font-medium">Conflict Detected</p>
                  <p className="text-xs text-red-600 mt-1">{slotMut.error.message}</p>
                </div>
              )}

              <button
                type="button"
                className="w-full rounded-2xl bg-indigo-950 px-6 py-3 font-semibold text-white transition hover:bg-indigo-900 disabled:opacity-50"
                disabled={!slot.academicYearId || !slot.subjectId || !slot.staffId || slot.startsAt >= slot.endsAt || slotMut.isPending}
                onClick={() => slotMut.mutate({ ...slot, classId, sectionId: slot.sectionId || null })}
              >
                {slotMut.isPending ? 'Saving...' : 'Create Timetable Slot'}
              </button>
            </div>
          </section>

          {/* Weekly Grid Visualization */}
          <section className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm lg:col-span-2">
            <h2 className="text-lg font-bold text-gray-950 mb-4">Weekly Schedule</h2>
            
            {isLoadingTimetable ? (
              <div className="py-12 flex justify-center">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
              </div>
            ) : timetable.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm border-2 border-dashed border-[var(--line)] rounded-2xl">
                No timetable slots created for this class yet.
              </div>
            ) : (
              <div className="grid gap-4">
                {daysOfWeek.map((day) => {
                  const daySlots = gridByDay[day.value];
                  if (!daySlots || daySlots.length === 0) return null;
                  
                  return (
                    <div key={day.value} className="flex gap-4 border-b border-[var(--line)] pb-4 last:border-0 last:pb-0">
                      <div className="w-24 shrink-0 pt-2 font-semibold text-gray-700">{day.label}</div>
                      <div className="flex flex-1 flex-wrap gap-2">
                        {daySlots.map((s) => (
                          <div key={s.id} className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-2 text-xs w-40 flex-shrink-0">
                            <p className="font-semibold text-indigo-900">{s.subject?.code ?? 'Subject'}</p>
                            <p className="text-indigo-700 mt-0.5">{s.startsAt} - {s.endsAt}</p>
                            <p className="text-gray-500 mt-1 truncate">{s.staff?.firstName} {s.staff?.lastName}</p>
                            {(s.section?.name || s.room) && (
                              <div className="flex gap-1 mt-1 text-[10px] text-gray-400 font-medium">
                                {s.section?.name && <span>Sec {s.section.name}</span>}
                                {s.room && <span>• {s.room}</span>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          </div>
        </div>
      )}
    </div>
  );
}

function SetupColumn({ title, body, detail }: { title: string; body: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{title}</p>
      <p className="mt-2 text-lg font-bold text-gray-950">{body}</p>
      <p className="mt-1 text-xs leading-5 text-gray-500">{detail}</p>
    </div>
  );
}
