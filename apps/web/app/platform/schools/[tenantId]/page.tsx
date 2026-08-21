import { redirect } from "next/navigation";
import { TenantDetailPage } from "@/components/platform/tenant-detail/tenant-detail-page";
import {
  TENANT_LEGACY_TAB_ROUTES,
  tenantSectionHref,
} from "@/components/platform/tenant-detail/tenant-detail-routes";
import { TenantOverview } from "@/components/platform/tenant-detail/tenant-overview";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function PlatformTenantOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ tenantId }, values] = await Promise.all([params, searchParams]);
  const legacyTab = typeof values.tab === "string" ? values.tab : undefined;

  if (legacyTab) {
    const section = TENANT_LEGACY_TAB_ROUTES[legacyTab] ?? "overview";
    const next = new URLSearchParams();
    Object.entries(values).forEach(([key, value]) => {
      if (key === "tab" || value === undefined) return;
      if (Array.isArray(value)) value.forEach((item) => next.append(key, item));
      else next.set(key, value);
    });
    const query = next.toString();
    const destination = tenantSectionHref(tenantId, section);
    redirect(query ? `${destination}?${query}` : destination);
  }

  return (
    <TenantDetailPage section="overview">
      <TenantOverview />
    </TenantDetailPage>
  );
}
