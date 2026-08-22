/**
 * Canonical href → module entitlement mapping for school dashboard routes.
 *
 * Used by sidebar visibility (`canDisplayNavItem`) and the dashboard layout
 * route gate so nav and direct URL access stay aligned. Keep this as the
 * single source of truth — do not duplicate in sidebar.tsx or layout.tsx.
 */

/** Prefix rules evaluated in order; first match wins. */
export const MODULE_HREF_PREFIXES: ReadonlyArray<{
  prefix: string;
  module: string;
}> = [
  { prefix: "/dashboard/my-workspace", module: "hr" },
  { prefix: "/dashboard/my-profile", module: "hr" },
  { prefix: "/dashboard/settings/personal/notifications", module: "notifications" },
  { prefix: "/dashboard/settings/policies/attendance", module: "attendance" },
  { prefix: "/dashboard/settings/policies/exams", module: "exams" },
  { prefix: "/dashboard/settings/policies/homework", module: "homework" },
  { prefix: "/dashboard/settings/policies/activity-consent", module: "activity" },
  { prefix: "/dashboard/settings/school/academic-structure", module: "students" },
  { prefix: "/dashboard/settings/academic-structure", module: "students" },
  { prefix: "/dashboard/settings/classes-sections", module: "students" },
  { prefix: "/dashboard/communications", module: "notices" },
  { prefix: "/dashboard/notifications/deliveries", module: "notifications" },
  { prefix: "/dashboard/notifications/failures", module: "notifications" },
  { prefix: "/dashboard/notices/deliveries", module: "notifications" },
  { prefix: "/dashboard/notices/failures", module: "notifications" },
  { prefix: "/dashboard/notifications", module: "notifications" },
  { prefix: "/dashboard/students", module: "students" },
  { prefix: "/dashboard/admissions", module: "students" },
  { prefix: "/dashboard/attendance", module: "attendance" },
  { prefix: "/dashboard/academics", module: "exams" },
  { prefix: "/dashboard/timetable", module: "timetable" },
  { prefix: "/dashboard/homework", module: "homework" },
  { prefix: "/dashboard/learning", module: "learning" },
  { prefix: "/dashboard/fees", module: "fees" },
  // Principal leadership finance is accounting-backed and must not inherit the
  // legacy /dashboard/finance -> fees entitlement alias below.
  { prefix: "/dashboard/finance-overview", module: "accounting" },
  // Legacy alias for Fees & Receipts — same entitlement as /dashboard/fees.
  { prefix: "/dashboard/finance", module: "fees" },
  { prefix: "/dashboard/accounting", module: "accounting" },
  { prefix: "/dashboard/hr", module: "hr" },
  { prefix: "/dashboard/payroll", module: "hr" },
  { prefix: "/dashboard/library", module: "library" },
  { prefix: "/dashboard/transport", module: "transport" },
  { prefix: "/dashboard/canteen", module: "canteen" },
  { prefix: "/dashboard/notices", module: "notices" },
  { prefix: "/dashboard/activity", module: "activity" },
  { prefix: "/dashboard/messages", module: "notices" },
  { prefix: "/dashboard/reports", module: "reports" },
] as const;

/**
 * Returns the module entitlement key required to access `href`, or `null`
 * when no module gate applies (e.g. home, operations hub, settings root).
 */
export function getRequiredModuleForHref(href: string): string | null {
  if (href.startsWith("/dashboard/operations")) {
    return null;
  }

  for (const { prefix, module } of MODULE_HREF_PREFIXES) {
    if (href.startsWith(prefix)) {
      return module;
    }
  }

  return null;
}
