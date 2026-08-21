import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const webRoot = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, webRoot), "utf8");

describe("M10 canteen route hardening", () => {
  it("uses one shared shell with canonical task routes and stock terminology", () => {
    const layout = read("app/dashboard/canteen/layout.tsx");

    assert.match(layout, /DashboardPageShell/);
    assert.match(layout, /ModuleHeader/);
    assert.match(layout, /WorkspaceTabs/);
    assert.match(layout, /Stock & Suppliers/);
    assert.match(layout, /\/dashboard\/canteen\/stock/);
    assert.match(layout, /\/dashboard\/canteen\/meal-plans/);
    assert.doesNotMatch(
      layout,
      /\/dashboard\/canteen\/(?:inventory|vendors|plans)/,
    );

    const routeSections = new Map([
      ["page.tsx", "overview"],
      ["menu/page.tsx", "menu"],
      ["meal-plans/page.tsx", "plans"],
      ["enrollments/page.tsx", "enrollments"],
      ["serving/page.tsx", "serving"],
      ["wallets/page.tsx", "wallets"],
      ["pos/page.tsx", "pos"],
      ["controls/page.tsx", "controls"],
      ["stock/page.tsx", "stock"],
      ["reports/page.tsx", "reports"],
    ]);

    for (const [route, section] of routeSections) {
      assert.match(
        read(`app/dashboard/canteen/${route}`),
        new RegExp(`activeTab=["']${section}["']`),
        `${route} must own the ${section} workspace`,
      );
    }
  });

  it("keeps the URL authoritative and avoids unrelated route fetches", () => {
    const workspace = read("components/canteen/canteen-workspace.tsx");

    assert.match(
      workspace,
      /type CanteenWorkspaceProps = \{ activeTab: CanteenTab \}/,
    );
    assert.doesNotMatch(
      workspace,
      /initialTab|setActiveTab|useState<CanteenTab>/,
    );
    assert.match(
      workspace,
      /enabled: activeTab === "menu" \|\| activeTab === "pos"/,
    );
    assert.match(
      workspace,
      /enabled: activeTab === "plans" \|\| activeTab === "enrollments"/,
    );
    assert.match(workspace, /enabled: activeTab === "enrollments"/);
    assert.match(
      workspace,
      /enabled: activeTab === "overview" \|\| activeTab === "serving"/,
    );
    assert.match(
      workspace,
      /enabled: activeTab === "overview" \|\| activeTab === "pos"/,
    );
    assert.match(workspace, /enabled: activeTab === "overview"/);
    assert.match(workspace, /enabled: activeTab === "stock"/);
    assert.match(workspace, /activeTab === "stock"/);
    assert.match(
      workspace,
      /const firstError = workspaceErrors\[activeTab\]\.find\(Boolean\)/,
    );
    assert.match(workspace, /reports: \[\]/);
  });

  it("physically isolates report state, queries, exports, and rendering", () => {
    const workspace = read("components/canteen/canteen-workspace.tsx");
    const reports = read("components/canteen/canteen-reports-workspace.tsx");

    assert.match(
      workspace,
      /activeTab === "reports" \? <CanteenReportsWorkspace \/>/,
    );
    assert.match(workspace, /from "\.\/canteen-reports-workspace"/);
    assert.doesNotMatch(workspace, /canteen-daily-meal-csv-export/);
    assert.doesNotMatch(workspace, /const mealCountQuery = useQuery/);
    assert.doesNotMatch(workspace, /const \[reportDate, setReportDate\]/);

    for (const marker of [
      "reportDate",
      "reportFrom",
      "reportTo",
      'queryKey: ["canteen-meal-count"',
      'queryKey: ["canteen-item-sales"',
      'queryKey: ["canteen-spending-summary"',
      "canteen-daily-meal-csv-export",
      "canteen-item-sales-csv-export",
      "Canteen reports could not be fully loaded",
    ]) {
      assert.ok(
        reports.includes(marker),
        `Missing reports boundary: ${marker}`,
      );
    }
  });

  it("uses remote student discovery without a full-school preload", () => {
    const workspace = read("components/canteen/canteen-workspace.tsx");

    assert.equal((workspace.match(/<RemoteStudentSelector/g) ?? []).length, 5);
    assert.doesNotMatch(workspace, /listStudents\s*\(\s*\{\s*limit:\s*1000/);
    assert.doesNotMatch(workspace, /<StudentSelector/);
  });

  it("redirects legacy route aliases to canonical destinations", () => {
    assert.match(
      read("app/dashboard/canteen/inventory/page.tsx"),
      /redirect\("\/dashboard\/canteen\/stock"\)/,
    );
    assert.match(
      read("app/dashboard/canteen/vendors/page.tsx"),
      /redirect\("\/dashboard\/canteen\/stock"\)/,
    );
    assert.match(
      read("app/dashboard/canteen/plans/page.tsx"),
      /redirect\("\/dashboard\/canteen\/meal-plans"\)/,
    );
  });

  it("preserves safety acknowledgements, corrections, and protected receipts", () => {
    const workspace = read("components/canteen/canteen-workspace.tsx");

    for (const marker of [
      "servingAllergyAcknowledgementLabel",
      "preventDuplicate: true",
      "reverseWalletTransactionMutation",
      "walletReversalReason",
      "openPosReceiptPdf",
      "Open invoice",
      "accounting controls",
    ]) {
      assert.ok(
        workspace.includes(marker),
        `Missing canteen safeguard: ${marker}`,
      );
    }
  });
});
