'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { LoadingState } from '@/components/ui/loading-state';
import { AlertCircle, UserMinus, CheckCircle, Clock } from 'lucide-react';

export function SubstitutionSummaryPanel({ date }: { date: string }) {
  const summaryQuery = useQuery({
    queryKey: ['substitution-summary', date],
    queryFn: () => api.getSubstitutionSummary({ date }),
  });

  if (summaryQuery.isLoading) return <LoadingState />;
  if (!summaryQuery.data) return null;

  const summary = summaryQuery.data;

  const stats = [
    {
      label: 'Absent Teachers',
      value: summary.absentTeachers,
      icon: UserMinus,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      label: 'Slots Requiring Sub',
      value: summary.slotsRequiringSubstitution,
      icon: AlertCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      label: 'Assigned',
      value: summary.assignedSubstitutions,
      icon: CheckCircle,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      label: 'Pending',
      value: summary.pendingSubstitutions,
      icon: Clock,
      color: 'text-[var(--color-mod-homework-text)]',
      bgColor: 'bg-[var(--color-mod-homework-bg)]',
    },
  ];

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="p-6 border-slate-200/60 shadow-sm rounded-2xl">
          <div className="flex items-center gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${stat.bgColor}`}>
              <stat.icon className={`h-6 w-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-tight text-slate-500">{stat.label}</p>
              <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
