'use client';

import React, { useState } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Download, Receipt, Printer, Undo2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReprintDialog } from './reprint-dialog';
import { ReversalDialog } from './reversal-dialog';
import { api } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { StatusBadge } from '@/components/ui/status-badge';

interface Invoice {
  id: string;
  invoiceNumber: string;
  issuedAt: string;
  dueDate: string;
  totalAmount: number;
  outstandingAmount: number;
  status: string;
  receiptId?: string | null;
  receiptNumber?: string | null;
  student?: {
    name: string;
    studentSystemId: string;
  };
}

interface FeeLedgerProps {
  invoices: Invoice[];
  isLoading?: boolean;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-NP', {
    style: 'currency',
    currency: 'NPR',
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-NP', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));

export function FeeLedger({ invoices, isLoading }: FeeLedgerProps) {
  const queryClient = useQueryClient();
  const [selectedReceipt, setSelectedReceipt] = useState<{ id: string; number: string } | null>(null);
  const [reversalTarget, setReversalTarget] = useState<Invoice | null>(null);

  const reverseMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.reversePayment(id, { reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      void queryClient.invalidateQueries({ queryKey: ['ledger-entries'] });
    },
  });

  const columns = [
    {
      header: 'Invoice #',
      cell: (inv: Invoice) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-900">{inv.invoiceNumber}</span>
          <span className="text-[0.65rem] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
            Issued {formatDate(inv.issuedAt)}
          </span>
        </div>
      )
    },
    {
      header: 'Student',
      cell: (inv: Invoice) => (
        <div className="flex flex-col">
          <span className="text-sm font-bold text-slate-900">{inv.student?.name || 'Student name not set'}</span>
          <span className="text-[0.6rem] text-slate-400 uppercase tracking-widest">{inv.student?.studentSystemId || 'Student ID not set'}</span>
        </div>
      )
    },
    {
      header: 'Due Date',
      cell: (inv: Invoice) => (
        <span className={cn(
          "text-xs font-bold",
          new Date(inv.dueDate) < new Date() && inv.outstandingAmount > 0 ? "text-danger-600" : "text-slate-500"
        )}>
          {formatDate(inv.dueDate)}
        </span>
      )
    },
    {
      header: 'Total',
      cell: (inv: Invoice) => <span className="font-black text-slate-900 text-sm">{formatCurrency(inv.totalAmount)}</span>
    },
    {
      header: 'Outstanding',
      cell: (inv: Invoice) => (
        <span className={cn(
          "font-black text-sm",
          inv.outstandingAmount > 0 ? "text-danger-600" : "text-emerald-600"
        )}>
          {formatCurrency(inv.outstandingAmount)}
        </span>
      )
    },
    {
      header: 'Status',
      cell: (inv: Invoice) => <StatusBadge status={inv.status} className="h-6" />
    },
    {
      header: 'Actions',
      cell: (inv: Invoice) => (
        <div className="flex items-center gap-1">
          {inv.receiptNumber && (
            <button 
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-900 transition-all active:scale-90" 
              title="Print Receipt"
              onClick={() => setSelectedReceipt({ id: inv.receiptId!, number: inv.receiptNumber! })}
            >
              <Printer size={16} />
            </button>
          )}
          <button 
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-900 transition-all active:scale-90" 
            title="Download Invoice"
          >
            <Download size={16} />
          </button>
          {inv.status !== 'UNPAID' && (
            <button 
              className="p-2 hover:bg-danger-50 rounded-xl text-slate-300 hover:text-danger-600 transition-all active:scale-90" 
              title="Reverse Payment"
              onClick={() => setReversalTarget(inv)}
            >
              <Undo2 size={16} />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-100 overflow-hidden bg-white shadow-sm">
        <DataTable
          columns={columns}
          data={invoices}
          isLoading={isLoading}
          emptyMessage="No financial records found."
        />
      </div>

      {selectedReceipt && (
        <ReprintDialog
          receiptId={selectedReceipt.id}
          receiptNumber={selectedReceipt.number}
          isOpen={!!selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}

      {reversalTarget && (
        <ReversalDialog
          invoiceId={reversalTarget.id}
          invoiceNumber={reversalTarget.invoiceNumber}
          isOpen={!!reversalTarget}
          onClose={() => setReversalTarget(null)}
          onConfirm={async (reason) => {
            await reverseMutation.mutateAsync({ id: reversalTarget.id, reason });
          }}
        />
      )}
    </div>
  );
}
