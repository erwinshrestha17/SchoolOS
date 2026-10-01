import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(webRoot, path), 'utf8');

describe('Student 360 revalidation contract (Phase 5)', () => {
  const detail = read('components/students/student-detail-page.tsx');

  it('re-checks access with the server every time the profile opens', () => {
    assert.match(detail, /staleTime: 0,/);
    assert.match(detail, /refetchOnMount: 'always'/);
  });

  it("never renders an earlier visit's cached copy before the server re-authorizes", () => {
    assert.match(
      detail,
      /const profileVerified = profileQuery\.isFetchedAfterMount;/,
    );
    assert.match(
      detail,
      /profileQuery\.isLoading \|\| \(!profileVerified && profileQuery\.isFetching\)/,
    );
    // A failed re-check hides the profile rather than keeping old data.
    assert.match(
      detail,
      /if \(profileQuery\.isError \|\| !profileQuery\.data\)/,
    );
  });

  it('tells the viewer when an authorized section could not be loaded', () => {
    assert.match(detail, /profile\.unavailableSections \?\? \[\]/);
    assert.match(detail, /Some sections could not be loaded right now/);
  });
});
