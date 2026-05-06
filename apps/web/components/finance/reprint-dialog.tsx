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

interface ReprintDialogProps {
  receiptId: string;
  receiptNumber: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ReprintDialog({ receiptId, receiptNumber, isOpen, onClose }: ReprintDialogProps) {
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReprint = async () => {
    if (!reason.trim()) {
      setError('Reprint reason is required');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await api.reprintReceipt(receiptId, reason);
      onClose();
    } catch (err) {
      setError('Failed to reprint receipt');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-[2rem] border-slate-200 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-slate-900">Reprint Receipt</DialogTitle>
          <DialogDescription className="text-slate-500 font-medium">
            You are reprinting receipt <span className="font-bold text-slate-900">{receiptNumber}</span>. 
            A mandatory audit reason is required.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">
            Reprint Reason
          </label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Customer lost original copy"
            className="rounded-xl border-slate-200 h-12 text-sm"
          />
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
            className="rounded-xl font-bold bg-slate-900 text-white hover:bg-slate-800"
          >
            {isLoading ? 'Reprinting...' : 'Reprint & Download'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
