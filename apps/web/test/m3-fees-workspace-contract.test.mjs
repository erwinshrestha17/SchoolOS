import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const webRoot = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, webRoot), "utf8");

describe("M3 fees workspace contract", () => {
  it("makes /dashboard/fees canonical and keeps legacy finance deep links safe", () => {
    const feesPage = read("app/dashboard/fees/page.tsx");
    const financePage = read("app/dashboard/finance/page.tsx");

    assert.match(feesPage, /FeesWorkspace section="overview"/);
    assert.match(financePage, /legacyTabRoutes/);
    assert.match(financePage, /\/dashboard\/fees\/collect/);
    assert.match(financePage, /\/dashboard\/fees\/adjustments/);
    assert.match(financePage, /\/dashboard\/fees\/cashier-close/);
    assert.match(financePage, /redirect\(query \? `\$\{destination\}\?\$\{query\}` : destination\)/);
  });

  it("provides one-job canonical routes for the M3 workspace", () => {
    const routeSections = new Map([
      ["app/dashboard/fees/collect/page.tsx", "collect"],
      ["app/dashboard/fees/billing/page.tsx", "billing"],
      ["app/dashboard/fees/invoices/page.tsx", "invoices"],
      ["app/dashboard/fees/ledgers/page.tsx", "ledgers"],
      ["app/dashboard/fees/receipts/page.tsx", "receipts"],
      ["app/dashboard/fees/adjustments/page.tsx", "adjustments"],
      ["app/dashboard/fees/cashier-close/page.tsx", "cashier-close"],
      ["app/dashboard/fees/reports/page.tsx", "reports"],
      ["app/dashboard/fees/setup/page.tsx", "setup"],
    ]);

    for (const [path, section] of routeSections) {
      assert.match(read(path), new RegExp(`FeesWorkspace section=["']${section}["']`));
    }
  });

  it("uses one permission-aware module shell without a second sidebar", () => {
    const shell = read("components/finance/fees-module-shell.tsx");

    assert.match(shell, /Fees and receipts navigation/);
    assert.match(shell, /label: "Overview"/);
    assert.match(shell, /label: "Collect"[\s\S]*"payments:collect"/);
    assert.match(shell, /label: "Billing"[\s\S]*"fees:bill"/);
    assert.match(shell, /label: "Receipts"[\s\S]*"receipts:read"/);
    assert.match(shell, /label: "Cashier Close"[\s\S]*"payments:close"/);
    assert.match(shell, /More/);
    assert.doesNotMatch(shell, /<DashboardShell|<Sidebar/);
  });

  it("renders exactly five official overview KPIs from the bounded backend summary", () => {
    const overview = read("components/finance/fee-overview.tsx");
    const financeApi = read("lib/api/finance.ts");

    assert.equal((overview.match(/<KpiCard/g) ?? []).length, 5);
    assert.match(financeApi, /fees\/dashboard-summary/);
    assert.match(overview, /getFinanceDashboardSummary/);
    assert.match(overview, /date: schoolDay\.gregorianDate/);
    assert.match(overview, /timeZone: NEPAL_TIME_ZONE/);
    assert.match(overview, /summary\.collectedToday\.netAmount/);
    assert.match(overview, /summary\.outstanding\.amount/);
    assert.match(overview, /summary\.overdue\.amount/);
    assert.match(overview, /summary\.pendingApprovalCount/);
    assert.match(overview, /summary\.cashierClose\.state/);
    assert.doesNotMatch(overview, /\.reduce\(/);
  });

  it("keeps overview values actionable and distinguishes unavailable from zero", () => {
    const overview = read("components/finance/fee-overview.tsx");

    assert.match(overview, /\/dashboard\/fees\/collect/);
    assert.match(overview, /\/dashboard\/fees\/invoices\?outstanding=true/);
    assert.match(overview, /\/dashboard\/fees\/adjustments\?status=PENDING/);
    assert.match(overview, /\/dashboard\/fees\/cashier-close/);
    assert.match(overview, /Unavailable/);
    assert.match(overview, /Restricted/);
    assert.match(overview, /As of/);
    assert.match(overview, /No finance value has been replaced with zero/);
  });

  it("uses server pagination and URL state for growing finance lists", () => {
    const financeApi = read("lib/api/finance.ts");
    const queue = read("components/finance/defaulter-queue-tab.tsx");
    const ledger = read("components/finance/ledger-section.tsx");
    const approvals = read("components/finance/finance-approval-queue.tsx");
    const billing = read("components/finance/billing-runs-tab.tsx");
    const discounts = read("components/finance/discounts-waivers-tab.tsx");
    const closes = read("components/finance/cashier-close-section.tsx");
    const studentLedger = read("components/finance/student-ledger-workspace.tsx");

    assert.match(financeApi, /listInvoicesPage/);
    assert.match(financeApi, /listPaymentsPage/);
    assert.match(financeApi, /listReceiptsPage/);
    assert.match(queue, /defaulterPage/);
    assert.match(ledger, /ledgerPage/);
    assert.match(ledger, /receiptPage/);
    assert.match(approvals, /approvalPage/);
    assert.match(billing, /billingPage/);
    assert.match(discounts, /discountPage/);
    assert.match(discounts, /waiverPage/);
    assert.match(closes, /closePage/);
    assert.match(studentLedger, /searchParams\.get\("page"\)/);
    assert.match(studentLedger, /listInvoicesPage/);
  });

  it("keeps payment writes idempotent and protected receipt access authenticated", () => {
    const counter = read("components/finance/collection-counter.tsx");
    const collection = read("components/finance/collection-section.tsx");
    const reprint = read("components/finance/reprint-dialog.tsx");

    assert.match(counter, /invoiceDetailQuery\.data\.outstandingAmount/);
    assert.match(counter, /onWheel=\{\(e\) => e\.currentTarget\.blur\(\)\}/);
    assert.match(collection, /paymentAttemptRef/);
    assert.match(collection, /idempotencyKey/);
    assert.match(collection, /REPLAYED/);
    assert.match(collection, /Open protected receipt/);
    assert.match(reprint, /ProtectedFileButton/);
    assert.match(reprint, /fileAssetId/);
    assert.doesNotMatch(reprint, /window\.open/);
  });

  it("makes the payment review explicit before the money write", () => {
    const counter = read("components/finance/collection-counter.tsx");

    assert.match(counter, /Review payment/);
    assert.match(counter, /PaymentReviewItem/);
    assert.match(counter, /label="Invoice"/);
    assert.match(counter, /label="Amount to collect"/);
    assert.match(counter, /label="Payment method"/);
    assert.match(counter, /label="Reference"/);
    assert.match(counter, /label="Outstanding before"/);
    assert.match(counter, /Balance after confirmation/);
    assert.match(counter, /Back to payment/);
    assert.match(counter, /Confirm and issue receipt/);
    assert.match(counter, /authorized refund or reversal/);
    assert.doesNotMatch(counter, /Finalize & Print Receipt/);
  });

  it("keeps setup discounts separate from adjustment waivers", () => {
    const workspace = read("components/finance/fees-workspace.tsx");
    const discounts = read("components/finance/discounts-waivers-tab.tsx");

    assert.match(workspace, /case "adjustments"[\s\S]*DiscountsWaiversTab mode="waivers"/);
    assert.match(workspace, /case "setup"[\s\S]*DiscountsWaiversTab mode="discounts"/);
    assert.match(discounts, /mode\?: "all" \| "discounts" \| "waivers"/);
    assert.match(discounts, /Confirm fee waiver/);
  });

  it("uses school-friendly aging severity and removes decorative pulsing status", () => {
    const aging = read("components/finance/defaulter-aging-summary.tsx");

    assert.match(aging, /severity: 'Recent'/);
    assert.match(aging, /severity: 'Follow-up'/);
    assert.match(aging, /severity: 'High priority'/);
    assert.match(aging, /severity: 'Critical'/);
    assert.doesNotMatch(aging, /animate-pulse/);
  });

  it("keeps permission denied and module entitlement states fail closed", () => {
    const workspace = read("components/finance/fees-workspace.tsx");
    const dashboardLayout = read("app/dashboard/layout.tsx");

    assert.match(workspace, /<PermissionDenied/);
    assert.match(dashboardLayout, /href\.startsWith\("\/dashboard\/fees"\)\) return "fees"/);
    assert.match(dashboardLayout, /href\.startsWith\("\/dashboard\/finance"\)\) return "fees"/);
    assert.match(dashboardLayout, /<UpgradePrompt/);
  });

  it("keeps high-risk refund, reversal, waiver, and close confirmations", () => {
    const approvals = read("components/finance/finance-approval-queue.tsx");
    const waivers = read("components/finance/discounts-waivers-tab.tsx");
    const close = read("components/finance/cashier-close-section.tsx");

    assert.match(approvals, /Request a Refund or Reversal/);
    assert.match(approvals, /requestAttemptRef/);
    assert.match(waivers, /isConfirmingWaiver/);
    assert.match(waivers, /Confirm fee waiver/);
    assert.match(close, /Confirm cashier close/);
    assert.match(close, /already be closed/i);
  });
});
