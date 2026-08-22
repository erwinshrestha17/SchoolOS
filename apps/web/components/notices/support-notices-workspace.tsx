'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Send, Settings } from 'lucide-react';

import { communicationsApi } from '../../lib/api/communications';
import { DashboardPageShell } from '../dashboard/dashboard-page-shell';
import { ModuleHeader } from '../ui/module-header';
import { WorkspaceTabs } from '../ui/module-tabs';
import { SummaryCard, SummaryGrid } from '../ui/summary-card';
import { WorkSurface } from '../ui/work-surface';
import { NoticeListWorkspace } from './notice-list-workspace';

export function SupportNoticesWorkspace() {
  const summaryQuery = useQuery({
    queryKey: ['communications-summary', 'support-override'],
    queryFn: communicationsApi.getCommunicationsSummary,
  });
  const summary = summaryQuery.data;
  const summaryValue = (value: number | null | undefined) =>
    summaryQuery.isError ? 'Unavailable' : (value ?? 'Unavailable');

  return (
    <DashboardPageShell>
      <ModuleHeader
        eyebrow="Read-only support"
        title="Notices & delivery evidence"
        description="Inspect published notices and masked delivery diagnostics. Drafts, recipients, attachments, and lifecycle actions remain unavailable."
      />

      <SummaryGrid>
        <SummaryCard
          label="Sent today"
          loading={summaryQuery.isLoading}
          value={summaryValue(summary?.sentToday)}
          icon={<Send size={20} />}
          tone="module"
          description="Masked delivery records sent or delivered during the current Nepal school day."
        />
        <SummaryCard
          label="Failed deliveries"
          loading={summaryQuery.isLoading}
          value={summaryValue(summary?.failedDeliveries)}
          icon={<AlertTriangle size={20} />}
          tone={(summary?.failedDeliveries ?? 0) > 0 ? 'danger' : 'module'}
          description="Failed or retry-pending delivery rows. Message bodies and full destinations remain protected."
        />
        <SummaryCard
          label="Provider health"
          loading={summaryQuery.isLoading}
          value={
            summaryQuery.isError
              ? 'Unavailable'
              : (summary?.providerHealth ?? 'Unavailable')
          }
          icon={<Settings size={20} />}
          tone={summary?.providerHealth === 'degraded' ? 'warning' : 'module'}
          description="Operational provider health only; credentials and provider configuration are not exposed."
        />
      </SummaryGrid>

      <WorkspaceTabs
        items={[
          { href: '/dashboard/notices', label: 'Published notices' },
          {
            href: '/dashboard/notifications/deliveries',
            label: 'Delivery logs',
          },
        ]}
      />

      <WorkSurface
        title="Published notices"
        description="Published notice content and masked delivery evidence only."
        variant="queue"
        flush
      >
        <NoticeListWorkspace />
      </WorkSurface>
    </DashboardPageShell>
  );
}
