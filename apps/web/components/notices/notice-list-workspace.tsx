'use client';

import {
  NOTICE_LIFECYCLE_STATUSES,
  formatBsDateTime,
  type NoticeLifecycleStatus,
  type NoticeSummary,
} from '@schoolos/core';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { communicationsApi } from '@/lib/api/communications';
import {
  DataWorkspace,
  type PaginatedDataTableColumn,
} from '@/components/schoolos';
import {
  parseDensity,
  parseHiddenColumns,
  serializeHiddenColumns,
} from '@/lib/workspace-view-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { useSession } from '@/components/session-provider';
import { hasAnyPermission } from '@/lib/session';

const PAGE_SIZE = 25;
const priorities = ['NORMAL', 'URGENT', 'EMERGENCY'] as const;
const audiences = ['ALL', 'CLASS', 'SECTION'] as const;

export function NoticeListWorkspace({
  fixedLifecycleStatus,
}: {
  fixedLifecycleStatus?: NoticeLifecycleStatus;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { session } = useSession();
  const isSupportOverride = session?.user.isSupportOverride === true;
  const canRead = hasAnyPermission(session, ['notices:read']);
  const page = positiveNumber(searchParams.get('page'), 1);
  const search = searchParams.get('search') ?? '';
  const priority = searchParams.get('priority') ?? '';
  const audienceType = searchParams.get('audienceType') ?? '';
  const lifecycleStatus = isSupportOverride
    ? ''
    : (fixedLifecycleStatus ??
      (searchParams.get('lifecycleStatus') as NoticeLifecycleStatus | null) ??
      '');

  const noticesQuery = useQuery({
    queryKey: [
      'notices',
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
      if (value === null || value === '' || value === 1) params.delete(key);
      else params.set(key, String(value));
    }
    router.replace(`${pathname}${params.size ? `?${params}` : ''}`, {
      scroll: false,
    });
  }

  const columns = useMemo<PaginatedDataTableColumn<NoticeSummary>[]>(
    () => [
      {
        id: 'title',
        header: 'Notice',
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
        id: 'priority',
        header: 'Priority',
        cell: (notice) => (
          <StatusBadge
            status={notice.priority}
            label={label(notice.priority)}
          />
        ),
      },
      {
        id: 'lifecycle',
        header: 'Lifecycle',
        cell: (notice) => (
          <StatusBadge
            status={notice.lifecycleStatus}
            label={label(notice.lifecycleStatus)}
          />
        ),
      },
      ...(!isSupportOverride
        ? [
            {
              id: 'author',
              header: 'Author',
              hideBelow: 'md' as const,
              cell: (notice: NoticeSummary) =>
                notice.createdBy?.email ?? 'Author unavailable',
            },
          ]
        : []),
      {
        id: 'delivery',
        header: 'Delivery / acknowledgements',
        hideBelow: 'lg',
        cell: (notice) => (
          <span className="text-sm text-slate-600">
            {notice.deliveryCount ?? 0} delivery rows ·{' '}
            {notice.acknowledgementCount ?? 0} acknowledged
          </span>
        ),
      },
      {
        id: 'time',
        header: 'Scheduled / published',
        hideBelow: 'sm',
        cell: (notice) => formatNoticeTime(notice),
      },
    ],
    [isSupportOverride],
  );

  const hasActiveFilters = Boolean(
    search ||
    priority ||
    audienceType ||
    (!fixedLifecycleStatus && !isSupportOverride && lifecycleStatus),
  );

  const activeFilterChips = [
    search
      ? {
          key: 'search',
          label: `Search: ${search}`,
          onRemove: () => setFilters({ search: null, page: null }),
        }
      : null,
    priority
      ? {
          key: 'priority',
          label: `Priority: ${label(priority)}`,
          onRemove: () => setFilters({ priority: null, page: null }),
        }
      : null,
    audienceType
      ? {
          key: 'audienceType',
          label: `Audience: ${
            audienceType === 'ALL' ? 'Whole school' : label(audienceType)
          }`,
          onRemove: () => setFilters({ audienceType: null, page: null }),
        }
      : null,
    !fixedLifecycleStatus && !isSupportOverride && lifecycleStatus
      ? {
          key: 'lifecycleStatus',
          label: `Lifecycle: ${label(lifecycleStatus)}`,
          onRemove: () => setFilters({ lifecycleStatus: null, page: null }),
        }
      : null,
  ].filter((chip): chip is NonNullable<typeof chip> => chip !== null);

  const allColumnOptions = columns.map((column) => ({
    id: column.id,
    label: typeof column.header === 'string' ? column.header : column.id,
    // The notice title identifies the row and always stays visible.
    hideable: column.id !== 'title',
  }));
  const density = parseDensity(searchParams.get('density'));
  const hiddenColumnIds = parseHiddenColumns(
    searchParams.get('cols'),
    allColumnOptions,
  );
  const clearFilters = () => {
    const params = new URLSearchParams();
    // View preferences are not filters; keep them when clearing.
    for (const key of ['density', 'cols']) {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    }
    router.replace(`${pathname}${params.size ? `?${params}` : ''}`, {
      scroll: false,
    });
  };

  return (
    <div data-testid="notice-list-workspace" className="p-gutter-compact">
      <DataWorkspace<NoticeSummary>
        description={
          isSupportOverride
            ? 'The server applies these filters only to published or expired notices in the selected school.'
            : 'The server applies these filters to the full notice record set.'
        }
        search={{
          value: search,
          onChange: (value) => setFilters({ search: value.trim(), page: null }),
          label: 'Search notices',
          placeholder: 'Search title or message',
          debounceMs: 400,
        }}
        filters={
          <>
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
            {!fixedLifecycleStatus && !isSupportOverride ? (
              <FilterSelect
                label="Lifecycle"
                value={lifecycleStatus}
                options={NOTICE_LIFECYCLE_STATUSES}
                onChange={(value) =>
                  setFilters({ lifecycleStatus: value, page: null })
                }
              />
            ) : null}
          </>
        }
        chips={activeFilterChips}
        onClearFilters={hasActiveFilters ? clearFilters : undefined}
        columnOptions={allColumnOptions}
        hiddenColumnIds={hiddenColumnIds}
        onHiddenColumnIdsChange={(hidden) =>
          setFilters({ cols: serializeHiddenColumns(hidden) || null })
        }
        density={density}
        onDensityChange={(next) =>
          setFilters({ density: next === 'compact' ? 'compact' : null })
        }
        onRefresh={canRead ? () => void noticesQuery.refetch() : undefined}
        isRefreshing={noticesQuery.isFetching && !noticesQuery.isLoading}
        refreshError={
          noticesQuery.isError && noticesQuery.data
            ? 'Notices could not be refreshed.'
            : null
        }
        table={{
          columns,
          items: noticesQuery.data?.items ?? [],
          getRowId: (notice) => notice.id,
          status: !canRead
            ? 'permission-denied'
            : noticesQuery.isLoading
              ? 'loading'
              : noticesQuery.isError && !noticesQuery.data
                ? 'error'
                : 'ready',
          page: noticesQuery.data?.page ?? page,
          pageSize: noticesQuery.data?.limit ?? PAGE_SIZE,
          totalItems: noticesQuery.data?.total ?? 0,
          onPageChange: (nextPage) => setFilters({ page: nextPage }),
          emptyTitle: 'No notices yet',
          emptyDescription: isSupportOverride
            ? 'No published notices are available in this support scope.'
            : 'Create a draft to begin the school notice workflow.',
          noResultsTitle: 'No notices match these filters',
          noResultsDescription:
            'Clear one or more filters to widen the result set.',
          errorMessage:
            'Notices could not be loaded. Your current filters have been preserved.',
          onRetry: () => void noticesQuery.refetch(),
          caption: (
            <caption className="sr-only">
              Notices matching the current filters. Total records:{' '}
              {noticesQuery.data?.total ?? 0}.
            </caption>
          ),
        }}
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
            {filterLabel === 'Audience' && option === 'ALL'
              ? 'Whole school'
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
  if (notice.audienceType === 'SECTION') {
    return notice.sectionName
      ? `${notice.className ?? 'Class'} · ${notice.sectionName}`
      : 'Selected section';
  }
  if (notice.audienceType === 'CLASS') {
    return notice.className ?? 'Selected class';
  }
  return 'Whole school';
}

function formatNoticeTime(notice: NoticeSummary) {
  if (notice.lifecycleStatus === 'SCHEDULED' && notice.scheduledFor) {
    return `Scheduled ${formatBsDateTime(notice.scheduledFor)}`;
  }
  if (notice.publishedAt) {
    return `Published ${formatBsDateTime(notice.publishedAt)}`;
  }
  return notice.createdAt
    ? `Created ${formatBsDateTime(notice.createdAt)}`
    : 'Time unavailable';
}

function label(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}
