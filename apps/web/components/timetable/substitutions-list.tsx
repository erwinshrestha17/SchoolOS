'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DataTable } from '@/components/ui/data-table';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { ActionMenu } from '@/components/ui/action-menu';
import { Plus, Users, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SubstitutionsList({ filters }: { filters: any }) {
  const substitutionsQuery = useQuery({
    queryKey: ['timetable-substitutions', filters],
    queryFn: () => api.listSubstitutions(filters),
  });

  if (substitutionsQuery.isLoading) return <LoadingState />;

  const columns = [
    {
      header: 'Date',
      accessorKey: 'date',
      cell: (row: any) => new Date(row.date).toLocaleDateString(),
    },
    {
      header: 'Class / Slot',
      accessorKey: 'timetableSlot.subject.name',
      cell: (row: any) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-900">{row.timetableSlot?.subject?.name || 'Manual Entry'}</span>
          <span className="text-xs text-slate-500">
            {row.timetableSlot?.startsAt} - {row.timetableSlot?.endsAt}
          </span>
        </div>
      ),
    },
    {
      header: 'Absent Teacher',
      accessorKey: 'absentTeacher.firstName',
      cell: (row: any) => (
        <span className="text-sm font-medium text-slate-700">
          {row.absentTeacher ? `${row.absentTeacher.firstName} ${row.absentTeacher.lastName}` : '—'}
        </span>
      ),
    },
    {
      header: 'Substitute Teacher',
      accessorKey: 'substituteTeacher.firstName',
      cell: (row: any) => (
        <span className="text-sm font-bold text-primary-600">
          {row.substituteTeacher ? `${row.substituteTeacher.firstName} ${row.substituteTeacher.lastName}` : 'Unassigned'}
        </span>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (row: any) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Actions',
      cell: (row: any) => (
        <ActionMenu
          items={[
            {
              label: 'Assign Substitute',
              icon: <Users className="h-4 w-4" />,
              onClick: () => {},
              disabled: row.status !== 'PENDING',
            },
            {
              label: 'Complete',
              icon: <CheckCircle2 className="h-4 w-4" />,
              onClick: () => {},
              disabled: row.status !== 'ASSIGNED',
            },
            {
              label: 'Cancel',
              icon: <XCircle className="h-4 w-4" />,
              onClick: () => {},
              disabled: row.status === 'CANCELLED' || row.status === 'COMPLETED',
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex flex-col">
          <h2 className="text-lg font-black uppercase italic tracking-tight text-slate-900">Teacher Substitutions</h2>
          <p className="text-sm text-slate-500 font-medium">Manage faculty absences and assign replacement teachers.</p>
        </div>
        <Button className="rounded-2xl font-bold">
          <Plus className="mr-2 h-4 w-4" />
          Record Absence
        </Button>
      </div>

      {substitutionsQuery.data?.length === 0 ? (
        <EmptyState 
          title="No substitutions found" 
          description="Everything looks normal. No teacher absences recorded."
          icon={<Users className="h-8 w-8" />}
        />
      ) : (
        <DataTable columns={columns} data={substitutionsQuery.data || []} />
      )}
    </div>
  );
}
