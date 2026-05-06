'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { SectionCard } from '@/components/ui/section-card';
import { BarChart3, Clock, AlertTriangle } from 'lucide-react';

export function DefaulterAgingSummary() {
  const defaultersQuery = useQuery({
    queryKey: ['defaulters'],
    queryFn: () => api.listDefaulters(),
  });

  const defaulters = defaultersQuery.data || [];
  
  const buckets = {
    '1-30': 0,
    '31-60': 0,
    '61-90': 0,
    '90+': 0,
  };

  let totalOutstanding = 0;

  defaulters.forEach((d: any) => {
    const bucket = d.agingBucket as keyof typeof buckets;
    if (buckets[bucket] !== undefined) {
      buckets[bucket]++;
    } else {
      buckets['90+']++;
    }
    totalOutstanding += d.outstanding;
  });

  const bucketData = [
    { label: '1-30 Days', count: buckets['1-30'], color: 'bg-emerald-500' },
    { label: '31-60 Days', count: buckets['31-60'], color: 'bg-amber-500' },
    { label: '61-90 Days', count: buckets['61-90'], color: 'bg-orange-500' },
    { label: '90+ Days', count: buckets['90+'], color: 'bg-rose-500' },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-4 mb-6">
      {bucketData.map((b) => (
        <div key={b.label} className="p-5 bg-white rounded-[2rem] border border-slate-100 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-3">
            <div className={`h-8 w-8 rounded-xl ${b.color} bg-opacity-10 flex items-center justify-center`}>
              <Clock size={16} className={b.color.replace('bg-', 'text-')} />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{b.label}</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{b.count}</p>
          <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-tight">Defaulters</p>
        </div>
      ))}
    </div>
  );
}
