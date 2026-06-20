'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  FileWarning,
  Images,
  MessageSquare,
  Plus,
  Target,
  Users,
} from 'lucide-react';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { ModuleHeader } from '../../../components/ui/module-header';
import { KpiCard, KpiGrid } from '../../../components/ui/kpi-card';
import { ModuleTabs } from '../../../components/ui/module-tabs';
import { ActivityFeedForm } from '../../../components/forms/activity-feed-form';

export default function ActivityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSection = searchParams.get('section');
  const initialSection =
    requestedSection === 'Feed Preview' ||
    requestedSection === 'Media Gallery' ||
    requestedSection === 'Milestones' ||
    requestedSection === 'Delivery Records'
      ? requestedSection
      : 'Create Post';

  return (
    <DashboardPageShell>
      <ModuleHeader
        title="Activity Feed & Milestones"
        description="Photo posts, student tags, mood logs, milestones, private media sharing, moderation, and delivery records."
        primaryAction={
          <Link
            href="/dashboard/activity/new"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-mod-activity-accent)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-mod-activity-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-activity-border)] focus:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            Create Post
          </Link>
        }
        moreActionItems={[
          { label: 'Moderation Queue', icon: <CheckCircle2 className="h-4 w-4" />, onClick: () => router.push('/dashboard/activity/moderation') },
          { label: 'Media Gallery', icon: <Images className="h-4 w-4" />, onClick: () => router.push('/dashboard/activity/gallery') },
          { label: 'Milestones', icon: <Target className="h-4 w-4" />, onClick: () => router.push('/dashboard/activity/milestones') },
        ]}
      >
        <KpiGrid className="sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <KpiCard title="Posts Today" value="Unavailable" icon={<MessageSquare size={20} />} tone="neutral" description="Needs a bounded M5 summary." />
          <KpiCard title="Pending Moderation" value="Unavailable" icon={<CheckCircle2 size={20} />} tone="neutral" description="Open the moderation queue." />
          <KpiCard title="Consent-Blocked Media" value="Unavailable" icon={<FileWarning size={20} />} tone="neutral" description="Consent remains enforced per post." />
          <KpiCard title="Failed Deliveries" value="Unavailable" icon={<AlertTriangle size={20} />} tone="neutral" description="Open delivery records for backend status." />
          <KpiCard title="Milestones Logged" value="Unavailable" icon={<Target size={20} />} tone="neutral" description="Needs a bounded milestone summary." />
          <KpiCard title="Parent Reach" value="Unavailable" icon={<Users size={20} />} tone="neutral" description="Needs a consent-safe reach summary." />
        </KpiGrid>
      </ModuleHeader>

      <ModuleTabs
        items={[
          { href: '/dashboard/activity', label: 'Feed', icon: MessageSquare },
          { href: '/dashboard/activity/moderation', label: 'Pending Approval', icon: CheckCircle2 },
          { href: '/dashboard/activity/gallery', label: 'Media Gallery', icon: Images },
          { href: '/dashboard/activity/milestones', label: 'Milestones', icon: Target },
          { href: '/dashboard/activity/reports', label: 'Reports', icon: BarChart3 },
        ]}
        accentColor="rose"
        variant="light"
      />

      <ActivityFeedForm initialSection={initialSection} />
    </DashboardPageShell>
  );
}
