import { Utensils } from 'lucide-react';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { ModuleHero } from '../../../components/dashboard/module-hero';
import { ModuleTabs } from '../../../components/dashboard/module-tabs';
import { CanteenWorkspace } from '../../../components/canteen/canteen-workspace';

const canteenTabs = [
  { label: 'Overview', href: '/dashboard/canteen' },
  { label: 'Menu', href: '/dashboard/canteen/menu' },
  { label: 'Meal Plans', href: '/dashboard/canteen/plans' },
  { label: 'Enrollments', href: '/dashboard/canteen/enrollments' },
  { label: 'Serving', href: '/dashboard/canteen/serving' },
  { label: 'Wallets', href: '/dashboard/canteen/wallets' },
  { label: 'POS', href: '/dashboard/canteen/pos' },
  { label: 'Controls', href: '/dashboard/canteen/controls' },
  { label: 'Inventory', href: '/dashboard/canteen/inventory' },
  { label: 'Reports', href: '/dashboard/canteen/reports' },
];

export default function CanteenPage() {
  return (
    <DashboardPageShell>
      <ModuleHero
        title="Canteen Management"
        subtitle="Manage menu items, meal plans, enrollments, meal serving, wallets, POS sales, spending controls, and reports."
        badge="Canteen"
        category="School Operations"
        icon={<Utensils size={28} />}
        accentColor="amber"
        tabs={<ModuleTabs items={canteenTabs} accentColor="amber" />}
      />
      <CanteenWorkspace initialTab="overview" />
    </DashboardPageShell>
  );
}
