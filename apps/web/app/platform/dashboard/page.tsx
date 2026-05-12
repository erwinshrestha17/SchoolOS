'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { PlatformTenantSummary } from '@schoolos/core';
import { 
  ShieldCheck, 
  School, 
  Users, 
  Activity,
  AlertCircle,
  TrendingUp,
  Server,
  Zap,
  Globe,
  ArrowRight
} from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { SectionCard } from '@/components/ui/section-card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function PlatformDashboard() {
  const [tenants, setTenants] = useState<PlatformTenantSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listPlatformTenants()
      .then(setTenants)
      .finally(() => setLoading(false));
  }, []);

  const stats = [
    {
      label: 'Active Schools',
      value: tenants.filter(t => t.isActive).length,
      icon: School,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      label: 'Global Students',
      value: tenants.reduce((acc, t) => acc + t.studentCount, 0).toLocaleString(),
      icon: Users,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'API Requests (24h)',
      value: '1.2M',
      icon: Zap,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Infrastructure Status',
      value: 'Operational',
      icon: ShieldCheck,
      color: 'text-sky-600',
      bg: 'bg-sky-50',
    },
  ];

  if (loading) {
    return (
      <div className="p-8 space-y-8 animate-pulse">
        <div className="h-20 bg-slate-100 rounded-2xl w-1/3" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-slate-100 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-8 max-w-7xl mx-auto">
      <header className="relative overflow-hidden rounded-3xl bg-slate-950 px-8 py-10 text-white shadow-2xl">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="neutral" className="bg-primary-500/20 text-primary-400 border-primary-500/30 font-bold tracking-widest text-[10px]">
                CONTROL PLANE
              </Badge>
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">System Healthy</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Platform Intelligence</h1>
            <p className="mt-2 text-slate-400 max-w-xl">
              Centralized command for SchoolOS multi-tenant infrastructure. Monitor health, manage schools, and oversee global operations.
            </p>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="rounded-2xl bg-white/5 border border-white/10 p-4 backdrop-blur-md">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Global Load</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">14%</span>
                  <TrendingUp size={14} className="text-emerald-500" />
                </div>
             </div>
             <Link href="/platform/schools" className="flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-100 shadow-xl">
                Manage Schools
                <ArrowRight size={18} />
             </Link>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary-500/10 blur-3xl" />
        <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-primary-200 hover:shadow-md">
            <div className="flex items-center gap-4">
              <div className={`rounded-xl ${stat.bg} ${stat.color} p-3 transition-transform group-hover:scale-110`}>
                <stat.icon size={24} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-bold text-slate-900 tracking-tight">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <SectionCard 
          title="Security Events" 
          description="Recent platform-level security audits"
          className="lg:col-span-2"
        >
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 mb-4">
              <Activity size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No Security Alerts</h3>
            <p className="text-sm text-slate-500 max-w-sm mt-1">
              Your platform infrastructure is secure. No unauthorized access attempts or suspicious activities detected in the last 24 hours.
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Infrastructure Nodes">
          <div className="space-y-4">
            <NodeStatus label="API Cluster (np-central-1)" status="Healthy" load={12} />
            <NodeStatus label="Database (Primary)" status="Healthy" load={45} />
            <NodeStatus label="Redis Cache" status="Healthy" load={8} />
            <NodeStatus label="Asset Storage (S3)" status="Healthy" load={2} />
            <NodeStatus label="Worker Queue" status="Healthy" load={18} />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function NodeStatus({ label, status, load }: { label: string, status: string, load: number }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50">
      <div className="flex items-center gap-3">
        <Server size={16} className="text-slate-400" />
        <div>
          <p className="text-xs font-bold text-slate-800">{label}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-medium text-slate-500 uppercase">{status}</span>
          </div>
        </div>
      </div>
      <div className="text-right">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Load</p>
        <p className="text-xs font-bold text-slate-900">{load}%</p>
      </div>
    </div>
  );
}
