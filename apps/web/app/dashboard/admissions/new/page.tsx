import Link from 'next/link';
import { DashboardPageShell } from '../../../../components/dashboard/dashboard-page-shell';
import { AdmissionEntry } from '../../../../components/m1/admission-entry';
import { M1PageHeader } from '../../../../components/m1/m1-page-header';

export default async function NewAdmissionPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; caseId?: string }>;
}) {
  const { mode, caseId } = await searchParams;
  const initialMode = caseId || mode === 'enrollment' || mode === 'direct' ? 'direct' : mode === 'review' ? 'review' : undefined;

  return (
    <DashboardPageShell>
      <M1PageHeader
        title="New admission"
        description="Add a student through the school’s configured admission policy. Normal office admissions stay simple; review is used only when needed."
        secondaryActions={
          <Link href="/dashboard/admissions" className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50">
            Cancel
          </Link>
        }
      />
      <AdmissionEntry initialMode={initialMode} initialCaseId={caseId} />
    </DashboardPageShell>
  );
}
