import { TenantDetailPage } from "@/components/platform/tenant-detail/tenant-detail-page";
import { TenantSubscription } from "@/components/platform/tenant-detail/tenant-subscription";

export default function PlatformTenantSubscriptionPage() {
  return (
    <TenantDetailPage section="subscription">
      <TenantSubscription />
    </TenantDetailPage>
  );
}
