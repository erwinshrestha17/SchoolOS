import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(webRoot, path), "utf8");

describe("Account & Security password contracts", () => {
  it("wires logged-in password change to the backend auth API", () => {
    const workspace = read("components/account/account-security-workspace.tsx");
    const authApi = read("lib/api/auth.ts");

    assert.match(workspace, /api\.changePassword/);
    assert.match(workspace, /logoutOtherDevices/);
    assert.match(workspace, /Current password/);
    assert.match(workspace, /New password/);
    assert.match(workspace, /Confirm new password/);
    assert.match(authApi, /\/auth\/change-password/);
  });

  it("exposes account security in school and platform planes", () => {
    const dashboardPage = read("app/dashboard/account-security/page.tsx");
    const platformPage = read("app/platform/account-security/page.tsx");
    const dashboardLayout = read("app/dashboard/layout.tsx");
    const platformLayout = read("app/platform/layout.tsx");
    const header = read("components/layout/header.tsx");
    const platformShell = read("components/layout/platform-shell.tsx");

    assert.match(dashboardPage, /AccountSecurityWorkspace/);
    assert.match(platformPage, /AccountSecurityWorkspace/);
    assert.match(dashboardLayout, /mustChangePassword/);
    assert.match(platformLayout, /mustChangePassword/);
    assert.match(header, /\/dashboard\/account-security/);
    assert.match(platformShell, /\/platform\/account-security/);
  });

  it("wires forgot and reset password to public recovery endpoints", () => {
    const loginForm = read("components/forms/login-form.tsx");
    const forgotPage = read("app/forgot-password/page.tsx");
    const resetPage = read("app/reset-password/page.tsx");
    const authApi = read("lib/api/auth.ts");

    assert.match(loginForm, /Forgot password\?/);
    assert.match(forgotPage, /api\.forgotPassword/);
    assert.match(resetPage, /api\.resetPassword/);
    assert.match(authApi, /\/auth\/forgot-password/);
    assert.match(authApi, /\/auth\/reset-password/);
  });
});
