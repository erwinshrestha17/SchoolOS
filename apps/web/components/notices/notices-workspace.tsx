'use client';

import type { PermissionKey } from '@schoolos/core';
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
import { useSession } from '../session-provider';
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
  const { session } = useSession();
  const granted = new Set<PermissionKey>(session?.user.permissions ?? []);
  const canCreateNotices = granted.has('notices:create');
  const canReadDeliveries = granted.has(
    'notifications:view_delivery_diagnostics',
  );
  const canManageTemplates = granted.has('notifications:manage_templates');

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
        eyebrow="Notices"
        title={
          variant === 'composer' ? 'New notice' : 'Notices & Announcements'
        }
        description={
          variant === 'composer'
            ? 'Create or update a draft and preview its backend-resolved recipients. Publication and scheduling happen after review on the notice detail.'
            : 'Draft, preview, publish, and review official school notices. Recipient and delivery truth remains backend-owned.'
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
                  onClick: () => router.push('/dashboard/notices/deliveries'),
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
          <SummaryCard
            label="Sent Today"
            loading={summaryQuery.isLoading}
            value={summaryValue(summary?.sentToday)}
            icon={<Send size={20} />}
            tone="module"
            description="Notices sent in the current Nepal school day."
          />
          <SummaryCard
            label="Scheduled"
            loading={summaryQuery.isLoading}
            value={summaryValue(summary?.scheduledNotices)}
            icon={<Clock3 size={20} />}
            tone={(summary?.scheduledNotices ?? 0) > 0 ? 'info' : 'module'}
            description="Notices waiting for their scheduled send time."
          />
          <SummaryCard
            label="Failed Deliveries"
            loading={summaryQuery.isLoading}
            value={summaryValue(summary?.failedDeliveries)}
            icon={<AlertTriangle size={20} />}
            tone={(summary?.failedDeliveries ?? 0) > 0 ? 'danger' : 'module'}
            description="Failed or retry-pending delivery records."
          />
          <SummaryCard
            label="Unread High-Impact"
            loading={summaryQuery.isLoading}
            value={summaryValue(summary?.unreadHighImpactNotices)}
            icon={<Mail size={20} />}
            tone={
              (summary?.unreadHighImpactNotices ?? 0) > 0
                ? 'warning'
                : 'module'
            }
            description="Unread urgent or emergency delivery rows."
          />
        </SummaryGrid>
      ) : null}

      <WorkspaceTabs
        items={[
          { href: '/dashboard/notices', label: 'All notices' },
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
              ? 'Build the audience, preview backend recipient resolution, and save the reviewed draft.'
              : 'Operate official notice and delivery records from backend-owned state.'
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
