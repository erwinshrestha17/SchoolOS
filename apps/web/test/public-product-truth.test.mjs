import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(webRoot, path), 'utf8');

describe('public SchoolOS product truth', () => {
  it('labels static previews as illustrative and avoids unsupported release claims', () => {
    const landing = read('app/page.tsx');

    assert.match(landing, /Illustrative product preview/);
    assert.match(landing, /Illustrative preview · Example data/);
    assert.match(landing, /Example Secondary School/);

    for (const unsupported of [
      /School ERP for Nepal/i,
      /Parent Portal/i,
      /Live Dashboard Preview/i,
      /Verified school workspace/i,
      /real-time transport/i,
      /telecommunication gateways/i,
      /absolute privacy compliance/i,
      /complete isolation/i,
      /automatically reconciled/i,
      /payroll disbursed/i,
      /licensed annually/i,
      /Request Pricing/i,
      /href=["']#["']/,
    ]) {
      assert.doesNotMatch(landing, unsupported);
    }
  });

  it('uses canonical communication ownership and truthful parent mobile wording', () => {
    const landing = read('app/page.tsx');
    const login = read('app/login/page.tsx');
    const requestForm = read('components/forms/request-demo-form.tsx');

    assert.match(landing, /Notices & Announcements/);
    assert.match(landing, /Notifications & Delivery/);
    assert.match(landing, /Parent Mobile Companion/);
    assert.match(login, /Parents & Guardians: Please use the SchoolOS mobile app/);
    assert.match(requestForm, /Notifications & Delivery/);
    assert.match(requestForm, /Notices & Announcements/);
    assert.doesNotMatch(requestForm, /Parent Portal/);
    assert.doesNotMatch(requestForm, /Multi-branch Institution|branchesCount|Number of Branches/);
  });

  it('keeps public metadata aligned with the Grade 1–12 operating-system boundary', () => {
    const layout = read('app/layout.tsx');
    const requestDemo = read('app/request-demo/page.tsx');

    assert.match(layout, /education operating system/);
    assert.match(layout, /Grade 1–12/);
    assert.match(requestDemo, /School operating system for Nepal/);
    assert.doesNotMatch(requestDemo, /School ERP for Nepal/);
  });
});
