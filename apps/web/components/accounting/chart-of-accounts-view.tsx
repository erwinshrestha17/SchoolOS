'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Landmark, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { SectionCard } from '../ui/section-card';
import { PageState } from '../ui/page-state';
import { ReportTable } from './report-table';
import { useState } from 'react';
import { OpeningBalanceDialog } from './opening-balance-dialog';

export function ChartOfAccountsView() {
  const queryClient = useQueryClient();
  const [openingBalOpen, setOpeningBalOpen] = useState(false);
  const [selectedFy, setSelectedFy] = useState<any>(null);

  const accountsQuery = useQuery({ 
    queryKey: ['chart-accounts'], 
    queryFn: () => api.listChartAccounts() 
  });

  const fiscalYearsQuery = useQuery({ 
    queryKey: ['fiscal-years'], 
    queryFn: () => api.listFiscalYears() 
  });

  const seedMutation = useMutation({
    mutationFn: () => api.seedDefaultChartAccounts(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['chart-accounts'] });
    },
  });

  if (accountsQuery.isLoading) {
    return (
      <PageState
        tone="loading"
        title="Loading Chart of Accounts"
        description="Fetching your school's financial account structure."
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => {
            const openFy = (fiscalYearsQuery.data ?? []).find(y => y.status === 'OPEN');
            if (openFy) {
              setSelectedFy(openFy);
              setOpeningBalOpen(true);
            } else {
              alert('No open fiscal year found to record opening balance.');
            }
          }}
          className="inline-flex items-center gap-2 rounded-2xl bg-primary-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary-600/20 hover:bg-primary-700 transition-all"
        >
          <Plus size={18} />
          Opening Balance
        </button>
      </div>

      <SectionCard
        title="Chart of Accounts"
        description="Manage your school's financial account structure and system defaults."
        headerAction={
          <button
            type="button"
            disabled={seedMutation.isPending}
            onClick={() => {
              if (window.confirm('This will seed default accounts. Continue?')) {
                seedMutation.mutate();
              }
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            <Landmark size={16} />
            {seedMutation.isPending ? 'Seeding...' : 'Seed defaults'}
          </button>
        }
      >
        <ReportTable
          headers={['Code', 'Name', 'Group', 'Kind']}
          rows={(accountsQuery.data ?? []).map((account) => ({
            id: account.id,
            cells: [
              { value: account.code, bold: true },
              { value: account.name },
              { value: account.type },
              { value: account.isSystem ? 'System' : 'Custom' }
            ],
          }))}
        />
      </SectionCard>

      <OpeningBalanceDialog
        isOpen={openingBalOpen}
        onClose={() => setOpeningBalOpen(false)}
        fiscalYear={selectedFy}
        accounts={accountsQuery.data ?? []}
      />
    </div>
  );
}
