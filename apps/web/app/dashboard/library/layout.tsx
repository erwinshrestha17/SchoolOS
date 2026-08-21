'use client';

import type { ReactNode } from 'react';
import type { PermissionKey } from '@schoolos/core';
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
import { TeacherLibraryWorkspace } from '../../../components/library/teacher-library-workspace';
import { ModuleHeader } from '../../../components/ui/module-header';
import { WorkspaceTabs } from '../../../components/ui/module-tabs';
import { TeacherCapability, useTeacherAccess } from '../../../lib/teacher-access';
import { usePermissionAccess } from '../../../lib/permissions-ui';

const libraryTabs = [
  {
    label: 'Overview',
    href: '/dashboard/library',
    permissions: [
      'library:books:read',
      'library:copies:read',
      'library:issues:read',
      'library:reports:read',
    ],
  },
  { label: 'Catalog', href: '/dashboard/library/catalog', permissions: ['library:books:read'] },
  { label: 'Copies', href: '/dashboard/library/copies', permissions: ['library:copies:read'] },
  { label: 'Issue / Return', href: '/dashboard/library/issue-return', permissions: ['library:issues:read'] },
  { label: 'Reservations', href: '/dashboard/library/reservations', permissions: ['library:issues:read'] },
  { label: 'Overdue', href: '/dashboard/library/overdue', permissions: ['library:reports:read'] },
  { label: 'Fines', href: '/dashboard/library/fines', permissions: ['library:reports:read'] },
  { label: 'Reports', href: '/dashboard/library/reports', permissions: ['library:reports:read'] },
] satisfies Array<{ label: string; href: string; permissions: PermissionKey[] }>;

export default function LibraryLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isRestricted } = useTeacherAccess();
  const access = usePermissionAccess();
  const showBorrowerWorkspace = isRestricted(TeacherCapability.LIBRARY_ADMIN);
  const visibleTabs = libraryTabs.filter((tab) =>
    access.hasAnyPermission(tab.permissions),
  );
  const moreActionItems = [
    { label: 'Catalog', icon: <BookOpen className="h-4 w-4" />, onClick: () => router.push('/dashboard/library/catalog'), permission: 'library:books:read' },
    { label: 'Copies', icon: <Copy className="h-4 w-4" />, onClick: () => router.push('/dashboard/library/copies'), permission: 'library:copies:read' },
    { label: 'Fines', icon: <FileText className="h-4 w-4" />, onClick: () => router.push('/dashboard/library/fines'), permission: 'library:reports:read' },
    { label: 'Reservations', icon: <BookmarkCheck className="h-4 w-4" />, onClick: () => router.push('/dashboard/library/reservations'), permission: 'library:issues:read' },
    { label: 'Reports', icon: <Library className="h-4 w-4" />, onClick: () => router.push('/dashboard/library/reports'), permission: 'library:reports:read' },
  ].filter((item) => access.hasPermission(item.permission as PermissionKey));

  if (showBorrowerWorkspace) {
    return (
      <DashboardPageShell>
        <ModuleHeader
          eyebrow="Resources"
          title="Library"
          description="Search the catalogue and track the books you have borrowed."
        />
        <TeacherLibraryWorkspace />
      </DashboardPageShell>
    );
  }

  return (
    <DashboardPageShell>
      <ModuleHeader
        eyebrow="School Operations"
        title="Library"
        description="Manage the catalogue, copies, issue and return, reservations, overdue records, fines, and reports."
        primaryAction={access.hasPermission('library:issues:read') ? (
          <Link
            href="/dashboard/library/issue-return"
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--primary-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)] focus:ring-offset-2 active:scale-[0.98]"
          >
            <RotateCcw className="h-4 w-4" />
            Issue / Return
          </Link>
        ) : undefined}
        moreActionItems={moreActionItems}
      />
      <WorkspaceTabs items={visibleTabs} />
      <main>{children}</main>
    </DashboardPageShell>
  );
}
