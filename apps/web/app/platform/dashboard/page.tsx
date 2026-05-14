'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Activity, 
  ArrowRight, 
  Database, 
  School, 
  ShieldCheck, 
  Users, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  History,
  ShieldAlert
} from 'lucide-react';
import { api } from '../../../lib/api';
import type { PlatformDashboardSummary } from '@schoolos/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function PlatformDashboard() {
  const [summary, setSummary] = useState<PlatformDashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    api
      .getPlatformDashboard()
      .then(setSummary)
      .catch((err) => setError(err.message ?? 'Failed to load platform dashboard'))
      .finally(() => setIsLoading(false));
  }, []);

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-rose-100 bg-rose-50/50 p-12 text-center">
        <ShieldAlert size={48} className="mb-4 text-rose-500" />
        <h2 className="text-xl font-bold text-rose-900">Dashboard Unavailable</h2>
        <p className="mt-2 text-rose-700/70">{error}</p>
        <Button 
          variant="outline" 
          className="mt-6 border-rose-200 text-rose-700 hover:bg-rose-100"
          onClick={() => window.location.reload()}
        >
          Try Again
        </Button>
      </div>
    );
  }

  if (isLoading || !summary) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="h-32 w-full animate-pulse rounded-3xl bg-slate-100" />
        <div className="grid gap-6 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 animate-pulse rounded-3xl bg-slate-50" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="h-64 animate-pulse rounded-3xl bg-slate-50 lg:col-span-2" />
          <div className="h-64 animate-pulse rounded-3xl bg-slate-50" />
        </div>
      </div>
    );
  }

  const s = summary as any;

  const kpis = [
    { label: 'Total Schools', value: s.totalTenants, icon: School, color: 'bg-indigo-50 text-indigo-600' },
    { label: 'Active Schools', value: s.activeTenants, icon: ShieldCheck, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Suspended', value: s.suspendedTenants, icon: Activity, color: 'bg-rose-50 text-rose-600' },
    { label: 'Pending Onboarding', value: s.pendingOnboarding, icon: Clock, color: 'bg-amber-50 text-amber-600' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="neutral" className="bg-slate-100 text-slate-600 hover:bg-slate-200">
              Control Plane
            </Badge>
            {s.healthStatus === 'ready' ? (
              <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-100">
                <CheckCircle2 size={12} className="mr-1" /> System Ready
              </Badge>
            ) : (
              <Badge variant="destructive" className="bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-100">
                <AlertCircle size={12} className="mr-1" /> Degraded
              </Badge>
            )}
          </div>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900">Platform Overview</h1>
          <p className="mt-2 max-w-2xl text-lg text-slate-500">
            Real-time operational health and tenant lifecycle management for the SchoolOS infrastructure.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/platform/schools">
            <Button size="lg" className="rounded-2xl bg-slate-900 px-6 font-bold shadow-xl shadow-slate-200 hover:bg-slate-800">
              Manage Schools
              <ArrowRight size={18} className="ml-2" />
            </Button>
          </Link>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="group relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-6 transition-all hover:border-slate-200 hover:shadow-xl hover:shadow-slate-100">
            <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${kpi.color} transition-transform group-hover:scale-110`}>
              <kpi.icon size={24} />
            </div>
            <p className="text-sm font-bold uppercase tracking-wider text-slate-400">{kpi.label}</p>
            <p className="mt-1 text-3xl font-black text-slate-900">{kpi.value?.toLocaleString() || 0}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <section className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                  <History size={20} />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Recent Platform Activity</h2>
              </div>
              <Link href="/platform/audit" className="text-sm font-bold text-indigo-600 hover:text-indigo-700">
                View Full Audit
              </Link>
            </div>

            <div className="space-y-4">
              {s.recentAudit?.length > 0 ? (
                s.recentAudit.map((log: any) => (
                  <div key={log.id} className="group flex items-start gap-4 rounded-2xl border border-transparent p-3 transition-colors hover:border-slate-50 hover:bg-slate-50/50">
                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-300 group-hover:bg-indigo-500" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-slate-900">
                          {log.action.replace(/_/g, ' ')}
                        </p>
                        <span className="text-xs font-medium text-slate-400">
                          {getRelativeTime(log.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {log.user?.email ?? 'System'} acted on {log.resource} <span className="font-mono">{log.resourceId?.slice(0, 8)}</span>
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-sm font-medium text-slate-400">No recent activity recorded.</p>
                </div>
              )}
            </div>
          </section>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-sm">
              <Users className="mx-auto mb-3 text-indigo-500" size={28} />
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Students</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{s.usage?.totalActiveStudents?.toLocaleString() || 0}</p>
            </div>
            <div className="rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-sm">
              <Users className="mx-auto mb-3 text-emerald-500" size={28} />
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Staff</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{s.usage?.totalActiveStaff?.toLocaleString() || 0}</p>
            </div>
            <div className="rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-sm">
              <Database className="mx-auto mb-3 text-amber-500" size={28} />
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Storage</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{formatBytes(s.usage?.totalStorageBytes || 0)}</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-slate-900">Infrastructure Health</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${s.healthStatus === 'ready' ? 'bg-emerald-500' : 'bg-rose-500'} shadow-[0_0_8px_rgba(16,185,129,0.5)]`} />
                  <span className="text-sm font-bold text-slate-700">Core Services</span>
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Healthy</span>
              </div>
              
              <Link href="/platform/settings?tab=queues" className="block group">
                <div className={`flex items-center justify-between rounded-2xl p-4 transition-colors ${s.failedJobsCount > 0 ? 'bg-rose-50 hover:bg-rose-100/70' : 'bg-slate-50 hover:bg-slate-100/70'}`}>
                  <div className="flex items-center gap-3">
                    <Activity size={18} className={s.failedJobsCount > 0 ? 'text-rose-600' : 'text-slate-400'} />
                    <span className={`text-sm font-bold ${s.failedJobsCount > 0 ? 'text-rose-700' : 'text-slate-700'}`}>Queue Health</span>
                  </div>
                  <Badge variant={s.failedJobsCount > 0 ? 'destructive' : 'neutral'} className="rounded-lg">
                    {s.failedJobsCount || 0} Failed
                  </Badge>
                </div>
              </Link>

              <div className="pt-4 border-t border-slate-100 mt-2">
                <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-2">
                  <span>DB Connection Pool</span>
                  <span>82%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: '82%' }} />
                </div>
              </div>
            </div>
          </section>

          <div className="rounded-3xl bg-indigo-600 p-8 text-white shadow-xl shadow-indigo-100 relative overflow-hidden group">
            <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-white/10 blur-3xl transition-transform group-hover:scale-150" />
            <h3 className="text-lg font-bold opacity-90">Operational Safety</h3>
            <p className="mt-2 text-sm leading-relaxed opacity-70">
              All operator actions are logged and traceable. Destructive actions require a mandatory audit reason.
            </p>
            <Button variant="secondary" className="mt-6 w-full rounded-xl font-bold bg-white text-indigo-600 hover:bg-indigo-50">
              Security Overview
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatBytes(value: number) {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
