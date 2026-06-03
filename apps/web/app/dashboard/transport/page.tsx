import { Bus } from 'lucide-react';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { ModuleHero } from '../../../components/dashboard/module-hero';
import { ModuleTabs } from '../../../components/dashboard/module-tabs';
import { TransportWorkspace } from '../../../components/transport/transport-workspace';

const transportTabs = [
  { label: 'Overview', href: '/dashboard/transport' },
  { label: 'Routes & Stops', href: '/dashboard/transport/routes' },
  { label: 'Vehicles', href: '/dashboard/transport/vehicles' },
  { label: 'Assignments', href: '/dashboard/transport/assignments' },
  { label: 'Trips', href: '/dashboard/transport/trips' },
  { label: 'Location', href: '/dashboard/transport/location' },
  { label: 'Reports', href: '/dashboard/transport/reports' },
];

export default function TransportPage() {
  return (
    <DashboardPageShell>
      <ModuleHero
        title="Transport Management"
        subtitle="Manage routes, stops, vehicles, assignments, trips, and GPS location monitoring for school operations."
        badge="Transport"
        category="School Operations"
        icon={<Bus size={28} />}
        accentColor="blue"
        tabs={<ModuleTabs items={transportTabs} accentColor="blue" />}
      />
      <TransportWorkspace initialTab="overview" />
    </DashboardPageShell>
  );
}
