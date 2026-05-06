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
import { cn } from '../../../lib/utils';
import { SectionCard } from '../../ui/section-card';
import { StatCard } from '../../ui/stat-card';
import { Badge } from '../../ui/badge';
import { EmptyState } from '../../ui/empty-state';
import { LoadingState } from '../../ui/loading-state';
import { 
  FormField, 
  Input, 
  Select 
} from '../../ui/form-field';
import { 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  History, 
  Lock, 
  Archive, 
  Zap,
  Clock
} from 'lucide-react';

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
    <div className="space-y-8">
      {/* Class Context Selector */}
      <SectionCard className="bg-white/90 backdrop-blur-md">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <FormField label="Target Class" className="flex-1 max-w-md">
            <Select 
              value={classId} 
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setClassId(e.target.value)}
            >
              <option value="">Choose a class to view/build timetable</option>
              {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </FormField>

          <div className="flex items-center gap-3">
             <Badge variant="outline" className="font-black uppercase tracking-widest text-[10px] py-1.5">
               {currentYear?.name ?? 'No active year'}
             </Badge>
          </div>
        </div>
      </SectionCard>

      {classId && (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Periods"
              value={periodsQuery.data?.length ?? 0}
              icon={<Clock className="h-5 w-5" />}
            />
            <StatCard
              title="Rooms"
              value={rooms.length}
              icon={<CheckCircle2 className="h-5 w-5" />}
            />
            
            <SectionCard title="Version Workflow" className="lg:col-span-2">
              <div className="space-y-4">
                <Select 
                  value={activeVersionId} 
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setSelectedVersionId(event.target.value)}
                >
                  <option value="">Select version</option>
                  {versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      {version.versionName} · {version.status}
                    </option>
                  ))}
                </Select>
                
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="h-9 px-4 rounded-full bg-slate-100 text-slate-900 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors flex items-center gap-2"
                    onClick={() => createVersionMut.mutate()}
                    disabled={createVersionMut.isPending || !currentYear?.id}
                  >
                    <Plus className="h-3 w-3" />
                    New Draft
                  </button>
                  <button
                    type="button"
                    className="h-9 px-4 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors flex items-center gap-2"
                    onClick={() => activeVersionId && validateVersionMut.mutate(activeVersionId)}
                    disabled={!activeVersionId || validateVersionMut.isPending}
                  >
                    <Zap className="h-3 w-3" />
                    Validate
                  </button>
                  <button
                    type="button"
                    className="h-9 px-4 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-colors flex items-center gap-2"
                    onClick={() => activeVersionId && publishVersionMut.mutate(activeVersionId)}
                    disabled={!activeVersionId || publishVersionMut.isPending}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Publish
                  </button>
                  <button
                    type="button"
                    className="h-9 px-4 rounded-full bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors flex items-center gap-2"
                    onClick={() => activeVersionId && lockVersionMut.mutate(activeVersionId)}
                    disabled={!activeVersionId || lockVersionMut.isPending}
                  >
                    <Lock className="h-3 w-3" />
                    Lock
                  </button>
                  <button
                    type="button"
                    className="h-9 px-4 rounded-full bg-red-50 text-red-700 text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-colors flex items-center gap-2"
                    onClick={() => activeVersionId && archiveVersionMut.mutate(activeVersionId)}
                    disabled={!activeVersionId || archiveVersionMut.isPending}
                  >
                    <Archive className="h-3 w-3" />
                    Archive
                  </button>
                </div>
              </div>
            </SectionCard>
          </div>

          {validationResult && (
            <SectionCard 
              title="Conflict Validation" 
              className={cn("border-2", validationResult.valid ? "border-emerald-100" : "border-red-100")}
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {validationResult.valid ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                  <p className={cn("text-sm font-black uppercase tracking-widest", validationResult.valid ? 'text-emerald-700' : 'text-red-700')}>
                    {validationResult.valid ? 'No blocking conflicts' : `${validationResult.errors.length} conflict(s) found`}
                  </p>
                </div>
                {!validationResult.valid && (
                  <div className="grid gap-2">
                    {validationResult.errors.slice(0, 3).map((issue) => (
                      <div key={`${issue.type}-${issue.conflictingSlotId ?? issue.message}`} className="rounded-xl bg-red-50/50 p-3 border border-red-100 text-xs text-red-700 font-medium">
                        {issue.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          <SectionCard 
            title="Absent Teacher Substitution Management" 
            description="Manage substitutions for missing teachers."
            headerAction={
              <Badge variant="secondary" className="font-black uppercase tracking-widest text-[10px]">
                {substitutionsQuery.data?.length ?? 0} Records
              </Badge>
            }
          >
            {substitutionsQuery.data?.length ? (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {substitutionsQuery.data.slice(0, 6).map((item) => (
                  <div key={item.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-1">
                    <p className="text-xs font-black uppercase tracking-tight text-slate-900">{item.status}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {new Date(item.date).toLocaleDateString()} · {item.reason}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState 
                title="No substitutions" 
                description="No teacher substitutions recorded for this class." 
                className="bg-slate-50/50"
              />
            )}
          </SectionCard>

          <div className="grid gap-8 lg:grid-cols-3">
            <SectionCard title="Add Schedule Slot" className="lg:col-span-1">
              <div className="space-y-6">
                <FormField label="Academic Year">
                  <Select value={slot.academicYearId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSlot((c) => ({ ...c, academicYearId: e.target.value }))}>
                    <option value="">Select Year</option>
                    {academicYears.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
                  </Select>
                </FormField>

                <FormField label="Section (Optional)">
                  <Select value={slot.sectionId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSlot((c) => ({ ...c, sectionId: e.target.value }))}>
                    <option value="">Whole Class</option>
                    {sectionsForClass.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
                  </Select>
                </FormField>

                <FormField label="Subject">
                  <Select value={slot.subjectId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSlot((c) => ({ ...c, subjectId: e.target.value }))}>
                    <option value="">Select Subject</option>
                    {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.code} - {subject.name}</option>)}
                  </Select>
                </FormField>

                <FormField label="Teacher">
                  <Select value={slot.staffId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSlot((c) => ({ ...c, staffId: e.target.value }))}>
                    <option value="">Select Staff</option>
                    {staff.map((member) => <option key={member.id} value={member.id}>{member.firstName} {member.lastName}</option>)}
                  </Select>
                </FormField>

                <FormField label="Day of Week">
                  <Select value={slot.dayOfWeek} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSlot((c) => ({ ...c, dayOfWeek: Number(e.target.value) }))}>
                    {daysOfWeek.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </Select>
                </FormField>

                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Starts At">
                    <Input type="time" value={slot.startsAt} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSlot((c) => ({ ...c, startsAt: e.target.value }))} />
                  </FormField>
                  <FormField label="Ends At">
                    <Input type="time" value={slot.endsAt} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSlot((c) => ({ ...c, endsAt: e.target.value }))} />
                  </FormField>
                </div>

                <FormField label="Room">
                  <div className="space-y-3">
                    <Input type="text" placeholder="Custom room name" value={slot.room} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSlot((c) => ({ ...c, room: e.target.value }))} />
                    <Select value="" onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSlot((c) => ({ ...c, room: rooms.find((room: any) => room.id === e.target.value)?.name ?? c.room }))}>
                      <option value="">Or use room record</option>
                      {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                    </Select>
                  </div>
                </FormField>

                {slotMut.isError && (
                  <div className="rounded-2xl bg-red-50 p-4 border border-red-100 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-red-700">Conflict Detected</p>
                      <p className="text-[11px] text-red-600 mt-1 font-medium leading-relaxed">{slotMut.error.message}</p>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className="w-full h-14 rounded-2xl bg-slate-900 text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-slate-200 hover:-translate-y-1 transition-all disabled:opacity-50 disabled:translate-y-0"
                  disabled={!slot.academicYearId || !slot.subjectId || !slot.staffId || slot.startsAt >= slot.endsAt || slotMut.isPending}
                  onClick={() => slotMut.mutate({ ...slot, classId, sectionId: slot.sectionId || null })}
                >
                  {slotMut.isPending ? 'Saving...' : 'Add Slot to Schedule'}
                </button>
              </div>
            </SectionCard>

            <SectionCard title="Weekly Grid Visualization" className="lg:col-span-2">
              {isLoadingTimetable ? (
                <LoadingState />
              ) : timetable.length === 0 ? (
                <EmptyState 
                  title="No schedule created" 
                  description="Start by adding slots using the form on the left." 
                  className="bg-slate-50/50"
                />
              ) : (
                <div className="grid gap-6">
                  {daysOfWeek.map((day) => {
                    const daySlots = gridByDay[day.value];
                    if (!daySlots || daySlots.length === 0) return null;
                    
                    return (
                      <div key={day.value} className="flex gap-6 border-b border-slate-100 pb-6 last:border-0 last:pb-0">
                        <div className="w-28 shrink-0 pt-1">
                           <p className="text-xs font-black uppercase tracking-widest text-slate-400">{day.label}</p>
                        </div>
                        <div className="flex flex-1 flex-wrap gap-3">
                          {daySlots.map((s) => (
                            <div key={s.id} className="rounded-2xl border border-indigo-100 bg-indigo-50/30 p-4 w-48 flex-shrink-0 space-y-2 group/slot hover:bg-indigo-50 transition-colors">
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-black text-indigo-900 uppercase tracking-tight text-xs leading-tight">{s.subject?.code ?? 'SUB'}</p>
                                <Badge variant="outline" className="text-[8px] font-black uppercase py-0 px-1 border-indigo-200 text-indigo-400">
                                  {s.startsAt}
                                </Badge>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">
                                {s.staff?.firstName} {s.staff?.lastName}
                              </p>
                              {(s.section?.name || s.room) && (
                                <div className="flex gap-2 text-[9px] font-black uppercase tracking-widest text-indigo-300">
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
            </SectionCard>
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
