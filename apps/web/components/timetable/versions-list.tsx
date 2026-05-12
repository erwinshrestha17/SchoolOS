'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { ActionMenu } from '@/components/ui/action-menu';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Lock, Archive, History, Zap } from 'lucide-react';

export function TimetableVersionsList({ academicYearId }: { academicYearId?: string }) {
  const queryClient = useQueryClient();
  
  const versionsQuery = useQuery({
    queryKey: ['timetable-versions', academicYearId],
    queryFn: () => api.listTimetableVersions({ academicYearId }),
    enabled: Boolean(academicYearId),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => api.publishTimetableVersion(id),
    onSuccess: () => {
      alert('Version published');
      queryClient.invalidateQueries({ queryKey: ['timetable-versions'] });
    },
  });

  const lockMutation = useMutation({
    mutationFn: (id: string) => api.lockTimetableVersion(id),
    onSuccess: () => {
      alert('Version locked');
      queryClient.invalidateQueries({ queryKey: ['timetable-versions'] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.archiveTimetableVersion(id),
    onSuccess: () => {
      alert('Version archived');
      queryClient.invalidateQueries({ queryKey: ['timetable-versions'] });
    },
  });

  if (!academicYearId) {
    return <EmptyState title="Select academic year" description="Please select an academic year to view timetable versions." />;
  }

  if (versionsQuery.isLoading) return <LoadingState />;

  const columns = [
    {
      header: 'Version Name',
      accessorKey: 'versionName',
      cell: (row: any) => <span className="font-bold text-slate-900">{row.versionName}</span>,
    },
    {
      header: 'Effective From',
      accessorKey: 'effectiveFrom',
      cell: (row: any) => new Date(row.effectiveFrom).toLocaleDateString(),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (row: any) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Slots',
      accessorKey: '_count.slots',
      cell: (row: any) => row.slots?.length || 0,
    },
    {
      header: 'Actions',
      cell: (row: any) => (
        <ActionMenu
          items={[
            {
              label: 'Publish',
              icon: <CheckCircle2 className="h-4 w-4" />,
              onClick: () => publishMutation.mutate(row.id),
              disabled: row.status === 'PUBLISHED' || row.status === 'ARCHIVED',
            },
            {
              label: 'Lock',
              icon: <Lock className="h-4 w-4" />,
              onClick: () => lockMutation.mutate(row.id),
              disabled: row.status === 'LOCKED' || row.status === 'ARCHIVED',
            },
            {
              label: 'Archive',
              icon: <Archive className="h-4 w-4" />,
              onClick: () => archiveMutation.mutate(row.id),
              disabled: row.status === 'ARCHIVED',
            },
            {
              label: 'Duplicate',
              icon: <History className="h-4 w-4" />,
              onClick: () => {},
              disabled: true,
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {versionsQuery.data?.length === 0 ? (
        <EmptyState 
          title="No versions found" 
          description="Create your first timetable version to start scheduling classes."
        />
      ) : (
        <DataTable columns={columns} data={versionsQuery.data || []} />
      )}
    </div>
  );
}
