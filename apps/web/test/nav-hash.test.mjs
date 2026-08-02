import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  computeActiveNavHref,
  splitNavHref,
} from '../lib/nav-hash.ts';

const principalDashboardItems = [
  { href: '/dashboard', label: 'Executive Dashboard', icon: null },
  { href: '/dashboard#needs-attention', label: 'Attention Items', icon: null },
];

describe('nav hash helpers', () => {
  it('splits path and hash from nav hrefs', () => {
    assert.deepEqual(splitNavHref('/dashboard'), {
      path: '/dashboard',
      hash: null,
    });
    assert.deepEqual(splitNavHref('/dashboard#needs-attention'), {
      path: '/dashboard',
      hash: '#needs-attention',
    });
  });

  it('highlights Executive Dashboard on /dashboard without hash', () => {
    assert.equal(
      computeActiveNavHref(principalDashboardItems, '/dashboard', ''),
      '/dashboard',
    );
  });

  it('highlights Attention Items on /dashboard with needs-attention hash', () => {
    assert.equal(
      computeActiveNavHref(
        principalDashboardItems,
        '/dashboard',
        '#needs-attention',
      ),
      '/dashboard#needs-attention',
    );
  });
});
