import Link from 'next/link';
import { DashboardPageShell } from '../../../../../components/dashboard/dashboard-page-shell';
import { M1PageHeader } from '../../../../../components/m1/m1-page-header';
import { AdmissionPolicyDetail } from '../../../../../components/settings/admission-policy-detail';

export default async function AdmissionPolicyDetailPage({
  params,
}: {
  params: Promise<{ policyId: string }>;
}) {
  const { policyId } = await params;
  return (
    <DashboardPageShell>
      <M1PageHeader
        title="Admission Policy"
        description="Review this policy's requirements, documents, and change history."
        secondaryActions={
          <Link
            href="/dashboard/settings/admissions"
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Back to admission policies
          </Link>
        }
      />
      <AdmissionPolicyDetail policyId={policyId} />
    </DashboardPageShell>
  );
}
