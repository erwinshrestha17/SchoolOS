'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Clock3, Mail, Send, Settings } from 'lucide-react';
import { communicationsApi } from '../../lib/api/communications';
import { DashboardPageShell } from '../dashboard/dashboard-page-shell';
import { CommunicationsForm } from '../forms/communications-form';
import { NoticeDetailLinksPanel } from '../forms/notice-detail-links-panel';
import { SummaryCard, SummaryGrid } from '../ui/summary-card';
import { WorkSurface } from '../ui/work-surface';
import { ModuleHeader } from '../ui/module-header';
import { WorkspaceTabs } from '../ui/module-tabs';
import { useNoticeCapabilities, useHasPermission } from '../../lib/permissions-ui';
import { NoticeListWorkspace } from './notice-list-workspace';
import { NoticeComposerWorkspace } from './notice-composer-workspace';

type NoticeWorkspaceSection = 'Notices' | 'Delivery Records';

export function NoticesWorkspace({
  initialSection = 'Notices',
  variant = 'overview',
}: {
  initialSection?: NoticeWorkspaceSection;
  /**
   * 'composer' is the dedicated "New notice" route. Per the M12 KPI design
   * rule, KPIs never appear on the notice composer — only the overview does.
   */
  variant?: 'overview' | 'composer';
}) {
  const router = useRouter();
  const noticeCaps = useNoticeCapabilities();
  const canCreateNotices = noticeCaps.canCreate;
  const canReadDeliveries = useHasPermission(
    'notifications:view_delivery_diagnostics',
  );
  const canManageTemplates = useHasPermission('notifications:manage_templates');

  const summaryQuery = useQuery({
    queryKey: ['communications-summary'],
    queryFn: communicationsApi.getCommunicationsSummary,
    enabled: variant === 'overview',
  });
  const summary = summaryQuery.data;
  // `null` from the backend means "not available to you", so it reads as
  // Unavailable rather than a misleading 0 -- same rule as an errored fetch.
  const summaryValue = (value: number | null | undefined) =>
    summaryQuery.isError ? 'Unavailable' : (value ?? 'Unavailable');

  return (
    <DashboardPageShell>
      <ModuleHeader
        eyebrow="Notices"
        title={
          variant === 'composer' ? 'New notice' : 'Notices & Announcements'
        }
        description={
          variant === 'composer'
            ? 'Create or update a draft and preview its recipients. Publication and scheduling happen after review on the notice detail.'
            : 'Draft, preview, publish, and review official school notices. Open Notifications for personal inboxes and delivery status.'
        }
        primaryAction={
          variant === 'overview' && canCreateNotices ? (
            <Link
              href="/dashboard/notices/new"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--primary-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)] focus:ring-offset-2"
            >
              <Send size={18} />
              New notice
            </Link>
          ) : undefined
        }
        moreActionItems={[
          ...(canReadDeliveries
            ? [
                {
                  label: 'Delivery Logs',
                  icon: <Clock3 size={16} />,
                  onClick: () =>
                    router.push('/dashboard/notifications/deliveries'),
                },
              ]
            : []),
          ...(canReadDeliveries
            ? [
                {
                  label: 'Notification Settings',
                  icon: <Settings size={16} />,
                  onClick: () =>
                    router.push('/dashboard/settings/communication'),
                },
              ]
            : []),
        ]}
      />

      {variant === 'overview' ? (
        <SummaryGrid>
          {/* Always the caller's own inbox, never the school's backlog. */}
          <SummaryCard
            label="My Unread Notices"
            loading={summaryQuery.isLoading}
            value={summaryValue(summary?.myUnreadNotices)}
            icon={<Mail size={20} />}
            tone={(summary?.myUnreadNotices ?? 0) > 0 ? 'info' : 'module'}
            description="Published notices addressed to you that you have not opened."
          />
          <SummaryCard
            label="My Urgent Unread"
            loading={summaryQuery.isLoading}
            value={summaryValue(summary?.myUnreadHighImpactNotices)}
            icon={<AlertTriangle size={20} />}
            tone={
              (summary?.myUnreadHighImpactNotices ?? 0) > 0
                ? 'warning'
                : 'module'
            }
            description="Your unread urgent or emergency notices."
          />
          {/* School-wide delivery operations. The backend returns null for
              these unless the caller holds delivery diagnostics, so an
              ordinary teacher never sees the school's send/failure counters
              (P0.8). Kept to the two actionable, drillable ones so the row
              stays within the four-card KPI budget; the full send history
              lives in Delivery Logs. */}
          {canReadDeliveries ? (
            <SummaryCard
              label="Scheduled"
              loading={summaryQuery.isLoading}
              value={summaryValue(summary?.scheduledNotices)}
              icon={<Clock3 size={20} />}
              tone={(summary?.scheduledNotices ?? 0) > 0 ? 'info' : 'module'}
              description="Notices waiting for their scheduled send time."
            />
          ) : null}
          {canReadDeliveries ? (
            <SummaryCard
              label="Failed Deliveries"
              loading={summaryQuery.isLoading}
              value={summaryValue(summary?.failedDeliveries)}
              icon={<Send size={20} />}
              tone={(summary?.failedDeliveries ?? 0) > 0 ? 'danger' : 'module'}
              description="Failed or retry-pending delivery records."
            />
          ) : null}
        </SummaryGrid>
      ) : null}

      <WorkspaceTabs
        items={[
          { href: '/dashboard/notices', label: 'All notices' },
          ...(canReadDeliveries
            ? [
                {
                  href: '/dashboard/notifications/deliveries',
                  label: 'Delivery Logs',
                },
              ]
            : []),
          ...(canManageTemplates
            ? [
                {
                  href: '/dashboard/settings/communication',
                  label: 'Delivery Settings',
                },
              ]
            : []),
        ]}
      />

      <div className="space-y-6">
        <WorkSurface
          title={variant === 'composer' ? 'Notice composer' : initialSection}
          description={
            variant === 'composer'
              ? 'Build the audience, preview recipients, and save the reviewed draft.'
              : 'Create and review official school notices from one workspace.'
          }
          variant={variant === 'composer' ? 'builder' : 'queue'}
          flush
        >
          {variant === 'composer' ? (
            <NoticeComposerWorkspace />
          ) : initialSection === 'Delivery Records' ? (
            <CommunicationsForm
              initialSection="Delivery Records"
              mode="delivery"
            />
          ) : (
            <NoticeListWorkspace />
          )}
        </WorkSurface>
        {variant === 'overview' ? (
          <>
            <NoticeDetailLinksPanel />
          </>
        ) : null}
      </div>
    </DashboardPageShell>
  );
}
