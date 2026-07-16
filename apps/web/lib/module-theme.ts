/**
 * SchoolOS module theming scope.
 *
 * Each authenticated route family belongs to one module identity from the
 * SchoolOS Colour Direction (M0-M14). The shell stamps the resolved slug as
 * `data-module` on the workspace container; `app/globals.css` maps that
 * attribute onto the generic `--mod-accent/--mod-soft/--mod-border/--mod-text`
 * slots consumed by shared primitives (active workspace tab, selected table
 * row, header eyebrow, module-toned icon chips).
 *
 * Module colour identifies location only. Semantic status colours and the
 * brand-blue primary action are never module-scoped.
 */

export type ModuleSlug =
  | 'dashboard'
  | 'platform'
  | 'admissions'
  | 'attendance'
  | 'fees'
  | 'academics'
  | 'activity'
  | 'homework'
  | 'hr'
  | 'library'
  | 'transport'
  | 'canteen'
  | 'accounting'
  | 'notices'
  | 'learning'
  | 'intelligence'
  | 'reports'
  | 'settings';

/** First /dashboard/* path segment -> owning module identity. */
const DASHBOARD_SEGMENT_MODULES: Record<string, ModuleSlug> = {
  students: 'admissions',
  admissions: 'admissions',
  attendance: 'attendance',
  fees: 'fees',
  finance: 'fees',
  academics: 'academics',
  activity: 'activity',
  homework: 'homework',
  timetable: 'homework',
  hr: 'hr',
  payroll: 'hr',
  staff: 'hr',
  library: 'library',
  transport: 'transport',
  canteen: 'canteen',
  accounting: 'accounting',
  notices: 'notices',
  communications: 'notices',
  messaging: 'notices',
  messages: 'notices',
  notifications: 'notices',
  learning: 'learning',
  reports: 'reports',
  settings: 'settings',
  'account-security': 'settings',
  'my-profile': 'settings',
  setup: 'settings',
};

/**
 * Resolve the module identity for a route. Unknown or cross-module routes
 * (Dashboard Home, operations) stay on the core SchoolOS identity so shared
 * primitives fall back to the brand tint.
 */
export function moduleSlugForPath(
  pathname: string | null | undefined,
): ModuleSlug {
  if (!pathname) return 'dashboard';
  if (pathname === '/platform' || pathname.startsWith('/platform/')) {
    return 'platform';
  }
  const segment = pathname.replace(/^\/dashboard\/?/, '').split('/')[0];
  return DASHBOARD_SEGMENT_MODULES[segment] ?? 'dashboard';
}
