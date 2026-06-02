'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { SectionCard } from '@/components/ui/section-card';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/loading-state';
import { Wallet, Printer, CheckCircle2, AlertCircle, Banknote, CreditCard, History, Loader2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import type { CashierCloseSummary } from '@schoolos/core';

export function CashierCloseSection() {
  const queryClient = useQueryClient();
  const [remarks, setRemarks] = useState('');
  const [openingClosePdfId, setOpeningClosePdfId] = useState<string | null>(null);
  const [closePdfError, setClosePdfError] = useState<string | null>(null);
  
  const openedAt = new Date();
  openedAt.setHours(0, 0, 0, 0);
  const closedAt = new Date();

  const previewQuery = useQuery({
    queryKey: ['cashier-close-preview'],
    queryFn: () => api.previewCashierClose({
      openedAt: openedAt.toISOString(),
      closedAt: closedAt.toISOString(),
    }),
  });

  const closesQuery = useQuery({
    queryKey: ['cashier-closes'],
    queryFn: () => api.listCashierCloses(),
  });

  const closeMutation = useMutation({
    mutationFn: (body: any) => api.finalizeCashierClose(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cashier-closes'] });
      void queryClient.invalidateQueries({ queryKey: ['cashier-close-preview'] });
      setRemarks('');
    },
  });

  if (previewQuery.isLoading) return <LoadingState variant="page" label="Calculating daily collection totals..." />;

  const preview = previewQuery.data;
  const latestCloseWithPdf =
    closeMutation.data?.closePdfFile
      ? closeMutation.data
      : closesQuery.data?.find((close) => close.closePdfFile);

  async function openClosePdf(close: CashierCloseSummary) {
    setClosePdfError(null);

    if (!close.closePdfFile) {
      setClosePdfError('The protected close PDF is not available yet.');
      return;
    }

    try {
      setOpeningClosePdfId(close.id);
      const view = await api.getFileView(close.closePdfFile.fileAssetId);
      window.open(view.url, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      setClosePdfError(
        err instanceof Error
          ? err.message
          : 'Failed to open the day-end close PDF.',
      );
    } finally {
      setOpeningClosePdfId(null);
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NP', {
      style: 'currency',
      currency: 'NPR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const methodIcons: Record<string, any> = {
    CASH: <Banknote size={16} />,
    BANK: <CreditCard size={16} />,
    TRANSFER: <History size={16} />,
    MOBILE: <CreditCard size={16} />,
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="grid gap-6 md:grid-cols-3">
         <CollectionStat 
          label="Total Collection" 
          value={formatCurrency(preview?.totalCollected || 0)} 
          sub={`${preview?.transactionCount || 0} Transactions`}
          icon={<Wallet size={20} />}
          color="emerald"
         />
         <CollectionStat 
          label="Cash in Hand" 
          value={formatCurrency(preview?.byMethod?.find((m: any) => m.method === 'CASH')?.amount || 0)} 
          sub="Physical Handover"
          icon={<Banknote size={20} />}
          color="primary"
         />
         <CollectionStat 
          label="Bank / Digital" 
          value={formatCurrency((preview?.totalCollected || 0) - (preview?.byMethod?.find((m: any) => m.method === 'CASH')?.amount || 0))} 
          sub="Verified in Statements"
          icon={<CreditCard size={20} />}
          color="amber"
         />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        <SectionCard 
          title="Daily Collection Summary" 
          description={`From ${openedAt.toLocaleTimeString()} to ${closedAt.toLocaleTimeString()}`}
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {preview?.byMethod?.map((m: any) => (
                <div key={m.method} className="flex items-center justify-between p-5 bg-white border border-slate-100 rounded-3xl shadow-sm transition-all hover:border-slate-200">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center">
                      {methodIcons[m.method] || <CreditCard size={16} />}
                    </div>
                    <div>
                      <p className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">{m.method}</p>
                      <p className="text-sm font-bold text-slate-900">{m.count} Payments</p>
                    </div>
                  </div>
                  <p className="text-lg font-black text-slate-900 tracking-tighter">{formatCurrency(m.amount)}</p>
                </div>
              ))}
            </div>

            <div className="p-6 bg-slate-900 rounded-[2.5rem] text-white">
               <div className="flex items-center justify-between mb-4">
                  <p className="text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.2em]">Collector Breakdown</p>
                  <Badge variant="phase2" className="bg-primary-500/20 text-primary-400 border-none">Active Counter</Badge>
               </div>
               <div className="space-y-4">
                  {preview?.byUser?.map((u: any) => (
                    <div key={u.userId} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                       <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-[0.65rem] font-bold">
                             {u.userName?.slice(0, 2).toUpperCase() || 'US'}
                          </div>
                          <span className="text-sm font-bold">{u.userName}</span>
                       </div>
                       <span className="text-sm font-black text-primary-400">{formatCurrency(u.amount)}</span>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard 
          title="Counter Handover" 
          description="Finalize today's collection and hand over to accounting."
        >
          <div className="space-y-6">
             <div className="space-y-3">
                <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest ml-1">Handover Remarks</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Total cash tallied, one check pending clearance..."
                  className="w-full min-h-[120px] p-4 text-sm font-medium rounded-2xl border-slate-100 bg-slate-50/50 focus:bg-white transition-all resize-none"
                />
             </div>

             <div className="p-5 bg-warning-50 border border-warning-100 rounded-2xl flex gap-3 text-warning-800">
                <AlertCircle size={20} className="shrink-0" />
                <div className="space-y-1">
                   <p className="text-xs font-black uppercase tracking-tight">Financial Safeguard</p>
                   <p className="text-[0.7rem] font-medium leading-relaxed opacity-80">Closing the cashier will lock all transactions within this window. Ensure physical cash matches the total above.</p>
                </div>
             </div>

             <button
              onClick={() => closeMutation.mutate({
                openedAt: openedAt.toISOString(),
                closedAt: closedAt.toISOString(),
                remarks,
                summary: preview,
              })}
              disabled={closeMutation.isPending || (preview?.totalCollected || 0) === 0}
              className="w-full flex items-center justify-center gap-3 py-4 bg-primary-500 text-white rounded-[1.5rem] font-black text-sm shadow-xl shadow-primary-500/20 transition-all hover:bg-primary-600 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
             >
               {closeMutation.isPending ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
               Close Counter & Handover
             </button>

             {closePdfError ? (
                <div className="flex items-center gap-2 rounded-2xl border border-danger-100 bg-danger-50 p-3 text-[0.7rem] font-bold text-danger-700">
                  <AlertCircle size={14} />
                  {closePdfError}
                </div>
             ) : null}

             {latestCloseWithPdf ? (
               <button
                type="button"
                data-testid="finance-day-end-close-pdf-open"
                disabled={openingClosePdfId === latestCloseWithPdf.id}
                onClick={() => void openClosePdf(latestCloseWithPdf)}
                className="w-full flex items-center justify-center gap-2 py-3 text-[0.65rem] font-black text-slate-500 uppercase tracking-widest hover:text-slate-900 transition-colors disabled:cursor-wait disabled:opacity-60"
               >
                  {openingClosePdfId === latestCloseWithPdf.id ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
                  {openingClosePdfId === latestCloseWithPdf.id ? 'Opening Close PDF' : 'Open Close Report PDF'}
               </button>
             ) : null}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function CollectionStat({ label, value, sub, icon, color }: { label: string; value: string; sub: string; icon: React.ReactNode; color: 'emerald' | 'primary' | 'amber' }) {
  const colorMap = {
    emerald: "text-emerald-600 bg-emerald-50 border-emerald-100",
    primary: "text-primary-600 bg-primary-50 border-primary-100",
    amber: "text-amber-600 bg-amber-50 border-amber-100",
  };

  return (
    <div className={cn("p-6 rounded-[2.5rem] border bg-white shadow-sm flex items-center gap-5", colorMap[color])}>
       <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center shadow-inner", colorMap[color].split(' ')[1])}>
          {icon}
       </div>
       <div>
          <p className="text-[0.65rem] font-black uppercase tracking-widest opacity-60">{label}</p>
          <p className="text-2xl font-black tracking-tighter mt-0.5 text-slate-900">{value}</p>
          <p className="text-[0.65rem] font-bold text-slate-500 mt-0.5">{sub}</p>
       </div>
    </div>
  );
}
