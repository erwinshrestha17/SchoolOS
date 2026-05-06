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
  GraduationCap
} from 'lucide-react';
import { cn } from '../../../lib/utils';

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

  return (
    <div className="space-y-8">
      <SectionCard 
        title="My Weekly Schedule" 
        description="View your classes, subjects, and teachers for the current academic session."
        headerAction={
          <Badge variant="outline" className="font-black uppercase tracking-widest text-[10px] py-1 border-indigo-200 text-indigo-600">
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
                    {daySlots.map((s: any) => (
                      <div key={s.id} className="group relative rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                        <div className="flex justify-between items-start mb-4">
                          <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-widest py-0.5">
                            {s.subject?.code ?? 'SUB'}
                          </Badge>
                          {s.room && (
                            <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
                              <MapPin size={10} />
                              {s.room}
                            </div>
                          )}
                        </div>
                        
                        <h4 className="font-black text-slate-900 uppercase tracking-tight italic text-base leading-tight mb-4 truncate group-hover:text-indigo-600 transition-colors">
                          {s.subject?.name}
                        </h4>
                        
                        <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                          <div className="space-y-1">
                             <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 uppercase tracking-widest">
                               <Clock size={12} className="shrink-0" />
                               {s.startsAt} - {s.endsAt}
                             </div>
                             <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                               <User size={12} className="shrink-0" />
                               {s.staff?.firstName} {s.staff?.lastName}
                             </div>
                          </div>
                          <div className="h-10 w-10 rounded-2xl bg-slate-50 flex items-center justify-center font-black text-slate-300 text-xs shadow-inner transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-300">
                             {(s.subject?.name ?? '?')[0]}
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
      </SectionCard>
      
      <div className="grid gap-6 md:grid-cols-2">
         <div className="rounded-[2.5rem] bg-slate-900 p-8 text-white flex items-center gap-6 shadow-xl shadow-slate-200">
            <div className="h-14 w-14 rounded-3xl bg-white/10 flex items-center justify-center ring-1 ring-white/20 shrink-0">
               <GraduationCap className="h-7 w-7 text-indigo-400" />
            </div>
            <div>
               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Academic Status</p>
               <h3 className="text-xl font-black uppercase italic tracking-tight">Active Enrollment</h3>
               <p className="text-xs text-slate-500 font-medium mt-1">2081 BS Academic Session</p>
            </div>
         </div>
         <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 flex items-center gap-6 shadow-sm">
            <div className="h-14 w-14 rounded-3xl bg-indigo-50 flex items-center justify-center shrink-0">
               <BookOpen className="h-7 w-7 text-indigo-600" />
            </div>
            <div>
               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Weekly Load</p>
               <h3 className="text-xl font-black uppercase italic tracking-tight">{timetable.length} Active Classes</h3>
               <p className="text-xs text-slate-500 font-medium mt-1">Full attendance is mandatory</p>
            </div>
         </div>
      </div>
    </div>
  );
}
