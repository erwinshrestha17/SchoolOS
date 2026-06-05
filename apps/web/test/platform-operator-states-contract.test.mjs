import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const componentPath = 'app/platform/_components/platform-operator-states.tsx';

function read(relativePath) {
  return readFileSync(join(webRoot, relativePath), 'utf8');
}

describe('Platform operator state component contracts', () => {
  it('keeps shared platform state components available', () => {
    assert.equal(existsSync(join(webRoot, componentPath)), true, 'Missing platform operator state components');

    const component = read(componentPath);

    for (const expected of [
      'PlatformSectionSkeleton',
      'PlatformEmptyState',
      'PlatformInlineError',
      'PlatformBoundaryNote',
      'Try again',
      'Platform data unavailable',
    ]) {
      assert.match(component, new RegExp(expected));
    }
  });

  it('uses platform visual language for loading, empty, error, and boundary states', () => {
    const component = read(componentPath);

    for (const expected of [
      'rounded-3xl',
      'border-slate-100',
      'border-dashed',
      'border-rose-200',
      'border-cyan-100',
      'animate-pulse',
    ]) {
      assert.match(component, new RegExp(expected));
    }
  });

  it('keeps platform access and redirect states on platform tokens', () => {
    const surfaces = [
      read('components/platform/PermissionDenied.tsx'),
      read('app/platform/layout.tsx'),
      read('app/platform/settings/audit/page.tsx'),
      read('app/platform/settings/system-health/page.tsx'),
    ].join('\n');

    assert.match(surfaces, /color-mod-platform-accent/);
    assert.match(surfaces, /color-mod-platform-text/);
    assert.match(surfaces, /color-mod-platform-border/);
    assert.doesNotMatch(
      surfaces,
      /bg-slate-900|bg-slate-950|shadow-xl|rounded-\[20px\]|primary-(50|100|200|500|600|700|800|900)/,
    );
  });
});
