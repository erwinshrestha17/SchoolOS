'use client';

import type { PlatformPlanSummary, PlatformTenantDetail } from '@schoolos/core';
import type { AssignPlatformTenantSubscriptionPayload } from '@/lib/api';
import { ArrowLeft, CheckCircle2, CreditCard, RefreshCw, ShieldAlert } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'GRACE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED';

export default function PlatformChangePlanPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const router = useRouter();

  const [tenant, setTenant] = useState<PlatformTenantDetail | null>(null);
  const [plans, setPlans] = useState<PlatformPlanSummary[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [status, setStatus] = useState<SubscriptionStatus>('ACTIVE');
  const [startsAt, setStartsAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [renewsAt, setRenewsAt] = useState(() => addYears(new Date(), 1).toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [tenantResult, planResult] = await Promise.all([
        api.getPlatformTenantDetail(tenantId),
        api.listPlatformPlans(),
      ]);
      const activePlans = planResult.filter((plan) => plan.status !== 'ARCHIVED');

      setTenant(tenantResult);
      setPlans(activePlans);
      setSelectedPlanId((current) => current || tenantResult.subscription?.planId || activePlans[0]?.id || '');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (tenantId) {
      void load();
    }
  }, [load, tenantId]);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId),
    [plans, selectedPlanId],
  );

  const canSubmit = Boolean(selectedPlan) && reason.trim().length >= 5 && !saving;

  const submit = async () => {
    if (!tenant || !selectedPlan || !canSubmit) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const currentPlanName = tenant.subscription?.planName ?? 'No plan';
    const notes = [
      `Plan changed from ${currentPlanName} to ${selectedPlan.name}.`,
      `Reason: ${reason.trim()}`,
    ].join(' ');

    const payload: AssignPlatformTenantSubscriptionPayload = {
      planId: selectedPlanId,
      status,
      startsAt: dateInputToIso(startsAt),
      renewsAt: dateInputToIso(renewsAt),
      notes,
    };

    try {
      await api.assignPlatformTenantSubscription(tenant.id, compactPayload(payload));
      setSuccess(`Subscription changed to ${selectedPlan.name}. Tenant detail has been reloaded.`);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4 text-slate-500">
        <RefreshCw className="h-10 w-10 animate-spin text-slate-300" />
        <p className="text-sm font-semibold">Loading subscription plans...</p>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-rose-100 bg-rose-50 p-8 text-rose-800">
        <div className="flex items-center gap-3 font-bold">
          <ShieldAlert size={20} />
          School unavailable
        </div>
        <p className="mt-2 text-sm">{error ?? 'The school could not be loaded.'}</p>
        <Button className="mt-6" variant="outline" onClick={() => router.push('/platform/schools')}>
          Back to schools
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <button
        type="button"
        className="flex items-center gap-2 text-sm font-bold text-slate-400 transition-colors hover:text-slate-900"
        onClick={() => router.push(`/platform/schools/${tenant.id}`)}
      >
        <ArrowLeft size={16} />
        Back to school detail
      </button>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="neutral" className="bg-indigo-50 text-indigo-700">
            SaaS Billing
          </Badge>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-900">Change Subscription Plan</h1>
          <p className="mt-2 max-w-2xl text-slate-500">
            Update the SchoolOS subscription for {tenant.name}. This is platform SaaS billing only and does not affect school fee collection.
          </p>
        </div>
        <Card className="min-w-[260px] rounded-3xl border-slate-100 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Current plan</p>
            <p className="mt-1 text-xl font-black text-slate-900">{tenant.subscription?.planName ?? 'No plan'}</p>
            <p className="mt-1 text-sm font-semibold uppercase text-slate-500">{tenant.subscription?.status ?? 'UNASSIGNED'}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="font-black uppercase tracking-widest text-slate-400">Effective</dt>
                <dd className="mt-1 font-bold text-slate-700">{formatDate(tenant.subscription?.startsAt)}</dd>
              </div>
              <div>
                <dt className="font-black uppercase tracking-widest text-slate-400">Renewal</dt>
                <dd className="mt-1 font-bold text-slate-700">{formatDate(tenant.subscription?.renewsAt)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </header>

      {error && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          <CheckCircle2 size={18} />
          {success}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1.4fr_0.9fr]">
        <Card className="rounded-3xl border-slate-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-black">
              <CreditCard className="text-slate-400" size={22} />
              New subscription
            </CardTitle>
            <CardDescription>Choose the new plan and effective subscription dates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="font-bold text-slate-700">Plan</Label>
              <select
                aria-label="New subscription plan"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 outline-none focus:border-slate-900"
                value={selectedPlanId}
                onChange={(event) => setSelectedPlanId(event.target.value)}
              >
                <option value="">Select a plan</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} · NPR {Number(plan.priceNpr ?? 0).toLocaleString()} / {plan.billingCycle?.toLowerCase?.() ?? 'billing cycle'}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label className="font-bold text-slate-700">Status</Label>
                <select
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 outline-none focus:border-slate-900"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as SubscriptionStatus)}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="TRIAL">Trial</option>
                  <option value="GRACE">Grace</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="EXPIRED">Expired</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-slate-700">Starts at</Label>
                <input
                  type="date"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 outline-none focus:border-slate-900"
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-slate-700">Renews at</Label>
                <input
                  type="date"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 outline-none focus:border-slate-900"
                  value={renewsAt}
                  onChange={(event) => setRenewsAt(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-bold text-slate-700">Audit reason</Label>
              <Textarea
                className="min-h-28 rounded-2xl border-slate-200"
                placeholder="Example: School upgraded to Premium after pilot approval."
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
              <p className="text-xs text-slate-400">At least 5 characters. The reason is saved in subscription notes and audit context.</p>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
              This changes SchoolOS subscription billing only. It does not create student fee invoices, post to school M3 Fees, or post to tenant M11 Accounting.
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button variant="outline" className="rounded-xl font-bold" onClick={() => router.push(`/platform/schools/${tenant.id}`)}>
                Cancel
              </Button>
              <Button className="rounded-xl bg-[var(--color-mod-platform-accent)] font-bold text-white hover:bg-[var(--color-mod-platform-text)]" disabled={!canSubmit} onClick={() => void submit()}>
                {saving ? <RefreshCw size={16} className="mr-2 animate-spin" /> : null}
                Change Plan
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-slate-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-black">Selected plan preview</CardTitle>
            <CardDescription>Plan features and usage limits come from platform settings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {selectedPlan ? (
              <>
                <div className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Current</p>
                    <p className="mt-1 font-black text-slate-900">{tenant.subscription?.planName ?? 'No plan'}</p>
                    <p className="mt-1 font-semibold uppercase text-slate-500">{tenant.subscription?.status ?? 'UNASSIGNED'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">New</p>
                    <p className="mt-1 font-black text-slate-900">{selectedPlan.name}</p>
                    <p className="mt-1 font-semibold uppercase text-slate-500">{status}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Plan</p>
                  <p className="mt-1 text-2xl font-black text-slate-900">{selectedPlan.name}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    NPR {Number(selectedPlan.priceNpr ?? 0).toLocaleString()} / {selectedPlan.billingCycle?.toLowerCase?.() ?? 'cycle'}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Enabled features</p>
                  <div className="flex flex-wrap gap-2">
                    {(selectedPlan.features ?? [])
                      .filter((feature) => feature.enabled)
                      .slice(0, 10)
                      .map((feature) => (
                        <Badge key={feature.featureKey} variant="neutral" className="bg-slate-100 text-slate-700">
                          {feature.featureKey}
                        </Badge>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Effective date</p>
                    <p className="mt-1 font-bold text-slate-900">{formatDate(dateInputToIso(startsAt))}</p>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Renewal date</p>
                    <p className="mt-1 font-bold text-slate-900">{formatDate(dateInputToIso(renewsAt))}</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm font-semibold text-slate-400">
                {plans.length === 0 ? 'No active platform plans are available.' : 'Select a plan to preview details.'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function dateInputToIso(value: string) {
  if (!value) {
    return undefined;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function compactPayload(
  payload: AssignPlatformTenantSubscriptionPayload,
): AssignPlatformTenantSubscriptionPayload {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== ''),
  ) as AssignPlatformTenantSubscriptionPayload;
}

function addYears(date: Date, years: number) {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong';
}

function formatDate(dateString: string | null | undefined) {
  if (!dateString) {
    return 'Not set';
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return 'Not set';
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
