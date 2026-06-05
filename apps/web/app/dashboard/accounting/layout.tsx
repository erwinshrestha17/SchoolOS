'use client';

import { ReactNode } from 'react';
import { LayoutDashboard, History, BarChart3, Landmark, Wallet, Settings } from 'lucide-react';
import { useSession } from '../../../components/session-provider';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { ModuleTabs } from '../../../components/dashboard/module-tabs';
import { PageHeader } from '../../../components/ui/page-header';

export default function AccountingLayout({ children }: { children: ReactNode }) {
  const { session } = useSession();

  const navItems = [
    { href: '/dashboard/accounting', label: 'Overview', icon: LayoutDashboard },
    { href: '/dashboard/accounting/chart-of-accounts', label: 'Chart of Accounts', icon: Landmark },
    { href: '/dashboard/accounting/journals', label: 'Journals', icon: History },
    { href: '/dashboard/accounting/fiscal-periods', label: 'Fiscal Periods', icon: Settings },
    { href: '/dashboard/accounting/reports', label: 'Reports', icon: BarChart3 },
    { href: '/dashboard/accounting/reconciliation', label: 'Reconciliation', icon: Wallet },
    { href: '/dashboard/accounting/audit', label: 'Audit Trail', icon: History },
  ];

  const tabs = <ModuleTabs items={navItems} accentColor="emerald" variant="light" />;

  return (
    <DashboardPageShell>
      <PageHeader
        title="Accounting"
        description={`Manage fiscal periods, chart of accounts, immutable journal postings, reconciliation, audit trail, and financial statements for ${session?.tenant.name || 'your school'}.`}
      />
      <div className="mb-6">{tabs}</div>
      <main>
        {children}
      </main>
    </DashboardPageShell>
  );
}
