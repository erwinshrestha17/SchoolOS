import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

function assertBefore(source, earlier, later, message) {
  const earlierIndex = source.indexOf(earlier);
  const laterIndex = source.indexOf(later);
  assert.notEqual(earlierIndex, -1, `Missing ${earlier}`);
  assert.notEqual(laterIndex, -1, `Missing ${later}`);
  assert.ok(earlierIndex < laterIndex, message);
}

describe("structured read-only support override", () => {
  it("stores one tab-local versioned context and rejects malformed or expired state", () => {
    const session = read("lib/session.ts");

    assert.match(
      session,
      /SUPPORT_OVERRIDE_STORAGE_KEY = ["']schoolos\.support-override\.v1["']/,
    );
    assert.match(
      session,
      /window\.sessionStorage\.getItem\(SUPPORT_OVERRIDE_STORAGE_KEY\)/,
    );
    assert.match(
      session,
      /window\.sessionStorage\.setItem\([\s\S]{0,120}JSON\.stringify\(\{ version: 1, \.\.\.context \}\)/,
    );
    assert.doesNotMatch(
      session,
      /window\.localStorage\.setItem\(\s*SUPPORT_OVERRIDE_STORAGE_KEY/,
    );

    for (const validation of [
      /candidate\.version !== 1/,
      /typeof candidate\.overrideId !== ["']string["']/,
      /typeof candidate\.tenantId !== ["']string["']/,
      /candidate\.reason\.trim\(\)\.length < 5/,
      /candidate\.reason !== candidate\.reason\.trim\(\)/,
      /candidate\.readOnly !== true/,
      /new Set\(scopes\)\.size === scopes\.length/,
      /isSupportOverrideScope\(scope\)/,
      /expiresAt <= Date\.now\(\)/,
    ]) {
      assert.match(session, validation);
    }

    assert.match(
      session,
      /if \([\s\S]{0,900}clearSupportOverride\(\);[\s\S]{0,80}return null;/,
    );
    assert.match(
      session,
      /sessionStorage\.removeItem\(LEGACY_SUPPORT_OVERRIDE_TENANT_KEY\)/,
    );
    assert.match(
      session,
      /sessionStorage\.removeItem\(LEGACY_SUPPORT_OVERRIDE_REASON_KEY\)/,
    );
  });

  it("binds the complete override tuple to reads and blocks writes before fetch", () => {
    const client = read("lib/api/client.ts");

    assert.match(client, /supportOverride\?: ["']include["'] \| ["']omit["']/);
    assert.match(
      client,
      /const supportOverride =[\s\S]{0,120}readSupportOverrideContext\(\)/,
    );
    assert.match(
      client,
      /supportOverride && unsafeMethods\.includes\(method\)[\s\S]{0,220}read-only[\s\S]{0,80}403/,
    );
    assert.match(
      client,
      /headers\[["']X-SchoolOS-Tenant-Id["']\] = supportOverride\.tenantId/,
    );
    assert.match(
      client,
      /headers\[["']X-SchoolOS-Tenant-Override-Reason["']\] = supportOverride\.reason/,
    );
    assert.match(
      client,
      /headers\[["']X-SchoolOS-Support-Override-Id["']\] = supportOverride\.overrideId/,
    );
    assertBefore(
      client,
      "This support session is read-only",
      "const response = await fetch",
      "Support-mode mutations must fail before any request is sent",
    );
  });

  it("stores the authoritative enter result and clears only after a successful exit", () => {
    const platformApi = read("lib/api/platform.ts");
    const authApi = read("lib/api/auth.ts");

    assert.match(
      platformApi,
      /enter[\s\S]{0,700}supportOverride: ["']omit["']/,
    );
    assert.match(
      platformApi,
      /setSupportOverride\(\{[\s\S]{0,400}overrideId: res\.overrideId[\s\S]{0,400}tenantId: body\.tenantId[\s\S]{0,400}reason: body\.reason\.trim\(\)[\s\S]{0,400}scopes: res\.scopes[\s\S]{0,400}readOnly: res\.readOnly[\s\S]{0,400}expiresAt: res\.expiresAt/,
    );
    assert.match(
      platformApi,
      /exitPlatformSupportOverride[\s\S]{0,400}supportOverride: ["']omit["'][\s\S]{0,200}clearSupportOverride\(\)/,
    );
    assertBefore(
      platformApi,
      "const res = await request<{ success: true }>",
      "clearSupportOverride();",
      "The local override must remain available when backend exit fails",
    );
    assert.match(
      authApi,
      /refreshSession[\s\S]{0,220}supportOverride: ["']omit["']/,
    );
    assert.match(authApi, /logout[\s\S]{0,220}supportOverride: ["']omit["']/);
  });

  it("accepts only a server-confirmed Platform projection and keeps it tab-local", () => {
    const provider = read("components/session-provider.tsx");

    for (const binding of [
      /nextSession\.user\.id === currentSession\.user\.id/,
      /nextSession\.user\.securityDomain === ["']PLATFORM["']/,
      /nextSession\.user\.supportOverrideReadOnly === true/,
      /nextSession\.user\.originalTenantId === currentSession\.tenant\.id/,
      /nextSession\.tenant\.id === context\.tenantId/,
      /projectedScopes === storedScopes/,
    ]) {
      assert.match(provider, binding);
    }

    assert.match(
      provider,
      /nextSession\.user\.isSupportOverride && !confirmedSupportTransition[\s\S]{0,240}clearSupportOverride\(\)[\s\S]{0,160}setStatus\(["']verification_failed["']\)/,
    );
    assert.match(
      provider,
      /if \(!confirmedSupportTransition\) \{[\s\S]{0,100}storeSession\(nextSession\)/,
    );
    assert.match(
      provider,
      /activeSupportContext &&[\s\S]{0,240}currentSession\?\.user\.isSupportOverride[\s\S]{0,320}externalSession\.tenant\.id === currentSession\.user\.originalTenantId[\s\S]{0,80}return;/,
    );
    assert.match(
      provider,
      /if \(readSupportOverrideContext\(\)\) \{[\s\S]{0,80}return revalidateSession\(\)/,
    );
  });

  it("uses exact projected permissions without aliases during support override", () => {
    const session = read("lib/session.ts");

    assert.match(
      session,
      /if \(session\?\.user\.isSupportOverride\) \{[\s\S]{0,120}return grantedPermissions\.includes\(permission\);[\s\S]{0,80}\}/,
    );
    assert.match(
      session,
      /return hasEffectivePermission\(grantedPermissions, permission\);/,
    );
    assert.match(
      session,
      /permissions\.every\(\(permission\) => hasPermission\(session, permission\)\)/,
    );
    assert.match(
      session,
      /permissions\.some\(\(permission\) => hasPermission\(session, permission\)\)/,
    );
    assertBefore(
      session,
      "if (session?.user.isSupportOverride)",
      "return hasEffectivePermission(grantedPermissions, permission);",
      "Support overrides must take the exact-permission branch before alias evaluation",
    );
  });

  it("requires explicit scopes and exposes the active read-only boundary", () => {
    const access = read("components/platform/tenant-detail/tenant-access.tsx");
    const banner = read("components/platform/SupportOverrideBanner.tsx");

    assert.match(access, /SUPPORT_OVERRIDE_SCOPE_DEFINITIONS\.map/);
    assert.match(access, /useState<SupportOverrideScope\[\]>\(\s*\[\],?\s*\)/);
    assert.match(access, /supportScopes\.length === 0/);
    assert.match(access, /scopes: supportScopes/);
    assert.match(access, /\(\{ key \}\) => key === supportScopes\[0\]/);
    assert.match(access, /\?\.entryPath/);
    assert.match(access, /Read-only support excludes finance, payroll/);
    assert.match(access, /item\.permissionScopes/);

    assert.match(banner, /Read-only support/);
    assert.match(banner, /SUPPORT_OVERRIDE_SCOPE_DEFINITIONS/);
    assert.match(banner, /context\.expiresAt/);
    assert.match(banner, /Support mode could not be exited/);
  });

  it("removes write-only school controls from scoped read-only workspaces", () => {
    const layout = read("app/dashboard/layout.tsx");
    const attendance = read(
      "components/attendance/attendance-m2-workspaces.tsx",
    );
    const students = read("app/dashboard/students/page.tsx");
    const directory = read("components/forms/student-directory.tsx");
    const protectedFile = read("components/ui/protected-file.tsx");
    const schoolProfile = read(
      "components/settings/school-profile-workspace.tsx",
    );
    const studentDetail = read("components/students/student-detail-page.tsx");
    const studentHeader = read(
      "components/students/profile/profile-header.tsx",
    );
    const studentOverview = read(
      "components/students/profile/tabs/overview-tab.tsx",
    );
    const guardiansTab = read(
      "components/students/profile/tabs/guardians-tab.tsx",
    );

    assert.match(
      layout,
      /prefix: ["']\/dashboard\/attendance\/mark["'][\s\S]{0,120}permissions: \[["']attendance:mark["']\]/,
    );
    assert.match(
      layout,
      /prefix: ["']\/dashboard\/homework\/new["'][\s\S]{0,120}permissions: \[["']homework:create["']\]/,
    );
    assert.match(attendance, /visibleAttendanceTabs\(canMark/);
    assert.match(attendance, /attendance\.canMark \?/);
    assert.match(attendance, /canManageAll \?/);

    assert.match(students, /canEditStudents=\{canEditStudents\}/);
    assert.match(students, /canManageStudentDocuments/);
    assert.match(directory, /canEditStudents\s*\?/);
    assert.match(directory, /canViewStudentFees\s*\?/);

    assert.match(protectedFile, /blockedBySupportOverride/);
    assert.match(
      protectedFile,
      /Protected files are unavailable during read-only support access/,
    );
    assert.match(schoolProfile, /session\?\.user\.isSupportOverride/);
    assert.match(studentDetail, /tab\.value !== ["']Fees["'] \|\| canViewFees/);
    assert.match(
      studentDetail,
      /tab\.value !== ["']Documents["'] \|\| canManageDocuments/,
    );
    assert.match(
      studentHeader,
      /\.\.\.\(canViewFees \? \[collectFeeAction\] : \[\]\)/,
    );
    assert.match(studentHeader, /\.\.\.\(canManageDocuments/);
    assert.match(
      studentOverview,
      /enabled: Boolean\(studentId\) && canViewFees/,
    );
    assert.match(
      studentOverview,
      /enabled: Boolean\(studentId\) && canViewAttendance/,
    );
    assert.match(guardiansTab, /session\?\.user\.isSupportOverride !== true/);
  });
});
