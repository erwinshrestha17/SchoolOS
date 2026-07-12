"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  AlertCircle,
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Plus,
  RefreshCcw,
  Search,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import {
  formatBsDate,
  formatBsDateTime,
  type HomeworkAssignmentSummary,
} from "@schoolos/core";

import { ApiRequestError, api } from "../../../lib/api";
import type {
  HomeworkCompletionReportRow,
  HomeworkMissingLateReportRow,
  HomeworkReminderBatchSummary,
} from "../../../lib/api";
import { DashboardPageShell } from "../../../components/dashboard/dashboard-page-shell";
import { FilterBar } from "../../../components/dashboard/filter-bar";
import { DataTable } from "../../../components/ui/data-table";
import { StatusBadge } from "../../../components/ui/status-badge";
import { ActionMenu } from "../../../components/ui/action-menu";
import { LoadingState } from "../../../components/ui/loading-state";
import { EmptyState } from "../../../components/ui/empty-state";
import { ErrorState } from "../../../components/ui/error-state";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { PermissionDenied } from "../../../components/ui/permission-denied";
import { useSession } from "../../../components/session-provider";
import { useRouter } from "next/navigation";
import { ModuleHeader } from "../../../components/ui/module-header";
import { KpiCard, KpiGrid } from "../../../components/ui/kpi-card";
import { ModuleTabs } from "../../../components/dashboard/module-tabs";
import { SectionCard } from "../../../components/ui/section-card";
import { useUrlFilters } from "../../../lib/hooks/use-url-filters";
import { TablePagination } from "../../../components/ui/table-pagination";
import { Drawer } from "../../../components/ui/drawer";
import { Toast, type ToastTone } from "../../../components/ui/toast";

const HOMEWORK_PAGE_SIZE = 20;

type HomeworkNotice = {
  title: string;
  description?: string;
  tone: ToastTone;
};

type SupportingHomeworkView = "templates" | "reminders" | "reports";

function formatDate(value?: string | Date | null, fallback = "Date not set") {
  if (!value) return fallback;
  try {
    return formatBsDate(value);
  } catch {
    return "Date unavailable";
  }
}

function formatDateTime(
  value?: string | Date | null,
  fallback = "Date not set",
) {
  if (!value) return fallback;
  try {
    return formatBsDateTime(value);
  } catch {
    return "Date unavailable";
  }
}

function formatPercent(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "0%";
  return `${Math.round(value)}%`;
}

export default function HomeworkPage() {
  const router = useRouter();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useUrlFilters({
    academicYearId: "",
    classId: "",
    sectionId: "",
    subjectId: "",
    status: "",
    search: "",
    page: 1,
  });
  const [templateSearch, setTemplateSearch] = useState("");
  const [supportingView, setSupportingView] =
    useState<SupportingHomeworkView | null>(null);
  const [selectedHomework, setSelectedHomework] =
    useState<HomeworkAssignmentSummary | null>(null);
  const [notice, setNotice] = useState<HomeworkNotice | null>(null);
  const grantedPermissions = new Set(session?.user.permissions ?? []);
  const canCreateHomework = grantedPermissions.has("homework:create");
  const canReviewHomework = grantedPermissions.has("homework:review");

  const operationalSummaryQuery = useQuery({
    queryKey: ["operational-summary", "homework-timetable"],
    queryFn: () => api.getModuleSummary("homework-timetable"),
  });
  const operationalSummary = operationalSummaryQuery.data;
  const operationalMetric = (key: string) => {
    const value = operationalSummary?.summary[key];
    return value === null || value === undefined ? "Unavailable" : value;
  };

  const academicYearsQuery = useQuery({
    queryKey: ["academic-years"],
    queryFn: api.listAcademicYears,
  });

  const classesQuery = useQuery({
    queryKey: ["classes"],
    queryFn: api.listClasses,
  });

  const sectionsQuery = useQuery({
    queryKey: ["sections", filters.classId],
    queryFn: api.listSections,
  });

  const subjectsQuery = useQuery({
    queryKey: ["subjects", filters.classId],
    queryFn: () => api.listSubjects({ classId: filters.classId || undefined }),
  });

  const homeworkQuery = useQuery({
    queryKey: [
      "homework",
      "page",
      filters.academicYearId,
      filters.classId,
      filters.sectionId,
      filters.subjectId,
      filters.status,
      filters.search,
      filters.page,
    ],
    queryFn: () =>
      api.listHomeworkPage({
        academicYearId: filters.academicYearId || undefined,
        classId: filters.classId || undefined,
        sectionId: filters.sectionId || undefined,
        subjectId: filters.subjectId || undefined,
        status: filters.status || undefined,
        search: filters.search.trim() || undefined,
        page: Math.max(1, filters.page),
        limit: HOMEWORK_PAGE_SIZE,
        sortBy: "dueDate",
        sortOrder: "desc",
      }),
  });

  const templatesQuery = useQuery({
    queryKey: [
      "homework-templates",
      filters.classId,
      filters.subjectId,
      templateSearch,
    ],
    queryFn: () =>
      api.listHomeworkTemplates({
        classId: filters.classId || undefined,
        subjectId: filters.subjectId || undefined,
        search: templateSearch.trim() || undefined,
        limit: 12,
      }),
    enabled: supportingView === "templates",
  });

  const reminderBatchesQuery = useQuery({
    queryKey: ["homework-reminder-batches"],
    queryFn: () => api.listHomeworkReminderBatches({ limit: 5 }),
    enabled: supportingView === "reminders",
  });

  const completionReportQuery = useQuery({
    queryKey: [
      "homework-completion-report",
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
    enabled:
      supportingView === "reports" && Boolean(filters.academicYearId),
  });

  const missingLateReportQuery = useQuery({
    queryKey: [
      "homework-missing-late-report",
      filters.academicYearId,
      filters.classId,
    ],
    queryFn: () =>
      api.getHomeworkMissingLateReport({
        academicYearId: filters.academicYearId,
        classId: filters.classId || undefined,
      }),
    enabled:
      supportingView === "reports" && Boolean(filters.academicYearId),
  });

  const retryReminderMutation = useMutation({
    mutationFn: api.retryHomeworkReminderBatch,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["homework-reminder-batches"],
      });
    },
  });

  if (
    homeworkQuery.error instanceof ApiRequestError &&
    homeworkQuery.error.statusCode === 403
  ) {
    return (
      <PermissionDenied
        showNavigation={false}
        title="Homework access restricted"
        description="Your current role cannot view homework assignments in this school."
      />
    );
  }

  const homeworkItems = homeworkQuery.data?.items ?? [];
  const homeworkMeta = homeworkQuery.data?.meta;
  const completionRows = completionReportQuery.data ?? [];
  const missingLateRows = missingLateReportQuery.data ?? [];
  const hasActiveHomeworkFilters = Boolean(
    filters.academicYearId ||
      filters.classId ||
      filters.sectionId ||
      filters.subjectId ||
      filters.status ||
      filters.search.trim(),
  );
  const submittedFromReport = completionRows.reduce(
    (sum: number, item: HomeworkCompletionReportRow) => sum + item.completed,
    0,
  );
  const totalExpectedFromReport = completionRows.reduce(
    (sum: number, item: HomeworkCompletionReportRow) =>
      sum + item.totalSubmissions,
    0,
  );
  const completionRate =
    totalExpectedFromReport > 0
      ? (submittedFromReport / totalExpectedFromReport) * 100
      : 0;
  const columns = [
    {
      header: "Title",
      accessorKey: "title",
      cell: (row: HomeworkAssignmentSummary) => (
        <div className="flex flex-col">
          <button
            type="button"
            className="w-fit text-left font-bold text-slate-900 transition-colors hover:text-[var(--color-mod-homework-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mod-homework-border)]"
            onClick={() => setSelectedHomework(row)}
          >
            {row.title}
          </button>
          <span className="text-xs text-slate-500 line-clamp-1">
            {row.instructions?.trim() || "Instructions not set"}
          </span>
        </div>
      ),
    },
    {
      header: "Subject",
      accessorKey: "subject.name",
      cell: (row: HomeworkAssignmentSummary) => (
        <div className="flex flex-col">
          <span className="font-medium text-slate-700">
            {row.subject?.name?.trim() || "Subject not set"}
          </span>
          <span className="text-xs text-slate-500">
            {row.class?.name?.trim() || "Class not set"}
            {row.section?.name?.trim()
              ? ` - ${row.section.name.trim()}`
              : " - All sections"}
          </span>
        </div>
      ),
    },
    {
      header: "Assigned By",
      accessorKey: "assignedByStaff.firstName",
      cell: (row: HomeworkAssignmentSummary) => (
        <span className="text-sm text-slate-600">
          {row.assignedByStaff
            ? `${row.assignedByStaff.firstName} ${row.assignedByStaff.lastName}`
            : "System"}
        </span>
      ),
    },
    {
      header: "Due Date",
      accessorKey: "dueAt",
      cell: (row: HomeworkAssignmentSummary) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-slate-700">
            {formatDate(row.dueAt)}
          </span>
          <span className="text-xs text-slate-500">
            {row.dueAt ? formatBsDateTime(row.dueAt) : ""}
          </span>
        </div>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row: HomeworkAssignmentSummary) => (
        <StatusBadge status={row.status || "DRAFT"} />
      ),
    },
    {
      header: "Submissions",
      accessorKey: "submissionSummary",
      cell: (row: HomeworkAssignmentSummary) => (
        <div className="flex flex-col">
          <span className="text-sm font-bold text-slate-800">
            {row.submissionSummary?.total ?? "Unavailable"}
          </span>
          <span className="text-xs text-slate-500">submission records</span>
        </div>
      ),
    },
    {
      header: "Actions",
      cell: (row: HomeworkAssignmentSummary) => (
        <ActionMenu
          items={[
            {
              label: "Quick View",
              onClick: () => setSelectedHomework(row),
              icon: <BookOpen className="h-4 w-4" />,
            },
            {
              label: "Manage Assignment",
              onClick: () => router.push(`/dashboard/homework/${row.id}`),
              icon: <CheckCircle2 className="h-4 w-4" />,
            },
            ...(canReviewHomework
              ? [
                  {
                    label: "Review Submissions",
                    onClick: () =>
                      router.push(
                        `/dashboard/homework/${row.id}?tab=submissions`,
                      ),
                    icon: <CheckCircle2 className="h-4 w-4" />,
                  },
                ]
              : []),
          ]}
        />
      ),
    },
  ];

  const primaryAction = canCreateHomework ? (
    <Link href="/dashboard/homework/new">
      <Button className="rounded-xl bg-[var(--color-mod-homework-accent)] text-white shadow-sm hover:bg-[var(--color-mod-homework-text)] focus-visible:ring-[var(--color-mod-homework-border)]">
        <Plus className="mr-2 h-5 w-5" />
        Create Homework
      </Button>
    </Link>
  ) : undefined;

  function clearHomeworkFilters() {
    setFilters(
      {
        academicYearId: "",
        classId: "",
        sectionId: "",
        subjectId: "",
        status: "",
        search: "",
        page: 1,
      },
      { resetPage: true },
    );
  }

  async function openHomeworkAttachment(attachmentId: string) {
    try {
      await api.openHomeworkAttachmentPreview(attachmentId);
    } catch {
      setNotice({
        title: "Attachment unavailable",
        description:
          "This protected file could not be opened. It may still be processing, restricted, or no longer available.",
        tone: "danger",
      });
    }
  }

  return (
    <DashboardPageShell>
      {notice ? (
        <Toast
          title={notice.title}
          description={notice.description}
          tone={notice.tone}
          onDismiss={() => setNotice(null)}
          className="max-w-none"
        />
      ) : null}

      <ModuleHeader
        title="Homework & Timetable"
        description={`Assign homework, manage submissions, build timetables, and handle substitutions${session?.tenant.name ? ` for ${session.tenant.name}` : ""}.`}
        primaryAction={primaryAction}
        moreActionItems={[
          ...(canReviewHomework
            ? [
                {
                  label: "Review Submissions",
                  icon: <CheckCircle2 size={16} />,
                  onClick: () => router.push("/dashboard/homework/review"),
                },
              ]
            : []),
          {
            label: "Timetable Builder",
            icon: <Settings size={16} />,
            onClick: () => router.push("/dashboard/timetable/builder"),
          },
          {
            label: "Timetable Conflicts",
            icon: <AlertCircle size={16} />,
            onClick: () => router.push("/dashboard/timetable/conflicts"),
          },
          {
            label: "Timetable Versions",
            icon: <ClipboardCheck size={16} />,
            onClick: () => router.push("/dashboard/timetable/versions"),
          },
          {
            label: "Substitutions",
            icon: <Users size={16} />,
            onClick: () => router.push("/dashboard/timetable/substitutions"),
          },
          {
            label: "Teacher Workload",
            icon: <BarChart3 size={16} />,
            onClick: () => router.push("/dashboard/timetable/workload"),
          },
        ]}
      >
        <ModuleTabs
          items={[
            { href: "/dashboard/homework", label: "Homework", icon: BookOpen },
            {
              href: "/dashboard/homework/review",
              label: "Submissions",
              icon: CheckCircle2,
            },
            {
              href: "/dashboard/timetable",
              label: "Timetable",
              icon: Calendar,
            },
            {
              href: "/dashboard/timetable/builder",
              label: "Builder",
              icon: Settings,
            },
            {
              href: "/dashboard/timetable/substitutions",
              label: "Substitution",
              icon: Users,
            },
            {
              href: "/dashboard/timetable/workload",
              label: "Teacher Workload",
              icon: BarChart3,
            },
          ]}
          accentColor="blue"
          variant="light"
        />
        <KpiGrid className="mt-5 sm:grid-cols-2">
          <KpiCard
            title="Homework Due Today"
            value={operationalMetric("homeworkDueToday")}
            loading={operationalSummaryQuery.isLoading}
            icon={<Bell size={20} />}
            tone={
              Number(operationalSummary?.summary.homeworkDueToday) > 0
                ? "warning"
                : "neutral"
            }
            href="/dashboard/homework"
            description="Published homework due by end of today."
          />
          <KpiCard
            title="Unassigned Substitutions"
            value={operationalMetric("unassignedSubstitutionsToday")}
            loading={operationalSummaryQuery.isLoading}
            icon={<Users size={20} />}
            tone={
              Number(
                operationalSummary?.summary.unassignedSubstitutionsToday,
              ) > 0
                ? "warning"
                : "neutral"
            }
            href="/dashboard/timetable/substitutions"
            description="Today's substitutions still needing a covering teacher."
          />
        </KpiGrid>
      </ModuleHeader>

      <FilterBar>
        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={filters.search}
              onChange={(event) =>
                setFilters(
                  { search: event.target.value },
                  { resetPage: true },
                )
              }
              placeholder="Search title, instructions, or subject"
              aria-label="Search homework"
              className="pl-9"
            />
          </div>

          <Select
            value={filters.academicYearId}
            onChange={(e) =>
              setFilters(
                { academicYearId: e.target.value },
                { resetPage: true },
              )
            }
            aria-label="Filter by academic year"
          >
            <option value="">All Years</option>
            {academicYearsQuery.data?.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </Select>

          <Select
            value={filters.classId}
            onChange={(e) =>
              setFilters(
                {
                  classId: e.target.value,
                  sectionId: "",
                },
                { resetPage: true },
              )
            }
            aria-label="Filter by class"
          >
            <option value="">All Classes</option>
            {classesQuery.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>

          <Select
            value={filters.sectionId}
            onChange={(e) =>
              setFilters(
                { sectionId: e.target.value },
                { resetPage: true },
              )
            }
            disabled={!filters.classId}
            aria-label="Filter by section"
          >
            <option value="">All Sections</option>
            {sectionsQuery.data
              ?.filter((s) => !filters.classId || s.classId === filters.classId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </Select>

          <Select
            value={filters.subjectId}
            onChange={(e) =>
              setFilters(
                { subjectId: e.target.value },
                { resetPage: true },
              )
            }
            aria-label="Filter by subject"
          >
            <option value="">All Subjects</option>
            {subjectsQuery.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>

          <Select
            value={filters.status}
            onChange={(e) =>
              setFilters({ status: e.target.value }, { resetPage: true })
            }
            aria-label="Filter by homework status"
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
              label={
                homeworkQuery.isLoading
                  ? "Loading"
                  : homeworkQuery.isFetching
                    ? "Refreshing"
                    : homeworkMeta
                      ? `${homeworkMeta.total} assignments · ${homeworkQuery.isStale ? "May be stale · " : ""}Updated ${formatDateTime(new Date(homeworkQuery.dataUpdatedAt))}`
                      : "Assignment count unavailable"
              }
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
              onRetry={() => void homeworkQuery.refetch()}
            />
          ) : homeworkItems.length === 0 ? (
            <EmptyState
              title={
                homeworkMeta && homeworkMeta.total > 0
                  ? "This page has no assignments"
                  : hasActiveHomeworkFilters
                    ? "No homework matches these filters"
                    : "No homework assignments yet"
              }
              description={
                homeworkMeta && homeworkMeta.total > 0
                  ? "The shared link points past the available assignment pages. Return to the last available page."
                  : hasActiveHomeworkFilters
                    ? "Clear or adjust the filters while keeping your assignment scope protected by the backend."
                    : canCreateHomework
                      ? "Create the first homework assignment for an assigned class and subject."
                      : "Homework assignments will appear here when an authorized teacher publishes them."
              }
              icon={<BookOpen className="h-8 w-8" />}
              action={
                homeworkMeta && homeworkMeta.total > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() =>
                      setFilters({ page: homeworkMeta.totalPages })
                    }
                  >
                    Go to last page
                  </Button>
                ) : hasActiveHomeworkFilters ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={clearHomeworkFilters}
                  >
                    Clear filters
                  </Button>
                ) : canCreateHomework ? (
                  <Link href="/dashboard/homework/new">
                    <Button variant="outline" className="rounded-xl">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Homework
                    </Button>
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-100">
              <DataTable
                columns={columns}
                data={homeworkItems}
                getRowKey={(row) => row.id}
                className="rounded-none border-0"
              />
              {homeworkMeta ? (
                <TablePagination
                  page={homeworkMeta.page}
                  pageSize={homeworkMeta.limit}
                  total={homeworkMeta.total}
                  onPageChange={(page) => setFilters({ page })}
                />
              ) : null}
            </div>
          )}
        </SectionCard>

        <section
          aria-labelledby="supporting-homework-tools"
          className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
        >
          <div>
            <p
              id="supporting-homework-tools"
              className="text-sm font-bold text-slate-950"
            >
              Supporting homework tools
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Open a secondary workspace only when you need it. Its data loads
              on demand.
            </p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <SupportingToolButton
              title="Template Library"
              description="Reuse metadata-backed assignment templates."
              icon={<FileText className="h-5 w-5" />}
              selected={supportingView === "templates"}
              onClick={() =>
                setSupportingView((current) =>
                  current === "templates" ? null : "templates",
                )
              }
            />
            <SupportingToolButton
              title="Reminder History"
              description="Inspect and retry recent reminder batches."
              icon={<Bell className="h-5 w-5" />}
              selected={supportingView === "reminders"}
              onClick={() =>
                setSupportingView((current) =>
                  current === "reminders" ? null : "reminders",
                )
              }
            />
            <SupportingToolButton
              title="Completion Reports"
              description="Review completion, missing, and late records."
              icon={<BarChart3 className="h-5 w-5" />}
              selected={supportingView === "reports"}
              onClick={() =>
                setSupportingView((current) =>
                  current === "reports" ? null : "reports",
                )
              }
            />
          </div>
        </section>

        {supportingView === "templates" ? (
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
                    onClick={() =>
                      router.push(`/dashboard/homework/${template.id}`)
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-[var(--color-mod-homework-border)] hover:bg-[var(--color-mod-homework-bg)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-950">
                          {template.title}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                          {template.instructions?.trim() ||
                            "Template instructions not set."}
                        </p>
                      </div>
                      <StatusBadge status={template.status || "DRAFT"} />
                    </div>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {template.class?.name?.trim() || "Class not set"} ·{" "}
                      {template.subject?.name?.trim() || "Subject not set"}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </SectionCard>
        ) : null}

        {supportingView === "reminders" ? (
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
                {reminderBatchesQuery.data?.map(
                  (batch: HomeworkReminderBatchSummary) => (
                    <div
                      key={batch.id}
                      className="rounded-xl border border-slate-200 bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-950">
                            {batch.reminderType.replace(/_/g, " ")}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatDateTime(
                              batch.createdAt,
                              "Created date unavailable",
                            )}
                          </p>
                        </div>
                        <StatusBadge status={batch.status || "PENDING"} />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
                        <span>
                          Targets: {batch.targetCount ?? "Unavailable"}
                        </span>
                        <span>
                          Delivered: {batch.deliveryCount ?? "Unavailable"}
                        </span>
                        <span>
                          Skipped: {batch.skippedCount ?? "Unavailable"}
                        </span>
                      </div>
                      {batch.failedReason ? (
                        <p className="mt-3 text-xs text-danger-700">
                          Reminder failed. Retry is available after reviewing
                          the failure state.
                        </p>
                      ) : null}
                      {batch.status === "FAILED" ? (
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
                  ),
                )}
              </div>
            )}
          </SectionCard>
        ) : null}

        {supportingView === "reports" ? (
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
          ) : completionReportQuery.isLoading ||
            missingLateReportQuery.isLoading ? (
            <LoadingState label="Loading homework reports..." />
          ) : completionReportQuery.isError ||
            missingLateReportQuery.isError ? (
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
                  tone={completionRate >= 80 ? "success" : "warning"}
                  description="Backend report completion rate for the selected scope."
                />
                <KpiCard
                  title="Missing or Late"
                  value={missingLateRows.length}
                  icon={<AlertCircle size={20} />}
                  tone={missingLateRows.length ? "warning" : "neutral"}
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
                        <p className="text-sm font-bold text-slate-950">
                          {row.title}
                        </p>
                        <p className="text-xs text-slate-500">
                          {row.class}
                          {row.section ? ` - ${row.section}` : ""} ·{" "}
                          {row.subject} · Due {formatDate(row.dueDate)}
                        </p>
                      </div>
                      <StatusBadge
                        status="INFO"
                        label={`${row.completed}/${row.totalSubmissions} · ${formatPercent(row.completionRate)}`}
                        tone={row.completionRate >= 80 ? "approved" : "pending"}
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
                        <p className="text-sm font-bold text-slate-950">
                          {row.studentName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {row.assignmentTitle} · {row.subject} · Due{" "}
                          {formatDate(row.dueDate)}
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
        ) : null}
      </div>

      <HomeworkQuickViewDrawer
        homework={selectedHomework}
        canReview={canReviewHomework}
        onClose={() => setSelectedHomework(null)}
        onOpenAttachment={openHomeworkAttachment}
      />
    </DashboardPageShell>
  );
}

function HomeworkQuickViewDrawer({
  homework,
  canReview,
  onClose,
  onOpenAttachment,
}: {
  homework: HomeworkAssignmentSummary | null;
  canReview: boolean;
  onClose: () => void;
  onOpenAttachment: (attachmentId: string) => Promise<void>;
}) {
  return (
    <Drawer
      isOpen={Boolean(homework)}
      onClose={onClose}
      title={homework?.title || "Homework quick view"}
      description="Inspect one assignment without losing the current filters or page."
      width="md"
      footer={
        homework ? (
          <div className="flex flex-wrap justify-end gap-2">
            {canReview ? (
              <Link
                href={`/dashboard/homework/${homework.id}?tab=submissions`}
              >
                <Button type="button" variant="outline">
                  Review submissions
                </Button>
              </Link>
            ) : null}
            <Link href={`/dashboard/homework/${homework.id}`}>
              <Button type="button">Manage assignment</Button>
            </Link>
          </div>
        ) : undefined
      }
    >
      {homework ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={homework.status || "DRAFT"} />
            <StatusBadge
              status="INFO"
              label={`${homework.attachmentCount ?? homework.attachments?.length ?? 0} attachments`}
              tone="info"
            />
          </div>

          <dl className="grid gap-3 sm:grid-cols-2">
            <QuickViewField
              label="Class and section"
              value={`${homework.class?.name?.trim() || "Class not set"}${
                homework.section?.name?.trim()
                  ? ` · ${homework.section.name.trim()}`
                  : " · All sections"
              }`}
            />
            <QuickViewField
              label="Subject"
              value={homework.subject?.name?.trim() || "Subject not set"}
            />
            <QuickViewField
              label="Due"
              value={formatDateTime(homework.dueAt)}
            />
            <QuickViewField
              label="Assigned by"
              value={
                homework.assignedByStaff
                  ? `${homework.assignedByStaff.firstName} ${homework.assignedByStaff.lastName}`.trim()
                  : "Staff record unavailable"
              }
            />
            <QuickViewField
              label="Submission records"
              value={
                homework.submissionSummary
                  ? String(homework.submissionSummary.total)
                  : "Unavailable"
              }
            />
            <QuickViewField
              label="Maximum score"
              value={
                homework.maxScore === null
                  ? "Not scored"
                  : String(homework.maxScore)
              }
            />
          </dl>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Instructions
            </h3>
            <p className="mt-2 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              {homework.instructions?.trim() || "Instructions not set"}
            </p>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Protected attachments
            </h3>
            {homework.attachments?.length ? (
              <div className="mt-2 space-y-2">
                {homework.attachments.map((attachment) => {
                  const file = attachment.fileAsset;
                  const isAvailable = file?.status === "UPLOADED";

                  return (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {file?.originalFilename?.trim() ||
                            "File name unavailable"}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {file
                            ? `${Math.max(1, Math.round(file.sizeBytes / 1024))} KB`
                            : "File details unavailable"}
                        </p>
                      </div>
                      {isAvailable ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            void onOpenAttachment(attachment.id)
                          }
                        >
                          Open
                        </Button>
                      ) : (
                        <StatusBadge
                          status={file?.status || "UNAVAILABLE"}
                          label={
                            file?.status === "PENDING"
                              ? "Processing"
                              : "Unavailable"
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                No attachments are linked to this assignment.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}

function QuickViewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function SupportingToolButton({
  title,
  description,
  icon,
  selected,
  onClick,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mod-homework-border)] ${
        selected
          ? "border-[var(--color-mod-homework-accent)] bg-[var(--color-mod-homework-bg)] text-[var(--color-mod-homework-text)] shadow-sm"
          : "border-slate-200 bg-white text-slate-700 hover:border-[var(--color-mod-homework-border)] hover:bg-white"
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-bold">
        {icon}
        {title}
      </span>
      <span className="mt-2 block text-xs leading-5 text-slate-500">
        {description}
      </span>
    </button>
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
        <p className="mt-3 text-sm text-slate-500">
          No report rows for the selected scope.
        </p>
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
