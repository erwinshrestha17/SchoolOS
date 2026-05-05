'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { FileText, Plus, Search } from 'lucide-react';
import { useState } from 'react';

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
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search contracts by number or position..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
          />
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors shadow-sm shadow-primary-500/20"
        >
          <Plus size={18} />
          New Contract
        </button>
      </div>

      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-100 p-8 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Create New Staff Contract</h3>
            
            <div className="grid gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5 ml-1">Staff Member</label>
                <select
                  value={newContract.staffId}
                  onChange={(e) => setNewContract({ ...newContract, staffId: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                >
                  <option value="">Select Staff...</option>
                  {(staffQuery.data ?? []).map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.firstName} {staff.lastName} ({staff.employeeId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5 ml-1">Contract #</label>
                  <input
                    type="text"
                    value={newContract.contractNumber}
                    onChange={(e) => setNewContract({ ...newContract, contractNumber: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5 ml-1">Start Date</label>
                  <input
                    type="date"
                    value={newContract.startDate}
                    onChange={(e) => setNewContract({ ...newContract, startDate: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5 ml-1">Position</label>
                <input
                  type="text"
                  placeholder="e.g. Senior Teacher, Admin Assistant"
                  value={newContract.position}
                  onChange={(e) => setNewContract({ ...newContract, position: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5 ml-1">Base Salary</label>
                  <input
                    type="number"
                    value={newContract.baseSalary}
                    onChange={(e) => setNewContract({ ...newContract, baseSalary: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5 ml-1">Allowances</label>
                  <input
                    type="number"
                    value={newContract.allowances}
                    onChange={(e) => setNewContract({ ...newContract, allowances: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5 ml-1">Deductions</label>
                  <input
                    type="number"
                    value={newContract.deductions}
                    onChange={(e) => setNewContract({ ...newContract, deductions: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
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
                  className="flex-1 px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-primary-500/20"
                >
                  {createMutation.isPending ? 'Saving...' : 'Create Contract'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="shell-card overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Contract #</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Staff / Position</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Base Salary</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Allowances</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {contractsQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 w-24 bg-gray-100 rounded" /></td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <div className="h-4 w-32 bg-gray-100 rounded" />
                        <div className="h-3 w-24 bg-gray-100 rounded" />
                      </div>
                    </td>
                    <td className="px-6 py-4"><div className="h-4 w-20 bg-gray-100 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-16 bg-gray-100 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-6 w-16 bg-gray-100 rounded-full" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-12 ml-auto bg-gray-100 rounded" /></td>
                  </tr>
                ))
              ) : filteredContracts.length > 0 ? (
                filteredContracts.map((contract) => (
                  <tr key={contract.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-sm text-gray-600">{contract.contractNumber}</td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-gray-900">{contract.position}</p>
                        <p className="text-xs text-gray-500">ID: {contract.staffId.slice(0, 8)}...</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {moneyFormatter.format(contract.baseSalary)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {moneyFormatter.format(contract.allowances)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight ${
                        contract.status === 'ACTIVE' 
                          ? 'bg-success-100 text-success-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {contract.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-primary-600 hover:text-primary-700 font-medium text-sm">Edit</button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No contracts found.
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
