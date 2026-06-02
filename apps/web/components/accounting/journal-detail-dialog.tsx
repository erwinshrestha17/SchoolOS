import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Loader2, ArrowLeftRight, Ban, CheckCircle2, AlertCircle, RotateCcw, Wrench } from 'lucide-react';
import { JournalEntryView } from '@schoolos/core';
import { cn } from '../../lib/utils';
import { Toast, type ToastTone } from '../ui/toast';

interface JournalDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  entry: JournalEntryView | null;
}

export function JournalDetailDialog({ isOpen, onClose, entry }: JournalDetailDialogProps) {
  const queryClient = useQueryClient();
  const [isReversing, setIsReversing] = useState(false);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState<{
    title: string;
    description?: string;
    tone: ToastTone;
  } | null>(null);

  const postMutation = useMutation({
    mutationFn: (id: string) => api.postJournal(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ledger-entries'] });
      onClose();
    },
    onError: (err: Error) => {
      setNotice({
        title: 'Posting failed',
        description: err.message || 'Failed to post journal entry',
        tone: 'danger',
      });
    },
  });

  const reverseMutation = useMutation({
    mutationFn: (id: string) => api.reverseJournal(id, { reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ledger-entries'] });
      resetState();
      onClose();
    },
    onError: (err: Error) => {
      setNotice({
        title: 'Reversal failed',
        description: err.message || 'Failed to reverse journal entry',
        tone: 'danger',
      });
    },
  });

  const correctMutation = useMutation({
    mutationFn: (id: string) => api.correctJournal(id, { reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ledger-entries'] });
      resetState();
      onClose();
    },
    onError: (err: Error) => {
      setNotice({
        title: 'Correction failed',
        description: err.message || 'Failed to correct journal entry',
        tone: 'danger',
      });
    },
  });

  const resetState = () => {
    setIsReversing(false);
    setIsCorrecting(false);
    setReason('');
  };

  const handleClose = () => {
    resetState();
    setNotice(null);
    onClose();
  };

  if (!entry) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NP', {
      style: 'currency',
      currency: 'NPR',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'POSTED': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'DRAFT': return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
      case 'SUBMITTED': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'REVERSED': return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
      case 'CANCELLED': return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
      default: return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-extrabold flex items-center gap-3">
                {entry.entryNumber}
                <Badge variant="outline" className={cn("text-[10px] font-bold uppercase tracking-widest", getStatusColor(entry.status))}>
                  {entry.status}
                </Badge>
              </DialogTitle>
              <p className="text-sm text-slate-500 font-medium">
                Posted on {new Date(entry.entryDate).toLocaleDateString()} • {entry.sourceType}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Amount</p>
              <p className="text-lg font-black text-slate-900">{formatCurrency(entry.totalDebit)}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-6 space-y-6">
          {notice ? (
            <Toast
              title={notice.title}
              description={notice.description}
              tone={notice.tone}
              onDismiss={() => setNotice(null)}
              className="max-w-none"
            />
          ) : null}

          {(isReversing || isCorrecting) && (
            <div className={cn(
              "rounded-2xl p-5 border animate-in slide-in-from-top-4 duration-300",
              isReversing ? "bg-rose-50 border-rose-100" : "bg-amber-50 border-amber-100"
            )}>
              <div className="flex gap-3 mb-4">
                <AlertCircle size={20} className={isReversing ? "text-rose-600" : "text-amber-600"} />
                <div>
                  <p className={cn("text-sm font-bold", isReversing ? "text-rose-900" : "text-amber-900")}>
                    {isReversing ? "Reverse Posted Journal" : "Correct Posted Journal"}
                  </p>
                  <p className={cn("text-xs mt-0.5 font-medium leading-relaxed", isReversing ? "text-rose-700" : "text-amber-700")}>
                    Posted journals are immutable for audit integrity. This action will create a new balancing transaction. 
                    A clear reason is required for the audit trail.
                  </p>
                </div>
              </div>
              
              <div className="space-y-3">
                <label className={cn("text-[10px] font-black uppercase tracking-widest block", isReversing ? "text-rose-600" : "text-amber-600")}>
                  Reason for {isReversing ? 'Reversal' : 'Correction'}
                </label>
                <textarea
                  className={cn(
                    "w-full rounded-xl border p-3 text-sm font-medium focus:outline-none focus:ring-2 transition-all min-h-[80px]",
                    isReversing 
                      ? "border-rose-200 focus:ring-rose-500 text-rose-900 placeholder:text-rose-300" 
                      : "border-amber-200 focus:ring-amber-500 text-amber-900 placeholder:text-amber-300"
                  )}
                  placeholder={`Why is this ${isReversing ? 'reversal' : 'correction'} necessary?`}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="mt-5 flex justify-end gap-3">
                <button
                  onClick={resetState}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Cancel Action
                </button>
                <button
                  onClick={() => isReversing ? reverseMutation.mutate(entry.id) : correctMutation.mutate(entry.id)}
                  disabled={!reason.trim() || reverseMutation.isPending || correctMutation.isPending}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl px-6 py-2 text-xs font-bold text-white shadow-lg transition-all disabled:opacity-50",
                    isReversing 
                      ? "bg-rose-600 shadow-rose-600/20 hover:bg-rose-700" 
                      : "bg-amber-600 shadow-amber-600/20 hover:bg-amber-700"
                  )}
                >
                  {(reverseMutation.isPending || correctMutation.isPending) ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    isReversing ? <RotateCcw size={14} /> : <Wrench size={14} />
                  )}
                  Confirm {isReversing ? 'Reversal' : 'Correction'}
                </button>
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 shadow-inner">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Narration</p>
            <p className="text-sm font-semibold text-slate-700">{entry.narration}</p>
            {entry.reference && (
              <div className="mt-2 flex items-center gap-2 text-xs font-medium text-slate-500">
                <span className="font-bold text-slate-400">REF:</span>
                {entry.reference}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ledger Impact</p>
            <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left font-bold text-slate-600">Account</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-600">Debit</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-600">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entry.lines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{line.accountName}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{line.accountCode}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">
                        {line.side === 'DEBIT' ? formatCurrency(line.amount) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-rose-600">
                        {line.side === 'CREDIT' ? formatCurrency(line.amount) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 text-white font-bold">
                    <td className="px-4 py-3">Totals</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(entry.totalDebit)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(entry.totalCredit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="rounded-xl border border-slate-100 p-3 flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Posted By</span>
                <span className="text-sm font-bold text-slate-700">
                  {entry.postedBy ? `${entry.postedBy.firstName} ${entry.postedBy.lastName}` : 'System'}
                </span>
             </div>
             <div className="rounded-xl border border-slate-100 p-3 flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Entry Date</span>
                <span className="text-sm font-bold text-slate-700">{new Date(entry.entryDate).toLocaleString()}</span>
             </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 p-4 border-t bg-slate-50/50">
          {!isReversing && !isCorrecting && (
            <>
              {entry.status === 'SUBMITTED' && (
                <button
                  onClick={() => postMutation.mutate(entry.id)}
                  disabled={postMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all disabled:opacity-50"
                >
                  {postMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Approve & Post
                </button>
              )}
              
              {entry.status === 'POSTED' && (
                <div className="flex gap-2 mr-auto">
                  <button
                    onClick={() => setIsReversing(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-6 py-2 text-sm font-bold text-white shadow-lg shadow-rose-600/20 hover:bg-rose-700 transition-all"
                  >
                    <RotateCcw size={16} />
                    Reverse
                  </button>
                  <button
                    onClick={() => setIsCorrecting(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-6 py-2 text-sm font-bold text-white shadow-lg shadow-amber-600/20 hover:bg-amber-700 transition-all"
                  >
                    <Wrench size={16} />
                    Correct
                  </button>
                </div>
              )}

              <button
                onClick={handleClose}
                className="rounded-xl border border-slate-200 px-6 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
              >
                Close
              </button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
