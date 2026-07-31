"use client";

import type { OperationalDashboardSummary } from "@schoolos/core";
import { OperationalDashboardLayout } from "./operational-dashboard-layout";

/** Principal oversight dashboard composition. */
export function PrincipalDashboard({
  dashboard,
}: {
  dashboard: OperationalDashboardSummary;
}) {
  return (
    <OperationalDashboardLayout dashboard={dashboard} persona="principal" />
  );
}
