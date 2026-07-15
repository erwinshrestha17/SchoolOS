"use client";

import {
  NOTICE_LIFECYCLE_STATUSES,
  formatBsDateTime,
  type NoticeLifecycleStatus,
  type NoticeSummary,
  type PermissionKey,
} from "@schoolos/core";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { communicationsApi } from "@/lib/api/communications";
import {
  PaginatedDataTable,
  type PaginatedDataTableColumn,
} from "@/components/schoolos/data/paginated-data-table";
import { FilterBar } from "@/components/ui/filter-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { useSession } from "@/components/session-provider";

const PAGE_SIZE = 25;
const priorities = ["NORMAL", "URGENT", "EMERGENCY"] as const;
const audiences = ["ALL", "CLASS", "SECTION"] as const;

export function NoticeListWorkspace({
  fixedLifecycleStatus,
}: {
  fixedLifecycleStatus?: NoticeLifecycleStatus;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { session } = useSession();
  const permissions = new Set<PermissionKey>(session?.user.permissions ?? []);
  const canRead = permissions.has("notices:read");
  const page = positiveNumber(searchParams.get("page"), 1);
  const search = searchParams.get("search") ?? "";
  const priority = searchParams.get("priority") ?? "";
  const audienceType = searchParams.get("audienceType") ?? "";
  const lifecycleStatus =
    fixedLifecycleStatus ??
    (searchParams.get("lifecycleStatus") as NoticeLifecycleStatus | null) ??
    "";
  const [searchDraft, setSearchDraft] = useState(search);

  const noticesQuery = useQuery({
    queryKey: [
      "notices",
      { page, search, priority, audienceType, lifecycleStatus },
    ],
    queryFn: () =>
      communicationsApi.listNoticePage({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        priority: priority || undefined,
        audienceType: audienceType || undefined,
        lifecycleStatus: lifecycleStatus || undefined,
      }),
    enabled: canRead,
  });

  function setFilters(next: Record<string, string | number | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "" || value === 1) params.delete(key);
      else params.set(key, String(value));
    }
    router.replace(`${pathname}${params.size ? `?${params}` : ""}`);
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setFilters({ search: searchDraft.trim(), page: null });
  }

  const columns = useMemo<PaginatedDataTableColumn<NoticeSummary>[]>(
    () => [
      {
        id: "title",
        header: "Notice",
        cell: (notice) => (
          <div className="min-w-0">
            <Link
              href={`/dashboard/notices/${notice.id}`}
              className="font-semibold text-slate-950 hover:text-[var(--color-mod-notices-text)]"
            >
              {notice.title}
            </Link>
            <p className="mt-1 text-xs text-slate-500">
              {audienceLabel(notice)}
            </p>
          </div>
        ),
      },
      {
        id: "priority",
        header: "Priority",
        cell: (notice) => (
          <StatusBadge
            status={notice.priority}
            label={label(notice.priority)}
          />
        ),
      },
      {
        id: "lifecycle",
        header: "Lifecycle",
        cell: (notice) => (
          <StatusBadge
            status={notice.lifecycleStatus}
            label={label(notice.lifecycleStatus)}
          />
        ),
      },
      {
        id: "author",
        header: "Author",
        hideBelow: "md",
        cell: (notice) => notice.createdBy?.email ?? "Author unavailable",
      },
      {
        id: "delivery",
        header: "Delivery / acknowledgements",
        hideBelow: "lg",
        cell: (notice) => (
          <span className="text-sm text-slate-600">
            {notice.deliveryCount ?? 0} delivery rows ·{" "}
            {notice.acknowledgementCount ?? 0} acknowledged
          </span>
        ),
      },
      {
        id: "time",
        header: "Scheduled / published",
        hideBelow: "sm",
        cell: (notice) => formatNoticeTime(notice),
      },
    ],
    [],
  );

  const hasActiveFilters = Boolean(
    search ||
    priority ||
    audienceType ||
    (!fixedLifecycleStatus && lifecycleStatus),
  );

  return (
    <div className="space-y-4" data-testid="notice-list-workspace">
      <FilterBar
        label="Notice filters"
        description="The server applies these filters to the full notice record set."
        searchSlot={
          <form onSubmit={submitSearch} className="flex min-w-0 gap-2">
            <label className="sr-only" htmlFor="notice-search">
              Search notices
            </label>
            <input
              id="notice-search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search title or message"
              className="min-h-11 min-w-0 flex-1"
            />
            <button
              type="submit"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700"
            >
              <Search size={16} /> Search
            </button>
          </form>
        }
        filterSlot={
          <div className="flex flex-wrap gap-2">
            <FilterSelect
              label="Priority"
              value={priority}
              options={priorities}
              onChange={(value) => setFilters({ priority: value, page: null })}
            />
            <FilterSelect
              label="Audience"
              value={audienceType}
              options={audiences}
              onChange={(value) =>
                setFilters({ audienceType: value, page: null })
              }
            />
            {!fixedLifecycleStatus ? (
              <FilterSelect
                label="Lifecycle"
                value={lifecycleStatus}
                options={NOTICE_LIFECYCLE_STATUSES}
                onChange={(value) =>
                  setFilters({ lifecycleStatus: value, page: null })
                }
              />
            ) : null}
          </div>
        }
        actionSlot={
          hasActiveFilters ? (
            <button
              type="button"
              onClick={() => {
                setSearchDraft("");
                router.replace(pathname);
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700"
            >
              <SlidersHorizontal size={16} /> Clear
            </button>
          ) : null
        }
      />

      <PaginatedDataTable
        columns={columns}
        items={noticesQuery.data?.items ?? []}
        getRowId={(notice) => notice.id}
        status={
          !canRead
            ? "permission-denied"
            : noticesQuery.isLoading
              ? "loading"
              : noticesQuery.isError
                ? "error"
                : "ready"
        }
        page={noticesQuery.data?.page ?? page}
        pageSize={noticesQuery.data?.limit ?? PAGE_SIZE}
        totalItems={noticesQuery.data?.total ?? 0}
        onPageChange={(nextPage) => setFilters({ page: nextPage })}
        hasActiveFilters={hasActiveFilters}
        emptyTitle="No notices yet"
        emptyDescription="Create a draft to begin the school notice workflow."
        noResultsTitle="No notices match these filters"
        noResultsDescription="Clear one or more filters to widen the result set."
        errorMessage="Notices could not be loaded. Your current filters have been preserved."
        onRetry={() => void noticesQuery.refetch()}
        caption={
          <caption className="sr-only">
            Server-paginated notices. Total records:{" "}
            {noticesQuery.data?.total ?? 0}.
          </caption>
        }
      />
    </div>
  );
}

function FilterSelect({
  label: filterLabel,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-slate-600">
      {filterLabel}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 min-w-40"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {filterLabel === "Audience" && option === "ALL"
              ? "Whole school"
              : label(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function positiveNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function audienceLabel(notice: NoticeSummary) {
  if (notice.audienceType === "SECTION") {
    return notice.sectionName
      ? `${notice.className ?? "Class"} · ${notice.sectionName}`
      : "Selected section";
  }
  if (notice.audienceType === "CLASS") {
    return notice.className ?? "Selected class";
  }
  return "Whole school";
}

function formatNoticeTime(notice: NoticeSummary) {
  if (notice.lifecycleStatus === "SCHEDULED" && notice.scheduledFor) {
    return `Scheduled ${formatBsDateTime(notice.scheduledFor)}`;
  }
  if (notice.publishedAt) {
    return `Published ${formatBsDateTime(notice.publishedAt)}`;
  }
  return notice.createdAt
    ? `Created ${formatBsDateTime(notice.createdAt)}`
    : "Time unavailable";
}

function label(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}
