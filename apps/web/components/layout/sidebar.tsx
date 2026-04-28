'use client';

import type { PermissionKey } from '@schoolos/core';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from '../session-provider';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  Wallet,
  GraduationCap,
  UserCog,
  Calculator,
  BookOpen,
  Bus,
  Megaphone,
  Settings,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: PermissionKey;
  badge?: number;
};

const navItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    permission: 'tenants:read',
  },
  {
    href: '/dashboard/admissions',
    label: 'Students',
    icon: Users,
    permission: 'students:create',
  },
  {
    href: '/dashboard/attendance',
    label: 'Attendance',
    icon: CalendarCheck,
    permission: 'attendance:mark',
  },
  {
    href: '/dashboard/finance',
    label: 'Fee Collection',
    icon: Wallet,
    permission: 'fees:manage',
  },
  {
    href: '/dashboard/academics',
    label: 'Academics',
    icon: GraduationCap,
    permission: 'academics:manage',
  },
  {
    href: '/dashboard/payroll',
    label: 'Staff & HR',
    icon: UserCog,
    permission: 'payroll:manage',
  },
  {
    href: '/dashboard/accounting',
    label: 'Accounting',
    icon: Calculator,
    permission: 'accounting:read',
  },
  {
    href: '/dashboard/timetable',
    label: 'Library',
    icon: BookOpen,
    permission: 'timetable:manage',
  },
  {
    href: '/dashboard/activity',
    label: 'Transport',
    icon: Bus,
    permission: 'activity_feed:create',
  },
  {
    href: '/dashboard/notices',
    label: 'Notices',
    icon: Megaphone,
    permission: 'notices:create',
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: Settings,
    permission: 'roles:read',
  },
];

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
};

export function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const { hasPermissions } = useSession();

  const sidebarContent = (
    <div
      className={`flex h-full flex-col bg-sidebar-900 text-white sidebar-transition ${
        collapsed ? 'w-[72px]' : 'w-[260px]'
      }`}
    >
      {/* Logo area */}
      <div className="flex h-16 items-center gap-3 px-4 border-b border-white/[0.06]">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-600 font-bold text-sm">
          S
        </div>
        <div
          className={`sidebar-label ${collapsed ? 'opacity-0 w-0' : 'opacity-100'}`}
        >
          <span className="font-semibold text-sm text-white truncate">
            SchoolOS
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const enabled = hasPermissions([item.permission]);
          const isExactDashboard =
            item.href === '/dashboard' && pathname === '/dashboard';
          const isSubRoute =
            item.href !== '/dashboard' && pathname?.startsWith(item.href);
          const active = isExactDashboard || isSubRoute;

          if (!enabled) return null;

          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onMobileClose()}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                active
                  ? 'bg-primary-600/15 text-primary-50'
                  : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
              } ${!enabled ? 'pointer-events-none opacity-30' : ''}`}
            >
              {/* Active left border */}
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-primary-500" />
              )}

              <Icon
                size={20}
                className={`shrink-0 ${active ? 'text-primary-400' : 'text-slate-500 group-hover:text-slate-300'}`}
              />

              <span
                className={`sidebar-label ${collapsed ? 'opacity-0 w-0' : 'opacity-100'}`}
              >
                {item.label}
              </span>

              {item.badge && !collapsed && (
                <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-danger-500 px-1.5 text-[0.6875rem] font-semibold text-white">
                  {item.badge}
                </span>
              )}

              {/* Tooltip for collapsed state */}
              {collapsed && (
                <span className="pointer-events-none absolute left-full ml-2 rounded-md bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-50 whitespace-nowrap">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle (desktop) */}
      <div className="hidden lg:block border-t border-white/[0.06] px-3 py-3">
        <button
          onClick={onToggle}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-500 hover:bg-white/[0.06] hover:text-slate-300 transition-colors"
        >
          {collapsed ? (
            <ChevronRight size={20} className="shrink-0" />
          ) : (
            <>
              <ChevronLeft size={20} className="shrink-0" />
              <span className="sidebar-label">Collapse</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="sidebar-overlay lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 lg:hidden sidebar-transition ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Force expanded on mobile */}
        <div className="flex h-full flex-col bg-sidebar-900 text-white w-[260px]">
          {/* Logo area */}
          <div className="flex h-16 items-center gap-3 px-4 border-b border-white/[0.06]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-600 font-bold text-sm">
              S
            </div>
            <span className="font-semibold text-sm text-white">SchoolOS</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
            {navItems.map((item) => {
              const enabled = hasPermissions([item.permission]);
              const isExactDashboard =
                item.href === '/dashboard' && pathname === '/dashboard';
              const isSubRoute =
                item.href !== '/dashboard' && pathname?.startsWith(item.href);
              const active = isExactDashboard || isSubRoute;

              if (!enabled) return null;

              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => onMobileClose()}
                  className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                    active
                      ? 'bg-primary-600/15 text-primary-50'
                      : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
                  } ${!enabled ? 'pointer-events-none opacity-30' : ''}`}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-primary-500" />
                  )}
                  <Icon
                    size={20}
                    className={`shrink-0 ${active ? 'text-primary-400' : 'text-slate-500 group-hover:text-slate-300'}`}
                  />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-danger-500 px-1.5 text-[0.6875rem] font-semibold text-white">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex h-screen sticky top-0 z-30">
        {sidebarContent}
      </aside>
    </>
  );
}
