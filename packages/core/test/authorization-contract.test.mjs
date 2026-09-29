import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTHORIZATION_CONTRACT_VERSION,
  buildResourceAuthorization,
  isActionAllowed,
  isSectionAuthorized,
  readResourceAuthorization,
} from "../dist/index.js";

const enabled = { module: "students", state: "ENABLED" };

function sample(overrides = {}) {
  return buildResourceAuthorization({
    actions: { UPDATE_PROFILE: true, MANAGE_LIFECYCLE: false },
    sections: { identity: true, health: false },
    lifecycleState: "ACTIVE",
    entitlementState: enabled,
    ...overrides,
  });
}

test("builder derives allowedActions and capabilities from one decision", () => {
  const authorization = sample();
  assert.equal(authorization.contractVersion, AUTHORIZATION_CONTRACT_VERSION);
  assert.deepEqual([...authorization.allowedActions], ["UPDATE_PROFILE"]);
  assert.deepEqual(
    { ...authorization.capabilities },
    { UPDATE_PROFILE: true, MANAGE_LIFECYCLE: false },
  );
  assert.deepEqual([...authorization.authorizedSections], ["identity"]);
  assert.equal(authorization.lifecycleState, "ACTIVE");
  assert.ok(Object.isFrozen(authorization));
  assert.ok(Object.isFrozen(authorization.allowedActions));
});

test("allowed action and authorized section read as allowed", () => {
  const authorization = sample();
  assert.equal(isActionAllowed(authorization, "UPDATE_PROFILE"), true);
  assert.equal(isSectionAuthorized(authorization, "identity"), true);
});

test("denied, undeclared and unknown codes are denied", () => {
  const authorization = sample();
  assert.equal(isActionAllowed(authorization, "MANAGE_LIFECYCLE"), false);
  assert.equal(isActionAllowed(authorization, "DELETE_EVERYTHING"), false);
  assert.equal(isSectionAuthorized(authorization, "health"), false);
  assert.equal(isSectionAuthorized(authorization, "fees"), false);
});

test("missing projection (partial deployment / old server) denies everything", () => {
  for (const missing of [undefined, null, {}, [], "ALLOW", 1]) {
    assert.equal(readResourceAuthorization(missing), null);
    assert.equal(isActionAllowed(missing, "UPDATE_PROFILE"), false);
    assert.equal(isSectionAuthorized(missing, "identity"), false);
  }
});

test("unknown contract version denies everything", () => {
  const future = { ...sample(), contractVersion: 2 };
  assert.equal(readResourceAuthorization(future), null);
  assert.equal(isActionAllowed(future, "UPDATE_PROFILE"), false);
  assert.equal(isSectionAuthorized(future, "identity"), false);
});

test("malformed fields deny rather than coerce to true", () => {
  const base = { ...sample() };
  const variants = [
    { ...base, allowedActions: "UPDATE_PROFILE" },
    { ...base, capabilities: { UPDATE_PROFILE: "true" } },
    { ...base, authorizedSections: [1] },
    { ...base, lifecycleState: 7 },
    { ...base, entitlementState: { module: "students", state: "MAYBE" } },
    { ...base, entitlementState: undefined },
  ];
  for (const variant of variants) {
    assert.equal(isActionAllowed(variant, "UPDATE_PROFILE"), false);
    assert.equal(isSectionAuthorized(variant, "identity"), false);
  }
});

test("allowedActions and capabilities must agree", () => {
  const listedButFalse = {
    ...sample(),
    capabilities: { UPDATE_PROFILE: false, MANAGE_LIFECYCLE: false },
  };
  assert.equal(isActionAllowed(listedButFalse, "UPDATE_PROFILE"), false);
  const trueButUnlisted = {
    ...sample(),
    allowedActions: [],
  };
  assert.equal(isActionAllowed(trueButUnlisted, "UPDATE_PROFILE"), false);
  const inheritedOnly = {
    ...sample(),
    allowedActions: ["toString"],
    capabilities: {},
  };
  assert.equal(isActionAllowed(inheritedOnly, "toString"), false);
});

test("entitlement other than ENABLED forces every decision to deny", () => {
  for (const state of ["DISABLED", "SUSPENDED", "UNKNOWN"]) {
    const built = sample({ entitlementState: { module: "students", state } });
    assert.deepEqual([...built.allowedActions], []);
    assert.deepEqual([...built.authorizedSections], []);
    assert.equal(built.capabilities.UPDATE_PROFILE, false);
    // A tampered client copy that re-adds grants is still denied.
    const tampered = {
      ...built,
      allowedActions: ["UPDATE_PROFILE"],
      capabilities: { UPDATE_PROFILE: true },
      authorizedSections: ["identity"],
    };
    assert.equal(isActionAllowed(tampered, "UPDATE_PROFILE"), false);
    assert.equal(isSectionAuthorized(tampered, "identity"), false);
  }
});

test("non-boolean builder input is not treated as allow", () => {
  const built = buildResourceAuthorization({
    actions: { UPDATE_PROFILE: "yes" },
    sections: { identity: 1 },
    lifecycleState: null,
    entitlementState: enabled,
  });
  assert.deepEqual([...built.allowedActions], []);
  assert.deepEqual([...built.authorizedSections], []);
});
