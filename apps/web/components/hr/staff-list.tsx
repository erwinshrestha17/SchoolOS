'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Search, UserPlus } from 'lucide-react';
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

      <div className="shell-card overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">Employee</th>
                <th className="px-6 py-4 text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">ID</th>
                <th className="px-6 py-4 text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">Roles</th>
                <th className="px-6 py-4 text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">Joined</th>
                <th className="px-6 py-4 text-[0.65rem] font-bold uppercase tracking-wider text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {staffQuery.isLoading ? (
                <tr>
                  <td colSpan={5} className="p-0">
                    <LoadingState variant="spinner" label="Loading staff directory..." />
                  </td>
                </tr>
              ) : filteredStaff.length > 0 ? (
                filteredStaff.map((staff) => (
                  <tr key={staff.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-black text-sm border-2 border-white shadow-sm">
                          {staff.firstName[0]}{staff.lastName[0]}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 leading-none">{staff.firstName} {staff.lastName}</p>
                          <p className="text-xs text-slate-500 mt-1">{staff.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-600">{staff.employeeId}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {staff.roles.map((role) => (
                          <span key={role} className="px-2.5 py-0.5 rounded-full bg-slate-100 text-[10px] font-black uppercase text-slate-600 tracking-tight border border-slate-200/50">
                            {role}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-500">
                      {new Date(staff.joiningDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/staff/${staff.id}`}
                        className="inline-flex items-center gap-1.5 text-sm font-bold text-primary-600 hover:text-primary-700 transition-colors"
                      >
                        View Profile
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-0">
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
