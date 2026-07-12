"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardList,
  FileText,
  Plus,
  Search,
  Users,
} from "lucide-react";
import Link from "next/link";
import {
  formatBsDate,
  formatBsDateTime,
  type HomeworkAssignmentSummary,
} from "@schoolos/core";

import { ApiRequestError, api } from "../../../lib/api";
import type { HomeworkCompletionReportRow } from "../../../lib/api";
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
import { useRouter, useSearchParams } from "next/navigation";
import { ModuleHeader } from "../../../components/ui/module-header";
import { KpiCard, KpiGrid } from "../../../components/ui/kpi-card";
import { ModuleTabs } from "../../../components/dashboard/module-tabs";
import { SectionCard } from "../../../components/ui/section-card";
import { useUrlFilters } from "../../../lib/hooks/use-url-filters";
import { TablePagination } from "../../../components/ui/table-pagination";
import { Drawer } from "../../../components/ui/drawer";
import { Toast, type ToastTone } from "../../../components/ui/toast";

const HOMEWORK_PAGE_SIZE = 20;
// When a specific day is selected we can't ask the backend to filter by
// assignedDate (no such query param exists yet), so we pull a wider window
// and filter/paginate client-side. This is a deliberate P0 simplification —
// see the plan at fuzzy-gliding-hopper.md for the backend follow-up.
const DATE_FILTER_FETCH_LIMIT = 200;

type ActiveTab = "today" | "all" | "completion" | "templates";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

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

function statusLabel(status?: string | null) {
  switch (status) {
    case "ASSIGNED":
      return "Published";
    case "DRAFT":
      return "Draft";
    case "CLOSED":
      return "Closed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status || "Draft";
  }
}

function teacherName(row: HomeworkAssignmentSummary) {
  return row.assignedByStaff
    ? `${row.assignedByStaff.firstName} ${row.assignedByStaff.lastName}`.trim()
    : "Staff not assigned";
}

export default function HomeworkPage() {
  const { session } = useSession();
  const roles = session?.user.roles ?? [];
  const isStudentOrParent =
    roles.includes("student") || roles.includes("parent");

  if (isStudentOrParent) {
    return <StudentHomeworkView />;
  }

  return <HomeworkWorkspace />;
}

/* ------------------------------------------------------------------ */
/* Staff / admin workspace                                             */
/* ------------------------------------------------------------------ */

const VALID_TABS: ActiveTab[] = ["today", "all", "completion", "templates"];

function HomeworkWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = useSession();
  const requestedTab = searchParams.get("tab") as ActiveTab | null;
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    requestedTab && VALID_TABS.includes(requestedTab) ? requestedTab : "today",
  );
  const [templateSearch, setTemplateSearch] = useState("");
  const [selectedHomework, setSelectedHomework] =
    useState<HomeworkAssignmentSummary | null>(null);
  const [notice, setNotice] = useState<{
    title: string;
    description?: string;
    tone: ToastTone;
  } | null>(null);

  const [filters, setFilters] = useUrlFilters({
    classId: "",
    sectionId: "",
    subjectId: "",
    teacherId: "",
    status: "",
    search: "",
    date: "",
    page: 1,
  });

  const grantedPermissions = new Set(session?.user.permissions ?? []);
  const canCreateHomework = grantedPermissions.has("homework:create");
  const canReviewHomework = grantedPermissions.has("homework:review");

  const summaryQuery = useQuery({
    queryKey: ["homework-summary-today"],
    queryFn: () => api.getHomeworkSummaryToday(),
  });
  const summary = summaryQuery.data;

  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: api.listClasses });
  const sectionsQuery = useQuery({ queryKey: ["sections"], queryFn: api.listSections });
  const subjectsQuery = useQuery({
    queryKey: ["subjects", filters.classId],
    queryFn: () => api.listSubjects({ classId: filters.classId || undefined }),
  });
  const staffQuery = useQuery({ queryKey: ["staff"], queryFn: api.listStaff });
  const academicYearsQuery = useQuery({
    queryKey: ["academic-years"],
    queryFn: api.listAcademicYears,
  });

  const isTodayTab = activeTab === "today";
  const effectiveDate = isTodayTab
    ? filters.date || todayIso()
    : filters.date || undefined;
  const useClientDateFilter = Boolean(effectiveDate);

  const homeworkQuery = useQuery({
    queryKey: [
      "homework",
      "page",
      effectiveDate,
      useClientDateFilter,
      filters.classId,
      filters.sectionId,
      filters.subjectId,
      filters.teacherId,
      filters.status,
      filters.search,
      useClientDateFilter ? "client-paged" : filters.page,
    ],
    queryFn: () =>
      api.listHomeworkPage({
        classId: filters.classId || undefined,
        sectionId: filters.sectionId || undefined,
        subjectId: filters.subjectId || undefined,
        teacherId: filters.teacherId || undefined,
        status: filters.status || undefined,
        search: filters.search.trim() || undefined,
        sortBy: "assignedDate",
        sortOrder: "desc",
        page: useClientDateFilter ? 1 : Math.max(1, filters.page),
        limit: useClientDateFilter ? DATE_FILTER_FETCH_LIMIT : HOMEWORK_PAGE_SIZE,
      }),
    enabled: activeTab === "today" || activeTab === "all",
  });

  const currentAcademicYearId =
    academicYearsQuery.data?.find((year) => year.isCurrent)?.id ??
    academicYearsQuery.data?.[0]?.id ??
    "";

  const completionReportQuery = useQuery({
    queryKey: [
      "homework-completion-report",
      currentAcademicYearId,
      filters.classId,
      filters.sectionId,
    ],
    queryFn: () =>
      api.getHomeworkCompletionReport({
        academicYearId: currentAcademicYearId,
        classId: filters.classId || undefined,
        sectionId: filters.sectionId || undefined,
      }),
    enabled: activeTab === "completion" && Boolean(currentAcademicYearId),
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
    enabled: activeTab === "templates",
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

  const rawItems = homeworkQuery.data?.items ?? [];
  const dateFilteredItems = useClientDateFilter
    ? rawItems.filter(
        (item) => (item.assignedDate ?? "").slice(0, 10) === effectiveDate,
      )
    : rawItems;
  const homeworkItems = useClientDateFilter
    ? dateFilteredItems.slice(
        (Math.max(1, filters.page) - 1) * HOMEWORK_PAGE_SIZE,
        Math.max(1, filters.page) * HOMEWORK_PAGE_SIZE,
      )
    : dateFilteredItems;
  const homeworkMeta = useClientDateFilter
    ? {
        page: Math.max(1, filters.page),
        limit: HOMEWORK_PAGE_SIZE,
        total: dateFilteredItems.length,
        totalPages: Math.max(
          1,
          Math.ceil(dateFilteredItems.length / HOMEWORK_PAGE_SIZE),
        ),
      }
    : homeworkQuery.data?.meta
      ? {
          page: homeworkQuery.data.meta.page,
          limit: homeworkQuery.data.meta.limit,
          total: homeworkQuery.data.meta.total,
          totalPages: homeworkQuery.data.meta.totalPages,
        }
      : undefined;

  const hasActiveHomeworkFilters = Boolean(
    filters.classId ||
      filters.sectionId ||
      filters.subjectId ||
      filters.teacherId ||
      filters.status ||
      filters.search.trim() ||
      (activeTab === "all" && filters.date),
  );

  const needsFollowUpRows = (completionReportQuery.data ?? [])
    .filter((row: HomeworkCompletionReportRow) => row.completed < row.totalSubmissions)
    .sort((a, b) => a.completionRate - b.completionRate);

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

  function clearHomeworkFilters() {
    setFilters(
      {
        classId: "",
        sectionId: "",
        subjectId: "",
        teacherId: "",
        status: "",
        search: "",
        date: "",
        page: 1,
      },
      { resetPage: true },
    );
  }

  const columns = [
    {
      header: "Class",
      accessorKey: "class.name",
      cell: (row: HomeworkAssignmentSummary) => (
        <div className="flex flex-col">
          <span className="font-medium text-slate-700">
            {row.class?.name?.trim() || "Class not set"}
          </span>
          <span className="text-xs text-slate-500">
            {row.section?.name?.trim() || "All sections"}
          </span>
        </div>
      ),
    },
    {
      header: "Subject",
      accessorKey: "subject.name",
      cell: (row: HomeworkAssignmentSummary) => (
        <span className="text-sm font-medium text-slate-700">
          {row.subject?.name?.trim() || "Subject not set"}
        </span>
      ),
    },
    {
      header: "Homework",
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
      header: "Due date",
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
      header: "Teacher",
      cell: (row: HomeworkAssignmentSummary) => (
        <span className="text-sm text-slate-600">{teacherName(row)}</span>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row: HomeworkAssignmentSummary) => (
        <StatusBadge status={row.status || "DRAFT"} label={statusLabel(row.status)} />
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
        Give Homework
      </Button>
    </Link>
  ) : undefined;

  const isListTab = activeTab === "today" || activeTab === "all";

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
        title="Homework"
        description={`Give homework, track completion, and follow up on incomplete students${session?.tenant.name ? ` for ${session.tenant.name}` : ""}.`}
        primaryAction={primaryAction}
        moreActionItems={[
          {
            label: "Use template",
            icon: <FileText size={16} />,
            onClick: () => setActiveTab("templates"),
          },
          {
            label: "View homework calendar",
            icon: <Calendar size={16} />,
            disabled: true,
            onClick: () => {},
          },
          {
            label: "View incomplete students",
            icon: <Users size={16} />,
            onClick: () => setActiveTab("completion"),
          },
          {
            label: "Export homework report",
            icon: <BarChart3 size={16} />,
            onClick: () => setActiveTab("completion"),
          },
        ]}
      >
        <ModuleTabs
          items={[
            { value: "today", label: "Today", icon: Calendar },
            { value: "all", label: "All Homework", icon: BookOpen },
            { value: "completion", label: "Completion", icon: CheckCircle2 },
            { value: "templates", label: "Templates", icon: FileText },
          ]}
          activeValue={activeTab}
          onValueChange={(value) => setActiveTab(value as ActiveTab)}
          accentColor="blue"
          variant="light"
        />

        <KpiGrid className="mt-5 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            title="Given Today"
            value={summary?.givenToday ?? "Unavailable"}
            loading={summaryQuery.isLoading}
            icon={<BookOpen size={20} />}
            tone="info"
            description="Homework assigned with today's assigned date."
          />
          <KpiCard
            title="Due Today"
            value={summary?.dueToday ?? "Unavailable"}
            loading={summaryQuery.isLoading}
            icon={<Calendar size={20} />}
            tone="neutral"
            description="Published homework due by end of today."
          />
          <KpiCard
            title="Not Checked"
            value={summary?.notChecked ?? "Unavailable"}
            loading={summaryQuery.isLoading}
            icon={<ClipboardList size={20} />}
            tone={Number(summary?.notChecked) > 0 ? "warning" : "neutral"}
            description="Overdue homework with unchecked student rows."
          />
          <KpiCard
            title="Incomplete Students"
            value={summary?.incompleteStudents ?? "Unavailable"}
            loading={summaryQuery.isLoading}
            icon={<AlertCircle size={20} />}
            tone={Number(summary?.incompleteStudents) > 0 ? "warning" : "neutral"}
            description="Students with incomplete or missing homework due."
          />
          <KpiCard
            title="Classes Without Homework"
            value={summary?.classesWithoutHomework ?? "Unavailable"}
            loading={summaryQuery.isLoading}
            icon={<Users size={20} />}
            tone={Number(summary?.classesWithoutHomework) > 0 ? "warning" : "neutral"}
            description="Sections with no homework assigned today."
          />
        </KpiGrid>
      </ModuleHeader>

      {isListTab ? (
        <>
          <FilterBar>
            <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

              <Input
                type="date"
                value={filters.date || (activeTab === "today" ? todayIso() : "")}
                onChange={(e) =>
                  setFilters({ date: e.target.value }, { resetPage: true })
                }
                aria-label="Filter by date"
              />

              <Select
                value={filters.classId}
                onChange={(e) =>
                  setFilters(
                    { classId: e.target.value, sectionId: "" },
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
                  setFilters({ sectionId: e.target.value }, { resetPage: true })
                }
                disabled={!filters.classId}
                aria-label="Filter by section"
              >
                <option value="">All Sections</option>
                {sectionsQuery.data
                  ?.filter(
                    (s) => !filters.classId || s.classId === filters.classId,
                  )
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </Select>

              <Select
                value={filters.subjectId}
                onChange={(e) =>
                  setFilters({ subjectId: e.target.value }, { resetPage: true })
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
                value={filters.teacherId}
                onChange={(e) =>
                  setFilters({ teacherId: e.target.value }, { resetPage: true })
                }
                aria-label="Filter by teacher"
              >
                <option value="">All Teachers</option>
                {staffQuery.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName}
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
                <option value="ASSIGNED">Published</option>
                <option value="CLOSED">Closed</option>
                <option value="CANCELLED">Cancelled</option>
              </Select>
            </div>
          </FilterBar>

          <div className="space-y-6">
            <SectionCard
              title={activeTab === "today" ? "Today's homework" : "All homework"}
              description={
                activeTab === "today"
                  ? "Homework assigned on the selected date."
                  : "The full homework history for the filtered scope."
              }
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
                        : activeTab === "today"
                          ? "No homework given for this day yet"
                          : "No homework assignments yet"
                  }
                  description={
                    homeworkMeta && homeworkMeta.total > 0
                      ? "The shared link points past the available assignment pages. Return to the last available page."
                      : hasActiveHomeworkFilters
                        ? "Clear or adjust the filters while keeping your assignment scope protected by the backend."
                        : canCreateHomework
                          ? "Give the first homework assignment for an assigned class and subject."
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
                          Give Homework
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
          </div>
        </>
      ) : null}

      {activeTab === "completion" ? (
        <SectionCard
          title="Needs follow-up"
          description="Published homework with unchecked or incomplete student rows. Open an assignment to reach its completion register."
        >
          {!currentAcademicYearId ? (
            <EmptyState
              title="No academic year available"
              description="Completion follow-up requires at least one academic year to be configured."
              icon={<BarChart3 className="h-8 w-8" />}
            />
          ) : completionReportQuery.isLoading ? (
            <LoadingState label="Loading completion data..." />
          ) : completionReportQuery.isError ? (
            <ErrorState
              title="Unable to load completion data"
              message="The homework completion report could not be loaded from the backend."
              onRetry={() => void completionReportQuery.refetch()}
            />
          ) : needsFollowUpRows.length === 0 ? (
            <EmptyState
              title="Nothing needs follow-up"
              description="Every homework assignment in this scope is fully completed or checked."
              icon={<CheckCircle2 className="h-8 w-8" />}
            />
          ) : (
            <div className="space-y-2">
              {needsFollowUpRows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => router.push(`/dashboard/homework/${row.id}`)}
                  className="flex w-full items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-[var(--color-mod-homework-border)] hover:bg-[var(--color-mod-homework-bg)]"
                >
                  <div>
                    <p className="text-sm font-bold text-slate-950">
                      {row.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {row.class}
                      {row.section ? ` - ${row.section}` : ""} · {row.subject} ·
                      Due {formatDate(row.dueDate)}
                    </p>
                  </div>
                  <StatusBadge
                    status="INFO"
                    label={`${row.completed}/${row.totalSubmissions} · ${formatPercent(row.completionRate)}`}
                    tone={row.completionRate >= 80 ? "approved" : "pending"}
                  />
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}

      {activeTab === "templates" ? (
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
            <StatusBadge
              status={homework.status || "DRAFT"}
              label={statusLabel(homework.status)}
            />
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
            <QuickViewField label="Due" value={formatDateTime(homework.dueAt)} />
            <QuickViewField label="Teacher" value={teacherName(homework)} />
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
                          onClick={() => void onOpenAttachment(attachment.id)}
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

/* ------------------------------------------------------------------ */
/* Student / parent read-only view                                     */
/*                                                                       */
/* Absorbs components/timetable/tabs/student-homework-tab.tsx. That file */
/* is left in place for now (a later task deletes it once the register/  */
/* submission flow in homework-detail-page.tsx is confirmed to cover the */
/* same ground) but its protected-attachment download capability is      */
/* ported here so read-only viewers don't lose the ability to open files */
/* attached to their own/their child's homework.                         */
/* ------------------------------------------------------------------ */

function StudentHomeworkView() {
  const { session } = useSession();
  const router = useRouter();
  const isParent = session?.user.roles.includes("parent") ?? false;
  const [openingAttachmentId, setOpeningAttachmentId] = useState<string | null>(
    null,
  );
  const [notice, setNotice] = useState<{
    title: string;
    description?: string;
    tone: ToastTone;
  } | null>(null);

  const homeworkQuery = useQuery({
    queryKey: ["homework", "my-homework"],
    queryFn: () =>
      api.listHomeworkPage({
        sortBy: "dueDate",
        sortOrder: "desc",
        limit: 50,
      }),
  });

  if (
    homeworkQuery.error instanceof ApiRequestError &&
    homeworkQuery.error.statusCode === 403
  ) {
    return (
      <PermissionDenied
        showNavigation={false}
        title="Homework access restricted"
        description="Your account cannot view homework in this school."
      />
    );
  }

  const items = homeworkQuery.data?.items ?? [];

  async function openAttachment(attachmentId: string) {
    setOpeningAttachmentId(attachmentId);
    try {
      await api.openHomeworkAttachmentDownload(attachmentId);
    } catch {
      setNotice({
        title: "Attachment unavailable",
        description:
          "This file could not be opened. It may still be processing or no longer available.",
        tone: "danger",
      });
    } finally {
      setOpeningAttachmentId(null);
    }
  }

  const columns = [
    {
      header: "Homework",
      cell: (row: HomeworkAssignmentSummary) => (
        <div className="flex flex-col">
          <button
            type="button"
            className="w-fit text-left font-bold text-slate-900 hover:text-[var(--color-mod-homework-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mod-homework-border)]"
            onClick={() => router.push(`/dashboard/homework/${row.id}`)}
          >
            {row.title}
          </button>
          <span className="text-xs text-slate-500">
            {row.class?.name?.trim() || "Class not set"}
            {row.section?.name?.trim() ? ` · ${row.section.name.trim()}` : ""}
          </span>
        </div>
      ),
    },
    {
      header: "Subject",
      cell: (row: HomeworkAssignmentSummary) => (
        <span className="text-sm font-medium text-slate-700">
          {row.subject?.name?.trim() || "Subject not set"}
        </span>
      ),
    },
    {
      header: "Due date",
      cell: (row: HomeworkAssignmentSummary) => (
        <span className="text-sm text-slate-700">
          {formatDate(row.dueAt)}
        </span>
      ),
    },
    {
      header: "Teacher",
      cell: (row: HomeworkAssignmentSummary) => (
        <span className="text-sm text-slate-600">{teacherName(row)}</span>
      ),
    },
    {
      header: "Status",
      cell: (row: HomeworkAssignmentSummary) => (
        <StatusBadge status={row.status || "DRAFT"} label={statusLabel(row.status)} />
      ),
    },
    {
      header: "Attachments",
      cell: (row: HomeworkAssignmentSummary) =>
        row.attachments?.length ? (
          <div className="flex flex-col gap-1">
            {row.attachments.map((attachment) => {
              const file = attachment.fileAsset;
              const isAvailable = file?.status === "UPLOADED";
              return (
                <button
                  key={attachment.id}
                  type="button"
                  data-testid="student-homework-attachment-download"
                  disabled={
                    !isAvailable || openingAttachmentId === attachment.id
                  }
                  onClick={() => void openAttachment(attachment.id)}
                  className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-mod-homework-text)] hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
                >
                  <FileText className="h-3.5 w-3.5" />
                  {openingAttachmentId === attachment.id
                    ? "Opening..."
                    : file?.originalFilename?.trim() || "Attachment"}
                </button>
              );
            })}
          </div>
        ) : (
          <span className="text-xs text-slate-400">None</span>
        ),
    },
  ];

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
        title="Homework"
        description={`Homework assigned to ${isParent ? "your child" : "you"}${session?.tenant.name ? ` at ${session.tenant.name}` : ""}.`}
      />

      <SectionCard
        title="Homework"
        description="A read-only list of published homework. Open an assignment to see full instructions."
      >
        {homeworkQuery.isLoading ? (
          <LoadingState label="Loading homework..." />
        ) : homeworkQuery.isError ? (
          <ErrorState
            title="Unable to load homework"
            message="Homework could not be loaded. Please retry in a moment."
            onRetry={() => void homeworkQuery.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="No homework yet"
            description="Published homework will appear here as soon as a teacher assigns it."
            icon={<BookOpen className="h-8 w-8" />}
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-100">
            <DataTable
              columns={columns}
              data={items}
              getRowKey={(row) => row.id}
              className="rounded-none border-0"
            />
          </div>
        )}
      </SectionCard>
    </DashboardPageShell>
  );
}
