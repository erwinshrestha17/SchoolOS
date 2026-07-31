import type {
  OperationalAttentionItem,
  OperationalDashboardSummary,
  OperationalModuleSummary,
  OperationalNextAction,
  OperationalSummaryModule,
  DashboardCompositionPersona,
} from "./operational-summary.js";
import type { SchoolWebPersona } from "./school-web-persona.js";
import { resolveSchoolWebPersona } from "./school-web-persona.js";

export type { DashboardCompositionPersona };

export const ADMIN_DASHBOARD_MODULES: OperationalSummaryModule[] = [
  "m1_students",
  "m2_attendance",
  "m3_fees",
  "m10_communications",
  "m6_homework_timetable",
  "m7_hr_payroll",
];

export const PRINCIPAL_DASHBOARD_MODULES: OperationalSummaryModule[] = [
  "m10_communications",
  "m2_attendance",
  "m4_academics",
  "m3_fees",
  "m7_hr_payroll",
];

const ALL_DASHBOARD_MODULES: OperationalSummaryModule[] = [
  "m1_students",
  "m2_attendance",
  "m3_fees",
  "m4_academics",
  "m5_activity",
  "m6_homework_timetable",
  "m7_hr_payroll",
  "m8a_library",
  "m8b_transport",
  "m8c_canteen",
  "m9_accounting",
  "m10_communications",
  "m12_learning",
];

export function resolveDashboardCompositionPersona(
  schoolWebPersona: SchoolWebPersona,
): DashboardCompositionPersona {
  if (schoolWebPersona === "principal") return "principal";
  if (schoolWebPersona === "admin") return "admin";
  return "general";
}

export function resolveDashboardCompositionPersonaFromAuth(input: {
  roles: readonly string[];
  permissions: readonly string[];
}): DashboardCompositionPersona {
  const schoolWebPersona = resolveSchoolWebPersona(input);
  return resolveDashboardCompositionPersona(schoolWebPersona);
}

/** Modules queried for a dashboard composition — query minimization boundary. */
export function dashboardModulesForComposition(
  persona: DashboardCompositionPersona,
): OperationalSummaryModule[] {
  if (persona === "principal") return PRINCIPAL_DASHBOARD_MODULES;
  if (persona === "admin") return ADMIN_DASHBOARD_MODULES;
  return ALL_DASHBOARD_MODULES;
}

function attentionKindFromKey(
  key: string,
): "approval" | "warning" | "follow-up" {
  const normalized = key.toLowerCase();
  if (normalized.includes("approval") || normalized.includes("pending_review")) {
    return "approval";
  }
  if (
    normalized.includes("failed") ||
    normalized.includes("overdue") ||
    normalized.includes("missing") ||
    normalized.includes("anomal")
  ) {
    return "warning";
  }
  return "follow-up";
}

export function filterAttentionItemsForPersona(
  items: Array<OperationalAttentionItem & { module: OperationalSummaryModule }>,
  persona: DashboardCompositionPersona,
) {
  if (persona === "admin" || persona === "general") {
    return items;
  }

  return items.filter((item) => {
    const kind = attentionKindFromKey(item.key);
    if (kind === "approval") return true;
    if (item.severity === "critical") return true;
    if (
      item.module === "m4_academics" ||
      item.module === "m10_communications" ||
      item.module === "m2_attendance"
    ) {
      return item.severity !== "info";
    }
    return false;
  });
}

export function filterModulesForPersona(
  modules: OperationalModuleSummary[],
  persona: DashboardCompositionPersona,
): OperationalModuleSummary[] {
  const allowed =
    persona === "principal"
      ? new Set(PRINCIPAL_DASHBOARD_MODULES)
      : persona === "admin"
        ? new Set(ADMIN_DASHBOARD_MODULES)
        : null;

  if (!allowed) {
    return modules;
  }

  return modules.filter((module) => allowed.has(module.module));
}

export function filterNextActionsForPersona(
  actions: OperationalNextAction[],
  persona: DashboardCompositionPersona,
): OperationalNextAction[] {
  if (persona !== "principal") {
    return actions;
  }

  return actions.filter((action) => {
    const route = action.route.toLowerCase();
    return (
      route.includes("approv") ||
      route.includes("notices") ||
      route.includes("academics") ||
      route.includes("attendance/anomalies") ||
      route.includes("reports")
    );
  });
}

export function projectDashboardForPersona(
  dashboard: OperationalDashboardSummary,
  persona: DashboardCompositionPersona,
): OperationalDashboardSummary {
  const filteredModules = filterModulesForPersona(dashboard.modules, persona);
  const attentionItems = filterAttentionItemsForPersona(
    dashboard.attentionItems,
    persona,
  );

  return {
    ...dashboard,
    compositionPersona: persona,
    modules: filteredModules,
    attentionItems,
    nextActions: filterNextActionsForPersona(dashboard.nextActions, persona),
    summary: {
      ...dashboard.summary,
      visibleModuleCount: filteredModules.length,
      attentionItemCount: attentionItems.length,
    },
  };
}

export function operationsModulesForPersona(
  persona: DashboardCompositionPersona,
): OperationalSummaryModule[] {
  if (persona === "principal") return PRINCIPAL_DASHBOARD_MODULES;
  return ADMIN_DASHBOARD_MODULES;
}

export const ADMIN_READINESS_PANEL_KEYS = [
  "academic",
  "finance",
  "people-operations",
] as const;

export const PRINCIPAL_READINESS_PANEL_KEYS = [
  "academic",
  "finance",
  "people-operations",
] as const;

export function shouldShowReadinessPanel(
  panelKey: string,
  persona: DashboardCompositionPersona,
): boolean {
  const keys =
    persona === "principal"
      ? PRINCIPAL_READINESS_PANEL_KEYS
      : ADMIN_READINESS_PANEL_KEYS;
  return (keys as readonly string[]).includes(panelKey);
}

/**
 * Defence-in-depth client check: never broaden a server projection and reject
 * persona mismatches rather than re-filtering a broader payload.
 */
export function assertServerDashboardProjection(
  dashboard: OperationalDashboardSummary,
  expectedPersona: DashboardCompositionPersona,
): OperationalDashboardSummary | null {
  if (dashboard.compositionPersona !== expectedPersona) {
    return null;
  }
  const sanitized = projectDashboardForPersona(dashboard, expectedPersona);
  return sanitized.compositionPersona === expectedPersona ? sanitized : null;
}
