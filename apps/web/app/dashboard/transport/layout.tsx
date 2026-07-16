'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, Bus, MapPin, Navigation, Route, Users } from 'lucide-react';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { WorkspaceTabs } from '../../../components/ui/module-tabs';
import { ModuleHeader } from '../../../components/ui/module-header';

const transportTabs = [
  { label: 'Overview', href: '/dashboard/transport' },
  { label: 'Routes & Stops', href: '/dashboard/transport/routes' },
  { label: 'Vehicles', href: '/dashboard/transport/vehicles' },
  { label: 'Students', href: '/dashboard/transport/students' },
  { label: 'Trips', href: '/dashboard/transport/trips' },
  { label: 'Location Status', href: '/dashboard/transport/location' },
  { label: 'Reports', href: '/dashboard/transport/reports' },
];

export default function TransportLayout({ children }: { children: ReactNode }) {
  const router = useRouter();

  return (
    <DashboardPageShell>
      <ModuleHeader
        eyebrow="School Operations"
        title="Transport"
        description="Manage route status, vehicles, student assignments, trips, and GPS freshness before exposing parent tracking."
        primaryAction={
          <Link
            href="/dashboard/transport/trips"
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--primary-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)] focus:ring-offset-2 active:scale-[0.98]"
          >
            <Navigation className="h-4 w-4" />
            Open Trips
          </Link>
        }
        moreActionItems={[
          {
            label: 'Routes & Stops',
            icon: <Route className="h-4 w-4" />,
            onClick: () => router.push('/dashboard/transport/routes'),
          },
          {
            label: 'Vehicles',
            icon: <Bus className="h-4 w-4" />,
            onClick: () => router.push('/dashboard/transport/vehicles'),
          },
          {
            label: 'Students',
            icon: <Users className="h-4 w-4" />,
            onClick: () => router.push('/dashboard/transport/students'),
          },
          {
            label: 'Location Status',
            icon: <MapPin className="h-4 w-4" />,
            onClick: () => router.push('/dashboard/transport/location'),
          },
          {
            label: 'Reports',
            icon: <BarChart3 className="h-4 w-4" />,
            onClick: () => router.push('/dashboard/transport/reports'),
          },
        ]}
      />
      <WorkspaceTabs items={transportTabs} />
      <main>{children}</main>
    </DashboardPageShell>
  );
}
