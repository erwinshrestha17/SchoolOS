'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { SectionCard } from '@/components/ui/section-card';
import { DataTable } from '@/components/ui/data-table';
import { FilterBar } from '@/components/ui/filter-bar';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, Filter, Search, BarChart2, PieChart } from 'lucide-react';
import { cn } from '@/lib/utils';

export function DuesAnalysisSection() {
  const [filters, setFilters] = useState<any>({});

  const duesQuery = useQuery({
    queryKey: ['dues-report', filters],
    queryFn: () => api.getDuesTableReport(filters),
  });

  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: api.listClasses,
  });

  const feeHeadsQuery = useQuery({
    queryKey: ['fee-heads'],
    queryFn: api.listFeeHeads,
  });

  const columns = [
    { 
      header: 'Student Information', 
      cell: (row: any) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-900">{row.studentName}</span>
          <span className="text-[0.65rem] text-slate-500 uppercase tracking-widest font-bold">
            {row.className} {row.sectionName ? `• ${row.sectionName}` : ''}
          </span>
        </div>
      )
    },
    { 
      header: 'Fee Head', 
      cell: (row: any) => (
        <Badge variant="info" className="h-6 font-bold uppercase tracking-tighter text-[0.65rem]">
          {row.feeHead}
        </Badge>
      )
    },
    {
      header: 'Financials',
      cell: (row: any) => (
        <div className="flex flex-col">
           <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-slate-400 font-medium">Billed:</span>
              <span className="font-bold text-slate-900">Rs. {row.billed.toLocaleString()}</span>
           </div>
           {row.waived > 0 && (
             <div className="flex items-center justify-between gap-4 text-[0.65rem] text-emerald-600 font-bold">
                <span>Waived:</span>
                <span>- Rs. {row.waived.toLocaleString()}</span>
             </div>
           )}
        </div>
      ),
    },
    {
      header: 'Outstanding',
      cell: (row: any) => (
        <div className="text-right">
          <span className="text-sm font-black text-danger-600 tabular-nums">
            Rs. {row.outstanding.toLocaleString()}
          </span>
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (row: any) => {
        const isOverdue = new Date(row.dueDate) < new Date() && row.outstanding > 0;
        return (
          <div className="flex flex-col items-end">
            <Badge variant={isOverdue ? 'destructive' : 'warning'} className="h-5">
              {isOverdue ? 'Overdue' : 'Due Soon'}
            </Badge>
            <span className="text-[0.6rem] text-slate-400 font-bold mt-1 uppercase tracking-widest">
              By {new Date(row.dueDate).toLocaleDateString()}
            </span>
          </div>
        );
      }
    },
  ];

  return (
    <SectionCard
      title="Dues Analysis"
      description="Micro-level breakdown of outstanding fees for operational follow-up."
      headerAction={
        <div className="flex items-center gap-2">
          <button
            onClick={() => api.downloadReport('dues-table-report', { format: 'csv', filters })}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-600 hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
          >
            <Download size={14} />
            Export Dues
          </button>
        </div>
      }
    >
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
              <div className="space-y-2">
                <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest ml-2">Class Filter</label>
                <select 
                  className="premium-input bg-white h-12"
                  onChange={(e) => setFilters({ ...filters, classId: e.target.value })}
                >
                  <option value="">All Classes</option>
                  {classesQuery.data?.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest ml-2">Fee Head Filter</label>
                <select 
                  className="premium-input bg-white h-12"
                  onChange={(e) => setFilters({ ...filters, feeHeadId: e.target.value })}
                >
                  <option value="">All Fee Heads</option>
                  {feeHeadsQuery.data?.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
           </div>
           
           <div className="flex gap-2">
              <button className="h-12 w-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors">
                 <BarChart2 size={20} />
              </button>
              <button className="h-12 w-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors">
                 <PieChart size={20} />
              </button>
           </div>
        </div>

        <div className="relative rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm bg-white">
          <DataTable
            columns={columns}
            data={duesQuery.data?.rows || []}
            isLoading={duesQuery.isLoading}
            emptyMessage="Excellent! No outstanding dues found for these filters."
          />
        </div>

        {duesQuery.data?.summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SummaryStat label="Gross Billing" value={duesQuery.data.summary.totalBilled} />
            <SummaryStat label="Waivers Applied" value={duesQuery.data.summary.totalWaived} color="text-emerald-600" />
            <SummaryStat label="Net Outstanding" value={duesQuery.data.summary.totalOutstanding} color="text-danger-600" isMain />
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function SummaryStat({ label, value, color = "text-slate-900", isMain = false }: { label: string; value: number; color?: string; isMain?: boolean }) {
  return (
    <div className={cn(
      "p-6 rounded-[2rem] border transition-all",
      isMain ? "bg-slate-900 border-slate-900 shadow-xl shadow-slate-900/10" : "bg-white border-slate-100"
    )}>
      <p className={cn("text-[0.6rem] font-black uppercase tracking-[0.2em] mb-2", isMain ? "text-slate-400" : "text-slate-500")}>
        {label}
      </p>
      <div className="flex items-baseline gap-1">
        <span className={cn("text-[0.65rem] font-bold uppercase", isMain ? "text-slate-500" : "text-slate-400")}>NPR</span>
        <p className={cn("text-2xl font-black tracking-tighter", isMain ? "text-white" : color)}>
          {value.toLocaleString()}
        </p>
      </div>
    </div>
  );
}
