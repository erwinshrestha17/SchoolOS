import { TenantApiKeys } from "@/components/platform/tenant-detail/tenant-api-keys";
import { TenantDetailPage } from "@/components/platform/tenant-detail/tenant-detail-page";

export default function PlatformTenantApiKeysPage() {
  return (
    <TenantDetailPage section="api-keys">
      <TenantApiKeys />
    </TenantDetailPage>
  );
}
