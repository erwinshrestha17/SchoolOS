'use client';

import { ReactNode } from 'react';
import { Users, LayoutDashboard, CalendarDays, ClipboardCheck, FileText } from 'lucide-react';
import { useSession } from '../../../components/session-provider';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { ModuleHero } from '../../../components/dashboard/module-hero';
import { ModuleTabs } from '../../../components/dashboard/module-tabs';

export default function HRLayout({ children }: { children: ReactNode }) {
  const { session } = useSession();

  const navItems = [
    { href: '/dashboard/hr', label: 'Overview', icon: LayoutDashboard },
    { href: '/dashboard/hr/staff', label: 'Staff Directory', icon: Users },
    { href: '/dashboard/hr/attendance', label: 'Staff Attendance', icon: ClipboardCheck },
    { href: '/dashboard/hr/leave', label: 'Leave Requests', icon: CalendarDays },
    { href: '/dashboard/hr/contracts', label: 'Contracts', icon: FileText },
  ];

  const tabs = <ModuleTabs items={navItems} accentColor="blue" variant="dark" />;

  return (
    <DashboardPageShell>
      <ModuleHero
        title="HR Workspace"
        subtitle={`Manage staff profiles, contracts, leave workflows, and track attendance for ${session?.tenant.name || 'your school'}.`}
        badge="Human Resources"
        category="Staff Management"
        icon={<Users size={32} className="text-blue-400" />}
        accentColor="blue"
        variant="dark"
        tabs={tabs}
      />
      <main>
        {children}
      </main>
    </DashboardPageShell>
  );
}
