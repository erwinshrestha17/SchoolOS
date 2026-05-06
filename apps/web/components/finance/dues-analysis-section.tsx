'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { SectionCard } from '@/components/ui/section-card';
import { DataTable } from '@/components/ui/data-table';
import { FilterBar } from '@/components/ui/filter-bar';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';

export function DuesAnalysisSection() {
  const [filters, setFilters] = useState<any>({});

  const duesQuery = useQuery({
    queryKey: ['dues-report', filters],
    queryFn: () => api.getDuesTableReport(filters),
  });

  const columns = [
    { header: 'Student', accessorKey: 'studentName' },
    { header: 'Class', accessorKey: 'className' },
    { header: 'Fee Head', accessorKey: 'feeHead' },
    {
      header: 'Billed',
      accessorKey: 'billed',
      cell: (v: any) => `Rs. ${v.toLocaleString()}`,
    },
    {
      header: 'Waived',
      accessorKey: 'waived',
      cell: (v: any) => `Rs. ${v.toLocaleString()}`,
    },
    {
      header: 'Outstanding',
      accessorKey: 'outstanding',
      cell: (v: any) => (
        <span className="font-bold text-red-600">
          Rs. {v.toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Due Date',
      accessorKey: 'dueDate',
      cell: (v: any) => new Date(v).toLocaleDateString(),
    },
  ];

  return (
    <SectionCard
      title="Dues Analysis"
      description="Detailed breakdown of outstanding fees across all students and heads."
      headerAction={
        <button
          onClick={() => api.downloadReport('dues-table-report', { format: 'csv', filters })}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Export CSV
        </button>
      }
    >
      <div className="space-y-6">
        <FilterBar label="Dues Filters">
          <select 
            className="text-sm bg-white border-slate-200 rounded-xl px-4 py-2 min-w-[150px]"
            onChange={(e) => setFilters({ ...filters, classId: e.target.value })}
          >
            <option value="">All Classes</option>
            {/* Options would be mapped here */}
          </select>
          <select 
            className="text-sm bg-white border-slate-200 rounded-xl px-4 py-2 min-w-[150px]"
            onChange={(e) => setFilters({ ...filters, feeHeadId: e.target.value })}
          >
            <option value="">All Fee Heads</option>
            {/* Options would be mapped here */}
          </select>
        </FilterBar>

        <DataTable
          columns={columns}
          data={duesQuery.data?.rows || []}
          isLoading={duesQuery.isLoading}
        />

        {duesQuery.data?.summary && (
          <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Total Billed</p>
              <p className="text-lg font-bold text-slate-900">
                Rs. {duesQuery.data.summary.totalBilled.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Total Waived</p>
              <p className="text-lg font-bold text-slate-900">
                Rs. {duesQuery.data.summary.totalWaived.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Net Outstanding</p>
              <p className="text-lg font-bold text-red-600">
                Rs. {duesQuery.data.summary.totalOutstanding.toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
