"use client";

import type { OperationalDashboardSummary } from "@schoolos/core";
import { OperationalDashboardLayout } from "./operational-dashboard-layout";

/** HR operations dashboard composition. */
export function HrDashboard({
  dashboard,
}: {
  dashboard: OperationalDashboardSummary;
}) {
  return <OperationalDashboardLayout dashboard={dashboard} persona="hr" />;
}
