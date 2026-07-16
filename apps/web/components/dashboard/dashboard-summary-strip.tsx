"use client";

import type {
  OperationalDashboardSummary,
  OperationalModuleSummary,
  OperationalSummaryModule,
} from "@schoolos/core";
import {
  ArrowRight,
  CalendarClock,
  ClipboardCheck,
  UserCheck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { cn } from "../../lib/utils";
import {
  attendanceProgress,
  attentionKind,
  formatMoneyNpr,
  formatNumber,
  metricNumber,
  metricValue,
  moduleWorkspaceRoute,
} from "./dashboard-module-meta";

type SummaryCardModel = {
  key: string;
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
  iconClass: string;
  href: string | null;
};

/**
 * The compact top strip: at most four summary cards, each backed only by
 * backend-provided fields. A module the session cannot see is simply
 * omitted; a visible module whose numbers failed renders an explicit
 * unavailable state instead of a fake zero.
 */
export function DashboardSummaryStrip({
  dashboard,
  moduleMap,
}: {
  dashboard: OperationalDashboardSummary;
  moduleMap: Map<OperationalSummaryModule, OperationalModuleSummary>;
}) {
  const cards = buildSummaryCards(dashboard, moduleMap).slice(0, 4);
  if (!cards.length) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <SummaryStripCard key={card.key} card={card} />
      ))}
    </div>
  );
}

function SummaryStripCard({ card }: { card: SummaryCardModel }) {
  const Icon = card.icon;
  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className={cn("inline-flex rounded-xl border p-2", card.iconClass)}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        {card.href ? (
          <ArrowRight
            className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[var(--primary)]"
            aria-hidden="true"
          />
        ) : null}
      </div>
      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">
        {card.label}
      </p>
      <p className="mt-1 truncate text-xl font-black tracking-tight text-slate-950">
        {card.value}
      </p>
      <p className="mt-1 text-xs font-medium leading-4 text-slate-600">
        {card.description}
      </p>
    </>
  );

  const className =
    "group rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)] focus:ring-offset-2";

  return card.href ? (
    <Link href={card.href} className={className}>
      {content}
    </Link>
  ) : (
    <article className={className}>{content}</article>
  );
}

function buildSummaryCards(
  dashboard: OperationalDashboardSummary,
  moduleMap: Map<OperationalSummaryModule, OperationalModuleSummary>,
): SummaryCardModel[] {
  const cards: SummaryCardModel[] = [];

  const attendance = visibleModule(moduleMap, "m2_attendance");
  if (attendance) {
    const progress = attendanceProgress(attendance);
    const attendanceCard: Omit<SummaryCardModel, "value" | "description"> = {
      key: "attendance",
      label: "Attendance",
      icon: CalendarClock,
      iconClass: "border-teal-100 bg-teal-50 text-teal-700",
      href: moduleWorkspaceRoute("m2_attendance"),
    };
    if (progress.kind === "unavailable") {
      cards.push({
        ...attendanceCard,
        value: "Unavailable",
        description: "Information is not available yet.",
      });
    } else if (progress.kind === "notStarted") {
      cards.push({
        ...attendanceCard,
        value: "Not started",
        description:
          progress.total !== null
            ? `0 of ${formatNumber(progress.total)} registers submitted.`
            : "Attendance has not started.",
      });
    } else if (progress.kind === "completed") {
      cards.push({
        ...attendanceCard,
        value: "Completed",
        description: `All ${formatNumber(progress.total)} registers submitted.`,
      });
    } else {
      cards.push({
        ...attendanceCard,
        value: `${formatNumber(progress.submitted)} of ${formatNumber(progress.total)}`,
        description: "Registers submitted so far today.",
      });
    }
  }

  const fees = visibleModule(moduleMap, "m3_fees");
  if (fees) {
    const collected = metricValue(fees, "collectedTodayAmount");
    const paymentCount = metricNumber(fees, "paymentCountToday");
    cards.push({
      key: "collections",
      label: "Collections today",
      icon: Wallet,
      iconClass: "border-amber-100 bg-amber-50 text-amber-700",
      href: moduleWorkspaceRoute("m3_fees"),
      value: collected !== null ? formatMoneyNpr(collected) : "Unavailable",
      description:
        collected === null
          ? "Information is not available yet."
          : paymentCount === null
            ? "Collected today."
            : paymentCount === 0
              ? "No confirmed payments yet."
              : `${formatNumber(paymentCount)} confirmed payment${paymentCount === 1 ? "" : "s"}.`,
    });
  }

  const hr = visibleModule(moduleMap, "m7_hr_payroll");
  if (hr) {
    const present = metricNumber(hr, "staffPresentToday");
    const onLeave = metricNumber(hr, "staffOnApprovedLeaveToday");
    cards.push({
      key: "staff",
      label: "Staff availability",
      icon: UserCheck,
      iconClass: "border-slate-200 bg-slate-50 text-slate-700",
      href: moduleWorkspaceRoute("m7_hr_payroll"),
      value: present !== null ? `${formatNumber(present)} present` : "Unavailable",
      description:
        present === null
          ? "Information is not available yet."
          : onLeave === null
            ? "Staff attendance recorded today."
            : `${formatNumber(onLeave)} on approved leave today.`,
    });
  }

  // Counts categories of real review queues, with approvals kept separate
  // from warnings and follow-ups — never a merged sum of every pending
  // record (a thousand unread notice recipients is not a thousand
  // approvals). Links to the attention list on this page.
  const attentionItems = dashboard.attentionItems.filter(
    (item) => item.count > 0,
  );
  const approvals = attentionItems.filter(
    (item) => attentionKind(item) === "approval",
  ).length;
  const warnings = attentionItems.filter(
    (item) => attentionKind(item) === "warning",
  ).length;
  const followUps = attentionItems.length - approvals - warnings;
  const breakdown = [
    approvals > 0 ? `${approvals} approval${approvals === 1 ? "" : "s"}` : null,
    warnings > 0 ? `${warnings} warning${warnings === 1 ? "" : "s"}` : null,
    followUps > 0
      ? `${followUps} follow-up${followUps === 1 ? "" : "s"}`
      : null,
  ].filter(Boolean);
  cards.push({
    key: "attention",
    label: "Needs attention",
    icon: ClipboardCheck,
    iconClass: attentionItems.length
      ? "border-warning-100 bg-warning-50 text-warning-700"
      : "border-success-100 bg-success-50 text-success-600",
    href: attentionItems.length ? "#needs-attention" : null,
    value: attentionItems.length
      ? `${formatNumber(attentionItems.length)} item${attentionItems.length === 1 ? "" : "s"}`
      : "All clear",
    description: attentionItems.length
      ? breakdown.join(" · ")
      : "Nothing is waiting for your review.",
  });

  return cards;
}

function visibleModule(
  moduleMap: Map<OperationalSummaryModule, OperationalModuleSummary>,
  module: OperationalSummaryModule,
): OperationalModuleSummary | null {
  const summary = moduleMap.get(module);
  if (!summary) return null;
  if (summary.status === "locked" || summary.status === "permissionDenied") {
    return null;
  }
  return summary;
}
