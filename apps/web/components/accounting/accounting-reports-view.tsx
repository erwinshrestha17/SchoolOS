'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { 
  BarChart3, FileText, PieChart, History, 
  Wallet, Calculator, FileSpreadsheet, FileDown
} from 'lucide-react';
import { api } from '../../lib/api';
import { SectionCard } from '../ui/section-card';
import { PageState } from '../ui/page-state';
import { cn } from '../../lib/utils';
import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AuditInfo } from '../ui/audit-info';
import { ReportFilters } from './report-filters';
import { ReportTable } from './report-table';

import { PageHeader } from '../ui/page-header';

type ReportType = 'trial-balance' | 'income-statement' | 'balance-sheet' | 'general-ledger' | 'cash-book' | 'tax-summary';

export function AccountingReportsView({ initialReport = 'trial-balance' }: { initialReport?: ReportType }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const reportParam = searchParams.get('report') as ReportType;
  
  const [activeReport, setActiveReport] = useState<ReportType>(reportParam || initialReport);
  const [filters, setFilters] = useState<{
    startDate?: string;
    endDate?: string;
    fiscalYearId?: string;
    fiscalPeriodId?: string;
  }>({});

  useEffect(() => {
    if (reportParam && reportParam !== activeReport) {
      setActiveReport(reportParam);
    }
  }, [reportParam, activeReport]);

  const handleReportChange = (report: ReportType) => {
    setActiveReport(report);
    const params = new URLSearchParams(searchParams.toString());
    params.set('report', report);
    router.push(`?${params.toString()}`);
  };

  const reportQuery = useQuery({ 
    queryKey: ['accounting-report', activeReport, filters], 
    queryFn: () => {
      if (activeReport === 'trial-balance') return api.listTrialBalance(filters);
      if (activeReport === 'income-statement') return api.listIncomeStatement(filters);
      if (activeReport === 'balance-sheet') return api.listBalanceSheet(filters);
      if (activeReport === 'general-ledger') return api.listGeneralLedger(filters);
      if (activeReport === 'tax-summary') return api.listVatSummary();
      return api.listCashBook(filters);
    }
  });

  const snapshotsQuery = useQuery({
    queryKey: ['report-snapshots', activeReport],
    queryFn: () => api.listReportSnapshots({ limit: 8 }),
  });

  const exportMutation = useMutation({ 
    mutationFn: (report: string) => api.exportAccountingCsv(report),
    onSuccess: () => {
      // Success feedback handled by browser download
    },
    onError: (err) => {
      console.error('Export failed:', err);
    }
  });

  const pdfMutation = useMutation({
    mutationFn: (report: string) => api.exportAccountingPdf(report, filters),
    onError: (err) => {
      console.error('PDF export failed:', err);
    }
  });

  const isExportSupported = (report: string) => {
    return ['trial-balance', 'general-ledger', 'cash-book', 'income-statement', 'balance-sheet', 'tax-summary'].includes(report);
  };

  const renderReportContent = () => {
    if (reportQuery.isLoading) {
      return (
        <div className="py-20">
          <PageState
            tone="loading"
            title="Generating Financial Report"
            description="Backend is processing ledger data for the selected period."
          />
        </div>
      );
    }

    if (reportQuery.isError) {
      return (
        <div className="py-10">
          <PageState
            tone="danger"
            title="Report Generation Failed"
            description={reportQuery.error?.message ?? 'Could not retrieve data from the financial ledger.'}
          />
        </div>
      );
    }

    const data = reportQuery.data;

    if (!data || (Array.isArray(data) && data.length === 0)) {
      return (
        <div className="py-10">
          <PageState
            tone="info"
            title="No Transactions Found"
            description="There are no ledger entries for the selected report and period."
          />
        </div>
      );
    }

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
              { value: row.debit, type: 'currency', align: 'right' },
              { value: row.credit, type: 'currency', align: 'right' },
              { value: row.balance, type: 'currency', bold: true, align: 'right' },
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
        rows.push({ id: r.accountId, cells: [{ value: r.name, indent: 1 }, { value: '' }, { value: '' }, { value: r.balance * -1, type: 'currency', align: 'right' }] });
      });
      rows.push({ id: 'rev-total', isFooter: true, cells: [{ value: 'Total Revenue' }, { value: '' }, { value: '' }, { value: pnl?.income ?? 0, type: 'currency', align: 'right' }] });

      rows.push({ id: 'exp-header', isHeader: true, className: 'mt-4', cells: [{ value: 'EXPENSES', bold: true }] });
      (groups.expenses ?? []).forEach((e: any) => {
        rows.push({ id: e.accountId, cells: [{ value: e.name, indent: 1 }, { value: '' }, { value: '' }, { value: e.balance, type: 'currency', align: 'right' }] });
      });
      rows.push({ id: 'exp-total', isFooter: true, cells: [{ value: 'Total Expenses' }, { value: '' }, { value: '' }, { value: pnl?.expenses ?? 0, type: 'currency', align: 'right' }] });

      rows.push({ id: 'net-total', isFooter: true, className: 'bg-[var(--color-mod-accounting-bg)] text-[var(--color-mod-accounting-text)] hover:bg-[var(--color-mod-accounting-bg)]', cells: [{ value: 'NET INCOME', bold: true }, { value: '' }, { value: '' }, { value: pnl?.netIncome ?? 0, type: 'currency', align: 'right' }] });

      return <ReportTable headers={['Classification', '', '', 'Amount']} rows={rows} />;
    }

    if (activeReport === 'balance-sheet') {
      const bs = data as any;
      const rows: any[] = [];

      rows.push({ id: 'ast-header', isHeader: true, cells: [{ value: 'ASSETS', bold: true }] });
      (bs.assets ?? []).forEach((a: any) => {
        rows.push({ id: a.accountId, cells: [{ value: a.name, indent: 1 }, { value: a.balance, type: 'currency', align: 'right' }] });
      });
      rows.push({ id: 'ast-total', isFooter: true, cells: [{ value: 'Total Assets' }, { value: bs.totals?.assets ?? 0, type: 'currency', align: 'right' }] });

      rows.push({ id: 'liab-header', isHeader: true, cells: [{ value: 'LIABILITIES', bold: true }] });
      (bs.liabilities ?? []).forEach((l: any) => {
        rows.push({ id: l.accountId, cells: [{ value: l.name, indent: 1 }, { value: l.balance * -1, type: 'currency', align: 'right' }] });
      });
      rows.push({ id: 'liab-total', isFooter: true, cells: [{ value: 'Total Liabilities' }, { value: bs.totals?.liabilities ?? 0, type: 'currency', align: 'right' }] });

      rows.push({ id: 'eq-header', isHeader: true, cells: [{ value: 'EQUITY', bold: true }] });
      (bs.equity ?? []).forEach((e: any) => {
        rows.push({ id: e.accountId, cells: [{ value: e.name, indent: 1 }, { value: e.balance * -1, type: 'currency', align: 'right' }] });
      });
      rows.push({ id: 'eq-total', isFooter: true, cells: [{ value: 'Total Equity' }, { value: bs.totals?.equity ?? 0, type: 'currency', align: 'right' }] });

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
              { value: row.debit, type: 'currency', align: 'right' },
              { value: row.credit, type: 'currency', align: 'right' },
              { value: row.runningBalance, type: 'currency', bold: true, align: 'right' },
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
              { value: row.debit, type: 'currency', align: 'right' },
              { value: row.credit, type: 'currency', align: 'right' },
              { value: row.runningBalance, type: 'currency', bold: true, align: 'right' },
            ],
          }))}
        />
      );
    }

    if (activeReport === 'tax-summary') {
      return (
        <ReportTable
          headers={['Type', 'Reference', 'Amount', 'Tax Rate', 'Tax Amount']}
          rows={(data as any[] ?? []).map((row, index) => ({
            id: `tax-${index}`,
            cells: [
              { value: row.type, bold: true },
              { value: row.reference },
              { value: row.baseAmount, type: 'currency', align: 'right' },
              { value: `${row.taxRate}%` },
              { value: row.taxAmount, type: 'currency', bold: true, align: 'right' },
            ],
          }))}
        />
      );
    }

    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10">
      <PageHeader 
        title="Accounting Reports" 
        description="Comprehensive financial statements and ledger reports generated from real-time accounting data."
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => pdfMutation.mutate(activeReport)}
              disabled={pdfMutation.isPending || !isExportSupported(activeReport)}
              className="group inline-flex items-center gap-2 rounded-xl bg-[var(--color-mod-accounting-accent)] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-[var(--color-mod-accounting-text)] disabled:opacity-30 disabled:grayscale"
              data-testid="accounting-report-pdf-export"
            >
              <FileDown size={18} className="transition-transform group-hover:scale-110" />
              {pdfMutation.isPending ? 'Generating...' : 'Download PDF'}
            </button>
            <button
              onClick={() => exportMutation.mutate(activeReport)}
              disabled={exportMutation.isPending || !isExportSupported(activeReport)}
              className="group inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all disabled:opacity-30 disabled:grayscale"
            >
              <FileSpreadsheet size={18} className="transition-transform group-hover:scale-110" />
              {exportMutation.isPending ? 'Generating...' : 'Download CSV'}
            </button>
          </div>
        }
      />

      <AuditInfo>
        Financial truth is derived from the backend ledger. Posted journals are immutable; use reversal/correction workflows for any adjustments.
      </AuditInfo>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-1 space-y-4">
          <SectionCard title="Select Report" className="h-full">
            <div className="flex flex-col gap-2">
              {[
                { id: 'trial-balance', label: 'Trial Balance', icon: BarChart3, desc: 'Balance check for all accounts' },
                { id: 'income-statement', label: 'Income Statement', icon: FileText, desc: 'Revenue vs Expenses (P&L)' },
                { id: 'balance-sheet', label: 'Balance Sheet', icon: PieChart, desc: 'Assets, Liabilities & Equity' },
                { id: 'general-ledger', label: 'General Ledger', icon: History, desc: 'Detailed transaction history' },
                { id: 'cash-book', label: 'Cash Book', icon: Wallet, desc: 'Cash and bank movements' },
                { id: 'tax-summary', label: 'VAT/TDS/PF', icon: Calculator, desc: 'Tax and statutory summaries' },
              ].map((report) => (
                <button
                  key={report.id}
                  onClick={() => handleReportChange(report.id as ReportType)}
                  className={cn(
                    "flex flex-col gap-0.5 rounded-xl px-4 py-3 text-left transition-all",
                    activeReport === report.id
                      ? "border border-[var(--color-mod-accounting-border)] bg-[var(--color-mod-accounting-bg)] text-[var(--color-mod-accounting-text)] shadow-sm"
                      : "bg-white border border-slate-100 text-slate-600 hover:bg-[var(--color-mod-accounting-bg)] hover:border-[var(--color-mod-accounting-border)]"
                  )}
                >
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <report.icon size={16} />
                    {report.label}
                  </div>
                  <span className={cn("text-[10px]", activeReport === report.id ? "text-[var(--color-mod-accounting-text)]/70" : "text-slate-400")}>
                    {report.desc}
                  </span>
                </button>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="xl:col-span-3 space-y-6">
          <SectionCard>
             <ReportFilters onFilterChange={(f) => setFilters(prev => ({ ...prev, ...f }))} />
          </SectionCard>

          <SectionCard className="min-h-[400px] shadow-sm">
            <div className="mb-6 flex items-center justify-between">
               <div>
                 <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                   {activeReport.replace('-', ' ')}
                 </h3>
                 <p className="text-xs font-medium text-slate-400 mt-0.5">Ledger-backed preview</p>
               </div>
               <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--color-mod-accounting-text)] uppercase tracking-wider bg-[var(--color-mod-accounting-bg)] px-3 py-1.5 rounded-lg">
                  <History size={12} />
                  Current ledger data
               </div>
            </div>
            <div className="animate-in fade-in duration-700">
              {renderReportContent()}
            </div>
          </SectionCard>

          <SectionCard title="Saved Snapshots" description="Protected report files generated through File Registry.">
            <div className="space-y-2" data-testid="accounting-report-snapshots">
              {((snapshotsQuery.data as any)?.items ?? [])
                .filter((item: any) => String(item.reportKey ?? '').includes(activeReport))
                .slice(0, 5)
                .map((item: any) => (
                  <button
                    key={item.id}
                    onClick={() => api.downloadReportSnapshot(item.id)}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <span className="font-bold text-slate-700">{item.reportKey}</span>
                    <span className="text-xs text-slate-400">{item.format?.toUpperCase()} - {new Date(item.createdAt).toLocaleDateString()}</span>
                  </button>
                ))}
              {(((snapshotsQuery.data as any)?.items ?? []).filter((item: any) => String(item.reportKey ?? '').includes(activeReport)).length === 0) && (
                <p className="text-sm text-slate-500">No saved snapshots for this report yet.</p>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
