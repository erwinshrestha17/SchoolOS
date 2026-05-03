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
  AlertTriangle
} from 'lucide-react';

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
      await api.updatePlatformTenantStatus(tenant.id, !tenant.isActive);
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
    <div className="space-y-8 p-8">
      <button 
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Schools
      </button>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900">{tenant.name}</h1>
            {tenant.isActive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                <Shield size={12} />
                ACTIVE
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700">
                <ShieldOff size={12} />
                SUSPENDED
              </span>
            )}
          </div>
          <p className="mt-1 text-slate-500 font-mono text-sm">{tenant.slug} · {tenant.id}</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            disabled={updating}
            onClick={toggleStatus}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              tenant.isActive 
                ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' 
                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
            } ${updating ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {tenant.isActive ? <ShieldOff size={18} /> : <Shield size={18} />}
            {tenant.isActive ? 'Suspend School' : 'Activate School'}
          </button>
          <button className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors">
            <Settings size={18} />
            Tenant Settings
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Usage Overview */}
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-slate-500 mb-1">Students</p>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-bold text-slate-900">{tenant.studentCount}</p>
                <Users size={20} className="text-slate-300" />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-slate-500 mb-1">Staff</p>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-bold text-slate-900">{tenant.staffCount}</p>
                <Users size={20} className="text-slate-300" />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-slate-500 mb-1">Last Activity</p>
              <div className="flex items-end justify-between">
                <p className="text-sm font-bold text-slate-900 truncate">
                  {tenant.usage.lastActivityAt ? new Date(tenant.usage.lastActivityAt).toLocaleDateString() : 'Never'}
                </p>
                <Activity size={20} className="text-slate-300" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Subscription & Plan</h3>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-white p-2 shadow-sm">
                  <Shield className="text-primary-600" size={24} />
                </div>
                <div>
                  <p className="font-bold text-slate-900 uppercase">{tenant.plan} Plan</p>
                  <p className="text-xs text-slate-500">Billed monthly · Next renewal Jun 1, 2026</p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-700">PAID</span>
            </div>
          </div>
        </div>

        {/* School Metadata */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Basic Information</h3>
            <dl className="space-y-4">
              <div>
                <dt className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Registered At</dt>
                <dd className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                  <Calendar size={14} />
                  {new Date(tenant.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">PAN Number</dt>
                <dd className="text-sm text-slate-900 font-mono font-medium">{tenant.panNumber || 'Not provided'}</dd>
              </div>
            </dl>
          </div>

          {!tenant.isActive && (
            <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-rose-600 shrink-0" size={20} />
                <div>
                  <p className="text-sm font-bold text-rose-900">Tenant Suspended</p>
                  <p className="text-xs text-rose-700 mt-1">Users from this school cannot log in until the account is reactivated.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
