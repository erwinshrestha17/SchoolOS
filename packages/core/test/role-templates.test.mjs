import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  hasEffectivePermission,
  isPlatformPermissionKey,
  permissionCatalog,
  SCHOOL_SYSTEM_ROLE_DEFINITIONS,
  PLATFORM_SYSTEM_ROLE_DEFINITIONS,
  systemRoleDefinitions,
  systemRolePermissions,
  systemRoleTemplates,
} from "../dist/index.js";

const baseline = JSON.parse(
  readFileSync(
    new URL("./role-template-baseline.json", import.meta.url),
    "utf8",
  ),
);

const inheritedAliasBaseline = JSON.parse(
  readFileSync(
    new URL("./role-effective-alias-baseline.json", import.meta.url),
    "utf8",
  ),
);

const requiredPhase1ATemplates = [
  "School Access Owner",
  "School Admin",
  "Principal",
  "Admissions Officer",
  "Teacher",
  "HR Manager",
  "Payroll Preparer",
  "Payroll Reviewer",
  "Payroll Approver",
  "Cashier",
  "Accountant",
  "Finance Approver",
  "Auditor",
  "Parent/Guardian",
  "Student",
];

test("every seeded built-in has one immutable, versioned template", () => {
  const names = systemRoleTemplates.map(({ key }) => key);
  assert.equal(new Set(names).size, names.length);
  assert.deepEqual(
    [...names].sort(),
    systemRoleDefinitions.map(({ name }) => name).sort(),
  );
  assert.deepEqual(
    [...names].sort(),
    Object.keys(systemRolePermissions).sort(),
  );
  assert.equal(Object.isFrozen(systemRoleTemplates), true);
  assert.equal(Object.isFrozen(systemRoleDefinitions), true);
  assert.equal(Object.isFrozen(SCHOOL_SYSTEM_ROLE_DEFINITIONS), true);
  assert.equal(Object.isFrozen(PLATFORM_SYSTEM_ROLE_DEFINITIONS), true);
  for (const definition of systemRoleDefinitions) {
    assert.equal(Object.isFrozen(definition), true);
  }
  assert.equal(Object.isFrozen(systemRolePermissions), true);
  for (const template of systemRoleTemplates) {
    assert.equal(Object.isFrozen(template), true);
    assert.equal(Object.isFrozen(template.permissions), true);
    assert.equal(Object.isFrozen(systemRolePermissions[template.key]), true);
    assert.ok(Number.isSafeInteger(template.version) && template.version > 0);
  }
  const labels = new Set(
    systemRoleTemplates.map(({ displayName }) => displayName),
  );
  for (const label of requiredPhase1ATemplates) {
    assert.equal(labels.has(label), true, `${label} template missing`);
  }
});

test("role-template grants and versions match the reviewed baseline", () => {
  const current = Object.fromEntries(
    systemRoleTemplates
      .map(({ key, displayName, version, securityDomain, permissions }) => [
        key,
        {
          displayName,
          version,
          securityDomain,
          permissions: [...permissions].sort(),
        },
      ])
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  assert.deepEqual(current, baseline);
});

test("every built-in role's effective alias grants match the reviewed baseline", () => {
  const catalogKeys = permissionCatalog.map(
    ({ resource, action }) => `${resource}:${action}`,
  );
  // This captures observed legacy alias effects, not an approval that each
  // alias is safe. A new catalog key or alias cannot inherit role authority
  // without an explicit change to this review artifact.
  const current = Object.fromEntries(
    systemRoleTemplates.map(({ key, permissions }) => [
      key,
      catalogKeys
        .filter(
          (permission) =>
            !permissions.includes(permission) &&
            hasEffectivePermission(permissions, permission),
        )
        .sort(),
    ]),
  );
  assert.deepEqual(current, inheritedAliasBaseline);
});

test("built-ins have only known, unique direct grants in their security domain", () => {
  const catalog = new Set(
    permissionCatalog.map(({ resource, action }) => `${resource}:${action}`),
  );
  const platformKeys = [...catalog].filter(isPlatformPermissionKey);
  const allGranted = new Set();
  for (const template of systemRoleTemplates) {
    const direct = systemRolePermissions[template.key];
    assert.deepEqual(template.permissions, direct);
    assert.equal(new Set(direct).size, direct.length, template.key);
    for (const key of direct) {
      assert.equal(
        catalog.has(key),
        true,
        `${template.key} has unknown ${key}`,
      );
      assert.equal(
        key.includes("*"),
        false,
        `${template.key} has wildcard ${key}`,
      );
      assert.equal(
        isPlatformPermissionKey(key),
        template.securityDomain === "PLATFORM",
        `${template.key} crosses domains through ${key}`,
      );
      allGranted.add(key);
    }
    if (template.securityDomain === "SCHOOL") {
      for (const key of platformKeys) {
        assert.equal(
          hasEffectivePermission(direct, key),
          false,
          `${template.key} inherits Platform authority through alias ${key}`,
        );
      }
    }
  }
  assert.ok([...catalog].some((key) => !allGranted.has(key)));
});

test("new catalog keys cannot enter Admin or Principal through all-except filters", () => {
  const source = readFileSync(
    new URL("../src/permissions/roles.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /permissionCatalog|TENANT_PERMISSION_KEYS|ALL_PERMISSION_KEYS|ADMIN_EXCLUDED_FINANCE_KEYS/,
  );
  assert.equal(systemRolePermissions.admin.length, 222);
  assert.equal(systemRolePermissions.principal.length, 65);
});

test("new duty templates do not gain incompatible effective finance authority", () => {
  const denied = {
    admissions_officer: ["students:read", "guardians:read"],
    payroll_preparer: [
      "payroll:run:review",
      "payroll:run:approve",
      "payroll:run:post",
      "payroll:run:pay",
    ],
    payroll_reviewer: [
      "payroll:run:create",
      "payroll:run:approve",
      "payroll:run:post",
      "payroll:run:pay",
    ],
    payroll_approver: [
      "payroll:run:create",
      "payroll:run:review",
      "payroll:run:post",
      "payroll:run:pay",
    ],
    cashier: ["payments:refund", "payments:reverse", "payments:close"],
    finance_approver: [
      "advanced:approvals:read",
      "advanced:approvals:decide",
      "payments:refund",
      "accounting:reverse",
      "accounting:journals:post",
    ],
  };
  for (const [role, keys] of Object.entries(denied)) {
    for (const key of keys) {
      assert.equal(
        hasEffectivePermission(systemRolePermissions[role], key),
        false,
        `${role} unexpectedly receives ${key}`,
      );
    }
  }
  for (const role of ["parent", "student"]) {
    assert.equal(
      hasEffectivePermission(systemRolePermissions[role], "students:read"),
      false,
    );
    assert.equal(
      hasEffectivePermission(systemRolePermissions[role], "roles:assign"),
      false,
    );
  }
});

test("generic school read and export grants do not confer approval or payroll authority", () => {
  for (const role of ["accountant", "financial_auditor"]) {
    for (const key of [
      "advanced:approvals:read",
      "advanced:documents:manage",
      "payroll:exports:create",
    ]) {
      assert.equal(
        hasEffectivePermission(systemRolePermissions[role], key),
        false,
        `${role} unexpectedly receives ${key}`,
      );
    }
  }
  for (const key of [
    "advanced:approvals:read",
    "advanced:approvals:manage",
    "advanced:approvals:decide",
  ]) {
    assert.equal(
      hasEffectivePermission(systemRolePermissions.school_config_owner, key),
      false,
      `School Access Owner unexpectedly receives ${key}`,
    );
  }
});
