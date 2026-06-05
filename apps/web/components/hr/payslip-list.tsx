'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Download, Search } from 'lucide-react';
import { useState } from 'react';

export function PayslipList() {
  const [search, setSearch] = useState('');
  const { data: payslips, isLoading, error } = useQuery({
    queryKey: ['payslips'],
    queryFn: api.listPayslips,
  });

  const filteredPayslips = payslips?.filter(p => 
    p.payslipNumber.toLowerCase().includes(search.toLowerCase()) ||
    p.staff?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    p.staff?.employeeId?.toLowerCase().includes(search.toLowerCase())
  );

  const moneyFormatter = new Intl.NumberFormat('en-NP', {
    style: 'currency',
    currency: 'NPR',
    maximumFractionDigits: 0,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search payslips by number or staff..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 py-3 pl-11 pr-4 text-sm transition-all focus:border-[var(--color-mod-hr-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-hr-border)]/50"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200">
                <th className="px-6 py-4 font-bold text-slate-600">Payslip #</th>
                <th className="px-6 py-4 font-bold text-slate-600">Staff</th>
                <th className="px-6 py-4 font-bold text-slate-600">Period</th>
                <th className="px-6 py-4 font-bold text-slate-600 text-right">Net Amount</th>
                <th className="px-6 py-4 font-bold text-slate-600 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 w-24 bg-slate-100 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-32 bg-slate-100 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-20 bg-slate-100 rounded" /></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 w-20 bg-slate-100 rounded ml-auto" /></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 w-16 bg-slate-100 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-rose-500 font-medium">
                    Failed to load payslips. Please check your permissions.
                  </td>
                </tr>
              ) : filteredPayslips?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No payslips found.
                  </td>
                </tr>
              ) : (
                filteredPayslips?.map((payslip) => (
                  <tr key={payslip.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-[var(--color-mod-hr-text)]">
                      {payslip.payslipNumber}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900">{payslip.staff?.fullName}</p>
                      <p className="text-xs text-slate-500">{payslip.staff?.employeeId}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {payslip.periodMonth}/{payslip.periodYear}
                    </td>
                    <td className="px-6 py-4 text-right font-black text-slate-900">
                      {moneyFormatter.format(payslip.netAmount ?? 0)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => api.openPayslipPdf(payslip.payslipNumber)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 transition-all hover:bg-[var(--color-mod-hr-soft)] hover:text-[var(--color-mod-hr-text)]"
                      >
                        <Download size={14} />
                        PDF
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
