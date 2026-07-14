'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/primitives/breadcrumb';
import { useCurrentBreadcrumbLabel } from './breadcrumb-label-context';

/** Route segment -> human label. Extend as new top-level routes ship. */
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  students: 'Students',
  admissions: 'Admissions',
  attendance: 'Attendance',
  corrections: 'Corrections',
  fees: 'Fees & Receipts',
  finance: 'Fees & Receipts',
  collect: 'Collect Payment',
  invoices: 'Invoices',
  ledgers: 'Student Ledgers',
  receipts: 'Receipts',
  adjustments: 'Adjustments',
  'cashier-close': 'Cashier Close',
  setup: 'Setup',
  academics: 'Academics',
  marks: 'Marks Entry',
  exams: 'Exams',
  'report-cards': 'Report Cards',
  activity: 'Activity Feed',
  gallery: 'Gallery',
  homework: 'Homework',
  timetable: 'Timetable',
  builder: 'Builder',
  conflicts: 'Conflicts',
  substitutions: 'Substitutions',
  versions: 'Versions',
  workload: 'Workload',
  hr: 'HR & Payroll',
  staff: 'Staff',
  payroll: 'Payroll',
  runs: 'Payroll Runs',
  payslips: 'Payslips',
  readiness: 'Readiness',
  'salary-structures': 'Salary Structures',
  leave: 'Leave',
  contracts: 'Contracts',
  accounting: 'Accounting',
  library: 'Library',
  books: 'Books',
  borrowers: 'Borrowers',
  catalog: 'Catalog',
  copies: 'Copies',
  fines: 'Fines',
  'issue-return': 'Issue / Return',
  issues: 'Issues',
  overdue: 'Overdue',
  reservations: 'Reservations',
  transport: 'Transport',
  routes: 'Routes',
  vehicles: 'Vehicles',
  trips: 'Trips',
  assignments: 'Assignments',
  'live-status': 'Live Status',
  location: 'Location',
  canteen: 'Canteen',
  learning: 'Learning',
  activities: 'Activities',
  sessions: 'Sessions',
  resources: 'Resources',
  lab: 'Lab',
  'smart-board': 'Smart Board',
  launch: 'Launch',
  progress: 'Progress',
  notices: 'Notices & Announcements',
  new: 'New',
  deliveries: 'Delivery Logs',
  communications: 'Legacy notification route',
  messaging: 'Chat deferred',
  messages: 'Chat deferred',
  moderation: 'Moderation',
  threads: 'Threads',
  recipients: 'Recipient Preview',
  templates: 'Templates',
  'provider-diagnostics': 'Provider Diagnostics',
  reports: 'Reports',
  operations: 'Operations',
  settings: 'Settings',
  overview: 'Overview',
  profile: 'Profile',
  'my-profile': 'My Profile',
  'account-security': 'Account & Security',
  security: 'Security',
  'security-audit': 'Security Audit',
  'audit-log': 'Audit Log',
  'audit-export': 'Audit Export',
  users: 'Users',
  'users-access': 'Users & Access',
  'users-roles': 'Users & Roles',
  'roles-permissions': 'Roles & Permissions',
  billing: 'Billing',
  plans: 'Plans',
  modules: 'Modules',
  notifications: 'Notifications',
  integrations: 'Integrations',
  onboarding: 'Onboarding',
  'academic-calendar': 'Academic Calendar',
  'academic-structure': 'Academic Structure',
  'classes-sections': 'Classes & Sections',
  'branding-documents': 'Branding & Documents',
  'documents-templates': 'Documents & Templates',
  'data-operations': 'Data Operations',
  'exams-report-cards': 'Exams & Report Cards',
  'homework-timetable-learning': 'Homework, Timetable & Learning',
  'school-profile': 'School Profile',
  policies: 'Policies',
};

/** Path segments longer than this with a mix of characters read as an opaque ID, not a label. */
const ID_LIKE = /^[0-9a-f]{8,}(-[0-9a-f]{4,}){0,4}$/i;

function labelFor(segment: string) {
  const known = SEGMENT_LABELS[segment];
  if (known) return known;
  if (ID_LIKE.test(segment) || segment.length > 24) return 'Detail';
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
}

export type SchoolBreadcrumbsProps = {
  /** Root the trail is relative to, e.g. "/dashboard" or "/platform". */
  rootHref?: string;
  rootLabel?: string;
  /**
   * Override the label for the last (current) segment — use this when a
   * page has already fetched the real record name (invoice number, student
   * name, notice title) instead of showing a raw ID or generic "Detail".
   */
  currentLabel?: string;
  className?: string;
};

/**
 * Derives a breadcrumb trail from the current pathname. Global — mounted
 * once in the dashboard/platform shell rather than per page, per the
 * "one screen must answer: where am I" rule.
 */
export function SchoolBreadcrumbs({
  rootHref = '/dashboard',
  rootLabel = 'Dashboard',
  currentLabel,
  className,
}: SchoolBreadcrumbsProps) {
  const pathname = usePathname();
  const pageProvidedLabel = useCurrentBreadcrumbLabel(pathname);
  const effectiveCurrentLabel = currentLabel ?? pageProvidedLabel;

  if (!pathname || pathname === rootHref) return null;

  const segments = pathname
    .replace(new RegExp(`^${rootHref}/?`), '')
    .split('/')
    .filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((segment, index) => {
    const href = `${rootHref}/${segments.slice(0, index + 1).join('/')}`;
    const isLast = index === segments.length - 1;
    const label =
      isLast && effectiveCurrentLabel
        ? effectiveCurrentLabel
        : labelFor(segment);
    return { href, label, isLast };
  });

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={rootHref} className="flex items-center gap-1.5">
              <Home className="size-3.5" />
              <span className="hidden sm:inline">{rootLabel}</span>
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {crumbs.map((crumb) => (
          <Fragment key={crumb.href}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {crumb.isLast ? (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={crumb.href}>{crumb.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
