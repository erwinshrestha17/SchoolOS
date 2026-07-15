import Link from 'next/link';
import { DashboardPageShell } from '../dashboard/dashboard-page-shell';
import { PageState } from '../ui/page-state';

export function ChatRemovedState() {
  return (
    <DashboardPageShell>
      <PageState
        tone="warning"
        title="Chat has been removed"
        description="New conversations and messages are unavailable. Historical records remain protected by backend authorization and retention policy."
        secondaryAction={
          <Link
            href="/dashboard/notices"
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-[var(--primary)] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--primary-dark)]"
          >
            Open Notices & Announcements
          </Link>
        }
      />
    </DashboardPageShell>
  );
}
