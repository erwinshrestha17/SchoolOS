'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Mail,
  MessageSquare,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { communicationsApi } from '../../lib/api/communications';
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
  const summaryQuery = useQuery({
    queryKey: ['communications-summary'],
    queryFn: communicationsApi.getCommunicationsSummary,
  });
  const summary = summaryQuery.data;
  const summaryValue = (value: number | undefined) =>
    summaryQuery.isLoading ? 'Loading' : summaryQuery.isError ? 'Unavailable' : (value ?? 'Unavailable');

  return (
    <DashboardPageShell>
      <ModuleHeader
        eyebrow="M12 Notices / Communication / Chat"
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
        <KpiGrid className="sm:grid-cols-2 xl:grid-cols-6">
          <KpiCard
            title="Sent Today"
            value={summaryValue(summary?.sentToday)}
            icon={<Send size={20} />}
            tone="neutral"
            description="Notices sent in the current Nepal school day."
          />
          <KpiCard
            title="Scheduled"
            value={summaryValue(summary?.scheduledNotices)}
            icon={<Clock3 size={20} />}
            tone={(summary?.scheduledNotices ?? 0) > 0 ? 'info' : 'neutral'}
            description="Notices waiting for their scheduled send time."
          />
          <KpiCard
            title="Failed Deliveries"
            value={summaryValue(summary?.failedDeliveries)}
            icon={<AlertTriangle size={20} />}
            tone={(summary?.failedDeliveries ?? 0) > 0 ? 'danger' : 'neutral'}
            description="Failed or retry-pending delivery records."
          />
          <KpiCard
            title="Unread High-Impact"
            value={summaryValue(summary?.unreadHighImpactNotices)}
            icon={<Mail size={20} />}
            tone={(summary?.unreadHighImpactNotices ?? 0) > 0 ? 'warning' : 'neutral'}
            description="Unread urgent or emergency delivery rows."
          />
          <KpiCard
            title="Escalated Chats"
            value={summaryValue(summary?.escalatedChatCount)}
            icon={<ShieldAlert size={20} />}
            tone={(summary?.escalatedChatCount ?? 0) > 0 ? 'warning' : 'neutral'}
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

function formatProviderMode(value: string) {
  return value.replace('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
