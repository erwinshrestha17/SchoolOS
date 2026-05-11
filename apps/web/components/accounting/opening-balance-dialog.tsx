'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { Loader2, Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface OpeningBalanceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fiscalYear: any;
  accounts: any[];
}

export function OpeningBalanceDialog({ isOpen, onClose, fiscalYear, accounts }: OpeningBalanceDialogProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lines, setLines] = useState<any[]>([
    { chartAccountId: '', side: 'DEBIT', amount: 0 },
    { chartAccountId: '', side: 'CREDIT', amount: 0 },
  ]);

  const totalDebit = lines.filter(l => l.side === 'DEBIT').reduce((sum, l) => sum + Number(l.amount), 0);
  const totalCredit = lines.filter(l => l.side === 'CREDIT').reduce((sum, l) => sum + Number(l.amount), 0);
  const diff = totalDebit - totalCredit;

  const mutation = useMutation({
    mutationFn: (data: any) => api.createOpeningBalance(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting-report'] });
      onClose();
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to record opening balance');
    },
    onSettled: () => setLoading(false),
  });

  const addLine = () => setLines([...lines, { chartAccountId: '', side: 'DEBIT', amount: 0 }]);
  const removeLine = (index: number) => setLines(lines.filter((_, i) => i !== index));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (Math.abs(diff) > 0.001) {
      setError('Opening balance must be balanced (Total Debit must equal Total Credit)');
      return;
    }

    setLoading(true);
    mutation.mutate({
      fiscalYearId: fiscalYear.id,
      lines: lines.map(l => ({ ...l, amount: Number(l.amount) })),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Opening Balance - {fiscalYear?.name}</DialogTitle>
          <p className="text-sm text-slate-500">
            Set the starting balances for the chart of accounts for this fiscal year.
          </p>
        </DialogHeader>

        {error && (
          <div className="mt-4 rounded-xl bg-rose-50 border border-rose-100 p-4 text-sm font-medium text-rose-800 flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col py-4">
          <div className="flex-1 overflow-y-auto space-y-4 px-1">
            <div className="grid grid-cols-12 gap-2 font-bold text-xs text-slate-500 uppercase tracking-wider pb-2 border-b border-slate-100">
              <div className="col-span-6">Account</div>
              <div className="col-span-2">Side</div>
              <div className="col-span-3 text-right">Amount</div>
              <div className="col-span-1"></div>
            </div>

            {lines.map((line, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-6">
                  <Select 
                    value={line.chartAccountId} 
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                      const newLines = [...lines];
                      newLines[index].chartAccountId = e.target.value;
                      setLines(newLines);
                    }}
                  >
                    <option value="">Select account</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                    ))}
                  </Select>
                </div>
                <div className="col-span-2">
                  <Select 
                    value={line.side} 
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                      const newLines = [...lines];
                      newLines[index].side = e.target.value;
                      setLines(newLines);
                    }}
                  >
                    <option value="DEBIT">Debit</option>
                    <option value="CREDIT">Credit</option>
                  </Select>
                </div>
                <div className="col-span-3">
                  <Input
                    type="number"
                    step="0.01"
                    className="text-right font-mono"
                    value={line.amount}
                    onChange={(e) => {
                      const newLines = [...lines];
                      newLines[index].amount = e.target.value;
                      setLines(newLines);
                    }}
                    required
                  />
                </div>
                <div className="col-span-1 flex justify-center">
                  <button 
                    type="button" 
                    onClick={() => removeLine(index)}
                    className="text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addLine}
              className="flex items-center gap-2 text-sm font-bold text-primary-600 hover:text-primary-700 transition-colors py-2"
            >
              <Plus size={16} />
              Add line
            </button>
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 p-4 space-y-2 border border-slate-100 shadow-inner">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Total Debit:</span>
              <span className="font-bold font-mono text-slate-900">{totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Total Credit:</span>
              <span className="font-bold font-mono text-slate-900">{totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className={cn(
              "flex justify-between pt-2 border-t border-slate-200 text-base font-bold",
              Math.abs(diff) < 0.001 ? "text-emerald-600" : "text-rose-600"
            )}>
              <span>Difference:</span>
              <span className="font-mono">
                {Math.abs(diff) < 0.001 ? "BALANCED" : diff.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            {Math.abs(diff) >= 0.001 && (
              <div className="flex items-center gap-2 mt-2 text-xs text-rose-500 font-semibold bg-rose-50 p-2 rounded-lg border border-rose-100">
                <AlertCircle size={14} />
                The entry must be balanced before it can be saved.
              </div>
            )}
          </div>

          <DialogFooter className="mt-6 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || Math.abs(diff) > 0.001}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:bg-slate-800 disabled:opacity-50"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Save Opening Balance
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
