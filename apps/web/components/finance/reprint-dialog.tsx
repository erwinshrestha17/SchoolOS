'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Clock3, Loader2 } from 'lucide-react';

interface ReprintDialogProps {
  receiptId: string;
  receiptNumber: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ReprintDialog({ receiptId, receiptNumber, isOpen, onClose }: ReprintDialogProps) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const historyQuery = useQuery({
    queryKey: ['receipt-reprint-history', receiptId],
    queryFn: () => api.getReceiptReprintHistory(receiptId),
    enabled: isOpen && Boolean(receiptId),
  });

  const handleReprint = async () => {
    if (!reason.trim()) {
      setError('Reprint reason is required');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await api.reprintReceipt(receiptId, reason);
      await queryClient.invalidateQueries({
        queryKey: ['receipt-reprint-history', receiptId],
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reprint receipt');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-2xl border-slate-200 shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-slate-900">Reprint Receipt</DialogTitle>
          <DialogDescription className="text-slate-500 font-medium">
            You are reprinting receipt <span className="font-bold text-slate-900">{receiptNumber}</span>. 
            A mandatory audit reason is required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="mb-2 ml-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Reprint Reason
            </label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Customer lost original copy"
              className="h-12 rounded-xl border-slate-200 text-sm"
            />
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Reprint audit history
                </p>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  Backend-recorded receipt copies for this tenant.
                </p>
              </div>
              {historyQuery.isLoading ? (
                <Loader2 size={16} className="shrink-0 animate-spin text-slate-400" />
              ) : (
                <Clock3 size={16} className="shrink-0 text-slate-400" />
              )}
            </div>

            {historyQuery.isError ? (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-danger-100 bg-danger-50 px-3 py-2 text-xs font-bold text-danger-600">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>
                  {historyQuery.error instanceof Error
                    ? historyQuery.error.message
                    : 'Could not load reprint history.'}
                </span>
              </div>
            ) : historyQuery.data?.items.length ? (
              <div className="mt-3 max-h-44 space-y-2 overflow-y-auto pr-1">
                {historyQuery.data.items.slice(0, 8).map((entry) => (
                  <div key={entry.id} className="rounded-xl bg-white px-3 py-2 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-xs font-bold text-slate-700">
                        {entry.reason}
                      </p>
                      <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-slate-400">
                        {entry.format}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] font-medium text-slate-500">
                      {new Date(entry.reprintedAt).toLocaleString('en-NP', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                      {entry.reprintedBy?.email ? ` by ${entry.reprintedBy.email}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            ) : !historyQuery.isLoading ? (
              <p className="mt-3 rounded-xl bg-white px-3 py-3 text-center text-xs font-semibold text-slate-500">
                No previous reprints recorded.
              </p>
            ) : null}
          </div>
        </div>

        {error && (
          <p className="text-xs font-bold text-red-600 px-1 mb-4">{error}</p>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isLoading} className="rounded-xl font-bold">
            Cancel
          </Button>
          <Button 
            onClick={handleReprint} 
            disabled={isLoading || !reason.trim()} 
            className="rounded-xl font-bold bg-[var(--color-mod-fees-accent)] text-white hover:bg-[var(--color-mod-fees-text)]"
          >
            {isLoading ? 'Reprinting...' : 'Reprint & Download'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
