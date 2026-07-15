'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, History, BarChart3, Landmark, Wallet, Settings, Waypoints } from 'lucide-react';
import { useSession } from '../../../components/session-provider';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { WorkspaceTabs } from '../../../components/ui/module-tabs';
import { ModuleHeader } from '../../../components/ui/module-header';

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
    { href: '/dashboard/accounting/reconciliation', label: 'Reconciliation', icon: Wallet },
    { href: '/dashboard/accounting/source-mappings', label: 'Source Mappings', icon: Waypoints },
    { href: '/dashboard/accounting/audit', label: 'Audit Trail', icon: History },
  ];

  return (
    <DashboardPageShell>
      <ModuleHeader
        eyebrow="M11 Accounting and Finance"
        title="Accounting & Finance"
        description={`Manage fiscal periods, chart of accounts, immutable journal postings, reconciliation, audit trail, and financial statements for ${session?.tenant.name || 'your school'}.`}
        primaryAction={canCreateJournal ? (
          <Link
            href="/dashboard/accounting/journals"
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--primary-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)] focus:ring-offset-2"
          >
            <History className="h-4 w-4" />
            New Journal Entry
          </Link>
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
