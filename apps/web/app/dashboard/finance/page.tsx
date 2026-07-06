"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Calculator,
  FileText,
  History,
  Receipt,
  Settings,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  formatBsDate,
  getNepalSchoolDay,
  NEPAL_TIME_ZONE,
} from "@schoolos/core";
import { CashierCloseSection } from "@/components/finance/cashier-close-section";
import { CollectionSection } from "@/components/finance/collection-section";
import { DefaulterAgingSummary } from "@/components/finance/defaulter-aging-summary";
import { DefaulterQueueTab } from "@/components/finance/defaulter-queue-tab";
import { DiscountsWaiversTab } from "@/components/finance/discounts-waivers-tab";
import { DuesAnalysisSection } from "@/components/finance/dues-analysis-section";
import { FeeSetupTab } from "@/components/finance/fee-setup-tab";
import { BillingRunsTab } from "@/components/finance/billing-runs-tab";
import { LedgerSection } from "@/components/finance/ledger-section";
import { FinanceApprovalQueue } from "@/components/finance/finance-approval-queue";
import { DashboardPageShell } from "@/components/dashboard/dashboard-page-shell";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { ModuleHeader } from "@/components/ui/module-header";
import { ModuleTabs } from "@/components/ui/module-tabs";
import { PermissionState } from "@/components/ui/permission-state";
import { api } from "@/lib/api";
import { useRecentlyViewed } from "@/lib/hooks/use-recently-viewed";
import { useSession } from "@/components/session-provider";

type FinanceTab =
  | "collection"
  | "ledger"
  | "reversals"
  | "close"
  | "reports"
  | "setup";

const FINANCE_TABS: FinanceTab[] = [
  "collection",
  "ledger",
  "reversals",
  "close",
  "reports",
  "setup",
];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-NP", {
    style: "currency",
    currency: "NPR",
    maximumFractionDigits: 0,
  }).format(amount);

export default function FinancePage() {
  const { hasPermissions, session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialInvoiceId = searchParams.get("invoiceId");
  const studentId = searchParams.get("studentId");

  const canCollectPayments = hasPermissions(["payments:collect"]);
  const canManageFees = hasPermissions(["fees:manage"]);
  const canReadReceipts = hasPermissions(["receipts:read"]);
  const canCloseCashier = hasPermissions(["payments:close"]);
  const canApproveRefund = hasPermissions(["payments:refund"]);
  const canApproveReversal = hasPermissions(["payments:reverse"]);
  const canUseCorrectionWorkflow =
    canCollectPayments || canApproveRefund || canApproveReversal;
  const invoicePage = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const invoiceSearch = searchParams.get("search")?.trim() ?? "";
  const schoolDay = getNepalSchoolDay();
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<FinanceTab>(() =>
    tabParam && (FINANCE_TABS as string[]).includes(tabParam)
      ? (tabParam as FinanceTab)
      : canCollectPayments
        ? "collection"
        : canManageFees
          ? "ledger"
          : canCloseCashier
            ? "close"
            : "collection",
  );

  useEffect(() => {
    if (tabParam && (FINANCE_TABS as string[]).includes(tabParam)) {
      setActiveTab(tabParam as FinanceTab);
    }
  }, [tabParam]);

  const invoicesQuery = useQuery({
    queryKey: ["invoices", invoicePage, invoiceSearch],
    queryFn: () =>
      api.listInvoicesPage({
        page: invoicePage,
        limit: 25,
        search: invoiceSearch || undefined,
        outstandingOnly: true,
        sortBy: "dueDate",
        sortDirection: "asc",
      }),
    enabled: canCollectPayments && !studentId,
  });
  const studentCollectionContextQuery = useQuery({
    queryKey: ["student-collection-context", studentId],
    queryFn: () => {
      if (!studentId) {
        throw new Error("Student context is unavailable.");
      }

      return api.getStudentCollectionContext(studentId);
    },
    enabled: canCollectPayments && Boolean(studentId),
  });
  const { record: recordRecentlyViewed } = useRecentlyViewed();
  const viewedInvoice = initialInvoiceId
    ? studentCollectionContextQuery.data?.invoices.find(
        (invoice) => invoice.id === initialInvoiceId,
      )
    : undefined;

  useEffect(() => {
    if (!initialInvoiceId || !viewedInvoice) return;
    recordRecentlyViewed({
      kind: "invoice",
      id: initialInvoiceId,
      label: viewedInvoice.invoiceNumber,
      href: `/dashboard/finance?invoiceId=${initialInvoiceId}${studentId ? `&studentId=${studentId}` : ""}`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialInvoiceId, viewedInvoice?.invoiceNumber]);

  const summaryQuery = useQuery({
    queryKey: ["finance-dashboard-summary", schoolDay.gregorianDate],
    queryFn: () =>
      api.getFinanceDashboardSummary({
        date: schoolDay.gregorianDate,
        timeZone: NEPAL_TIME_ZONE,
      }),
    enabled:
      !studentId &&
      (canCollectPayments ||
        canManageFees ||
        canReadReceipts ||
        canCloseCashier),
  });

  const selectTab = (tab: FinanceTab) => {
    setActiveTab(tab);
    window.requestAnimationFrame(() => {
      document.getElementById("finance-workspace")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  useEffect(() => {
    if (studentId && canCollectPayments) {
      setActiveTab("collection");
    }
  }, [canCollectPayments, studentId]);

  const handleChangeStudent = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("studentId");
    params.delete("source");
    params.delete("invoiceId");
    const query = params.toString();
    router.replace(
      query ? `/dashboard/finance?${query}` : "/dashboard/finance",
      {
        scroll: false,
      },
    );
    setActiveTab("collection");
  };

  const updateInvoiceListParams = (updates: {
    page?: number;
    search?: string;
  }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (updates.page !== undefined) {
      if (updates.page <= 1) params.delete("page");
      else params.set("page", String(updates.page));
    }
    if (updates.search !== undefined) {
      const nextSearch = updates.search.trim();
      if (nextSearch) params.set("search", nextSearch);
      else params.delete("search");
      params.delete("page");
    }
    const query = params.toString();
    router.replace(
      query ? `/dashboard/finance?${query}` : "/dashboard/finance",
      {
        scroll: false,
      },
    );
  };

  const tabs = [
    ...(canCollectPayments
      ? [
          {
            value: "collection",
            label: "Collection",
            icon: Wallet,
          },
        ]
      : []),
    ...(canManageFees && canReadReceipts
      ? [
          {
            value: "ledger",
            label: "Ledger & Receipts",
            icon: Receipt,
          },
        ]
      : []),
    ...(canUseCorrectionWorkflow
      ? [
          { value: "setup", label: "Discounts & Setup", icon: Settings },
          {
            value: "reversals",
            label: "Refunds / Reversals",
            icon: ShieldAlert,
          },
        ]
      : []),
    ...(canCloseCashier
      ? [
          {
            value: "close",
            label: "Cashier Close",
            icon: History,
          },
        ]
      : []),
    ...(canManageFees
      ? [
          {
            value: "reports",
            label: "Reports",
            icon: BarChart3,
          },
        ]
      : []),
  ];

  return (
    <DashboardPageShell>
      <ModuleHeader
        title="Fees & Receipts"
        description={`Collect fees, issue protected receipts, follow up dues, and close the cashier with an auditable trail${session?.tenant.name ? ` for ${session.tenant.name}` : ""}.`}
        primaryAction={
          canCollectPayments && !studentId ? (
            <button
              type="button"
              onClick={() => selectTab("collection")}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-mod-fees-accent)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-mod-fees-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-fees-border)] focus:ring-offset-2"
            >
              <Calculator size={18} />
              Record Payment
            </button>
          ) : undefined
        }
        moreActionItems={[
          ...(canReadReceipts
            ? [
                {
                  label: "Receipt History & Reprint",
                  icon: <Receipt size={16} />,
                  onClick: () => selectTab("ledger"),
                },
              ]
            : []),
          ...(canCloseCashier
            ? [
                {
                  label: "Cashier Close",
                  icon: <History size={16} />,
                  onClick: () => selectTab("close"),
                },
              ]
            : []),
          ...(canManageFees
            ? [
                {
                  label: "Reports & Exports",
                  icon: <BarChart3 size={16} />,
                  onClick: () => selectTab("reports"),
                },
                {
                  label: "Overdue Reminders",
                  icon: <FileText size={16} />,
                  onClick: () => selectTab("reports"),
                },
                {
                  label: "Fee Setup & Templates",
                  icon: <Settings size={16} />,
                  onClick: () => selectTab("setup"),
                },
              ]
            : []),
        ]}
      >
        {studentId ? null : (
          <KpiGrid className="sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            <KpiCard
              title="Collected Today"
              value={
                summaryQuery.isLoading
                  ? "Loading"
                  : summaryQuery.data
                    ? formatCurrency(
                        Number(summaryQuery.data.collectedToday.netAmount),
                      )
                    : "Unavailable"
              }
              icon={<Wallet size={20} />}
              tone="success"
              href={
                canCollectPayments
                  ? "/dashboard/finance?tab=collection"
                  : undefined
              }
              description="Net confirmed collection from the backend."
            />
            <KpiCard
              title="Total Due"
              value={
                summaryQuery.isLoading
                  ? "Loading"
                  : summaryQuery.data
                    ? formatCurrency(
                        Number(summaryQuery.data.outstanding.amount),
                      )
                    : "Unavailable"
              }
              icon={<Wallet size={20} />}
              tone="neutral"
              href={canManageFees ? "/dashboard/finance?tab=reports" : undefined}
              description="Backend-owned outstanding balance."
            />
            <KpiCard
              title="Overdue Students"
              value={
                !canManageFees
                  ? "Restricted"
                  : summaryQuery.isLoading
                    ? "Loading"
                    : (summaryQuery.data?.overdue.studentCount ?? "Unavailable")
              }
              icon={<FileText size={20} />}
              tone={
                summaryQuery.data?.overdue.studentCount ? "warning" : "neutral"
              }
              href={canManageFees ? "/dashboard/finance?tab=reports" : undefined}
              description={
                summaryQuery.data
                  ? `${formatCurrency(Number(summaryQuery.data.overdue.amount))} overdue.`
                  : "Backend defaulter summary."
              }
            />
            <KpiCard
              title="Pending Corrections"
              value={
                summaryQuery.isLoading
                  ? "Loading"
                  : (summaryQuery.data?.pendingApprovalCount ?? "Unavailable")
              }
              icon={<ShieldAlert size={20} />}
              tone={
                summaryQuery.data?.pendingApprovalCount ? "warning" : "neutral"
              }
              href={
                canUseCorrectionWorkflow
                  ? "/dashboard/finance?tab=reversals"
                  : undefined
              }
              description="Refund and reversal requests needing attention."
            />
            <KpiCard
              title="Cashier Close Status"
              value={
                !canCloseCashier
                  ? "Restricted"
                  : summaryQuery.isLoading
                    ? "Loading"
                    : (summaryQuery.data?.cashierClose.state ?? "Unavailable")
              }
              icon={<History size={20} />}
              tone={
                summaryQuery.data?.cashierClose.state === "OPEN"
                  ? "warning"
                  : "neutral"
              }
              href={canCloseCashier ? "/dashboard/finance?tab=close" : undefined}
              description="Backend-owned close state for the selected school day."
            />
            <KpiCard
              title="Receipts Issued"
              value={
                !canReadReceipts
                  ? "Restricted"
                  : summaryQuery.isLoading
                    ? "Loading"
                    : (summaryQuery.data?.receiptsIssued ?? "Unavailable")
              }
              icon={<Receipt size={20} />}
              tone="neutral"
              href={
                canManageFees && canReadReceipts
                  ? "/dashboard/finance?tab=ledger"
                  : undefined
              }
              description={`Bounded to ${formatBsDate(schoolDay.startUtc)}.`}
            />
          </KpiGrid>
        )}
      </ModuleHeader>

      <div id="finance-workspace" className="scroll-mt-24 space-y-6">
        <ModuleTabs
          items={tabs}
          activeValue={activeTab}
          onValueChange={(value) => setActiveTab(value as FinanceTab)}
          accentColor="amber"
          variant="light"
        />

        <div className="min-h-[420px]">
          {activeTab === "collection" ? (
            canCollectPayments ? (
              <CollectionSection
                key={studentId ? `student-${studentId}` : "invoice-search"}
                invoices={invoicesQuery.data?.items ?? []}
                isLoading={
                  studentId
                    ? studentCollectionContextQuery.isLoading
                    : invoicesQuery.isLoading
                }
                isError={
                  studentId
                    ? studentCollectionContextQuery.isError
                    : invoicesQuery.isError
                }
                onRetry={() => {
                  if (studentId) {
                    void studentCollectionContextQuery.refetch();
                    return;
                  }
                  void invoicesQuery.refetch();
                }}
                initialInvoiceId={initialInvoiceId}
                studentCollectionContext={
                  studentCollectionContextQuery.data ?? null
                }
                hasStudentCollectionContextRequest={Boolean(studentId)}
                isStudentProfileSource={Boolean(studentId)}
                onChangeStudent={handleChangeStudent}
                searchQuery={invoiceSearch}
                onSearchChange={(value) =>
                  updateInvoiceListParams({ search: value })
                }
                page={invoicesQuery.data?.page ?? invoicePage}
                limit={invoicesQuery.data?.limit ?? 25}
                total={invoicesQuery.data?.total ?? 0}
                onPageChange={(page) => updateInvoiceListParams({ page })}
              />
            ) : (
              <PermissionState
                title="Fee collection is restricted"
                description="You do not have permission to collect payments. Contact the school administrator if you need cashier access."
              />
            )
          ) : null}
          {activeTab === "ledger" && canManageFees && canReadReceipts ? (
            <LedgerSection />
          ) : null}
          {activeTab === "reversals" && canUseCorrectionWorkflow ? (
            <FinanceApprovalQueue />
          ) : null}
          {activeTab === "close" && canCloseCashier ? (
            <CashierCloseSection />
          ) : null}
          {activeTab === "reports" && canManageFees ? (
            <div className="space-y-8">
              <DefaulterAgingSummary />
              <div id="defaulter-queue">
                <DefaulterQueueTab />
              </div>
              <DuesAnalysisSection />
            </div>
          ) : null}
          {activeTab === "setup" && canManageFees ? (
            <div className="space-y-8">
              <FeeSetupTab />
              <DiscountsWaiversTab />
              <BillingRunsTab />
            </div>
          ) : null}
        </div>
      </div>
    </DashboardPageShell>
  );
}
