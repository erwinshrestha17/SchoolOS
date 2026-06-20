'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  BookmarkCheck,
  Copy,
  FileText,
  Library,
  RotateCcw,
} from 'lucide-react';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { ModuleTabs } from '../../../components/dashboard/module-tabs';
import { LibraryWorkspace } from '../../../components/library/library-workspace';
import { ModuleHeader } from '../../../components/ui/module-header';

const libraryTabs = [
  { label: 'Overview', href: '/dashboard/library' },
  { label: 'Catalog', href: '/dashboard/library/catalog' },
  { label: 'Copies', href: '/dashboard/library/copies' },
  { label: 'Issue / Return', href: '/dashboard/library/issue-return' },
  { label: 'Borrowers', href: '/dashboard/library/borrowers' },
  { label: 'Reservations', href: '/dashboard/library/reservations' },
  { label: 'Overdue', href: '/dashboard/library/overdue' },
  { label: 'Fines', href: '/dashboard/library/fines' },
  { label: 'Reports', href: '/dashboard/library/reports' },
];

export default function LibraryPage() {
  const router = useRouter();

  return (
    <DashboardPageShell>
      <ModuleHeader
        eyebrow="M8 Library"
        title="Library"
        description="Manage book catalogues, barcode copies, scanner-first issue-return workflows, overdue tracking, and fine posting status."
        primaryAction={
          <Link
            href="/dashboard/library/issue-return"
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--primary-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)] focus:ring-offset-2 active:scale-[0.98]"
          >
            <RotateCcw className="h-4 w-4" />
            Issue / Return
          </Link>
        }
        moreActionItems={[
          {
            label: 'Catalog',
            icon: <BookOpen className="h-4 w-4" />,
            onClick: () => router.push('/dashboard/library/catalog'),
          },
          {
            label: 'Copies',
            icon: <Copy className="h-4 w-4" />,
            onClick: () => router.push('/dashboard/library/copies'),
          },
          {
            label: 'Fines',
            icon: <FileText className="h-4 w-4" />,
            onClick: () => router.push('/dashboard/library/fines'),
          },
          {
            label: 'Reservations',
            icon: <BookmarkCheck className="h-4 w-4" />,
            onClick: () => router.push('/dashboard/library/reservations'),
          },
          {
            label: 'Reports',
            icon: <Library className="h-4 w-4" />,
            onClick: () => router.push('/dashboard/library/reports'),
          },
        ]}
      >
        <ModuleTabs items={libraryTabs} accentColor="emerald" variant="light" />
      </ModuleHeader>
      <LibraryWorkspace initialTab="overview" />
    </DashboardPageShell>
  );
}
