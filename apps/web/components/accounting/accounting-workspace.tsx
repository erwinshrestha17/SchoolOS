'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Landmark, Lock, RefreshCcw } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../lib/api';

export function AccountingWorkspace() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'accounts' | 'journals' | 'periods' | 'reports'>('accounts');
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
      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        {(['accounts', 'journals', 'periods', 'reports'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`border-b-2 px-3 py-2 text-sm font-semibold capitalize ${
              tab === item ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === 'accounts' ? (
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-bold text-gray-900">Chart of Accounts</h2>
            <button
              type="button"
              onClick={() => seedMutation.mutate()}
              className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-sm font-semibold text-white"
            >
              <Landmark size={16} />
              Seed defaults
            </button>
          </div>
          <Table
            rows={(accountsQuery.data ?? []).map((account) => ({
              id: account.id,
              cells: [account.code, account.name, account.type, account.isSystem ? 'System' : 'Custom'],
            }))}
            headers={['Code', 'Name', 'Group', 'Kind']}
          />
        </section>
      ) : null}

      {tab === 'journals' ? (
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">General Ledger</h2>
            <button
              type="button"
              onClick={() => exportMutation.mutate('general-ledger')}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold"
            >
              <Download size={16} />
              CSV
            </button>
          </div>
          <Table
            rows={(journalsQuery.data ?? []).slice(0, 80).map((row: any, index) => ({
              id: `${row.journalNumber}-${index}`,
              cells: [row.date?.slice?.(0, 10) ?? '', row.journalNumber, row.accountName, row.debit, row.credit, row.runningBalance],
            }))}
            headers={['Date', 'Journal', 'Account', 'Debit', 'Credit', 'Balance']}
          />
        </section>
      ) : null}

      {tab === 'periods' ? (
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 font-bold text-gray-900">Fiscal Years & Periods</h2>
          <div className="grid gap-3">
            {(fiscalYearsQuery.data ?? []).map((year) => (
              <div key={year.id} className="rounded-xl border border-gray-100 p-4">
                <p className="font-semibold">{year.name} / {year.status}</p>
                <p className="text-sm text-gray-500">{new Date(year.startDate).toLocaleDateString()} - {new Date(year.endDate).toLocaleDateString()}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(year.periods ?? []).map((period) => (
                    <span key={period.id} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                      <Lock size={12} />
                      {period.label}: {period.status}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {tab === 'reports' ? (
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">Financial Reports</h2>
            <button
              type="button"
              onClick={() => void reportQuery.refetch()}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold"
            >
              <RefreshCcw size={16} />
              Refresh
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Metric label="Debit" value={reportQuery.data?.totals.debit ?? 0} />
            <Metric label="Credit" value={reportQuery.data?.totals.credit ?? 0} />
            <Metric label="Net Income" value={reportQuery.data?.incomeStatement.netIncome ?? 0} />
            <Metric label="Balanced" value={reportQuery.data?.balanced ? 'Yes' : 'No'} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: Array<{ id: string; cells: unknown[] }> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-xs uppercase text-gray-400">
            {headers.map((header) => <th key={header} className="px-3 py-2">{header}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row) => (
            <tr key={row.id}>
              {row.cells.map((cell, index) => <td key={index} className="px-3 py-2">{String(cell ?? '')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">No records yet.</p> : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-100 p-4">
      <p className="text-xs font-bold uppercase text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-black text-gray-900">{String(value)}</p>
    </div>
  );
}
