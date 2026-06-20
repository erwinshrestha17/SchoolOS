import Link from 'next/link';
import { AdmissionForm } from '../../../../components/forms/admission-form';
import { AdmissionApplicationForm } from '../../../../components/m1/admission-application-form';
import { DashboardPageShell } from '../../../../components/dashboard/dashboard-page-shell';
import { M1PageHeader } from '../../../../components/m1/m1-page-header';

export default async function NewAdmissionPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  const directEnrollment = mode === 'enrollment' || mode === 'bulk';
  return (
    <DashboardPageShell>
      <M1PageHeader
        title={directEnrollment ? 'Direct Enrollment' : 'New Application'}
        description={
          directEnrollment
            ? 'Create a student and enrollment atomically after completing the required review.'
            : 'Capture an inquiry/application for review before the separate enrollment transition.'
        }
        secondaryActions={<Link href="/dashboard/admissions" className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50">Cancel</Link>}
      />
      {directEnrollment ? (
        <AdmissionForm defaultWorkspaceTab={mode === 'bulk' ? 'bulk' : 'enrollment'} />
      ) : (
        <AdmissionApplicationForm />
      )}
    </DashboardPageShell>
  );
}
