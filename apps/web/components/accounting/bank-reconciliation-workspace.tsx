'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { SectionCard } from '../ui/section-card';
import { Select } from '../ui/select';
import { Loader2, Upload, CheckCircle2, AlertTriangle, ArrowRightLeft, Search, Landmark, Download } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ReportTable } from './report-table';
import { Input } from '../ui/input';
import { ConfirmDialog } from '../ui/confirm-dialog';

export function BankReconciliationWorkspace() {
  const queryClient = useQueryClient();
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [matching, setMatching] = useState<string | null>(null); // statementId being matched
  const [isConfirmingRecon, setIsConfirmingRecon] = useState<{ statementId: string; journalLineId: string } | null>(null);
  const [journalFilter, setJournalFilter] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const accountsQuery = useQuery({ 
    queryKey: ['chart-accounts'], 
    queryFn: api.listChartAccounts 
  });
  
  const bankAccounts = (accountsQuery.data ?? []).filter(a => 
    a.type === 'ASSET' && (a.name.toLowerCase().includes('bank') || a.name.toLowerCase().includes('cash'))
  );

  const summaryQuery = useQuery({
    queryKey: ['bank-recon-summary', selectedAccountId],
    queryFn: () => api.getReconciliationSummary(selectedAccountId),
    enabled: !!selectedAccountId
  });

  const unreconciledQuery = useQuery({
    queryKey: ['unreconciled-statements', selectedAccountId],
    queryFn: () => api.getUnreconciledStatements(selectedAccountId),
    enabled: !!selectedAccountId
  });

  const ledgerQuery = useQuery({
    queryKey: ['ledger-entries', selectedAccountId],
    queryFn: () => api.listGeneralLedger({ accountId: selectedAccountId }),
    enabled: !!selectedAccountId
  });

  const suggestionsQuery = useQuery({
    queryKey: ['bank-recon-suggestions', selectedAccountId],
    queryFn: () => api.suggestReconciliationMatches(selectedAccountId),
    enabled: false
  });

  const importMutation = useMutation({
    mutationFn: (lines: any[]) => api.importBankStatement(selectedAccountId, lines),
    onSuccess: () => {
      setMessage('Bank statement imported successfully');
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['bank-recon-summary', selectedAccountId] });
      queryClient.invalidateQueries({ queryKey: ['unreconciled-statements', selectedAccountId] });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (err: any) => {
      setError(err.message || 'Import failed');
      setMessage(null);
    }
  });

  const reconcileMutation = useMutation({
    mutationFn: (data: { statementId: string; journalLineId: string }) => 
      api.reconcileStatement(data.statementId, data.journalLineId),
    onSuccess: () => {
      setMessage('Transaction reconciled');
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['bank-recon-summary', selectedAccountId] });
      queryClient.invalidateQueries({ queryKey: ['unreconciled-statements', selectedAccountId] });
      setMatching(null);
      setIsConfirmingRecon(null);
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (err: any) => {
      setError(err.message || 'Reconciliation failed');
      setMessage(null);
      setIsConfirmingRecon(null);
    }
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').slice(1).filter(l => l.trim()).map(line => {
          const cols = line.split(',');
          // Simple CSV mapping: Date, Description, Reference, Debit, Credit
          return {
            statementDate: cols[0],
            description: cols[1],
            reference: cols[2],
            debitAmount: Number(cols[3]) || 0,
            creditAmount: Number(cols[4]) || 0
          };
        });
        
        if (lines.length === 0) throw new Error('No valid lines found in CSV');
        importMutation.mutate(lines);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-sm font-medium text-emerald-800 flex items-center gap-2">
          <CheckCircle2 size={16} />
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-100 p-4 text-sm font-medium text-rose-800 flex items-center gap-2">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 items-end">
        <div className="space-y-2 w-full md:w-80">
          <label className="text-sm font-medium text-slate-700">Select Bank/Cash Account</label>
          <Select 
            value={selectedAccountId} 
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedAccountId(e.target.value)}
            className="rounded-2xl border-slate-200"
          >
            <option value="">Choose account...</option>
            {bankAccounts.map(a => (
              <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
            ))}
          </Select>
        </div>

        {selectedAccountId && (
          <div className="flex gap-2 w-full md:w-auto">
            <label className="flex flex-1 md:flex-none items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition-all">
              <Upload size={16} />
              {importing ? 'Processing...' : 'Import CSV Statement'}
              <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={importing} />
            </label>
            <button
              type="button"
              onClick={() => suggestionsQuery.refetch()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              data-testid="bank-reconciliation-auto-match"
            >
              <Search size={16} />
              Auto-match
            </button>
            <button
              type="button"
              onClick={() => api.exportBankReconciliationPdf(selectedAccountId)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all"
            >
              <Download size={16} />
              Export PDF
            </button>
          </div>
        )}
      </div>

      {selectedAccountId && suggestionsQuery.data && (
        <SectionCard title="Auto-match Suggestions" description="Deterministic suggestions. Confirm matches manually before reconciliation.">
          <div className="space-y-2" data-testid="bank-reconciliation-suggestions">
            {(suggestionsQuery.data as any[]).flatMap((row: any) =>
              (row.candidates ?? []).slice(0, 2).map((candidate: any) => (
                <div key={`${row.bankTransactionId}-${candidate.ledgerTransactionId}`} className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-slate-800">{row.description}</div>
                      <div className="text-xs text-slate-500">{candidate.confidence} / score {candidate.score} / {candidate.reason}</div>
                    </div>
                    <button
                      className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white disabled:opacity-40"
                      disabled={candidate.warningFlags?.includes('DUPLICATE_CANDIDATE') || candidate.confidence === 'LOW'}
                      onClick={() => setIsConfirmingRecon({ statementId: row.bankTransactionId, journalLineId: candidate.ledgerTransactionId })}
                    >
                      Review
                    </button>
                  </div>
                  {candidate.warningFlags?.length > 0 && (
                    <div className="mt-2 text-xs font-bold text-amber-700">{candidate.warningFlags.join(', ')}</div>
                  )}
                </div>
              )),
            )}
            {(suggestionsQuery.data as any[]).every((row: any) => (row.candidates ?? []).length === 0) && (
              <p className="text-sm text-slate-500">No safe auto-match suggestions found.</p>
            )}
          </div>
        </SectionCard>
      )}

      {selectedAccountId && summaryQuery.data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-[2rem] bg-white border border-slate-100 p-6 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Statements</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{summaryQuery.data.totalStatements}</p>
          </div>
          <div className="rounded-[2rem] bg-emerald-50 border border-emerald-100 p-6 shadow-sm">
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Reconciled</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{summaryQuery.data.reconciledStatements}</p>
          </div>
          <div className="rounded-[2rem] bg-amber-50 border border-amber-100 p-6 shadow-sm">
            <p className="text-xs font-bold text-amber-600 uppercase tracking-widest">Unreconciled</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">{summaryQuery.data.unreconciledStatements}</p>
          </div>
          <div className="rounded-[2rem] bg-slate-900 border border-slate-800 p-6 shadow-lg shadow-slate-900/10">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ledger Balance</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {(Number(summaryQuery.data.statementBalance.debit || 0) - Number(summaryQuery.data.statementBalance.credit || 0)).toLocaleString(undefined, { style: 'currency', currency: 'NPR' })}
            </p>
          </div>
        </div>
      )}

      {selectedAccountId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard title="Unreconciled Statements" description="Bank statement lines waiting for a matching ledger entry.">
            <div className="max-h-[600px] overflow-y-auto">
              <ReportTable
                headers={['Date', 'Description', 'Amount', 'Action']}
                rows={(unreconciledQuery.data ?? []).map((stmt: any) => ({
                  id: stmt.id,
                  className: matching === stmt.id ? "bg-primary-50 ring-2 ring-primary-500 ring-inset" : "",
                  cells: [
                    { value: stmt.statementDate, type: 'date' },
                    { value: stmt.description },
                    { 
                      value: stmt.debitAmount > 0 ? stmt.debitAmount : -stmt.creditAmount, 
                      type: 'currency',
                      className: stmt.debitAmount > 0 ? "text-emerald-600" : "text-rose-600"
                    },
                    { 
                      value: (
                      <button
                        onClick={() => setMatching(matching === stmt.id ? null : stmt.id)}
                        className={cn(
                          "rounded-lg px-3 py-1 text-xs font-bold transition-all",
                          matching === stmt.id 
                            ? "bg-primary-600 text-white shadow-md shadow-primary-600/20" 
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                      >
                        {matching === stmt.id ? 'Cancel' : 'Match'}
                      </button>
                      )
                    }
                  ]
                }))}
              />
            </div>
          </SectionCard>

          <SectionCard 
            title="General Ledger Matcher" 
            description={matching ? "Select the corresponding ledger entry for the selected statement line." : "Select a statement line on the left to start matching."}
          >
            <div className="space-y-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input 
                  placeholder="Search by journal # or amount..." 
                  className="pl-10 rounded-2xl border-slate-200"
                  value={journalFilter}
                  onChange={(e) => setJournalFilter(e.target.value)}
                />
              </div>

              <div className="max-h-[500px] overflow-y-auto">
                <ReportTable
                  headers={['Date', 'Journal #', 'Amount', 'Select']}
                  rows={(ledgerQuery.data as any[] ?? [])
                    .filter((row: any) => 
                      !row.reconciled && 
                      (row.journalNumber.includes(journalFilter) || String(row.debit).includes(journalFilter) || String(row.credit).includes(journalFilter))
                    )
                    .map((row: any) => ({
                      id: row.journalLineId,
                      cells: [
                        { value: row.date, type: 'date' },
                        { value: row.journalNumber, bold: true },
                        { 
                          value: row.debit > 0 ? row.debit : -row.credit, 
                          type: 'currency',
                          className: row.debit > 0 ? "text-emerald-600" : "text-rose-600"
                        },
                        {
                          value: (
                            <button
                              disabled={!matching}
                              onClick={() => matching && setIsConfirmingRecon({ statementId: matching, journalLineId: row.journalLineId })}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all disabled:opacity-30"
                            >
                              <ArrowRightLeft size={16} />
                            </button>
                          )
                        }
                      ]
                    }))
                  }
                />
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {!selectedAccountId && (
        <div className="flex flex-col items-center justify-center py-20 rounded-[3rem] bg-slate-50 border border-dashed border-slate-200 text-center">
          <div className="h-16 w-16 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
            <Landmark size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Start Bank Reconciliation</h3>
          <p className="mt-2 text-sm text-slate-500 max-w-sm">
            Select a bank or cash account from the dropdown above to begin matching statement lines with your ledger entries.
          </p>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!isConfirmingRecon}
        onClose={() => setIsConfirmingRecon(null)}
        onConfirm={() => isConfirmingRecon && reconcileMutation.mutate(isConfirmingRecon)}
        title="Confirm Reconciliation"
        description="Are you sure you want to reconcile this statement line with the selected ledger entry? This action cannot be easily undone."
        confirmLabel={reconcileMutation.isPending ? 'Reconciling...' : 'Confirm'}
      />
    </div>
  );
}
