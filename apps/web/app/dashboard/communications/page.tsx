'use client';

import type { PermissionKey } from '@schoolos/core';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  FileText,
  Mail,
  MessageSquare,
  Plus,
  Send,
  Settings,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DashboardPageShell } from '@/components/dashboard/dashboard-page-shell';
import { ModuleHeader } from '@/components/ui/module-header';
import { KpiCard, KpiGrid } from '@/components/ui/kpi-card';
import { ModuleTabs } from '@/components/ui/module-tabs';
import { SectionCard } from '@/components/ui/section-card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { PermissionDenied } from '@/components/ui/permission-denied';
import { StatusBadge } from '@/components/ui/status-badge';
import { useSession } from '@/components/session-provider';
import { communicationsApi } from '@/lib/api/communications';
import { messagingApi } from '@/lib/api/messaging';

export default function CommunicationsPage() {
  const router = useRouter();
  const { session } = useSession();
  const granted = new Set<PermissionKey>(session?.user.permissions ?? []);
  const canReadNotices = granted.has('notices:read');
  const canCreateNotices = granted.has('notices:create');
  const canUseChat = granted.has('messaging:create');
  const canReadDeliveries = granted.has('communications:read_deliveries');
  const canManageTemplates = granted.has('communications:manage_templates');

  const summaryQuery = useQuery({
    queryKey: ['communications-hub', 'summary'],
    queryFn: communicationsApi.getCommunicationsSummary,
    enabled: canReadNotices,
  });
  const noticesQuery = useQuery({
    queryKey: ['communications-hub', 'notices'],
    queryFn: communicationsApi.listNotices,
    enabled: canReadNotices,
  });
  const threadsQuery = useQuery({
    queryKey: ['communications-hub', 'chat-threads'],
    queryFn: () =>
      messagingApi.listParentTeacherThreads({ page: '1', limit: '5' }),
    enabled: canUseChat,
  });

  const notices = noticesQuery.data ?? [];
  const threads = threadsQuery.data?.items ?? [];
  const summary = summaryQuery.data;

  return (
    <DashboardPageShell>
      <ModuleHeader
        title="Notices & Communication"
        description="Send notices, manage recipients, review delivery status, and handle parent-teacher chat."
        primaryAction={
          canCreateNotices ? (
            <Link
              href="/dashboard/notices/new"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-mod-notices-accent)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-mod-notices-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-notices-border)] focus:ring-offset-2"
            >
              <Plus className="h-4 w-4" />
              Create Notice
            </Link>
          ) : undefined
        }
        moreActionItems={[
          ...(canReadNotices
            ? [
                {
                  label: 'Delivery Logs',
                  icon: <Send className="h-4 w-4" />,
                  onClick: () => router.push('/dashboard/notices/deliveries'),
                },
              ]
            : []),
          ...(canUseChat
            ? [
                {
                  label: 'Chat Inbox',
                  icon: <MessageSquare className="h-4 w-4" />,
                  onClick: () => router.push('/dashboard/messages'),
                },
              ]
            : []),
          ...(canReadDeliveries
            ? [
                {
                  label: 'Provider Diagnostics',
                  icon: <Settings className="h-4 w-4" />,
                  onClick: () =>
                    router.push(
                      '/dashboard/communications/provider-diagnostics',
                    ),
                },
              ]
            : []),
        ]}
      >
        <KpiGrid className="sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <KpiCard
            title="Sent Today"
            value={summaryValue(
              canReadNotices,
              summaryQuery.isLoading,
              summaryQuery.isError,
              summary?.sentToday,
            )}
            icon={<Send size={20} />}
            tone="neutral"
            description="Notices sent in the current Nepal school day."
          />
          <KpiCard
            title="Scheduled"
            value={summaryValue(
              canReadNotices,
              summaryQuery.isLoading,
              summaryQuery.isError,
              summary?.scheduledNotices,
            )}
            icon={<CalendarClock size={20} />}
            tone={(summary?.scheduledNotices ?? 0) > 0 ? 'info' : 'neutral'}
            description="Notices waiting for their scheduled send time."
          />
          <KpiCard
            title="Failed Deliveries"
            value={summaryValue(
              canReadNotices,
              summaryQuery.isLoading,
              summaryQuery.isError,
              summary?.failedDeliveries,
            )}
            icon={<AlertTriangle size={20} />}
            tone={(summary?.failedDeliveries ?? 0) > 0 ? 'danger' : 'neutral'}
            description="Failed or retry-pending delivery records."
          />
          <KpiCard
            title="Unread High-Impact"
            value={summaryValue(
              canReadNotices,
              summaryQuery.isLoading,
              summaryQuery.isError,
              summary?.unreadHighImpactNotices,
            )}
            icon={<Mail size={20} />}
            tone={
              (summary?.unreadHighImpactNotices ?? 0) > 0
                ? 'warning'
                : 'neutral'
            }
            description="Unread urgent or emergency delivery rows."
          />
          <KpiCard
            title="Escalated Chats"
            value={summaryValue(
              canReadNotices,
              summaryQuery.isLoading,
              summaryQuery.isError,
              summary?.escalatedChatCount,
            )}
            icon={<MessageSquare size={20} />}
            tone={
              (summary?.escalatedChatCount ?? 0) > 0 ? 'warning' : 'neutral'
            }
            description="Relationship-scoped chat escalations."
          />
          <KpiCard
            title="Provider Status"
            value={
              summaryQuery.isLoading
                ? 'Loading'
                : summaryQuery.isError
                  ? 'Unavailable'
                  : summary
                    ? formatProviderMode(summary.providerStatus)
                    : 'Unavailable'
            }
            icon={<CheckCircle2 size={20} />}
            tone={
              summary?.providerHealth === 'degraded'
                ? 'warning'
                : summary?.providerHealth === 'healthy'
                  ? 'success'
                  : 'neutral'
            }
            description="Current notification delivery mode."
          />
        </KpiGrid>
      </ModuleHeader>

      <ModuleTabs
        items={[
          {
            href: '/dashboard/communications',
            label: 'Notices',
            icon: FileText,
          },
          ...(canCreateNotices
            ? [{ href: '/dashboard/notices/new', label: 'Compose', icon: Plus }]
            : []),
          ...(canUseChat
            ? [
                {
                  href: '/dashboard/messages',
                  label: 'Chat',
                  icon: MessageSquare,
                },
              ]
            : []),
          ...(canCreateNotices
            ? [
                {
                  href: '/dashboard/communications/recipients',
                  label: 'Recipients',
                  icon: Users,
                },
              ]
            : []),
          ...(canReadDeliveries
            ? [
                {
                  href: '/dashboard/notices/deliveries',
                  label: 'Delivery Logs',
                  icon: Send,
                },
              ]
            : []),
          ...(canManageTemplates
            ? [
                {
                  href: '/dashboard/communications/templates',
                  label: 'Templates',
                  icon: Mail,
                },
              ]
            : []),
          ...(canReadDeliveries
            ? [
                {
                  href: '/dashboard/communications/provider-diagnostics',
                  label: 'Provider Diagnostics',
                  icon: Settings,
                },
              ]
            : []),
        ]}
        accentColor="rose"
        variant="light"
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Recent Notices"
          description="Latest school notices and delivery status."
        >
          {!canReadNotices ? (
            <PermissionDenied
              showNavigation={false}
              className="min-h-56 border-0 p-4 shadow-none"
              title="Notices are restricted"
              description="You do not have permission to view school notices."
            />
          ) : noticesQuery.isLoading ? (
            <LoadingState label="Loading notices..." />
          ) : noticesQuery.isError ? (
            <ErrorState
              title="Notices unavailable"
              message="Notices could not be loaded. Try again."
              onRetry={() => void noticesQuery.refetch()}
            />
          ) : notices.length ? (
            <div className="divide-y divide-slate-100">
              {notices.slice(0, 5).map((notice) => (
                <Link
                  key={notice.id}
                  href={`/dashboard/notices/${encodeURIComponent(notice.id)}`}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {notice.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {notice.audienceType}
                    </p>
                  </div>
                  <StatusBadge status={notice.publishedAt ? 'SENT' : 'DRAFT'} />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No notices"
              description="No notices are available for this school."
            />
          )}
        </SectionCard>

        <SectionCard
          title="Chat Inbox"
          description="Parent-teacher threads remain relationship- and policy-scoped."
        >
          {!canUseChat ? (
            <PermissionDenied
              showNavigation={false}
              className="min-h-56 border-0 p-4 shadow-none"
              title="Chat is restricted"
              description="You do not have permission to view parent-teacher conversations."
            />
          ) : threadsQuery.isLoading ? (
            <LoadingState label="Loading chat threads..." />
          ) : threadsQuery.isError ? (
            <ErrorState
              title="Chat unavailable"
              message="Chat threads could not be loaded. Try again."
              onRetry={() => void threadsQuery.refetch()}
            />
          ) : threads.length ? (
            <div className="divide-y divide-slate-100">
              {threads.map((thread) => (
                <Link
                  key={thread.id}
                  href={`/dashboard/messages/${encodeURIComponent(thread.id)}`}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {thread.student
                        ? `${thread.student.firstNameEn} ${thread.student.lastNameEn}`
                        : 'Parent-teacher conversation'}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {thread.guardian?.relation ?? 'Guardian'} · Open the
                      protected conversation
                    </p>
                  </div>
                  <StatusBadge status={thread.status} />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No chat threads"
              description="No parent-teacher chat threads are available."
            />
          )}
        </SectionCard>
      </div>
    </DashboardPageShell>
  );
}

function summaryValue(
  allowed: boolean,
  loading: boolean,
  error: boolean,
  value: number | undefined,
) {
  if (!allowed) return 'Restricted';
  if (loading) return 'Loading';
  if (error) return 'Unavailable';
  return value ?? 'Unavailable';
}

function formatProviderMode(value: string) {
  return value
    .replace('-', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
