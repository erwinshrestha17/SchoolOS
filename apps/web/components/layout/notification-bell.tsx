'use client';

import { api, type NotificationCenterSummary } from '../../lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { NotificationBadge } from '../ui/notification-badge';

type NotificationBellProps = {
  enabled: boolean;
};

export function NotificationBell({ enabled }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const centerQuery = useQuery({
    queryKey: ['notification-center'],
    queryFn: api.getNotificationCenter,
    enabled,
    refetchInterval: 60_000,
  });

  const markReadMutation = useMutation({
    mutationFn: api.markNotificationRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notification-center'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: api.markAllNotificationsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notification-center'] });
    },
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = centerQuery.data?.unreadCount ?? 0;
  const items = centerQuery.data?.items ?? [];

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="relative flex h-11 w-11 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={!enabled}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={20} />
        <NotificationBadge count={unreadCount} className="notification-badge" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl"
          data-testid="notification-panel"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Notifications
              </p>
              <p className="text-xs text-gray-500">
                {unreadCount > 0
                   ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}`
                   : 'All caught up'}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={unreadCount === 0 || markAllReadMutation.isPending}
              onClick={() => markAllReadMutation.mutate()}
            >
              {markAllReadMutation.isPending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <CheckCheck size={13} />
              )}
              Mark all
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto py-2">
            {centerQuery.isLoading ? (
              <div className="flex items-center gap-2 px-4 py-6 text-sm text-gray-500">
                <Loader2 size={16} className="animate-spin" />
                Loading notifications...
              </div>
            ) : centerQuery.isError ? (
              <div className="px-4 py-6 text-sm text-danger-600">
                Could not load notifications. Please try again.
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-medium text-gray-900">
                  No notifications yet
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Notices, attendance alerts, fees and activity updates will
                  appear here.
                </p>
              </div>
            ) : (
              items.map((item) => (
                <Link
                  key={item.id}
                  href={item.linkHref}
                  className={`block border-b border-gray-50 px-4 py-3 transition-colors last:border-b-0 hover:bg-gray-50 ${
                    item.isRead ? 'bg-white' : 'bg-primary-50/50'
                  }`}
                  onClick={() => {
                    if (!item.isRead) {
                      markReadMutation.mutate(item.id);
                    }
                    setOpen(false);
                  }}
                >
                  <div className="flex gap-3">
                    <span
                      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                        item.isRead ? 'bg-gray-200' : 'bg-primary-500'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-1 text-sm font-semibold text-gray-900">
                          {item.title}
                        </p>
                        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[0.65rem] font-semibold uppercase text-gray-500">
                          {item.channel}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-600">
                        {item.body}
                      </p>
                      <p className="mt-2 text-[0.68rem] text-gray-400">
                        {formatDateTime(item.createdAt)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-right">
            <Link
              href="/dashboard/notices"
              className="text-xs font-semibold text-primary-700 hover:text-primary-800"
              onClick={() => setOpen(false)}
            >
              View notices and deliveries
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}
