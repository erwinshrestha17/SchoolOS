'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { PlatformTenantSummary } from '@schoolos/core';
import { 
  ShieldCheck, 
  School, 
  Users, 
  Activity,
  AlertCircle
} from 'lucide-react';

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
      color: 'bg-indigo-500',
    },
    {
      label: 'Total Students',
      value: tenants.reduce((acc, t) => acc + t.studentCount, 0),
      icon: Users,
      color: 'bg-emerald-500',
    },
    {
      label: 'System Status',
      value: 'Healthy',
      icon: ShieldCheck,
      color: 'bg-sky-500',
    },
  ];

  if (loading) {
    return <div className="p-8">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Platform Control Plane</h1>
        <p className="text-slate-500">Global overview and system health monitoring.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className={`rounded-xl ${stat.color} p-3 text-white`}>
                <stat.icon size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Recent Activity</h2>
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <Activity size={48} className="mb-4 opacity-20" />
          <p>No recent platform-level security events.</p>
        </div>
      </div>
    </div>
  );
}
