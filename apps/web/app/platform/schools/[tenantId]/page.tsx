'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
import { PlatformTenantDetail } from '@schoolos/core';
import { 
  ArrowLeft, 
  Shield, 
  ShieldOff,
  Activity,
  Users,
  Calendar,
  Settings,
  AlertTriangle,
  ExternalLink,
  History,
  CreditCard,
  CheckCircle2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PlatformSchoolDetail() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const router = useRouter();
  const [tenant, setTenant] = useState<PlatformTenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (tenantId) {
      api.getPlatformTenantDetail(tenantId)
        .then(setTenant)
        .finally(() => setLoading(false));
    }
  }, [tenantId]);

  const toggleStatus = async () => {
    if (!tenant) return;
    setUpdating(true);
    try {
      await api.updatePlatformTenantStatus(tenant.id, !tenant.isActive, 'Operator override');
      const updated = await api.getPlatformTenantDetail(tenant.id);
      setTenant(updated);
    } catch (error) {
      console.error('Failed to update status', error);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <div className="p-8">Loading school details...</div>;
  if (!tenant) return <div className="p-8 text-rose-500 text-center">School not found.</div>;

  return (
    <div className="space-y-8 p-8 max-w-7xl mx-auto">
      <button 
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-900 transition-colors group"
      >
        <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
        Back to Schools
      </button>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">{tenant.name}</h1>
            {tenant.isActive ? (
              <Badge variant="success" className="gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border-emerald-100 font-bold">
                <Shield size={14} fill="currentColor" className="opacity-20" />
                ACTIVE
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 border-rose-100 font-bold">
                <ShieldOff size={14} fill="currentColor" className="opacity-20" />
                SUSPENDED
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 font-mono text-sm text-slate-400 uppercase tracking-tighter">
            <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{tenant.slug}</span>
            <span>ID: {tenant.id}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            disabled={updating}
            onClick={toggleStatus}
            variant={tenant.isActive ? "destructive" : "default"}
            className="rounded-xl px-6 font-bold shadow-lg gap-2"
          >
            {tenant.isActive ? <ShieldOff size={18} /> : <Shield size={18} />}
            {tenant.isActive ? 'Suspend Access' : 'Restore Access'}
          </Button>
          <Button variant="outline" className="rounded-xl px-6 font-bold gap-2">
            <Settings size={18} />
            Config Override
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Usage Overview */}
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <MetricCard label="Total Students" value={tenant.studentCount} icon={Users} color="text-indigo-600" />
            <MetricCard label="Total Staff" value={tenant.staffCount} icon={Users} color="text-sky-600" />
            <MetricCard 
              label="Last Activity" 
              value={tenant.usage.lastActivityAt ? new Date(tenant.usage.lastActivityAt).toLocaleDateString() : 'Never'} 
              icon={Activity} 
              color="text-emerald-600" 
            />
          </div>

          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <CreditCard size={20} className="text-slate-400" />
                Subscription & Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-5">
                  <div className="rounded-2xl bg-indigo-50 p-4 text-indigo-600 border border-indigo-100">
                    <Shield size={32} />
                  </div>
                  <div>
                    <p className="text-xl font-extrabold text-slate-900 uppercase tracking-tight">{tenant.plan} Tier</p>
                    <p className="text-sm text-slate-500 mt-1">Multi-campus support · Full Academics · Priority Support</p>
                    <div className="flex items-center gap-4 mt-3">
                       <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                         <CheckCircle2 size={14} /> Paid monthly
                       </span>
                       <span className="text-xs text-slate-400 font-medium">Next renewal: Jun 1, 2026</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="success" className="px-4 py-1.5 font-bold">ACTIVE</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-slate-50 pb-6">
               <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <History size={20} className="text-slate-400" />
                    Platform Audit Trail
                  </CardTitle>
               </div>
               <Button variant="ghost" size="sm" className="font-bold text-primary-600 hover:text-primary-700 gap-1">
                 View Full Logs <ExternalLink size={14} />
               </Button>
            </CardHeader>
            <CardContent className="p-0">
               <div className="divide-y divide-slate-50">
                  <AuditRow action="Status Changed" date="Today, 10:42 AM" user="admin@schoolos.com" detail="Suspension lifted" />
                  <AuditRow action="Plan Updated" date="Yesterday" user="system" detail="Upgraded to Premium" />
                  <AuditRow action="New Admission" date="May 10, 2026" user="school_admin" detail="Bulk import (142 students)" />
               </div>
            </CardContent>
          </Card>
        </div>

        {/* School Metadata */}
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-50">
              <CardTitle className="text-lg font-bold">School Metadata</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <dl className="space-y-6">
                <div>
                  <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Registration Date</dt>
                  <dd className="flex items-center gap-2.5 text-sm text-slate-900 font-bold">
                    <div className="p-1.5 bg-slate-100 rounded-lg">
                      <Calendar size={16} className="text-slate-500" />
                    </div>
                    {new Date(tenant.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Financial ID (PAN)</dt>
                  <dd className="text-sm text-slate-900 font-mono font-bold bg-slate-50 p-2.5 rounded-xl border border-slate-100 border-dashed">
                    {tenant.panNumber || 'NOT_PROVIDED'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Operator Notes</dt>
                  <dd className="text-xs text-slate-500 leading-relaxed italic">
                    "Pilot school for Phase 2A. Special focus on large-scale fee collection."
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {!tenant.isActive && (
            <div className="rounded-3xl border border-rose-100 bg-rose-50/50 p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-rose-500 text-white rounded-xl shadow-lg shadow-rose-500/20">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <p className="text-base font-extrabold text-rose-900">Tenant Suspended</p>
                  <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                    Users from this school are currently blocked from all operations. Service will resume once reactivated.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color }: { label: string, value: string | number, icon: any, color: string }) {
  return (
    <div className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-primary-200 hover:shadow-md">
      <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">{label}</p>
      <div className="flex items-center justify-between">
        <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{value.toLocaleString()}</p>
        <div className={`p-2 rounded-xl bg-slate-50 group-hover:bg-white transition-colors ${color}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}

function AuditRow({ action, date, user, detail }: { action: string, date: string, user: string, detail: string }) {
  return (
    <div className="flex items-center justify-between p-5 hover:bg-slate-50/50 transition-colors">
       <div className="flex items-start gap-4">
          <div className="mt-1 h-2 w-2 rounded-full bg-slate-300" />
          <div>
             <p className="text-sm font-bold text-slate-900">{action}</p>
             <p className="text-[11px] text-slate-500 mt-0.5">{detail}</p>
          </div>
       </div>
       <div className="text-right">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{date}</p>
          <p className="text-[10px] font-bold text-slate-900 mt-0.5">{user}</p>
       </div>
    </div>
  );
}
