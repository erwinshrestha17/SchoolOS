import { TenantAudit } from "@/components/platform/tenant-detail/tenant-audit";
import { TenantDetailPage } from "@/components/platform/tenant-detail/tenant-detail-page";

export default function PlatformTenantAuditPage() {
  return (
    <TenantDetailPage section="audit">
      <TenantAudit />
    </TenantDetailPage>
  );
}
