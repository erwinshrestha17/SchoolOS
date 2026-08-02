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

describe('school operations sidebar', () => {
  it('keeps platform controls out of the school dashboard shell', () => {
    assert.doesNotMatch(sidebar, /label: 'Platform Control'/);
    assert.doesNotMatch(sidebar, /label: 'Managed Schools'/);
    assert.doesNotMatch(sidebar, /label: 'Operations Hub'/);
  });

  it('uses the consolidated school-operating information architecture', () => {
    for (const label of [
      'Home',
      'Students & Admissions',
      'Academics',
      'Daily Operations',
      'School Operations',
      'Staff & Finance',
      'Notices',
      'Reports',
      'Settings',
      'Fees & Receipts',
      'Notices & Announcements',
      'Homework & Timetable',
      'Exams & Results',
      'Reports & Exports',
    ]) {
      assert.match(sidebar, new RegExp(`label: '${label}'`));
    }

    assert.match(sidebar, /function NavGroupSection/);
    assert.match(sidebar, /principalNavGroups/);
    assert.match(sidebar, /hrNavGroups/);
    assert.match(sidebar, /accountantNavGroups/);
    assert.match(sidebar, /librarianNavGroups/);
    assert.match(sidebar, /cashierNavGroups/);
    assert.match(sidebar, /function navGroupsForPersona/);
    assert.doesNotMatch(sidebar, /label: 'Overview'/);
    assert.doesNotMatch(sidebar, /label: 'People'/);
    assert.doesNotMatch(sidebar, /label: 'Campus Services'/);
    assert.doesNotMatch(sidebar, /label: 'Workforce & Finance'/);
    assert.doesNotMatch(sidebar, /label: 'Insights'/);
    assert.doesNotMatch(sidebar, /label: 'CAS Records'/);
    assert.doesNotMatch(sidebar, /label: 'Report Cards'/);
  });

  it('keeps notice compatibility and academic routes active through their consolidated entries', () => {
    assert.match(sidebar, /'\/dashboard\/notices'/);
    assert.doesNotMatch(sidebar, /href: '\/dashboard\/messages'/);
    assert.match(sidebar, /'\/dashboard\/academics\/cas'/);
    assert.match(sidebar, /'\/dashboard\/academics\/report-cards'/);
    assert.match(sidebar, /'\/dashboard\/timetable'/);
    assert.match(sidebar, /function isActiveNavItem/);
  });

  it('resolves exactly one active nav item when routes overlap', () => {
    // Legacy communication URLs resolve through the M15 notice entry, while
    // Academics' href-prefix remains single-match for its deeper routes.
    assert.match(sidebar, /function computeActiveHref/);
    assert.match(
      sidebar,
      /activeWhen: \['\/dashboard\/communications', '\/dashboard\/notices'\]/,
    );
    assert.match(sidebar, /score = candidate\.length \+ 10_000/);
  });

  it('shows every section flat with no click-to-expand accordion, and supports quick search', () => {
    // Reference design shows every nav item under its section label at all
    // times (no click-to-expand groups) — this also fixes a real collapsed
    // -rail bug where items in a non-active group were unreachable without
    // first expanding the whole sidebar.
    assert.doesNotMatch(sidebar, /function toggleGroup/);
    assert.doesNotMatch(sidebar, /expandedGroups/);
    assert.doesNotMatch(sidebar, /onExpand/);
    assert.match(sidebar, /id="sidebar-nav-search"/);
    assert.match(sidebar, /Find a workspace/);
    assert.match(sidebar, /No workspace matches/);
  });

  it('keeps visibility scoped to session permissions and module entitlements', () => {
    assert.match(sidebar, /function canDisplayNavItem/);
    // Permission matching is shared with the dashboard route gate via
    // lib/session.ts's hasAnyPermission, instead of a second inline
    // implementation living only in the sidebar.
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
    assert.match(sidebar, /export function shouldShowSettingsHub/);
    assert.match(commandPalette, /shouldShowSettingsHub/);
    assert.match(commandPalette, /isTeacherPersona/);
    assert.doesNotMatch(
      commandPalette,
      /settingsNavItem,\s*\n\s*\];/,
    );
  });

  it('keeps collapsed navigation and the footer accessible', () => {
    assert.match(sidebarNavLink, /aria-label=\{collapsed \? label : undefined\}/);
    assert.match(sidebarNavLink, /title=\{collapsed \? label : undefined\}/);
    assert.match(sidebar, /aria-label=\{collapsed \? 'Expand sidebar' : 'Collapse sidebar'\}/);
    assert.match(sidebar, /School workspace/);
    assert.match(sidebar, /CircleUserRound/);
  });

  it('badges Notices with the real unread count instead of a hardcoded number', () => {
    // Reuses the same 'notification-center' query key as the topbar bell so
    // TanStack Query dedupes the fetch instead of a second request; badge
    // loading/failure must fall back to no badge, never a fake number.
    assert.match(sidebar, /queryKey: \['notification-center'\]/);
    assert.match(sidebar, /queryFn: api\.getNotificationCenter/);
    assert.match(sidebar, /function formatBadgeCount/);
    assert.match(sidebar, /count > 99 \? '99\+' : count/);
    assert.doesNotMatch(sidebar, /badge: \d/);
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
    // A regression test for two real drawer accessibility bugs: Escape only
    // used to close the drawer if the overlay div itself had focus (which
    // almost never happens once a user tabs into the nav links), and focus
    // was never moved into the drawer on open or back to the trigger button
    // on close.
    assert.match(sidebar, /role="dialog"/);
    assert.match(sidebar, /aria-modal="true"/);
    assert.match(sidebar, /aria-hidden=\{!mobileOpen\}/);
    assert.match(sidebar, /inert=\{!mobileOpen\}/);
    assert.match(sidebar, /mobilePanelRef\.current\?\.focus\(\)/);
    assert.match(sidebar, /document\.addEventListener\('keydown', handleKeyDown\)/);
    assert.match(sidebar, /event\.key === 'Escape'/);
  });
});
