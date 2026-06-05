'use client';

import Link from 'next/link';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { ModuleTabs } from '../../../components/dashboard/module-tabs';
import { LibraryWorkspace } from '../../../components/library/library-workspace';
import { PageHeader } from '../../../components/ui/page-header';

const libraryTabs = [
  { label: 'Overview', href: '/dashboard/library' },
  { label: 'Catalog', href: '/dashboard/library/catalog' },
  { label: 'Copies', href: '/dashboard/library/copies' },
  { label: 'Issue / Return', href: '/dashboard/library/issue-return' },
  { label: 'Borrowers', href: '/dashboard/library/borrowers' },
  { label: 'Overdue', href: '/dashboard/library/overdue' },
  { label: 'Fines', href: '/dashboard/library/fines' },
  { label: 'Reports', href: '/dashboard/library/reports' },
];

export default function LibraryPage() {
  const headerActions = (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/dashboard/library/issue-return"
        className="inline-flex h-10 items-center justify-center rounded-xl bg-teal-700 px-4 text-sm font-bold text-white hover:bg-teal-800"
      >
        Issue / Return
      </Link>
      <Link
        href="/dashboard/library/catalog"
        className="inline-flex h-10 items-center justify-center rounded-xl border border-teal-100 bg-white px-4 text-sm font-bold text-teal-700 hover:bg-teal-50"
      >
        Catalog
      </Link>
    </div>
  );

  return (
    <DashboardPageShell>
      <PageHeader
        title="Library"
        description="Manage book catalogues, barcode copies, scanner-first issue-return workflows, overdue tracking, and fine posting status."
        actions={headerActions}
      />
      <div className="mb-6">
        <ModuleTabs items={libraryTabs} accentColor="emerald" variant="light" />
      </div>
      <LibraryWorkspace initialTab="overview" />
    </DashboardPageShell>
  );
}
