import { TenantAccess } from "@/components/platform/tenant-detail/tenant-access";
import { TenantDetailPage } from "@/components/platform/tenant-detail/tenant-detail-page";

export default function PlatformTenantAccessPage() {
  return (
    <TenantDetailPage section="access">
      <TenantAccess />
    </TenantDetailPage>
  );
}
