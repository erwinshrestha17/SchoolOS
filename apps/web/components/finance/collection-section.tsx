'use client';

import React, { useState } from 'react';
import { CollectionCounter } from './collection-counter';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CheckCircle2, AlertCircle, Printer, X, Download } from 'lucide-react';

interface CollectionSectionProps {
  invoices: any[];
  isLoading?: boolean;
}

export function CollectionSection({ invoices, isLoading }: CollectionSectionProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [lastReceipt, setLastReceipt] = useState<any>(null);

  const paymentMutation = useMutation({
    mutationFn: async (payload: any) => await api.collectPayment(payload),
    onSuccess: (result) => {
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

  return (
    <div className="space-y-8">
      {lastReceipt && (
        <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-[2.5rem] flex items-center justify-between shadow-lg shadow-emerald-500/5 animate-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <CheckCircle2 size={24} />
            </div>
            <div>
               <p className="text-sm font-black text-emerald-900 tracking-tight">Payment Collected Successfully</p>
               <p className="text-xs text-emerald-700 font-bold uppercase tracking-widest mt-0.5">Receipt #{lastReceipt.receiptNumber} Generated</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button 
              onClick={handleOpenReceipt}
              className="flex items-center gap-2 px-6 py-3 bg-white text-emerald-700 border border-emerald-200 rounded-xl font-bold text-xs shadow-sm hover:bg-emerald-100 transition-all active:scale-95"
             >
               <Printer size={16} />
               Print Receipt
             </button>
             <button 
              onClick={() => setLastReceipt(null)}
              className="p-3 text-emerald-400 hover:text-emerald-600 transition-colors"
             >
               <X size={20} />
             </button>
          </div>
        </div>
      )}

      {paymentMutation.isError && (
        <div className="p-6 bg-danger-50 border border-danger-100 rounded-[2.5rem] flex items-center gap-4 text-danger-800 text-sm font-bold animate-fade-in">
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
