'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { PlatformTenantSummary } from '@schoolos/core';
import Link from 'next/link';
import { 
  Plus, 
  Search, 
  Filter,
  MoreVertical,
  ExternalLink,
  Shield,
  ShieldOff
} from 'lucide-react';

export default function PlatformSchools() {
  const [tenants, setTenants] = useState<PlatformTenantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.listPlatformTenants()
      .then(setTenants)
      .finally(() => setLoading(false));
  }, []);

  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    t.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manage Schools</h1>
          <p className="text-slate-500">View and manage all registered tenants.</p>
        </div>
        <button className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700">
          <Plus size={18} />
          New Tenant
        </button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by name or slug..."
            className="w-full rounded-xl border border-slate-200 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
          <Filter size={18} />
          Filters
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] font-bold tracking-wider">
            <tr>
              <th className="px-6 py-4">School Name</th>
              <th className="px-6 py-4">Slug</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Plan</th>
              <th className="px-6 py-4">Students</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">Loading schools...</td>
              </tr>
            ) : filteredTenants.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">No schools found matching your search.</td>
              </tr>
            ) : (
              filteredTenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900">{tenant.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono uppercase">{tenant.id.slice(0, 8)}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-mono">{tenant.slug}</td>
                  <td className="px-6 py-4">
                    {tenant.isActive ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
                        <Shield size={10} />
                        ACTIVE
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700">
                        <ShieldOff size={10} />
                        SUSPENDED
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600 uppercase">
                      {tenant.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-medium">{tenant.studentCount}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link 
                        href={`/platform/schools/${tenant.id}`}
                        className="p-1.5 text-slate-400 hover:text-primary-600 transition-colors"
                      >
                        <ExternalLink size={18} />
                      </Link>
                      <button className="p-1.5 text-slate-400 hover:text-slate-600">
                        <MoreVertical size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
