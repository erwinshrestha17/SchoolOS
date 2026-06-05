'use client';

import Link from 'next/link';
import { ModuleTabs } from '../dashboard/module-tabs';
import { DashboardPageShell } from '../dashboard/dashboard-page-shell';
import { CommunicationsForm } from '../forms/communications-form';
import { DeliveryRetryPanel } from '../forms/delivery-retry-panel';
import { NoticeDetailLinksPanel } from '../forms/notice-detail-links-panel';
import { PageHeader } from '../ui/page-header';

type NoticeWorkspaceSection = 'Notices' | 'Delivery Records';

export function NoticesWorkspace({
  initialSection = 'Notices',
}: {
  initialSection?: NoticeWorkspaceSection;
}) {
  return (
    <DashboardPageShell>
      <PageHeader
        title="Notices & Chat"
        description="Publish official school announcements, review delivery health, and keep communication records visible."
        actions={
          <Link
            href="/dashboard/notices/new"
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--color-mod-notices-accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--color-mod-notices-text)]"
          >
            Publish Notice
          </Link>
        }
      />

      <div className="mb-6 rounded-2xl border border-[var(--color-mod-notices-border)] bg-white p-2 shadow-sm">
        <ModuleTabs
          items={[
            { href: '/dashboard/notices', label: 'Notices' },
            { href: '/dashboard/notices/new', label: 'New Notice' },
            { href: '/dashboard/notices/deliveries', label: 'Deliveries' },
            { href: '/dashboard/messages', label: 'Messages' },
          ]}
          accentColor="rose"
          variant="light"
        />
      </div>

      <CommunicationsForm initialSection={initialSection} />
      <NoticeDetailLinksPanel />
      <DeliveryRetryPanel />
    </DashboardPageShell>
  );
}
