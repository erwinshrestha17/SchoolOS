'use client';

import React, { useState } from 'react';
import { CollectionCounter } from './collection-counter';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface CollectionSectionProps {
  invoices: any[];
  isLoading?: boolean;
}

export function CollectionSection({ invoices, isLoading }: CollectionSectionProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const paymentMutation = useMutation({
    mutationFn: async (payload: any) => await api.collectPayment(payload),
    onSuccess: () => {
      setSuccessMessage('Payment collected successfully and receipt generated.');
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      void queryClient.invalidateQueries({ queryKey: ['receipts'] });
      void queryClient.invalidateQueries({ queryKey: ['ledger-entries'] });
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

  return (
    <div className="space-y-6">
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-800 text-sm font-bold animate-fade-in">
          <CheckCircle2 size={18} />
          {successMessage}
          <button 
            onClick={() => setSuccessMessage('')}
            className="ml-auto text-emerald-400 hover:text-emerald-600"
          >
            Close
          </button>
        </div>
      )}

      {paymentMutation.isError && (
        <div className="p-4 bg-destructive/5 border border-destructive/10 rounded-2xl flex items-center gap-3 text-destructive text-sm font-bold animate-fade-in">
          <AlertCircle size={18} />
          {(paymentMutation.error as any).message}
        </div>
      )}

      <CollectionCounter
        onSearch={setSearchQuery}
        invoices={filteredInvoices}
        isLoading={isLoading}
        onCollect={(invoiceId, amount, method) => {
          paymentMutation.mutate({
            invoiceId,
            amount,
            method,
            narration: `Counter collection via Finance Dashboard`
          });
        }}
      />
    </div>
  );
}
