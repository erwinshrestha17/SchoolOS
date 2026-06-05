'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CollectionSection } from '@/components/finance/collection-section';
import { LedgerSection } from '@/components/finance/ledger-section';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Wallet, Receipt, Settings, BarChart3, Calculator, History, FileText, Percent, Database, Play } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { DuesAnalysisSection } from '@/components/finance/dues-analysis-section';
import { DefaulterAgingSummary } from '@/components/finance/defaulter-aging-summary';
import { CashierCloseSection } from '@/components/finance/cashier-close-section';
import { useSession } from '@/components/session-provider';
import type { InvoiceSummary } from '@schoolos/core';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';

// Parity Sub-Tabs Imports
import { FeeSetupTab } from '@/components/finance/fee-setup-tab';
import { DiscountsWaiversTab } from '@/components/finance/discounts-waivers-tab';
import { BillingRunsTab } from '@/components/finance/billing-runs-tab';
import { DefaulterQueueTab } from '@/components/finance/defaulter-queue-tab';


type InvoiceWithOutstanding = InvoiceSummary & {
  outstandingAmount?: number;
};

export default function FinancePage() {
  const { session } = useSession();
  const searchParams = useSearchParams();
  const initialInvoiceId = searchParams.get('invoiceId');
  const invoicesQuery = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.listInvoices(),
  });

  const invoices: InvoiceWithOutstanding[] = invoicesQuery.data ?? [];
  const totalOutstanding = invoices.reduce(
    (sum, invoice) =>
      sum +
      (invoice.outstandingAmount ??
        Math.max(0, invoice.totalAmount - (invoice.paidAmount ?? 0))),
    0,
  );
  const totalInvoices = invoices.length;
  const paidInvoices = invoices.filter(inv => inv.status === 'PAID').length;
  const collectionRate = totalInvoices > 0 ? Math.round((paidInvoices / totalInvoices) * 100) : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NP', {
      style: 'currency',
      currency: 'NPR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Fees & Receipts"
        description={`Collect student fees, close cashier days, and review outstanding dues${session?.tenant.name ? ` for ${session.tenant.name}` : ''}.`}
      />

      <div className="grid gap-6 md:grid-cols-3">
        <StatCard
          title="Total Outstanding"
          value={formatCurrency(totalOutstanding)}
          icon={<Wallet size={18} />}
          loading={invoicesQuery.isLoading}
          tone="warning"
        />
        <StatCard
          title="Collection Rate"
          value={`${collectionRate}%`}
          loading={invoicesQuery.isLoading}
          tone={collectionRate >= 80 ? 'success' : 'warning'}
          trend={{
            value: collectionRate,
            label: 'Total paid',
            isUp: collectionRate >= 80
          }}
        />
        <StatCard
          title="Active Invoices"
          value={String(totalInvoices)}
          loading={invoicesQuery.isLoading}
          icon={<Receipt size={18} />}
          tone="neutral"
        />
      </div>

      <Tabs defaultValue="collection" className="space-y-8">
        <div className="flex items-center justify-between">
          <TabsList className="h-auto gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
            {[
              { value: 'collection', label: 'Counter', icon: <Calculator size={14} /> },
              { value: 'close', label: 'Day End', icon: <History size={14} /> },
              { value: 'ledger', label: 'Ledger', icon: <FileText size={14} /> },
              { value: 'reports', label: 'Analysis', icon: <BarChart3 size={14} /> },
              { value: 'setup', label: 'Setup', icon: <Settings size={14} /> },
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex items-center gap-2 rounded-lg bg-transparent px-6 py-2.5 font-bold text-slate-500 shadow-none transition-all hover:bg-slate-100 hover:text-slate-900 data-[state=active]:bg-[var(--color-mod-fees-accent)] data-[state=active]:text-white data-[state=active]:shadow-sm"
              >
                {tab.icon}
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="collection" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <CollectionSection invoices={invoices} isLoading={invoicesQuery.isLoading} initialInvoiceId={initialInvoiceId} />
        </TabsContent>

        <TabsContent value="close" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <CashierCloseSection />
        </TabsContent>

        <TabsContent value="ledger" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <LedgerSection />
        </TabsContent>

        <TabsContent value="reports" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <DefaulterAgingSummary />
          <DefaulterQueueTab />
          <DuesAnalysisSection />
        </TabsContent>

        <TabsContent value="setup" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <Tabs defaultValue="heads-plans" className="space-y-6">
            <div className="flex justify-center sm:justify-start border-b border-slate-100 pb-2">
              <TabsList className="rounded-xl border border-slate-100 bg-slate-50 p-1">
                <TabsTrigger value="heads-plans" className="flex items-center gap-2 rounded-lg bg-transparent px-4 py-2 text-xs font-bold text-slate-500 shadow-none hover:text-slate-900 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <Database size={12} />
                  Heads & Plans
                </TabsTrigger>
                <TabsTrigger value="discounts" className="flex items-center gap-2 rounded-lg bg-transparent px-4 py-2 text-xs font-bold text-slate-500 shadow-none hover:text-slate-900 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <Percent size={12} />
                  Discounts & Waivers
                </TabsTrigger>
                <TabsTrigger value="billing-runs" className="flex items-center gap-2 rounded-lg bg-transparent px-4 py-2 text-xs font-bold text-slate-500 shadow-none hover:text-slate-900 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <Play size={12} />
                  Billing Runs
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="heads-plans" className="animate-in fade-in duration-300">
              <FeeSetupTab />
            </TabsContent>

            <TabsContent value="discounts" className="animate-in fade-in duration-300">
              <DiscountsWaiversTab />
            </TabsContent>

            <TabsContent value="billing-runs" className="animate-in fade-in duration-300">
              <BillingRunsTab />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
