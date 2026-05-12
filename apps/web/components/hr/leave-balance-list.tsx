'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Search, Filter, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { LoadingState } from '../ui/loading-state';
import { EmptyState } from '../ui/empty-state';

export function LeaveBalanceList() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [showLowBalanceOnly, setShowLowBalanceOnly] = useState(false);

  const balancesQuery = useQuery({
    queryKey: ['staff-leave-balances'],
    queryFn: () => api.listAllLeaveBalances(),
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative group">
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <Select 
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="pl-10 min-w-[200px]"
            >
              <option value="ALL">All Leave Types</option>
              {leaveTypes.map(t => (
                <option key={t} value={t}>{t.replace('_', ' ')}</option>
              ))}
            </Select>
          </div>
          <Checkbox 
            label="Low Balance Only"
            checked={showLowBalanceOnly}
            onChange={setShowLowBalanceOnly}
            className="bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm hover:bg-slate-50 transition-colors"
          />
        </div>
      </div>

      <div className="shell-card overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">Staff Member</th>
                <th className="px-6 py-4 text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">Leave Type</th>
                <th className="px-6 py-4 text-[0.65rem] font-bold uppercase tracking-wider text-slate-400 text-center">Entitlement</th>
                <th className="px-6 py-4 text-[0.65rem] font-bold uppercase tracking-wider text-slate-400 text-center">Used</th>
                <th className="px-6 py-4 text-[0.65rem] font-bold uppercase tracking-wider text-slate-400 text-center">Pending</th>
                <th className="px-6 py-4 text-[0.65rem] font-bold uppercase tracking-wider text-slate-400 text-center text-primary-600">Remaining</th>
                <th className="px-6 py-4 text-[0.65rem] font-bold uppercase tracking-wider text-slate-400 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {balancesQuery.isLoading ? (
                <tr>
                  <td colSpan={7} className="p-0">
                    <LoadingState variant="spinner" label="Loading leave balances..." />
                  </td>
                </tr>
              ) : filteredBalances.length > 0 ? (
                filteredBalances.map((balance) => (
                  <tr key={balance.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900 leading-none">{balance.staff?.firstName} {balance.staff?.lastName}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1.5">{balance.staff?.employeeId}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-600">
                        {balance.leaveType.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-medium text-slate-500">{balance.entitlement + balance.carriedForward}</td>
                    <td className="px-6 py-4 text-center text-sm font-bold text-rose-600">{balance.used}</td>
                    <td className="px-6 py-4 text-center text-sm font-bold text-amber-500">{balance.pending}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={balance.remaining <= 2 ? 'text-rose-600 font-black' : 'text-emerald-600 font-black'}>
                        {balance.remaining}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {balance.remaining <= 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-black uppercase tracking-tight border border-rose-200/50">
                          <AlertTriangle size={10} strokeWidth={3} /> Exhausted
                        </span>
                      ) : balance.remaining <= 2 ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-tight border border-amber-200/50">
                          Low Balance
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-tight border border-emerald-200/50">
                          Healthy
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-0">
                    <EmptyState 
                      title="No leave balances found" 
                      description={search ? `No results for "${search}"` : "Leave balances will appear here once configured."}
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
