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

describe('school operations sidebar', () => {
  it('keeps platform controls out of the school dashboard shell', () => {
    assert.doesNotMatch(sidebar, /label: 'Platform Control'/);
    assert.doesNotMatch(sidebar, /label: 'Managed Schools'/);
    assert.doesNotMatch(sidebar, /label: 'Operations Hub'/);
  });

  it('uses the consolidated school-operating information architecture', () => {
    for (const label of [
      'Home',
      'Academics',
      'Daily Operations',
      'School Operations',
      'Staff & Finance',
      'Communication',
      'Reports',
      'Settings',
      'Fees & Receipts',
      'Notices & Communication',
      'Homework & Timetable',
      'Exams & Results',
      'Reports & Exports',
    ]) {
      assert.match(sidebar, new RegExp(`label: '${label}'`));
    }

    assert.match(sidebar, /function NavGroupSection/);
    assert.doesNotMatch(sidebar, /label: 'Overview'/);
    assert.doesNotMatch(sidebar, /label: 'People'/);
    assert.doesNotMatch(sidebar, /label: 'Campus Services'/);
    assert.doesNotMatch(sidebar, /label: 'Workforce & Finance'/);
    assert.doesNotMatch(sidebar, /label: 'Insights'/);
    assert.doesNotMatch(sidebar, /label: 'CAS Records'/);
    assert.doesNotMatch(sidebar, /label: 'Report Cards'/);
  });

  it('keeps deep communication and academic routes active through their consolidated entries', () => {
    assert.match(sidebar, /'\/dashboard\/notices'/);
    assert.match(sidebar, /'\/dashboard\/messages'/);
    assert.match(sidebar, /'\/dashboard\/academics\/cas'/);
    assert.match(sidebar, /'\/dashboard\/academics\/report-cards'/);
    assert.match(sidebar, /'\/dashboard\/timetable'/);
    assert.match(sidebar, /function isActiveNavItem/);
  });

  it('resolves exactly one active nav item when routes overlap', () => {
    // Regression coverage: Messages and Notices & Communication both cover
    // /dashboard/messages in the old implementation, and Academics'
    // href-prefix used to also light up on /dashboard/academics/exams|cas
    // |report-cards. Both must resolve to a single most-specific match now.
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
    assert.match(sidebar, /function getRequiredModuleForHref/);
  });

  it('keeps collapsed navigation and the footer accessible', () => {
    assert.match(sidebar, /aria-label=\{collapsed \? item\.label : undefined\}/);
    assert.match(sidebar, /title=\{collapsed \? item\.label : undefined\}/);
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

  it('closes the mobile drawer on Escape from anywhere inside it and manages dialog focus', () => {
    // A regression test for two real drawer accessibility bugs: Escape only
    // used to close the drawer if the overlay div itself had focus (which
    // almost never happens once a user tabs into the nav links), and focus
    // was never moved into the drawer on open or back to the trigger button
    // on close.
    assert.match(sidebar, /role="dialog"/);
    assert.match(sidebar, /aria-modal="true"/);
    assert.match(sidebar, /mobilePanelRef\.current\?\.focus\(\)/);
    assert.match(sidebar, /document\.addEventListener\('keydown', handleKeyDown\)/);
    assert.match(sidebar, /event\.key === 'Escape'/);
  });
});
