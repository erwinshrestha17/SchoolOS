'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QrCode, Utensils } from 'lucide-react';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { WorkspaceTabs } from '../../../components/ui/module-tabs';
import { CanteenWorkspace } from '../../../components/canteen/canteen-workspace';
import { ModuleHeader } from '../../../components/ui/module-header';

const canteenTabs = [
  { label: 'Overview', href: '/dashboard/canteen' },
  { label: 'Menu', href: '/dashboard/canteen/menu' },
  { label: 'Meal Plans', href: '/dashboard/canteen/meal-plans' },
  { label: 'Enrollments', href: '/dashboard/canteen/enrollments' },
  { label: 'Serving', href: '/dashboard/canteen/serving' },
  { label: 'Wallets', href: '/dashboard/canteen/wallets' },
  { label: 'POS', href: '/dashboard/canteen/pos' },
  { label: 'Controls', href: '/dashboard/canteen/controls' },
  { label: 'Inventory', href: '/dashboard/canteen/inventory' },
  { label: 'Vendors', href: '/dashboard/canteen/vendors' },
  { label: 'Reports', href: '/dashboard/canteen/reports' },
];

export default function CanteenPage() {
  const router = useRouter();

  return (
    <DashboardPageShell>
      <ModuleHeader
        eyebrow="School Operations"
        title="Canteen"
        description="Run scanner-first POS and serving workflows with wallet, allergy, spending limit, inventory, vendor, and receipt states visible."
        primaryAction={
          <Link
            href="/dashboard/canteen/pos"
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--primary-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)] focus:ring-offset-2"
          >
            <QrCode className="h-4 w-4" />
            Open POS
          </Link>
        }
        moreActionItems={[
          {
            label: 'Open serving counter',
            icon: <Utensils className="h-4 w-4" />,
            onClick: () => router.push('/dashboard/canteen/serving'),
          },
        ]}
      />
      <WorkspaceTabs items={canteenTabs} />
      <CanteenWorkspace initialTab="overview" />
    </DashboardPageShell>
  );
}
