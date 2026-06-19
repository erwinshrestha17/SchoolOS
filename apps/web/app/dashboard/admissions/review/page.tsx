import Link from 'next/link';
import { ApplicationReviewWorkspace } from '../../../../components/m1/application-review-workspace';
import { DashboardPageShell } from '../../../../components/dashboard/dashboard-page-shell';
import { M1PageHeader } from '../../../../components/m1/m1-page-header';

export default async function AdmissionReviewPage({ searchParams }: { searchParams: Promise<{ studentId?: string }> }) {
  const params = await searchParams;
  return (
    <DashboardPageShell>
      <M1PageHeader title="Application Review" description="Review persisted admission, guardian, enrollment, and protected-document data." secondaryActions={<Link href="/dashboard/admissions" className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50">Back to Applications</Link>} />
      <ApplicationReviewWorkspace studentId={params.studentId} />
    </DashboardPageShell>
  );
}
