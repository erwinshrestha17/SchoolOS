"use client";

import type { PermissionKey } from "@schoolos/core";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ReactNode, useState } from "react";
import { useSession } from "../session-provider";
import {
  Activity,
  Building2,
  ChevronDown,
  CreditCard,
  FileClock,
  Flag,
  LayoutDashboard,
  LogOut,
  Menu,
  KeyRound,
  MessageSquare,
  MonitorCheck,
  School,
  ShieldCheck,
  SlidersHorizontal,
  Webhook,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { SchoolBreadcrumbs } from "../schoolos/navigation/school-breadcrumbs";
import {
  PlatformNavHeading,
  SidebarNavLink,
} from "./sidebar-nav-link";

type PlatformNavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  permissions?: PermissionKey[];
  disabled?: boolean;
};

type PlatformNavGroup = {
  label: string;
  items: PlatformNavItem[];
};

const platformNavGroups: PlatformNavGroup[] = [
  {
    label: "Platform",
    items: [
      {
        href: "/platform/dashboard",
        label: "Dashboard",
        description: "Global SaaS health and tenant metrics",
        icon: LayoutDashboard,
        permissions: ["platform:dashboard:read"],
      },
      {
        href: "/platform/schools",
        label: "Schools",
        description: "Tenant onboarding, status and usage",
        icon: Building2,
        permissions: ["platform:tenants:read"],
      },
      {
        href: "/platform/demo-requests",
        label: "Demo Requests",
        description: "Public marketing intake and follow-up",
        icon: MessageSquare,
        permissions: ["platform:demo-requests:read"],
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        href: "/platform/settings?tab=health",
        label: "System Health",
        description: "Infrastructure readiness",
        icon: MonitorCheck,
        permissions: ["platform:health:read"],
      },
      {
        href: "/platform/audit",
        label: "Audit Logs",
        description: "Cross-tenant operator actions",
        icon: FileClock,
        permissions: ["platform:audit:read"],
      },
      {
        href: "/platform/settings?tab=queues",
        label: "Queue Health",
        description: "Failed jobs and retry audit",
        icon: Activity,
        permissions: ["platform:queues:read"],
      },
    ],
  },
  {
    label: "Configuration",
    items: [
      {
        href: "/platform/settings/plans",
        label: "Plans",
        description: "SchoolOS subscription plans and limits",
        icon: CreditCard,
        permissions: ["platform:plans:read"],
      },
      {
        href: "/platform/settings/providers",
        label: "Providers",
        description: "SMS, email and storage providers",
        icon: SlidersHorizontal,
        permissions: ["platform:providers:read"],
      },
      {
        href: "/platform/settings?tab=webhooks",
        label: "Webhooks",
        description: "Signed endpoint registry and delivery history",
        icon: Webhook,
        permissions: ["platform:providers:read"],
      },
      {
        href: "/platform/settings/modules",
        label: "Modules / Features",
        description: "Plan-backed feature availability",
        icon: Flag,
        permissions: ["platform:plans:read"],
      },
      {
        href: "/platform/settings/feature-flags",
        label: "Feature Flags",
        description: "Platform rollout controls",
        icon: Flag,
        permissions: ["platform:plans:read"],
      },
    ],
  },
  {
    label: "Billing",
    items: [
      {
        href: "/platform/billing/subscriptions",
        label: "Subscriptions",
        description: "SchoolOS school subscriptions",
        icon: CreditCard,
        permissions: ["platform:subscriptions:read"],
      },
      {
        href: "/platform/billing/invoices",
        label: "SaaS Invoices",
        description: "SchoolOS subscription invoices only",
        icon: FileClock,
        permissions: ["platform:billing:read"],
      },
      {
        href: "/platform/billing/payments",
        label: "Payments",
        description: "Platform SaaS payment records",
        icon: CreditCard,
        permissions: ["platform:billing:read"],
      },
    ],
  },
];

export function PlatformShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { session, logout } = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.toString();

  const visibleGroups = platformNavGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        canSeeNavItem(item, session?.user.permissions ?? []),
      ),
    }))
    .filter((group) => group.items.length > 0);
  const displayName = session?.user.email?.split("@")[0] ?? "Operator";
  const primaryRole =
    session?.user.roles[0]?.replace(/_/g, " ") ?? "Platform user";

  return (
    <div className="flex min-h-screen bg-slate-100">
      {mobileOpen && (
        <div
          className="sidebar-overlay lg:hidden"
          onClick={() => setMobileOpen(false)}
          role="button"
          tabIndex={0}
          aria-label="Close platform navigation"
        />
      )}

      <aside
        className={cn(
          "sidebar-transition fixed inset-y-0 left-0 z-50 flex w-[304px] flex-col border-r border-white/10 bg-[var(--platform-sidebar-bg)] text-white shadow-lg shadow-black/20 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mod-platform-accent text-sm font-black text-white shadow-lg shadow-mod-platform-accent/20">
              SO
            </div>
            <div>
              <p className="text-sm font-semibold text-white">SchoolOS</p>
              <p className="text-xs font-semibold text-[var(--platform-sidebar-text)]">
                Control Plane
              </p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-xl p-2 text-[var(--platform-sidebar-muted)] hover:bg-[var(--platform-sidebar-hover)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[var(--platform-sidebar-focus)] focus:ring-offset-2 focus:ring-offset-[var(--platform-sidebar-bg)] lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close platform navigation"
          >
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-white/10 px-5 py-4">
          <div className="rounded-2xl border border-white/10 bg-[var(--platform-sidebar-hover)] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--platform-sidebar-text)]">
              <ShieldCheck size={14} />
              Operator scope
            </div>
            <p className="mt-2 text-sm text-[var(--platform-sidebar-text)]">
              Cross-tenant operations for SchoolOS owners only. School module
              data remains tenant-scoped inside the admin workspace.
            </p>
          </div>
        </div>

        <nav
          className="flex-1 overflow-y-auto px-3 py-4"
          aria-label="Platform navigation"
        >
          {visibleGroups.map((group) => (
            <div key={group.label} className="mb-5 last:mb-0">
              <PlatformNavHeading>{group.label}</PlatformNavHeading>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <PlatformNavEntry
                    key={`${item.href}:${item.label}`}
                    item={item}
                    pathname={pathname}
                    currentSearch={currentSearch}
                    onClick={() => setMobileOpen(false)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <Link
            href="/platform/account-security"
            className="mb-2 flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-[var(--platform-sidebar-text)] transition-colors hover:bg-[var(--platform-sidebar-hover)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[var(--platform-sidebar-focus)] focus:ring-offset-2 focus:ring-offset-[var(--platform-sidebar-bg)]"
          >
            <KeyRound size={18} />
            Account &amp; Security
          </Link>
          <Link
            href="/dashboard"
            className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-[var(--platform-sidebar-text)] transition-colors hover:bg-[var(--platform-sidebar-hover)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[var(--platform-sidebar-focus)] focus:ring-offset-2 focus:ring-offset-[var(--platform-sidebar-bg)]"
          >
            <School size={18} />
            School workspace
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-16 items-center gap-4 border-b border-slate-200 bg-white/95 px-4 shadow-sm shadow-slate-200/40 backdrop-blur lg:px-8">
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-controls="platform-main"
            aria-label="Open platform navigation"
          >
            <Menu size={20} />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-mod-platform-text">
              <Activity size={14} />
              Platform operator console
            </div>
            <h1 className="truncate text-base font-semibold text-slate-950">
              Cross-tenant management, onboarding, usage and system health
            </h1>
          </div>

          <div className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 sm:flex">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-mod-platform-text)] text-xs font-bold text-white">
              {displayName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="max-w-[140px] truncate text-sm font-semibold capitalize text-slate-900">
                {displayName}
              </p>
              <p className="max-w-[140px] truncate text-xs capitalize text-slate-500">
                {primaryRole}
              </p>
            </div>
            <ChevronDown size={14} className="text-slate-400" />
          </div>

          <Link
            href="/platform/account-security"
            className="hidden min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:ring-offset-2 md:flex"
          >
            <KeyRound size={16} />
            <span>Account &amp; Security</span>
          </Link>

          <button
            type="button"
            onClick={() => void logout()}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-danger-200 hover:bg-danger-50 hover:text-danger-700 focus:outline-none focus:ring-2 focus:ring-danger-100 focus:ring-offset-2"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </header>

        <main
          id="platform-main"
          data-module="platform"
          className="flex-1 overflow-y-auto focus:outline-none"
          tabIndex={-1}
        >
          <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8">
            <SchoolBreadcrumbs rootHref="/platform" rootLabel="Platform" className="mb-4" />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function PlatformNavEntry({
  item,
  pathname,
  currentSearch,
  onClick,
}: {
  item: PlatformNavItem;
  pathname: string | null;
  currentSearch: string;
  onClick: () => void;
}) {
  const active =
    !item.disabled && isActivePlatformRoute(item.href, pathname, currentSearch);

  return (
    <SidebarNavLink
      href={item.href}
      label={item.label}
      icon={item.icon}
      description={item.description}
      active={active}
      disabled={item.disabled}
      variant="dark"
      onNavigate={onClick}
    />
  );
}

function canSeeNavItem(item: PlatformNavItem, permissions: PermissionKey[]) {
  if (!item.permissions?.length) {
    return true;
  }

  const permissionSet = new Set(permissions);
  return item.permissions.some((permission) => permissionSet.has(permission));
}

function isActivePlatformRoute(
  href: string,
  pathname: string | null,
  currentSearch: string,
) {
  const [hrefPath, hrefQuery = ""] = href.split("?");

  if (!pathname) {
    return false;
  }

  if (
    !hrefQuery &&
    (pathname === hrefPath || pathname.startsWith(`${hrefPath}/`))
  ) {
    return true;
  }

  const redirectedTabRoutes: Record<string, string> = {
    "/platform/settings/plans": "tab=plans",
    "/platform/settings/modules": "tab=plans",
    "/platform/settings/feature-flags": "tab=plans",
    "/platform/settings/providers": "tab=providers",
  };

  const redirectedWorkflowRoutes: Record<string, string> = {
    "/platform/billing/subscriptions": "workflow=subscriptions",
    "/platform/billing/invoices": "workflow=saas-invoices",
    "/platform/billing/payments": "workflow=payments",
  };

  if (
    pathname === "/platform/settings" &&
    redirectedTabRoutes[hrefPath] === currentSearch
  ) {
    return true;
  }

  if (
    pathname === "/platform/schools" &&
    redirectedWorkflowRoutes[hrefPath] === currentSearch
  ) {
    return true;
  }

  if (!hrefQuery) {
    return false;
  }

  return pathname === hrefPath && currentSearch === hrefQuery;
}
