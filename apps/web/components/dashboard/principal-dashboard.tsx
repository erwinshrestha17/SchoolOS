'use client';

import type { OperationalDashboardSummary } from '@schoolos/core';
import { OperationalDashboardLayout } from './operational-dashboard-layout';
import { PrincipalDecisionsPanel } from './principal-decisions-panel';

/**
 * Principal oversight dashboard composition (Phase 4D): decisions that are
 * genuinely the Principal's (SoD-filtered server queue, with age), then the
 * leadership-safe operations summary.
 */
export function PrincipalDashboard({
  dashboard,
}: {
  dashboard: OperationalDashboardSummary;
}) {
  return (
    <div className="space-y-6">
      <PrincipalDecisionsPanel />
      <OperationalDashboardLayout dashboard={dashboard} persona="principal" />
    </div>
  );
}
