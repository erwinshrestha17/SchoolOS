import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("SchoolOS Settings Page Contracts", () => {
  it("keeps the settings index thin and defers to the role-aware control centre", () => {
    const page = read("app/dashboard/settings/page.tsx");
    const frame = read("components/settings/settings-route-frame.tsx");

    assert.ok(page.length < 600, "settings index must stay a thin page");
    assert.match(frame, /SettingsControlCenter/);
    assert.match(frame, /getSchoolSettingsNavigation/);
    assert.doesNotMatch(page, /SETTINGS_SECTIONS|SettingsSidebar|UnsavedBar/);
  });

  it("drives grouped navigation from the backend contract, not a static catalog", () => {
    const frame = read("components/settings/settings-route-frame.tsx");

    assert.match(frame, /schoolSettingsApi\.getSchoolSettingsNavigation/);
    assert.match(frame, /Applies only to this school/);
    assert.match(frame, /View only/);
    assert.match(frame, /Your role has no School Settings access/);
    assert.doesNotMatch(frame, /SCHOOL_SETTINGS_CATEGORIES/);
  });

  it("renders a compact overview with attention, access, recent changes, and one primary action", () => {
    const hub = read("components/settings/settings-control-center.tsx");

    assert.match(hub, /overview\.primaryAction/);
    assert.match(hub, /overview\.attention/);
    assert.match(hub, /overview\.recentChanges/);
    assert.match(hub, /overview\.schoolName/);
    assert.match(hub, /Applies only to this school/);
    assert.match(hub, /Your access/);
    assert.match(hub, /SCHOOL_SETTINGS_ACCESS_LABELS/);
    assert.match(hub, /Managed by SchoolOS Platform/i);
    assert.doesNotMatch(hub, /min-h-44/, "no large card wall on the overview");
    assert.doesNotMatch(hub, /Upgrade Plan/);
  });

  it("strictly separates school settings from platform settings", () => {
    const hub = read("components/settings/settings-control-center.tsx");
    const frame = read("components/settings/settings-route-frame.tsx");

    const forbidden = [
      "SaaS billing",
      "Provider credentials",
      "Feature flags",
      "Subscription plans",
      "Tenant suspension",
      "Infrastructure health",
    ];

    for (const source of [hub, frame]) {
      for (const item of forbidden) {
        assert.doesNotMatch(
          source,
          new RegExp(item, "i"),
          `Found platform-only term: ${item}`,
        );
      }
      assert.doesNotMatch(source, /href=["']\/platform/);
    }
  });

  it("resolves policy access per settings domain from the backend navigation", () => {
    const policy = read("components/settings/settings-policy-workspace.tsx");
    const catalog = read("components/settings/settings-policy-catalog.ts");

    assert.match(policy, /navigationItemId/);
    assert.match(policy, /canEditSchoolSettings/);
    assert.match(policy, /PermissionDenied/);
    assert.match(policy, /View-only access/);
    assert.match(policy, /Applies only to this school/);
    assert.match(policy, /Last updated|Not configured yet/);
    assert.match(policy, /Change history/);
    assert.match(policy, /operationalImpact/);
    assert.match(catalog, /navigationItemId:/);
    assert.match(catalog, /operationalImpact:/);
  });

  it("maintains tenant scoping for all settings updates", () => {
    const policy = read("components/settings/settings-policy-workspace.tsx");

    assert.match(policy, /api\.updateTenantSetting\(field\.key, form\[field\.key\]\)/);
    assert.doesNotMatch(policy, /api\.updateGlobalSetting/);
    assert.doesNotMatch(policy, /tenantId: ['"]all['"]/);
  });

  it("collects a reason for owner-sensitive user suspension", () => {
    const users = read("components/settings/users-access-workspace.tsx");
    const usersApi = read("lib/api/users.ts");

    assert.match(users, /statusReason/);
    assert.match(users, /School Configuration Owner/);
    assert.match(usersApi, /reason\?: string/);
  });

  it("connects the settings audit workspace to safe tenant-scoped audit logs", () => {
    const workspace = read("components/settings/audit-log-workspace.tsx");
    const api = read("lib/api/settings-governance.ts");

    assert.match(workspace, /settingsGovernanceApi\.listTenantAuditLogs/);
    assert.match(api, /\/settings\/audit-logs/);
    assert.doesNotMatch(workspace, /log\.before|log\.after|ipAddress|userAgent/);
  });

  it("redirects every legacy or duplicate settings route to its canonical owner", () => {
    const redirects = [
      ["app/dashboard/settings/overview/page.tsx", "/dashboard/settings"],
      ["app/dashboard/settings/profile/page.tsx", "/dashboard/settings/school-profile"],
      ["app/dashboard/settings/academic/page.tsx", "/dashboard/settings/academic-calendar"],
      ["app/dashboard/settings/classes-sections/page.tsx", "/dashboard/settings/academic-structure"],
      ["app/dashboard/settings/users-roles/page.tsx", "/dashboard/settings/users-access"],
      ["app/dashboard/settings/notifications/page.tsx", "/dashboard/settings/communication"],
      ["app/dashboard/settings/audit-log/page.tsx", "/dashboard/settings/audit-export"],
      ["app/dashboard/settings/security-audit/page.tsx", "/dashboard/settings/audit-export"],
      ["app/dashboard/settings/billing/page.tsx", "/dashboard/settings/modules"],
      ["app/dashboard/settings/plans/page.tsx", "/dashboard/settings/modules"],
    ];

    for (const [file, destination] of redirects) {
      const source = read(file);
      assert.match(source, /redirect\(/, `${file} must redirect`);
      assert.ok(source.includes(destination), `${file} must target ${destination}`);
    }
  });

  it("provides canonical routes for every settings IA group", () => {
    const routes = [
      "school-profile",
      "branding-documents",
      "academic-calendar",
      "academic-structure",
      "modules",
      "admissions",
      "attendance",
      "exams-report-cards",
      "homework-timetable-learning",
      "activity-consent",
      "fees",
      "accounting",
      "hr-payroll",
      "communication",
      "documents-templates",
      "integrations",
      "users-access",
      "roles-permissions",
      "security",
      "audit-export",
    ];
    for (const route of routes) {
      read(`app/dashboard/settings/${route}/page.tsx`);
    }
  });
});
