'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { FileText, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { FormField } from '../ui/form-field';
import { LoadingState } from '../ui/loading-state';
import { EmptyState } from '../ui/empty-state';

const moneyFormatter = new Intl.NumberFormat('en-NP', {
  style: 'currency',
  currency: 'NPR',
  maximumFractionDigits: 0,
});

export function ContractList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  
  const contractsQuery = useQuery({
    queryKey: ['staff-contracts'],
    queryFn: api.listStaffContracts,
  });

  const [isCreating, setIsCreating] = useState(false);
  const [newContract, setNewContract] = useState({
    staffId: '',
    contractNumber: `CTR-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
    position: '',
    startDate: new Date().toISOString().split('T')[0],
    baseSalary: 0,
    allowances: 0,
    deductions: 0,
  });

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
        contractNumber: `CTR-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        position: '',
        startDate: new Date().toISOString().split('T')[0],
        baseSalary: 0,
        allowances: 0,
        deductions: 0,
      });
    },
  });

  const filteredContracts = (contractsQuery.data ?? []).filter((c) =>
    `${c.contractNumber} ${c.position}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input
            type="text"
            placeholder="Search contracts by number or position..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-11"
          />
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl font-bold text-sm shadow-sm hover:bg-primary-700 transition-all hover:shadow-md active:scale-[0.98]"
        >
          <Plus size={18} />
          New Contract
        </button>
      </div>

      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl border border-slate-200/50 p-8 animate-in zoom-in-95 duration-300">
            <h3 className="text-2xl font-black text-slate-900 mb-6">Create Staff Contract</h3>
            
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
                <FormField label="Start Date">
                  <Input
                    type="date"
                    value={newContract.startDate}
                    onChange={(e) => setNewContract({ ...newContract, startDate: e.target.value })}
                  />
                </FormField>
              </div>

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
                  disabled={!newContract.staffId || !newContract.position || createMutation.isPending}
                  onClick={() => createMutation.mutate({
                    ...newContract,
                    startDate: new Date(newContract.startDate).toISOString(),
                  })}
                  className="flex-1 px-5 py-3 rounded-2xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-slate-900/10"
                >
                  {createMutation.isPending ? 'Saving...' : 'Create Contract'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="shell-card overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">Contract #</th>
                <th className="px-6 py-4 text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">Staff / Position</th>
                <th className="px-6 py-4 text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">Base Salary</th>
                <th className="px-6 py-4 text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">Allowances</th>
                <th className="px-6 py-4 text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">Status</th>
                <th className="px-6 py-4 text-[0.65rem] font-bold uppercase tracking-wider text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {contractsQuery.isLoading ? (
                <tr>
                  <td colSpan={6} className="p-0">
                    <LoadingState variant="spinner" label="Loading contracts..." />
                  </td>
                </tr>
              ) : filteredContracts.length > 0 ? (
                filteredContracts.map((contract) => (
                  <tr key={contract.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 font-mono text-xs font-bold text-slate-500">{contract.contractNumber}</td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-bold text-slate-900">{contract.position}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">ID: {contract.staffId.slice(0, 8)}...</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">
                      {moneyFormatter.format(contract.baseSalary)}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-500">
                      {moneyFormatter.format(contract.allowances)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tight ${
                        contract.status === 'ACTIVE' 
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200/50' 
                          : 'bg-slate-100 text-slate-600 border border-slate-200/50'
                      }`}>
                        {contract.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-primary-600 hover:text-primary-700 font-bold text-sm transition-colors">Edit</button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-0">
                    <EmptyState 
                      title="No contracts found" 
                      description={search ? `No results for "${search}"` : "Create a new contract to get started."}
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
