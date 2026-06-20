'use client';

import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Calculator,
  FileText,
  History,
  Receipt,
  Settings,
  ShieldAlert,
  Wallet,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CashierCloseSection } from '@/components/finance/cashier-close-section';
import { CollectionSection } from '@/components/finance/collection-section';
import { DefaulterAgingSummary } from '@/components/finance/defaulter-aging-summary';
import { DefaulterQueueTab } from '@/components/finance/defaulter-queue-tab';
import { DiscountsWaiversTab } from '@/components/finance/discounts-waivers-tab';
import { DuesAnalysisSection } from '@/components/finance/dues-analysis-section';
import { FeeSetupTab } from '@/components/finance/fee-setup-tab';
import { BillingRunsTab } from '@/components/finance/billing-runs-tab';
import { LedgerSection } from '@/components/finance/ledger-section';
import { DashboardPageShell } from '@/components/dashboard/dashboard-page-shell';
import { KpiCard, KpiGrid } from '@/components/ui/kpi-card';
import { ModuleHeader } from '@/components/ui/module-header';
import { ModuleTabs } from '@/components/ui/module-tabs';
import { PermissionState } from '@/components/ui/permission-state';
import { api } from '@/lib/api';
import { useSession } from '@/components/session-provider';

type FinanceTab =
  | 'collection'
  | 'ledger'
  | 'reversals'
  | 'close'
  | 'reports'
  | 'setup';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-NP', {
    style: 'currency',
    currency: 'NPR',
    maximumFractionDigits: 0,
  }).format(amount);

export default function FinancePage() {
  const { hasPermissions, session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialInvoiceId = searchParams.get('invoiceId');
  const studentId = searchParams.get('studentId');
  const source = searchParams.get('source');
  const isStudentProfileSource = source === 'student-profile' && Boolean(studentId);

  const canCollectPayments = hasPermissions(['payments:collect']);
  const canManageFees = hasPermissions(['fees:manage']);
  const canReadReceipts = hasPermissions(['receipts:read']);
  const canCloseCashier = hasPermissions(['payments:close']);
  const [activeTab, setActiveTab] = useState<FinanceTab>(() =>
    canCollectPayments
      ? 'collection'
      : canManageFees
        ? 'ledger'
        : canCloseCashier
          ? 'close'
          : 'collection',
  );

  const invoicesQuery = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.listInvoices(),
    enabled: canCollectPayments && !studentId,
  });
  const studentCollectionContextQuery = useQuery({
    queryKey: ['student-collection-context', studentId],
    queryFn: () => {
      if (!studentId) {
        throw new Error('Student context is unavailable.');
      }

      return api.getStudentCollectionContext(studentId);
    },
    enabled: canCollectPayments && Boolean(studentId),
  });
  const defaultersQuery = useQuery({
    queryKey: ['defaulters', 'workspace-summary'],
    queryFn: () => api.listDefaulters(),
    enabled: canManageFees,
  });

  const selectTab = (tab: FinanceTab) => {
    setActiveTab(tab);
    window.requestAnimationFrame(() => {
      document.getElementById('finance-workspace')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  useEffect(() => {
    if (studentId && canCollectPayments) {
      setActiveTab('collection');
    }
  }, [canCollectPayments, studentId]);

  const handleChangeStudent = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('studentId');
    params.delete('source');
    const query = params.toString();
    router.replace(query ? `/dashboard/finance?${query}` : '/dashboard/finance', {
      scroll: false,
    });
    setActiveTab('collection');
  };

  const tabs = [
    ...(canCollectPayments
      ? [
          {
            value: 'collection',
            label: 'Collection',
            icon: Wallet,
          },
        ]
      : []),
    ...(canManageFees && canReadReceipts
      ? [
          {
            value: 'ledger',
            label: 'Ledger & Receipts',
            icon: Receipt,
          },
        ]
      : []),
    ...(canManageFees
      ? [
          { value: 'setup', label: 'Discounts & Setup', icon: Settings },
          {
            value: 'reversals',
            label: 'Refunds / Reversals',
            icon: ShieldAlert,
          },
        ]
      : []),
    ...(canCloseCashier
      ? [
          {
            value: 'close',
            label: 'Cashier Close',
            icon: History,
          },
        ]
      : []),
    ...(canManageFees
      ? [
          {
            value: 'reports',
            label: 'Reports',
            icon: BarChart3,
          },
        ]
      : []),
  ];

  return (
    <DashboardPageShell>
      <ModuleHeader
        title="Fees & Receipts"
        description={`Collect fees, issue protected receipts, follow up dues, and close the cashier with an auditable trail${session?.tenant.name ? ` for ${session.tenant.name}` : ''}.`}
        primaryAction={
          canCollectPayments ? (
            <button
              type="button"
              onClick={() => selectTab('collection')}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-mod-fees-accent)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-mod-fees-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-fees-border)] focus:ring-offset-2"
            >
              <Calculator size={18} />
              Record Payment
            </button>
          ) : undefined
        }
        moreActionItems={[
          ...(canReadReceipts
            ? [
                {
                  label: 'Receipt History & Reprint',
                  icon: <Receipt size={16} />,
                  onClick: () => selectTab('ledger'),
                },
              ]
            : []),
          ...(canCloseCashier
            ? [
                {
                  label: 'Cashier Close',
                  icon: <History size={16} />,
                  onClick: () => selectTab('close'),
                },
              ]
            : []),
          ...(canManageFees
            ? [
                {
                  label: 'Reports & Exports',
                  icon: <BarChart3 size={16} />,
                  onClick: () => selectTab('reports'),
                },
                {
                  label: 'Overdue Reminders',
                  icon: <FileText size={16} />,
                  onClick: () => selectTab('reports'),
                },
                {
                  label: 'Fee Setup & Templates',
                  icon: <Settings size={16} />,
                  onClick: () => selectTab('setup'),
                },
              ]
            : []),
        ]}
      >
        <KpiGrid className="sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <KpiCard title="Collected Today" value="Unavailable" icon={<Wallet size={20} />} tone="neutral" description="Needs a real M3 daily summary API." />
          <KpiCard title="Total Due" value="Unavailable" icon={<Wallet size={20} />} tone="neutral" description="No whole-school summary contract is exposed." />
          <KpiCard
            title="Overdue Students"
            value={!canManageFees ? 'Restricted' : defaultersQuery.isLoading ? 'Loading' : defaultersQuery.data?.total ?? 'Unavailable'}
            icon={<FileText size={20} />}
            tone={defaultersQuery.data?.total ? 'warning' : 'neutral'}
            description={
              defaultersQuery.data
                ? `${formatCurrency(defaultersQuery.data.totalOutstanding)} outstanding.`
                : 'Backend defaulter summary.'
            }
          />
          <KpiCard title="Pending Reversals" value="Unavailable" icon={<ShieldAlert size={20} />} tone="neutral" description="Needs an approval-summary contract." />
          <KpiCard title="Cashier Close Status" value={!canCloseCashier ? 'Restricted' : 'Unavailable'} icon={<History size={20} />} tone="neutral" description="Open the backend-backed close workspace." />
          <KpiCard title="Receipts Issued" value={!canReadReceipts ? 'Restricted' : 'Unavailable'} icon={<Receipt size={20} />} tone="neutral" description="Needs a bounded daily receipt summary." />
        </KpiGrid>
      </ModuleHeader>

      <div id="finance-workspace" className="scroll-mt-24 space-y-6">
        <ModuleTabs items={tabs} activeValue={activeTab} onValueChange={(value) => setActiveTab(value as FinanceTab)} accentColor="amber" variant="light" />

        <div className="min-h-[420px]">
          {activeTab === 'collection' ? (
            canCollectPayments ? (
              <CollectionSection
                invoices={invoicesQuery.data ?? []}
                isLoading={
                  studentId
                    ? studentCollectionContextQuery.isLoading
                    : invoicesQuery.isLoading
                }
                isError={
                  studentId
                    ? studentCollectionContextQuery.isError
                    : invoicesQuery.isError
                }
                onRetry={() => {
                  if (studentId) {
                    void studentCollectionContextQuery.refetch();
                    return;
                  }
                  void invoicesQuery.refetch();
                }}
                initialInvoiceId={initialInvoiceId}
                studentCollectionContext={
                  studentCollectionContextQuery.data ?? null
                }
                hasStudentCollectionContextRequest={Boolean(studentId)}
                isStudentProfileSource={isStudentProfileSource}
                onChangeStudent={handleChangeStudent}
              />
            ) : (
              <PermissionState title="Fee collection is restricted" description="You do not have permission to collect payments. Contact the school administrator if you need cashier access." />
            )
          ) : null}
          {(activeTab === 'ledger' || activeTab === 'reversals') && canManageFees && canReadReceipts ? <LedgerSection /> : null}
          {activeTab === 'close' && canCloseCashier ? <CashierCloseSection /> : null}
          {activeTab === 'reports' && canManageFees ? <div className="space-y-8"><DefaulterAgingSummary /><DefaulterQueueTab /><DuesAnalysisSection /></div> : null}
          {activeTab === 'setup' && canManageFees ? <div className="space-y-8"><FeeSetupTab /><DiscountsWaiversTab /><BillingRunsTab /></div> : null}
        </div>
      </div>
    </DashboardPageShell>
  );
}
