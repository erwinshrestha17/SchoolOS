'use client';

import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, History, BarChart3, Landmark, Wallet, Settings, Waypoints } from 'lucide-react';
import { useSession } from '../../../components/session-provider';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { WorkspaceTabs } from '../../../components/ui/module-tabs';
import { ModuleHeader } from '../../../components/ui/module-header';
import { Button } from '../../../components/ui/button';

export default function AccountingLayout({ children }: { children: ReactNode }) {
  const { session, hasPermissions } = useSession();
  const router = useRouter();
  const canCreateJournal = hasPermissions(['accounting:journals:create']);

  const navItems = [
    { href: '/dashboard/accounting', label: 'Overview', icon: LayoutDashboard },
    { href: '/dashboard/accounting/chart-of-accounts', label: 'Chart of Accounts', icon: Landmark },
    { href: '/dashboard/accounting/journals', label: 'Journals', icon: History },
    { href: '/dashboard/accounting/fiscal-periods', label: 'Fiscal Periods', icon: Settings },
    { href: '/dashboard/accounting/reports', label: 'Reports', icon: BarChart3 },
    { href: '/dashboard/accounting/budgets', label: 'Budgets', icon: Wallet },
    { href: '/dashboard/accounting/reconciliation', label: 'Reconciliation', icon: Wallet },
    { href: '/dashboard/accounting/source-mappings', label: 'Source Mappings', icon: Waypoints },
    { href: '/dashboard/accounting/audit', label: 'Audit Trail', icon: History },
  ];

  return (
    <DashboardPageShell>
      <ModuleHeader
        eyebrow="Staff & Finance"
        title="Accounting & Finance"
        description={`Manage fiscal periods, chart of accounts, immutable journal postings, reconciliation, audit trail, and financial statements for ${session?.tenant.name || 'your school'}.`}
        primaryAction={canCreateJournal ? (
          <Button
            type="button"
            size="sm"
            onClick={() => router.push('/dashboard/accounting/journals')}
            className="gap-2"
          >
            <History className="h-4 w-4" />
            New Journal Entry
          </Button>
        ) : undefined}
        moreActionItems={[
          {
            label: 'Bank Reconciliation',
            icon: <Landmark className="h-4 w-4" />,
            onClick: () => router.push('/dashboard/accounting/reconciliation'),
          },
          {
            label: 'Financial Reports',
            icon: <BarChart3 className="h-4 w-4" />,
            onClick: () => router.push('/dashboard/accounting/reports'),
          },
          {
            label: 'Fiscal Periods',
            icon: <Settings className="h-4 w-4" />,
            onClick: () => router.push('/dashboard/accounting/fiscal-periods'),
          },
        ]}
      />
      <WorkspaceTabs items={navItems} />
      <main>
        {children}
      </main>
    </DashboardPageShell>
  );
}
