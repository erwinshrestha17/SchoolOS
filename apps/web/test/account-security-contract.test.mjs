import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(webRoot, path), 'utf8');

describe('Account & Security password contracts', () => {
  it('wires logged-in password change to the backend auth API', () => {
    const workspace = read('components/account/account-security-workspace.tsx');
    const authApi = read('lib/api/auth.ts');

    assert.match(workspace, /api\.changePassword/);
    assert.match(workspace, /logoutOtherDevices/);
    assert.match(workspace, /Current password/);
    assert.match(workspace, /New password/);
    assert.match(workspace, /Confirm new password/);
    assert.match(authApi, /\/auth\/change-password/);
  });

  it('exposes account security in school and platform planes', () => {
    const dashboardRedirect = read('app/dashboard/account-security/page.tsx');
    const dashboardPage = read(
      'app/dashboard/settings/personal/security/page.tsx',
    );
    const platformPage = read('app/platform/account-security/page.tsx');
    const dashboardLayout = read('app/dashboard/layout.tsx');
    const platformLayout = read('app/platform/layout.tsx');
    const loginForm = read('components/forms/login-form.tsx');
    const header = read('components/layout/header.tsx');
    const platformShell = read('components/layout/platform-shell.tsx');

    assert.match(dashboardPage, /AccountSecurityWorkspace/);
    assert.match(dashboardPage, /embedded/);
    assert.match(dashboardRedirect, /redirectWithSearchParams/);
    assert.match(
      dashboardRedirect,
      /\/dashboard\/settings\/personal\/security/,
    );
    assert.match(platformPage, /AccountSecurityWorkspace/);
    assert.match(dashboardLayout, /mustChangePassword/);
    assert.match(dashboardLayout, /\/dashboard\/settings\/personal\/security/);
    assert.match(loginForm, /\/dashboard\/settings\/personal\/security/);
    assert.match(platformLayout, /mustChangePassword/);
    assert.doesNotMatch(header, /\/dashboard\/account-security/);
    assert.match(header, /\/dashboard\/my-workspace/);
    assert.match(header, /\/dashboard\/settings\/personal\/profile/);
    assert.match(header, /Personal Settings/);
    assert.match(header, /Sign out/);
    assert.match(platformShell, /\/platform\/account-security/);
  });

  it('shows neutral and live password policy states with accessible controls', () => {
    const workspace = read('components/account/account-security-workspace.tsx');

    assert.match(workspace, /\? ['"]neutral['"]/);
    assert.match(workspace, /Not met/);
    assert.match(workspace, /aria-invalid/);
    assert.match(workspace, /aria-describedby/);
    assert.match(workspace, /aria-pressed/);
    assert.match(workspace, /"Hide" : "Show"/);
    assert.doesNotMatch(workspace, />Logout</);
  });

  it('wires forgot and reset password to public recovery endpoints', () => {
    const loginForm = read('components/forms/login-form.tsx');
    const forgotPage = read('app/forgot-password/page.tsx');
    const resetPage = read('app/reset-password/page.tsx');
    const authApi = read('lib/api/auth.ts');

    assert.match(loginForm, /Forgot password\?/);
    assert.match(forgotPage, /api\.forgotPassword/);
    assert.match(resetPage, /api\.resetPassword/);
    assert.match(authApi, /\/auth\/forgot-password/);
    assert.match(authApi, /\/auth\/reset-password/);
  });
});
