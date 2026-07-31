"use client";

import type { OperationalDashboardSummary } from "@schoolos/core";
import { OperationalDashboardLayout } from "./operational-dashboard-layout";
import { projectDashboardForPersona } from "@/lib/dashboard-persona";

/**
 * @deprecated Prefer AdminDashboard, PrincipalDashboard, or
 * OperationalDashboardLayout with an explicit persona. Kept for compatibility
 * with tests and any legacy imports.
 */
export function DashboardCommandCenter({
  dashboard,
}: {
  dashboard: OperationalDashboardSummary;
}) {
  return (
    <OperationalDashboardLayout
      dashboard={projectDashboardForPersona(dashboard, "general")}
      persona="general"
    />
  );
}
