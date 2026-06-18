'use client';

import React, { useRef, useState } from 'react';
import { CollectionCounter } from './collection-counter';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CheckCircle2, AlertCircle, Printer, X } from 'lucide-react';
import { ErrorState } from '@/components/ui/error-state';

interface CollectionSectionProps {
  invoices: any[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  initialInvoiceId?: string | null;
}

export function CollectionSection({ invoices, isLoading, isError, onRetry, initialInvoiceId }: CollectionSectionProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [lastReceipt, setLastReceipt] = useState<any>(null);
  const paymentAttemptRef = useRef<{ fingerprint: string; key: string } | null>(null);

  const paymentMutation = useMutation({
    mutationFn: async (payload: any) => {
      const fingerprint = JSON.stringify(payload);
      if (paymentAttemptRef.current?.fingerprint !== fingerprint) {
        paymentAttemptRef.current = {
          fingerprint,
          key: crypto.randomUUID(),
        };
      }
      return api.collectPayment({
        ...payload,
        idempotencyKey: paymentAttemptRef.current.key,
      });
    },
    onSuccess: (result) => {
      paymentAttemptRef.current = null;
      setLastReceipt(result);
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      void queryClient.invalidateQueries({ queryKey: ['receipts'] });
      void queryClient.invalidateQueries({ queryKey: ['ledger-entries'] });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
  });

  const filteredInvoices = invoices.filter(inv => {
    if (!searchQuery) return inv.status !== 'PAID';
    const q = searchQuery.toLowerCase();
    return (
      inv.invoiceNumber?.toLowerCase().includes(q) ||
      inv.student?.name?.toLowerCase().includes(q) ||
      inv.student?.studentSystemId?.toLowerCase().includes(q)
    );
  }).filter(inv => inv.status !== 'PAID');

  const handleOpenReceipt = async () => {
    if (!lastReceipt?.receiptNumber) return;
    await api.openReceiptPdf(lastReceipt.receiptNumber);
  };

  if (isError) {
    return (
      <ErrorState
        title="Fee invoices could not load"
        message="The collection counter is unavailable right now. No payment has been recorded."
        onRetry={onRetry}
      />
    );
  }

  return (
    <div className="space-y-8">
      {lastReceipt && (
        <div className="animate-in slide-in-from-top-4 flex items-center justify-between rounded-xl border border-success-100 bg-success-50 p-6 shadow-sm duration-500">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-500 text-white shadow-lg shadow-success-500/20">
              <CheckCircle2 size={24} />
            </div>
            <div>
               <p className="text-sm font-black tracking-tight text-success-900">Payment collected successfully</p>
               <p className="mt-0.5 text-xs font-bold uppercase tracking-widest text-success-700">Receipt #{lastReceipt.receiptNumber} generated</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button 
              onClick={handleOpenReceipt}
              className="flex items-center gap-2 rounded-xl border border-success-100 bg-white px-6 py-3 text-xs font-bold text-success-700 shadow-sm transition-all hover:bg-success-100 active:scale-95"
             >
               <Printer size={16} />
               Open Receipt
             </button>
             <button 
              onClick={() => setLastReceipt(null)}
              className="p-3 text-success-400 transition-colors hover:text-success-600"
              aria-label="Dismiss receipt success message"
             >
               <X size={20} />
             </button>
          </div>
        </div>
      )}

      {paymentMutation.isError && (
        <div className="animate-fade-in flex items-center gap-4 rounded-xl border border-danger-100 bg-danger-50 p-6 text-sm font-bold text-danger-800">
          <AlertCircle size={24} className="text-danger-500" />
          <div className="flex flex-col">
             <span className="text-[0.65rem] uppercase tracking-widest text-danger-600 mb-1">Payment Failed</span>
             {(paymentMutation.error as any).message}
          </div>
        </div>
      )}

      <CollectionCounter
        onSearch={setSearchQuery}
        invoices={filteredInvoices}
        isLoading={isLoading}
        isSubmitting={paymentMutation.isPending}
        initialInvoiceId={initialInvoiceId}
        onCollect={(invoiceId, amount, method, reference, remarks) => {
          setLastReceipt(null);
          paymentMutation.mutate({
            invoiceId,
            amount,
            method,
            reference,
            narration: remarks || `Counter collection via Finance Dashboard`
          });
        }}
      />
    </div>
  );
}
