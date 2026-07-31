import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(webRoot, path), "utf8");

describe("AF accounting and finance polish contracts", () => {
  it("does not nest PageHeader inside the accounting module shell", () => {
    for (const path of [
      "components/accounting/accounting-reports-view.tsx",
      "app/dashboard/accounting/budgets/page.tsx",
    ]) {
      const source = read(path);
      assert.doesNotMatch(
        source,
        /<PageHeader/,
        `${path} must not use legacy PageHeader under accounting layout`,
      );
    }
  });

  it("uses shared Button on priority M3 fee ledger and approval surfaces", () => {
    for (const path of [
      "components/finance/ledger-section.tsx",
      "components/finance/finance-approval-queue.tsx",
      "components/finance/discounts-waivers-tab.tsx",
    ]) {
      const source = read(path);
      assert.match(
        source,
        /from ['"]@\/components\/ui\/button['"]/,
        `${path} must import shared Button`,
      );
    }
  });

  it("uses shared Button on priority M11 accounting workspaces", () => {
    for (const path of [
      "components/accounting/accounting-reports-view.tsx",
      "components/accounting/bank-reconciliation-workspace.tsx",
      "components/accounting/journal-entries-view.tsx",
    ]) {
      const source = read(path);
      assert.match(
        source,
        /from ['"]@\/components\/ui\/button['"]|from ['"]\.\.\/ui\/button['"]/,
        `${path} must import shared Button`,
      );
    }
  });

  it("gates fee write surfaces with PermissionDenied where capabilities exist", () => {
    const workspace = read("components/finance/fees-workspace.tsx");
    const approvals = read("components/finance/finance-approval-queue.tsx");

    assert.match(workspace, /<PermissionDenied/);
    assert.match(approvals, /PermissionDenied|useFeesCapabilities|hasPermissions/);
  });

  it("uses dashboardRouteGates for fees and finance module entitlement routing", () => {
    const dashboardLayout = read("app/dashboard/layout.tsx");

    assert.match(dashboardLayout, /dashboardRouteGates/);
    assert.match(dashboardLayout, /prefix: "\/dashboard\/fees"/);
    assert.match(dashboardLayout, /prefix: "\/dashboard\/finance"/);
    assert.match(dashboardLayout, /<UpgradePrompt/);
  });
});
