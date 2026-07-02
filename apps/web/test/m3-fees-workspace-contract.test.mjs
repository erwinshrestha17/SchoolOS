import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const webRoot = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, webRoot), "utf8");

describe("M3 fees workspace contract", () => {
  it("uses the shared module workspace and keeps one cashier primary action", () => {
    const page = read("app/dashboard/finance/page.tsx");

    assert.match(page, /<ModuleHeader/);
    assert.match(page, /<KpiGrid/);
    assert.match(page, /<ModuleTabs/);
    assert.match(page, />\s*Record Payment\s*</);
    assert.match(page, /moreActionItems/);
    assert.match(page, /value: ["']collection["'][\s\S]*label: ["']Collection["']/);
    assert.match(page, /value: ["']ledger["'][\s\S]*label: ["']Ledger & Receipts["']/);
    assert.match(
      page,
      /value: ["']reversals["'][\s\S]*label: ["']Refunds \/ Reversals["']/,
    );
    assert.match(page, /activeTab === ["']ledger["']/);
    assert.match(page, /activeTab === ["']reversals["']/);
    assert.match(page, /value: ["']close["'][\s\S]*label: ["']Cashier Close["']/);
    assert.match(page, /value: ["']reports["'][\s\S]*label: ["']Reports["']/);
    assert.match(page, /Receipt History & Reprint/);
    assert.match(page, /Cashier Close/);
  });

  it("renders official KPIs from the bounded backend summary contract", () => {
    const page = read("app/dashboard/finance/page.tsx");
    const financeApi = read("lib/api/finance.ts");

    assert.doesNotMatch(page, /invoices\.reduce/);
    assert.doesNotMatch(page, /collectionRate/);
    assert.doesNotMatch(page, /Needs a real M3 daily summary API/);
    assert.match(financeApi, /fees\/dashboard-summary/);
    assert.match(page, /getFinanceDashboardSummary/);
    assert.match(page, /date: schoolDay\.gregorianDate/);
    assert.match(page, /timeZone: NEPAL_TIME_ZONE/);
    assert.match(page, /summaryQuery\.data\.collectedToday\.netAmount/);
    assert.match(page, /summaryQuery\.data\.outstanding\.amount/);
    assert.match(page, /summaryQuery\.data\?\.overdue\.studentCount/);
    assert.match(page, /summaryQuery\.data\?\.pendingApprovalCount/);
    assert.match(page, /Cashier Close Status/);
    assert.match(page, /Receipts Issued/);
  });

  it("uses server-owned pagination and URL-bound finance list filters", () => {
    const financeApi = read("lib/api/finance.ts");
    const queue = read("components/finance/defaulter-queue-tab.tsx");
    const counter = read("components/finance/collection-counter.tsx");
    const ledger = read("components/finance/ledger-section.tsx");
    const approvals = read("components/finance/finance-approval-queue.tsx");
    const billing = read("components/finance/billing-runs-tab.tsx");
    const discounts = read("components/finance/discounts-waivers-tab.tsx");
    const closes = read("components/finance/cashier-close-section.tsx");

    assert.match(financeApi, /request<DefaultersResponse>/);
    assert.match(financeApi, /listInvoicesPage/);
    assert.match(financeApi, /listPaymentsPage/);
    assert.match(financeApi, /listReceiptsPage/);
    assert.match(queue, /defaultersQuery\.data\?\.items/);
    assert.match(counter, /page/);
    assert.match(counter, /onPageChange/);
    assert.match(ledger, /ledgerPage/);
    assert.match(ledger, /ledgerSearch/);
    assert.match(ledger, /receiptPage/);
    assert.match(ledger, /receiptSearch/);
    assert.match(approvals, /approvalPage/);
    assert.match(approvals, /approvalStatus/);
    assert.match(approvals, /approvalType/);
    assert.match(billing, /billingPage/);
    assert.match(billing, /billingSearch/);
    assert.match(discounts, /discountPage/);
    assert.match(discounts, /waiverPage/);
    assert.match(queue, /defaulterPage/);
    assert.match(queue, /defaulterSearch/);
    assert.match(closes, /closePage/);
  });

  it("guards duplicate financial writes and uses protected receipt files", () => {
    const counter = read("components/finance/collection-counter.tsx");
    const collection = read("components/finance/collection-section.tsx");
    const approvals = read("components/finance/finance-approval-queue.tsx");
    const reprint = read("components/finance/reprint-dialog.tsx");
    const client = read("lib/api/client.ts");
    const protectedPdfHelper = client.slice(
      client.indexOf("export async function openPdfBlob"),
      client.indexOf("export async function openImageBlob"),
    );

    assert.match(counter, /isSubmitting/);
    assert.match(counter, /invoiceDetailQuery\.data\.outstandingAmount/);
    assert.match(collection, /paymentAttemptRef/);
    assert.match(collection, /idempotencyKey/);
    assert.match(approvals, /requestAttemptRef/);
    assert.match(approvals, /idempotencyKey/);
    assert.match(reprint, /ProtectedFileButton/);
    assert.match(reprint, /fileAssetId/);
    assert.doesNotMatch(reprint, /window\.open/);
    assert.doesNotMatch(protectedPdfHelper, /window\.open/);
  });

  it("preserves explicit M3 operational states and high-risk confirmation", () => {
    const page = read("app/dashboard/finance/page.tsx");
    const collection = read("components/finance/collection-section.tsx");
    const approvals = read("components/finance/finance-approval-queue.tsx");
    const close = read("components/finance/cashier-close-section.tsx");
    const reprint = read("components/finance/reprint-dialog.tsx");

    assert.match(page, /PermissionState/);
    assert.match(page, /Loading/);
    assert.match(page, /Unavailable/);
    assert.match(
      collection,
      /Payment succeeded\.\s+The protected PDF will be generated when\s+opened\./,
    );
    assert.match(collection, /REPLAYED/);
    assert.match(approvals, /Dialog/);
    assert.match(approvals, /Request a Refund or Reversal/);
    assert.match(close, /Confirm cashier close/);
    assert.match(close, /already be closed/i);
    assert.match(reprint, /temporarily unavailable|Failed to reprint receipt/i);
  });
});
