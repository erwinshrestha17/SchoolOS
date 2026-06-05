'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, BookOpen, Clock, AlertCircle, CheckCircle2, History, ClipboardCheck } from 'lucide-react';
import Link from 'next/link';

import { api } from '../../../lib/api';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { FilterBar } from '../../../components/dashboard/filter-bar';
import { DataTable } from '../../../components/ui/data-table';
import { StatusChip } from '../../../components/dashboard/status-chip';
import { ActionMenu } from '../../../components/ui/action-menu';
import { LoadingState } from '../../../components/dashboard/loading-state';
import { EmptyState } from '../../../components/dashboard/empty-state';
import { Button } from '../../../components/ui/button';
import { Select } from '../../../components/ui/select';
import { PermissionState } from '../../../components/ui/permission-state';
import { useSession } from '../../../components/session-provider';
import { useRouter } from 'next/navigation';
import { PageHeader } from '../../../components/ui/page-header';
import { StatCard } from '../../../components/ui/stat-card';

const isDueToday = (dueAt?: string | null) => {
  if (!dueAt) return false;
  return new Date(dueAt).toDateString() === new Date().toDateString();
};

const isUpcoming = (dueAt?: string | null) => {
  if (!dueAt) return false;
  const dueDate = new Date(dueAt);
  const today = new Date();
  return dueDate > today && !isDueToday(dueAt);
};

const isOverdue = (dueAt?: string | null, status?: string) => {
  if (!dueAt || status === 'CLOSED' || status === 'CANCELLED') return false;
  return new Date(dueAt) < new Date() && !isDueToday(dueAt);
};

export default function HomeworkPage() {
  const router = useRouter();
  const { session } = useSession();
  const [filters, setFilters] = useState({
    academicYearId: '',
    classId: '',
    sectionId: '',
    subjectId: '',
    status: '',
    search: '',
  });

  const academicYearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: api.listAcademicYears,
  });

  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: api.listClasses,
  });

  const subjectsQuery = useQuery({
    queryKey: ['subjects', filters.classId],
    queryFn: () => api.listSubjects({ classId: filters.classId || undefined }),
  });

  const homeworkQuery = useQuery({
    queryKey: ['homework', filters],
    queryFn: () => api.listHomework(filters),
  });

  if (homeworkQuery.error) {
    const error = homeworkQuery.error as any;
    if (error.status === 403) {
      return <PermissionState />;
    }
  }

  const homeworkItems = homeworkQuery.data ?? [];
  const stats = [
    {
      title: 'Total Homework',
      value: homeworkItems.length,
      icon: <BookOpen className="h-5 w-5" />,
      tone: 'info' as const,
      description: 'Backend assignments in the current filter',
    },
    {
      title: 'Due Today',
      value: homeworkItems.filter(h => isDueToday(h.dueAt)).length,
      icon: <Clock className="h-5 w-5" />,
      tone: 'warning' as const,
      description: 'Assignments requiring same-day attention',
    },
    {
      title: 'Overdue',
      value: homeworkItems.filter(h => isOverdue(h.dueAt, h.status)).length,
      icon: <AlertCircle className="h-5 w-5" />,
      tone: 'danger' as const,
      description: 'Open assignments past due time',
    },
    {
      title: 'Checked',
      value: homeworkItems.reduce(
        (acc, h) => acc + (h.submissions?.filter(s => s.status === 'REVIEWED').length ?? 0),
        0,
      ),
      icon: <CheckCircle2 className="h-5 w-5" />,
      tone: 'success' as const,
      description: 'Reviewed student submissions',
    },
  ];

  const homeworkGroups = [
    {
      title: 'Due Today',
      value: homeworkItems.filter(h => isDueToday(h.dueAt)).length,
      tone: 'warning' as const,
    },
    {
      title: 'Upcoming',
      value: homeworkItems.filter(h => isUpcoming(h.dueAt)).length,
      tone: 'info' as const,
    },
    {
      title: 'Overdue',
      value: homeworkItems.filter(h => isOverdue(h.dueAt, h.status)).length,
      tone: 'danger' as const,
    },
    {
      title: 'Checked',
      value: homeworkItems.reduce(
        (acc, h) => acc + (h.submissions?.filter(s => s.status === 'REVIEWED').length ?? 0),
        0,
      ),
      tone: 'success' as const,
    },
    {
      title: 'Closed',
      value: homeworkItems.filter(h => h.status === 'CLOSED').length,
      tone: 'neutral' as const,
    },
  ];

  const columns = [
    {
      header: 'Title',
      accessorKey: 'title',
      cell: (row: any) => (
        <div className="flex flex-col">
          <Link
            href={`/dashboard/homework/${row.id}`}
            className="font-bold text-slate-900 hover:text-primary-600 transition-colors"
          >
            {row.title}
          </Link>
          <span className="text-xs text-slate-500 line-clamp-1">{row.instructions}</span>
        </div>
      ),
    },
    {
      header: 'Subject',
      accessorKey: 'subject.name',
      cell: (row: any) => (
        <div className="flex flex-col">
          <span className="font-medium text-slate-700">{row.subject?.name}</span>
          <span className="text-xs text-slate-500">
            {row.class?.name} {row.section?.name ? `- ${row.section.name}` : ''}
          </span>
        </div>
      ),
    },
    {
      header: 'Assigned By',
      accessorKey: 'assignedByStaff.firstName',
      cell: (row: any) => (
        <span className="text-sm text-slate-600">
          {row.assignedByStaff ? `${row.assignedByStaff.firstName} ${row.assignedByStaff.lastName}` : 'System'}
        </span>
      ),
    },
    {
      header: 'Due Date',
      accessorKey: 'dueAt',
      cell: (row: any) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-slate-700">
            {row.dueAt ? new Date(row.dueAt).toLocaleDateString() : 'No date'}
          </span>
          <span className="text-xs text-slate-500">
            {row.dueAt ? new Date(row.dueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
          </span>
        </div>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (row: any) => <StatusChip status={row.status || 'DRAFT'} />,
    },
    {
      header: 'Submissions',
      accessorKey: 'submissions',
      cell: (row: any) => (
        <div className="flex items-center gap-2">
          <div className="h-2 w-16 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-500" 
              style={{ width: `${Math.min(100, (row.submissions?.length || 0) * 10)}%` }} 
            />
          </div>
          <span className="text-xs font-bold text-slate-600">
            {row.submissions?.length || 0}
          </span>
        </div>
      ),
    },
    {
      header: 'Actions',
      cell: (row: any) => (
        <ActionMenu
          items={[
            {
              label: 'View Details',
              onClick: () => router.push(`/dashboard/homework/${row.id}`),
              icon: <BookOpen className="h-4 w-4" />,
            },
            {
              label: 'Edit',
              onClick: () => router.push(`/dashboard/homework/${row.id}/edit`),
              icon: <History className="h-4 w-4" />,
              disabled: row.status === 'CLOSED',
            },
            {
              label: 'Review Submissions',
              onClick: () => router.push(`/dashboard/homework/${row.id}?tab=submissions`),
              icon: <CheckCircle2 className="h-4 w-4" />,
            },
          ]}
        />
      ),
    },
  ];

  const headerActions = (
    <Link href="/dashboard/homework/new">
      <Button className="rounded-xl bg-info-600 text-white shadow-sm hover:bg-info-700 focus-visible:ring-info-100">
        <Plus className="mr-2 h-5 w-5" />
        Create Homework
      </Button>
    </Link>
  );

  return (
    <DashboardPageShell>
      <PageHeader
        title="Homework"
        description="Assign, track, review, and close homework using the live academic workflow."
        actions={headerActions}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            tone={stat.tone}
            description={stat.description}
            loading={homeworkQuery.isLoading}
          />
        ))}
      </div>

      <div className="shell-card p-5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-info-600" />
            <h2 className="text-sm font-bold text-slate-950">Homework workload groups</h2>
          </div>
          <p className="text-sm text-slate-500">
            Assignments are grouped by due date and review state from the current backend result set.
          </p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {homeworkGroups.map((group) => (
            <StatCard
              key={group.title}
              title={group.title}
              value={group.value}
              tone={group.tone}
              loading={homeworkQuery.isLoading}
              className="p-4 lg:p-4"
            />
          ))}
        </div>
      </div>

      <FilterBar>
        <div className="flex-1 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            value={filters.academicYearId}
            onChange={(e) => setFilters(prev => ({ ...prev, academicYearId: e.target.value }))}
          >
            <option value="">All Years</option>
            {academicYearsQuery.data?.map(y => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </Select>

          <Select
            value={filters.classId}
            onChange={(e) => setFilters(prev => ({ ...prev, classId: e.target.value }))}
          >
            <option value="">All Classes</option>
            {classesQuery.data?.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>

          <Select
            value={filters.subjectId}
            onChange={(e) => setFilters(prev => ({ ...prev, subjectId: e.target.value }))}
          >
            <option value="">All Subjects</option>
            {subjectsQuery.data?.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>

          <Select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="CLOSED">Closed</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </div>
      </FilterBar>

      {homeworkQuery.isLoading ? (
        <LoadingState label="Loading homework assignments..." />
      ) : homeworkQuery.data?.length === 0 ? (
        <EmptyState
          title="No homework found"
          description="Create your first homework assignment to get started."
          icon={<BookOpen className="h-8 w-8" />}
          action={
            <Link href="/dashboard/homework/new">
              <Button variant="outline" className="rounded-xl">
                <Plus className="mr-2 h-4 w-4" />
                Create Homework
              </Button>
            </Link>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={homeworkQuery.data ?? []}
          onRowClick={(row) => router.push(`/dashboard/homework/${row.id}`)}
        />
      )}
    </DashboardPageShell>
  );
}
