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

  it("requires confirmation before approving a fee waiver", () => {
    const waivers = read("components/finance/discounts-waivers-tab.tsx");

    // Waiving fees is a real-money action just like payment collection,
    // reversal, and cashier close — it must not submit directly on click.
    assert.match(waivers, /isConfirmingWaiver/);
    assert.match(waivers, /Confirm fee waiver/);
    assert.doesNotMatch(
      waivers,
      /handleCreateWaiver[\s\S]{0,270}waiverMutation\.mutate\(/,
    );
  });

  it("makes every fees overview KPI card open its real filtered tab", () => {
    const page = read("app/dashboard/finance/page.tsx");

    // Every KPI card must drill through, not sit as an inert stat — reading
    // the tab from the URL on load closes the loop for a card's href.
    assert.match(page, /searchParams\.get\("tab"\)/);
    assert.match(page, /setActiveTab\(tabParam as FinanceTab\)/);
    assert.match(page, /href=\{\s*canCollectPayments\s*\n?\s*\?\s*"\/dashboard\/finance\?tab=collection"/);
    assert.match(page, /href=\{canManageFees \? "\/dashboard\/finance\?tab=reports" : undefined\}/);
    assert.match(
      page,
      /href=\{\s*canUseCorrectionWorkflow\s*\n?\s*\?\s*"\/dashboard\/finance\?tab=reversals"/,
    );
    assert.match(page, /href=\{canCloseCashier \? "\/dashboard\/finance\?tab=close" : undefined\}/);
    assert.match(
      page,
      /href=\{\s*canManageFees && canReadReceipts\s*\n?\s*\?\s*"\/dashboard\/finance\?tab=ledger"/,
    );
  });

  it("uses the shared Button component with proper destructive styling for refund/reversal decisions", () => {
    const approvalQueue = read("components/finance/finance-approval-queue.tsx");

    // Real-money refund/reversal decisions must not be hand-rolled buttons
    // with ad-hoc colors — they must use the shared Button component so the
    // destructive variant is consistent with the rest of the app.
    assert.match(approvalQueue, /import \{ Button \} from "@\/components\/ui\/button"/);
    assert.doesNotMatch(approvalQueue, /className="rounded-xl bg-success-700/);
    assert.doesNotMatch(approvalQueue, /className="rounded-xl border border-danger-200/);
    assert.match(approvalQueue, /<Button type="button" onClick=\{\(\) => onDecision\("APPROVED"\)\}>/);
    assert.match(approvalQueue, /variant="destructive"/);
  });

  it("wires the defaulter aging 'View List' shortcut to a real filtered queue, not a dead click", () => {
    const agingSummary = read("components/finance/defaulter-aging-summary.tsx");
    const queueTab = read("components/finance/defaulter-queue-tab.tsx");
    const financePage = read("app/dashboard/finance/page.tsx");

    assert.match(agingSummary, /onClick=\{\(\) => viewBucket\(b\.key\)\}/);
    assert.match(agingSummary, /defaulterAgingBucket/);
    assert.match(queueTab, /agingBucket = searchParams\.get\("defaulterAgingBucket"\)/);
    assert.match(queueTab, /agingBucket: agingBucket \|\| null/);
    assert.match(financePage, /id="defaulter-queue"/);
  });

  it("gives the two defaulter export buttons distinct, accurate labels for their different scope", () => {
    const agingSummary = read("components/finance/defaulter-aging-summary.tsx");
    const queueTab = read("components/finance/defaulter-queue-tab.tsx");

    // One exports the whole unfiltered aging summary, the other exports the
    // currently-filtered queue — they must not share the exact same label.
    assert.match(agingSummary, /'Export Summary'/);
    assert.match(queueTab, /"Export Queue"/);
    assert.doesNotMatch(agingSummary, /Export Aging CSV/);
    assert.doesNotMatch(queueTab, /Export Aging CSV/);
  });

  it("gives the fee ledger's icon-only print action both a title and an aria-label", () => {
    const feeLedger = read("components/finance/fee-ledger.tsx");

    assert.match(feeLedger, /title="Print Receipt"/);
    assert.match(feeLedger, /aria-label="Print Receipt"/);
  });
});
