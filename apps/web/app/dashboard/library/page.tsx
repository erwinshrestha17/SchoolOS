'use client';

import { BookOpen } from 'lucide-react';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { ModuleHero } from '../../../components/dashboard/module-hero';
import { ModuleTabs } from '../../../components/dashboard/module-tabs';
import { LibraryWorkspace } from '../../../components/library/library-workspace';

const libraryTabs = [
  { label: 'Overview', href: '/dashboard/library' },
  { label: 'Books', href: '/dashboard/library/books' },
  { label: 'Copies', href: '/dashboard/library/copies' },
  { label: 'Issues', href: '/dashboard/library/issues' },
  { label: 'Overdue', href: '/dashboard/library/overdue' },
  { label: 'Fines', href: '/dashboard/library/fines' },
  { label: 'Reports', href: '/dashboard/library/reports' },
];

export default function LibraryPage() {
  return (
    <DashboardPageShell>
      <ModuleHero
        title="Library Management"
        subtitle="Manage book catalogues, barcode copies, issue-return workflows, overdue tracking, and library reminders."
        badge="Library"
        category="Academic Resources"
        icon={<BookOpen size={28} />}
        accentColor="emerald"
        tabs={<ModuleTabs items={libraryTabs} accentColor="emerald" />}
      />
      <LibraryWorkspace initialTab="overview" />
    </DashboardPageShell>
  );
}
