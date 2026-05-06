'use client';

import React, { useState } from 'react';
import { SectionCard } from '@/components/ui/section-card';
import { Badge } from '@/components/ui/badge';
import { Wallet, Search, CreditCard, Banknote, History, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface CollectionCounterProps {
  onSearch: (query: string) => void;
  invoices: any[];
  onCollect: (invoiceId: string, amount: number, method: string) => void;
  isLoading?: boolean;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-NP', {
    style: 'currency',
    currency: 'NPR',
    maximumFractionDigits: 0,
  }).format(amount);
};

export function CollectionCounter({ onSearch, invoices, onCollect, isLoading }: CollectionCounterProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState('CASH');

  return (
    <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
      <SectionCard title="Search & Select" description="Find student or invoice">
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                onSearch(e.target.value);
              }}
              placeholder="Student name, ID, or Invoice #"
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border-slate-100 rounded-xl focus:ring-1 focus:ring-slate-900"
            />
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
            {invoices.map((inv) => (
              <button
                key={inv.id}
                onClick={() => {
                  setSelectedInvoice(inv);
                  setAmount(inv.outstandingAmount);
                }}
                className={cn(
                  "w-full flex items-start justify-between p-4 rounded-2xl border text-left transition-all",
                  selectedInvoice?.id === inv.id
                    ? "bg-slate-900 border-slate-900 text-white shadow-lg"
                    : "bg-white border-slate-100 hover:border-slate-200 text-slate-900"
                )}
              >
                <div>
                  <p className="text-sm font-bold truncate max-w-[200px]">{inv.student?.name || 'Unknown'}</p>
                  <p className={cn(
                    "text-[0.65rem] font-bold uppercase tracking-wider mt-0.5",
                    selectedInvoice?.id === inv.id ? "text-slate-400" : "text-slate-500"
                  )}>
                    {inv.invoiceNumber} • {inv.student?.studentSystemId}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black">{formatCurrency(inv.outstandingAmount)}</p>
                  <Badge variant={inv.status === 'PARTIAL' ? 'warning' : 'destructive'} className="mt-1 h-5 text-[0.6rem]">
                    {inv.status}
                  </Badge>
                </div>
              </button>
            ))}
            {invoices.length === 0 && !isLoading && (
              <p className="text-sm text-slate-500 text-center py-8">No outstanding invoices found.</p>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard 
        title="Payment Collection" 
        description={selectedInvoice ? `Collecting for ${selectedInvoice.student?.name}` : 'Select an invoice to proceed'}
      >
        {selectedInvoice ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Due</p>
                <p className="text-xl font-black text-slate-900">{formatCurrency(selectedInvoice.totalAmount)}</p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                <p className="text-[0.6rem] font-bold text-emerald-600 uppercase tracking-widest mb-1">Balance</p>
                <p className="text-xl font-black text-emerald-700">{formatCurrency(selectedInvoice.outstandingAmount)}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest mb-1">Due Date</p>
                <p className="text-sm font-bold text-slate-900 mt-1">{format(new Date(selectedInvoice.dueDate), 'MMM d, yyyy')}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest mb-1">Invoice #</p>
                <p className="text-sm font-bold text-slate-900 mt-1">{selectedInvoice.invoiceNumber}</p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Payment Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-slate-400">NPR</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full pl-16 pr-4 py-4 text-2xl font-black bg-white border-2 border-slate-100 rounded-2xl focus:border-slate-900 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'CASH', icon: <Banknote size={16} />, label: 'Cash' },
                    { id: 'BANK', icon: <CreditCard size={16} />, label: 'Bank' },
                    { id: 'TRANSFER', icon: <History size={16} />, label: 'Transfer' },
                    { id: 'MOBILE', icon: <CreditCard size={16} />, label: 'Mobile' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMethod(m.id)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border-2 font-bold text-sm transition-all",
                        method === m.id
                          ? "bg-slate-900 border-slate-900 text-white"
                          : "bg-white border-slate-50 text-slate-600 hover:border-slate-200"
                      )}
                    >
                      {m.icon}
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-4 pt-6 border-t border-slate-100">
              <button 
                onClick={() => setSelectedInvoice(null)}
                className="px-6 py-3 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => onCollect(selectedInvoice.id, amount, method)}
                disabled={amount <= 0 || amount > selectedInvoice.outstandingAmount}
                className="flex items-center gap-2 px-10 py-3 bg-emerald-600 text-white rounded-xl font-bold transition-all hover:bg-emerald-700 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 shadow-lg shadow-emerald-600/20"
              >
                Collect Payment
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
            <div className="h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400 mb-4 flex">
              <Wallet size={32} />
            </div>
            <p className="text-sm font-bold text-slate-900">No Invoice Selected</p>
            <p className="text-xs text-slate-500 mt-1 max-w-[200px]">Select an outstanding invoice from the left panel to begin collection.</p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
