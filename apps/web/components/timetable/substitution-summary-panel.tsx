'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Metric, MetricGroup } from '@/components/schoolos';
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

  return (
    <MetricGroup>
      <Metric
        label="Absent teachers"
        value={summary.absentTeachers}
        icon={<UserMinus aria-hidden />}
        tone="warning"
      />
      <Metric
        label="Slots requiring cover"
        value={summary.slotsRequiringSubstitution}
        icon={<AlertCircle aria-hidden />}
        tone={summary.slotsRequiringSubstitution > 0 ? 'danger' : 'neutral'}
      />
      <Metric
        label="Assigned"
        value={summary.assignedSubstitutions}
        icon={<CheckCircle aria-hidden />}
        tone="success"
      />
      <Metric
        label="Pending"
        value={summary.pendingSubstitutions}
        icon={<Clock aria-hidden />}
        tone="module"
      />
    </MetricGroup>
  );
}
