"use client";

import type {
  OperationalDashboardSummary,
  OperationalModuleSummary,
  OperationalSummaryModule,
} from "@schoolos/core";
import { LatestSchoolActivityPanel } from "./dashboard-activity-panel";
import { DashboardAttentionPanel } from "./dashboard-attention-panel";
import { TodayOperationsPanel } from "./dashboard-operations-panel";
import { SchoolReadinessSection } from "./dashboard-readiness-section";
import { DashboardSummaryStrip } from "./dashboard-summary-strip";

/**
 * The school operating homepage. One bounded, permission-filtered backend
 * summary drives everything: a compact four-card strip, the attention
 * queue, compact daily-operation rows, three readiness panels, and one
 * combined activity feed. Sections read their own slice of the payload and
 * degrade independently — a module the session cannot see is omitted or
 * marked unavailable, never faked, so the same layout stays honest for
 * non-Principal roles whose payload the backend already scopes down.
 */
export function DashboardCommandCenter({
  dashboard,
}: {
  dashboard: OperationalDashboardSummary;
}) {
  const moduleMap = new Map<OperationalSummaryModule, OperationalModuleSummary>(
    dashboard.modules.map((module) => [module.module, module]),
  );

  return (
    <div className="space-y-6">
      <DashboardSummaryStrip dashboard={dashboard} moduleMap={moduleMap} />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 xl:col-start-1 xl:row-start-1">
          <DashboardAttentionPanel items={dashboard.attentionItems} />
        </div>
        <div className="min-w-0 xl:col-start-2 xl:row-start-1">
          <TodayOperationsPanel moduleMap={moduleMap} />
        </div>
        <div className="min-w-0 xl:col-start-1 xl:row-start-2">
          <SchoolReadinessSection moduleMap={moduleMap} />
        </div>
        <div className="min-w-0 xl:col-start-2 xl:row-start-2">
          <LatestSchoolActivityPanel items={dashboard.recentItems} />
        </div>
      </div>
    </div>
  );
}
