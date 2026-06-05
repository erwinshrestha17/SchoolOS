import Link from 'next/link';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { ModuleTabs } from '../../../components/dashboard/module-tabs';
import { TransportWorkspace } from '../../../components/transport/transport-workspace';
import { PageHeader } from '../../../components/ui/page-header';

const transportTabs = [
  { label: 'Overview', href: '/dashboard/transport' },
  { label: 'Routes & Stops', href: '/dashboard/transport/routes' },
  { label: 'Vehicles', href: '/dashboard/transport/vehicles' },
  { label: 'Students', href: '/dashboard/transport/students' },
  { label: 'Trips', href: '/dashboard/transport/trips' },
  { label: 'Live Status', href: '/dashboard/transport/live-status' },
  { label: 'Reports', href: '/dashboard/transport/reports' },
];

export default function TransportPage() {
  const headerActions = (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/dashboard/transport/live-status"
        className="inline-flex h-10 items-center justify-center rounded-xl bg-orange-600 px-4 text-sm font-bold text-white hover:bg-orange-700"
      >
        Live Status
      </Link>
      <Link
        href="/dashboard/transport/trips"
        className="inline-flex h-10 items-center justify-center rounded-xl border border-orange-100 bg-white px-4 text-sm font-bold text-orange-700 hover:bg-orange-50"
      >
        Trips
      </Link>
    </div>
  );

  return (
    <DashboardPageShell>
      <PageHeader
        title="Transport"
        description="Manage route status, vehicles, student assignments, trips, and GPS freshness before exposing parent tracking."
        actions={headerActions}
      />
      <div className="mb-6">
        <ModuleTabs items={transportTabs} accentColor="orange" variant="light" />
      </div>
      <TransportWorkspace initialTab="overview" />
    </DashboardPageShell>
  );
}
