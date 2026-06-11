'use client';

import React from 'react';
import { SectionCard } from '@/components/ui/section-card';
import { FeeLedger } from './fee-ledger';
import { FilterBar } from '@/components/ui/filter-bar';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ReceiptVerificationPanel } from './receipt-verification-panel';

export function LedgerSection() {
  const invoicesQuery = useQuery({
    queryKey: ['invoices'],
    queryFn: api.listInvoices,
  });

  return (
    <div className="space-y-6">
      <ReceiptVerificationPanel />

      <FilterBar label="Ledger Filters">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          <input 
            type="text" 
            placeholder="Search by invoice or student..." 
            className="w-full text-sm bg-white border-slate-200 rounded-xl px-4 py-2"
          />
          <select className="w-full text-sm bg-white border-slate-200 rounded-xl px-4 py-2">
            <option value="">All Statuses</option>
            <option value="PAID">Paid</option>
            <option value="PARTIAL">Partial</option>
            <option value="UNPAID">Unpaid</option>
          </select>
          <select className="w-full text-sm bg-white border-slate-200 rounded-xl px-4 py-2">
            <option value="">All Academic Years</option>
          </select>
        </div>
      </FilterBar>

      <SectionCard title="Billing History" description="Comprehensive list of all invoices and their current status.">
        <FeeLedger 
          invoices={(invoicesQuery.data as any) || []} 
          isLoading={invoicesQuery.isLoading} 
        />
      </SectionCard>
    </div>
  );
}
