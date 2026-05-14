'use client';

import type { PlatformDashboardSummary } from '@schoolos/core';
import { Activity, AlertTriangle, ArrowRight, Database, School, ShieldCheck, Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '../../../lib/api';

export default function PlatformDashboard() {
  const [summary, setSummary] = useState<PlatformDashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .getPlatformDashboard()
      .then(setSummary)
      .catch((err) => setError(err.message ?? 'Failed to load platform dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-rose-800">
        <div className="flex items-center gap-3 font-bold">
          <AlertTriangle size={20} />
          Dashboard unavailable
        </div>
        <p className="mt-2 text-sm">{error}</p>
        <Button className="mt-4" variant="outline" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </div>
    );
  }

  if (loading || !summary) {
    return <div className="h-40 animate-pulse rounded-3xl bg-slate-100" />;
  }

  const s = summary as any;
  const kpis = [
    { label: 'Total Schools', value: s.totalTenants, icon: School },
    { label: 'Active Schools', value: s.activeTenants, icon: ShieldCheck },
    { label: 'Suspended', value: s.suspendedTenants, icon: Activity },
    { label: 'Storage', value: formatBytes(s.usage?.totalStorageBytes || 0), icon: Database },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Badge variant="neutral">Control Plane</Badge>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900">Platform Overview</h1>
          <p className="mt-2 max-w-2xl text-slate-500">
            Operational health and tenant lifecycle management for SchoolOS.
          </p>
        </div>
        <Link href="/platform/schools">
          <Button className="gap-2 rounded-2xl bg-slate-900 px-6 font-bold hover:bg-slate-800">
            Manage Schools
            <ArrowRight size={18} />
          </Button>
        </Link>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <kpi.icon className="mb-4 text-slate-500" size={24} />
            <p className="text-sm font-bold uppercase tracking-wider text-slate-400">{kpi.label}</p>
            <p className="mt-1 text-3xl font-black text-slate-900">{kpi.value?.toLocaleString?.() ?? kpi.value ?? 0}</p>
          </div>
        ))}
      </div>

      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Recent Platform Activity</h2>
            <p className="mt-1 text-sm text-slate-500">Latest audited operator activity.</p>
          </div>
          <Link href="/platform/audit" className="text-sm font-bold text-indigo-600 hover:text-indigo-700">
            View Full Audit
          </Link>
        </div>
        <div className="mt-6 space-y-3">
          {s.recentAudit?.length ? (
            s.recentAudit.map((log: any) => (
              <div key={log.id} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-bold text-slate-900">{log.action.replace(/_/g, ' ')}</p>
                <p className="mt-1">
                  {log.user?.email ?? 'System'} acted on {log.resource}{' '}
                  <span className="font-medium tracking-tight text-slate-500">{log.resourceId?.slice(0, 8)}</span>
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No recent activity recorded.</p>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-slate-900">Infrastructure Health</h2>
          <Link href="/platform/settings?tab=health" className="text-sm font-bold text-indigo-600 hover:text-indigo-700">
            Health details
          </Link>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 p-4">
          <span className="font-bold text-slate-700">Queue Health</span>
          <Badge variant={s.failedJobsCount > 0 ? 'destructive' : 'neutral'}>{s.failedJobsCount || 0} Failed</Badge>
        </div>
      </section>
    </div>
  );
}

function formatBytes(value: number) {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
