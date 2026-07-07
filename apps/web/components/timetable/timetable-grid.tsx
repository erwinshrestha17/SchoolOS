'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Clock, MapPin, User } from 'lucide-react';
import { useState } from 'react';
import { TimetableSubstitutionModal } from '@/components/timetable/substitution-modal';

const daysOfWeek = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
];

export function TimetableGrid({ filters, activeVersionId }: { filters: any, activeVersionId?: string }) {
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const timetableQuery = useQuery({
    queryKey: ['timetable', filters.classId, filters.academicYearId, activeVersionId],
    queryFn: () => api.listTimetable({ 
      classId: filters.classId || undefined,
      // academicYearId: filters.academicYearId || undefined,
      // versionId: activeVersionId
    }),
    enabled: Boolean(filters.classId),
  });

  const periodsQuery = useQuery({
    queryKey: ['timetable-periods', filters.academicYearId],
    queryFn: () => api.listTimetablePeriods({ academicYearId: filters.academicYearId || undefined }),
  });

  if (!filters.classId) {
    return (
      <EmptyState
        title="Select a class"
        description="Select a class from the filters above to view the weekly schedule."
      />
    );
  }

  if (timetableQuery.isLoading || periodsQuery.isLoading) {
    return <LoadingState label="Loading timetable grid..." />;
  }

  const periods = periodsQuery.data || [];
  const timetable = timetableQuery.data?.items ?? [];

  if (periods.length === 0) {
    return (
      <EmptyState
        title="No periods defined"
        description="Please define timetable periods in Settings before building a schedule."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-50">
            <th className="w-32 border-b border-r border-slate-200 p-6 text-left">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Period</span>
            </th>
            {daysOfWeek.map(day => (
              <th key={day.value} className="border-b border-slate-200 p-6 text-center min-w-[200px]">
                <span className="text-sm font-black uppercase tracking-widest text-slate-900">{day.label}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((period) => (
            <tr key={period.id} className="group">
              <td className="border-b border-r border-slate-200 p-6 bg-slate-50/30">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-black text-slate-900 uppercase italic">{period.name}</span>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                    <Clock className="h-3 w-3" />
                    {period.startsAt} - {period.endsAt}
                  </div>
                </div>
              </td>
              {daysOfWeek.map(day => {
                const slot = timetable.find(s => 
                  s.dayOfWeek === day.value && 
                  (s.periodId === period.id || (s.startsAt === period.startsAt && s.endsAt === period.endsAt))
                );
                const subjectName = slot?.subject?.name?.trim() || 'Subject not set';
                const staffName = [slot?.staff?.firstName, slot?.staff?.lastName]
                  .map((part) => part?.trim())
                  .filter(Boolean)
                  .join(' ') || 'Teacher not assigned';
                const roomName = slot?.room?.trim() || 'Room not set';

                return (
                  <td key={`${day.value}-${period.id}`} className="border-b border-slate-200 p-3">
                    {slot ? (
                      <button
                        type="button"
                        aria-label={`${subjectName} with ${staffName} in ${roomName}. Open to assign a substitute.`}
                        className="h-full min-h-[100px] w-full cursor-pointer rounded-2xl border border-[var(--color-mod-homework-border)] bg-[var(--color-mod-homework-soft)]/40 p-4 text-left transition-all hover:bg-[var(--color-mod-homework-soft)] hover:shadow-sm"
                        onClick={() => {
                          setSelectedSlot(slot);
                          setIsModalOpen(true);
                        }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="text-xs font-black uppercase tracking-tight text-[var(--color-mod-homework-text)]">
                            {subjectName}
                          </span>
                        </div>
                        
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                            <User className="h-3 w-3 opacity-50" />
                            {staffName}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                            <MapPin className="h-3 w-3 opacity-50" />
                            {roomName}
                          </div>
                        </div>

                        {slot.section && (
                          <div className="mt-2 border-t border-[var(--color-mod-homework-border)]/60 pt-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-mod-homework-text)]">
                              Section {slot.section.name}
                            </span>
                          </div>
                        )}
                      </button>
                    ) : (
                      <div className="h-full min-h-[100px] rounded-2xl border-2 border-dashed border-slate-100 flex items-center justify-center opacity-20 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Empty</span>
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <TimetableSubstitutionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedSlot(null);
        }}
        slot={selectedSlot}
        mode="create"
      />
    </div>
  );
}
