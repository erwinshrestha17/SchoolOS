import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(join(webRoot, relativePath), 'utf8');
}

describe('SchoolOS Nepal BS Date Utility Contracts', () => {
  it('delegates legacy web formatting to the canonical core policy', () => {
    const dateUtils = read('lib/date-utils.ts');

    assert.match(dateUtils, /from '@schoolos\/core'/);
    assert.match(dateUtils, /coreFormatBsDate/);
    assert.match(dateUtils, /toBsDateFromGregorian/);
    assert.doesNotMatch(dateUtils, /BS_CALENDAR_DATA/);
    assert.doesNotMatch(dateUtils, /fallback to a standard pattern/);
  });

  it('keeps the public compatibility helpers while requiring BS display', () => {
    const dateUtils = read('lib/date-utils.ts');

    assert.match(dateUtils, /export function formatAdDate/);
    assert.match(dateUtils, /export function formatBsDate/);
    assert.match(dateUtils, /export function formatSchoolDate/);
    assert.match(dateUtils, /export type DateDisplayMode = 'BS'/);
  });

  it('keeps dashboard usage on the shared date utility', () => {
    const dashboardPage = read('app/dashboard/page.tsx');

    assert.match(dashboardPage, /formatSchoolDate/);
    assert.doesNotMatch(dashboardPage, /const formatDate =/);
  });
});
