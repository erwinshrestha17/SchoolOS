"use client";

import type { OperationalDashboardSummary } from "@schoolos/core";
import type { DashboardCompositionPersona } from "@/lib/dashboard-persona";
import { LatestSchoolActivityPanel } from "./dashboard-activity-panel";
import { DashboardAttentionPanel } from "./dashboard-attention-panel";
import { TodayOperationsPanel } from "./dashboard-operations-panel";
import { SchoolReadinessSection } from "./dashboard-readiness-section";
import { DashboardSummaryStrip } from "./dashboard-summary-strip";

/**
 * Shared dashboard grid used by Admin and Principal compositions. Persona
 * filtering happens before data reaches this layout so unauthorized modules
 * are not merely hidden after fetch.
 */
export function OperationalDashboardLayout({
  dashboard,
  persona,
}: {
  dashboard: OperationalDashboardSummary;
  persona: DashboardCompositionPersona;
}) {
  const moduleMap = new Map(
    dashboard.modules.map((module) => [module.module, module]),
  );

  return (
    <div className="space-y-6">
      <DashboardSummaryStrip
        dashboard={dashboard}
        moduleMap={moduleMap}
        persona={persona}
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 xl:col-start-1 xl:row-start-1">
          <DashboardAttentionPanel items={dashboard.attentionItems} />
        </div>
        <div className="min-w-0 xl:col-start-2 xl:row-start-1">
          <TodayOperationsPanel moduleMap={moduleMap} persona={persona} />
        </div>
        <div className="min-w-0 xl:col-start-1 xl:row-start-2">
          <SchoolReadinessSection moduleMap={moduleMap} persona={persona} />
        </div>
        <div className="min-w-0 xl:col-start-2 xl:row-start-2">
          <LatestSchoolActivityPanel items={dashboard.recentItems} />
        </div>
      </div>
    </div>
  );
}
