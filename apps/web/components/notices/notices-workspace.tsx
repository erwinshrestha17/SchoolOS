'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Clock3,
  MessageSquare,
  Send,
  ShieldAlert,
  UsersRound,
} from 'lucide-react';
import { api } from '../../lib/api';
import { DashboardPageShell } from '../dashboard/dashboard-page-shell';
import { CommunicationsForm } from '../forms/communications-form';
import { DeliveryRetryPanel } from '../forms/delivery-retry-panel';
import { NoticeDetailLinksPanel } from '../forms/notice-detail-links-panel';
import { KpiCard, KpiGrid } from '../ui/kpi-card';
import { ModuleHeader } from '../ui/module-header';
import { ModuleTabs } from '../ui/module-tabs';

type NoticeWorkspaceSection = 'Notices' | 'Delivery Records';

export function NoticesWorkspace({
  initialSection = 'Notices',
}: {
  initialSection?: NoticeWorkspaceSection;
}) {
  const router = useRouter();
  const analyticsQuery = useQuery({
    queryKey: ['notification-delivery-analytics'],
    queryFn: api.getNotificationDeliveryAnalytics,
  });
  const failedDeliveries = getStatusCount(analyticsQuery.data?.byStatus, 'FAILED');
  const retryPending = getStatusCount(
    analyticsQuery.data?.byStatus,
    'RETRY_PENDING',
  );

  return (
    <DashboardPageShell>
      <ModuleHeader
        eyebrow="M10 Notices / Communication / Chat"
        title="Notices & Communication"
        description="Publish official school communication, review delivery health, and manage controlled parent-teacher conversations. Delivery truth remains backend-owned."
        primaryAction={
          <Link
            href="/dashboard/notices/new"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-mod-notices-accent)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-mod-notices-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-notices-border)] focus:ring-offset-2"
          >
            <Send size={18} />
            New Notice
          </Link>
        }
        moreActionItems={[
          {
            label: 'Delivery Logs',
            icon: <Clock3 size={16} />,
            onClick: () => router.push('/dashboard/notices/deliveries'),
          },
          {
            label: 'Parent-Teacher Chat',
            icon: <MessageSquare size={16} />,
            onClick: () => router.push('/dashboard/messages'),
          },
          {
            label: 'Escalated Chats',
            icon: <ShieldAlert size={16} />,
            onClick: () => router.push('/dashboard/messages/moderation'),
          },
        ]}
      >
        <KpiGrid className="sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            title="Scheduled Notices"
            value="Unavailable"
            icon={<Clock3 size={20} />}
            tone="neutral"
            description="Needs a real M10 summary API."
          />
          <KpiCard
            title="Failed Deliveries"
            value={
              analyticsQuery.isLoading
                ? 'Loading'
                : analyticsQuery.isError
                  ? 'Unavailable'
                  : failedDeliveries
            }
            icon={<AlertTriangle size={20} />}
            tone={failedDeliveries ? 'danger' : 'neutral'}
            description="Tenant-scoped delivery analytics from the backend."
          />
          <KpiCard
            title="Retry Pending"
            value={
              analyticsQuery.isLoading
                ? 'Loading'
                : analyticsQuery.isError
                  ? 'Unavailable'
                  : retryPending
            }
            icon={<ShieldAlert size={20} />}
            tone={retryPending ? 'warning' : 'neutral'}
            description="Backend delivery records waiting for retry completion."
          />
          <KpiCard
            title="Unread High-Impact"
            value="Unavailable"
            icon={<UsersRound size={20} />}
            tone="neutral"
            description="Needs a real M10 summary API."
          />
          <KpiCard
            title="Escalated Chats"
            value="Unavailable"
            icon={<MessageSquare size={20} />}
            tone="neutral"
            description="Needs a real M10 summary API."
          />
        </KpiGrid>
      </ModuleHeader>

      <ModuleTabs
        items={[
          { href: '/dashboard/notices', label: 'Notices' },
          { href: '/dashboard/notices/new', label: 'Compose' },
          { href: '/dashboard/notices/deliveries', label: 'Delivery Logs' },
          { href: '/dashboard/messages', label: 'Chat' },
          { href: '/dashboard/messages/moderation', label: 'Escalations' },
        ]}
        accentColor="rose"
        variant="light"
      />

      <div className="mt-6 space-y-6">
        <CommunicationsForm initialSection={initialSection} />
        <NoticeDetailLinksPanel />
        <DeliveryRetryPanel />
      </div>
    </DashboardPageShell>
  );
}

function getStatusCount(
  rows: Array<{ status: string; count: number }> | undefined,
  status: string,
) {
  return rows?.find((row) => row.status === status)?.count ?? 0;
}
