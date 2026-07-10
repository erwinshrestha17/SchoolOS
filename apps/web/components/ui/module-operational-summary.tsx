'use client';

import type { OperationalSummaryRouteModule } from '@schoolos/core';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  OperationalSummaryError,
  OperationalSummaryLoading,
  OperationalSummaryPanel,
  RefreshSummaryButton,
} from './operational-summary';

export function ModuleOperationalSummary({
  module,
  compact = true,
}: {
  module: OperationalSummaryRouteModule;
  compact?: boolean;
}) {
  const summaryQuery = useQuery({
    queryKey: ['operational-module-summary', module],
    queryFn: () => api.getModuleSummary(module),
    staleTime: 30_000,
  });

  if (summaryQuery.isLoading) return <OperationalSummaryLoading />;
  if (summaryQuery.isError) {
    return <OperationalSummaryError onRetry={() => void summaryQuery.refetch()} />;
  }
  if (!summaryQuery.data) return null;

  return (
    <div className="mb-6">
      <OperationalSummaryPanel summary={summaryQuery.data} module={module} compact={compact} />
      <div className="mt-2 flex justify-end">
        <RefreshSummaryButton onClick={() => void summaryQuery.refetch()} />
      </div>
    </div>
  );
}
