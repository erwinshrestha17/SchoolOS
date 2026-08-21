import { TenantBilling } from "@/components/platform/tenant-detail/tenant-billing";
import { TenantDetailPage } from "@/components/platform/tenant-detail/tenant-detail-page";

export default function PlatformTenantBillingPage() {
  return (
    <TenantDetailPage section="billing">
      <TenantBilling />
    </TenantDetailPage>
  );
}
