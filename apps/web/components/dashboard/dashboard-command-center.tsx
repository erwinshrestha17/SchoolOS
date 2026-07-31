"use client";

import type { OperationalDashboardSummary } from "@schoolos/core";
import { OperationalDashboardLayout } from "./operational-dashboard-layout";
import { projectDashboardForPersona } from "@/lib/dashboard-persona";

/**
 * @deprecated Prefer AdminDashboard, PrincipalDashboard, HrDashboard,
 * AccountantDashboard, or OperationalDashboardLayout with an explicit persona.
 */
export function DashboardCommandCenter({
  dashboard,
}: {
  dashboard: OperationalDashboardSummary;
}) {
  return (
    <OperationalDashboardLayout
      dashboard={projectDashboardForPersona(dashboard, "admin")}
      persona="admin"
    />
  );
}
