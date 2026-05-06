'use client';

import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CollectionSection } from '@/components/finance/collection-section';
import { LedgerSection } from '@/components/finance/ledger-section';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Wallet, Receipt, Settings, BarChart3 } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { DuesAnalysisSection } from '@/components/finance/dues-analysis-section';
import { DefaulterAgingSummary } from '@/components/finance/defaulter-aging-summary';

export default function FinancePage() {
  const invoicesQuery = useQuery({
    queryKey: ['invoices'],
    queryFn: api.listInvoices,
  });

  const invoices = (invoicesQuery.data as any[]) || [];
  const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.outstandingAmount, 0);
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
        title="Finance & Fees"
        description="Manage fee collection, billing runs, and financial ledger posting."
      />

      <div className="grid gap-6 md:grid-cols-3">
        <StatCard
          title="Total Outstanding"
          value={formatCurrency(totalOutstanding)}
          icon={<Wallet size={18} />}
        />
        <StatCard
          title="Collection Rate"
          value={`${collectionRate}%`}
          trend={{
            value: collectionRate,
            label: 'Total paid',
            isUp: collectionRate >= 80
          }}
        />
        <StatCard
          title="Active Invoices"
          value={String(totalInvoices)}
        />
      </div>

      <Tabs defaultValue="collection" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="collection" className="flex items-center gap-2">
            <Wallet size={14} />
            Counter
          </TabsTrigger>
          <TabsTrigger value="ledger" className="flex items-center gap-2">
            <Receipt size={14} />
            Ledger
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <BarChart3 size={14} />
            Reports
          </TabsTrigger>
          <TabsTrigger value="setup" className="flex items-center gap-2">
            <Settings size={14} />
            Setup
          </TabsTrigger>
        </TabsList>

        <TabsContent value="collection" className="space-y-6 animate-in fade-in-50 duration-500">
          <CollectionSection invoices={invoices} isLoading={invoicesQuery.isLoading} />
        </TabsContent>

        <TabsContent value="ledger" className="space-y-6 animate-in fade-in-50 duration-500">
          <LedgerSection />
        </TabsContent>

        <TabsContent value="reports" className="space-y-6 animate-in fade-in-50 duration-500">
          <DefaulterAgingSummary />
          <DuesAnalysisSection />
          
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2rem] border border-dashed border-slate-200">
             <BarChart3 size={48} className="text-slate-300 mb-4" />
             <p className="text-sm font-bold text-slate-900">Collection Reports</p>
             <p className="text-xs text-slate-500 mt-1">Exportable collection reports are available in the Ledger tab.</p>
          </div>
        </TabsContent>

        <TabsContent value="setup" className="space-y-6 animate-in fade-in-50 duration-500">
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2rem] border border-dashed border-slate-200">
             <Settings size={48} className="text-slate-300 mb-4" />
             <p className="text-sm font-bold text-slate-900">Fee Configuration</p>
             <p className="text-xs text-slate-500 mt-1">Configure fee heads and billing plans here.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
