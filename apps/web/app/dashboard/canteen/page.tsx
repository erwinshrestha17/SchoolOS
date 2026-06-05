import Link from 'next/link';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { ModuleTabs } from '../../../components/dashboard/module-tabs';
import { CanteenWorkspace } from '../../../components/canteen/canteen-workspace';
import { PageHeader } from '../../../components/ui/page-header';

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
  const headerActions = (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/dashboard/canteen/pos"
        className="inline-flex h-10 items-center justify-center rounded-xl bg-lime-700 px-4 text-sm font-bold text-white hover:bg-lime-800"
      >
        POS
      </Link>
      <Link
        href="/dashboard/canteen/serving"
        className="inline-flex h-10 items-center justify-center rounded-xl border border-lime-100 bg-white px-4 text-sm font-bold text-lime-700 hover:bg-lime-50"
      >
        Serving
      </Link>
    </div>
  );

  return (
    <DashboardPageShell>
      <PageHeader
        title="Canteen"
        description="Run scanner-first POS and serving workflows with wallet, allergy, spending limit, inventory, vendor, and receipt states visible."
        actions={headerActions}
      />
      <div className="mb-6">
        <ModuleTabs items={canteenTabs} accentColor="lime" variant="light" />
      </div>
      <CanteenWorkspace initialTab="overview" />
    </DashboardPageShell>
  );
}
