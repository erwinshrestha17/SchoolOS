'use client';

import { useQuery } from '@tanstack/react-query';
import { 
  TrendingUp, Calculator, Wallet, Landmark, 
  BarChart3, FileText, PieChart, History, 
  ArrowRight, CheckCircle2, AlertCircle, Settings, Clock, XCircle
} from 'lucide-react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { SectionCard } from '../ui/section-card';
import { StatCard } from '../ui/stat-card';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import { PageState } from '../ui/page-state';
import { AuditInfo } from '../ui/audit-info';
import { ReportTable } from './report-table';

export function AccountingDashboardView() {
  const summaryQuery = useQuery({
    queryKey: ['accounting-summary'],
    queryFn: () => api.listAccountingReports({}),
  });

  const journalsQuery = useQuery({
    queryKey: ['ledger-entries-recent'],
    queryFn: () => api.listJournalEntries(),
  });

  const fiscalYearsQuery = useQuery({
    queryKey: ['fiscal-years'],
    queryFn: () => api.listFiscalYears(),
  });

  const activeFiscalYear = (fiscalYearsQuery.data ?? []).find(y => y.status === 'OPEN') ?? fiscalYearsQuery.data?.[0];
  const activePeriod = activeFiscalYear?.periods?.find((p: any) => p.status === 'OPEN');

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-NP', {
      style: 'currency',
      currency: 'NPR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const noFiscalYear = fiscalYearsQuery.isSuccess && (fiscalYearsQuery.data ?? []).length === 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10">
      {noFiscalYear && (
        <div className="rounded-[2rem] border border-rose-200 bg-rose-50 p-6 shadow-xl shadow-rose-900/5 animate-in slide-in-from-top-4">
          <div className="flex gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-lg shadow-rose-600/30">
              <AlertCircle size={30} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-black text-rose-900 uppercase tracking-tight">No Fiscal Configuration Found</h3>
              <p className="mt-1 text-sm font-medium leading-relaxed text-rose-700/80 max-w-2xl">
                Accounting operations require an active fiscal year. Please initialize your chart of accounts 
                and set up your first fiscal period in management.
              </p>
              <Link
                href="/dashboard/accounting/management"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-900 px-5 py-2 text-xs font-black text-white hover:bg-rose-950 transition-all"
              >
                Go to Fiscal Management
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      )}

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
            title="Financial Command Center" 
            description="Quick access to production-grade accounting reports."
          >
            <div className="space-y-4">
              <AuditInfo>
                Ledger records are immutable. All calculated balances are verified against backend double-entry constraints.
              </AuditInfo>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { href: '/dashboard/accounting/reports/trial-balance', label: 'Trial Balance', desc: 'Summary of all ledger balances.', icon: BarChart3, color: 'bg-primary-500' },
                  { href: '/dashboard/accounting/reports/pnl', label: 'Income Statement', desc: 'Profit and loss for the period.', icon: FileText, color: 'bg-emerald-500' },
                  { href: '/dashboard/accounting/reports/balance-sheet', label: 'Balance Sheet', desc: 'Financial position of the school.', icon: PieChart, color: 'bg-secondary-500' },
                  { href: '/dashboard/accounting/reports/general-ledger', label: 'General Ledger', desc: 'Detailed transaction history.', icon: History, color: 'bg-amber-500' },
                  { href: '/dashboard/accounting/reports/cash-book', label: 'Cash Book', desc: 'Real-time cash and bank flow.', icon: Wallet, color: 'bg-cyan-500' },
                  { href: '/dashboard/accounting/reports/tax-summary', label: 'VAT/TDS/PF Summary', desc: 'Tax and statutory deductions.', icon: Calculator, color: 'bg-rose-500' },
                ].map((report) => (
                  <Link
                    key={report.href}
                    href={report.href}
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
                  </Link>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard 
            title="Recent Ledger Postings" 
            description="Latest validated transactions across all journals."
            headerAction={
              <Link href="/dashboard/accounting/journals" className="text-sm font-bold text-emerald-600 hover:text-emerald-700">
                View All Journals
              </Link>
            }
          >
            {journalsQuery.isLoading ? (
              <PageState
                tone="loading"
                title="Loading journal entries"
                description="Fetching recent ledger postings from the backend."
              />
            ) : journalsQuery.isError ? (
              <PageState
                tone="danger"
                title="Unable to load journal entries"
                description={journalsQuery.error?.message ?? 'Recent ledger postings could not be loaded.'}
              />
            ) : (
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
            )}
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

                <Link 
                  href="/dashboard/accounting/management"
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 p-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Settings size={14} />
                  Manage Fiscal Settings
                </Link>
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
  );
}
