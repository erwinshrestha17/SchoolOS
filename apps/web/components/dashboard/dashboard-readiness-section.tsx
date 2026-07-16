"use client";

import type {
  OperationalModuleSummary,
  OperationalSummaryModule,
} from "@schoolos/core";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { cn } from "../../lib/utils";
import {
  formatMoneyNpr,
  formatNumber,
  metricNumber,
  metricValue,
  safeRoute,
} from "./dashboard-module-meta";

const MAX_ROWS_PER_PANEL = 4;

type ReadinessRow = {
  key: string;
  label: string;
  count: number;
  href: string | null;
};

type ReadinessRowDefinition = {
  module: OperationalSummaryModule;
  metricKey: string;
  label: (count: number) => string;
  route: string;
};

type ReadinessPanelDefinition = {
  key: string;
  title: string;
  emptyMessage: string;
  rows: ReadinessRowDefinition[];
};

/**
 * Three bounded readiness panels below the first viewport. Rows appear only
 * when the backend reports a real non-zero exception; a panel whose modules
 * are all clean says so instead of decorating the page with zeros, and a
 * panel whose modules the session cannot see says that instead of hiding
 * the gap.
 */
const READINESS_PANELS: ReadinessPanelDefinition[] = [
  {
    key: "academic",
    title: "Academic readiness",
    emptyMessage: "No academic blockers reported.",
    rows: [
      {
        module: "m4_academics",
        metricKey: "pendingMarkLocks",
        label: (count) =>
          `${formatNumber(count)} mark lock request${count === 1 ? "" : "s"} awaiting review`,
        route: "/dashboard/academics/marks",
      },
      {
        module: "m4_academics",
        metricKey: "reportCardPublishBlockers",
        label: (count) =>
          `${formatNumber(count)} report card${count === 1 ? "" : "s"} not yet published`,
        route: "/dashboard/academics/report-cards",
      },
      {
        module: "m6_homework_timetable",
        metricKey: "unassignedSubstitutionsToday",
        label: (count) =>
          `${formatNumber(count)} substitution${count === 1 ? "" : "s"} without a teacher today`,
        route: "/dashboard/timetable/substitutions",
      },
      {
        module: "m6_homework_timetable",
        metricKey: "overdueHomework",
        label: (count) =>
          `${formatNumber(count)} homework follow-up${count === 1 ? "" : "s"} past the due date`,
        route: "/dashboard/homework",
      },
      {
        module: "m4_academics",
        metricKey: "examSlotsToday",
        label: (count) =>
          `${formatNumber(count)} exam period${count === 1 ? "" : "s"} scheduled today`,
        route: "/dashboard/academics",
      },
    ],
  },
  {
    key: "finance",
    title: "Finance readiness",
    emptyMessage: "No open finance exceptions.",
    rows: [
      {
        module: "m3_fees",
        metricKey: "overdueInvoices",
        label: (count) =>
          `${formatNumber(count)} overdue invoice${count === 1 ? "" : "s"} to follow up`,
        route: "/dashboard/fees/invoices",
      },
      {
        module: "m3_fees",
        metricKey: "cashierVarianceRisks",
        label: (count) =>
          `${formatNumber(count)} cashier close${count === 1 ? "" : "s"} with a variance`,
        route: "/dashboard/fees/cashier-close",
      },
      {
        module: "m3_fees",
        metricKey: "refundsToday",
        label: (count) =>
          `${formatNumber(count)} refund${count === 1 ? "" : "s"} recorded today`,
        route: "/dashboard/fees/adjustments",
      },
      {
        module: "m9_accounting",
        metricKey: "unreconciledStatements",
        label: (count) =>
          `${formatNumber(count)} bank statement${count === 1 ? "" : "s"} to reconcile`,
        route: "/dashboard/accounting/reconciliation",
      },
      {
        module: "m9_accounting",
        metricKey: "unpostedJournals",
        label: (count) =>
          `${formatNumber(count)} journal${count === 1 ? "" : "s"} awaiting posting`,
        route: "/dashboard/accounting/journals",
      },
    ],
  },
  {
    key: "people-operations",
    title: "People & operations",
    emptyMessage: "No open people or operations issues.",
    rows: [
      {
        module: "m7_hr_payroll",
        metricKey: "staffAttendanceAnomalies",
        label: (count) =>
          `${formatNumber(count)} staff absent or late today`,
        route: "/dashboard/hr/attendance",
      },
      {
        module: "m1_students",
        metricKey: "applicationsNeedingReview",
        label: (count) =>
          `${formatNumber(count)} admission application${count === 1 ? "" : "s"} to review`,
        route: "/dashboard/admissions",
      },
      {
        module: "m7_hr_payroll",
        metricKey: "contractsExpiringSoon",
        label: (count) =>
          `${formatNumber(count)} staff contract${count === 1 ? "" : "s"} expiring within 30 days`,
        route: "/dashboard/hr/contracts",
      },
      {
        module: "m8b_transport",
        metricKey: "vehicleDocumentRisks",
        label: (count) =>
          `${formatNumber(count)} vehicle document${count === 1 ? "" : "s"} expiring soon`,
        route: "/dashboard/transport/vehicles",
      },
      {
        module: "m10_communications",
        metricKey: "failedDeliveries",
        label: (count) =>
          `${formatNumber(count)} notice deliver${count === 1 ? "y" : "ies"} failed`,
        route: "/dashboard/notices/deliveries",
      },
    ],
  },
];

export function SchoolReadinessSection({
  moduleMap,
}: {
  moduleMap: Map<OperationalSummaryModule, OperationalModuleSummary>;
}) {
  return (
    <section aria-label="School readiness">
      <div className="grid gap-4 md:grid-cols-3">
        {READINESS_PANELS.map((panel) => (
          <ReadinessPanel
            key={panel.key}
            panel={panel}
            moduleMap={moduleMap}
          />
        ))}
      </div>
    </section>
  );
}

function ReadinessPanel({
  panel,
  moduleMap,
}: {
  panel: ReadinessPanelDefinition;
  moduleMap: Map<OperationalSummaryModule, OperationalModuleSummary>;
}) {
  const sourceModules = [...new Set(panel.rows.map((row) => row.module))];
  const visibleModules = sourceModules
    .map((module) => moduleMap.get(module))
    .filter(
      (summary): summary is OperationalModuleSummary =>
        summary !== undefined && summary.status !== "locked",
    );
  const hasPartialSource = visibleModules.some(
    (summary) => summary.status === "partial",
  );

  const rows: ReadinessRow[] = panel.rows
    .map((definition) => {
      const summary = moduleMap.get(definition.module);
      if (!summary || summary.status === "locked") return null;
      const count = metricNumber(summary, definition.metricKey);
      if (count === null || count <= 0) return null;
      return {
        key: `${definition.module}-${definition.metricKey}`,
        label: definition.label(count),
        count,
        href: safeRoute({
          key: definition.metricKey,
          label: "",
          route: definition.route,
        }),
      };
    })
    .filter((row): row is ReadinessRow => row !== null)
    .slice(0, MAX_ROWS_PER_PANEL);

  const financeOverdueAmount =
    panel.key === "finance"
      ? metricValue(moduleMap.get("m3_fees"), "overdueFeesAmount")
      : null;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-950">{panel.title}</h3>
        {panel.key === "academic" ? (
          <Link
            href="/dashboard/timetable"
            className="shrink-0 text-xs font-bold text-[var(--primary)] transition hover:text-[var(--primary-dark)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-soft)] focus-visible:ring-offset-2"
          >
            View full timetable
          </Link>
        ) : null}
      </div>

      {visibleModules.length === 0 ? (
        <p className="mt-3 text-sm leading-5 text-slate-600">
          You do not have permission to view this summary.
        </p>
      ) : rows.length ? (
        <ul className="mt-3 space-y-1.5">
          {rows.map((row) => (
            <li key={row.key}>
              <ReadinessRowItem row={row} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 flex items-center gap-2 text-sm leading-5 text-slate-600">
          <CheckCircle2
            className="h-4 w-4 shrink-0 text-success-600"
            aria-hidden="true"
          />
          {panel.emptyMessage}
        </p>
      )}

      {panel.key === "finance" &&
      financeOverdueAmount !== null &&
      rows.some((row) => row.key === "m3_fees-overdueInvoices") ? (
        <p className="mt-2 text-xs font-medium text-slate-500">
          {formatMoneyNpr(financeOverdueAmount)} outstanding on overdue
          invoices.
        </p>
      ) : null}

      {hasPartialSource ? (
        <p className="mt-2 text-xs font-medium text-slate-500">
          Some information is temporarily unavailable.
        </p>
      ) : null}
    </article>
  );
}

function ReadinessRowItem({ row }: { row: ReadinessRow }) {
  const content = (
    <>
      <span className="min-w-0 flex-1 text-sm font-semibold leading-5 text-slate-800">
        {row.label}
      </span>
      {row.href ? (
        <ArrowRight
          className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[var(--primary)]"
          aria-hidden="true"
        />
      ) : null}
    </>
  );

  const className = cn(
    "group flex items-center gap-2 rounded-lg px-2 py-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-soft)]",
    row.href ? "-mx-2 hover:bg-slate-50" : "-mx-2",
  );

  return row.href ? (
    <Link href={row.href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
