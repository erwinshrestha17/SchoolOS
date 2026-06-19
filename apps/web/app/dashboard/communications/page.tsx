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
import { PermissionState } from '@/components/ui/permission-state';
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
  const canManageChat = granted.has('messaging:manage');

  const noticesQuery = useQuery({
    queryKey: ['communications-hub', 'notices'],
    queryFn: communicationsApi.listNotices,
    enabled: canReadNotices,
  });
  const failuresQuery = useQuery({
    queryKey: ['communications-hub', 'delivery-failures'],
    queryFn: communicationsApi.listNotificationDeliveryFailures,
    enabled: canReadNotices,
  });
  const threadsQuery = useQuery({
    queryKey: ['communications-hub', 'chat-threads'],
    queryFn: () => messagingApi.listParentTeacherThreads({ page: '1', limit: '5' }),
    enabled: canUseChat,
  });
  const escalatedQuery = useQuery({
    queryKey: ['communications-hub', 'chat-escalated'],
    queryFn: () => messagingApi.listParentTeacherThreads({ status: 'ESCALATED', page: '1', limit: '1' }),
    enabled: canManageChat,
  });

  const notices = noticesQuery.data ?? [];
  const threads = threadsQuery.data?.items ?? [];

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
          ...(canReadNotices ? [{ label: 'Delivery Logs', icon: <Send className="h-4 w-4" />, onClick: () => router.push('/dashboard/notices/deliveries') }] : []),
          ...(canUseChat ? [{ label: 'Chat Inbox', icon: <MessageSquare className="h-4 w-4" />, onClick: () => router.push('/dashboard/messages') }] : []),
          { label: 'Provider Diagnostics', icon: <Settings className="h-4 w-4" />, onClick: () => router.push('/dashboard/communications/provider-diagnostics') },
        ]}
      >
        <KpiGrid className="sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <KpiCard title="Sent Today" value="Unavailable" icon={<Send size={20} />} tone="neutral" description="Needs a date-bounded M10 summary." />
          <KpiCard title="Scheduled" value="Unavailable" icon={<CalendarClock size={20} />} tone="neutral" description="Needs a bounded scheduled-send summary." />
          <KpiCard title="Failed Deliveries" value={!canReadNotices ? 'Restricted' : failuresQuery.isLoading ? 'Loading' : failuresQuery.isError ? 'Unavailable' : failuresQuery.data?.total ?? 'Unavailable'} icon={<AlertTriangle size={20} />} tone={failuresQuery.data?.total ? 'danger' : 'neutral'} description="Backend retryable failure summary." />
          <KpiCard title="Unread High-Impact" value="Unavailable" icon={<Mail size={20} />} tone="neutral" description="Needs a priority-aware unread summary." />
          <KpiCard title="Escalated Chats" value={!canManageChat ? 'Restricted' : escalatedQuery.isLoading ? 'Loading' : escalatedQuery.isError ? 'Unavailable' : escalatedQuery.data?.total ?? 'Unavailable'} icon={<MessageSquare size={20} />} tone={(escalatedQuery.data?.total ?? 0) > 0 ? 'warning' : 'neutral'} description="Backend paginated escalation total." />
          <KpiCard title="Provider Status" value="Unavailable" icon={<CheckCircle2 size={20} />} tone="neutral" description="A safe provider-health contract is not exposed." />
        </KpiGrid>
      </ModuleHeader>

      <ModuleTabs
        items={[
          { href: '/dashboard/communications', label: 'Notices', icon: FileText },
          ...(canCreateNotices ? [{ href: '/dashboard/notices/new', label: 'Compose', icon: Plus }] : []),
          ...(canUseChat ? [{ href: '/dashboard/messages', label: 'Chat', icon: MessageSquare }] : []),
          { href: '/dashboard/communications/recipients', label: 'Recipients', icon: Users },
          ...(canReadNotices ? [{ href: '/dashboard/notices/deliveries', label: 'Delivery Logs', icon: Send }] : []),
          { href: '/dashboard/communications/templates', label: 'Templates', icon: Mail },
          { href: '/dashboard/communications/provider-diagnostics', label: 'Provider Diagnostics', icon: Settings },
        ]}
        accentColor="rose"
        variant="light"
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SectionCard title="Recent Notices" description="Tenant-scoped notices from the backend.">
          {!canReadNotices ? (
            <PermissionState
              className="min-h-56 border-0 p-4 shadow-none"
              title="Notices are restricted"
              description="You do not have permission to view school notices."
            />
          ) : noticesQuery.isLoading ? (
            <LoadingState label="Loading notices..." />
          ) : noticesQuery.isError ? (
            <ErrorState title="Notices unavailable" message="Notices could not be loaded. Try again." onRetry={() => void noticesQuery.refetch()} />
          ) : notices.length ? (
            <div className="divide-y divide-slate-100">
              {notices.slice(0, 5).map((notice) => (
                <Link key={notice.id} href={`/dashboard/notices/${encodeURIComponent(notice.id)}`} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{notice.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{notice.audienceType}</p>
                  </div>
                  <StatusBadge status={notice.publishedAt ? 'SENT' : 'DRAFT'} />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title="No notices" description="No notices are available for this school." />
          )}
        </SectionCard>

        <SectionCard title="Chat Inbox" description="Parent-teacher threads remain relationship- and policy-scoped.">
          {!canUseChat ? (
            <PermissionState
              className="min-h-56 border-0 p-4 shadow-none"
              title="Chat is restricted"
              description="You do not have permission to view parent-teacher conversations."
            />
          ) : threadsQuery.isLoading ? (
            <LoadingState label="Loading chat threads..." />
          ) : threadsQuery.isError ? (
            <ErrorState title="Chat unavailable" message="Chat threads could not be loaded. Try again." onRetry={() => void threadsQuery.refetch()} />
          ) : threads.length ? (
            <div className="divide-y divide-slate-100">
              {threads.map((thread) => (
                <Link key={thread.id} href={`/dashboard/messages/${encodeURIComponent(thread.id)}`} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {thread.student
                        ? `${thread.student.firstNameEn} ${thread.student.lastNameEn}`
                        : 'Parent-teacher conversation'}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {thread.guardian?.relation ?? 'Guardian'} · Open the protected conversation
                    </p>
                  </div>
                  <StatusBadge status={thread.status} />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title="No chat threads" description="No parent-teacher chat threads are available." />
          )}
        </SectionCard>
      </div>
    </DashboardPageShell>
  );
}
