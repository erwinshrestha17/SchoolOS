import Link from 'next/link';
import { GitMerge } from 'lucide-react';
import { DashboardPageShell } from '../../../../components/dashboard/dashboard-page-shell';
import { DuplicateCandidatesWorkspace } from '../../../../components/m1/duplicate-candidates-workspace';
import { M1PageHeader } from '../../../../components/m1/m1-page-header';

export default function DuplicateCandidatesPage() {
  return (
    <DashboardPageShell>
      <M1PageHeader
        title="Duplicate Candidates"
        description="Review probable duplicate student records and execute audited, atomic server-side merges."
        primaryAction={<Link href="#duplicate-review" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary-500 px-4 text-sm font-bold text-white shadow-sm hover:bg-primary-600"><GitMerge className="h-4 w-4" /> Review Candidates</Link>}
      />
      <div id="duplicate-review"><DuplicateCandidatesWorkspace /></div>
    </DashboardPageShell>
  );
}
