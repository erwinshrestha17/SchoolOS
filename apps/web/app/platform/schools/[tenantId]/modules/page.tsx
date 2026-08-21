import { TenantDetailPage } from "@/components/platform/tenant-detail/tenant-detail-page";
import { TenantModules } from "@/components/platform/tenant-detail/tenant-modules";

export default function PlatformTenantModulesPage() {
  return (
    <TenantDetailPage section="modules">
      <TenantModules />
    </TenantDetailPage>
  );
}
