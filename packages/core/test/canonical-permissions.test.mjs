import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalPermissionCatalog,
  getCanonicalPermissionByCode,
  getCanonicalPermissionForLegacyKey,
  permissionCatalog,
} from "../dist/index.js";

test("every legacy permission has one stable canonical identity and metadata", () => {
  const legacyKeys = permissionCatalog.map(
    ({ resource, action }) => `${resource}:${action}`,
  );
  const definitions = canonicalPermissionCatalog;
  assert.equal(definitions.length, legacyKeys.length);
  assert.equal(
    new Set(definitions.map(({ legacyKey }) => legacyKey)).size,
    definitions.length,
  );
  assert.equal(
    new Set(definitions.map(({ code }) => code)).size,
    definitions.length,
  );
  assert.deepEqual(
    definitions.map(({ legacyKey }) => legacyKey).sort(),
    [...legacyKeys].sort(),
  );
  for (const legacyKey of legacyKeys) {
    assert.ok(
      getCanonicalPermissionForLegacyKey(legacyKey),
      `Missing explicit canonical mapping for ${legacyKey}`,
    );
  }

  for (const definition of definitions) {
    assert.match(
      definition.code,
      /^[a-z][a-z0-9_-]*:[a-z][a-z0-9_-]*:[a-z][a-z0-9_-]*$/,
    );
    assert.equal(
      definition.code,
      `${definition.module}:${definition.resource}:${definition.action}`,
    );
    assert.match(definition.description, /\S/);
    assert.match(definition.introducedVersion, /\S/);
    assert.ok(
      ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(definition.riskLevel),
    );
    assert.ok(definition.allowedScopeTypes.length > 0);
    for (const requirement of [
      "delegable",
      "requiresReason",
      "requiresMfa",
      "requiresApproval",
    ]) {
      assert.equal(typeof definition[requirement], "boolean");
    }
    assert.equal(
      getCanonicalPermissionForLegacyKey(definition.legacyKey),
      definition,
    );
    assert.equal(getCanonicalPermissionByCode(definition.code), definition);
  }
});

test("Platform identities and scopes remain separate from school permissions", () => {
  for (const definition of canonicalPermissionCatalog) {
    const isPlatformLegacy =
      definition.legacyKey.startsWith("platform:") ||
      definition.legacyKey === "tenants:manage";
    assert.equal(definition.module === "platform", isPlatformLegacy);
    assert.deepEqual(
      definition.allowedScopeTypes.includes("GLOBAL"),
      isPlatformLegacy,
    );
    if (isPlatformLegacy) {
      assert.deepEqual(definition.allowedScopeTypes, ["GLOBAL"]);
      assert.equal(definition.delegable, false);
    }
  }
});

test("HIGH and CRITICAL definitions are never delegable by default", () => {
  const sensitive = canonicalPermissionCatalog.filter(({ riskLevel }) =>
    ["HIGH", "CRITICAL"].includes(riskLevel),
  );
  assert.ok(sensitive.length > 0);
  for (const definition of sensitive) {
    assert.equal(definition.delegable, false, definition.legacyKey);
  }
});

test("sensitive canonical mappings keep reviewed risk and future-policy signals", () => {
  const refund = getCanonicalPermissionForLegacyKey("payments:refund");
  assert.equal(refund?.code, "fees:payment:refund");
  assert.equal(refund?.riskLevel, "CRITICAL");
  assert.equal(refund?.requiresReason, true);
  assert.equal(refund?.requiresMfa, true);
  assert.equal(refund?.requiresApproval, true);
  assert.equal(refund?.delegable, false);

  // These legacy keys govern configuration and delivery resources, rather
  // than invoice or inbox operations. Keep the first canonical baseline
  // faithful to the existing catalog and controller semantics.
  for (const [legacyKey, code] of Object.entries({
    "fees:manage": "fees:configuration:manage",
    "fees:discount": "fees:discount:manage",
    "notifications:manage_templates": "notifications:template:manage",
    "notifications:manage_preferences": "notifications:preference:manage",
    "notifications:view_delivery_diagnostics":
      "notifications:delivery:read_diagnostics",
    "notifications:retry_deliveries": "notifications:delivery:retry",
  })) {
    assert.equal(getCanonicalPermissionForLegacyKey(legacyKey)?.code, code);
  }

  const attendance = getCanonicalPermissionForLegacyKey("attendance:mark");
  assert.equal(attendance?.code, "attendance:record:mark");
  assert.ok(attendance?.allowedScopeTypes.includes("SECTION"));

  const platform = getCanonicalPermissionForLegacyKey("tenants:manage");
  assert.equal(platform?.code, "platform:tenants:manage");
  assert.deepEqual(platform?.allowedScopeTypes, ["GLOBAL"]);

  for (const legacyKey of ["messaging:create", "messaging:manage"]) {
    const definition = getCanonicalPermissionForLegacyKey(legacyKey);
    assert.equal(definition?.deprecatedAt, null);
    assert.equal(definition?.delegable, false);
  }
});

test("unknown legacy and canonical keys have no definition", () => {
  assert.equal(getCanonicalPermissionForLegacyKey("students:unknown"), null);
  assert.equal(getCanonicalPermissionByCode("students:profile:unknown"), null);
});
