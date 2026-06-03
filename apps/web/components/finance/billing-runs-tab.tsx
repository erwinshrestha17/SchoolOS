'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/ui/section-card';
import { Loader2, Plus, Calendar, AlertTriangle, Check, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function BillingRunsTab() {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  // Form State
  const [academicYearId, setAcademicYearId] = useState('');
  const [feePlanId, setFeePlanId] = useState('');
  const [runMonth, setRunMonth] = useState(new Date().getMonth() + 1);
  const [runYear, setRunYear] = useState(new Date().getFullYear());
  const [dueDate, setDueDate] = useState(today);

  // Confirmation Modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);

  // Queries
  const academicYearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: api.listAcademicYears,
  });

  const feePlansQuery = useQuery({
    queryKey: ['fee-plans'],
    queryFn: api.listFeePlans,
  });

  const billingRunsQuery = useQuery({
    queryKey: ['billing-runs'],
    queryFn: api.listBillingRuns,
  });

  // Mutation
  const billingRunMutation = useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-runs'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setConfirmOpen(false);
      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 4000);
    },
    mutationFn: (body: any) => api.generateBillingRun(body),
  });

  const handleTriggerRun = (e: React.FormEvent) => {
    e.preventDefault();
    if (!academicYearId) return;
    setConfirmOpen(true);
  };

  const confirmBillingRun = () => {
    billingRunMutation.mutate({
      academicYearId,
      feePlanId: feePlanId || null,
      runMonth,
      runYear,
      dueDate: new Date(dueDate).toISOString(),
    });
  };

  const selectedYearName = academicYearsQuery.data?.find(y => y.id === academicYearId)?.name || '';
  const selectedPlanName = feePlanId ? feePlansQuery.data?.find(p => p.id === feePlanId)?.name || 'Selected Plan' : 'All Active Fee Plans';

  const getMonthName = (monthNum: number) => {
    return new Date(2026, monthNum - 1, 1).toLocaleString('en-US', { month: 'long' });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Run Invoice Form */}
      <div className="space-y-8">
        <SectionCard
          title="Run Monthly Invoices"
          description="Trigger bulk student invoice generation from configured fee plans."
        >
          <form onSubmit={handleTriggerRun} className="space-y-4">
            {successMsg && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-700">
                <Check size={14} />
                Billing run started successfully! Invoices are generating.
              </div>
            )}
            {billingRunMutation.isError && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700">
                <AlertCircle size={14} />
                {billingRunMutation.error.message || 'Failed to start billing run.'}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Academic Year</label>
                <select
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none bg-white"
                  value={academicYearId}
                  onChange={(e) => setAcademicYearId(e.target.value)}
                  required
                  disabled={billingRunMutation.isPending}
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
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Fee Plan Scope</label>
                <select
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none bg-white"
                  value={feePlanId}
                  onChange={(e) => setFeePlanId(e.target.value)}
                  disabled={billingRunMutation.isPending}
                >
                  <option value="">All Active Plans (Recommended)</option>
                  {feePlansQuery.data?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} · {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Billing Month</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none"
                  value={runMonth}
                  onChange={(e) => setRunMonth(Number(e.target.value))}
                  required
                  disabled={billingRunMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Billing Year</label>
                <input
                  type="number"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none"
                  value={runYear}
                  onChange={(e) => setRunYear(Number(e.target.value))}
                  required
                  disabled={billingRunMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Due Date</label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                  disabled={billingRunMutation.isPending}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-slate-800 disabled:opacity-50 transition-all shadow-lg"
              disabled={billingRunMutation.isPending || !academicYearId}
            >
              {billingRunMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Generating Invoices...
                </>
              ) : (
                <>
                  <Calendar className="h-3.5 w-3.5" />
                  Trigger Billing Run
                </>
              )}
            </button>
          </form>
        </SectionCard>
      </div>

      {/* Billing Runs History */}
      <div className="space-y-8">
        <SectionCard title="Recent Billing Run Logs">
          {billingRunsQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : !billingRunsQuery.data?.length ? (
            <div className="py-8 text-center text-slate-400 text-sm font-medium">
              No historical billing runs found.
            </div>
          ) : (
            <div className="overflow-hidden border border-slate-100 rounded-2xl bg-slate-50">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100/50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                      <th className="px-4 py-3">Billing Target</th>
                      <th className="px-4 py-3">Run Details</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Invoices Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {billingRunsQuery.data.map((run: any) => (
                      <tr key={run.id} className="hover:bg-slate-100/35 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900">{getMonthName(run.runMonth)} {run.runYear}</span>
                            <span className="text-[10px] text-slate-400 font-medium">Due: {new Date(run.dueDate).toLocaleDateString()}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <Badge variant="neutral" className="w-fit text-[9px] font-black px-1.5 py-0">
                              {run.academicYear?.name || 'Year'}
                            </Badge>
                            {run.feePlan && (
                              <span className="text-[10px] text-slate-500 font-semibold">Plan: {run.feePlan.code}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={run.status === 'COMPLETED' ? 'success' : run.status === 'RUNNING' ? 'phase2' : 'destructive'}
                            className="text-[9px] font-black px-1.5 py-0"
                          >
                            {run.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-black text-slate-700">
                          {run.invoicesCreatedCount ?? run.invoiceCount ?? 0}
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

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <AlertTriangle className="text-amber-500" size={24} />
              Confirm Billing Run
            </DialogTitle>
            <DialogDescription className="text-sm font-medium text-slate-500">
              You are about to generate mass invoices for all enrolled students matching the configuration below.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 space-y-2 text-xs font-bold text-amber-800">
            <p>• Academic Year: <span className="text-slate-900 font-black">{selectedYearName}</span></p>
            <p>• Plan Filter: <span className="text-slate-900 font-black">{selectedPlanName}</span></p>
            <p>• Month / Year: <span className="text-slate-900 font-black">{getMonthName(runMonth)} {runYear}</span></p>
            <p>• Invoices Due: <span className="text-slate-900 font-black">{new Date(dueDate).toLocaleDateString()}</span></p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              onClick={() => setConfirmOpen(false)}
              disabled={billingRunMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2"
              onClick={confirmBillingRun}
              disabled={billingRunMutation.isPending}
            >
              {billingRunMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Invoices'
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
