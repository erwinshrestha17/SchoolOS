import Link from 'next/link';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { DashboardPageShell } from '@/components/dashboard/dashboard-page-shell';
import { ModuleHeader } from '@/components/ui/module-header';
import { EmptyState } from '@/components/ui/empty-state';

export function CommunicationsGapPage({ title, description }: { title: string; description: string }) {
  return (
    <DashboardPageShell>
      <ModuleHeader title={title} description={description} />
      <EmptyState
        title={`${title} are not available yet`}
        description={description}
        icon={<LockKeyhole className="h-7 w-7" />}
        action={
          <Link href="/dashboard/communications" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700">
            <ArrowLeft className="h-4 w-4" />
            Return to communications
          </Link>
        }
      />
    </DashboardPageShell>
  );
}
