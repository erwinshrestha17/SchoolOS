'use client';

import {
  NOTIFICATION_PREFERENCE_CATEGORIES,
  formatBsDateTime,
  type NotificationPreferenceCategory,
  type PermissionKey,
} from '@schoolos/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import type { NotificationCenterItem } from '@/lib/api/client';
import { communicationsApi } from '@/lib/api/communications';
import { useSession } from '@/components/session-provider';
import { DashboardPageShell } from '@/components/dashboard/dashboard-page-shell';
import {
  PaginatedDataTable,
  type PaginatedDataTableColumn,
} from '@/components/schoolos/data/paginated-data-table';
import { FilterBar } from '@/components/ui/filter-bar';
import { ModuleHeader } from '@/components/ui/module-header';
import { StatusBadge } from '@/components/ui/status-badge';

const PAGE_SIZE = 25;

export function NotificationCenterWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const permissions = new Set<PermissionKey>(session?.user.permissions ?? []);
  const canView = permissions.has('notifications:view_own');
  const page = positiveNumber(searchParams.get('page'), 1);
  const readStatus = (searchParams.get('readStatus') ?? 'ALL') as
    | 'ALL'
    | 'READ'
    | 'UNREAD';
  const category = searchParams.get(
    'category',
  ) as NotificationPreferenceCategory | null;

  const centerQuery = useQuery({
    queryKey: ['notification-center', { page, readStatus, category }],
    queryFn: () =>
      communicationsApi.getNotificationCenterPage({
        page,
        limit: PAGE_SIZE,
        readStatus,
        category: category ?? undefined,
      }),
    enabled: canView,
  });

  const markRead = useMutation({
    mutationFn: communicationsApi.markNotificationRead,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['notification-center'] }),
  });
  const markAllRead = useMutation({
    mutationFn: communicationsApi.markAllNotificationsRead,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['notification-center'] }),
  });

  function setFilters(next: Record<string, string | number | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === '' || value === 'ALL' || value === 1)
        params.delete(key);
      else params.set(key, String(value));
    }
    router.replace(
      `${pathname}${params.size > 0 ? `?${params.toString()}` : ''}`,
    );
  }

  const columns = useMemo<PaginatedDataTableColumn<NotificationCenterItem>[]>(
    () => [
      {
        id: 'notification',
        header: 'Notification',
        cell: (item) => (
          <div className="min-w-0">
            <p className="font-semibold text-slate-950">{item.title}</p>
            <p className="mt-1 line-clamp-2 text-sm text-slate-600">
              {item.body}
            </p>
          </div>
        ),
      },
      {
        id: 'category',
        header: 'Category',
        hideBelow: 'sm',
        cell: (item) => (
          <StatusBadge status={item.category} label={label(item.category)} />
        ),
      },
      {
        id: 'state',
        header: 'State',
        cell: (item) => (
          <StatusBadge
            status={item.isRead ? 'READ' : 'UNREAD'}
            label={item.isRead ? 'Read' : 'Unread'}
          />
        ),
      },
      {
        id: 'time',
        header: 'Received',
        hideBelow: 'md',
        cell: (item) => formatBsDateTime(item.createdAt),
      },
    ],
    [],
  );

  return (
    <DashboardPageShell>
      <ModuleHeader
        eyebrow="Notifications"
        title="Notification center"
        description="Review your school notifications. Opening a source record always checks your current access again."
        metadata={
          centerQuery.data ? (
            <StatusBadge
              status="UNREAD"
              label={`${centerQuery.data.unreadCount} unread`}
            />
          ) : undefined
        }
        primaryAction={
          canView && (centerQuery.data?.unreadCount ?? 0) > 0 ? (
            <button
              type="button"
              disabled={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              <CheckCheck size={16} />{' '}
              {markAllRead.isPending ? 'Marking…' : 'Mark all read'}
            </button>
          ) : null
        }
      />

      <FilterBar
        label="Notification filters"
        description="Filters and totals are applied by the server."
        filterSlot={
          <>
            <FilterSelect
              label="Read state"
              value={readStatus}
              options={['ALL', 'UNREAD', 'READ']}
              onChange={(value) =>
                setFilters({ readStatus: value, page: null })
              }
            />
            <FilterSelect
              label="Category"
              value={category ?? ''}
              options={['', ...NOTIFICATION_PREFERENCE_CATEGORIES]}
              onChange={(value) => setFilters({ category: value, page: null })}
            />
          </>
        }
      />

      {markRead.isError || markAllRead.isError ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          The read state could not be updated. The notification remains
          available.
        </p>
      ) : null}

      <PaginatedDataTable
        columns={columns}
        items={centerQuery.data?.items ?? []}
        getRowId={(item) => item.id}
        status={
          !canView
            ? 'permission-denied'
            : centerQuery.isLoading
              ? 'loading'
              : centerQuery.isError
                ? 'error'
                : 'ready'
        }
        page={centerQuery.data?.page ?? page}
        pageSize={centerQuery.data?.limit ?? PAGE_SIZE}
        totalItems={centerQuery.data?.total ?? 0}
        onPageChange={(nextPage) => setFilters({ page: nextPage })}
        hasActiveFilters={readStatus !== 'ALL' || Boolean(category)}
        emptyTitle="No notifications yet"
        emptyDescription="Notifications addressed to you will appear here."
        noResultsTitle="No notifications match these filters"
        noResultsDescription="Change the read state or category filter."
        errorMessage="Your notification center could not be loaded."
        onRetry={() => void centerQuery.refetch()}
        rowActions={(item) => (
          <div className="flex justify-end gap-2">
            {!item.isRead ? (
              <button
                type="button"
                disabled={markRead.isPending}
                onClick={() => markRead.mutate(item.id)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
              >
                Mark read
              </button>
            ) : null}
            <Link
              href={safeDashboardHref(item.linkHref)}
              onClick={() => {
                if (!item.isRead) markRead.mutate(item.id);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
            >
              Open <ExternalLink size={13} />
            </Link>
          </div>
        )}
        caption={
          <caption className="sr-only">
            Server-paginated notification center.
          </caption>
        }
      />

      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <Bell size={18} className="mt-0.5 shrink-0" />
        Read state only records that you opened a notification. A notice
        acknowledgement is a separate explicit action.
      </div>
    </DashboardPageShell>
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
        className="min-h-10 min-w-36"
      >
        {options.map((option) => (
          <option key={option || 'ALL'} value={option}>
            {option ? label(option) : 'All categories'}
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

function safeDashboardHref(href: string) {
  return href.startsWith('/dashboard/') ? href : '/dashboard/notifications';
}

function label(value: string) {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^./, (letter) => letter.toUpperCase());
}
