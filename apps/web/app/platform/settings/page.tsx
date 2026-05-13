'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, KeyRound, RefreshCw, Server, ShieldCheck } from 'lucide-react';
import { ApiRequestError, api } from '../../../lib/api';
import type {
  PlatformHealthSummary,
  PlatformPlanSummary,
  PlatformProviderConfigSummary,
  PlatformQueueSummary,
} from '@schoolos/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

function isRejected(result: PromiseSettledResult<unknown>): result is PromiseRejectedResult {
  return result.status === 'rejected';
}

export default function PlatformSettings() {
  const [providers, setProviders] = useState<PlatformProviderConfigSummary[]>([]);
  const [queues, setQueues] = useState<PlatformQueueSummary[]>([]);
  const [health, setHealth] = useState<PlatformHealthSummary | null>(null);
  const [plans, setPlans] = useState<PlatformPlanSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [providerForm, setProviderForm] = useState({
    type: 'SMS',
    name: 'sparrow',
    environment: 'TEST',
    enabled: false,
    config: '{"apiToken":"replace-me","senderId":"SchoolOS"}',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [providerResult, queueResult, healthResult, planResult] =
      await Promise.allSettled([
        api.listPlatformProviders(),
        api.getPlatformQueueHealth(),
        api.getPlatformHealth(),
        api.listPlatformPlans(),
      ]);

    const settledResults: PromiseSettledResult<unknown>[] = [
      providerResult,
      queueResult,
      healthResult,
      planResult,
    ];
    const failures = settledResults.filter(isRejected);

    if (providerResult.status === 'fulfilled') {
      setProviders(providerResult.value);
    }

    if (queueResult.status === 'fulfilled') {
      setQueues(queueResult.value);
    }

    if (healthResult.status === 'fulfilled') {
      setHealth(healthResult.value);
    }

    if (planResult.status === 'fulfilled') {
      setPlans(planResult.value);
    }

    if (failures.length > 0) {
      const firstReason = failures[0].reason;
      const requestId =
        firstReason instanceof ApiRequestError ? firstReason.requestId : null;
      const suffix = requestId ? ` Request ID: ${requestId}` : '';

      setError(
        `${failures.length} platform settings panel${
          failures.length === 1 ? '' : 's'
        } could not load.${suffix}`,
      );
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveProvider = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.upsertPlatformProvider({
        ...providerForm,
        config: JSON.parse(providerForm.config),
      });
      await load();
    } catch (err: any) {
      setError(err.message ?? 'Failed to save provider');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="border-b border-slate-200 pb-6">
        <Badge variant="neutral" className="mb-3">Production Foundation</Badge>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">Platform Settings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Provider configuration, queue visibility, SaaS plans, and production health remain isolated from school settings.
        </p>
      </header>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
      {loading && <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-500">Loading platform health...</div>}

      <section className="grid gap-4 lg:grid-cols-4">
        {Object.entries(health?.checks ?? {}).map(([key, check]) => (
          <div key={key} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold capitalize text-slate-900">{key}</p>
              {check.status === 'ok' ? <CheckCircle2 className="text-emerald-600" size={18} /> : <AlertTriangle className="text-rose-600" size={18} />}
            </div>
            <p className="mt-2 text-xs text-slate-500">{check.message ?? check.status}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <KeyRound size={18} className="text-slate-500" />
            <h2 className="text-lg font-bold text-slate-950">Provider Configuration</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Select value={providerForm.type} onChange={(e) => setProviderForm((form) => ({ ...form, type: e.target.value }))}>
              <option value="SMS">SMS</option>
              <option value="EMAIL">Email</option>
              <option value="FCM">FCM</option>
              <option value="OBJECT_STORAGE">Object storage</option>
            </Select>
            <Select value={providerForm.environment} onChange={(e) => setProviderForm((form) => ({ ...form, environment: e.target.value }))}>
              <option value="TEST">Test</option>
              <option value="PRODUCTION">Production</option>
            </Select>
            <Input value={providerForm.name} onChange={(e) => setProviderForm((form) => ({ ...form, name: e.target.value }))} placeholder="Provider name" />
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={providerForm.enabled} onChange={(e) => setProviderForm((form) => ({ ...form, enabled: e.target.checked }))} />
              Enabled
            </label>
            <Textarea className="md:col-span-2" rows={5} value={providerForm.config} onChange={(e) => setProviderForm((form) => ({ ...form, config: e.target.value }))} />
          </div>
          <Button className="mt-4 gap-2" onClick={saveProvider} disabled={saving}>
            <ShieldCheck size={16} />
            Save Masked Provider
          </Button>
          <div className="mt-5 space-y-2">
            {providers.map((provider) => (
              <div key={provider.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{provider.type} · {provider.name}</span>
                  <Badge variant={provider.enabled ? 'success' : 'neutral'}>{provider.environment}</Badge>
                </div>
                <pre className="mt-2 overflow-auto text-xs text-slate-500">{JSON.stringify(provider.config, null, 2)}</pre>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Server size={18} className="text-slate-500" />
            <h2 className="text-lg font-bold text-slate-950">Queue Health</h2>
          </div>
          <div className="space-y-2">
            {queues.map((queue) => (
              <div key={queue.name} className="grid grid-cols-[1fr_auto] gap-3 rounded-lg border border-slate-100 p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{queue.name}</p>
                  <p className="text-xs text-slate-500">failed {queue.failed} · waiting {queue.waiting} · active {queue.active}</p>
                  {queue.error && (
                    <p className="mt-1 text-xs font-semibold text-amber-700">
                      Visibility degraded: {queue.error}
                    </p>
                  )}
                </div>
                <Button variant="outline" size="sm" className="gap-2">
                  <RefreshCw size={14} />
                  Retry
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-950">SaaS Plans</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.id} className="rounded-lg border border-slate-100 p-4">
              <div className="flex items-center justify-between">
                <p className="font-bold text-slate-950">{plan.name}</p>
                <Badge variant={plan.status === 'ACTIVE' ? 'success' : 'neutral'}>{plan.status}</Badge>
              </div>
              <p className="mt-2 text-sm text-slate-500">NPR {plan.priceNpr} · {plan.billingCycle}</p>
              <p className="mt-3 text-xs text-slate-500">{plan.features.length} features · {plan.limits.length} limits</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
