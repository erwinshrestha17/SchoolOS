import { DashboardPageShell } from '../../../../../components/dashboard/dashboard-page-shell';
import { AdmissionCaseDetail } from '../../../../../components/m1/admission-case-detail';
import { M1PageHeader } from '../../../../../components/m1/m1-page-header';

export default async function AdmissionCasePage({
  params,
}: {
  params: Promise<{ admissionCaseId: string }>;
}) {
  const { admissionCaseId } = await params;

  return (
    <DashboardPageShell>
      <M1PageHeader
        title="Admission case"
        description="Review saved student information, resolve only real blockers, and finalize admission when the school policy allows it."
      />
      <AdmissionCaseDetail admissionCaseId={admissionCaseId} />
    </DashboardPageShell>
  );
}
