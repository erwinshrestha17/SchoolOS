import { TenantDetailPage } from "@/components/platform/tenant-detail/tenant-detail-page";
import { TenantOnboarding } from "@/components/platform/tenant-detail/tenant-onboarding";

export default function PlatformTenantOnboardingPage() {
  return (
    <TenantDetailPage section="onboarding">
      <TenantOnboarding />
    </TenantDetailPage>
  );
}
