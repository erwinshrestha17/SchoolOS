"use client";

import type { OperationalDashboardSummary } from "@schoolos/core";
import { OperationalDashboardLayout } from "./operational-dashboard-layout";

/** Accountant finance operations dashboard composition. */
export function AccountantDashboard({
  dashboard,
}: {
  dashboard: OperationalDashboardSummary;
}) {
  return (
    <OperationalDashboardLayout dashboard={dashboard} persona="accountant" />
  );
}
