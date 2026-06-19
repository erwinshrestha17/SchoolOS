'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Bell,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Plus,
  RefreshCcw,
  Search,
  Settings,
  Users,
} from 'lucide-react';
import Link from 'next/link';

import { api } from '../../../lib/api';
import type {
  HomeworkCompletionReportRow,
  HomeworkMissingLateReportRow,
  HomeworkReminderBatchSummary,
} from '../../../lib/api';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { FilterBar } from '../../../components/dashboard/filter-bar';
import { DataTable } from '../../../components/ui/data-table';
import { StatusBadge } from '../../../components/ui/status-badge';
import { ActionMenu } from '../../../components/ui/action-menu';
import { LoadingState } from '../../../components/dashboard/loading-state';
import { EmptyState } from '../../../components/dashboard/empty-state';
import { ErrorState } from '../../../components/dashboard/error-state';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { PermissionState } from '../../../components/ui/permission-state';
import { useSession } from '../../../components/session-provider';
import { useRouter } from 'next/navigation';
import { ModuleHeader } from '../../../components/ui/module-header';
import { KpiCard, KpiGrid } from '../../../components/ui/kpi-card';
import { ModuleTabs } from '../../../components/dashboard/module-tabs';
import { SectionCard } from '../../../components/ui/section-card';

function formatDate(value?: string | Date | null, fallback = 'Date not set') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleDateString();
}

function formatDateTime(value?: string | Date | null, fallback = 'Date not set') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleString();
}

function formatPercent(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '0%';
  return `${Math.round(value)}%`;
}

export default function HomeworkPage() {
  const router = useRouter();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    academicYearId: '',
    classId: '',
    sectionId: '',
    subjectId: '',
    status: '',
    search: '',
  });
  const [templateSearch, setTemplateSearch] = useState('');

  const academicYearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: api.listAcademicYears,
  });

  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: api.listClasses,
  });

  const sectionsQuery = useQuery({
    queryKey: ['sections', filters.classId],
    queryFn: api.listSections,
  });

  const subjectsQuery = useQuery({
    queryKey: ['subjects', filters.classId],
    queryFn: () => api.listSubjects({ classId: filters.classId || undefined }),
  });

  const homeworkQuery = useQuery({
    queryKey: ['homework', filters],
    queryFn: () => api.listHomework(filters),
  });

  const templatesQuery = useQuery({
    queryKey: ['homework-templates', filters.classId, filters.subjectId, templateSearch],
    queryFn: () =>
      api.listHomeworkTemplates({
        classId: filters.classId || undefined,
        subjectId: filters.subjectId || undefined,
        search: templateSearch.trim() || undefined,
        limit: 12,
      }),
  });

  const reminderBatchesQuery = useQuery({
    queryKey: ['homework-reminder-batches'],
    queryFn: () => api.listHomeworkReminderBatches({ limit: 5 }),
  });

  const completionReportQuery = useQuery({
    queryKey: [
      'homework-completion-report',
      filters.academicYearId,
      filters.classId,
      filters.sectionId,
    ],
    queryFn: () =>
      api.getHomeworkCompletionReport({
        academicYearId: filters.academicYearId,
        classId: filters.classId || undefined,
        sectionId: filters.sectionId || undefined,
      }),
    enabled: Boolean(filters.academicYearId),
  });

  const missingLateReportQuery = useQuery({
    queryKey: ['homework-missing-late-report', filters.academicYearId, filters.classId],
    queryFn: () =>
      api.getHomeworkMissingLateReport({
        academicYearId: filters.academicYearId,
        classId: filters.classId || undefined,
      }),
    enabled: Boolean(filters.academicYearId),
  });

  const retryReminderMutation = useMutation({
    mutationFn: api.retryHomeworkReminderBatch,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['homework-reminder-batches'] });
    },
  });

  if (homeworkQuery.error) {
    const error = homeworkQuery.error as any;
    if (error.status === 403) {
      return <PermissionState />;
    }
  }

  const homeworkItems = homeworkQuery.data ?? [];
  const completionRows = completionReportQuery.data ?? [];
  const missingLateRows = missingLateReportQuery.data ?? [];
  const submittedFromReport = completionRows.reduce(
    (sum: number, item: HomeworkCompletionReportRow) => sum + item.completed,
    0,
  );
  const totalExpectedFromReport = completionRows.reduce(
    (sum: number, item: HomeworkCompletionReportRow) => sum + item.totalSubmissions,
    0,
  );
  const completionRate =
    totalExpectedFromReport > 0
      ? (submittedFromReport / totalExpectedFromReport) * 100
      : 0;
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
          <span className="text-xs text-slate-500 line-clamp-1">{row.instructions?.trim() || 'Instructions not set'}</span>
        </div>
      ),
    },
    {
      header: 'Subject',
      accessorKey: 'subject.name',
      cell: (row: any) => (
        <div className="flex flex-col">
          <span className="font-medium text-slate-700">{row.subject?.name?.trim() || 'Subject not set'}</span>
          <span className="text-xs text-slate-500">
            {row.class?.name?.trim() || 'Class not set'}
            {row.section?.name?.trim() ? ` - ${row.section.name.trim()}` : ' - All sections'}
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
            {formatDate(row.dueAt)}
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
      cell: (row: any) => <StatusBadge status={row.status || 'DRAFT'} />,
    },
    {
      header: 'Submissions',
      accessorKey: 'submissions',
      cell: (row: any) => (
        <div className="flex items-center gap-2">
          <div className="h-2 w-16 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-mod-homework-accent)]"
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
              label: 'Review Submissions',
              onClick: () => router.push(`/dashboard/homework/${row.id}?tab=submissions`),
              icon: <CheckCircle2 className="h-4 w-4" />,
            },
          ]}
        />
      ),
    },
  ];

  const primaryAction = (
    <Link href="/dashboard/homework/new">
      <Button className="rounded-xl bg-[var(--color-mod-homework-accent)] text-white shadow-sm hover:bg-[var(--color-mod-homework-text)] focus-visible:ring-[var(--color-mod-homework-border)]">
        <Plus className="mr-2 h-5 w-5" />
        Create Homework
      </Button>
    </Link>
  );

  return (
    <DashboardPageShell>
      <ModuleHeader
        title="Homework & Timetable"
        description={`Assign homework, manage submissions, build timetables, and handle substitutions${session?.tenant.name ? ` for ${session.tenant.name}` : ''}.`}
        primaryAction={primaryAction}
        moreActionItems={[
          {
            label: 'Review Submissions',
            icon: <CheckCircle2 size={16} />,
            onClick: () => router.push('/dashboard/homework/review'),
          },
          {
            label: 'Timetable Builder',
            icon: <Settings size={16} />,
            onClick: () => router.push('/dashboard/timetable/builder'),
          },
          {
            label: 'Substitutions',
            icon: <Users size={16} />,
            onClick: () => router.push('/dashboard/timetable/substitutions'),
          },
          {
            label: 'Teacher Workload',
            icon: <BarChart3 size={16} />,
            onClick: () => router.push('/dashboard/timetable/workload'),
          },
        ]}
      >
        <ModuleTabs
          items={[
            { href: '/dashboard/homework', label: 'Homework', icon: BookOpen },
            { href: '/dashboard/homework/review', label: 'Submissions', icon: CheckCircle2 },
            { href: '/dashboard/timetable/builder', label: 'Timetable Builder', icon: Settings },
            { href: '/dashboard/timetable/substitutions', label: 'Substitution', icon: Users },
            { href: '/dashboard/timetable/workload', label: 'Teacher Workload', icon: BarChart3 },
            { href: '/dashboard/timetable', label: 'Reports', icon: ClipboardCheck },
          ]}
          accentColor="blue"
          variant="light"
        />
        <KpiGrid className="mt-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <KpiCard
            title="Homework Assigned"
            value={filters.academicYearId && completionReportQuery.data ? completionRows.length : 'Unavailable'}
            icon={<BookOpen size={20} />}
            tone="neutral"
            loading={completionReportQuery.isLoading}
            description={filters.academicYearId ? 'Backend completion report assignments.' : 'Select an academic year to load the report contract.'}
          />
          <KpiCard
            title="Due Soon"
            value="Unavailable"
            icon={<Bell size={20} />}
            tone="neutral"
            description="No module-owned due-soon summary contract is exposed."
          />
          <KpiCard
            title="Pending Submissions"
            value={filters.academicYearId && missingLateReportQuery.data ? missingLateRows.length : 'Unavailable'}
            icon={<AlertCircle size={20} />}
            tone={missingLateRows.length ? 'warning' : 'neutral'}
            loading={missingLateReportQuery.isLoading}
            description={filters.academicYearId ? 'Backend missing/late report rows.' : 'Select an academic year to load the report contract.'}
          />
          <KpiCard title="Timetable Conflicts" value="Unavailable" icon={<AlertCircle size={20} />} tone="neutral" description="Open timetable validation for backend conflict truth." />
          <KpiCard title="Substitutions" value="Unavailable" icon={<Users size={20} />} tone="neutral" description="Open the scoped substitution workspace." />
          <KpiCard title="Teacher Workload" value="Unavailable" icon={<BarChart3 size={20} />} tone="neutral" description="Open the backend workload report." />
        </KpiGrid>
      </ModuleHeader>

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
            onChange={(e) => setFilters(prev => ({ ...prev, classId: e.target.value, sectionId: '' }))}
          >
            <option value="">All Classes</option>
            {classesQuery.data?.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>

          <Select
            value={filters.sectionId}
            onChange={(e) => setFilters(prev => ({ ...prev, sectionId: e.target.value }))}
            disabled={!filters.classId}
          >
            <option value="">All Sections</option>
            {sectionsQuery.data?.filter(s => !filters.classId || s.classId === filters.classId).map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
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

      <div className="space-y-6">
        <SectionCard
          title="Assignments"
          description="Filter and open homework assignments from the live homework API."
          headerAction={
            <StatusBadge
              status="INFO"
              label={homeworkQuery.isLoading ? 'Loading' : `${homeworkItems.length} loaded`}
              tone="info"
            />
          }
        >
          {homeworkQuery.isLoading ? (
            <LoadingState label="Loading homework assignments..." />
          ) : homeworkQuery.isError ? (
            <ErrorState
              title="Unable to load homework"
              message="Homework assignments could not be loaded. Please retry after checking your access and module status."
            />
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
        </SectionCard>

        <div className="grid gap-6 xl:grid-cols-2">
          <SectionCard
            title="Template Library"
            description="Browse metadata-backed homework templates with the filtered backend endpoint."
            headerAction={
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={templateSearch}
                  onChange={(event) => setTemplateSearch(event.target.value)}
                  placeholder="Search templates"
                  className="pl-9"
                />
              </div>
            }
          >
            {templatesQuery.isLoading ? (
              <LoadingState label="Loading homework templates..." />
            ) : templatesQuery.isError ? (
              <ErrorState
                title="Unable to load templates"
                message="The homework template library could not be loaded."
              />
            ) : templatesQuery.data?.length === 0 ? (
              <EmptyState
                title="No templates found"
                description="Templates appear after assignments are saved with homework template metadata."
                icon={<FileText className="h-8 w-8" />}
              />
            ) : (
              <div className="space-y-3">
                {templatesQuery.data?.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => router.push(`/dashboard/homework/${template.id}`)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-[var(--color-mod-homework-border)] hover:bg-[var(--color-mod-homework-bg)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-950">{template.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                          {template.instructions?.trim() || 'Template instructions not set.'}
                        </p>
                      </div>
                      <StatusBadge status={template.status || 'DRAFT'} />
                    </div>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {template.class?.name?.trim() || 'Class not set'} · {template.subject?.name?.trim() || 'Subject not set'}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Reminder History"
            description="Inspect the latest reminder batches and retry failed batches through the backend route."
          >
            {reminderBatchesQuery.isLoading ? (
              <LoadingState label="Loading reminder batches..." />
            ) : reminderBatchesQuery.isError ? (
              <ErrorState
                title="Unable to load reminders"
                message="Homework reminder batch history could not be loaded."
              />
            ) : reminderBatchesQuery.data?.length === 0 ? (
              <EmptyState
                title="No reminder batches"
                description="Sent homework reminders will appear here."
                icon={<Bell className="h-8 w-8" />}
              />
            ) : (
              <div className="space-y-3">
                {reminderBatchesQuery.data?.map((batch: HomeworkReminderBatchSummary) => (
                  <div key={batch.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-950">
                          {batch.reminderType.replace(/_/g, ' ')}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatDateTime(batch.createdAt, 'Created date unavailable')}
                        </p>
                      </div>
                      <StatusBadge status={batch.status || 'PENDING'} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
                      <span>Targets: {batch.targetCount ?? 'Unavailable'}</span>
                      <span>Delivered: {batch.deliveryCount ?? 'Unavailable'}</span>
                      <span>Skipped: {batch.skippedCount ?? 'Unavailable'}</span>
                    </div>
                    {batch.failedReason ? (
                      <p className="mt-3 text-xs text-danger-700">
                        Reminder failed. Retry is available after reviewing the failure state.
                      </p>
                    ) : null}
                    {batch.status === 'FAILED' ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3 rounded-xl"
                        disabled={retryReminderMutation.isPending}
                        onClick={() => retryReminderMutation.mutate(batch.id)}
                      >
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Retry Batch
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <SectionCard
          title="Completion Reports"
          description="Use backend report routes for assignment completion and missing or late submission review."
        >
          {!filters.academicYearId ? (
            <EmptyState
              title="Select an academic year"
              description="Completion and missing or late submission reports require an academic year filter."
              icon={<BarChart3 className="h-8 w-8" />}
            />
          ) : completionReportQuery.isLoading || missingLateReportQuery.isLoading ? (
            <LoadingState label="Loading homework reports..." />
          ) : completionReportQuery.isError || missingLateReportQuery.isError ? (
            <ErrorState
              title="Unable to load reports"
              message="Homework completion reports could not be loaded from the backend."
            />
          ) : (
            <div className="space-y-5">
              <KpiGrid className="sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  title="Assignments"
                  value={completionRows.length}
                  icon={<BookOpen size={20} />}
                  tone="info"
                  description="Assignments returned by the completion report."
                />
                <KpiCard
                  title="Completed"
                  value={submittedFromReport}
                  icon={<CheckCircle2 size={20} />}
                  tone="success"
                  description="Completed or reviewed submissions from the report."
                />
                <KpiCard
                  title="Completion"
                  value={formatPercent(completionRate)}
                  icon={<BarChart3 size={20} />}
                  tone={completionRate >= 80 ? 'success' : 'warning'}
                  description="Backend report completion rate for the selected scope."
                />
                <KpiCard
                  title="Missing or Late"
                  value={missingLateRows.length}
                  icon={<AlertCircle size={20} />}
                  tone={missingLateRows.length ? 'warning' : 'neutral'}
                  description="Rows from the missing or late report."
                />
              </KpiGrid>

              <div className="grid gap-4 lg:grid-cols-2">
                <ReportList
                  title="Completion by Assignment"
                  rows={completionRows}
                  renderRow={(row: HomeworkCompletionReportRow) => (
                    <>
                      <div>
                        <p className="text-sm font-bold text-slate-950">{row.title}</p>
                        <p className="text-xs text-slate-500">
                          {row.class}
                          {row.section ? ` - ${row.section}` : ''} · {row.subject} · Due {formatDate(row.dueDate)}
                        </p>
                      </div>
                      <StatusBadge
                        status="INFO"
                        label={`${row.completed}/${row.totalSubmissions} · ${formatPercent(row.completionRate)}`}
                        tone={row.completionRate >= 80 ? 'approved' : 'pending'}
                      />
                    </>
                  )}
                />
                <ReportList
                  title="Missing or Late"
                  rows={missingLateRows}
                  renderRow={(row: HomeworkMissingLateReportRow) => (
                    <>
                      <div>
                        <p className="text-sm font-bold text-slate-950">{row.studentName}</p>
                        <p className="text-xs text-slate-500">
                          {row.assignmentTitle} · {row.subject} · Due {formatDate(row.dueDate)}
                        </p>
                      </div>
                      <StatusBadge status={row.status} />
                    </>
                  )}
                />
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </DashboardPageShell>
  );
}

function ReportList<T>({
  title,
  rows,
  renderRow,
}: {
  title: string;
  rows: T[];
  renderRow: (row: T) => ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <h3 className="text-sm font-bold text-slate-950">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No report rows for the selected scope.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {rows.slice(0, 8).map((row, index) => (
            <div
              key={index}
              className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3"
            >
              {renderRow(row)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
