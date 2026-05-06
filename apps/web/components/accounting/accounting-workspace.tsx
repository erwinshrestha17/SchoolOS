'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Landmark, Lock, RefreshCcw } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../lib/api';
import { SectionCard } from '../ui/section-card';
import { StatCard } from '../ui/stat-card';
import { cn } from '../../lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';

export function AccountingWorkspace() {
  const queryClient = useQueryClient();
  const accountsQuery = useQuery({ queryKey: ['chart-accounts'], queryFn: api.listChartAccounts });
  const journalsQuery = useQuery({ queryKey: ['general-ledger'], queryFn: api.listGeneralLedger });
  const fiscalYearsQuery = useQuery({ queryKey: ['fiscal-years'], queryFn: api.listFiscalYears });
  const reportQuery = useQuery({ queryKey: ['accounting-reports'], queryFn: api.listAccountingReports });

  const seedMutation = useMutation({
    mutationFn: api.seedDefaultChartAccounts,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['chart-accounts'] }),
  });
  const exportMutation = useMutation({ mutationFn: api.exportAccountingCsv });

  return (
    <div className="space-y-5">
      <Tabs defaultValue="accounts" className="space-y-5">
        <TabsList className="flex flex-wrap h-auto gap-2 border-b border-slate-200 bg-transparent rounded-none p-0 pb-px w-full justify-start">
          {(['accounts', 'journals', 'periods', 'reports'] as const).map((item) => (
            <TabsTrigger
              key={item}
              value={item}
              className="border-b-2 border-transparent px-3 py-2 text-sm font-semibold capitalize rounded-none data-[state=active]:border-primary-600 data-[state=active]:text-primary-700 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-slate-500 hover:text-slate-700 hover:border-slate-300"
            >
              {item}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="accounts" className="mt-0">
          <SectionCard
            title="Chart of Accounts"
            description="Manage your school's financial account structure and system defaults."
            headerAction={
              <button
                type="button"
                onClick={() => seedMutation.mutate()}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              >
                <Landmark size={16} />
                Seed defaults
              </button>
            }
          >
            <Table
              rows={(accountsQuery.data ?? []).map((account) => ({
                id: account.id,
                cells: [account.code, account.name, account.type, account.isSystem ? 'System' : 'Custom'],
              }))}
              headers={['Code', 'Name', 'Group', 'Kind']}
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="journals" className="mt-0">
          <SectionCard
            title="General Ledger"
            description="Chronological record of all financial transactions across the school."
            headerAction={
              <button
                type="button"
                onClick={() => exportMutation.mutate('general-ledger')}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Download size={16} />
                CSV
              </button>
            }
          >
            <Table
              rows={(journalsQuery.data ?? []).slice(0, 80).map((row: any, index) => ({
                id: `${row.journalNumber}-${index}`,
                cells: [row.date?.slice?.(0, 10) ?? '', row.journalNumber, row.accountName, row.debit, row.credit, row.runningBalance],
              }))}
              headers={['Date', 'Journal', 'Account', 'Debit', 'Credit', 'Balance']}
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="periods" className="mt-0">
          <SectionCard
            title="Fiscal Years & Periods"
            description="Manage accounting periods and fiscal year status for financial reporting."
          >
            <div className="grid gap-4">
              {(fiscalYearsQuery.data ?? []).map((year) => (
                <div key={year.id} className="rounded-[2rem] border border-slate-100 bg-slate-50/50 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{year.name}</p>
                      <p className="text-sm text-slate-500">
                        {new Date(year.startDate).toLocaleDateString()} - {new Date(year.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={cn(
                      "rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider",
                      year.status === 'OPEN' ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                    )}>
                      {year.status}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(year.periods ?? []).map((period) => (
                      <span key={period.id} className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-100 px-3 py-1 text-xs font-bold text-slate-600 shadow-sm">
                        <Lock size={12} className="text-slate-400" />
                        {period.label}: {period.status}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="reports" className="mt-0">
          <SectionCard
            title="Financial Reports"
            description="High-level financial summaries and net income tracking."
            headerAction={
              <button
                type="button"
                onClick={() => void reportQuery.refetch()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <RefreshCcw size={16} />
                Refresh
              </button>
            }
          >
            <div className="grid gap-4 md:grid-cols-4">
              <StatCard title="Debit" value={reportQuery.data?.totals.debit ?? 0} />
              <StatCard title="Credit" value={reportQuery.data?.totals.credit ?? 0} />
              <StatCard title="Net Income" value={reportQuery.data?.incomeStatement.netIncome ?? 0} />
              <StatCard title="Balanced" value={reportQuery.data?.balanced ? 'Yes' : 'No'} />
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: Array<{ id: string; cells: unknown[] }> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">
            {headers.map((header) => <th key={header} className="px-4 py-3">{header}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
              {row.cells.map((cell, index) => (
                <td key={index} className="px-4 py-4 text-slate-600 font-medium">
                  {String(cell ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-400 font-medium">
          No records found.
        </div>
      ) : null}
    </div>
  );
}

