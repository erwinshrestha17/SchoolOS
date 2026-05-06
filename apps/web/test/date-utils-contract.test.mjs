import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(join(webRoot, relativePath), 'utf8');
}

describe('SchoolOS Date Utility Contracts', () => {
  it('implements the shared date utility in the correct location', () => {
    const dateUtils = read('lib/date-utils.ts');
    
    assert.match(dateUtils, /export function formatAdDate/);
    assert.match(dateUtils, /export function formatBsDate/);
    assert.match(dateUtils, /export function formatSchoolDate/);
    assert.match(dateUtils, /export function normalizeActivityDate/);
  });

  it('handles timezone Asia/Kathmandu for display', () => {
    const dateUtils = read('lib/date-utils.ts');
    assert.match(dateUtils, /timeZone:\s*'Asia\/Kathmandu'/);
  });

  it('contains the Bikram Sambat calendar data table', () => {
    const dateUtils = read('lib/date-utils.ts');
    assert.match(dateUtils, /const BS_CALENDAR_DATA/);
    assert.match(dateUtils, /2081:\s*\[31,\s*32/); // Current year data
  });

  it('integrates shared date utilities into the dashboard page', () => {
    const dashboardPage = read('app/dashboard/page.tsx');
    
    assert.match(dashboardPage, /import \{[\s\S]*formatSchoolDate[\s\S]*\} from '..\/..\/lib\/date-utils'/);
    assert.match(dashboardPage, /formatSchoolDate\(item\.date,\s*'BOTH'\)/);
    assert.doesNotMatch(dashboardPage, /const formatDate =/); // Local version should be gone
  });
});
