"use client";

import {
  formatBsDateTime,
  type OperationalRecentItem,
  type OperationalSummaryModule,
} from "@schoolos/core";
import { cn } from "../../lib/utils";
import { SectionCard } from "../ui/section-card";
import {
  ACTIVITY_EVENT_LABELS,
  MODULE_DEFINITIONS,
} from "./dashboard-module-meta";

type DashboardRecentItem = OperationalRecentItem & {
  module: OperationalSummaryModule;
};

const MAX_ACTIVITY_ITEMS = 5;

/**
 * The single combined "Latest school activity" feed — the dashboard
 * summary's own permission-filtered recent items (which already include
 * notice delivery events), replacing the previous separate Recent Activity
 * and Recent Notices panels and their extra full-list fetch. A dedicated
 * "view complete activity" destination needs a cross-module activity route
 * (none exists yet), so no fake link is rendered.
 */
export function LatestSchoolActivityPanel({
  items,
}: {
  items: DashboardRecentItem[];
}) {
  const visibleItems = items.slice(0, MAX_ACTIVITY_ITEMS);

  return (
    <SectionCard
      title="Latest school activity"
      description="Recent permission-filtered events across the school."
      noPadding
    >
      {visibleItems.length ? (
        <ul className="divide-y divide-slate-100">
          {visibleItems.map((item) => {
            const definition = MODULE_DEFINITIONS[item.module];
            const Icon = definition.icon;
            return (
              <li key={item.id} className="flex gap-3 px-5 py-3 lg:px-6">
                <span
                  className={cn(
                    "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                    definition.accentClass,
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-5 text-slate-800">
                    {ACTIVITY_EVENT_LABELS[item.module] ?? item.label}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                    <span className="font-bold uppercase tracking-wide">
                      {definition.shortLabel}
                    </span>
                    <time dateTime={item.occurredAt}>
                      {formatRecentDate(item.occurredAt)}
                    </time>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="p-5 text-sm leading-6 text-slate-600 lg:p-6">
          No recent school activity is available yet.
        </p>
      )}
    </SectionCard>
  );
}

function formatRecentDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return formatBsDateTime(date);
}
