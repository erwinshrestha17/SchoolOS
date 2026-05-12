'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CollectionSection } from '@/components/finance/collection-section';
import { LedgerSection } from '@/components/finance/ledger-section';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Wallet, Receipt, Settings, BarChart3, Calculator, History, FileText } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { DuesAnalysisSection } from '@/components/finance/dues-analysis-section';
import { DefaulterAgingSummary } from '@/components/finance/defaulter-aging-summary';
import { CashierCloseSection } from '@/components/finance/cashier-close-section';
import { Badge } from '@/components/ui/badge';
import { useSession } from '@/components/session-provider';
import type { InvoiceSummary } from '@schoolos/core';

type InvoiceWithOutstanding = InvoiceSummary & {
  outstandingAmount?: number;
};

export default function FinancePage() {
  const { session } = useSession();
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
      <header className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 px-6 py-10 text-white shadow-2xl lg:px-12">
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-primary-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />
        
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="phase2" className="bg-primary-500/20 text-primary-400 border-primary-500/20">
                Finance & Fees
              </Badge>
              <div className="h-1 w-1 rounded-full bg-white/30" />
              <span className="text-xs font-bold uppercase tracking-wider text-white/50">
                Billing & Collections
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
              Financial <span className="text-primary-400">Terminal</span>
            </h1>
            <p className="mt-4 text-lg text-slate-300 leading-relaxed">
              Track student fee collections, manage billing runs, and analyze outstanding dues for <span className="font-bold text-white">{session?.tenant.name}</span>.
            </p>
          </div>

          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 backdrop-blur-xl border border-white/10 shadow-inner">
            <Wallet size={40} className="text-primary-400" />
          </div>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <StatCard
          title="Total Outstanding"
          value={formatCurrency(totalOutstanding)}
          icon={<Wallet size={18} />}
          loading={invoicesQuery.isLoading}
        />
        <StatCard
          title="Collection Rate"
          value={`${collectionRate}%`}
          loading={invoicesQuery.isLoading}
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
        />
      </div>

      <Tabs defaultValue="collection" className="space-y-8">
        <div className="flex items-center justify-between">
          <TabsList className="h-auto gap-2 rounded-[2rem] border border-slate-100 bg-white/50 p-2 backdrop-blur-sm">
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
                className="flex items-center gap-2 rounded-[1.5rem] px-6 py-2.5 font-bold transition-all data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 bg-transparent shadow-none"
              >
                {tab.icon}
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="collection" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <CollectionSection invoices={invoices} isLoading={invoicesQuery.isLoading} />
        </TabsContent>

        <TabsContent value="close" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <CashierCloseSection />
        </TabsContent>

        <TabsContent value="ledger" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <LedgerSection />
        </TabsContent>

        <TabsContent value="reports" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <DefaulterAgingSummary />
          <DuesAnalysisSection />
        </TabsContent>

        <TabsContent value="setup" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
             <div className="h-20 w-20 rounded-[2rem] bg-slate-50 flex items-center justify-center text-slate-300 mb-6">
               <Settings size={40} />
             </div>
             <h4 className="text-xl font-bold text-slate-900">Fee Configuration</h4>
             <p className="text-sm text-slate-500 mt-2 max-w-xs text-center">Configure fee heads, billing plans, and discount rules in this high-level settings panel.</p>
             <button className="mt-8 px-8 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors">
                Initialize Setup
             </button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
