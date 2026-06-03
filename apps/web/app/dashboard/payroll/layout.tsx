'use client';

import { ReactNode } from 'react';
import { Wallet, LayoutDashboard, Calculator, History, FileText, BarChart3 } from 'lucide-react';
import { useSession } from '../../../components/session-provider';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { ModuleHero } from '../../../components/dashboard/module-hero';
import { ModuleTabs } from '../../../components/dashboard/module-tabs';

export default function PayrollLayout({ children }: { children: ReactNode }) {
  const { session } = useSession();

  const navItems = [
    { href: '/dashboard/payroll', label: 'Overview', icon: LayoutDashboard },
    { href: '/dashboard/payroll/salary-structures', label: 'Salary Structures', icon: Calculator },
    { href: '/dashboard/payroll/runs', label: 'Payroll Runs', icon: History },
    { href: '/dashboard/payroll/payslips', label: 'Payslips', icon: FileText },
    { href: '/dashboard/payroll/reports', label: 'Reports', icon: BarChart3 },
  ];

  const tabs = <ModuleTabs items={navItems} accentColor="emerald" variant="dark" />;

  return (
    <DashboardPageShell>
      <ModuleHero
        title="Payroll Workspace"
        subtitle={`Generate payroll runs, manage salary structures, and track statutory deductions for ${session?.tenant.name || 'your school'}.`}
        badge="Payroll"
        category="Compensation & Benefits"
        icon={<Wallet size={32} className="text-emerald-400" />}
        accentColor="emerald"
        variant="dark"
        tabs={tabs}
      />
      <main>
        {children}
      </main>
    </DashboardPageShell>
  );
}
