'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

/**
 * Maps route segments to human-readable labels.
 */
const segmentLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  students: 'Students',
  admissions: 'Admissions',
  attendance: 'Attendance',
  fees: 'Fees',
  academics: 'Academics',
  hr: 'HR & Payroll',
  payroll: 'Payroll',
  accounting: 'Accounting',
  homework: 'Homework & Timetable',
  timetable: 'Timetable',
  activity: 'Activity Feed',
  notices: 'Communications',
  messaging: 'Messaging',
  messages: 'Messages',
  settings: 'Settings',
  library: 'Library',
  transport: 'Transport',
  canteen: 'Canteen',
  reports: 'Reports',
};

export function Breadcrumbs() {
  const pathname = usePathname();

  if (!pathname || pathname === '/dashboard') return null;

  const segments = pathname
    .replace(/^\/dashboard\/?/, '')
    .split('/')
    .filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((segment, index) => {
    const href = '/dashboard/' + segments.slice(0, index + 1).join('/');
    const label =
      segmentLabels[segment] ??
      segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
    const isLast = index === segments.length - 1;
    return { href, label, isLast };
  });

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 text-sm text-slate-500 animate-fade-in"
    >
      <Link
        href="/dashboard"
        className="flex items-center gap-1 text-slate-400 transition-colors hover:text-[var(--primary)]"
      >
        <Home size={14} />
        <span className="hidden sm:inline">Dashboard</span>
      </Link>

      {crumbs.map((crumb) => (
        <span key={crumb.href} className="flex items-center gap-1">
          <ChevronRight size={14} className="breadcrumb-separator" />
          {crumb.isLast ? (
            <span className="font-semibold text-slate-900">{crumb.label}</span>
          ) : (
            <Link
              href={crumb.href}
              className="transition-colors hover:text-[var(--primary)]"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
