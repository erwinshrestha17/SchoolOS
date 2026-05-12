'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Search, UserPlus, Mail, Briefcase } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Input } from '../ui/input';
import { LoadingState } from '../ui/loading-state';
import { EmptyState } from '../ui/empty-state';

export function StaffList() {
  const [search, setSearch] = useState('');
  const staffQuery = useQuery({
    queryKey: ['staff'],
    queryFn: api.listStaff,
  });

  const filteredStaff = (staffQuery.data ?? []).filter((s) =>
    `${s.firstName} ${s.lastName} ${s.employeeId}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input
            type="text"
            placeholder="Search staff by name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-11"
          />
        </div>
        <button className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-sm hover:bg-slate-800 transition-all hover:shadow-md active:scale-[0.98]">
          <UserPlus size={18} />
          Add Staff Member
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200">
                <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-400">Employee</th>
                <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staffQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-slate-100" />
                        <div className="space-y-2">
                          <div className="h-4 w-32 bg-slate-100 rounded" />
                          <div className="h-3 w-24 bg-slate-50 rounded" />
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="h-8 w-24 bg-slate-100 rounded-xl ml-auto" />
                    </td>
                  </tr>
                ))
              ) : filteredStaff.length > 0 ? (
                filteredStaff.map((staff) => (
                  <tr key={staff.id} className="hover:bg-slate-50/30 transition-all group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-5">
                        <div className="h-14 w-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center font-black text-lg border border-slate-200 shadow-inner group-hover:bg-blue-50 group-hover:text-blue-500 group-hover:border-blue-100 transition-colors">
                          {staff.firstName[0]}{staff.lastName[0]}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-black text-slate-900 text-lg">{staff.firstName} {staff.lastName}</p>
                            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200">
                              {staff.employeeId}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                            <span className="flex items-center gap-1.5">
                              <Mail size={12} className="text-slate-400" />
                              {staff.email}
                            </span>
                            {staff.contractType && (
                              <span className="flex items-center gap-1.5">
                                <Briefcase size={12} className="text-slate-400" />
                                {staff.contractType}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <Link
                        href={`/dashboard/hr/staff/${staff.id}`}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-blue-600 transition-all shadow-lg shadow-slate-900/10 active:scale-95"
                      >
                        Profile
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="px-8 py-20 text-center">
                    <EmptyState 
                      title="No staff members found" 
                      description={search ? `No results for "${search}"` : "The staff directory is currently empty."}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
