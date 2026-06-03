'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/ui/section-card';
import { Loader2, Plus, Check, AlertCircle } from 'lucide-react';
import type { DiscountRule, WaiverRecord, InvoiceSummary } from '@schoolos/core';

export function DiscountsWaiversTab() {
  const queryClient = useQueryClient();

  // Form State
  const [discount, setDiscount] = useState({
    name: '',
    reason: '',
    type: 'SIBLING',
    feeHeadId: '',
    classId: '',
    feePlanId: '',
    percentOff: 0,
    amountOff: 0,
  });

  const [waiver, setWaiver] = useState({
    invoiceId: '',
    feeHeadId: '',
    amount: 0,
    reason: '',
  });

  // Success States
  const [discountSuccess, setDiscountSuccess] = useState(false);
  const [waiverSuccess, setWaiverSuccess] = useState(false);

  // Queries
  const feeHeadsQuery = useQuery({
    queryKey: ['fee-heads'],
    queryFn: api.listFeeHeads,
  });

  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: api.listClasses,
  });

  const feePlansQuery = useQuery({
    queryKey: ['fee-plans'],
    queryFn: api.listFeePlans,
  });

  const invoicesQuery = useQuery({
    queryKey: ['invoices'],
    queryFn: api.listInvoices,
  });

  const discountsQuery = useQuery({
    queryKey: ['discounts'],
    queryFn: api.listDiscounts,
  });

  const waiversQuery = useQuery({
    queryKey: ['waivers'],
    queryFn: api.listWaivers,
  });

  // Mutations
  const discountMutation = useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
      setDiscount({
        name: '',
        reason: '',
        type: 'SIBLING',
        feeHeadId: '',
        classId: '',
        feePlanId: '',
        percentOff: 0,
        amountOff: 0,
      });
      setDiscountSuccess(true);
      setTimeout(() => setDiscountSuccess(false), 3000);
    },
    mutationFn: (body: any) => api.createDiscount(body),
  });

  const waiverMutation = useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waivers'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setWaiver({
        invoiceId: '',
        feeHeadId: '',
        amount: 0,
        reason: '',
      });
      setWaiverSuccess(true);
      setTimeout(() => setWaiverSuccess(false), 3000);
    },
    mutationFn: (body: any) => api.createWaiver(body),
  });

  const handleCreateDiscount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!discount.name || !discount.reason) return;
    discountMutation.mutate({
      name: discount.name,
      reason: discount.reason,
      type: discount.type,
      feeHeadId: discount.feeHeadId || null,
      classId: discount.classId || null,
      feePlanId: discount.feePlanId || null,
      percentOff: discount.percentOff > 0 ? discount.percentOff : null,
      amountOff: discount.amountOff > 0 ? discount.amountOff : null,
    });
  };

  const handleCreateWaiver = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedInvoice = invoicesQuery.data?.find((inv) => inv.id === waiver.invoiceId);
    if (!selectedInvoice || waiver.amount <= 0 || !waiver.reason) return;

    waiverMutation.mutate({
      studentId: selectedInvoice.student?.id || '',
      invoiceId: waiver.invoiceId || null,
      feeHeadId: waiver.feeHeadId || null,
      amount: waiver.amount,
      reason: waiver.reason,
    });
  };

  const selectedInvoiceObj = invoicesQuery.data?.find((inv) => inv.id === waiver.invoiceId);
  const selectedWaiverOutstanding = selectedInvoiceObj
    ? Math.max(0, (selectedInvoiceObj.totalAmount ?? 0) - (selectedInvoiceObj.paidAmount ?? 0))
    : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NP', {
      style: 'currency',
      currency: 'NPR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Creation Forms */}
      <div className="space-y-8">
        {/* Discount Rule Form */}
        <SectionCard
          title="Create Discount Rule"
          description="Setup automatic discounts (e.g. Sibling or Scholarship rules) to be applied on billing runs."
        >
          <form onSubmit={handleCreateDiscount} className="space-y-4">
            {discountSuccess && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-700">
                <Check size={14} />
                Discount rule created successfully!
              </div>
            )}
            {discountMutation.isError && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700">
                <AlertCircle size={14} />
                {discountMutation.error.message || 'Failed to create discount rule.'}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Rule Name</label>
                <input
                  type="text"
                  placeholder="e.g. Sibling Discount 10%"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none"
                  value={discount.name}
                  onChange={(e) => setDiscount((prev) => ({ ...prev, name: e.target.value }))}
                  required
                  disabled={discountMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Reason / Policy</label>
                <input
                  type="text"
                  placeholder="e.g. Approved board waiver policy"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none"
                  value={discount.reason}
                  onChange={(e) => setDiscount((prev) => ({ ...prev, reason: e.target.value }))}
                  required
                  disabled={discountMutation.isPending}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Type</label>
                <select
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none bg-white"
                  value={discount.type}
                  onChange={(e) => setDiscount((prev) => ({ ...prev, type: e.target.value }))}
                  disabled={discountMutation.isPending}
                >
                  <option value="SIBLING">Sibling</option>
                  <option value="SCHOLARSHIP">Scholarship</option>
                  <option value="STAFF_CHILD">Staff Child</option>
                  <option value="MANUAL">Manual</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Applicable Plan</label>
                <select
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none bg-white"
                  value={discount.feePlanId}
                  onChange={(e) => setDiscount((prev) => ({ ...prev, feePlanId: e.target.value }))}
                  disabled={discountMutation.isPending}
                >
                  <option value="">Any Plan</option>
                  {feePlansQuery.data?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} · {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Class (Optional)</label>
                <select
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none bg-white"
                  value={discount.classId}
                  onChange={(e) => setDiscount((prev) => ({ ...prev, classId: e.target.value }))}
                  disabled={discountMutation.isPending}
                >
                  <option value="">Any Class</option>
                  {classesQuery.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Fee Head (Optional)</label>
                <select
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none bg-white"
                  value={discount.feeHeadId}
                  onChange={(e) => setDiscount((prev) => ({ ...prev, feeHeadId: e.target.value }))}
                  disabled={discountMutation.isPending}
                >
                  <option value="">Any Fee Head</option>
                  {feeHeadsQuery.data?.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.code} · {h.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Percent Off (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none"
                  value={discount.percentOff || ''}
                  onChange={(e) => setDiscount((prev) => ({ ...prev, percentOff: Number(e.target.value) }))}
                  disabled={discountMutation.isPending || discount.amountOff > 0}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Amount Off (NPR)</label>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none"
                  value={discount.amountOff || ''}
                  onChange={(e) => setDiscount((prev) => ({ ...prev, amountOff: Number(e.target.value) }))}
                  disabled={discountMutation.isPending || discount.percentOff > 0}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-slate-800 disabled:opacity-50 transition-all"
              disabled={discountMutation.isPending || (!discount.feeHeadId && !discount.classId && !discount.feePlanId)}
            >
              {discountMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Create Discount Rule
                </>
              )}
            </button>
            {!discount.feeHeadId && !discount.classId && !discount.feePlanId && (
              <p className="text-[10px] font-bold text-rose-500 uppercase text-center mt-1">
                * Select at least one Fee Head, Class, or Plan to save.
              </p>
            )}
          </form>
        </SectionCard>

        {/* Waiver Form */}
        <SectionCard
          title="Issue Fee Waiver"
          description="Grant a manual or specific fee waiver to an outstanding invoice."
        >
          <form onSubmit={handleCreateWaiver} className="space-y-4">
            {waiverSuccess && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-700">
                <Check size={14} />
                Waiver applied successfully!
              </div>
            )}
            {waiverMutation.isError && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700">
                <AlertCircle size={14} />
                {waiverMutation.error.message || 'Failed to apply waiver.'}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Select Invoice</label>
              <select
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none bg-white"
                value={waiver.invoiceId}
                onChange={(e) => {
                  const val = e.target.value;
                  const inv = invoicesQuery.data?.find((i) => i.id === val);
                  const rem = inv ? Math.max(0, (inv.totalAmount ?? 0) - (inv.paidAmount ?? 0)) : 0;
                  setWaiver((prev) => ({
                    ...prev,
                    invoiceId: val,
                    amount: Math.min(prev.amount || 500, rem),
                  }));
                }}
                required
                disabled={waiverMutation.isPending}
              >
                <option value="">Select Invoice</option>
                {invoicesQuery.data
                  ?.filter((inv) => (inv.totalAmount ?? 0) - (inv.paidAmount ?? 0) > 0)
                  ?.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} · {inv.student?.name ?? 'Student'} (Due: {formatCurrency(inv.totalAmount - (inv.paidAmount ?? 0))})
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Fee Head Scope</label>
                <select
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none bg-white"
                  value={waiver.feeHeadId}
                  onChange={(e) => setWaiver((prev) => ({ ...prev, feeHeadId: e.target.value }))}
                  disabled={waiverMutation.isPending}
                >
                  <option value="">Whole Invoice</option>
                  {feeHeadsQuery.data?.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.code} · {h.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Waiver Amount (NPR)</label>
                <input
                  type="number"
                  min={1}
                  max={selectedWaiverOutstanding || undefined}
                  placeholder="Waiver Amount"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none"
                  value={waiver.amount || ''}
                  onChange={(e) => setWaiver((prev) => ({ ...prev, amount: Number(e.target.value) }))}
                  required
                  disabled={waiverMutation.isPending}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Waiver Reason</label>
              <textarea
                rows={3}
                placeholder="Detail approval reasons for audits..."
                className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none"
                value={waiver.reason}
                onChange={(e) => setWaiver((prev) => ({ ...prev, reason: e.target.value }))}
                required
                disabled={waiverMutation.isPending}
              />
            </div>

            {selectedInvoiceObj && (
              <p className="text-xs font-bold text-slate-400">
                Outstanding Balance on Invoice: <span className="text-slate-800">{formatCurrency(selectedWaiverOutstanding)}</span>
              </p>
            )}

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-slate-800 disabled:opacity-50 transition-all"
              disabled={waiverMutation.isPending || waiver.amount <= 0 || !waiver.reason || !waiver.invoiceId}
            >
              {waiverMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Approve Waiver
                </>
              )}
            </button>
          </form>
        </SectionCard>
      </div>

      {/* Lists Overview */}
      <div className="space-y-8">
        {/* Discounts List */}
        <SectionCard title="Active Discount Rules">
          {discountsQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : !discountsQuery.data?.length ? (
            <div className="py-8 text-center text-slate-400 text-sm font-medium">
              No discount rules created yet.
            </div>
          ) : (
            <div className="overflow-hidden border border-slate-100 rounded-2xl bg-slate-50">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100/50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                      <th className="px-4 py-3">Rule</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Discount Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {discountsQuery.data.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-100/35 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900">{item.name}</span>
                            <span className="text-[9px] text-slate-400 uppercase tracking-widest font-black mt-0.5">{item.type}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={item.isActive ? 'success' : 'neutral'} className="text-[9px] px-1.5 py-0">
                            {item.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800">
                          {item.percentOff ? `${item.percentOff}% Off` : formatCurrency(item.amountOff ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </SectionCard>

        {/* Waivers List */}
        <SectionCard title="Recent Approved Waivers">
          {waiversQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : !waiversQuery.data?.length ? (
            <div className="py-8 text-center text-slate-400 text-sm font-medium">
              No fee waivers registered.
            </div>
          ) : (
            <div className="overflow-hidden border border-slate-100 rounded-2xl bg-slate-50">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100/50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                      <th className="px-4 py-3">Invoice / Student</th>
                      <th className="px-4 py-3">Reason</th>
                      <th className="px-4 py-3 text-right">Waiver Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {waiversQuery.data.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-100/35 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-700">
                              {item.invoiceId ? `Inv #${item.invoiceId.slice(0, 8)}` : 'Whole Invoice'}
                            </span>
                            <span className="text-[10px] text-slate-500 font-semibold">
                              {item.studentId ? `ID: ${item.studentId.slice(0, 8)}` : 'Student'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-medium">{item.reason}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">
                          -{formatCurrency(item.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
