'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { toast } from 'sonner';
import { Loader2, AlertTriangle, Lock, Unlock } from 'lucide-react';

interface FiscalYearCloseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fiscalYear: any;
  mode: 'CLOSE' | 'REOPEN';
}

export function FiscalYearCloseDialog({ isOpen, onClose, fiscalYear, mode }: FiscalYearCloseDialogProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: (data: any) => {
      if (mode === 'CLOSE') return api.closeFiscalYear(fiscalYear.id);
      return api.reopenFiscalYear(fiscalYear.id, { reason });
    },
    onSuccess: () => {
      toast.success(`Fiscal year ${mode === 'CLOSE' ? 'closed' : 'reopened'} successfully`);
      queryClient.invalidateQueries({ queryKey: ['fiscal-years'] });
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || `Failed to ${mode.toLowerCase()} fiscal year`);
    },
    onSettled: () => setLoading(false),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    mutation.mutate({});
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mb-4">
            {mode === 'CLOSE' ? <Lock size={24} /> : <Unlock size={24} />}
          </div>
          <DialogTitle className="text-center">
            {mode === 'CLOSE' ? 'Close Fiscal Year' : 'Reopen Fiscal Year'}
          </DialogTitle>
          <p className="text-center text-sm text-slate-500 mt-2">
            {mode === 'CLOSE' 
              ? `Are you sure you want to close ${fiscalYear?.name}? This will generate closing entries for all revenue and expense accounts and transfer net income to Retained Earnings.`
              : `Reopening ${fiscalYear?.name} will allow further postings. Please provide a reason for the audit trail.`}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {mode === 'CLOSE' && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Before you close:</p>
                  <ul className="text-xs text-amber-700 space-y-1 list-disc ml-4">
                    <li>Ensure all transactions for the year are recorded.</li>
                    <li>Verify all bank accounts are reconciled.</li>
                    <li>Confirm all fiscal periods for this year are CLOSED.</li>
                    <li>Once closed, no further transactions can be posted without reopening.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {mode === 'REOPEN' && (
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Reason for reopening</label>
              <textarea
                className="w-full min-h-[100px] rounded-2xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Describe why this fiscal year needs to be reopened..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>
          )}

          <DialogFooter className="pt-4 grid grid-cols-2 gap-2 sm:space-x-0">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-xl px-6 py-2 text-sm font-semibold text-white shadow-lg transition-all disabled:opacity-50",
                mode === 'CLOSE' ? "bg-slate-900 hover:bg-slate-800" : "bg-primary-600 hover:bg-primary-700"
              )}
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {mode === 'CLOSE' ? 'Confirm Close' : 'Confirm Reopen'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
