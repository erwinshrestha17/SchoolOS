'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../../lib/api';

type Props = {
  academicYears: any[];
  classes: any[];
  allSections: any[];
  subjects: any[];
  staff: any[];
  timetable: any[];
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
  const currentYear = academicYears.find((y: any) => y.isCurrent) ?? academicYears[0];

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

  // Helper to add 45 minutes to a time string (HH:MM)
  const calculateNextEnd = (time: string) => {
    if (!time) return '';
    const [h, m] = time.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m + 45, 0, 0);
    return date.toTimeString().slice(0, 5);
  };

  const sectionsForClass = allSections.filter((s: any) => s.classId === classId);

  // Group timetable by day
  const gridByDay = daysOfWeek.reduce((acc, day) => {
    acc[day.value] = timetable.filter((t: any) => t.dayOfWeek === day.value).sort((a: any, b: any) => a.startsAt.localeCompare(b.startsAt));
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
                {academicYears.map((y: any) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>

              <select value={slot.sectionId} onChange={(e) => setSlot((c) => ({ ...c, sectionId: e.target.value }))}>
                <option value="">All Sections (Whole Class)</option>
                {sectionsForClass.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>

              <select value={slot.subjectId} onChange={(e) => setSlot((c) => ({ ...c, subjectId: e.target.value }))}>
                <option value="">Subject</option>
                {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
              </select>

              <select value={slot.staffId} onChange={(e) => setSlot((c) => ({ ...c, staffId: e.target.value }))}>
                <option value="">Teacher</option>
                {staff.map((s: any) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
              </select>

              <select value={slot.dayOfWeek} onChange={(e) => setSlot((c) => ({ ...c, dayOfWeek: Number(e.target.value) }))}>
                {daysOfWeek.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>

              <div className="grid grid-cols-2 gap-3">
                <input type="time" value={slot.startsAt} onChange={(e) => setSlot((c) => ({ ...c, startsAt: e.target.value }))} />
                <input type="time" value={slot.endsAt} onChange={(e) => setSlot((c) => ({ ...c, endsAt: e.target.value }))} />
              </div>

              <input type="text" placeholder="Room (optional)" value={slot.room} onChange={(e) => setSlot((c) => ({ ...c, room: e.target.value }))} />

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
                        {daySlots.map((s: any) => (
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
      )}
    </div>
  );
}
