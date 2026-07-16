'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/ui/section-card';
import { Loader2, Plus, Info, Check, AlertCircle } from 'lucide-react';
import type { FeeHeadSummary, FeePlanSummary } from '@schoolos/core';

export function FeeSetupTab() {
  const queryClient = useQueryClient();

  // Fee Head Form State
  const [feeHead, setFeeHead] = useState({
    code: '',
    name: '',
    frequency: 'MONTHLY',
    defaultAmount: 0,
    vatApplicable: false,
  });

  // Fee Plan Form State
  const [feePlan, setFeePlan] = useState({
    academicYearId: '',
    classId: '',
    feeHeadId: '',
    code: '',
    name: '',
    amount: 0,
  });

  // Notifications
  const [headSuccess, setHeadSuccess] = useState(false);
  const [planSuccess, setPlanSuccess] = useState(false);

  // Queries
  const academicYearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: api.listAcademicYears,
  });

  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: api.listClasses,
  });

  const feeHeadsQuery = useQuery({
    queryKey: ['fee-heads'],
    queryFn: api.listFeeHeads,
  });

  const feePlansQuery = useQuery({
    queryKey: ['fee-plans'],
    queryFn: api.listFeePlans,
  });

  // Mutations
  const feeHeadMutation = useMutation({
    mutationFn: api.createFeeHead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-heads'] });
      setFeeHead({
        code: '',
        name: '',
        frequency: 'MONTHLY',
        defaultAmount: 0,
        vatApplicable: false,
      });
      setHeadSuccess(true);
      setTimeout(() => setHeadSuccess(false), 3000);
    },
  });

  const feePlanMutation = useMutation({
    mutationFn: api.createFeePlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-plans'] });
      setFeePlan({
        academicYearId: academicYearsQuery.data?.find(y => y.isCurrent)?.id || '',
        classId: '',
        feeHeadId: '',
        code: '',
        name: '',
        amount: 0,
      });
      setPlanSuccess(true);
      setTimeout(() => setPlanSuccess(false), 3000);
    },
  });

  const handleCreateFeeHead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feeHead.code || !feeHead.name) return;
    feeHeadMutation.mutate(feeHead);
  };

  const handleCreateFeePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feePlan.academicYearId || !feePlan.feeHeadId || !feePlan.code || !feePlan.name) return;
    feePlanMutation.mutate({
      academicYearId: feePlan.academicYearId,
      classId: feePlan.classId || null,
      code: feePlan.code,
      name: feePlan.name,
      items: [{ feeHeadId: feePlan.feeHeadId, amount: feePlan.amount }],
    });
  };

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
        {/* Fee Head Form */}
        <SectionCard
          title="Create Fee Head"
          description="Define reusable heads of account like Tuition, Library, Exam, or Transportation fees."
        >
          <form onSubmit={handleCreateFeeHead} className="space-y-4">
            {headSuccess && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-700">
                <Check size={14} />
                Fee head created.
              </div>
            )}
            {feeHeadMutation.isError && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700">
                <AlertCircle size={14} />
                {feeHeadMutation.error.message || 'Failed to create fee head.'}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Code</label>
                <input
                  type="text"
                  placeholder="e.g. TUITION"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-[var(--color-mod-fees-accent)] focus:outline-none"
                  value={feeHead.code}
                  onChange={(e) => setFeeHead((prev) => ({ ...prev, code: e.target.value }))}
                  required
                  disabled={feeHeadMutation.isPending}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Name</label>
                <input
                  type="text"
                  placeholder="e.g. Tuition Fee"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-[var(--color-mod-fees-accent)] focus:outline-none"
                  value={feeHead.name}
                  onChange={(e) => setFeeHead((prev) => ({ ...prev, name: e.target.value }))}
                  required
                  disabled={feeHeadMutation.isPending}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Frequency</label>
                <select
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-[var(--color-mod-fees-accent)] focus:outline-none bg-white"
                  value={feeHead.frequency}
                  onChange={(e) => setFeeHead((prev) => ({ ...prev, frequency: e.target.value }))}
                  disabled={feeHeadMutation.isPending}
                >
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="YEARLY">Yearly</option>
                  <option value="ONE_TIME">One Time</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Default Amount</label>
                <input
                  type="number"
                  placeholder="0"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-[var(--color-mod-fees-accent)] focus:outline-none"
                  value={feeHead.defaultAmount || ''}
                  onChange={(e) => setFeeHead((prev) => ({ ...prev, defaultAmount: Number(e.target.value) }))}
                  disabled={feeHeadMutation.isPending}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 py-1">
              <input
                type="checkbox"
                id="vatApplicable"
                className="h-4 w-4 rounded border-slate-300 text-[var(--color-mod-fees-accent)] focus:ring-[var(--color-mod-fees-accent)]"
                checked={feeHead.vatApplicable}
                onChange={(e) => setFeeHead((prev) => ({ ...prev, vatApplicable: e.target.checked }))}
                disabled={feeHeadMutation.isPending}
              />
              <label htmlFor="vatApplicable" className="text-xs font-bold text-slate-700 select-none">
                VAT / Taxes Applicable
              </label>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--color-mod-fees-accent)] px-5 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-[var(--color-mod-fees-text)] disabled:opacity-50 transition-all"
              disabled={feeHeadMutation.isPending}
            >
              {feeHeadMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Create Fee Head
                </>
              )}
            </button>
          </form>
        </SectionCard>

        {/* Fee Plan Form */}
        <SectionCard
          title="Create Fee Plan"
          description="Map fee heads to specific academic years and classes with custom rates."
        >
          <form onSubmit={handleCreateFeePlan} className="space-y-4">
            {planSuccess && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-700">
                <Check size={14} />
                Fee plan created.
              </div>
            )}
            {feePlanMutation.isError && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700">
                <AlertCircle size={14} />
                {feePlanMutation.error.message || 'Failed to create fee plan.'}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Academic Year</label>
                <select
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-[var(--color-mod-fees-accent)] focus:outline-none bg-white"
                  value={feePlan.academicYearId}
                  onChange={(e) => setFeePlan((prev) => ({ ...prev, academicYearId: e.target.value }))}
                  required
                  disabled={feePlanMutation.isPending}
                >
                  <option value="">Select Academic Year</option>
                  {academicYearsQuery.data?.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name} {y.isCurrent ? '(Current)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Class (Optional)</label>
                <select
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-[var(--color-mod-fees-accent)] focus:outline-none bg-white"
                  value={feePlan.classId}
                  onChange={(e) => setFeePlan((prev) => ({ ...prev, classId: e.target.value }))}
                  disabled={feePlanMutation.isPending}
                >
                  <option value="">All Classes</option>
                  {classesQuery.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Fee Head</label>
                <select
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-[var(--color-mod-fees-accent)] focus:outline-none bg-white"
                  value={feePlan.feeHeadId}
                  onChange={(e) => setFeePlan((prev) => ({ ...prev, feeHeadId: e.target.value }))}
                  required
                  disabled={feePlanMutation.isPending}
                >
                  <option value="">Select Fee Head</option>
                  {feeHeadsQuery.data?.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.code} · {h.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Plan Code</label>
                <input
                  type="text"
                  placeholder="e.g. PLAN-TUITION-GR1"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-[var(--color-mod-fees-accent)] focus:outline-none"
                  value={feePlan.code}
                  onChange={(e) => setFeePlan((prev) => ({ ...prev, code: e.target.value }))}
                  required
                  disabled={feePlanMutation.isPending}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Plan Name</label>
                <input
                  type="text"
                  placeholder="e.g. Grade 1 Monthly Tuition Plan"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-[var(--color-mod-fees-accent)] focus:outline-none"
                  value={feePlan.name}
                  onChange={(e) => setFeePlan((prev) => ({ ...prev, name: e.target.value }))}
                  required
                  disabled={feePlanMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Amount</label>
                <input
                  type="number"
                  placeholder="0"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-[var(--color-mod-fees-accent)] focus:outline-none"
                  value={feePlan.amount || ''}
                  onChange={(e) => setFeePlan((prev) => ({ ...prev, amount: Number(e.target.value) }))}
                  required
                  disabled={feePlanMutation.isPending}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--color-mod-fees-accent)] px-5 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-[var(--color-mod-fees-text)] disabled:opacity-50 transition-all"
              disabled={feePlanMutation.isPending}
            >
              {feePlanMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Create Fee Plan
                </>
              )}
            </button>
          </form>
        </SectionCard>
      </div>

      {/* Listing Overview */}
      <div className="space-y-8">
        {/* Fee Heads List */}
        <SectionCard title="Active Fee Heads">
          {feeHeadsQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : !feeHeadsQuery.data?.length ? (
            <div className="py-8 text-center text-slate-400 text-sm font-medium">
              No fee heads configured. Use the form to add one.
            </div>
          ) : (
            <div className="overflow-hidden border border-slate-100 rounded-2xl bg-slate-50">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100/50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Frequency</th>
                      <th className="px-4 py-3 text-right">Default Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {feeHeadsQuery.data.map((head: any) => (
                      <tr key={head.id} className="hover:bg-slate-100/35 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-700">{head.code}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{head.name}</td>
                        <td className="px-4 py-3">
                          <Badge variant="neutral" className="uppercase tracking-widest text-[9px] font-black px-2 py-0.5">
                            {head.frequency}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-700">
                          {formatCurrency(head.defaultAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </SectionCard>

        {/* Fee Plans List */}
        <SectionCard title="Active Fee Plans">
          {feePlansQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : !feePlansQuery.data?.length ? (
            <div className="py-8 text-center text-slate-400 text-sm font-medium">
              No fee plans created yet. Setup a plan above.
            </div>
          ) : (
            <div className="overflow-hidden border border-slate-100 rounded-2xl bg-slate-50">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100/50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                      <th className="px-4 py-3">Plan Details</th>
                      <th className="px-4 py-3">Applicability</th>
                      <th className="px-4 py-3 text-right">Plan Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {feePlansQuery.data.map((plan: any) => (
                      <tr key={plan.id} className="hover:bg-slate-100/35 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-700">{plan.code}</span>
                            <span className="text-[10px] text-slate-400 font-semibold">{plan.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1 items-center">
                            <Badge variant="phase2" className="text-[9px] font-black px-1.5 py-0">
                              {plan.academicYear?.name || 'Current Year'}
                            </Badge>
                            {plan.class && (
                              <Badge className="bg-indigo-50 text-indigo-700 border-indigo-100 text-[9px] font-black px-1.5 py-0">
                                Class {plan.class.name}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-700">
                          {formatCurrency(plan.amount ?? plan.items?.[0]?.amount ?? 0)}
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
