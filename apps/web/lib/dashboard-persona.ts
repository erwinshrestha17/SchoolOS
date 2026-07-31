import type {
  OperationalAttentionItem,
  OperationalDashboardSummary,
  OperationalModuleSummary,
  OperationalNextAction,
  OperationalSummaryModule,
} from "@schoolos/core";
import type { SchoolWebPersona } from "@schoolos/core";

export type DashboardCompositionPersona = "admin" | "principal" | "general";

export function resolveDashboardCompositionPersona(
  schoolWebPersona: SchoolWebPersona,
): DashboardCompositionPersona {
  if (schoolWebPersona === "principal") return "principal";
  if (schoolWebPersona === "admin") return "admin";
  return "general";
}

const ADMIN_OPERATION_MODULES: OperationalSummaryModule[] = [
  "m1_students",
  "m2_attendance",
  "m3_fees",
  "m10_communications",
  "m6_homework_timetable",
  "m7_hr_payroll",
];

const PRINCIPAL_OPERATION_MODULES: OperationalSummaryModule[] = [
  "m10_communications",
  "m2_attendance",
  "m4_academics",
  "m3_fees",
  "m7_hr_payroll",
];

const ADMIN_READINESS_PANEL_KEYS = ["academic", "finance", "people-operations"];
const PRINCIPAL_READINESS_PANEL_KEYS = ["academic", "finance", "people-operations"];

function attentionKindFromKey(key: string): "approval" | "warning" | "follow-up" {
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
      ? new Set(PRINCIPAL_OPERATION_MODULES)
      : persona === "admin"
        ? new Set(ADMIN_OPERATION_MODULES)
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

export function shouldShowReadinessPanel(
  panelKey: string,
  persona: DashboardCompositionPersona,
): boolean {
  const keys =
    persona === "principal"
      ? PRINCIPAL_READINESS_PANEL_KEYS
      : ADMIN_READINESS_PANEL_KEYS;
  return keys.includes(panelKey);
}

export function projectDashboardForPersona(
  dashboard: OperationalDashboardSummary,
  persona: DashboardCompositionPersona,
): OperationalDashboardSummary {
  const moduleMap = new Map(
    dashboard.modules.map((module) => [module.module, module]),
  );
  const filteredModules = filterModulesForPersona(dashboard.modules, persona);

  const attentionItems = filterAttentionItemsForPersona(
    dashboard.attentionItems,
    persona,
  );

  return {
    ...dashboard,
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
  if (persona === "principal") return PRINCIPAL_OPERATION_MODULES;
  return ADMIN_OPERATION_MODULES;
}
