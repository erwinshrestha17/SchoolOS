'use client';

import { formatBsDate, type StudentProfileInvoice } from '@schoolos/core';
import { SectionCard } from '@/components/ui/section-card';
import { Wallet, Receipt, ChevronRight, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type FeesTabProps = {
  studentId: string;
  invoices: StudentProfileInvoice[];
};

const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('en-NP', {
    style: 'currency',
    currency: 'NPR',
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (date: string | Date) => {
  try {
    return formatBsDate(date);
  } catch {
    return 'Invoice date not recorded';
  }
};

export function FeesTab({ studentId, invoices }: FeesTabProps) {
  const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.outstandingAmount, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid gap-6 lg:grid-cols-3">
         <SectionCard title="Fee Status" className="lg:col-span-1">
            <div className="space-y-6">
               <div className="flex items-end gap-2">
                 <span className={cn(
                   "text-3xl font-extrabold",
                   totalOutstanding > 0 ? "text-danger-500" : "text-success-500"
                 )}>
                   {formatMoney(totalOutstanding)}
                 </span>
                 <span className="mb-1 text-xs font-bold text-slate-400 uppercase tracking-wider">Balance Due</span>
               </div>
               
               <div className="space-y-3 pt-4 border-t border-slate-100">
                  <Link 
                    href={`/dashboard/fees/collect?studentId=${encodeURIComponent(studentId)}`}
                    className="group flex min-h-12 items-center justify-between rounded-xl border border-[var(--color-mod-admissions-border)] bg-[var(--color-mod-admissions-bg)] p-4 text-[var(--color-mod-admissions-text)] transition hover:border-[var(--color-mod-admissions-accent)] hover:bg-white"
                  >
                    <div className="flex items-center gap-3">
                       <Wallet size={18} className="text-[var(--color-mod-admissions-accent)]" />
                       <span className="text-sm font-bold">Collect Payment</span>
                    </div>
                    <ChevronRight size={18} className="transition group-hover:translate-x-1" />
                  </Link>
               </div>
            </div>
         </SectionCard>

         <SectionCard title="Billing History" description="Recent invoices and payment status" className="lg:col-span-2" noPadding>
            {invoices.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between transition hover:bg-slate-50/50">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        invoice.status === 'PAID' ? "bg-success-50 text-success-600" : 
                        invoice.status === 'PARTIAL' ? "bg-warning-50 text-warning-600" : "bg-danger-50 text-danger-600"
                      )}>
                        {invoice.status === 'PAID' ? <CheckCircle2 size={20} /> : 
                         invoice.status === 'PARTIAL' ? <Clock size={20} /> : <AlertTriangle size={20} />}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">Invoice #{invoice.invoiceNumber}</p>
                        <p className="text-[0.7rem] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                          {formatDate(invoice.issuedAt || invoice.dueDate)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between gap-6 sm:justify-end">
                      <div className="text-right">
                        <p className="font-bold text-slate-900">{formatMoney(invoice.totalAmount)}</p>
                        {invoice.outstandingAmount > 0 && (
                          <p className="text-[0.7rem] font-bold text-danger-500 uppercase tracking-wider">
                            {formatMoney(invoice.outstandingAmount)} Left
                          </p>
                        )}
                      </div>
                      <Badge variant={invoice.status === 'PAID' ? 'success' : invoice.status === 'PARTIAL' ? 'warning' : 'destructive'}>
                        {invoice.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-mod-admissions-border)] bg-[var(--color-mod-admissions-bg)] text-[var(--color-mod-admissions-accent)]">
                  <Receipt size={32} />
                </div>
                <p className="text-sm font-bold text-slate-900">No invoices found</p>
                <p className="mt-1 text-xs text-slate-400">Financial records will appear after enrollment billing.</p>
              </div>
            )}
         </SectionCard>
      </div>
    </div>
  );
}
