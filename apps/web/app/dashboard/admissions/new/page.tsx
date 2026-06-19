import Link from 'next/link';
import { AdmissionForm } from '../../../../components/forms/admission-form';
import { DashboardPageShell } from '../../../../components/dashboard/dashboard-page-shell';
import { M1PageHeader } from '../../../../components/m1/m1-page-header';

export default function NewAdmissionPage() {
  return (
    <DashboardPageShell>
      <M1PageHeader
        title="New Admission"
        description="Create a tenant-scoped student admission, check duplicate candidates, link guardians, and upload protected documents."
        secondaryActions={<Link href="/dashboard/admissions" className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50">Cancel</Link>}
      />
      <AdmissionForm defaultWorkspaceTab="enrollment" />
    </DashboardPageShell>
  );
}
