'use client';

import type { ReactNode } from 'react';
import type { OperationalSummaryRouteModule } from '@schoolos/core';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ErrorState } from './error-state';
import { LoadingState } from './loading-state';
import { ModuleLockedState } from './module-locked-state';
import { PermissionDenied } from './permission-denied';
import {
  SummaryCard,
  SummaryGrid,
  type SummaryTone,
} from './summary-card';

export type OperationalSummaryCardDefinition = {
  key: string;
  label: string;
  description?: string;
  href?: string;
  icon?: ReactNode;
  tone?: SummaryTone;
};

export function OperationalSummaryGrid({
  module,
  moduleName,
  cards,
}: {
  module: OperationalSummaryRouteModule;
  moduleName: string;
  cards: OperationalSummaryCardDefinition[];
}) {
  const summaryQuery = useQuery({
    queryKey: ['operational-module-summary', module],
    queryFn: () => api.getModuleSummary(module),
    staleTime: 30_000,
  });

  if (summaryQuery.isLoading) {
    return <LoadingState variant="skeleton" label={`Loading ${moduleName} summary...`} />;
  }
  if (summaryQuery.isError) {
    return (
      <ErrorState
        title={`${moduleName} summary unavailable`}
        message="The operational workspace is still available. Retry to load its backend-owned summary."
        onRetry={() => void summaryQuery.refetch()}
      />
    );
  }

  const summary = summaryQuery.data;
  if (!summary) return null;
  if (summary.status === 'locked') {
    return <ModuleLockedState moduleName={moduleName} />;
  }
  if (summary.status === 'permissionDenied') {
    return (
      <PermissionDenied
        title="Summary access restricted"
        description={`You do not have permission to view the ${moduleName} operational summary.`}
        showNavigation={false}
      />
    );
  }

  const visibleCards = cards
    .filter((card) => Object.prototype.hasOwnProperty.call(summary.summary, card.key))
    .slice(0, 4);

  if (visibleCards.length === 0) return null;

  return (
    <SummaryGrid>
      {visibleCards.map((card) => (
        <SummaryCard
          key={card.key}
          label={card.label}
          value={summary.summary[card.key] ?? 'Unavailable'}
          description={card.description}
          href={card.href}
          icon={card.icon}
          tone={card.tone}
        />
      ))}
    </SummaryGrid>
  );
}
