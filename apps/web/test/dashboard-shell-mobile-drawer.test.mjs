import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(webRoot, path), 'utf8');

describe('mobile navigation drawer focus management', () => {
  it('returns focus to the menu trigger when the drawer closes', () => {
    const shell = read('components/layout/dashboard-shell.tsx');

    assert.match(shell, /mobileMenuButtonRef = useRef<HTMLButtonElement>\(null\)/);
    assert.match(shell, /function closeMobileNavigation\(\)/);
    assert.match(shell, /mobileMenuButtonRef\.current\?\.focus\(\)/);
    assert.match(shell, /mobileMenuButtonRef=\{mobileMenuButtonRef\}/);
  });

  it('threads the trigger ref through TopBar into the actual hamburger button', () => {
    const header = read('components/layout/header.tsx');

    assert.match(header, /mobileMenuButtonRef\?: RefObject<HTMLButtonElement \| null>/);
    assert.match(header, /ref=\{mobileMenuButtonRef\}/);
  });
});
