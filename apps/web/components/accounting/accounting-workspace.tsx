import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Download, Landmark, RefreshCcw, FileText, BarChart3, 
  PieChart, History, Wallet, Plus, ArrowLeftRight, 
  Target, Calculator, Lock, Unlock, TrendingUp, ArrowRight,
  LayoutDashboard, Settings, CheckCircle2, XCircle, AlertCircle, Clock
} from 'lucide-react';
import { api } from '../../lib/api';
import { SectionCard } from '../ui/section-card';
import { StatCard } from '../ui/stat-card';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { ReportFilters } from './report-filters';
import { ReportTable } from './report-table';
import { FiscalPeriodActions } from './fiscal-period-actions';
import { VoucherDialog } from './voucher-dialog';
import { OpeningBalanceDialog } from './opening-balance-dialog';
import { BankReconciliationWorkspace } from './bank-reconciliation-workspace';
import { FiscalYearCloseDialog } from './fiscal-year-close-dialog';

type ReportType = 'trial-balance' | 'income-statement' | 'balance-sheet' | 'general-ledger' | 'cash-book' | 'tax-summary';

export type TabType = 'dashboard' | 'reports' | 'reconciliation' | 'journals' | 'accounts' | 'management';

export function AccountingWorkspace() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [activeReport, setActiveReport] = useState<ReportType>('trial-balance');
  const [filters, setFilters] = useState<{
    startDate?: string;
    endDate?: string;
    fiscalYearId?: string;
    fiscalPeriodId?: string;
  }>({});

  const [voucherOpen, setVoucherOpen] = useState(false);
  const [openingBalOpen, setOpeningBalOpen] = useState(false);
  const [fyCloseOpen, setFyCloseOpen] = useState(false);
  const [fyMode, setFyMode] = useState<'CLOSE' | 'REOPEN'>('CLOSE');
  const [selectedFy, setSelectedFy] = useState<any>(null);

  const accountsQuery = useQuery({ queryKey: ['chart-accounts'], queryFn: api.listChartAccounts });
  const fiscalYearsQuery = useQuery({ queryKey: ['fiscal-years'], queryFn: api.listFiscalYears });
  
  const reportQuery = useQuery({ 
    queryKey: ['accounting-report', activeReport, filters], 
    queryFn: () => {
      if (activeReport === 'trial-balance') return api.listTrialBalance(filters);
      if (activeReport === 'income-statement') return api.listIncomeStatement(filters);
      if (activeReport === 'balance-sheet') return api.listBalanceSheet(filters);
      if (activeReport === 'general-ledger') return api.listGeneralLedger(filters);
      if (activeReport === 'tax-summary') return api.listAccountingReports({ ...filters, report: 'tax-summary' });
      return api.listCashBook(filters);
    }
  });

  const summaryQuery = useQuery({
    queryKey: ['accounting-summary', filters],
    queryFn: () => api.listAccountingReports(filters),
  });

  const journalsQuery = useQuery({
    queryKey: ['ledger-entries', filters],
    queryFn: () => api.listLedgerEntries(),
  });

  const seedMutation = useMutation({
    mutationFn: api.seedDefaultChartAccounts,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['chart-accounts'] }),
  });
  
  const exportMutation = useMutation({ mutationFn: api.exportAccountingCsv });

  const activeFiscalYear = (fiscalYearsQuery.data ?? []).find(y => y.status === 'OPEN') ?? fiscalYearsQuery.data?.[0];
  const activePeriod = activeFiscalYear?.periods?.find((p: any) => p.status === 'OPEN');

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-NP', {
      style: 'currency',
      currency: 'NPR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

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
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setVoucherOpen(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-primary-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary-600/20 hover:bg-primary-700 transition-all"
        >
          <Plus size={18} />
          Voucher Entry
        </button>
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
          className="inline-flex items-center gap-2 rounded-2xl bg-white border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all"
        >
          <Target size={18} />
          Opening Balance
        </button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)} className="space-y-5">
        <TabsList className="flex flex-wrap h-auto gap-2 border-b border-slate-200 bg-transparent rounded-none p-0 pb-px w-full justify-start">
          {(['dashboard', 'reports', 'reconciliation', 'journals', 'accounts', 'management'] as const).map((item) => (
            <TabsTrigger
              key={item}
              value={item}
              className="border-b-2 border-transparent px-3 py-2 text-sm font-semibold capitalize rounded-none data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-700 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-slate-500 hover:text-slate-700 hover:border-slate-300"
            >
              {item}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="dashboard" className="mt-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="space-y-8">
            <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Total Revenue"
                value={formatMoney(summaryQuery.data?.incomeStatement?.income ?? 0)}
                icon={<TrendingUp size={20} />}
                loading={summaryQuery.isLoading}
                className="border-emerald-100 bg-emerald-50/30"
              />
              <StatCard
                title="Total Expenses"
                value={formatMoney(summaryQuery.data?.incomeStatement?.expenses ?? 0)}
                icon={<Calculator size={20} />}
                loading={summaryQuery.isLoading}
                className="border-rose-100 bg-rose-50/30"
              />
              <StatCard
                title="Net Balance"
                value={formatMoney(summaryQuery.data?.incomeStatement?.netIncome ?? 0)}
                icon={<Wallet size={20} />}
                loading={summaryQuery.isLoading}
                className="border-primary-100 bg-primary-50/30"
              />
              <StatCard
                title="Cash/Bank"
                value={formatMoney(summaryQuery.data?.cashFlow?.netCashMovement ?? 0)}
                icon={<Landmark size={20} />}
                loading={summaryQuery.isLoading}
                className="border-amber-100 bg-amber-50/30"
              />
            </section>

            <div className="grid gap-8 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-8">
                <SectionCard 
                  title="Financial Reports" 
                  description="Access all standard accounting reports and tax summaries."
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[
                      { id: 'trial-balance', label: 'Trial Balance', desc: 'Summary of all ledger balances.', icon: BarChart3, color: 'bg-primary-500' },
                      { id: 'income-statement', label: 'Income Statement', desc: 'Profit and loss for the period.', icon: FileText, color: 'bg-emerald-500' },
                      { id: 'balance-sheet', label: 'Balance Sheet', desc: 'Financial position of the school.', icon: PieChart, color: 'bg-secondary-500' },
                      { id: 'general-ledger', label: 'General Ledger', desc: 'Detailed transaction history.', icon: History, color: 'bg-amber-500' },
                      { id: 'cash-book', label: 'Cash Book', desc: 'Real-time cash and bank flow.', icon: Wallet, color: 'bg-cyan-500' },
                      { id: 'tax-summary', label: 'VAT/TDS/PF Summary', desc: 'Tax and statutory deductions.', icon: Calculator, color: 'bg-rose-500' },
                    ].map((report) => (
                      <button
                        key={report.id}
                        onClick={() => {
                          setActiveReport(report.id as ReportType);
                          setActiveTab('reports');
                        }}
                        className="group flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 text-left transition hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5"
                      >
                        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-lg transition group-hover:scale-110", report.color)}>
                          <report.icon size={22} />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-slate-900">{report.label}</p>
                          <p className="text-xs text-slate-500">{report.desc}</p>
                        </div>
                        <ArrowRight size={18} className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-emerald-500" />
                      </button>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard 
                  title="Recent Ledger Postings" 
                  description="Latest validated transactions across all journals."
                  headerAction={
                    <button onClick={() => setActiveTab('journals')} className="text-sm font-bold text-emerald-600 hover:text-emerald-700">
                      View All Journals
                    </button>
                  }
                >
                  <ReportTable
                    headers={['Date', 'Number', 'Narration', 'Amount']}
                    rows={(journalsQuery.data ?? []).slice(0, 5).map((entry) => ({
                      id: entry.id,
                      cells: [
                        { value: entry.entryDate, type: 'date' },
                        { value: entry.entryNumber, bold: true },
                        { value: entry.narration },
                        { value: entry.totalDebit ?? entry.totalCredit ?? 0, type: 'currency' }
                      ],
                    }))}
                  />
                </SectionCard>
              </div>

              <div className="space-y-8">
                <SectionCard title="Fiscal Status">
                  <div className="space-y-6">
                    <div className="rounded-2xl bg-slate-900 p-5 text-white shadow-xl">
                      <p className="text-[0.65rem] font-bold uppercase tracking-widest text-white/50">Current Fiscal Year</p>
                      <h4 className="mt-1 text-xl font-black">{activeFiscalYear?.name ?? 'Not Set'}</h4>
                      
                      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                        <span className="text-xs font-bold text-white/70">Status</span>
                        <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[10px] font-black text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 size={10} />
                          {activeFiscalYear?.status}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                            <Clock size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{activePeriod?.label ?? 'No Active Period'}</p>
                            <p className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">Current Period</p>
                          </div>
                        </div>
                        <Badge variant={activePeriod?.status === 'OPEN' ? 'success' : 'warning'}>
                          {activePeriod?.status ?? 'CLOSED'}
                        </Badge>
                      </div>

                      <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
                        <div className="flex gap-3">
                          <AlertCircle size={18} className="text-amber-600" />
                          <div className="flex-1">
                            <p className="text-xs font-bold text-amber-800">Period Closing Reminder</p>
                            <p className="mt-1 text-[10px] leading-relaxed text-amber-700/80">
                              Please ensure all bank reconciliations are completed before locking the current period.
                            </p>
                          </div>
                        </div>
                      </div>

                      <button 
                        onClick={() => setActiveTab('management')}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 p-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <Settings size={14} />
                        Manage Fiscal Settings
                      </button>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Double-Entry Guard">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-xs font-bold text-slate-600">Ledger Balanced</span>
                      {summaryQuery.data?.balanced ? (
                        <CheckCircle2 size={18} className="text-emerald-500" />
                      ) : (
                        <XCircle size={18} className="text-rose-500" />
                      )}
                    </div>
                    <div className="p-4 rounded-xl bg-slate-900 text-white">
                      <div className="flex items-center justify-between text-[0.65rem] font-black uppercase tracking-widest text-white/40">
                        <span>Trial Balance</span>
                        <span>Check</span>
                      </div>
                      <div className="mt-3 flex justify-between items-end">
                        <div>
                          <p className="text-[10px] text-white/50 uppercase font-bold">Debit</p>
                          <p className="text-sm font-bold">{formatMoney(summaryQuery.data?.totals?.debit ?? 0)}</p>
                        </div>
                        <div className="h-8 w-px bg-white/10" />
                        <div className="text-right">
                          <p className="text-[10px] text-white/50 uppercase font-bold">Credit</p>
                          <p className="text-sm font-bold">{formatMoney(summaryQuery.data?.totals?.credit ?? 0)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </SectionCard>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="reports" className="mt-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
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
                    { id: 'tax-summary', label: 'VAT/TDS/PF', icon: Calculator },
                  ].map((report) => (
                    <button
                      key={report.id}
                      onClick={() => setActiveReport(report.id as ReportType)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all",
                        activeReport === report.id
                          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
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

        <TabsContent value="reconciliation" className="mt-0">
          <BankReconciliationWorkspace />
        </TabsContent>

        <TabsContent value="journals" className="mt-0">
          <SectionCard
            title="All Journal Entries"
            description="Complete list of all financial postings in chronological order."
          >
            {journalsQuery.isLoading ? (
              <div className="py-20 text-center text-slate-400">Loading journal entries...</div>
            ) : journalsQuery.isError ? (
              <div className="py-20 text-center text-rose-500">Failed to load journal entries.</div>
            ) : (
              <ReportTable
                headers={['Date', 'Number', 'Narration', 'Type', 'Amount']}
                rows={(journalsQuery.data ?? []).map((entry) => ({
                  id: entry.id,
                  cells: [
                    { value: entry.entryDate, type: 'date' },
                    { value: entry.entryNumber, bold: true },
                    { value: entry.narration },
                    { value: entry.sourceType },
                    { value: entry.totalDebit ?? entry.totalCredit ?? 0, type: 'currency' }
                  ],
                }))}
              />
            )}
          </SectionCard>
        </TabsContent>

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

        <TabsContent value="management" className="mt-0">
          <div className="grid gap-6">
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
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          "rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider",
                          year.status === 'OPEN' ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                        )}>
                          {year.status}
                        </span>
                        {year.status === 'OPEN' ? (
                          <button
                            onClick={() => {
                              setSelectedFy(year);
                              setFyMode('CLOSE');
                              setFyCloseOpen(true);
                            }}
                            className="inline-flex h-8 items-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white hover:bg-slate-800"
                          >
                            <Lock size={14} />
                            Close Year
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedFy(year);
                              setFyMode('REOPEN');
                              setFyCloseOpen(true);
                            }}
                            className="inline-flex h-8 items-center gap-2 rounded-lg bg-primary-600 px-3 text-xs font-bold text-white hover:bg-primary-700"
                          >
                            <Unlock size={14} />
                            Reopen
                          </button>
                        )}
                      </div>
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
          </div>
        </TabsContent>
      </Tabs>

      <VoucherDialog 
        isOpen={voucherOpen} 
        onClose={() => setVoucherOpen(false)} 
        accounts={accountsQuery.data ?? []} 
      />

      <OpeningBalanceDialog
        isOpen={openingBalOpen}
        onClose={() => setOpeningBalOpen(false)}
        fiscalYear={selectedFy}
        accounts={accountsQuery.data ?? []}
      />

      <FiscalYearCloseDialog
        isOpen={fyCloseOpen}
        onClose={() => setFyCloseOpen(false)}
        fiscalYear={selectedFy}
        mode={fyMode}
      />
    </div>
  );
}

