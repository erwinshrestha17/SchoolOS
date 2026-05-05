'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';

const daysOfWeek = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
];

export function StudentTimetableTab() {
  const timetableQuery = useQuery({
    queryKey: ['timetable', 'my'],
    queryFn: () => api.listTimetable({}),
  });

  const timetable = timetableQuery.data ?? [];

  // Group timetable by day
  const gridByDay = daysOfWeek.reduce((acc, day) => {
    acc[day.value] = timetable
      .filter((t: any) => t.dayOfWeek === day.value)
      .sort((a: any, b: any) => a.startsAt.localeCompare(b.startsAt));
    return acc;
  }, {} as Record<number, any[]>);

  if (timetableQuery.isLoading) {
    return (
      <div className="py-12 flex justify-center">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-950">My Weekly Schedule</h2>
          <p className="text-sm text-gray-500 mt-1">View your classes and subjects for the current academic year.</p>
        </div>

        {timetable.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm border-2 border-dashed border-[var(--line)] rounded-2xl">
            Your class timetable has not been published yet.
          </div>
        ) : (
          <div className="grid gap-6">
            {daysOfWeek.map((day) => {
              const daySlots = gridByDay[day.value];
              if (!daySlots || daySlots.length === 0) return null;

              return (
                <div key={day.value} className="space-y-3">
                  <h3 className="text-sm font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                    {day.label}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {daySlots.map((s: any) => (
                      <div key={s.id} className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                          <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-tight">
                            {s.subject?.code ?? 'SUB'}
                          </span>
                          <span className="text-[10px] font-medium text-gray-400">
                            {s.room ? `Room ${s.room}` : ''}
                          </span>
                        </div>
                        <p className="font-bold text-gray-900 truncate">{s.subject?.name}</p>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-indigo-600">{s.startsAt} - {s.endsAt}</span>
                            <span className="text-[10px] text-gray-400">{s.staff?.firstName} {s.staff?.lastName}</span>
                          </div>
                          <div className="h-8 w-8 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center">
                            <span className="text-xs font-bold text-gray-400">
                              {(s.subject?.name ?? '?')[0]}
                            </span>
                          </div>
                        </div>
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
  );
}
