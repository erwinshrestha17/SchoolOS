'use client';

import Link from 'next/link';
import type { PermissionKey } from '@schoolos/core';
import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, Bus, MapPin, Navigation, Route, Users } from 'lucide-react';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { WorkspaceTabs } from '../../../components/ui/module-tabs';
import { ModuleHeader } from '../../../components/ui/module-header';
import { usePermissionAccess } from '../../../lib/permissions-ui';

const transportTabs = [
  {
    label: 'Overview',
    href: '/dashboard/transport',
    permissions: [
      'transport:routes:read',
      'transport:vehicles:read',
      'transport:assignments:read',
      'transport:trips:read',
      'transport:reports:read',
    ],
  },
  { label: 'Routes & Stops', href: '/dashboard/transport/routes', permissions: ['transport:routes:read'] },
  { label: 'Vehicles', href: '/dashboard/transport/vehicles', permissions: ['transport:vehicles:read'] },
  { label: 'Assignments', href: '/dashboard/transport/assignments', permissions: ['transport:assignments:read'] },
  { label: 'Trips', href: '/dashboard/transport/trips', permissions: ['transport:trips:read'] },
  { label: 'Location Status', href: '/dashboard/transport/location', permissions: ['transport:location:read'] },
  { label: 'Reports', href: '/dashboard/transport/reports', permissions: ['transport:reports:read'] },
] satisfies Array<{ label: string; href: string; permissions: PermissionKey[] }>;

export default function TransportLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const access = usePermissionAccess();
  const visibleTabs = transportTabs.filter((tab) =>
    access.hasAnyPermission(tab.permissions),
  );
  const canReadTrips = access.hasPermission('transport:trips:read');
  const moreActionItems = [
    {
      label: 'Routes & Stops',
      icon: <Route className="h-4 w-4" />,
      onClick: () => router.push('/dashboard/transport/routes'),
      permission: 'transport:routes:read',
    },
    {
      label: 'Vehicles',
      icon: <Bus className="h-4 w-4" />,
      onClick: () => router.push('/dashboard/transport/vehicles'),
      permission: 'transport:vehicles:read',
    },
    {
      label: 'Assignments',
      icon: <Users className="h-4 w-4" />,
      onClick: () => router.push('/dashboard/transport/assignments'),
      permission: 'transport:assignments:read',
    },
    {
      label: 'Location Status',
      icon: <MapPin className="h-4 w-4" />,
      onClick: () => router.push('/dashboard/transport/location'),
      permission: 'transport:location:read',
    },
    {
      label: 'Reports',
      icon: <BarChart3 className="h-4 w-4" />,
      onClick: () => router.push('/dashboard/transport/reports'),
      permission: 'transport:reports:read',
    },
  ].filter((item) => access.hasPermission(item.permission as PermissionKey));

  return (
    <DashboardPageShell>
      <ModuleHeader
        eyebrow="School Operations"
        title="Transport"
        description="Manage routes, vehicles, assignments, trips, and location freshness with clear safety boundaries."
        primaryAction={canReadTrips ? (
          <Link
            href="/dashboard/transport/trips"
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--primary-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)] focus:ring-offset-2 active:scale-[0.98]"
          >
            <Navigation className="h-4 w-4" />
            Open Trips
          </Link>
        ) : undefined}
        moreActionItems={moreActionItems}
      />
      <WorkspaceTabs items={visibleTabs} />
      <main>{children}</main>
    </DashboardPageShell>
  );
}
