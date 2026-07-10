"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BarChart3, Calculator, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import { BillingRunsTab } from "@/components/finance/billing-runs-tab";
import { CashierCloseSection } from "@/components/finance/cashier-close-section";
import { CollectionSection } from "@/components/finance/collection-section";
import { CollectionStudentDiscovery } from "@/components/finance/collection-student-discovery";
import { DiscountsWaiversTab } from "@/components/finance/discounts-waivers-tab";
import { FeeOverview } from "@/components/finance/fee-overview";
import { FeeSetupTab } from "@/components/finance/fee-setup-tab";
import { FeesModuleShell } from "@/components/finance/fees-module-shell";
import { FinanceApprovalQueue } from "@/components/finance/finance-approval-queue";
import { FinanceReportWorkspace } from "@/components/finance/finance-report-workspace";
import { LedgerSection } from "@/components/finance/ledger-section";
import { StudentLedgerWorkspace } from "@/components/finance/student-ledger-workspace";
import { useSession } from "@/components/session-provider";
import { ErrorState } from "@/components/ui/error-state";
import { PermissionDenied } from "@/components/ui/permission-denied";
import { api } from "@/lib/api";
import { useRecentlyViewed } from "@/lib/hooks/use-recently-viewed";

export type FeesSection =
  | "overview"
  | "collect"
  | "billing"
  | "invoices"
  | "ledgers"
  | "receipts"
  | "adjustments"
  | "cashier-close"
  | "reports"
  | "setup";

const sectionCopy: Record<FeesSection, { title: string; description: string }> =
  {
    overview: {
      title: "Fees & Receipts",
      description:
        "Collect fees, issue protected receipts, follow up dues, and close the cashier with an auditable trail.",
    },
    collect: {
      title: "Collect payment",
      description:
        "Find a student or invoice, review the due, and confirm one payment safely.",
    },
    billing: {
      title: "Billing runs",
      description:
        "Generate invoices from existing fee plans and follow each backend billing-run state.",
    },
    invoices: {
      title: "Invoices",
      description:
        "Search the server-paginated invoice register and review current payment status.",
    },
    ledgers: {
      title: "Student ledgers",
      description:
        "Explain one student's billed, paid, waived, refunded, and outstanding position from backend ledger truth.",
    },
    receipts: {
      title: "Receipt center",
      description:
        "Open confirmed protected receipts, verify receipt numbers, and prepare audited reprints.",
    },
    adjustments: {
      title: "Adjustments",
      description:
        "Request and review refunds or reversals without editing confirmed payment records.",
    },
    "cashier-close": {
      title: "Cashier close",
      description:
        "Review backend totals, explain variance, and confirm an immutable school-day close.",
    },
  reports: {
    title: "Fees reports",
    description:
      "Run one permission-safe collections, dues, aging, methods, close, adjustment, or receipt view at a time.",
  },
    setup: {
      title: "Fees setup",
      description:
        "Maintain fee heads, plans, discount rules, and billing configuration within existing contracts.",
    },
  };

export function FeesWorkspace({ section }: { section: FeesSection }) {
  const { hasPermissions } = useSession();
  const canCollect = hasPermissions(["payments:collect"]);
  const canManage = hasPermissions(["fees:manage"]);
  const canBill = hasPermissions(["fees:bill"]);
  const canReadReceipts = hasPermissions(["receipts:read"]);
  const canReadLedger = hasPermissions(["ledger:read"]);
  const canClose = hasPermissions(["payments:close"]);
  const canUseCorrectionWorkflow =
    canCollect ||
    hasPermissions(["payments:refund"]) ||
    hasPermissions(["payments:reverse"]);
  const copy = sectionCopy[section];

  const allowed =
    section === "overview" ||
    (section === "collect" && canCollect) ||
    (section === "billing" && canBill) ||
    (section === "invoices" && canCollect) ||
    (section === "ledgers" && canReadLedger) ||
    (section === "receipts" && canReadReceipts) ||
    (section === "adjustments" && canUseCorrectionWorkflow) ||
    (section === "cashier-close" && canClose) ||
    (section === "reports" && canManage) ||
    (section === "setup" && canManage);

  const primaryAction =
    section === "overview" && canCollect ? (
      <PrimaryLink
        href="/dashboard/fees/collect"
        icon={<Calculator className="h-4 w-4" />}
      >
        Collect payment
      </PrimaryLink>
    ) : section === "collect" ? (
      <SecondaryLink
        href="/dashboard/fees"
        icon={<ArrowLeft className="h-4 w-4" />}
      >
        Back to overview
      </SecondaryLink>
    ) : section === "billing" && canBill ? (
      <a
        href="#new-billing-run"
        className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--color-mod-fees-accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-mod-fees-text)]"
      >
        <Plus className="h-4 w-4" /> New billing run
      </a>
    ) : section === "reports" ? (
      <SecondaryLink
        href="/dashboard/fees/setup"
        icon={<Settings className="h-4 w-4" />}
      >
        Report settings
      </SecondaryLink>
    ) : undefined;

  return (
    <FeesModuleShell
      title={copy.title}
      description={copy.description}
      primaryAction={primaryAction}
    >
      {allowed ? (
        <FeesSectionContent section={section} />
      ) : (
        <PermissionDenied
          showNavigation={false}
          title={`${copy.title} is restricted`}
          description="Your current role does not have the finance permission required for this workspace. No restricted school finance data is shown."
        />
      )}
    </FeesModuleShell>
  );
}

function FeesSectionContent({ section }: { section: FeesSection }) {
  switch (section) {
    case "overview":
      return <FeeOverview />;
    case "collect":
      return <CollectionRouteWorkspace />;
    case "billing":
      return (
        <div id="new-billing-run">
          <BillingRunsTab />
        </div>
      );
    case "invoices":
      return <LedgerSection mode="invoices" />;
    case "ledgers":
      return <StudentLedgerWorkspace />;
    case "receipts":
      return <LedgerSection mode="receipts" />;
    case "adjustments":
      return (
        <div className="space-y-6">
          <FinanceApprovalQueue />
          <DiscountsWaiversTab mode="waivers" />
        </div>
      );
    case "cashier-close":
      return <CashierCloseSection />;
    case "reports":
      return <FinanceReportWorkspace />;
    case "setup":
      return (
        <div className="space-y-6">
          <FeeSetupTab />
          <DiscountsWaiversTab mode="discounts" />
        </div>
      );
  }
}

function CollectionRouteWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialInvoiceId = searchParams.get("invoiceId");
  const studentId = searchParams.get("studentId");
  const search = searchParams.get("search")?.trim() ?? "";
  const updateUrl = useCallback(
    (updates: Record<string, string | number | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (!value || value === 1) params.delete(key);
        else params.set(key, String(value));
      });
      if ("search" in updates) params.delete("page");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );
  const studentSearchQuery = useQuery({
    queryKey: ["collection-students", search],
    queryFn: () => api.searchCollectionStudents(search),
    enabled: !studentId && !initialInvoiceId && search.length >= 2,
  });
  const studentContextQuery = useQuery({
    queryKey: ["student-collection-context", studentId],
    queryFn: () => {
      if (!studentId) throw new Error("Student context is unavailable.");
      return api.getStudentCollectionContext(studentId);
    },
    enabled: Boolean(studentId),
  });
  const invoiceDetailQuery = useQuery({
    queryKey: ["invoice-detail", "collection-deep-link", initialInvoiceId],
    queryFn: () => {
      if (!initialInvoiceId) throw new Error("Invoice context is unavailable.");
      return api.getInvoiceDetail(initialInvoiceId);
    },
    enabled: Boolean(initialInvoiceId && !studentId),
  });
  const { record: recordRecentlyViewed } = useRecentlyViewed();
  const viewedInvoice = initialInvoiceId
    ? studentContextQuery.data?.invoices.find(
        (invoice) => invoice.id === initialInvoiceId,
      )
    : undefined;

  useEffect(() => {
    if (studentId || !invoiceDetailQuery.data?.student.id) return;
    updateUrl({ studentId: invoiceDetailQuery.data.student.id });
  }, [invoiceDetailQuery.data?.student.id, studentId, updateUrl]);

  useEffect(() => {
    if (!initialInvoiceId || !viewedInvoice) return;
    recordRecentlyViewed({
      kind: "invoice",
      id: initialInvoiceId,
      label: viewedInvoice.invoiceNumber,
      href: `/dashboard/fees/collect?invoiceId=${encodeURIComponent(initialInvoiceId)}${studentId ? `&studentId=${encodeURIComponent(studentId)}` : ""}`,
    });
  }, [initialInvoiceId, recordRecentlyViewed, studentId, viewedInvoice]);

  if (!studentId && initialInvoiceId) {
    if (invoiceDetailQuery.isError) {
      return (
        <ErrorState
          title="Invoice could not be opened for collection"
          message="The invoice link was preserved. Retry to resolve its tenant-scoped student account."
          onRetry={() => void invoiceDetailQuery.refetch()}
        />
      );
    }

    return (
      <div
        className="h-56 animate-pulse rounded-xl border border-slate-200 bg-white"
        aria-label="Loading invoice collection context"
      />
    );
  }

  if (!studentId) {
    return (
      <CollectionStudentDiscovery
        search={search}
        onSearchChange={(value) => updateUrl({ search: value })}
        students={studentSearchQuery.data?.items ?? []}
        isLoading={studentSearchQuery.isLoading}
        isError={studentSearchQuery.isError}
        onRetry={() => void studentSearchQuery.refetch()}
        onSelect={(student) =>
          updateUrl({
            studentId: student.id,
            search: null,
            invoiceId: null,
          })
        }
      />
    );
  }

  return (
    <CollectionSection
      key={`student-${studentId}`}
      invoices={[]}
      isLoading={studentContextQuery.isLoading}
      isError={studentContextQuery.isError}
      onRetry={() => void studentContextQuery.refetch()}
      initialInvoiceId={initialInvoiceId}
      studentCollectionContext={studentContextQuery.data ?? null}
      hasStudentCollectionContextRequest={Boolean(studentId)}
      isStudentProfileSource={searchParams.get("source") === "student-profile"}
      onChangeStudent={() =>
        updateUrl({ studentId: null, source: null, invoiceId: null })
      }
      searchQuery={search}
      onSearchChange={(value) => updateUrl({ search: value })}
      page={1}
      limit={studentContextQuery.data?.invoices.length ?? 25}
      total={studentContextQuery.data?.invoices.length ?? 0}
    />
  );
}

function PrimaryLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--color-mod-fees-accent)] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-mod-fees-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mod-fees-accent)] focus-visible:ring-offset-2"
    >
      {icon}
      {children}
    </Link>
  );
}

function SecondaryLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mod-fees-accent)] focus-visible:ring-offset-2"
    >
      {icon}
      {children}
    </Link>
  );
}
