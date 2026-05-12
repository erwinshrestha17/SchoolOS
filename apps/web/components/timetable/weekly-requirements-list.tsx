'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DataTable } from '@/components/ui/data-table';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/ui/section-card';
import { ClipboardList, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function WeeklyRequirementsList({ filters }: { filters: any }) {
  const requirementsQuery = useQuery({
    queryKey: ['timetable-requirements', filters.academicYearId, filters.classId],
    queryFn: () => api.listSubjectWeeklyRequirements({ 
      academicYearId: filters.academicYearId || undefined,
      classId: filters.classId || undefined 
    }),
    enabled: Boolean(filters.academicYearId),
  });

  const timetableQuery = useQuery({
    queryKey: ['timetable', filters.classId],
    queryFn: () => api.listTimetable({ classId: filters.classId || undefined }),
    enabled: Boolean(filters.classId),
  });

  if (!filters.academicYearId) {
    return <EmptyState title="Select academic year" description="Please select an academic year to view requirements." />;
  }

  if (requirementsQuery.isLoading) return <LoadingState />;

  const getAssignedCount = (subjectId: string, sectionId: string | null) => {
    return timetableQuery.data?.filter(slot => 
      slot.subjectId === subjectId && 
      (!sectionId || slot.sectionId === sectionId)
    ).length ?? 0;
  };

  const columns = [
    {
      header: 'Subject',
      accessorKey: 'subject.name',
      cell: (row: any) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-900">{row.subject?.name}</span>
          <span className="text-xs text-slate-500">{row.subject?.code}</span>
        </div>
      ),
    },
    {
      header: 'Class / Section',
      accessorKey: 'class.name',
      cell: (row: any) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-slate-700">{row.class?.name}</span>
          <span className="text-xs text-slate-500">{row.section?.name || 'Whole Class'}</span>
        </div>
      ),
    },
    {
      header: 'Required Periods',
      accessorKey: 'requiredPeriodsPerWeek',
      cell: (row: any) => (
        <Badge variant="outline" className="font-bold">{row.requiredPeriodsPerWeek} / week</Badge>
      ),
    },
    {
      header: 'Assigned',
      id: 'assigned',
      cell: (row: any) => {
        const assigned = getAssignedCount(row.subjectId, row.sectionId);
        const required = row.requiredPeriodsPerWeek;
        const diff = assigned - required;
        
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">{assigned}</span>
            {diff < 0 ? (
              <Badge variant="destructive" className="text-[10px]">-{Math.abs(diff)} missing</Badge>
            ) : diff > 0 ? (
              <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700">+{diff} excess</Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700">Completed</Badge>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex flex-col">
          <h2 className="text-lg font-black uppercase italic tracking-tight text-slate-900">Subject Weekly Requirements</h2>
          <p className="text-sm text-slate-500 font-medium">Ensure every subject has the required number of periods scheduled.</p>
        </div>
        <Button className="rounded-2xl font-bold">
          <Plus className="mr-2 h-4 w-4" />
          Add Requirement
        </Button>
      </div>

      {requirementsQuery.data?.length === 0 ? (
        <EmptyState 
          title="No requirements set" 
          description="Define how many periods each subject needs per week."
          action={<Button variant="outline" className="rounded-xl">Add First Requirement</Button>}
        />
      ) : (
        <DataTable columns={columns} data={requirementsQuery.data || []} />
      )}
    </div>
  );
}
