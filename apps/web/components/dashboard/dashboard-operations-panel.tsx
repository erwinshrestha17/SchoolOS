"use client";

import type {
  OperationalModuleSummary,
  OperationalSummaryModule,
} from "@schoolos/core";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { prioritizeByAttention } from "../../lib/dashboard/prioritize-by-attention";
import { cn } from "../../lib/utils";
import { SectionCard } from "../ui/section-card";
import {
  attendanceProgress,
  formatMoneyNpr,
  formatNumber,
  metricNumber,
  metricValue,
  MODULE_DEFINITIONS,
  moduleWorkspaceRoute,
} from "./dashboard-module-meta";

/**
 * The compact daily-operations rows. Fixed recommended order, but a module
 * whose backend attention items are burning floats to the top via the same
 * shared prioritizer the old card sections used — still no role guessing.
 */
const OPERATIONS_MODULES: OperationalSummaryModule[] = [
  "m2_attendance",
  "m3_fees",
  "m10_communications",
  "m8b_transport",
  "m6_homework_timetable",
  "m7_hr_payroll",
];

type RowTone = "ok" | "warn" | "muted";

type OperationsRowState = {
  text: string;
  tone: RowTone;
};

export function TodayOperationsPanel({
  moduleMap,
}: {
  moduleMap: Map<OperationalSummaryModule, OperationalModuleSummary>;
}) {
  // Locked (not enabled) modules are omitted entirely — a disabled module
  // gets no dashboard row; direct route access still shows the shared
  // ModuleLockedState. Permission-denied modules never reach the payload.
  const modules = prioritizeByAttention(
    OPERATIONS_MODULES.map((module) => moduleMap.get(module)).filter(
      (summary): summary is OperationalModuleSummary =>
        summary !== undefined && summary.status !== "locked",
    ),
  );

  return (
    <SectionCard
      title="Today’s operations"
      description="Where each daily workflow stands right now."
      noPadding
    >
      {modules.length ? (
        <ul className="divide-y divide-slate-100">
          {modules.map((summary) => (
            <li key={summary.module}>
              <OperationsRow summary={summary} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="p-5 text-sm leading-6 text-slate-600 lg:p-6">
          No operations summaries are available for your current access.
        </p>
      )}
    </SectionCard>
  );
}

const toneDotClass: Record<RowTone, string> = {
  ok: "bg-success-500",
  warn: "bg-warning-500",
  muted: "bg-slate-300",
};

function OperationsRow({ summary }: { summary: OperationalModuleSummary }) {
  const definition = MODULE_DEFINITIONS[summary.module];
  const Icon = definition.icon;
  const state = operationsRowState(summary);
  const href = moduleWorkspaceRoute(summary.module);

  const content = (
    <>
      <span
        className={cn(
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
          definition.accentClass,
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-900">
          {definition.shortLabel}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <span
            className={cn(
              "inline-flex h-1.5 w-1.5 shrink-0 rounded-full",
              toneDotClass[state.tone],
            )}
            aria-hidden="true"
          />
          <span className="truncate">{state.text}</span>
        </p>
        {summary.status === "partial" ? (
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            Some information is temporarily unavailable.
          </p>
        ) : null}
      </div>
      {href ? (
        <ArrowRight
          className="h-4 w-4 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-[var(--primary)]"
          aria-hidden="true"
        />
      ) : null}
    </>
  );

  const className =
    "group flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-soft)] focus-visible:ring-offset-2 lg:px-6";

  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

/**
 * One meaningful current state per module row, from that module's own
 * backend summary fields. Unavailable numbers say so; genuine zeros read as
 * "No open issue" — the two are never conflated.
 */
function operationsRowState(
  summary: OperationalModuleSummary,
): OperationsRowState {
  switch (summary.module) {
    case "m2_attendance": {
      const progress = attendanceProgress(summary);
      if (progress.kind === "unavailable") {
        return { text: "Information is not available yet.", tone: "muted" };
      }
      if (progress.kind === "notStarted") {
        return {
          text:
            progress.total !== null
              ? `Not started · 0 of ${formatNumber(progress.total)} registers submitted`
              : "Attendance has not started",
          tone: "warn",
        };
      }
      if (progress.kind === "completed") {
        return {
          text: `All ${formatNumber(progress.total)} registers submitted`,
          tone: "ok",
        };
      }
      return {
        text: `${formatNumber(progress.submitted)} of ${formatNumber(progress.total)} registers submitted`,
        tone: "warn",
      };
    }
    case "m3_fees": {
      const collected = metricValue(summary, "collectedTodayAmount");
      const overdue = metricNumber(summary, "overdueInvoices");
      if (collected === null) {
        return { text: "Information is not available yet.", tone: "muted" };
      }
      const collectedText = `${formatMoneyNpr(collected)} collected`;
      if (overdue === null) return { text: collectedText, tone: "ok" };
      return overdue > 0
        ? {
            text: `${collectedText} · ${formatNumber(overdue)} overdue invoice${overdue === 1 ? "" : "s"}`,
            tone: "warn",
          }
        : { text: `${collectedText} · No overdue invoices`, tone: "ok" };
    }
    case "m10_communications": {
      const failed = metricNumber(summary, "failedDeliveries");
      const scheduled = metricNumber(summary, "scheduledNotices");
      if (failed !== null && failed > 0) {
        return {
          text: `${formatNumber(failed)} notice deliver${failed === 1 ? "y" : "ies"} failed`,
          tone: "warn",
        };
      }
      if (scheduled !== null && scheduled > 0) {
        return {
          text: `${formatNumber(scheduled)} notice${scheduled === 1 ? "" : "s"} scheduled`,
          tone: "ok",
        };
      }
      if (failed === null && scheduled === null) {
        return { text: "Information is not available yet.", tone: "muted" };
      }
      return { text: "No open notice issue", tone: "ok" };
    }
    case "m8b_transport": {
      const delayed = metricNumber(summary, "delayedTrips");
      const stale = metricNumber(summary, "tripsWithStaleGps");
      const active = metricNumber(summary, "activeTripsToday");
      if (delayed !== null && delayed > 0) {
        return {
          text: `${formatNumber(delayed)} delayed trip${delayed === 1 ? "" : "s"}`,
          tone: "warn",
        };
      }
      if (stale !== null && stale > 0) {
        return {
          text: `${formatNumber(stale)} trip${stale === 1 ? "" : "s"} without a recent location update`,
          tone: "warn",
        };
      }
      if (active !== null && active > 0) {
        return {
          text: `No open issue · ${formatNumber(active)} active trip${active === 1 ? "" : "s"}`,
          tone: "ok",
        };
      }
      if (delayed === null && stale === null && active === null) {
        return { text: "Information is not available yet.", tone: "muted" };
      }
      return { text: "No open transport issue", tone: "ok" };
    }
    case "m6_homework_timetable": {
      const overdue = metricNumber(summary, "overdueHomework");
      const dueToday = metricNumber(summary, "homeworkDueToday");
      if (overdue !== null && overdue > 0) {
        return {
          text: `${formatNumber(overdue)} homework follow-up${overdue === 1 ? "" : "s"} overdue`,
          tone: "warn",
        };
      }
      if (dueToday !== null && dueToday > 0) {
        return {
          text: `${formatNumber(dueToday)} homework due today`,
          tone: "ok",
        };
      }
      if (overdue === null && dueToday === null) {
        return { text: "Information is not available yet.", tone: "muted" };
      }
      return { text: "No homework due today", tone: "ok" };
    }
    case "m7_hr_payroll": {
      const leaveRequests = metricNumber(summary, "pendingLeaveRequests");
      const anomalies = metricNumber(summary, "staffAttendanceAnomalies");
      if (leaveRequests !== null && leaveRequests > 0) {
        return {
          text: `${formatNumber(leaveRequests)} leave request${leaveRequests === 1 ? "" : "s"} waiting`,
          tone: "warn",
        };
      }
      if (anomalies !== null && anomalies > 0) {
        return {
          text: `${formatNumber(anomalies)} staff absent or late today`,
          tone: "warn",
        };
      }
      if (leaveRequests === null && anomalies === null) {
        return { text: "Information is not available yet.", tone: "muted" };
      }
      return { text: "No open staff issue", tone: "ok" };
    }
    default:
      return { text: "Information is not available yet.", tone: "muted" };
  }
}
