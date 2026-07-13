'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  formatBsDate,
  formatBsDateForInput,
  parseBsDateInput,
  toGregorianDateFromBs,
} from '@schoolos/core';
import { Plus, Search } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { FormField } from '../ui/form-field';
import { useSession } from '../session-provider';
import { BsDateField } from '../ui/bs-date-field';
import {
  PaginatedDataTable,
  type PaginatedDataTableColumn,
} from '../schoolos/data/paginated-data-table';

type StaffContractRow = Awaited<ReturnType<typeof api.listStaffContractsPage>>['items'][number];

const moneyFormatter = new Intl.NumberFormat('en-NP', {
  style: 'currency',
  currency: 'NPR',
  maximumFractionDigits: 0,
});

export function ContractList() {
  const queryClient = useQueryClient();
  const { hasPermissions } = useSession();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const [page, setPage] = useState(1);
  const limit = 10;
  const canCreateContracts = hasPermissions(['hr:manage']);
  const canViewPayrollAmounts =
    hasPermissions(['payroll:read']) || hasPermissions(['payroll:manage']);
  
  const contractsQuery = useQuery({
    queryKey: ['staff-contracts', page, limit, deferredSearch],
    queryFn: () =>
      api.listStaffContractsPage({
        page,
        limit,
        search: deferredSearch || undefined,
      }),
  });

  const [isCreating, setIsCreating] = useState(false);
  const [newContract, setNewContract] = useState({
    staffId: '',
    contractNumber: '',
    position: '',
    startDateBs: formatBsDateForInput(new Date()),
    endDateBs: '',
    baseSalary: 0,
    allowances: 0,
    deductions: 0,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const staffQuery = useQuery({
    queryKey: ['staff'],
    queryFn: api.listStaff,
  });

  const createMutation = useMutation({
    mutationFn: (body: Parameters<typeof api.createStaffContract>[0]) => api.createStaffContract(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff-contracts'] });
      setIsCreating(false);
      setNewContract({
        staffId: '',
        contractNumber: '',
        position: '',
        startDateBs: formatBsDateForInput(new Date()),
        endDateBs: '',
        baseSalary: 0,
        allowances: 0,
        deductions: 0,
      });
      setFormError(null);
    },
    onError: (error) => {
      setFormError(
        error instanceof Error
          ? error.message
          : 'The contract could not be created. Review the dates and try again.',
      );
    },
  });

  const submitContract = () => {
    setFormError(null);
    try {
      const startDate = gregorianDateString(newContract.startDateBs);
      const endDate = newContract.endDateBs.trim()
        ? gregorianDateString(newContract.endDateBs)
        : undefined;
      createMutation.mutate({
        staffId: newContract.staffId,
        contractNumber: newContract.contractNumber.trim(),
        position: newContract.position.trim(),
        startDate,
        ...(endDate ? { endDate } : {}),
        baseSalary: newContract.baseSalary,
        allowances: newContract.allowances,
        deductions: newContract.deductions,
      });
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Enter valid BS contract dates.',
      );
    }
  };

  const contracts = contractsQuery.data?.items ?? [];
  const totalItems = contractsQuery.data?.total ?? 0;

  const contractColumns: PaginatedDataTableColumn<StaffContractRow>[] = [
    {
      id: 'contractNumber',
      header: 'Contract #',
      cell: (contract) => (
        <span className="font-mono text-xs font-bold text-slate-500">{contract.contractNumber}</span>
      ),
    },
    {
      id: 'position',
      header: 'Staff / Position',
      cell: (contract) => (
        <div>
          <p className="font-bold text-slate-900">{contract.position}</p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
            Starts {formatBsDate(contract.startDate)}
            {contract.endDate ? ` · Ends ${formatBsDate(contract.endDate)}` : ' · Open-ended'}
          </p>
        </div>
      ),
    },
    {
      id: 'baseSalary',
      header: 'Base Salary',
      cell: (contract) => (
        <span className="text-sm font-bold text-slate-900">
          {canViewPayrollAmounts ? moneyFormatter.format(Number(contract.baseSalary)) : 'Restricted'}
        </span>
      ),
    },
    {
      id: 'allowances',
      header: 'Allowances',
      cell: (contract) => (
        <span className="text-sm font-medium text-slate-500">
          {canViewPayrollAmounts ? moneyFormatter.format(Number(contract.allowances)) : 'Restricted'}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (contract) => (
        <span
          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tight ${
            contract.status === 'ACTIVE'
              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200/50'
              : 'bg-slate-100 text-slate-600 border border-slate-200/50'
          }`}
        >
          {contract.status}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input
            type="text"
            placeholder="Search contracts by number or position..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-11"
          />
        </div>
        {canCreateContracts ? (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 rounded-xl bg-[var(--color-mod-hr-accent)] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-[var(--color-mod-hr-text)] active:scale-[0.98]"
          >
            <Plus size={18} />
            New Contract
          </button>
        ) : null}
      </div>

      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm animate-in zoom-in-95 duration-300 sm:p-8">
            <h3 className="mb-6 text-xl font-black uppercase tracking-tight text-slate-900">Create Staff Contract</h3>
            
            <div className="grid gap-6">
              <FormField label="Staff Member">
                <Select
                  value={newContract.staffId}
                  onChange={(e) => setNewContract({ ...newContract, staffId: e.target.value })}
                >
                  <option value="">Select Staff...</option>
                  {(staffQuery.data ?? []).map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.firstName} {staff.lastName} ({staff.employeeId})
                    </option>
                  ))}
                </Select>
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Contract #">
                  <Input
                    type="text"
                    value={newContract.contractNumber}
                    onChange={(e) => setNewContract({ ...newContract, contractNumber: e.target.value })}
                  />
                </FormField>
                <BsDateField
                  label="Start date (BS)"
                  value={newContract.startDateBs}
                  onChange={(value) => setNewContract({ ...newContract, startDateBs: value })}
                  required
                />
              </div>

              <BsDateField
                label="End date (BS, optional)"
                value={newContract.endDateBs}
                onChange={(value) => setNewContract({ ...newContract, endDateBs: value })}
              />

              <FormField label="Position">
                <Input
                  type="text"
                  placeholder="e.g. Senior Teacher, Admin Assistant"
                  value={newContract.position}
                  onChange={(e) => setNewContract({ ...newContract, position: e.target.value })}
                />
              </FormField>

              <div className="grid grid-cols-3 gap-4">
                <FormField label="Base Salary">
                  <Input
                    type="number"
                    value={newContract.baseSalary}
                    onChange={(e) => setNewContract({ ...newContract, baseSalary: Number(e.target.value) })}
                  />
                </FormField>
                <FormField label="Allowances">
                  <Input
                    type="number"
                    value={newContract.allowances}
                    onChange={(e) => setNewContract({ ...newContract, allowances: Number(e.target.value) })}
                  />
                </FormField>
                <FormField label="Deductions">
                  <Input
                    type="number"
                    value={newContract.deductions}
                    onChange={(e) => setNewContract({ ...newContract, deductions: Number(e.target.value) })}
                  />
                </FormField>
              </div>

              {formError ? (
                <p className="text-sm font-semibold text-rose-700" role="alert">
                  {formError}
                </p>
              ) : null}

              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="flex-1 px-5 py-3 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!newContract.staffId || !newContract.contractNumber.trim() || !newContract.position.trim() || !newContract.startDateBs.trim() || createMutation.isPending}
                  onClick={submitContract}
                  className="flex-1 rounded-2xl bg-[var(--color-mod-hr-accent)] px-5 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-[var(--color-mod-hr-text)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Saving...' : 'Create Contract'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <PaginatedDataTable
        columns={contractColumns}
        items={contracts}
        getRowId={(contract) => contract.id}
        status={contractsQuery.isError ? 'error' : contractsQuery.isLoading ? 'loading' : 'ready'}
        page={page}
        pageSize={limit}
        totalItems={totalItems}
        onPageChange={setPage}
        onRetry={() => void contractsQuery.refetch()}
        errorMessage="Please retry. Your filters and page selection have been preserved."
        emptyTitle="No contracts yet"
        emptyDescription="Create a new contract to get started."
        hasActiveFilters={Boolean(search)}
        noResultsTitle="No matching contracts"
        noResultsDescription={`No results for "${search}"`}
      />
    </div>
  );
}

function gregorianDateString(value: string) {
  const gregorian = toGregorianDateFromBs(parseBsDateInput(value));
  return `${gregorian.year}-${String(gregorian.month).padStart(2, '0')}-${String(gregorian.day).padStart(2, '0')}`;
}
