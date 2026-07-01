'use client';

import Link from 'next/link';
import { DashboardPageShell } from '../../../../components/dashboard/dashboard-page-shell';
import { M1PageHeader } from '../../../../components/m1/m1-page-header';
import { PageState } from '../../../../components/ui/page-state';

export default function AdmissionDocumentsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <DashboardPageShell>
      <M1PageHeader
        title="Student Documents & Guardians"
        description="Review student guardians, protected documents, verification state, expiry, and audit history."
      />
      <PageState
        tone="danger"
        title="We could not load admission documents right now."
        description="Your admission records have not been changed. Try again, or return to the admission queue."
        actionLabel="Try again"
        onAction={reset}
        secondaryAction={
          <Link
            href="/dashboard/admissions"
            className="inline-flex h-11 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white px-6 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Return to admissions
          </Link>
        }
      />
    </DashboardPageShell>
  );
}
