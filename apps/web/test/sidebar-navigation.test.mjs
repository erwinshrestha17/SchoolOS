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
      'Overview',
      'People',
      'Academics',
      'Daily Operations',
      'Campus Services',
      'Workforce & Finance',
      'Insights',
      'Fees & Receipts',
      'Notices & Communication',
      'Homework & Timetable',
      'Exams & Results',
      'Reports & Exports',
    ]) {
      assert.match(sidebar, new RegExp(`label: '${label}'`));
    }

    assert.doesNotMatch(sidebar, /label: 'Communication'/);
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
