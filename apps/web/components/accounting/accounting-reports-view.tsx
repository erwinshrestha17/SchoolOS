import { useMutation, useQuery } from '@tanstack/react-query';
import { 
  BarChart3, FileText, PieChart, History, 
  Wallet, Calculator, Download, AlertCircle, FileSpreadsheet
} from 'lucide-react';
import { api } from '../../lib/api';
import { SectionCard } from '../ui/section-card';
import { PageState } from '../ui/page-state';
import { cn } from '../../lib/utils';
import { useState } from 'react';
import { AuditInfo } from '../ui/audit-info';
import { ReportFilters } from './report-filters';
import { ReportTable } from './report-table';

type ReportType = 'trial-balance' | 'income-statement' | 'balance-sheet' | 'general-ledger' | 'cash-book' | 'tax-summary';

export function AccountingReportsView({ initialReport = 'trial-balance' }: { initialReport?: ReportType }) {
  const [activeReport, setActiveReport] = useState<ReportType>(initialReport);
  const [filters, setFilters] = useState<{
    startDate?: string;
    endDate?: string;
    fiscalYearId?: string;
    fiscalPeriodId?: string;
  }>({});

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

  const exportMutation = useMutation({ 
    mutationFn: (report: string) => api.exportAccountingCsv(report),
    onSuccess: () => {
      // Success feedback handled by browser download
    },
    onError: (err) => {
      console.error('Export failed:', err);
    }
  });

  const isExportSupported = (report: string) => {
    return ['trial-balance', 'general-ledger', 'income-statement', 'balance-sheet'].includes(report);
  };

  const renderReportContent = () => {
    if (reportQuery.isLoading) {
      return (
        <PageState
          tone="loading"
          title="Generating Financial Report"
          description="Backend is processing ledger data for the selected period."
        />
      );
    }

    if (reportQuery.isError) {
      return (
        <PageState
          tone="danger"
          title="Report Generation Failed"
          description={reportQuery.error?.message ?? 'Could not retrieve data from the financial ledger.'}
        />
      );
    }

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

    if (activeReport === 'tax-summary') {
      return (
        <ReportTable
          headers={['Type', 'Reference', 'Amount', 'Tax Rate', 'Tax Amount']}
          rows={(data as any[] ?? []).map((row, index) => ({
            id: `tax-${index}`,
            cells: [
              { value: row.type, bold: true },
              { value: row.reference },
              { value: row.baseAmount, type: 'currency' },
              { value: `${row.taxRate}%` },
              { value: row.taxAmount, type: 'currency', bold: true },
            ],
          }))}
        />
      );
    }

    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10">
      <AuditInfo>
        These reports are generated from backend ledger records. Posted journals are immutable; use reversal workflows for corrections.
      </AuditInfo>

      <SectionCard>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'trial-balance', label: 'Trial Balance', icon: BarChart3 },
              { id: 'income-statement', label: 'Income Statement', icon: FileText },
              { id: 'balance-sheet', label: 'Balance Sheet', icon: PieChart },
              { id: 'general-ledger', label: 'General Ledger', icon: History },
              { id: 'cash-book', label: 'Cash Book', icon: Wallet },
              { id: 'tax-summary', label: 'VAT/TDS/PF', icon: Calculator },
            ].map((report) => (
              <button
                key={report.id}
                onClick={() => setActiveReport(report.id as ReportType)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all",
                  activeReport === report.id
                    ? "bg-slate-900 text-white shadow-xl shadow-slate-900/10"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                <report.icon size={16} />
                {report.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {!isExportSupported(activeReport) && (
              <div className="flex items-center gap-2 text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100">
                <AlertCircle size={12} />
                CSV Export Pending for this report
              </div>
            )}
            <button
              onClick={() => exportMutation.mutate(activeReport)}
              disabled={exportMutation.isPending || !isExportSupported(activeReport)}
              className="group inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all disabled:opacity-30 disabled:grayscale"
            >
              <FileSpreadsheet size={18} className="transition-transform group-hover:scale-110" />
              {exportMutation.isPending ? 'Generating CSV...' : 'Download CSV'}
            </button>
          </div>
        </div>
        <div className="mt-6 border-t border-slate-100 pt-6">
          <ReportFilters onFilterChange={(f) => setFilters(prev => ({ ...prev, ...f }))} />
        </div>
      </SectionCard>

      <SectionCard className="border-none shadow-2xl shadow-slate-200/50">
        <div className="mb-4 flex items-center justify-between">
           <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
             {activeReport.replace('-', ' ')} Preview
           </h3>
           <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
              <History size={14} />
              Generated {new Date().toLocaleString()}
           </div>
        </div>
        {renderReportContent()}
      </SectionCard>
    </div>
  );
}
