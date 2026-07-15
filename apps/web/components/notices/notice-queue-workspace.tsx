'use client';

import type { NoticeLifecycleStatus } from '@schoolos/core';
import Link from 'next/link';
import { DashboardPageShell } from '@/components/dashboard/dashboard-page-shell';
import { ModuleHeader } from '@/components/ui/module-header';
import { WorkspaceTabs } from '@/components/ui/module-tabs';
import { NoticeListWorkspace } from './notice-list-workspace';

export function NoticeQueueWorkspace({
  title,
  description,
  lifecycleStatus,
  readOnlyNotice,
}: {
  title: string;
  description: string;
  lifecycleStatus: NoticeLifecycleStatus;
  readOnlyNotice?: string;
}) {
  return (
    <DashboardPageShell>
      <ModuleHeader
        eyebrow="M15 Notices and Announcements"
        title={title}
        description={description}
        primaryAction={
          <Link
            href="/dashboard/notices/new"
            className="inline-flex min-h-11 items-center rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-white"
          >
            Create notice
          </Link>
        }
      />
      <WorkspaceTabs
        items={[
          { href: '/dashboard/notices', label: 'All notices' },
          { href: '/dashboard/notices/scheduled', label: 'Scheduled' },
          { href: '/dashboard/notices/approvals', label: 'Approvals' },
          { href: '/dashboard/notices/deliveries', label: 'Delivery logs' },
        ]}
      />
      {readOnlyNotice ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {readOnlyNotice}
        </p>
      ) : null}
      <NoticeListWorkspace fixedLifecycleStatus={lifecycleStatus} />
    </DashboardPageShell>
  );
}
