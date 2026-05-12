'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowRight, Database, School, ShieldCheck, Users } from 'lucide-react';
import { api } from '../../../lib/api';
import type { PlatformDashboardSummary } from '@schoolos/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function PlatformDashboard() {
  const [summary, setSummary] = useState<PlatformDashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getPlatformDashboard()
      .then(setSummary)
      .catch((err) => setError(err.message ?? 'Failed to load platform dashboard'));
  }, []);

  if (error) {
    return <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{error}</div>;
  }

  if (!summary) {
    return <div className="h-48 animate-pulse rounded-lg bg-slate-100" />;
  }

  const stats = [
    { label: 'Total Schools', value: summary.totalTenants, icon: School },
    { label: 'Active Schools', value: summary.activeTenants, icon: ShieldCheck },
    { label: 'Suspended Schools', value: summary.suspendedTenants, icon: Activity },
    { label: 'Pending Onboarding', value: summary.pendingOnboarding, icon: Database },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge variant="neutral" className="mb-3">Control Plane</Badge>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Platform Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Tenant management, usage, onboarding, billing, provider safety, queues, and production health for SchoolOS operators.
          </p>
        </div>
        <Link href="/platform/schools">
          <Button className="gap-2">
            Manage Schools
            <ArrowRight size={16} />
          </Button>
        </Link>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <stat.icon size={20} />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{stat.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Students</p>
          <div className="mt-3 flex items-center gap-3">
            <Users className="text-slate-400" size={22} />
            <p className="text-xl font-bold text-slate-950">{summary.usage.totalActiveStudents.toLocaleString()}</p>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Staff</p>
          <div className="mt-3 flex items-center gap-3">
            <Users className="text-slate-400" size={22} />
            <p className="text-xl font-bold text-slate-950">{summary.usage.totalActiveStaff.toLocaleString()}</p>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Private Storage</p>
          <div className="mt-3 flex items-center gap-3">
            <Database className="text-slate-400" size={22} />
            <p className="text-xl font-bold text-slate-950">{formatBytes(summary.usage.totalStorageBytes)}</p>
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
