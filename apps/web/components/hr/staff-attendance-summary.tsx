'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { useState } from 'react';

export function StaffAttendanceSummary() {
  const [date, setDate] = useState(new Date());
  
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  const summaryQuery = useQuery({
    queryKey: ['staff-attendance-summary', month, year],
    queryFn: () => api.listStaffAttendanceSummary({ month, year }),
  });

  const nextMonth = () => setDate(new Date(year, month, 1));
  const prevMonth = () => setDate(new Date(year, month - 2, 1));

  const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(date);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-bold text-gray-900">{monthName} {year}</h3>
          <div className="flex items-center gap-1">
            <button 
              onClick={prevMonth}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <button 
              onClick={nextMonth}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
          <Filter size={16} />
          Filters
        </button>
      </div>

      <div className="shell-card overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 font-semibold text-gray-500">Staff Member</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-center">Present</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-center text-amber-600">Late</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-center text-danger-600">Absent</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-center text-primary-600">Leave</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-center">Approved Leave</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-center">Anomalies</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {summaryQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 w-32 bg-gray-100 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-8 mx-auto bg-gray-100 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-8 mx-auto bg-gray-100 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-8 mx-auto bg-gray-100 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-8 mx-auto bg-gray-100 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-8 mx-auto bg-gray-100 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-8 mx-auto bg-gray-100 rounded" /></td>
                  </tr>
                ))
              ) : summaryQuery.data?.items.length ? (
                summaryQuery.data.items.map((item) => (
                  <tr key={item.staffId} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-900">{item.fullName}</p>
                      <p className="text-[10px] text-gray-500 font-mono">{item.employeeId}</p>
                    </td>
                    <td className="px-6 py-4 text-center font-medium text-success-600">{item.presentDays}</td>
                    <td className="px-6 py-4 text-center font-medium text-amber-600">{item.lateDays}</td>
                    <td className="px-6 py-4 text-center font-medium text-danger-600">{item.absentDays}</td>
                    <td className="px-6 py-4 text-center font-medium text-primary-600">{item.leaveDays}</td>
                    <td className="px-6 py-4 text-center font-medium text-gray-700">{item.approvedLeaveDays}</td>
                    <td className="px-6 py-4 text-center font-medium">
                      {item.unresolvedOverlapAnomalies > 0 ? (
                        <span className="text-danger-600 bg-danger-50 px-2 py-0.5 rounded-full text-xs">
                          {item.unresolvedOverlapAnomalies}
                        </span>
                      ) : '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No attendance records for this period.
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
