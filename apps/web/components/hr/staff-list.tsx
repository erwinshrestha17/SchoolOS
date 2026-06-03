'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Search, UserPlus, Mail, Briefcase, Filter, ChevronLeft, ChevronRight, UserMinus } from 'lucide-react';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { LoadingState } from '../ui/loading-state';
import { EmptyState } from '../ui/empty-state';
import { StaffCreateDialog } from './staff-create-dialog';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

export function StaffList() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [contractFilter, setContractFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('');
  const [desigFilter, setDesigFilter] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Pagination states
  const [page, setPage] = useState(1);
  const limit = 10;

  const staffQuery = useQuery({
    queryKey: ['staff'],
    queryFn: api.listStaff,
  });

  const staff = useMemo(() => staffQuery.data ?? [], [staffQuery.data]);

  // Derived filter options for dropdowns
  const departments = useMemo(() => {
    const set = new Set<string>();
    staff.forEach((s) => s.department && set.add(s.department));
    return Array.from(set);
  }, [staff]);

  const designations = useMemo(() => {
    const set = new Set<string>();
    staff.forEach((s) => s.designation && set.add(s.designation));
    return Array.from(set);
  }, [staff]);

  // Apply filters
  const filteredStaff = useMemo(() => {
    return staff.filter((s) => {
      const fullName = `${s.firstName} ${s.lastName} ${s.employeeId}`.toLowerCase();
      const matchesSearch = fullName.includes(search.toLowerCase());
      
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && (s.status === 'ACTIVE' || !s.status)) ||
        s.status === statusFilter;
        
      const matchesContract = contractFilter === 'ALL' || s.contractType === contractFilter;
      
      const matchesDept = !deptFilter || s.department === deptFilter;
      const matchesDesig = !desigFilter || s.designation === desigFilter;

      return matchesSearch && matchesStatus && matchesContract && matchesDept && matchesDesig;
    });
  }, [staff, search, statusFilter, contractFilter, deptFilter, desigFilter]);

  // Paginated subset
  const totalItems = filteredStaff.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const paginatedStaff = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredStaff.slice(start, start + limit);
  }, [filteredStaff, page, limit]);

  const handlePrevPage = () => setPage((p) => Math.max(1, p - 1));
  const handleNextPage = () => setPage((p) => Math.min(totalPages, p + 1));

  return (
    <div className="space-y-6">
      {/* Search & Action Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input
            type="text"
            placeholder="Search staff by name or ID..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-11"
          />
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-sm hover:bg-blue-600 transition-all hover:shadow-md active:scale-[0.98]"
        >
          <UserPlus size={18} />
          Add Staff Member
        </button>
      </div>

      {/* Advanced Filters */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 bg-white border border-slate-200 p-5 rounded-[2rem] shadow-sm">
        <div>
          <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 block mb-1.5 ml-1">
            Status
          </label>
          <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="TERMINATED">Terminated</option>
          </Select>
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 block mb-1.5 ml-1">
            Contract Type
          </label>
          <Select value={contractFilter} onChange={(e) => { setContractFilter(e.target.value); setPage(1); }}>
            <option value="ALL">All Contracts</option>
            <option value="PERMANENT">Permanent</option>
            <option value="CONTRACT">Contract</option>
            <option value="PROBATION">Probation</option>
            <option value="TEMPORARY">Temporary</option>
          </Select>
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 block mb-1.5 ml-1">
            Department
          </label>
          <Select value={deptFilter} onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}>
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 block mb-1.5 ml-1">
            Designation
          </label>
          <Select value={desigFilter} onChange={(e) => { setDesigFilter(e.target.value); setPage(1); }}>
            <option value="">All Designations</option>
            {designations.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </Select>
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200">
                <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-400">Employee</th>
                <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-400">Status</th>
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
                    <td className="px-8 py-6">
                      <div className="h-6 w-16 bg-slate-100 rounded-full" />
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="h-8 w-24 bg-slate-100 rounded-xl ml-auto" />
                    </td>
                  </tr>
                ))
              ) : paginatedStaff.length > 0 ? (
                paginatedStaff.map((staff) => (
                  <tr key={staff.id} className="hover:bg-slate-50/30 transition-all group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-5">
                        <div className="h-14 w-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center font-black text-lg border border-slate-200 shadow-inner group-hover:bg-blue-50 group-hover:text-blue-500 group-hover:border-blue-100 transition-colors">
                          {staff.firstName[0]}
                          {staff.lastName[0]}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-black text-slate-900 text-lg">
                              {staff.firstName} {staff.lastName}
                            </p>
                            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200">
                              {staff.employeeId}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500">
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
                            {(staff.department || staff.designation) && (
                              <span className="text-slate-400">
                                {staff.designation || 'Staff'} • {staff.department || 'General'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <Badge
                        className={cn(
                          'font-black uppercase tracking-widest text-[9px] px-2.5 py-0.5',
                          staff.status === 'ACTIVE' || !staff.status
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/10'
                            : staff.status === 'TERMINATED'
                            ? 'bg-rose-500/10 text-rose-600 border-rose-500/10'
                            : 'bg-slate-100 text-slate-500'
                        )}
                      >
                        {staff.status || 'ACTIVE'}
                      </Badge>
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
                  <td colSpan={3} className="px-8 py-20 text-center">
                    <EmptyState
                      title="No staff members found"
                      description={
                        search
                          ? `No results matching "${search}"`
                          : 'Try modifying filters to find staff members.'
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-8 py-4 bg-slate-50/50">
            <span className="text-xs font-bold text-slate-500">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalItems)} of {totalItems} members
            </span>
            <div className="flex gap-2">
              <button
                onClick={handlePrevPage}
                disabled={page === 1}
                className="p-2 border border-slate-200 rounded-xl bg-white text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={handleNextPage}
                disabled={page === totalPages}
                className="p-2 border border-slate-200 rounded-xl bg-white text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      <StaffCreateDialog isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </div>
  );
}
