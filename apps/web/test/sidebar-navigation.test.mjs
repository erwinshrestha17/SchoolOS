import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sidebar = readFileSync(
  join(webRoot, 'components/layout/sidebar.tsx'),
  'utf8',
);
const personaNavEntry = readFileSync(
  join(webRoot, 'components/layout/sidebar-persona-nav.config.ts'),
  'utf8',
);
const personaNavBase = readFileSync(
  join(webRoot, 'components/layout/sidebar-persona-nav.base.ts'),
  'utf8',
);
// The active wrapper comes first so explicit Principal overrides win source
// inspection just as they do in the module export surface.
const personaNavConfig = `${personaNavEntry}\n${personaNavBase}`;
const sidebarNavLink = readFileSync(
  join(webRoot, 'components/layout/sidebar-nav-link.tsx'),
  'utf8',
);
const navModuleMap = readFileSync(
  join(webRoot, 'lib/nav-module-map.ts'),
  'utf8',
);
const commandPalette = readFileSync(
  join(webRoot, 'components/layout/command-palette.tsx'),
  'utf8',
);
const dashboardLayout = readFileSync(
  join(webRoot, 'app/dashboard/layout.tsx'),
  'utf8',
);

const PRINCIPAL_EXCLUDED_PERMISSIONS = [
  'fees:manage',
  'payments:collect',
  'settings:manage',
  'payroll:read',
];

function sliceNavGroupsExport(source, navGroupsName) {
  const start = source.indexOf(`export const ${navGroupsName}`);
  assert.notEqual(start, -1, `${navGroupsName} not found`);
  const afterStart = source.slice(start + 1);
  const nextExport = afterStart.search(/\nexport (const|function) /);
  const end = nextExport === -1 ? source.length : start + 1 + nextExport;
  return source.slice(start, end);
}

function collectPermissionStrings(source, navGroupsName) {
  const slice = sliceNavGroupsExport(source, navGroupsName);
  const matches = [...slice.matchAll(/permissions: \[([^\]]+)\]/g)];
  return matches.flatMap((match) =>
    [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]),
  );
}

function collectNavEntries(source, navGroupsName) {
  const slice = sliceNavGroupsExport(source, navGroupsName);
  const entries = [];
  for (const match of slice.matchAll(
    /href: '([^']+)'[\s\S]*?label: '([^']+)'/g,
  )) {
    entries.push({ href: match[1], label: match[2] });
  }
  return entries;
}

describe('school operations sidebar', () => {
  it('keeps platform controls out of the school dashboard shell', () => {
    assert.doesNotMatch(personaNavConfig, /label: 'Platform Control'/);
    assert.doesNotMatch(personaNavConfig, /label: 'Managed Schools'/);
    assert.doesNotMatch(personaNavConfig, /label: 'Operations Hub'/);
  });

  it('keeps shared persona trees in the base and Principal overrides in the active config', () => {
    assert.match(personaNavBase, /export const adminNavGroups/);
    assert.match(personaNavEntry, /export const principalNavGroups/);
    assert.match(personaNavBase, /export const teacherNavGroups/);
    assert.match(personaNavBase, /export const hrNavGroups/);
    assert.match(personaNavBase, /export const accountantNavGroups/);
    assert.match(personaNavEntry, /export function navGroupsForPersona/);
    assert.match(sidebar, /from '\.\/sidebar-persona-nav\.config'/);
    assert.doesNotMatch(sidebar, /export const principalNavGroups: NavGroup/);
  });

  it('uses the consolidated school-operating information architecture', () => {
    for (const label of [
      'Home',
      'Students & Admissions',
      'Academics',
      'Attendance',
      'School Operations',
      'Staff & Finance',
      'Notices & Announcements',
      'Homework & Timetable',
      'Exams & Results',
      'Reports & Exports',
      'Fees & Receipts',
    ]) {
      assert.match(personaNavConfig, new RegExp(`label: '${label}'`));
    }

    assert.match(sidebar, /function NavGroupSection/);
    assert.doesNotMatch(personaNavConfig, /label: 'Overview'/);
    assert.doesNotMatch(personaNavConfig, /label: 'People'/);
    assert.doesNotMatch(personaNavConfig, /label: 'Campus Services'/);
    assert.doesNotMatch(personaNavConfig, /label: 'Workforce & Finance'/);
    assert.doesNotMatch(personaNavConfig, /label: 'Insights'/);
    assert.doesNotMatch(personaNavConfig, /label: 'CAS Records'/);
    assert.doesNotMatch(personaNavConfig, /label: 'Report Cards'/);
  });

  it('keeps notice compatibility and academic routes active through their consolidated entries', () => {
    assert.match(personaNavConfig, /'\/dashboard\/notices'/);
    assert.doesNotMatch(personaNavConfig, /href: '\/dashboard\/messages'/);
    assert.match(personaNavConfig, /'\/dashboard\/academics\/cas'/);
    assert.match(personaNavConfig, /'\/dashboard\/academics\/report-cards'/);
    assert.match(personaNavConfig, /'\/dashboard\/timetable'/);
    assert.match(sidebar, /function isActiveNavItem/);
  });

  it('resolves exactly one active nav item when routes overlap', () => {
    const navHash = readFileSync(join(webRoot, 'lib/nav-hash.ts'), 'utf8');
    assert.match(navHash, /export function computeActiveNavHref/);
    assert.match(sidebar, /computeActiveNavHref/);
    assert.match(
      personaNavConfig,
      /activeWhen: \['\/dashboard\/communications', '\/dashboard\/notices'\]/,
    );
    assert.match(navHash, /score = candidatePath\.length \+ 10_000/);
  });

  it('shows every section flat with no click-to-expand accordion, and supports quick search', () => {
    assert.doesNotMatch(sidebar, /function toggleGroup/);
    assert.doesNotMatch(sidebar, /expandedGroups/);
    assert.doesNotMatch(sidebar, /onExpand/);
    assert.match(sidebar, /id="sidebar-nav-search"/);
    assert.match(sidebar, /Find a workspace/);
    assert.match(sidebar, /No workspace matches/);
  });

  it('keeps visibility scoped to session permissions and module entitlements', () => {
    assert.match(sidebar, /function canDisplayNavItem/);
    assert.match(sidebar, /hasAnyPermission\(session, item\.permissions\)/);
    assert.match(sidebar, /moduleKeys\.some\(\(module\) => hasModule\(module\)\)/);
    assert.match(sidebar, /getRequiredModuleForHref/);
    assert.match(sidebar, /from '..\/..\/lib\/nav-module-map'/);
    assert.match(dashboardLayout, /from "..\/..\/lib\/nav-module-map"/);
    assert.doesNotMatch(sidebar, /function getRequiredModuleForHref/);
    assert.doesNotMatch(dashboardLayout, /function getRequiredModuleForHref/);
  });

  it('keeps a single canonical module map for sidebar and layout gates', () => {
    assert.match(navModuleMap, /export function getRequiredModuleForHref/);
    assert.match(navModuleMap, /export const MODULE_HREF_PREFIXES/);
    assert.match(navModuleMap, /\/dashboard\/my-workspace/);
    assert.match(navModuleMap, /\/dashboard\/finance/);
    assert.match(navModuleMap, /\/dashboard\/operations/);
    assert.match(navModuleMap, /return null;/);
  });

  it('aligns command palette settings visibility with the sidebar hub rules', () => {
    assert.match(personaNavEntry, /export function shouldShowSettingsHub/);
    assert.match(commandPalette, /shouldShowSettingsHub/);
    assert.match(commandPalette, /isTeacherPersona/);
    assert.match(commandPalette, /from '\.\/sidebar-persona-nav\.config'/);
    assert.doesNotMatch(commandPalette, /settingsNavItem,\s*\n\s*\];/);
  });

  it('holds the menu stable and fail-closed until entitlements resolve', () => {
    assert.match(sidebar, /loading: entitlementsLoading/);
    assert.match(
      sidebar,
      /const groupsToRender = useMemo\(\s*\(\) =>\s*entitlementsLoading\s*\? \[\]/,
    );
    assert.match(sidebar, /SidebarNavigationSkeleton/);
    assert.match(sidebar, /aria-busy=\{navigationLoading \|\| undefined\}/);
    assert.match(sidebar, /disabled=\{navigationLoading\}/);
  });

  it('keeps collapsed navigation and the footer accessible', () => {
    assert.match(sidebarNavLink, /aria-label=\{collapsed \? label : undefined\}/);
    assert.match(sidebarNavLink, /title=\{collapsed \? label : undefined\}/);
    assert.match(
      sidebar,
      /aria-label=\{collapsed \? 'Expand sidebar' : 'Collapse sidebar'\}/,
    );
    assert.match(sidebar, /School workspace/);
    assert.match(sidebar, /CircleUserRound/);
  });

  it('badges Notifications with the real unread count instead of a hardcoded number', () => {
    assert.match(sidebar, /queryKey: \['notification-center'\]/);
    assert.match(sidebar, /queryFn: api\.getNotificationCenter/);
    assert.match(sidebar, /function formatBadgeCount/);
    assert.match(sidebar, /count > 99 \? '99\+' : count/);
    assert.doesNotMatch(personaNavConfig, /badge: \d/);
  });

  it('uses semantic sidebar design tokens for navigation states', () => {
    assert.match(sidebar, /--sidebar-hover/);
    assert.match(sidebar, /--sidebar-heading/);
    assert.match(sidebar, /SidebarNavLink/);
    assert.match(sidebarNavLink, /--sidebar-active-bg/);
    assert.match(sidebarNavLink, /--sidebar-active-indicator/);
    assert.match(sidebarNavLink, /--sidebar-hover/);
    assert.doesNotMatch(sidebar, /hover:bg-slate-100/);
    assert.doesNotMatch(sidebarNavLink, /hover:bg-slate-100/);
  });

  it('closes the mobile drawer on Escape from anywhere inside it and manages dialog focus', () => {
    assert.match(sidebar, /role="dialog"/);
    assert.match(sidebar, /aria-modal="true"/);
    assert.match(sidebar, /aria-hidden=\{!mobileOpen\}/);
    assert.match(sidebar, /inert=\{!mobileOpen\}/);
    assert.match(sidebar, /mobilePanelRef\.current\?\.focus\(\)/);
    assert.match(sidebar, /document\.addEventListener\('keydown', handleKeyDown\)/);
    assert.match(sidebar, /event\.key === 'Escape'/);
  });
});

describe('persona sidebar contracts', () => {
  it('principal nav points to leadership compositions instead of operator workspaces', () => {
    const entries = collectNavEntries(personaNavEntry, 'principalNavGroups');
    const expected = new Map([
      ['Principal Home', '/dashboard'],
      ['Attention Centre', '/dashboard/attention'],
      ['Approval Centre', '/dashboard/approvals'],
      ['Enrollment Overview', '/dashboard/students/overview'],
      ['Admissions Overview', '/dashboard/admissions/overview'],
      ['Attendance Oversight', '/dashboard/attendance/overview'],
      ['Academic Readiness', '/dashboard/academics/readiness'],
      ['Staff Overview', '/dashboard/hr/overview'],
      ['Finance Overview', '/dashboard/finance-overview'],
      ['Operations Overview', '/dashboard/operations/overview'],
      ['Communication Oversight', '/dashboard/communications/oversight'],
      ['Notices', '/dashboard/notices'],
      ['Activity Oversight', '/dashboard/activity/oversight'],
      ['Reports', '/dashboard/reports'],
      ['Leadership Audit', '/dashboard/audit'],
    ]);
    for (const [label, href] of expected) {
      const entry = entries.find((candidate) => candidate.label === label);
      assert.ok(entry, `principal nav missing ${label}`);
      assert.equal(entry.href, href);
    }

    const principalSlice = sliceNavGroupsExport(
      personaNavEntry,
      'principalNavGroups',
    );
    for (const oldHref of [
      '/dashboard#needs-attention',
      '/dashboard/accounting/audit',
      '/dashboard/notifications',
    ]) {
      assert.doesNotMatch(
        principalSlice,
        new RegExp(oldHref.replace(/[/#]/g, '\\$&')),
      );
    }
    assert.doesNotMatch(
      principalSlice,
      /href: '\/dashboard\/accounting'[\s\S]*label: 'Finance Overview'/,
    );

    const permissions = collectPermissionStrings(
      personaNavEntry,
      'principalNavGroups',
    );
    for (const excluded of PRINCIPAL_EXCLUDED_PERMISSIONS) {
      assert.ok(
        !permissions.includes(excluded),
        `principal nav must not require ${excluded}`,
      );
    }
  });

  it('keeps Principal entitlement ownership canonical except for the multi-module operations aggregate', () => {
    const principalSlice = sliceNavGroupsExport(
      personaNavEntry,
      'principalNavGroups',
    );
    const moduleKeyDeclarations = [...principalSlice.matchAll(/moduleKeys:/g)];
    assert.equal(moduleKeyDeclarations.length, 1);
    assert.match(
      principalSlice,
      /moduleKeys: \['library', 'transport', 'canteen'\]/,
    );
    assert.doesNotMatch(principalSlice, /moduleKeys: \['academics'\]/);
    assert.match(navModuleMap, /prefix: "\/dashboard\/academics", module: "exams"/);
  });

  it('uses canonical communication permission names for Principal oversight', () => {
    assert.match(personaNavEntry, /'communications:read_deliveries'/);
    assert.doesNotMatch(personaNavEntry, /'communications:deliveries:read'/);
  });

  it('keeps Operations inside School Readiness and uses school-friendly Reports & Audit wording', () => {
    const principalSlice = sliceNavGroupsExport(
      personaNavEntry,
      'principalNavGroups',
    );
    const readinessStart = principalSlice.indexOf("label: 'School Readiness'");
    const communicationStart = principalSlice.indexOf("label: 'Communication'");
    const readinessSlice = principalSlice.slice(readinessStart, communicationStart);
    assert.match(readinessSlice, /label: 'Operations Overview'/);
    assert.doesNotMatch(principalSlice, /label: 'School Operations'/);
    assert.match(principalSlice, /label: 'Reports & Audit'/);
  });

  it('keeps institutional Settings out of the Principal leadership-only shell', () => {
    const settingsStart = personaNavEntry.indexOf(
      'export function shouldShowSettingsHub',
    );
    const settingsEnd = personaNavEntry.indexOf(
      '/** Picks the persona nav tree',
      settingsStart,
    );
    const settingsSlice = personaNavEntry.slice(settingsStart, settingsEnd);
    assert.match(
      settingsSlice,
      /const principalLeadershipOnly = \['principal'\]\.includes\(persona\)/,
    );
    assert.match(
      settingsSlice,
      /isTeacherPersona \|\| personalOnly \|\| principalLeadershipOnly/,
    );
    assert.match(settingsSlice, /settingsCaps\.institutionalNavEnabled/);
    assert.match(settingsSlice, /settingsCaps\.canAccessInstitutionalSettings/);
  });

  it('accountant nav includes cashier close, reconciliation, and module postings', () => {
    const entries = collectNavEntries(personaNavConfig, 'accountantNavGroups');
    for (const label of [
      'Cashier Close',
      'Reconciliation',
      'Module Postings',
      'Finance Dashboard',
      'Audit Trail',
    ]) {
      assert.ok(
        entries.some((entry) => entry.label === label),
        `accountant nav missing ${label}`,
      );
    }
  });

  it('teacher nav includes notifications without inventing class reports', () => {
    const entries = collectNavEntries(personaNavConfig, 'teacherNavGroups');
    assert.ok(entries.some((entry) => entry.href === '/dashboard/notifications'));
    assert.doesNotMatch(personaNavConfig, /label: 'Class Reports'/);
  });

  it('cashier shell stays on counter operations only', () => {
    const permissions = collectPermissionStrings(
      personaNavConfig,
      'cashierNavGroups',
    );
    assert.doesNotMatch(permissions.join(','), /accounting:manage/);
    assert.doesNotMatch(permissions.join(','), /settings:manage/);
  });

  it('principal nav uses durable attention and approval routes', () => {
    const principalSlice = sliceNavGroupsExport(
      personaNavEntry,
      'principalNavGroups',
    );
    assert.match(principalSlice, /href: '\/dashboard\/attention'/);
    assert.match(principalSlice, /href: '\/dashboard\/approvals'/);
    assert.doesNotMatch(principalSlice, /\/dashboard#needs-attention/);
  });
});
