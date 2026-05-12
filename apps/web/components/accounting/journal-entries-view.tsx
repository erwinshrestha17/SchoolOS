'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Eye } from 'lucide-react';
import { api } from '../../lib/api';
import { SectionCard } from '../ui/section-card';
import { PageState } from '../ui/page-state';
import { ReportTable } from './report-table';
import { VoucherDialog } from './voucher-dialog';
import { JournalDetailDialog } from './journal-detail-dialog';
import { JournalEntryView } from '@schoolos/core';
import { cn } from '../../lib/utils';

export function JournalEntriesView() {
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntryView | null>(null);

  const accountsQuery = useQuery({ 
    queryKey: ['chart-accounts'], 
    queryFn: () => api.listChartAccounts() 
  });

  const journalsQuery = useQuery({
    queryKey: ['ledger-entries'],
    queryFn: () => api.listJournalEntries(),
  });

  const fiscalYearsQuery = useQuery({ 
    queryKey: ['fiscal-years'], 
    queryFn: () => api.listFiscalYears() 
  });

  const activePeriod = (fiscalYearsQuery.data ?? [])
    .find(y => y.status === 'OPEN')
    ?.periods?.find((p: any) => p.status === 'OPEN');

  const handleCreateVoucher = () => {
    if (!activePeriod) {
      alert('No active fiscal period found. Please open a period in Management first.');
      return;
    }
    setVoucherOpen(true);
  };

  if (journalsQuery.isLoading) {
    return (
      <PageState
        tone="loading"
        title="Loading journal entries"
        description="Fetching posted and draft journal records from the backend."
      />
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'POSTED': return 'text-emerald-600 bg-emerald-50';
      case 'DRAFT': return 'text-slate-600 bg-slate-50';
      case 'SUBMITTED': return 'text-amber-600 bg-amber-50';
      case 'REVERSED': return 'text-rose-600 bg-rose-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleCreateVoucher}
          className={cn(
            "inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white shadow-xl transition-all hover:-translate-y-0.5 active:translate-y-0",
            activePeriod ? "bg-slate-900 shadow-slate-900/20 hover:bg-slate-800" : "bg-slate-400 cursor-not-allowed opacity-70"
          )}
        >
          <Plus size={18} />
          Create Voucher
        </button>
      </div>

      <SectionCard
        title="All Journal Entries"
        description="Complete list of all financial postings in chronological order."
      >
        {journalsQuery.isError ? (
          <PageState
            tone="danger"
            title="Failed to load journal entries"
            description={journalsQuery.error?.message ?? 'Journal entries could not be loaded.'}
          />
        ) : (
          <ReportTable
            headers={['Date', 'Number', 'Narration', 'Type', 'Status', 'Amount', 'Action']}
            rows={(journalsQuery.data ?? []).map((entry) => ({
              id: entry.id,
              cells: [
                { value: entry.entryDate, type: 'date' },
                { value: entry.entryNumber, bold: true },
                { value: entry.narration },
                { value: entry.sourceType },
                { 
                  value: (
                    <span className={cn("rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-tighter", getStatusColor(entry.status))}>
                      {entry.status}
                    </span>
                  ) 
                },
                { value: entry.totalDebit || entry.totalCredit || 0, type: 'currency' },
                {
                  value: (
                    <button
                      onClick={() => setSelectedEntry(entry)}
                      className="p-2 text-slate-400 hover:text-primary-600 transition-colors"
                      title="View Details"
                    >
                      <Eye size={18} />
                    </button>
                  )
                }
              ],
            }))}
          />
        )}
      </SectionCard>

      <VoucherDialog 
        isOpen={voucherOpen} 
        onClose={() => setVoucherOpen(false)} 
        accounts={accountsQuery.data ?? []} 
      />

      <JournalDetailDialog
        isOpen={!!selectedEntry}
        onClose={() => setSelectedEntry(null)}
        entry={selectedEntry}
      />
    </div>
  );
}
