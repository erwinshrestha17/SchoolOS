"use client";

import type { PermissionKey } from "@schoolos/core";
import {
  BarChart3,
  ChevronDown,
  ClipboardCheck,
  FileText,
  History,
  LayoutDashboard,
  Receipt,
  Settings,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardPageShell } from "@/components/dashboard/dashboard-page-shell";
import { useSession } from "@/components/session-provider";
import { ModuleHeader } from "@/components/ui/module-header";
import { cn } from "@/lib/utils";

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

function matchesRoute(pathname: string, href: string) {
  if (href === "/dashboard/fees") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function FeesModuleShell({
  title,
  description,
  children,
  primaryAction,
  metadata,
}: FeesModuleShellProps) {
  const pathname = usePathname();
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
  const moreIsActive = visibleMoreNavigation.some((item) =>
    matchesRoute(pathname, item.href),
  );

  return (
    <DashboardPageShell className="space-y-6">
      <ModuleHeader
        title={title}
        description={`${description}${session?.tenant.name ? ` · ${session.tenant.name}` : ""}`}
        primaryAction={primaryAction}
        metadata={metadata}
        className="mb-0 pb-4"
      />

      <nav
        aria-label="Fees and receipts navigation"
        className="-mt-2 flex items-center border-b border-slate-200 pb-px"
      >
        <div className="scrollbar-none flex min-w-0 flex-1 items-center gap-1 overflow-x-auto xl:overflow-visible">
          {visiblePrimaryNavigation.map((item) => {
            const active = matchesRoute(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex min-h-11 shrink-0 items-center gap-2 px-3 text-sm font-semibold text-slate-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mod-fees-accent)] focus-visible:ring-offset-2",
                  active && "text-[var(--color-mod-fees-text)]",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {item.label}
                {active ? (
                  <span
                    className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--color-mod-fees-accent)]"
                    aria-hidden
                  />
                ) : null}
              </Link>
            );
          })}
        </div>

        {visibleMoreNavigation.length ? (
          <details className="group relative shrink-0">
            <summary
              className={cn(
                "flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-semibold text-slate-600 transition marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mod-fees-accent)] focus-visible:ring-offset-2",
                moreIsActive && "text-[var(--color-mod-fees-text)]",
              )}
            >
              More
              <ChevronDown
                className="h-4 w-4 transition group-open:rotate-180"
                aria-hidden
              />
              {moreIsActive ? (
                <span
                  className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--color-mod-fees-accent)]"
                  aria-hidden
                />
              ) : null}
            </summary>
            <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
              {visibleMoreNavigation.map((item) => {
                const active = matchesRoute(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mod-fees-accent)]",
                      active &&
                        "bg-[var(--color-mod-fees-bg)] text-[var(--color-mod-fees-text)]",
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </details>
        ) : null}
      </nav>

      <section aria-label={`${title} workspace`}>{children}</section>
    </DashboardPageShell>
  );
}
