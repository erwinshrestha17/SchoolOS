'use client';

import { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  History,
  BarChart3,
  Landmark,
  Wallet,
  Settings,
  Waypoints,
  Receipt,
  HandCoins,
  BadgeDollarSign,
  ClipboardCheck,
  AlertTriangle,
} from 'lucide-react';
import { useSession } from '../../../components/session-provider';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { WorkspaceTabs } from '../../../components/ui/module-tabs';
import { ModuleHeader } from '../../../components/ui/module-header';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { accountingApi } from '../../../lib/api/accounting';

export default function AccountingLayout({ children }: { children: ReactNode }) {
  const { session, hasPermissions } = useSession();
  const router = useRouter();
  const canCreateJournal = hasPermissions(['accounting:journals:create']);
  const fiscalYearsQuery = useQuery({
    queryKey: ['accounting-shell-fiscal-context'],
    queryFn: accountingApi.listFiscalYears,
    staleTime: 60_000,
  });
  const activeFiscalYear = fiscalYearsQuery.data?.find(
    (fiscalYear) => fiscalYear.status === 'OPEN',
  );
  const activePeriod = activeFiscalYear?.periods?.find(
    (period) => period.status === 'OPEN',
  );
  const reopenedPeriod = activeFiscalYear?.periods?.find(
    (period) => period.reopenedWarning,
  );

  // FIN/UI-P0-01 freezes these eight destinations as the Accountant shell.
  // Supporting configuration and P1 surfaces remain available under More Actions.
  const navItems = [
    { href: '/dashboard/accounting', label: 'Finance Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/accounting/receivables', label: 'Fees & Receivables', icon: Receipt },
    { href: '/dashboard/accounting/collections', label: 'Collections & Receipts', icon: Wallet },
    { href: '/dashboard/accounting/cash-bank', label: 'Cash & Bank', icon: Landmark },
    { href: '/dashboard/accounting/payables', label: 'Expenses & Payables', icon: HandCoins },
    { href: '/dashboard/accounting/payroll-handoff', label: 'Payroll Handoff', icon: BadgeDollarSign },
    { href: '/dashboard/accounting/reports', label: 'Reports', icon: BarChart3 },
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
            label: 'Chart of Accounts',
            icon: <Landmark className="h-4 w-4" />,
            onClick: () => router.push('/dashboard/accounting/chart-of-accounts'),
          },
          {
            label: 'Journal Register',
            icon: <History className="h-4 w-4" />,
            onClick: () => router.push('/dashboard/accounting/journals'),
          },
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
          {
            label: 'Source Mappings',
            icon: <Waypoints className="h-4 w-4" />,
            onClick: () => router.push('/dashboard/accounting/source-mappings'),
          },
          {
            label: 'Budget workspace (P1)',
            icon: <ClipboardCheck className="h-4 w-4" />,
            onClick: () => router.push('/dashboard/accounting/budgets'),
          },
        ]}
      />
      <section
        aria-label="Current accounting context"
        aria-live="polite"
        className="flex flex-wrap items-center gap-2 border-x border-t border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700"
      >
        <span className="font-semibold text-slate-950">Fiscal context</span>
        {fiscalYearsQuery.isLoading ? (
          <span>Confirming the active fiscal year…</span>
        ) : fiscalYearsQuery.isError ? (
          <span className="text-rose-700">Fiscal context is unavailable. Posting actions remain blocked.</span>
        ) : activeFiscalYear ? (
          <>
            <Badge variant="outline">{activeFiscalYear.name}</Badge>
            <span>{activePeriod?.label ?? 'No open fiscal period'}</span>
            <span aria-hidden="true">·</span>
            <span>Accrual basis</span>
            <span aria-hidden="true">·</span>
            <span>Posted records</span>
          </>
        ) : (
          <span className="text-amber-800">No open fiscal year. Posting actions remain blocked.</span>
        )}
        {reopenedPeriod ? (
          <span className="ml-auto inline-flex items-center gap-1 font-medium text-amber-800">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            {reopenedPeriod.label} was reopened and must be relocked.
          </span>
        ) : null}
      </section>
      <WorkspaceTabs items={navItems} />
      <main>
        {children}
      </main>
    </DashboardPageShell>
  );
}
