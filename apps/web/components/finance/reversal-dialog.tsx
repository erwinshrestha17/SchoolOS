'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertTriangle, Loader2, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReversalDialogProps {
  invoiceId: string;
  invoiceNumber: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

export function ReversalDialog({ invoiceId, invoiceNumber, isOpen, onClose, onConfirm }: ReversalDialogProps) {
  const [reason, setReason] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!reason.trim()) return;
    setIsSubmitting(true);
    try {
      await onConfirm(reason);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-[2.5rem] p-8">
        <DialogHeader>
          <div className="h-14 w-14 rounded-2xl bg-danger-50 text-danger-600 flex items-center justify-center mb-6">
            <AlertTriangle size={28} />
          </div>
          <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight">Reverse Payment?</DialogTitle>
          <DialogDescription className="text-sm text-slate-500 mt-2 leading-relaxed">
            You are about to reverse all payments associated with invoice <span className="font-bold text-slate-900">{invoiceNumber}</span>. This action is audited and irreversible.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-6">
           <div className="p-4 bg-danger-50 border border-danger-100 rounded-2xl space-y-2">
              <p className="text-[0.65rem] font-black text-danger-600 uppercase tracking-widest">Consequences</p>
              <ul className="text-[0.7rem] text-danger-700 space-y-1 font-medium opacity-80">
                 <li>• Outstanding balance will be restored.</li>
                 <li>• Associated receipts will be marked as VOID.</li>
                 <li>• Financial ledger will reflect a reversal entry.</li>
              </ul>
           </div>

           <div className="space-y-3">
              <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest ml-1">Reason for Reversal</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Wrong student selected, incorrect amount, check bounced..."
                className="w-full min-h-[100px] p-4 text-sm font-medium rounded-2xl border-slate-100 bg-slate-50 focus:bg-white transition-all resize-none"
              />
           </div>
        </div>

        <DialogFooter className="mt-8 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 px-6 py-3 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors"
          >
            Cancel
          </button>
          {!isConfirming ? (
            <button
              onClick={() => setIsConfirming(true)}
              disabled={!reason.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-danger-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-danger-600/20 transition-all hover:bg-danger-700 active:scale-95 disabled:opacity-50"
            >
              Request Reversal
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-danger-900 text-white rounded-xl font-bold text-sm shadow-xl transition-all hover:scale-105 active:scale-95"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Undo2 size={18} />}
              Confirm IRREVERSIBLE Reversal
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
