import { redirect } from "next/navigation";

type FinanceCompatibilitySearchParams = Record<
  string,
  string | string[] | undefined
>;

const legacyTabRoutes: Record<string, string> = {
  collection: "/dashboard/fees/collect",
  ledger: "/dashboard/fees/invoices",
  reversals: "/dashboard/fees/adjustments",
  close: "/dashboard/fees/cashier-close",
  reports: "/dashboard/fees/reports",
  setup: "/dashboard/fees/setup",
};

export default async function FinanceCompatibilityPage({
  searchParams,
}: {
  searchParams: Promise<FinanceCompatibilitySearchParams>;
}) {
  const values = await searchParams;
  const tab = typeof values.tab === "string" ? values.tab : undefined;
  const hasCollectionContext = Boolean(values.studentId || values.invoiceId);
  const destination = hasCollectionContext
    ? "/dashboard/fees/collect"
    : tab
      ? (legacyTabRoutes[tab] ?? "/dashboard/fees")
      : "/dashboard/fees";
  const nextSearch = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (key === "tab" || value === undefined) return;
    if (Array.isArray(value)) value.forEach((item) => nextSearch.append(key, item));
    else nextSearch.set(key, value);
  });

  const query = nextSearch.toString();
  redirect(query ? `${destination}?${query}` : destination);
}
