'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Calculator, AlertTriangle, Loader2 } from 'lucide-react';
import type { PayrollPreviewResult } from '@schoolos/core';

export function PayrollPreview() {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [workingDays, setWorkingDays] = useState(30);

  const previewQuery = useQuery({
    queryKey: ['payroll-preview', year, month, workingDays],
    queryFn: () => api.getPayrollPreview({ year, month, workingDays }),
  });

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid gap-1.5">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Year</label>
            <div className="px-3 py-2 rounded-xl border border-gray-200 bg-white">
              <select 
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="text-sm font-semibold text-gray-700 focus:outline-none bg-transparent min-w-[100px]"
              >
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Month</label>
            <div className="px-3 py-2 rounded-xl border border-gray-200 bg-white">
              <select 
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="text-sm font-semibold text-gray-700 focus:outline-none bg-transparent min-w-[140px]"
              >
                {months.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Working Days</label>
            <div className="px-3 py-2 rounded-xl border border-gray-200 bg-white">
              <input
                type="number"
                min={1}
                max={31}
                value={workingDays}
                onChange={(e) => setWorkingDays(Number(e.target.value))}
                className="text-sm font-semibold text-gray-700 focus:outline-none bg-transparent w-16"
              />
            </div>
          </div>
        </div>

        <button 
          onClick={() => previewQuery.refetch()}
          disabled={previewQuery.isLoading}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-xl font-bold shadow-lg shadow-primary-500/20 hover:bg-primary-700 transition-all disabled:opacity-50"
        >
          {previewQuery.isLoading ? <Loader2 size={18} className="animate-spin" /> : <Calculator size={18} />}
          Calculate Preview
        </button>
      </div>

      {/* Warning Notice */}
      <div className="flex items-start gap-4 p-4 bg-amber-50 rounded-2xl border border-amber-100">
        <div className="p-2 bg-white rounded-lg shadow-sm">
          <AlertTriangle className="text-amber-600" size={20} />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-bold text-amber-900">Preview Only</p>
          <p className="text-xs text-amber-800 leading-relaxed">
            This is a draft payroll calculation for informational purposes. No accounting entries, salary slips, 
            or payroll runs are created from this screen. To process payroll, go to the <strong>Payroll Approval</strong> workflow.
          </p>
        </div>
      </div>

      {/* Breakdown Table */}
      <div className="shell-card overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Payroll Breakdown</h3>
            <p className="text-xs text-gray-500">Calculated draft for {months.find(m => m.value === month)?.label} {year}</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-wider">
            Draft Preview
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 font-semibold text-gray-500">Staff Member</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-right">Base Salary</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-right">Allowances</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-right">Gross Pay</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-center">Days (P+L/W)</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-right">Deductions</th>
                <th className="px-6 py-4 font-semibold text-primary-600 text-right">Net Preview Pay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {previewQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 w-32 bg-gray-100 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-16 ml-auto bg-gray-100 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-16 ml-auto bg-gray-100 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-16 ml-auto bg-gray-100 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-12 mx-auto bg-gray-100 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-16 ml-auto bg-gray-100 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-20 ml-auto bg-gray-100 rounded" /></td>
                  </tr>
                ))
              ) : previewQuery.error ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-danger-600">
                    Failed to load payroll preview. Please check your connection or permissions.
                  </td>
                </tr>
              ) : (previewQuery.data ?? []).length > 0 ? (
                (previewQuery.data as PayrollPreviewResult[]).map((row) => (
                  <tr key={row.staffId} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-900">{row.fullName}</p>
                      <p className="text-[10px] text-gray-500 font-mono">{row.employeeId}</p>
                      {row.warnings.length > 0 && (
                        <div className="mt-1 flex flex-col gap-0.5">
                          {row.warnings.map((w, i) => (
                            <span key={i} className="text-[9px] text-amber-600 font-medium flex items-center gap-1">
                              <AlertTriangle size={10} /> {w}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600 font-mono">
                      {row.baseSalary.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600 font-mono">
                      {row.allowances.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-gray-900 font-mono">
                      {row.grossPay.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-bold text-gray-700">{row.presentDays + row.approvedPaidLeaveDays}/{row.workingDays}</span>
                        <div className="flex gap-1 mt-1">
                          <span className="px-1.5 py-0.5 rounded bg-success-50 text-success-700 text-[9px] font-bold">{row.presentDays}P</span>
                          {row.approvedPaidLeaveDays > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-primary-50 text-primary-700 text-[9px] font-bold">{row.approvedPaidLeaveDays}L</span>
                          )}
                          {row.unpaidLeaveDays > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-danger-50 text-danger-700 text-[9px] font-bold">{row.unpaidLeaveDays}U</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-danger-600 font-mono">
                      -{row.deductions.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-lg font-bold text-primary-700 font-mono">
                        {row.netPay.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500 italic">
                    No payroll data found for the selected period.
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
