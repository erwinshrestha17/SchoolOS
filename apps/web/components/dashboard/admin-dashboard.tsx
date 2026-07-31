"use client";

import type { OperationalDashboardSummary } from "@schoolos/core";
import { OperationalDashboardLayout } from "./operational-dashboard-layout";

/** Admin operational execution dashboard composition. */
export function AdminDashboard({
  dashboard,
}: {
  dashboard: OperationalDashboardSummary;
}) {
  return <OperationalDashboardLayout dashboard={dashboard} persona="admin" />;
}
