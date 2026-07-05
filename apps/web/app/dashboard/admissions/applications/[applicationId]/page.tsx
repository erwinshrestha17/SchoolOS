import { DashboardPageShell } from "../../../../../components/dashboard/dashboard-page-shell";
import { ApplicationReviewWorkspace } from "../../../../../components/m1/application-review-workspace";
import { M1PageHeader } from "../../../../../components/m1/m1-page-header";

export default async function AdmissionApplicationReviewPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;

  return (
    <DashboardPageShell>
      <M1PageHeader
        title="Application review"
        description="Review the admission case, record a reasoned decision, and keep unsupported scoring or interview work unavailable."
      />
      <ApplicationReviewWorkspace admissionCaseId={applicationId} />
    </DashboardPageShell>
  );
}
