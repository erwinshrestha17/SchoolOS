'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Search, Filter, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

export function LeaveBalanceList() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [showLowBalanceOnly, setShowLowBalanceOnly] = useState(false);

  const balancesQuery = useQuery({
    queryKey: ['staff-leave-balances'],
    queryFn: api.listStaffLeaveBalances,
  });

  const leaveTypes = ['SICK_LEAVE', 'CASUAL_LEAVE', 'EARNED_LEAVE', 'MATERNITY_LEAVE', 'PATERNITY_LEAVE', 'UNPAID_LEAVE'];

  const filteredBalances = (balancesQuery.data ?? []).filter((b) => {
    const staffName = `${b.staff?.firstName} ${b.staff?.lastName} ${b.staff?.employeeId}`.toLowerCase();
    const matchesSearch = staffName.includes(search.toLowerCase());
    const matchesType = typeFilter === 'ALL' || b.leaveType === typeFilter;
    const matchesLow = !showLowBalanceOnly || b.remaining <= 2;
    return matchesSearch && matchesType && matchesLow;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search staff by name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 bg-white">
            <Filter size={16} className="text-gray-400" />
            <select 
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-sm font-medium text-gray-600 focus:outline-none bg-transparent"
            >
              <option value="ALL">All Leave Types</option>
              {leaveTypes.map(t => (
                <option key={t} value={t}>{t.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 bg-white cursor-pointer hover:bg-gray-50 transition-colors">
            <input 
              type="checkbox" 
              checked={showLowBalanceOnly}
              onChange={(e) => setShowLowBalanceOnly(e.target.checked)}
              className="rounded text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm font-medium text-gray-600">Low Balance Only</span>
          </label>
        </div>
      </div>

      <div className="shell-card overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 font-semibold text-gray-500">Staff Member</th>
                <th className="px-6 py-4 font-semibold text-gray-500">Leave Type</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-center">Entitlement</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-center">Used</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-center">Pending</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-center">Remaining</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {balancesQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 w-32 bg-gray-100 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-24 bg-gray-100 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-8 mx-auto bg-gray-100 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-8 mx-auto bg-gray-100 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-8 mx-auto bg-gray-100 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-8 mx-auto bg-gray-100 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-6 w-16 ml-auto bg-gray-100 rounded-full" /></td>
                  </tr>
                ))
              ) : filteredBalances.length > 0 ? (
                filteredBalances.map((balance) => (
                  <tr key={balance.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-900">{balance.staff?.firstName} {balance.staff?.lastName}</p>
                      <p className="text-[10px] text-gray-500 font-mono">{balance.staff?.employeeId}</p>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-700">
                      {balance.leaveType.replace('_', ' ')}
                    </td>
                    <td className="px-6 py-4 text-center text-gray-600">{balance.entitlement + balance.carriedForward}</td>
                    <td className="px-6 py-4 text-center font-medium text-danger-600">{balance.used}</td>
                    <td className="px-6 py-4 text-center text-amber-600">{balance.pending}</td>
                    <td className="px-6 py-4 text-center font-bold text-gray-900">
                      <span className={balance.remaining <= 2 ? 'text-danger-600' : 'text-success-600'}>
                        {balance.remaining}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {balance.remaining <= 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-danger-100 text-danger-700 text-[10px] font-bold uppercase tracking-tight">
                          <AlertTriangle size={10} /> Exhausted
                        </span>
                      ) : balance.remaining <= 2 ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-tight">
                          Low
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-success-100 text-success-700 text-[10px] font-bold uppercase tracking-tight">
                          Healthy
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No leave balances found matching your filters.
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
