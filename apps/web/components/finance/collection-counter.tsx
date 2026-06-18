'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { SectionCard } from '@/components/ui/section-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Wallet, Search, CreditCard, Banknote, History, ChevronRight, User, GraduationCap, MapPin, Phone, Receipt, Printer, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '../ui/input';
import { LoadingState } from '../ui/loading-state';
import { EmptyState } from '../ui/empty-state';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

interface CollectionCounterProps {
  onSearch: (query: string) => void;
  invoices: any[];
  onCollect: (invoiceId: string, amount: number, method: string, reference?: string, remarks?: string) => void;
  isLoading?: boolean;
  isSubmitting?: boolean;
  initialInvoiceId?: string | null;
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

export function CollectionCounter({ onSearch, invoices, onCollect, isLoading, isSubmitting, initialInvoiceId }: CollectionCounterProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState('CASH');
  const [reference, setReference] = useState('');
  const [remarks, setRemarks] = useState('');

  const selectedInvoice = useMemo(() => 
    invoices.find(inv => inv.id === selectedInvoiceId) || null,
  [invoices, selectedInvoiceId]);

  const invoiceDetailQuery = useQuery({
    queryKey: ['invoice-detail', selectedInvoiceId],
    queryFn: () => api.getInvoiceDetail(selectedInvoiceId!),
    enabled: !!selectedInvoiceId,
  });

  const handleSelectInvoice = (inv: any) => {
    setSelectedInvoiceId(inv.id);
    setAmount(0);
    setReference('');
    setRemarks('');
  };

  useEffect(() => {
    if (!initialInvoiceId || selectedInvoiceId === initialInvoiceId) return;

    const linkedInvoice = invoices.find((invoice) => invoice.id === initialInvoiceId);

    if (!linkedInvoice) return;

    setSelectedInvoiceId(linkedInvoice.id);
    setAmount(0);
    setReference('');
    setRemarks('');
  }, [initialInvoiceId, invoices, selectedInvoiceId]);

  useEffect(() => {
    if (!invoiceDetailQuery.data) return;
    setAmount(invoiceDetailQuery.data.outstandingAmount);
  }, [invoiceDetailQuery.data]);

  return (
    <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
      <SectionCard title="Student Discovery" description="Search by name, ID or invoice number">
        <div className="space-y-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                onSearch(e.target.value);
              }}
              placeholder="Find student or invoice..."
              className="pl-12 h-14 rounded-2xl border-slate-100 bg-slate-50/50 focus:bg-white transition-all shadow-sm"
            />
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {invoices.map((inv) => (
              <button
                key={inv.id}
                onClick={() => handleSelectInvoice(inv)}
                className={cn(
                  "w-full flex items-start justify-between p-5 rounded-2xl border transition-all duration-300 group",
                  selectedInvoiceId === inv.id
                    ? "bg-[var(--color-mod-fees-bg)] border-[var(--color-mod-fees-border)] text-[var(--color-mod-fees-text)] shadow-sm translate-x-1"
                    : "bg-white border-slate-100 hover:border-[var(--color-mod-fees-border)] text-slate-900 hover:bg-[var(--color-mod-fees-bg)]"
                )}
              >
                <div className="flex gap-4">
                  <div className={cn(
                    "h-12 w-12 rounded-2xl flex items-center justify-center transition-colors",
                    selectedInvoiceId === inv.id ? "bg-white text-[var(--color-mod-fees-accent)]" : "bg-slate-50 text-slate-400 group-hover:bg-white"
                  )}>
                    <User size={20} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-black truncate max-w-[160px] tracking-tight">{inv.student?.name || 'Student name not set'}</p>
                    <p className={cn(
                      "text-[0.65rem] font-bold uppercase tracking-widest mt-1",
                      selectedInvoiceId === inv.id ? "text-[var(--color-mod-fees-text)]/70" : "text-slate-500"
                    )}>
                      {inv.invoiceNumber}
                    </p>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end">
                  <p className="text-xs font-bold text-slate-500">Open invoice</p>
                  <StatusBadge status={inv.status} className="mt-2 h-5" />
                </div>
              </button>
            ))}
            {isLoading && (
              <div className="py-12 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--color-mod-fees-accent)]" />
              </div>
            )}
            {invoices.length === 0 && !isLoading && (
              <EmptyState 
                title="No Records Found" 
                description="Try searching with a different student ID or name."
                className="py-12"
              />
            )}
          </div>
        </div>
      </SectionCard>

      <div className="space-y-6">
        {selectedInvoice ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-700">
            {/* Student Quick Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <SummaryCard 
                icon={<GraduationCap size={18} />} 
                label="Student Detail" 
                value={invoiceDetailQuery.data?.student.name || selectedInvoice.student?.name || 'Student name not set'}
                sub={invoiceDetailQuery.data?.student.studentSystemId || 'Student ID loading'}
               />
               <SummaryCard 
                icon={<MapPin size={18} />} 
                label="Class / Section" 
                value={invoiceDetailQuery.data?.student.className || 'Class not set'}
                sub={invoiceDetailQuery.data?.student.sectionName || 'Section not set'}
               />
               <SummaryCard 
                icon={<Phone size={18} />} 
                label="Primary Guardian" 
                value={invoiceDetailQuery.data?.student.guardianName || 'Guardian not recorded'}
                sub={invoiceDetailQuery.data?.student.guardianPhone || 'Guardian phone not recorded'}
               />
            </div>

            {invoiceDetailQuery.isError ? (
              <div className="flex items-center gap-3 rounded-2xl border border-danger-100 bg-danger-50 p-4 text-sm font-bold text-danger-700" role="alert">
                <AlertCircle size={18} />
                Invoice details could not load. Payment collection is disabled until you retry or select the invoice again.
              </div>
            ) : null}

            <SectionCard 
              title="Collection Detail" 
              description="Review breakdown and finalize payment collection."
              headerAction={
                <div className="flex items-center gap-2 rounded-xl bg-[var(--color-mod-fees-bg)] border border-[var(--color-mod-fees-border)] px-4 py-2 text-[0.65rem] font-black text-[var(--color-mod-fees-text)] uppercase tracking-widest">
                     <Receipt size={14} />
                     Invoice breakdown
                </div>
              }
            >
              <div className="space-y-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <StatItem label="Total Billed" value={invoiceDetailQuery.data ? formatCurrency(invoiceDetailQuery.data.totalAmount) : 'Loading'} />
                  <StatItem label="Paid Amount" value={invoiceDetailQuery.data ? formatCurrency(invoiceDetailQuery.data.paidAmount) : 'Loading'} color="text-emerald-600" />
                  <StatItem label="Current Balance" value={invoiceDetailQuery.data ? formatCurrency(invoiceDetailQuery.data.outstandingAmount) : 'Loading'} color="text-danger-600 font-black" />
                  <StatItem label="Due Date" value={formatDate(selectedInvoice.dueDate)} />
                </div>

                {/* Dues Breakdown (if available) */}
                {invoiceDetailQuery.data && (
                  <div className="space-y-3">
                    <h5 className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest ml-1">Fee Breakdown</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {invoiceDetailQuery.data.lines?.map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl">
                          <span className="text-xs font-bold text-slate-700">{item.feeHeadName || 'Fee head not set'}</span>
                          <span className="text-xs font-black text-slate-900">{formatCurrency(item.netAmount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid gap-8 md:grid-cols-2">
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest ml-2">Collection Amount</label>
                      <div className="relative group">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400 pointer-events-none transition-colors group-focus-within:text-[var(--color-mod-fees-accent)]">NPR</span>
                        <Input
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(Number(e.target.value))}
                          className="pl-20 text-3xl font-black h-20 rounded-2xl border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-[var(--color-mod-fees-accent)]/10 transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                         <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest ml-2">Reference #</label>
                         <Input 
                          placeholder="e.g. Check/Bank Ref" 
                          value={reference}
                          onChange={(e) => setReference(e.target.value)}
                          className="h-12 rounded-xl border-slate-100 bg-slate-50/50"
                         />
                       </div>
                       <div className="space-y-2">
                         <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest ml-2">Remarks</label>
                         <Input 
                          placeholder="Note for ledger..." 
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          className="h-12 rounded-xl border-slate-100 bg-slate-50/50"
                         />
                       </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest ml-2">Payment Method</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'CASH', icon: <Banknote size={18} />, label: 'Cash Payment' },
                        { id: 'BANK', icon: <CreditCard size={18} />, label: 'Bank Deposit' },
                        { id: 'TRANSFER', icon: <History size={18} />, label: 'Online Transfer' },
                        { id: 'MOBILE', icon: <CreditCard size={18} />, label: 'Mobile Wallet' },
                      ].map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setMethod(m.id)}
                          className={cn(
                            "flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-300",
                            method === m.id
                              ? "bg-[var(--color-mod-fees-bg)] border-[var(--color-mod-fees-border)] text-[var(--color-mod-fees-text)] shadow-sm"
                              : "bg-white border-slate-100 text-slate-600 hover:border-[var(--color-mod-fees-border)]"
                          )}
                        >
                          <div className={cn(
                            "h-8 w-8 rounded-lg flex items-center justify-center",
                            method === m.id ? "bg-white" : "bg-slate-50"
                          )}>
                            {m.icon}
                          </div>
                          <span className="text-[0.7rem] font-black uppercase tracking-wider">{m.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-8 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-slate-400">
                    <AlertCircle size={16} />
                    <span className="text-[0.65rem] font-bold">Collect exactly NPR {amount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setSelectedInvoiceId(null)}
                      className="px-8 py-3 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors"
                    >
                      Reset selection
                    </button>
                    <button
                      onClick={() => onCollect(selectedInvoice.id, amount, method, reference, remarks)}
                      disabled={
                        isSubmitting ||
                        invoiceDetailQuery.isLoading ||
                        !invoiceDetailQuery.data ||
                        amount <= 0 ||
                        amount > invoiceDetailQuery.data.outstandingAmount
                      }
                      className="flex items-center gap-3 px-12 py-4 bg-[var(--color-mod-fees-accent)] text-white rounded-2xl font-black text-sm shadow-sm transition-all hover:bg-[var(--color-mod-fees-text)] active:scale-95 disabled:opacity-50"
                    >
                      <CheckSquare size={20} />
                      {isSubmitting ? 'Recording Payment...' : 'Finalize & Print Receipt'}
                    </button>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        ) : (
          <div className="h-[700px] rounded-2xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-center p-12 bg-slate-50/20">
            <div className="h-24 w-24 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-300 mb-8 border border-slate-50">
              <Wallet size={48} />
            </div>
            <h4 className="text-2xl font-black text-slate-900 tracking-tight">Fee Collection Counter</h4>
            <p className="text-sm text-slate-500 mt-3 max-w-[320px] leading-relaxed">Select an outstanding invoice from the search results to load student details and process payment.</p>
            
            <div className="mt-12 grid grid-cols-3 gap-6 opacity-30 grayscale">
               <div className="flex flex-col items-center gap-2">
                 <div className="h-12 w-12 rounded-2xl bg-white flex items-center justify-center"><User size={24} /></div>
                 <span className="text-[0.6rem] font-black uppercase tracking-widest">Select</span>
               </div>
               <div className="flex flex-col items-center gap-2">
                 <div className="h-12 w-12 rounded-2xl bg-white flex items-center justify-center"><Banknote size={24} /></div>
                 <span className="text-[0.6rem] font-black uppercase tracking-widest">Process</span>
               </div>
               <div className="flex flex-col items-center gap-2">
                 <div className="h-12 w-12 rounded-2xl bg-white flex items-center justify-center"><Printer size={24} /></div>
                 <span className="text-[0.6rem] font-black uppercase tracking-widest">Receipt</span>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center gap-4">
      <div className="h-12 w-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        <p className="text-sm font-black text-slate-900 truncate mt-0.5">{value}</p>
        {sub && <p className="text-[0.65rem] font-bold text-slate-500 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function StatItem({ label, value, color = "text-slate-900" }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[0.6rem] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{label}</span>
      <span className={cn("text-lg font-black tracking-tight", color)}>{value}</span>
    </div>
  );
}

function CheckSquare({ size, className }: { size?: number, className?: string }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="3" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <polyline points="9 11 12 14 22 4"></polyline>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
    </svg>
  );
}
