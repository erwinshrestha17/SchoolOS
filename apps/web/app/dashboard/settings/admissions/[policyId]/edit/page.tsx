import Link from 'next/link';
import { DashboardPageShell } from '../../../../../../components/dashboard/dashboard-page-shell';
import { M1PageHeader } from '../../../../../../components/m1/m1-page-header';
import { AdmissionPolicyWizard } from '../../../../../../components/settings/admission-policy-wizard';

export default async function EditAdmissionPolicyPage({
  params,
}: {
  params: Promise<{ policyId: string }>;
}) {
  const { policyId } = await params;
  return (
    <DashboardPageShell>
      <M1PageHeader
        title="Edit Admission Policy"
        description="Changes are saved as a new draft version until you activate them."
        secondaryActions={
          <Link
            href={`/dashboard/settings/admissions/${policyId}`}
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Back to policy
          </Link>
        }
      />
      <AdmissionPolicyWizard policyId={policyId} />
    </DashboardPageShell>
  );
}
