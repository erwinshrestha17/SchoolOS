import Link from 'next/link';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { DashboardPageShell } from '@/components/dashboard/dashboard-page-shell';
import { ModuleHeader } from '@/components/ui/module-header';
import { EmptyState } from '@/components/ui/empty-state';

export default function ActivityReportsPage() {
  return (
    <DashboardPageShell>
      <ModuleHeader
        title="Activity Reports"
        description="Review consent-safe activity, moderation, milestone, and delivery reporting."
      />
      <EmptyState
        title="Activity reports are not available yet"
        description="A bounded, consent-safe M5 reporting contract is required before official totals or reach metrics can be shown. Feed, moderation, media, milestones, and delivery records remain available in their existing workspaces."
        icon={<BarChart3 className="h-7 w-7" />}
        action={
          <Link
            href="/dashboard/activity"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to activity feed
          </Link>
        }
      />
    </DashboardPageShell>
  );
}
