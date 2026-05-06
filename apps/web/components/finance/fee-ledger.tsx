'use client';

import React from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Download, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Invoice {
  id: string;
  invoiceNumber: string;
  issuedAt: string;
  dueDate: string;
  totalAmount: number;
  outstandingAmount: number;
  status: string;
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

export function FeeLedger({ invoices, isLoading }: FeeLedgerProps) {
  const columns = [
    {
      header: 'Invoice #',
      cell: (inv: Invoice) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-900">{inv.invoiceNumber}</span>
          <span className="text-[0.65rem] text-slate-400 font-bold uppercase tracking-wider">
            Issued {format(new Date(inv.issuedAt), 'MMM d, yyyy')}
          </span>
        </div>
      )
    },
    {
      header: 'Due Date',
      cell: (inv: Invoice) => (
        <span className={cn(
          "font-medium",
          new Date(inv.dueDate) < new Date() && inv.outstandingAmount > 0 ? "text-destructive" : "text-slate-600"
        )}>
          {format(new Date(inv.dueDate), 'MMM d, yyyy')}
        </span>
      )
    },
    {
      header: 'Total',
      cell: (inv: Invoice) => <span className="font-black text-slate-900">{formatCurrency(inv.totalAmount)}</span>
    },
    {
      header: 'Outstanding',
      cell: (inv: Invoice) => (
        <span className={cn(
          "font-black",
          inv.outstandingAmount > 0 ? "text-destructive" : "text-emerald-600"
        )}>
          {formatCurrency(inv.outstandingAmount)}
        </span>
      )
    },
    {
      header: 'Status',
      cell: (inv: Invoice) => (
        <Badge variant={inv.status === 'PAID' ? 'success' : inv.status === 'PARTIAL' ? 'warning' : 'destructive'}>
          {inv.status}
        </Badge>
      )
    },
    {
      header: 'Actions',
      cell: (inv: Invoice) => (
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-900 transition-colors" title="Print Receipt">
            <Receipt size={16} />
          </button>
          <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-900 transition-colors" title="Download PDF">
            <Download size={16} />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={invoices}
        isLoading={isLoading}
        emptyMessage="No financial records found for this student."
      />
    </div>
  );
}
