'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../../lib/api';
import type { TeacherWorkloadSummary } from '@schoolos/core';
import { SectionCard } from '../../ui/section-card';
import { StatCard } from '../../ui/stat-card';
import { Badge } from '../../ui/badge';
import { EmptyState } from '../../ui/empty-state';
import { LoadingState } from '../../ui/loading-state';
import { cn } from '../../../lib/utils';
import { 
  Users, 
  Clock, 
  Calendar,
  AlertCircle,
  BarChart3,
  Search
} from 'lucide-react';

type Props = {
  workload: TeacherWorkloadSummary[];
  isLoading: boolean;
};

export function TeacherWorkloadTab({ workload, isLoading }: Props) {
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  
  const availabilityQuery = useQuery({
    queryKey: ['teacher-availability', selectedTeacherId],
    queryFn: () => api.listTeacherAvailability(selectedTeacherId),
    enabled: Boolean(selectedTeacherId),
  });

  const totalHours = workload.reduce((acc, curr) => acc + (curr.teachingMinutes / 60), 0);
  const avgSlots = workload.length > 0 
    ? workload.reduce((acc, curr) => acc + curr.slotCount, 0) / workload.length / 5 
    : 0;

  return (
    <div className="space-y-8">
      {/* Metrics Row */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Weekly Hours"
          value={totalHours.toFixed(1)}
          icon={<Clock className="h-5 w-5" />}
        />
        <StatCard
          title="Avg. Daily Slots"
          value={avgSlots.toFixed(1)}
          icon={<Calendar className="h-5 w-5" />}
        />
        <StatCard
          title="Active Teachers"
          value={workload.length}
          icon={<Users className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Workload Table */}
        <SectionCard 
          title="Faculty Workload Analysis" 
          description="Monitoring teaching capacity and assignment density across staff."
          className="lg:col-span-2"
        >
          {isLoading ? (
            <LoadingState />
          ) : workload.length === 0 ? (
            <EmptyState 
              title="No workload data" 
              description="Assign slots in the Timetable Builder to see analytics here." 
              className="bg-slate-50/50"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Teacher</th>
                    <th className="pb-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Slots</th>
                    <th className="pb-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Time (Hrs)</th>
                    <th className="pb-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Homeworks</th>
                    <th className="pb-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Capacity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {workload.map((item) => {
                    const hours = (item.teachingMinutes / 60);
                    const isOverloaded = hours > 30;
                    const isSelected = selectedTeacherId === item.staffId;

                    return (
                      <tr 
                        key={item.staffId} 
                        onClick={() => setSelectedTeacherId(item.staffId)}
                        className={cn(
                          "group cursor-pointer transition-all duration-200",
                          isSelected ? "bg-slate-900 text-white" : "hover:bg-slate-50/50"
                        )}
                      >
                        <td className="py-5">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "h-10 w-10 rounded-full flex items-center justify-center font-black text-[11px] shadow-sm transition-colors",
                              isSelected ? "bg-white/10 text-white ring-1 ring-white/20" : "bg-slate-100 text-slate-500"
                            )}>
                              {item.staffName[0]}
                            </div>
                            <div>
                              <p className={cn("font-black uppercase tracking-tight text-sm", isSelected ? "text-white" : "text-slate-900")}>
                                {item.staffName}
                              </p>
                              <p className={cn("text-[9px] font-bold uppercase tracking-widest", isSelected ? "text-slate-400" : "text-slate-400")}>
                                {item.employeeId || 'Staff Member'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-5">
                          <span className={cn("text-sm font-bold", isSelected ? "text-slate-200" : "text-slate-700")}>
                            {item.slotCount}
                          </span>
                        </td>
                        <td className="py-5">
                          <div className="flex items-center gap-2">
                            <span className={cn("text-sm font-bold", isSelected ? "text-slate-200" : "text-slate-700")}>
                              {hours.toFixed(1)}h
                            </span>
                            {isOverloaded && (
                              <Badge variant={isSelected ? "secondary" : "warning"} className="text-[8px] py-0 px-1 font-black uppercase">
                                High
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-5">
                          <span className={cn("text-sm font-bold", isSelected ? "text-slate-200" : "text-slate-700")}>
                            {item.homeworkCount}
                          </span>
                        </td>
                        <td className="py-5 text-right">
                          <div className={cn("inline-flex h-2 w-20 overflow-hidden rounded-full", isSelected ? "bg-white/10" : "bg-slate-100")}>
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-1000",
                                isOverloaded ? "bg-amber-500" : "bg-emerald-500"
                              )}
                              style={{ width: `${Math.min(100, (hours / 40) * 100)}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {/* Details Sidebar */}
        <div className="space-y-8 lg:col-span-1">
          <SectionCard 
            title="Availability Insights" 
            description="Detailed constraints and limits for the selected teacher."
          >
            {!selectedTeacherId ? (
              <EmptyState 
                title="Select a teacher" 
                description="Click on a row to view specific availability records and workload limits." 
                className="bg-slate-50/50"
                icon={<Search className="h-8 w-8 text-slate-300" />}
              />
            ) : availabilityQuery.isLoading ? (
              <LoadingState />
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Daily Period Limit</p>
                    <p className="text-2xl font-black text-slate-900 italic">
                      {availabilityQuery.data?.limit?.maxPeriodsPerDay ?? 'No Limit'}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Weekly Period Limit</p>
                    <p className="text-2xl font-black text-slate-900 italic">
                      {availabilityQuery.data?.limit?.maxPeriodsPerWeek ?? 'No Limit'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                     <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-900">Custom Blocks</h4>
                     <Badge variant="outline" className="text-[9px] font-black uppercase py-0 px-1.5 border-slate-200">
                       {availabilityQuery.data?.availability.length ?? 0} Active
                     </Badge>
                  </div>
                  
                  {availabilityQuery.data?.availability.length ? (
                    <div className="space-y-2">
                      {availabilityQuery.data.availability.map((av: any) => (
                        <div key={av.id} className="p-3 rounded-xl border border-slate-100 bg-white shadow-sm flex items-center justify-between">
                          <div>
                            <p className="text-[11px] font-black text-slate-700 uppercase tracking-tight">Period {av.periodId || 'All Day'}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Day {av.dayOfWeek}</p>
                          </div>
                          <Badge variant={av.isAvailable ? 'success' : 'destructive'} className="text-[8px] px-1 py-0 font-black uppercase">
                            {av.isAvailable ? 'AVAIL' : 'BLOCK'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center py-4">No custom constraints found</p>
                  )}
                </div>

                <div className="rounded-2xl bg-indigo-50/50 p-4 border border-indigo-100 flex items-start gap-3">
                   <AlertCircle className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                   <p className="text-[11px] font-medium text-indigo-700 leading-relaxed">
                     Limits are enforced by the Timetable Builder during slot assignment to prevent scheduling conflicts.
                   </p>
                </div>
              </div>
            )}
          </SectionCard>
          
          <SectionCard title="Performance Chart" className="bg-slate-900 text-white border-slate-800">
             <div className="h-40 flex flex-col items-center justify-center text-center space-y-3">
                <BarChart3 className="h-10 w-10 text-slate-700" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Live Workload Heatmap</p>
                <p className="text-[11px] text-slate-400 font-medium">Coming soon in Phase 2B.4</p>
             </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
