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
    assert.match(sidebar, /aria-expanded=\{!collapsed \? expanded : undefined\}/);
    assert.match(sidebar, /expandedGroups\.has\(group\.label\)/);
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

  it('lets nav sections stay open independently and supports quick search', () => {
    assert.match(sidebar, /function toggleGroup/);
    assert.match(sidebar, /useState<Set<string>>/);
    assert.match(sidebar, /id="sidebar-nav-search"/);
    assert.match(sidebar, /Find a workspace/);
    assert.match(sidebar, /No workspace matches/);
  });

  it('keeps visibility scoped to session permissions and module entitlements', () => {
    assert.match(sidebar, /function canDisplayNavItem/);
    assert.match(sidebar, /session\?\.user\.permissions/);
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
});
