'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Landmark, RefreshCcw, FileText, BarChart3, PieChart, History, Wallet } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../lib/api';
import { SectionCard } from '../ui/section-card';
import { StatCard } from '../ui/stat-card';
import { cn } from '../../lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { ReportFilters } from './report-filters';
import { ReportTable } from './report-table';
import { FiscalPeriodActions } from './fiscal-period-actions';

type ReportType = 'trial-balance' | 'income-statement' | 'balance-sheet' | 'general-ledger' | 'cash-book';

export function AccountingWorkspace() {
  const queryClient = useQueryClient();
  const [activeReport, setActiveReport] = useState<ReportType>('trial-balance');
  const [filters, setFilters] = useState<{
    startDate?: string;
    endDate?: string;
    fiscalYearId?: string;
    fiscalPeriodId?: string;
  }>({});

  const accountsQuery = useQuery({ queryKey: ['chart-accounts'], queryFn: api.listChartAccounts });
  const fiscalYearsQuery = useQuery({ queryKey: ['fiscal-years'], queryFn: api.listFiscalYears });
  
  const reportQuery = useQuery({ 
    queryKey: ['accounting-report', activeReport, filters], 
    queryFn: () => {
      if (activeReport === 'trial-balance') return api.listTrialBalance(filters);
      if (activeReport === 'income-statement') return api.listIncomeStatement(filters);
      if (activeReport === 'balance-sheet') return api.listBalanceSheet(filters);
      if (activeReport === 'general-ledger') return api.listGeneralLedger(filters);
      return api.listCashBook(filters);
    }
  });

  const seedMutation = useMutation({
    mutationFn: api.seedDefaultChartAccounts,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['chart-accounts'] }),
  });
  
  const exportMutation = useMutation({ mutationFn: api.exportAccountingCsv });

  const renderReportContent = () => {
    if (reportQuery.isLoading) return <div className="py-20 text-center text-slate-400">Loading report data...</div>;
    if (reportQuery.isError) return <div className="py-20 text-center text-rose-500">Failed to load report.</div>;

    const data = reportQuery.data;

    if (activeReport === 'trial-balance') {
      return (
        <ReportTable
          headers={['Code', 'Account', 'Type', 'Debit', 'Credit', 'Balance']}
          rows={(data as any[] ?? []).map((row) => ({
            id: row.accountId,
            cells: [
              { value: row.code, bold: true },
              { value: row.name },
              { value: row.type },
              { value: row.debit, type: 'currency' },
              { value: row.credit, type: 'currency' },
              { value: row.balance, type: 'currency', bold: true },
            ],
          }))}
        />
      );
    }

    if (activeReport === 'income-statement') {
      const pnl = data as any;
      const groups = pnl?.groups ?? {};
      
      const rows: any[] = [];
      
      rows.push({ id: 'rev-header', isHeader: true, cells: [{ value: 'REVENUE', bold: true }] });
      (groups.revenue ?? []).forEach((r: any) => {
        rows.push({ id: r.accountId, cells: [{ value: r.name, indent: 1 }, { value: '' }, { value: '' }, { value: r.balance * -1, type: 'currency' }] });
      });
      rows.push({ id: 'rev-total', isFooter: true, cells: [{ value: 'Total Revenue' }, { value: '' }, { value: '' }, { value: pnl?.income ?? 0, type: 'currency' }] });

      rows.push({ id: 'exp-header', isHeader: true, className: 'mt-4', cells: [{ value: 'EXPENSES', bold: true }] });
      (groups.expenses ?? []).forEach((e: any) => {
        rows.push({ id: e.accountId, cells: [{ value: e.name, indent: 1 }, { value: '' }, { value: '' }, { value: e.balance, type: 'currency' }] });
      });
      rows.push({ id: 'exp-total', isFooter: true, cells: [{ value: 'Total Expenses' }, { value: '' }, { value: '' }, { value: pnl?.expenses ?? 0, type: 'currency' }] });

      rows.push({ id: 'net-total', isFooter: true, className: 'bg-slate-900 text-white hover:bg-slate-900', cells: [{ value: 'NET INCOME', bold: true }, { value: '' }, { value: '' }, { value: pnl?.netIncome ?? 0, type: 'currency' }] });

      return <ReportTable headers={['Classification', '', '', 'Amount']} rows={rows} />;
    }

    if (activeReport === 'balance-sheet') {
      const bs = data as any;
      const rows: any[] = [];

      rows.push({ id: 'ast-header', isHeader: true, cells: [{ value: 'ASSETS', bold: true }] });
      (bs.assets ?? []).forEach((a: any) => {
        rows.push({ id: a.accountId, cells: [{ value: a.name, indent: 1 }, { value: a.balance, type: 'currency' }] });
      });
      rows.push({ id: 'ast-total', isFooter: true, cells: [{ value: 'Total Assets' }, { value: bs.totals?.assets ?? 0, type: 'currency' }] });

      rows.push({ id: 'liab-header', isHeader: true, cells: [{ value: 'LIABILITIES', bold: true }] });
      (bs.liabilities ?? []).forEach((l: any) => {
        rows.push({ id: l.accountId, cells: [{ value: l.name, indent: 1 }, { value: l.balance * -1, type: 'currency' }] });
      });
      rows.push({ id: 'liab-total', isFooter: true, cells: [{ value: 'Total Liabilities' }, { value: bs.totals?.liabilities ?? 0, type: 'currency' }] });

      rows.push({ id: 'eq-header', isHeader: true, cells: [{ value: 'EQUITY', bold: true }] });
      (bs.equity ?? []).forEach((e: any) => {
        rows.push({ id: e.accountId, cells: [{ value: e.name, indent: 1 }, { value: e.balance * -1, type: 'currency' }] });
      });
      rows.push({ id: 'eq-total', isFooter: true, cells: [{ value: 'Total Equity' }, { value: bs.totals?.equity ?? 0, type: 'currency' }] });

      return <ReportTable headers={['Account', 'Balance']} rows={rows} />;
    }

    if (activeReport === 'general-ledger') {
      return (
        <ReportTable
          headers={['Date', 'Journal', 'Account', 'Debit', 'Credit', 'Balance']}
          rows={(data as any[] ?? []).map((row, index) => ({
            id: `${row.journalNumber}-${index}`,
            cells: [
              { value: row.date, type: 'date' },
              { value: row.journalNumber, bold: true },
              { value: row.accountName },
              { value: row.debit, type: 'currency' },
              { value: row.credit, type: 'currency' },
              { value: row.runningBalance, type: 'currency', bold: true },
            ],
          }))}
        />
      );
    }

    if (activeReport === 'cash-book') {
      const cb = data as any;
      return (
        <ReportTable
          headers={['Date', 'Journal', 'Narration', 'Receipt', 'Payment', 'Balance']}
          rows={(cb.rows as any[] ?? []).map((row, index) => ({
            id: `${row.journalNumber}-${index}`,
            cells: [
              { value: row.date, type: 'date' },
              { value: row.journalNumber },
              { value: row.narration },
              { value: row.debit, type: 'currency' },
              { value: row.credit, type: 'currency' },
              { value: row.runningBalance, type: 'currency', bold: true },
            ],
          }))}
        />
      );
    }

    return null;
  };

  return (
    <div className="space-y-5">
      <Tabs defaultValue="reports" className="space-y-5">
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
        </TabsContent>

        <TabsContent value="journals" className="mt-0">
          <SectionCard
            title="All Journal Entries"
            description="Complete list of all financial postings in chronological order."
          >
            <ReportTable
              headers={['Date', 'Number', 'Narration', 'Module', 'Type', 'Amount']}
              rows={(reportQuery.data as any[] ?? []).map((entry) => ({
                id: entry.id,
                cells: [
                  { value: entry.entryDate, type: 'date' },
                  { value: entry.entryNumber, bold: true },
                  { value: entry.narration },
                  { value: entry.sourceModule },
                  { value: entry.postingType },
                  { value: entry.lines?.[0]?.amount ?? 0, type: 'currency' }
                ],
              }))}
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
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {(year.periods ?? []).map((period: any) => (
                      <div key={period.id} className="flex flex-col gap-1 rounded-2xl bg-white border border-slate-100 p-3 shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{period.label}</span>
                          <span className={cn(
                            "h-2 w-2 rounded-full",
                            period.status === 'OPEN' ? "bg-emerald-500" : period.status === 'LOCKED' ? "bg-amber-500" : "bg-slate-400"
                          )} />
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs font-bold text-slate-700">{period.status}</span>
                          <FiscalPeriodActions periodId={period.id} status={period.status} label={period.label} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="reports" className="mt-0">
          <div className="space-y-4">
            <SectionCard>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'trial-balance', label: 'Trial Balance', icon: BarChart3 },
                    { id: 'income-statement', label: 'P&L / Income', icon: FileText },
                    { id: 'balance-sheet', label: 'Balance Sheet', icon: PieChart },
                    { id: 'general-ledger', label: 'General Ledger', icon: History },
                    { id: 'cash-book', label: 'Cash Book', icon: Wallet },
                  ].map((report) => (
                    <button
                      key={report.id}
                      onClick={() => setActiveReport(report.id as ReportType)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all",
                        activeReport === report.id
                          ? "bg-primary-600 text-white shadow-lg shadow-primary-600/20"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <report.icon size={16} />
                      {report.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => exportMutation.mutate(activeReport)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <Download size={16} />
                  Export CSV
                </button>
              </div>
              <div className="mt-6 border-t border-slate-100 pt-6">
                <ReportFilters onFilterChange={(f) => setFilters(prev => ({ ...prev, ...f }))} />
              </div>
            </SectionCard>

            <SectionCard>
              {renderReportContent()}
            </SectionCard>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

