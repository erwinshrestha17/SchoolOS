'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Search, UserPlus, Mail, Briefcase } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { StaffCreateDialog } from './staff-create-dialog';
import { Badge } from '../ui/badge';
import { Button } from '../ui/primitives/button';
import { cn } from '../../lib/utils';
import {
  PaginatedDataTable,
  type PaginatedDataTableColumn,
} from '../schoolos/data/paginated-data-table';

type StaffDirectoryRow = Awaited<ReturnType<typeof api.listStaffDirectory>>['items'][number];

const staffColumns: PaginatedDataTableColumn<StaffDirectoryRow>[] = [
  {
    id: 'employee',
    header: 'Employee',
    cell: (staff) => {
      const formatAssignedText = (value: string | null | undefined, fallback: string) =>
        value?.trim() || fallback;
      return (
        <div className="flex items-center gap-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-lg font-black text-slate-400 shadow-inner">
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
                  {formatAssignedText(staff.designation, 'Designation not set')} &bull;{' '}
                  {formatAssignedText(staff.department, 'Department not set')}
                </span>
              )}
            </div>
          </div>
        </div>
      );
    },
  },
  {
    id: 'status',
    header: 'Status',
    cell: (staff) => (
      <Badge
        className={cn(
          'font-black uppercase tracking-widest text-[9px] px-2.5 py-0.5',
          staff.status === 'ACTIVE' || !staff.status
            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/10'
            : staff.status === 'TERMINATED'
              ? 'bg-rose-500/10 text-rose-600 border-rose-500/10'
              : 'bg-slate-100 text-slate-500',
        )}
      >
        {staff.status || 'ACTIVE'}
      </Badge>
    ),
  },
];

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
    queryKey: [
      'staff-directory',
      page,
      limit,
      search,
      statusFilter,
      contractFilter,
      deptFilter,
      desigFilter,
    ],
    queryFn: () =>
      api.listStaffDirectory({
        page,
        limit,
        search: search.trim() || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        contractType: contractFilter === 'ALL' ? undefined : contractFilter,
        department: deptFilter.trim() || undefined,
        designation: desigFilter.trim() || undefined,
      }),
  });

  const paginatedStaff = staffQuery.data?.items ?? [];
  const totalItems = staffQuery.data?.total ?? 0;

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
          className="flex items-center gap-2 rounded-xl bg-[var(--color-mod-hr-accent)] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-[var(--color-mod-hr-text)] active:scale-[0.98]"
        >
          <UserPlus size={18} />
          Add Staff Member
        </button>
      </div>

      {/* Advanced Filters */}
      <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-4">
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
            <option value="TEMPORARY">Temporary</option>
            <option value="PART_TIME">Part Time</option>
          </Select>
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 block mb-1.5 ml-1">
            Department
          </label>
          <Input
            type="text"
            placeholder="All Departments"
            value={deptFilter}
            onChange={(e) => {
              setDeptFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 block mb-1.5 ml-1">
            Designation
          </label>
          <Input
            type="text"
            placeholder="All Designations"
            value={desigFilter}
            onChange={(e) => {
              setDesigFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* Directory Table */}
      <PaginatedDataTable
        columns={staffColumns}
        items={paginatedStaff}
        getRowId={(staff) => staff.id}
        status={staffQuery.isError ? 'error' : staffQuery.isLoading ? 'loading' : 'ready'}
        page={page}
        pageSize={limit}
        totalItems={totalItems}
        onPageChange={setPage}
        onRetry={() => void staffQuery.refetch()}
        errorMessage="The staff directory could not load. Please try again."
        emptyTitle="No staff members yet"
        emptyDescription="Add your first staff member to build the directory."
        hasActiveFilters={Boolean(
          search || statusFilter !== 'ALL' || contractFilter !== 'ALL' || deptFilter || desigFilter,
        )}
        noResultsTitle="No staff members found"
        noResultsDescription={search ? `No results matching "${search}"` : 'Try modifying filters to find staff members.'}
        rowActions={(staff) => (
          <Button type="button" size="sm" asChild>
            <Link href={`/dashboard/hr/staff/${staff.id}`}>Profile</Link>
          </Button>
        )}
      />

      <StaffCreateDialog isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </div>
  );
}
