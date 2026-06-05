'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { SectionCard } from '../../ui/section-card';
import { Badge } from '../../ui/badge';
import { EmptyState } from '../../ui/empty-state';
import { LoadingState } from '../../ui/loading-state';
import { 
  Calendar, 
  Clock, 
  User, 
  MapPin, 
  BookOpen,
} from 'lucide-react';

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
  const daysWithSlots = new Set(timetable.map((slot: any) => slot.dayOfWeek)).size;

  // Group timetable by day
  const gridByDay = daysOfWeek.reduce((acc, day) => {
    acc[day.value] = timetable
      .filter((t: any) => t.dayOfWeek === day.value)
      .sort((a: any, b: any) => a.startsAt.localeCompare(b.startsAt));
    return acc;
  }, {} as Record<number, any[]>);

  return (
    <div className="space-y-8">
      <SectionCard 
        title="My Weekly Schedule" 
        description="View your classes, subjects, and teachers for the current academic session."
        headerAction={
          <Badge variant="outline" className="border-[var(--color-mod-homework-border)] py-1 text-[10px] font-black uppercase tracking-widest text-[var(--color-mod-homework-text)]">
             {timetable.length} Weekly Slots
          </Badge>
        }
      >
        {timetableQuery.isLoading ? (
          <LoadingState />
        ) : timetable.length === 0 ? (
          <EmptyState 
            title="No schedule found" 
            description="Your class timetable has not been published by the administration yet." 
            className="bg-slate-50/50"
            icon={<Calendar className="h-8 w-8 text-slate-300" />}
          />
        ) : (
          <div className="grid gap-8">
            {daysOfWeek.map((day) => {
              const daySlots = gridByDay[day.value];
              if (!daySlots || daySlots.length === 0) return null;

              return (
                <div key={day.value} className="space-y-4">
                  <div className="flex items-center gap-4">
                     <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                       {day.label}
                     </h3>
                     <div className="h-px flex-1 bg-slate-100" />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {daySlots.map((s: any) => {
                      const subjectName = s.subject?.name?.trim() || 'Subject not set';
                      const subjectCode = s.subject?.code?.trim();
                      const staffName = [s.staff?.firstName, s.staff?.lastName]
                        .map((part) => part?.trim())
                        .filter(Boolean)
                        .join(' ') || 'Teacher not assigned';
                      const subjectInitial = subjectName === 'Subject not set' ? '-' : subjectName.charAt(0);

                      return (
                        <div
                          key={s.id}
                          className="group relative rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-colors hover:border-[var(--color-mod-homework-border)] hover:bg-[var(--color-mod-homework-bg)]"
                        >
                          <div className="flex justify-between items-start mb-4">
                            <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-widest py-0.5">
                              {subjectCode || 'Code not set'}
                            </Badge>
                            {s.room && (
                              <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
                                <MapPin size={10} />
                                {s.room}
                              </div>
                            )}
                          </div>

                          <h4 className="font-black text-slate-900 uppercase tracking-tight italic text-base leading-tight mb-4 truncate transition-colors group-hover:text-[var(--color-mod-homework-text)]">
                            {subjectName}
                          </h4>

                          <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                            <div className="space-y-1">
                               <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--color-mod-homework-text)] uppercase tracking-widest">
                                 <Clock size={12} className="shrink-0" />
                                 {s.startsAt} - {s.endsAt}
                               </div>
                               <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                 <User size={12} className="shrink-0" />
                                 {staffName}
                               </div>
                            </div>
                            <div className="h-10 w-10 rounded-2xl bg-slate-50 flex items-center justify-center font-black text-slate-300 text-xs shadow-inner transition-colors group-hover:bg-white group-hover:text-[var(--color-mod-homework-text)]">
                               {subjectInitial}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
      
      <div className="grid gap-6 md:grid-cols-2">
         <div className="flex items-center gap-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
               <Calendar className="h-7 w-7" />
            </div>
            <div>
               <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Published Days</p>
               <h3 className="text-xl font-black tracking-tight text-slate-950">{daysWithSlots} Days</h3>
               <p className="mt-1 text-xs font-medium text-slate-500">Days with at least one scheduled class.</p>
            </div>
         </div>
         <div className="flex items-center gap-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-mod-homework-bg)] text-[var(--color-mod-homework-text)]">
               <BookOpen className="h-7 w-7" />
            </div>
            <div>
               <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Weekly Load</p>
               <h3 className="text-xl font-black tracking-tight text-slate-950">{timetable.length} Scheduled Classes</h3>
               <p className="mt-1 text-xs font-medium text-slate-500">Slots currently published for the student.</p>
            </div>
         </div>
      </div>
    </div>
  );
}
