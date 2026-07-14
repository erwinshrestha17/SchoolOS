'use client';

import type { PermissionKey } from '@schoolos/core';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Clock3, Mail, Send, Settings } from 'lucide-react';
import { communicationsApi } from '../../lib/api/communications';
import { DashboardPageShell } from '../dashboard/dashboard-page-shell';
import { CommunicationsForm } from '../forms/communications-form';
import { DeliveryRetryPanel } from '../forms/delivery-retry-panel';
import { NoticeDetailLinksPanel } from '../forms/notice-detail-links-panel';
import { KpiCard, KpiGrid } from '../ui/kpi-card';
import { ModuleHeader } from '../ui/module-header';
import { ModuleTabs } from '../ui/module-tabs';
import { useSession } from '../session-provider';

type NoticeWorkspaceSection = 'Notices' | 'Delivery Records';

export function NoticesWorkspace({
  initialSection = 'Notices',
  variant = 'overview',
}: {
  initialSection?: NoticeWorkspaceSection;
  /**
   * 'composer' is the dedicated "New Notice" route. Per the M12 KPI design
   * rule, KPIs never appear on the notice composer — only the overview does.
   */
  variant?: 'overview' | 'composer';
}) {
  const router = useRouter();
  const { session } = useSession();
  const granted = new Set<PermissionKey>(session?.user.permissions ?? []);
  const canCreateNotices = granted.has('notices:create');
  const canReadDeliveries = granted.has('communications:read_deliveries');
  const canManageTemplates = granted.has('communications:manage_templates');

  const summaryQuery = useQuery({
    queryKey: ['communications-summary'],
    queryFn: communicationsApi.getCommunicationsSummary,
    enabled: variant === 'overview',
  });
  const summary = summaryQuery.data;
  const summaryValue = (value: number | undefined) =>
    summaryQuery.isError ? 'Unavailable' : (value ?? 'Unavailable');

  return (
    <DashboardPageShell>
      <ModuleHeader
        eyebrow="M15 Notices and Announcements"
        title={
          variant === 'composer' ? 'New Notice' : 'Notices & Announcements'
        }
        description={
          variant === 'composer'
            ? 'Compose and publish a notice, or schedule it for later. Recipient counts and delivery channels are confirmed before you send.'
            : 'Draft, preview, publish, and review official school notices. Recipient and delivery truth remains backend-owned.'
        }
        primaryAction={
          variant === 'overview' && canCreateNotices ? (
            <Link
              href="/dashboard/notices/new"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-mod-notices-accent)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-mod-notices-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-notices-border)] focus:ring-offset-2"
            >
              <Send size={18} />
              New Notice
            </Link>
          ) : undefined
        }
        moreActionItems={[
          ...(canReadDeliveries
            ? [
                {
                  label: 'Delivery Logs',
                  icon: <Clock3 size={16} />,
                  onClick: () => router.push('/dashboard/notices/deliveries'),
                },
              ]
            : []),
          ...(canCreateNotices
            ? [
                {
                  label: 'Recipient Preview',
                  icon: <Mail size={16} />,
                  onClick: () =>
                    router.push('/dashboard/communications/recipients'),
                },
              ]
            : []),
          ...(canReadDeliveries
            ? [
                {
                  label: 'Notification Settings',
                  icon: <Settings size={16} />,
                  onClick: () =>
                    router.push('/dashboard/settings/notifications'),
                },
              ]
            : []),
        ]}
      >
        {variant === 'overview' ? (
          <KpiGrid className="sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Sent Today"
              loading={summaryQuery.isLoading}
              value={summaryValue(summary?.sentToday)}
              icon={<Send size={20} />}
              tone="neutral"
              description="Notices sent in the current Nepal school day."
            />
            <KpiCard
              title="Scheduled"
              loading={summaryQuery.isLoading}
              value={summaryValue(summary?.scheduledNotices)}
              icon={<Clock3 size={20} />}
              tone={(summary?.scheduledNotices ?? 0) > 0 ? 'info' : 'neutral'}
              description="Notices waiting for their scheduled send time."
            />
            <KpiCard
              title="Failed Deliveries"
              loading={summaryQuery.isLoading}
              value={summaryValue(summary?.failedDeliveries)}
              icon={<AlertTriangle size={20} />}
              tone={(summary?.failedDeliveries ?? 0) > 0 ? 'danger' : 'neutral'}
              description="Failed or retry-pending delivery records."
            />
            <KpiCard
              title="Unread High-Impact"
              loading={summaryQuery.isLoading}
              value={summaryValue(summary?.unreadHighImpactNotices)}
              icon={<Mail size={20} />}
              tone={
                (summary?.unreadHighImpactNotices ?? 0) > 0
                  ? 'warning'
                  : 'neutral'
              }
              description="Unread urgent or emergency delivery rows."
            />
          </KpiGrid>
        ) : null}
      </ModuleHeader>

      <ModuleTabs
        items={[
          { href: '/dashboard/notices', label: 'Notices' },
          ...(canCreateNotices
            ? [{ href: '/dashboard/notices/new', label: 'Compose' }]
            : []),
          ...(canReadDeliveries
            ? [
                {
                  href: '/dashboard/notices/deliveries',
                  label: 'Delivery Logs',
                },
              ]
            : []),
          ...(canManageTemplates
            ? [
                {
                  href: '/dashboard/settings/notifications',
                  label: 'Delivery Settings',
                },
              ]
            : []),
        ]}
        accentColor="rose"
        variant="light"
      />

      <div className="mt-6 space-y-6">
        <CommunicationsForm
          initialSection={initialSection}
          mode={
            variant === 'composer'
              ? 'composer'
              : initialSection === 'Delivery Records'
                ? 'delivery'
                : 'overview'
          }
        />
        {variant === 'overview' ? (
          <>
            <NoticeDetailLinksPanel />
            <DeliveryRetryPanel />
          </>
        ) : null}
      </div>
    </DashboardPageShell>
  );
}
