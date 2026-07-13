"use client";

import { ReactNode } from "react";
import {
  LayoutDashboard,
  Calculator,
  History,
  FileText,
  BarChart3,
  ShieldCheck,
} from "lucide-react";
import { useSession } from "../../../components/session-provider";
import { DashboardPageShell } from "../../../components/dashboard/dashboard-page-shell";
import { ModuleTabs } from "../../../components/dashboard/module-tabs";
import { PageHeader } from "../../../components/ui/page-header";

export default function PayrollLayout({ children }: { children: ReactNode }) {
  const { session } = useSession();

  const navItems = [
    { href: "/dashboard/payroll", label: "Overview", icon: LayoutDashboard },
    {
      href: "/dashboard/payroll/salary-structures",
      label: "Salary Structures",
      icon: Calculator,
    },
    {
      href: "/dashboard/payroll/readiness",
      label: "Readiness",
      icon: ShieldCheck,
    },
    { href: "/dashboard/payroll/runs", label: "Payroll Runs", icon: History },
    { href: "/dashboard/payroll/payslips", label: "Payslips", icon: FileText },
    { href: "/dashboard/payroll/reports", label: "Reports", icon: BarChart3 },
  ];

  const tabs = (
    <ModuleTabs items={navItems} accentColor="purple" variant="light" />
  );

  return (
    <DashboardPageShell>
      <PageHeader
        title="Payroll"
        description={`Generate payroll runs, manage salary structures, and track statutory deductions for ${session?.tenant.name || "your school"}.`}
      />
      <div className="mb-6">{tabs}</div>
      <main>{children}</main>
    </DashboardPageShell>
  );
}
