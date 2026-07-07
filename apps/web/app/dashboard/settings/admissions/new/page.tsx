import Link from 'next/link';
import { DashboardPageShell } from '../../../../../components/dashboard/dashboard-page-shell';
import { M1PageHeader } from '../../../../../components/m1/m1-page-header';
import { AdmissionPolicyWizard } from '../../../../../components/settings/admission-policy-wizard';

export default function CreateAdmissionPolicyPage() {
  return (
    <DashboardPageShell>
      <M1PageHeader
        title="Create Admission Policy"
        description="Set who this policy is for, what information is needed, and how admissions are approved."
        secondaryActions={
          <Link
            href="/dashboard/settings/admissions"
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Back to admission policies
          </Link>
        }
      />
      <AdmissionPolicyWizard />
    </DashboardPageShell>
  );
}
