'use client';

import type { PermissionKey } from '@schoolos/core';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  AlertTriangle,
  BookOpen,
  Bus,
  Clock3,
  CreditCard,
  MapPin,
  Play,
  Utensils,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DashboardPageShell } from '@/components/dashboard/dashboard-page-shell';
import { ModuleHeader } from '@/components/ui/module-header';
import { KpiCard, KpiGrid } from '@/components/ui/kpi-card';
import { ModuleTabs } from '@/components/ui/module-tabs';
import { SectionCard } from '@/components/ui/section-card';
import { PermissionState } from '@/components/ui/permission-state';
import { useSession } from '@/components/session-provider';
import { canteenApi } from '@/lib/api/canteen';
import { libraryApi } from '@/lib/api/library';
import { transportApi } from '@/lib/api/transport';

function safeValue(error: boolean, loading: boolean, value?: number) {
  if (loading) return 'Loading';
  if (error || value === undefined) return 'Unavailable';
  return value;
}

export default function OperationsPage() {
  const router = useRouter();
  const { session } = useSession();
  const grantedPermissions = new Set<PermissionKey>(
    session?.user.permissions ?? [],
  );
  const hasAnyPermission = (permissions: PermissionKey[]) =>
    permissions.some((permission) => grantedPermissions.has(permission));
  const canUseLibrary = hasAnyPermission(['library:read', 'library:manage']);
  const canUseTransport = hasAnyPermission([
    'transport:read',
    'transport:manage',
    'transport:operate',
  ]);
  const canUseCanteen = hasAnyPermission([
    'canteen:menu:read',
    'canteen:plans:read',
    'canteen:enrollments:read',
  ]);

  const overdueQuery = useQuery({
    queryKey: ['operations', 'library', 'overdue'],
    queryFn: () => libraryApi.getOverdueBooksReport(),
    enabled: canUseLibrary,
  });
  const transportSummaryQuery = useQuery({
    queryKey: ['operations', 'transport', 'summary'],
    queryFn: () => transportApi.getReports(),
    enabled: canUseTransport,
  });
  const staleGpsQuery = useQuery({
    queryKey: ['operations', 'transport', 'stale-gps'],
    queryFn: () => transportApi.getStaleGpsReport(),
    enabled: canUseTransport,
  });
  const mealCountQuery = useQuery({
    queryKey: ['operations', 'canteen', 'meal-count'],
    queryFn: () => canteenApi.getDailyMealCountReport(),
    enabled: canUseCanteen,
  });
  const lowWalletsQuery = useQuery({
    queryKey: ['operations', 'canteen', 'low-wallets'],
    queryFn: () => canteenApi.getLowBalanceWallets(),
    enabled: canUseCanteen,
  });

  if (!canUseLibrary && !canUseTransport && !canUseCanteen) {
    return (
      <PermissionState
        title="School operations are restricted"
        description="You do not have permission to open Library, Transport, or Canteen operations."
      />
    );
  }

  const mealsServed = mealCountQuery.data?.reduce(
    (total, row) => total + row._count._all,
    0,
  );
  const staleGpsAlerts = staleGpsQuery.data?.items.filter(
    (item) => item.isStale,
  ).length;
  const primaryHref = canUseLibrary
    ? '/dashboard/library'
    : canUseTransport
      ? '/dashboard/transport'
      : '/dashboard/canteen';

  return (
    <DashboardPageShell>
      <ModuleHeader
        title="School Operations"
        description="Monitor library, transport, and canteen operations from one hub."
        primaryAction={
          <Link
            href={primaryHref}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--primary-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)] focus:ring-offset-2"
          >
            <Play className="h-4 w-4" />
            Open Operations
          </Link>
        }
        moreActionItems={[
          ...(canUseLibrary
            ? [{ label: 'Library', icon: <BookOpen className="h-4 w-4" />, onClick: () => router.push('/dashboard/library') }]
            : []),
          ...(canUseTransport
            ? [{ label: 'Transport', icon: <Bus className="h-4 w-4" />, onClick: () => router.push('/dashboard/transport') }]
            : []),
          ...(canUseCanteen
            ? [{ label: 'Canteen', icon: <Utensils className="h-4 w-4" />, onClick: () => router.push('/dashboard/canteen') }]
            : []),
        ]}
      >
        <KpiGrid className="sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <KpiCard title="Books Issued Today" value={canUseLibrary ? 'Unavailable' : 'Restricted'} icon={<BookOpen size={20} />} tone="neutral" description="A date-bounded issue summary is not available." />
          <KpiCard title="Active Trips" value={canUseTransport ? safeValue(transportSummaryQuery.isError, transportSummaryQuery.isLoading, transportSummaryQuery.data?.activeTrips) : 'Restricted'} icon={<Bus size={20} />} tone="info" description="Backend transport report." />
          <KpiCard title="Meals Served" value={canUseCanteen ? safeValue(mealCountQuery.isError, mealCountQuery.isLoading, mealsServed) : 'Restricted'} icon={<Utensils size={20} />} tone="success" description="Backend daily meal-count report." />
          <KpiCard title="Overdue Books" value={canUseLibrary ? safeValue(overdueQuery.isError, overdueQuery.isLoading, overdueQuery.data?.meta.total) : 'Restricted'} icon={<Clock3 size={20} />} tone="warning" description="Backend overdue report total." />
          <KpiCard title="Stale GPS Alerts" value={canUseTransport ? safeValue(staleGpsQuery.isError, staleGpsQuery.isLoading, staleGpsAlerts) : 'Restricted'} icon={<MapPin size={20} />} tone="warning" description="Stale records are never presented as live." />
          <KpiCard title="Low Wallets" value={canUseCanteen ? safeValue(lowWalletsQuery.isError, lowWalletsQuery.isLoading, lowWalletsQuery.data?.length) : 'Restricted'} icon={<CreditCard size={20} />} tone="warning" description="Backend low-balance report." />
        </KpiGrid>
      </ModuleHeader>

      <ModuleTabs
        items={[
          { href: '/dashboard/operations', label: 'Overview', icon: Play },
          ...(canUseLibrary ? [{ href: '/dashboard/library', label: 'Library', icon: BookOpen }] : []),
          ...(canUseTransport ? [{ href: '/dashboard/transport', label: 'Transport', icon: Bus }] : []),
          ...(canUseCanteen ? [{ href: '/dashboard/canteen', label: 'Canteen', icon: Utensils }] : []),
          { href: '/dashboard/reports', label: 'Reports', icon: AlertTriangle },
        ]}
        accentColor="blue"
        variant="light"
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        {canUseLibrary ? (
          <SectionCard title="Library" description="Issue, return, overdue, and borrower workflows.">
            <p className="text-3xl font-black tabular-nums text-slate-950">
              {safeValue(overdueQuery.isError, overdueQuery.isLoading, overdueQuery.data?.meta.total)}
            </p>
            <p className="mt-1 text-sm text-slate-500">Overdue books from the backend report.</p>
            <Link href="/dashboard/library/issue-return" className="mt-5 inline-flex text-sm font-bold text-[var(--primary-dark)]">Open issue / return</Link>
          </SectionCard>
        ) : null}
        {canUseTransport ? (
          <SectionCard title="Transport" description="Trips, route status, and explicit GPS freshness.">
            <p className="text-3xl font-black tabular-nums text-slate-950">
              {safeValue(transportSummaryQuery.isError, transportSummaryQuery.isLoading, transportSummaryQuery.data?.activeTrips)}
            </p>
            <p className="mt-1 text-sm text-slate-500">Active trips from the backend report.</p>
            <Link href="/dashboard/transport/live-status" className="mt-5 inline-flex text-sm font-bold text-[var(--primary-dark)]">View trip status</Link>
          </SectionCard>
        ) : null}
        {canUseCanteen ? (
          <SectionCard title="Canteen" description="POS, menu, serving, and wallet workflows.">
            <p className="text-3xl font-black tabular-nums text-slate-950">
              {safeValue(mealCountQuery.isError, mealCountQuery.isLoading, mealsServed)}
            </p>
            <p className="mt-1 text-sm text-slate-500">Meals served from the backend daily report.</p>
            <Link href="/dashboard/canteen/pos" className="mt-5 inline-flex text-sm font-bold text-[var(--primary-dark)]">Open POS</Link>
          </SectionCard>
        ) : null}
      </div>
    </DashboardPageShell>
  );
}
