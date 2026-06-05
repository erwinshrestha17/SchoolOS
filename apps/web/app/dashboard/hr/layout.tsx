'use client';

import { ReactNode } from 'react';
import { Users, LayoutDashboard, CalendarDays, ClipboardCheck, FileText } from 'lucide-react';
import { useSession } from '../../../components/session-provider';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { ModuleTabs } from '../../../components/dashboard/module-tabs';
import { PageHeader } from '../../../components/ui/page-header';

export default function HRLayout({ children }: { children: ReactNode }) {
  const { session } = useSession();

  const navItems = [
    { href: '/dashboard/hr', label: 'Overview', icon: LayoutDashboard },
    { href: '/dashboard/hr/staff', label: 'Staff Directory', icon: Users },
    { href: '/dashboard/hr/attendance', label: 'Staff Attendance', icon: ClipboardCheck },
    { href: '/dashboard/hr/leave', label: 'Leave Requests', icon: CalendarDays },
    { href: '/dashboard/hr/contracts', label: 'Contracts', icon: FileText },
  ];

  const tabs = <ModuleTabs items={navItems} accentColor="purple" variant="light" />;

  return (
    <DashboardPageShell>
      <PageHeader
        title="HR"
        description={`Manage staff profiles, contracts, leave workflows, and attendance for ${session?.tenant.name || 'your school'}.`}
      />
      <div className="mb-6">{tabs}</div>
      <main>
        {children}
      </main>
    </DashboardPageShell>
  );
}
