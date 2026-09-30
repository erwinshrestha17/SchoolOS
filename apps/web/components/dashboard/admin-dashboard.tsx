'use client';

import type { OperationalDashboardSummary } from '@schoolos/core';
import { OperationalDashboardLayout } from './operational-dashboard-layout';
import { SetupBlockersPanel } from './setup-blockers-panel';

/**
 * Admin operational execution dashboard composition (Phase 4B): setup
 * blockers first, then the permission-filtered operations summary. A
 * configuration-only role (e.g. the School Access Owner) receives no
 * operational modules and sees only what it can act on.
 */
export function AdminDashboard({
  dashboard,
}: {
  dashboard: OperationalDashboardSummary;
}) {
  return (
    <div className="space-y-6">
      <SetupBlockersPanel />
      {dashboard.modules.length > 0 ? (
        <OperationalDashboardLayout dashboard={dashboard} persona="admin" />
      ) : (
        <p className="rounded-surface border border-slate-200 bg-white p-gutter-compact text-sm text-slate-600">
          Your role manages school configuration. Daily operational summaries
          (attendance, fees, admissions) are shown to the staff who run them.
        </p>
      )}
    </div>
  );
}
