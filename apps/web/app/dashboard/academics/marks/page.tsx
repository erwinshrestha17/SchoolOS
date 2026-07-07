'use client';

import Link from 'next/link';
import { AcademicsWorkspace } from '@/components/academics/academics-workspace';
import { academicsWorkspaceTabs } from '@/components/academics/academics-tabs';
import { ModuleTabs } from '@/components/ui/module-tabs';
import { PageHeader } from '@/components/ui/page-header';

export default function MarksEntryPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Marks Entry"
        description="Record and review student scores for terminal and periodic assessments."
        actions={
          <Link
            href="/dashboard/academics/retakes"
            className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Retest queue
          </Link>
        }
      />
      <ModuleTabs items={academicsWorkspaceTabs} accentColor="purple" variant="light" className="mb-6" />
      <AcademicsWorkspace initialSection="Marks Entry" />
    </div>
  );
}
