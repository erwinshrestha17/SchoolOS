'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSession } from '../session-provider';
import { Card } from '@/components/ui/card';
import { LoadingState } from '@/components/ui/loading-state';
import { BookOpen, Clock, CheckCircle2, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export function TeacherDashboard() {
  const { session } = useSession();
  const staffId = (session?.user as { staffId?: string } | undefined)?.staffId;

  const timetableQuery = useQuery({
    queryKey: ['teacher-timetable-today', staffId],
    queryFn: () => {
      const dayOfWeek = new Date().getDay();
      return api.getTeacherTimetable(staffId!, { dayOfWeek });
    },
    enabled: !!staffId,
  });

  const homeworkQuery = useQuery({
    queryKey: ['teacher-homework-pending', staffId],
    queryFn: () => api.listHomework({ teacherId: staffId, status: 'PUBLISHED' }),
    enabled: !!staffId,
  });

  if (timetableQuery.isLoading || homeworkQuery.isLoading) {
    return <LoadingState label="Preparing your teaching dashboard..." />;
  }

  const todayClasses = timetableQuery.data ?? [];
  const activeHomework = homeworkQuery.data ?? [];
  const weekday = new Intl.DateTimeFormat('en', { weekday: 'long' }).format(
    new Date(),
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Today's Schedule */}
        <Card className="flex flex-col overflow-hidden rounded-2xl border-slate-200 shadow-sm">
          <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-500 p-2 rounded-xl">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-lg font-black uppercase italic tracking-tight text-slate-900">Today&apos;s Classes</h3>
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-200">
              {weekday}
            </span>
          </div>
          
          <div className="p-4 flex-1">
            {todayClasses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="bg-slate-50 p-4 rounded-full mb-4">
                  <CheckCircle2 className="h-8 w-8 text-slate-300" />
                </div>
                <p className="font-bold text-slate-900">No classes today</p>
                <p className="text-sm text-slate-500 max-w-[200px]">Enjoy your break or catch up on grading!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayClasses.map((slot: any) => (
                  <div key={slot.id} className="group flex items-center gap-4 p-4 rounded-2xl border border-slate-100 bg-white transition hover:border-indigo-200 hover:bg-indigo-50/30">
                    <div className="flex flex-col items-center justify-center bg-slate-50 rounded-xl px-3 py-2 border border-slate-100 group-hover:bg-white group-hover:border-indigo-100">
                      <span className="text-[10px] font-black text-slate-400 uppercase leading-none">{slot.startsAt}</span>
                      <div className="h-px w-4 bg-slate-200 my-1" />
                      <span className="text-[10px] font-black text-slate-400 uppercase leading-none">{slot.endsAt}</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-black text-slate-900 uppercase italic leading-none">{slot.subject?.name}</p>
                      <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-tight">
                        {slot.class?.name} {slot.section?.name ? `(${slot.section.name})` : ''} • {slot.room?.name || 'No Room'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="p-4 bg-slate-50 border-t border-slate-100">
            <Link href="/dashboard/timetable" className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 transition">
              Full Timetable <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </Card>

        {/* Homework Review */}
        <Card className="flex flex-col overflow-hidden rounded-2xl border-slate-200 shadow-sm">
          <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-amber-500 p-2 rounded-xl">
                <BookOpen className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-lg font-black uppercase italic tracking-tight text-slate-900">Homework Review</h3>
            </div>
            <div className="bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
               <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">
                {activeHomework.length} Active
              </span>
            </div>
          </div>

          <div className="p-4 flex-1">
            {activeHomework.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="bg-slate-50 p-4 rounded-full mb-4">
                  <CheckCircle2 className="h-8 w-8 text-slate-300" />
                </div>
                <p className="font-bold text-slate-900">All caught up!</p>
                <p className="text-sm text-slate-500 max-w-[200px]">No active assignments requiring attention.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeHomework.slice(0, 5).map((hw: any) => (
                  <Link 
                    key={hw.id} 
                    href={`/dashboard/homework/${hw.id}`}
                    className="group flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-white transition hover:border-amber-200 hover:bg-amber-50/30"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-900 uppercase italic leading-none truncate">{hw.title}</p>
                      <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-tight">
                        {hw.class?.name} • Due {formatShortDate(hw.dueDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-black text-amber-600 leading-none">{hw._count?.submissions || 0}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Submissions</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-amber-400 transition" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100">
            <Link href="/dashboard/homework" className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest text-amber-600 hover:text-amber-700 transition">
              Manage Assignments <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

function formatShortDate(value: string | Date) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}
