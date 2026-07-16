"use client";

import type { PermissionKey } from "@schoolos/core";
import {
  BarChart3,
  ClipboardCheck,
  FileText,
  History,
  LayoutDashboard,
  Receipt,
  Settings,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { DashboardPageShell } from "@/components/dashboard/dashboard-page-shell";
import { useSession } from "@/components/session-provider";
import { ModuleHeader } from "@/components/ui/module-header";
import { WorkspaceTabs } from "@/components/ui/module-tabs";

type FeesModuleShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  primaryAction?: ReactNode;
  metadata?: ReactNode;
};

type FeesNavigationItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permissions?: PermissionKey[];
};

const primaryNavigation: FeesNavigationItem[] = [
  {
    href: "/dashboard/fees",
    label: "Overview",
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/fees/collect",
    label: "Collect",
    icon: Wallet,
    permissions: ["payments:collect"],
  },
  {
    href: "/dashboard/fees/invoices",
    label: "Invoices",
    icon: FileText,
    permissions: ["payments:collect"],
  },
  {
    href: "/dashboard/fees/receipts",
    label: "Receipts",
    icon: Receipt,
    permissions: ["receipts:read"],
  },
  {
    href: "/dashboard/fees/cashier-close",
    label: "Cashier Close",
    icon: History,
    permissions: ["payments:close"],
  },
];

const moreNavigation: FeesNavigationItem[] = [
  {
    href: "/dashboard/fees/billing",
    label: "Billing runs",
    icon: ClipboardCheck,
    permissions: ["fees:bill"],
  },
  {
    href: "/dashboard/fees/adjustments",
    label: "Adjustments",
    icon: ShieldAlert,
    permissions: [
      "payments:collect",
      "payments:refund",
      "payments:reverse",
      "fees:adjust",
      "fees:discount",
    ],
  },
  {
    href: "/dashboard/fees/ledgers",
    label: "Student ledgers",
    icon: FileText,
    permissions: ["ledger:read"],
  },
  {
    href: "/dashboard/fees/reports",
    label: "Reports",
    icon: BarChart3,
    permissions: ["fees:manage"],
  },
  {
    href: "/dashboard/fees/setup",
    label: "Setup",
    icon: Settings,
    permissions: ["fees:manage", "fees:bill", "fees:discount"],
  },
];

export function FeesModuleShell({
  title,
  description,
  children,
  primaryAction,
  metadata,
}: FeesModuleShellProps) {
  const { hasPermissions, session } = useSession();
  const hasAnyPermission = (permissions?: PermissionKey[]) =>
    !permissions?.length ||
    permissions.some((permission) => hasPermissions([permission]));
  const visiblePrimaryNavigation = primaryNavigation.filter((item) =>
    hasAnyPermission(item.permissions),
  );
  const visibleMoreNavigation = moreNavigation.filter((item) =>
    hasAnyPermission(item.permissions),
  );
  const workspaceTabs = [...visiblePrimaryNavigation, ...visibleMoreNavigation].map(
    (item) => ({ href: item.href, label: item.label, icon: item.icon }),
  );

  return (
    <DashboardPageShell>
      <ModuleHeader
        eyebrow="Daily Operations"
        title={title}
        description={`${description}${session?.tenant.name ? ` · ${session.tenant.name}` : ""}`}
        primaryAction={primaryAction}
        metadata={metadata}
      />

      <WorkspaceTabs items={workspaceTabs} label="Fees and receipts navigation" />

      <section aria-label={`${title} workspace`}>{children}</section>
    </DashboardPageShell>
  );
}
