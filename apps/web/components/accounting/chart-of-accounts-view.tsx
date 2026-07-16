'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Landmark, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { SectionCard } from '../ui/section-card';
import { PageState } from '../ui/page-state';
import { ReportTable } from './report-table';
import { useState } from 'react';
import { OpeningBalanceDialog } from './opening-balance-dialog';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { Toast, type ToastTone } from '../ui/toast';

export function ChartOfAccountsView() {
  const queryClient = useQueryClient();
  const [openingBalOpen, setOpeningBalOpen] = useState(false);
  const [selectedFy, setSelectedFy] = useState<any>(null);
  const [seedConfirmOpen, setSeedConfirmOpen] = useState(false);
  const [notice, setNotice] = useState<{
    title: string;
    description?: string;
    tone: ToastTone;
  } | null>(null);

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
      setSeedConfirmOpen(false);
      setNotice({
        title: 'Default accounts seeded',
        description: 'The chart of accounts has been refreshed from system defaults.',
        tone: 'success',
      });
    },
    onError: (error: Error) => {
      setNotice({
        title: 'Could not seed accounts',
        description: error.message,
        tone: 'danger',
      });
    },
  });

  if (accountsQuery.isLoading) {
    return (
      <PageState
        tone="loading"
        title="Loading Chart of Accounts"
        description="Loading your school's financial account structure."
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => {
            const openFy = (fiscalYearsQuery.data ?? []).find(
              (y) => y.status === 'OPEN',
            );
            if (openFy) {
              setSelectedFy(openFy);
              setOpeningBalOpen(true);
            } else {
              setNotice({
                title: 'Open fiscal year required',
                description:
                  'Open a fiscal year in Accounting Management before recording opening balances.',
                tone: 'warning',
              });
            }
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-mod-accounting-accent)] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[var(--color-mod-accounting-text)] transition-all"
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
            onClick={() => setSeedConfirmOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-mod-accounting-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-mod-accounting-text)] disabled:opacity-50"
          >
            <Landmark size={16} />
            {seedMutation.isPending ? 'Seeding...' : 'Seed defaults'}
          </button>
        }
      >
        {notice ? (
          <Toast
            title={notice.title}
            description={notice.description}
            tone={notice.tone}
            onDismiss={() => setNotice(null)}
            className="mb-5 max-w-none"
          />
        ) : null}

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

      <ConfirmDialog
        isOpen={seedConfirmOpen}
        onClose={() => setSeedConfirmOpen(false)}
        onConfirm={() => seedMutation.mutate()}
        title="Seed default chart accounts?"
        description="This adds system default accounts through the backend. Existing custom accounts are not edited from this screen."
        confirmLabel="Seed defaults"
        isConfirming={seedMutation.isPending}
      />
    </div>
  );
}
