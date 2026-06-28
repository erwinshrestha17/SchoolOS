"use client";

import { api } from "../../lib/api";
import { formatBsDateTime } from "@schoolos/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  Bell,
  CheckCheck,
  ExternalLink,
  Inbox,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { NotificationBadge } from "../ui/notification-badge";

type NotificationBellProps = {
  enabled: boolean;
};

export function NotificationBell({ enabled }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const centerQuery = useQuery({
    queryKey: ["notification-center"],
    queryFn: api.getNotificationCenter,
    enabled,
    refetchInterval: 60_000,
  });

  const markReadMutation = useMutation({
    mutationFn: api.markNotificationRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notification-center"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: api.markAllNotificationsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notification-center"] });
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

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const unreadCount = centerQuery.data?.unreadCount ?? 0;
  const items = centerQuery.data?.items ?? [];
  const hasUnread = unreadCount > 0;
  const isRefreshing = centerQuery.isFetching && !centerQuery.isLoading;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="relative flex h-11 w-11 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label={
          hasUnread
            ? `Notifications, ${unreadCount} unread`
            : "Notifications, all caught up"
        }
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
          className="absolute right-0 top-full z-50 mt-2 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg"
          data-testid="notification-panel"
          role="dialog"
          aria-label="Notification center"
        >
          <div className="border-b border-gray-100 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Notification center
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {hasUnread
                    ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"} need attention`
                    : "All caught up for now"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={centerQuery.isFetching}
                  aria-label="Refresh notifications"
                  onClick={() => void centerQuery.refetch()}
                >
                  {isRefreshing ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                </button>
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[var(--primary-dark)] transition hover:bg-[var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-50"
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
            </div>
          </div>

          <div className="max-h-[430px] overflow-y-auto py-2">
            {centerQuery.isLoading ? (
              <PanelMessage
                icon={<Loader2 size={18} className="animate-spin" />}
                title="Loading notifications"
                body="Checking notices, attendance alerts, fees, and activity updates."
              />
            ) : centerQuery.isError ? (
              <div className="px-4 py-6">
                <div className="rounded-2xl border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700">
                  <div className="flex gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      <p className="font-semibold">
                        Could not load notifications
                      </p>
                      <p className="mt-1 text-xs leading-5 text-danger-600">
                        Please refresh the panel. If the issue continues, check
                        your session or network connection.
                      </p>
                      <button
                        type="button"
                        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-danger-700 shadow-sm hover:bg-danger-100"
                        onClick={() => void centerQuery.refetch()}
                      >
                        <RefreshCw size={13} />
                        Try again
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : items.length === 0 ? (
              <PanelMessage
                icon={<Inbox size={18} />}
                title="No notifications yet"
                body="Notices, attendance alerts, fees, and activity updates will appear here."
              />
            ) : (
              items.map((item) => (
                <Link
                  key={item.id}
                  href={item.linkHref}
                  className={`group block border-b border-gray-50 px-4 py-3 transition-colors last:border-b-0 hover:bg-gray-50 ${
                    item.isRead ? "bg-white" : "bg-[var(--primary-soft)]"
                  }`}
                  onClick={() => {
                    if (!item.isRead && !markReadMutation.isPending) {
                      markReadMutation.mutate(item.id);
                    }
                    setOpen(false);
                  }}
                >
                  <div className="flex gap-3">
                    <span
                      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                        item.isRead ? "bg-gray-200" : "bg-[var(--primary)]"
                      }`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-1 text-sm font-semibold text-gray-900">
                          {item.title}
                        </p>
                        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[0.65rem] font-semibold uppercase text-gray-500">
                          {formatChannel(item.channel)}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-600">
                        {item.body}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2 text-[0.68rem] text-gray-400">
                        <span>{formatDateTime(item.createdAt)}</span>
                        <span className="inline-flex items-center gap-1 font-medium text-[var(--primary-dark)] opacity-0 transition group-hover:opacity-100">
                          Open
                          <ExternalLink size={11} />
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
            <Link
              href="/dashboard/notices"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[var(--primary-dark)] shadow-sm ring-1 ring-gray-200 transition hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]"
              onClick={() => setOpen(false)}
            >
              View notices and deliveries
              <ExternalLink size={13} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

type PanelMessageProps = {
  icon: ReactNode;
  title: string;
  body: string;
};

function PanelMessage({ icon, title, body }: PanelMessageProps) {
  return (
    <div className="px-4 py-8 text-center text-gray-500">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-100 text-gray-500">
        {icon}
      </div>
      <p className="mt-3 text-sm font-semibold text-gray-900">{title}</p>
      <p className="mx-auto mt-1 max-w-[260px] text-xs leading-5 text-gray-500">
        {body}
      </p>
    </div>
  );
}

function formatChannel(value: string) {
  return value.replace(/_/g, " ");
}

function formatDateTime(value: string) {
  return formatBsDateTime(value);
}
