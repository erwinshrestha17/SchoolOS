import { TenantDetailPage } from "@/components/platform/tenant-detail/tenant-detail-page";
import { TenantIntegrations } from "@/components/platform/tenant-detail/tenant-integrations";

export default function PlatformTenantIntegrationsPage() {
  return (
    <TenantDetailPage section="integrations">
      <TenantIntegrations />
    </TenantDetailPage>
  );
}
