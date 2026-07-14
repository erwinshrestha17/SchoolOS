'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { PageState } from '../../../components/ui/page-state';
import { Button } from '../../../components/ui/button';

export default function DeferredMessagesLayout({
  children: _children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <PageState
      tone="warning"
      title="Chat is deferred"
      description="SchoolOS is prioritizing reliable notices and personal notifications for the controlled pilot. Existing chat records are preserved, but new conversations and chat operations are not enabled."
      secondaryAction={
        <Button type="button" onClick={() => router.push('/dashboard/notices')}>
          Open Notices
        </Button>
      }
    >
      <p className="text-sm text-slate-600">
        Use Notices for school-wide or targeted announcements. Module-owned
        requests and follow-ups should stay inside Attendance, Fees, Homework,
        Transport, and other responsible workspaces.
      </p>
    </PageState>
  );
}
