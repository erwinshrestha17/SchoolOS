"use client";

import type { ReactNode } from "react";
import type { PermissionKey } from "@schoolos/core";
import Link from "next/link";
import { QrCode, Utensils } from "lucide-react";
import { DashboardPageShell } from "../../../components/dashboard/dashboard-page-shell";
import { ModuleHeader } from "../../../components/ui/module-header";
import { WorkspaceTabs } from "../../../components/ui/module-tabs";
import { usePermissionAccess } from "../../../lib/permissions-ui";

const canteenTabs = [
  {
    label: "Overview",
    href: "/dashboard/canteen",
    permissions: [
      "canteen:serving:read",
      "canteen:pos:read",
      "canteen:reports:read",
    ],
  },
  { label: "Menu", href: "/dashboard/canteen/menu", permissions: ["canteen:menu:read"] },
  { label: "Meal Plans", href: "/dashboard/canteen/meal-plans", permissions: ["canteen:plans:read"] },
  { label: "Serving", href: "/dashboard/canteen/serving", permissions: ["canteen:serving:read"] },
  { label: "Wallets", href: "/dashboard/canteen/wallets", permissions: ["canteen:wallets:read"] },
  { label: "POS", href: "/dashboard/canteen/pos", permissions: ["canteen:pos:read"] },
  { label: "Stock & Suppliers", href: "/dashboard/canteen/stock", permissions: ["canteen:inventory:read"] },
] satisfies Array<{ label: string; href: string; permissions: PermissionKey[] }>;

const canteenOverflowTabs = [
  { label: "Enrollments", href: "/dashboard/canteen/enrollments", permissions: ["canteen:enrollments:read"] },
  { label: "Spending Controls", href: "/dashboard/canteen/controls", permissions: ["canteen:controls:read"] },
  { label: "Reports", href: "/dashboard/canteen/reports", permissions: ["canteen:reports:read"] },
] satisfies Array<{ label: string; href: string; permissions: PermissionKey[] }>;

export default function CanteenLayout({ children }: { children: ReactNode }) {
  const access = usePermissionAccess();
  const visibleTabs = canteenTabs.filter((tab) =>
    access.hasAnyPermission(tab.permissions),
  );
  const visibleOverflowTabs = canteenOverflowTabs.filter((tab) =>
    access.hasAnyPermission(tab.permissions),
  );

  return (
    <DashboardPageShell>
      <ModuleHeader
        eyebrow="School Operations"
        title="Canteen"
        description="Run meal serving, wallets, POS sales, spending controls, and stock operations with student safety warnings in view."
        primaryAction={access.hasPermission("canteen:pos:read") ? (
          <Link
            href="/dashboard/canteen/pos"
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--primary-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)] focus:ring-offset-2"
          >
            <QrCode aria-hidden="true" className="h-4 w-4" />
            Open POS
          </Link>
        ) : undefined}
        secondaryActions={access.hasPermission("canteen:serving:read") ? (
          <Link
            href="/dashboard/canteen/serving"
            className="btn-secondary inline-flex h-9 items-center gap-2"
          >
            <Utensils aria-hidden="true" className="h-4 w-4" />
            Serving counter
          </Link>
        ) : undefined}
      />
      <WorkspaceTabs
        items={visibleTabs}
        overflowItems={visibleOverflowTabs}
        overflowLabel="More"
        label="Canteen workspace views"
      />
      <main>{children}</main>
    </DashboardPageShell>
  );
}
