"use client";

import type {
  OperationalAttentionItem,
  OperationalModuleSummary,
  OperationalSummaryMetricValue,
  OperationalSummaryModule,
} from "@schoolos/core";
import {
  BookOpen,
  Bus,
  CalendarClock,
  CircleAlert,
  GraduationCap,
  Landmark,
  Library,
  MessageSquare,
  School,
  Users,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { resolveOperationalSummaryAction } from "../ui/operational-summary";

export type DashboardModuleDefinition = {
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  accentClass: string;
};

export type SafeAction = {
  label: string;
  href: string;
};

export const MODULE_DEFINITIONS: Record<
  OperationalSummaryModule,
  DashboardModuleDefinition
> = {
  m1_students: {
    label: "Admissions & Student Profiles",
    shortLabel: "Students & Admissions",
    icon: Users,
    accentClass:
      "text-[color:var(--color-mod-admissions-text)] bg-[var(--color-mod-admissions-soft)] border-[color:var(--color-mod-admissions-border)]",
  },
  m2_attendance: {
    label: "Smart Attendance",
    shortLabel: "Attendance",
    icon: CalendarClock,
    accentClass:
      "text-[color:var(--color-mod-attendance-text)] bg-[var(--color-mod-attendance-soft)] border-[color:var(--color-mod-attendance-border)]",
  },
  m3_fees: {
    label: "Fees & Receipts",
    shortLabel: "Fees",
    icon: Wallet,
    accentClass:
      "text-[color:var(--color-mod-fees-text)] bg-[var(--color-mod-fees-soft)] border-[color:var(--color-mod-fees-border)]",
  },
  m4_academics: {
    label: "Academics, Exams & Report Cards",
    shortLabel: "Academics",
    icon: GraduationCap,
    accentClass:
      "text-[color:var(--color-mod-academics-text)] bg-[var(--color-mod-academics-soft)] border-[color:var(--color-mod-academics-border)]",
  },
  m5_activity: {
    label: "Activity Feed & Milestones",
    shortLabel: "Activity Feed",
    icon: MessageSquare,
    accentClass:
      "text-[color:var(--color-mod-activity-text)] bg-[var(--color-mod-activity-soft)] border-[color:var(--color-mod-activity-border)]",
  },
  m6_homework_timetable: {
    label: "Homework & Timetable",
    shortLabel: "Homework & Timetable",
    icon: BookOpen,
    accentClass:
      "text-[color:var(--color-mod-homework-text)] bg-[var(--color-mod-homework-soft)] border-[color:var(--color-mod-homework-border)]",
  },
  m7_hr_payroll: {
    label: "HR & Payroll",
    shortLabel: "HR & Payroll",
    icon: Users,
    accentClass:
      "text-[color:var(--color-mod-hr-text)] bg-[var(--color-mod-hr-soft)] border-[color:var(--color-mod-hr-border)]",
  },
  m8a_library: {
    label: "Library",
    shortLabel: "Library",
    icon: Library,
    accentClass:
      "text-[color:var(--color-mod-library-text)] bg-[var(--color-mod-library-soft)] border-[color:var(--color-mod-library-border)]",
  },
  m8b_transport: {
    label: "Transport",
    shortLabel: "Transport",
    icon: Bus,
    accentClass:
      "text-[color:var(--color-mod-transport-text)] bg-[var(--color-mod-transport-soft)] border-[color:var(--color-mod-transport-border)]",
  },
  m8c_canteen: {
    label: "Canteen",
    shortLabel: "Canteen",
    icon: Utensils,
    accentClass:
      "text-[color:var(--color-mod-canteen-text)] bg-[var(--color-mod-canteen-soft)] border-[color:var(--color-mod-canteen-border)]",
  },
  m9_accounting: {
    label: "Accounting & Finance",
    shortLabel: "Accounting",
    icon: Landmark,
    accentClass:
      "text-[color:var(--color-mod-accounting-text)] bg-[var(--color-mod-accounting-soft)] border-[color:var(--color-mod-accounting-border)]",
  },
  m10_communications: {
    label: "Notices & Announcements",
    shortLabel: "Notices",
    icon: MessageSquare,
    accentClass:
      "text-[color:var(--color-mod-notices-text)] bg-[var(--color-mod-notices-soft)] border-[color:var(--color-mod-notices-border)]",
  },
  m11_intelligence: {
    label: "Intelligence / AI",
    shortLabel: "Intelligence",
    icon: CircleAlert,
    accentClass:
      "text-[color:var(--color-mod-intelligence-text)] bg-[var(--color-mod-intelligence-soft)] border-[color:var(--color-mod-intelligence-border)]",
  },
  m12_learning: {
    label: "Learning Layer",
    shortLabel: "Learning",
    icon: School,
    accentClass:
      "text-[color:var(--color-mod-learning-text)] bg-[var(--color-mod-learning-soft)] border-[color:var(--color-mod-learning-border)]",
  },
};

/**
 * Canonical landing route for each module's operational workspace. Every
 * value must also exist in APPROVED_DASHBOARD_ROUTES; moduleWorkspaceRoute
 * still resolves through safeRoute so the shared allowlist stays the single
 * authority on what the dashboard may link to.
 */
const MODULE_WORKSPACE_ROUTES: Partial<
  Record<OperationalSummaryModule, string>
> = {
  m1_students: "/dashboard/students",
  m2_attendance: "/dashboard/attendance",
  m3_fees: "/dashboard/fees",
  m4_academics: "/dashboard/academics",
  m5_activity: "/dashboard/activity",
  m6_homework_timetable: "/dashboard/homework",
  m7_hr_payroll: "/dashboard/hr",
  m8a_library: "/dashboard/library",
  m8b_transport: "/dashboard/transport",
  m8c_canteen: "/dashboard/canteen",
  m9_accounting: "/dashboard/accounting",
  m10_communications: "/dashboard/notices",
  m12_learning: "/dashboard/learning",
};

export function safeRoute(action: {
  key: string;
  label: string;
  route: string;
}): string | null {
  return resolveOperationalSummaryAction(action);
}

export function firstSafeAction(
  summary: OperationalModuleSummary,
): SafeAction | null {
  for (const action of summary.nextActions) {
    const href = safeRoute(action);
    if (href) return { label: action.label, href };
  }
  return null;
}

export function moduleWorkspaceRoute(
  module: OperationalSummaryModule,
): string | null {
  const route = MODULE_WORKSPACE_ROUTES[module];
  if (!route) return null;
  return safeRoute({ key: `open_${module}`, label: "", route });
}

/**
 * Attention items that represent a real approval decision waiting on a
 * reviewer, as opposed to warnings and informational follow-up queues. The
 * split keeps "Needs attention" honest: a thousand unread notice recipients
 * is follow-up, not a thousand pending approvals.
 */
export const APPROVAL_ATTENTION_KEYS = new Set([
  "applicationsNeedingReview",
  "pendingCorrections",
  "pendingLeaveRequests",
  "pendingMarkLocks",
  "pendingReview",
]);

export type AttentionKind = "approval" | "warning" | "followUp";

export function attentionKind(item: OperationalAttentionItem): AttentionKind {
  if (APPROVAL_ATTENTION_KEYS.has(item.key)) return "approval";
  if (item.severity === "critical" || item.severity === "warning") {
    return "warning";
  }
  return "followUp";
}

export const severityPresentation: Record<
  OperationalAttentionItem["severity"],
  { label: string; chipClass: string; rowClass: string }
> = {
  critical: {
    label: "Urgent",
    chipClass: "bg-danger-50 text-danger-700",
    rowClass: "border-danger-100 bg-danger-50",
  },
  warning: {
    label: "Warning",
    chipClass: "bg-warning-50 text-warning-700",
    rowClass: "border-warning-100 bg-warning-50",
  },
  info: {
    label: "Review",
    chipClass: "bg-info-50 text-info-700",
    rowClass: "border-info-100 bg-info-50",
  },
};

export function metricValue(
  summary: OperationalModuleSummary | undefined,
  key: string,
): OperationalSummaryMetricValue {
  return summary?.summary[key] ?? null;
}

export function metricNumber(
  summary: OperationalModuleSummary | undefined,
  key: string,
): number | null {
  const value = metricValue(summary, key);
  return typeof value === "number" ? value : null;
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-NP").format(value);
}

/**
 * Displays a backend-provided decimal money string (e.g. "56800.00") as
 * "NPR 56,800". Presentation only — the amount itself is never computed in
 * the browser.
 */
export function formatMoneyNpr(value: string | number): string {
  const amount = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(amount)) return `NPR ${value}`;
  const formatted = new Intl.NumberFormat("en-NP", {
    minimumFractionDigits: 0,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
  return `NPR ${formatted}`;
}

export type AttendanceProgress =
  | { kind: "unavailable" }
  | { kind: "notStarted"; total: number | null }
  | { kind: "inProgress"; submitted: number; total: number }
  | { kind: "completed"; total: number };

/**
 * Attendance day progress from the backend's own register counts. Reads the
 * school-wide keys first, then the teacher-scoped keys the same backend
 * summary returns for teaching-only sessions, so the card degrades to "your
 * assigned registers" without guessing anyone's role. "submitted = total -
 * pending" is presentation arithmetic on two backend counts, mirroring the
 * previous attendance-rate precedent — never an official attendance total.
 */
export function attendanceProgress(
  summary: OperationalModuleSummary | undefined,
): AttendanceProgress {
  if (!summary) return { kind: "unavailable" };
  const total =
    metricNumber(summary, "attendanceSessionsToday") ??
    metricNumber(summary, "assignedRegistersToday");
  const pending =
    metricNumber(summary, "unsubmittedRegisters") ??
    metricNumber(summary, "pendingRegistersToday");
  if (total === null) return { kind: "unavailable" };
  if (total === 0) return { kind: "notStarted", total: null };
  if (pending === null) return { kind: "unavailable" };
  const submitted = Math.max(0, total - pending);
  if (submitted === 0) return { kind: "notStarted", total };
  if (pending === 0) return { kind: "completed", total };
  return { kind: "inProgress", submitted, total };
}

/**
 * Safe, school-friendly wording for the combined activity feed. Each entry
 * matches the record type the backend's recent-items query actually reads
 * for that module (payment, enrollment, attendance session, ...), so the
 * label describes the real event without exposing message bodies, payloads,
 * or private details.
 */
export const ACTIVITY_EVENT_LABELS: Record<OperationalSummaryModule, string> =
  {
    m1_students: "New enrollment recorded",
    m2_attendance: "Attendance register updated",
    m3_fees: "Fee payment recorded",
    m4_academics: "Report card updated",
    m5_activity: "Activity post added",
    m6_homework_timetable: "Homework assigned",
    m7_hr_payroll: "Payroll run updated",
    m8a_library: "Library book issued",
    m8b_transport: "Transport trip recorded",
    m8c_canteen: "Canteen sale recorded",
    m9_accounting: "Journal entry recorded",
    m10_communications: "Notice delivery processed",
    m11_intelligence: "Activity recorded",
    m12_learning: "Learning session created",
  };
