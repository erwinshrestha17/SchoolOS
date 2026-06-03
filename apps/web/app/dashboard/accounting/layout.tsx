'use client';

import { ReactNode } from 'react';
import { Calculator, LayoutDashboard, History, BarChart3, Landmark, Wallet, Settings } from 'lucide-react';
import { useSession } from '../../../components/session-provider';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { ModuleHero } from '../../../components/dashboard/module-hero';
import { ModuleTabs } from '../../../components/dashboard/module-tabs';

export default function AccountingLayout({ children }: { children: ReactNode }) {
  const { session } = useSession();

  const navItems = [
    { href: '/dashboard/accounting', label: 'Overview', icon: LayoutDashboard },
    { href: '/dashboard/accounting/journals', label: 'Journals', icon: History },
    { href: '/dashboard/accounting/accounts', label: 'Chart of Accounts', icon: Landmark },
    { href: '/dashboard/accounting/reports', label: 'Reports', icon: BarChart3 },
    { href: '/dashboard/accounting/reconciliation', label: 'Reconciliation', icon: Wallet },
    { href: '/dashboard/accounting/management', label: 'Fiscal Management', icon: Settings },
    { href: '/dashboard/accounting/audit', label: 'Audit Trail', icon: History },
  ];

  const tabs = <ModuleTabs items={navItems} accentColor="emerald" variant="dark" />;

  return (
    <DashboardPageShell>
      <ModuleHero
        title="Financial Workspace"
        subtitle={`Manage chart of accounts, journal postings, and generate financial statements for ${session?.tenant.name || 'your school'}.`}
        badge="Accounting"
        category="Double-Entry Ledger"
        icon={<Calculator size={32} className="text-emerald-400" />}
        accentColor="emerald"
        variant="dark"
        tabs={tabs}
      />
      <main>
        {children}
      </main>
    </DashboardPageShell>
  );
}
