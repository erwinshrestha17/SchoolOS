import assert from "node:assert/strict";
import test from "node:test";
import {
  availableHomePersonas,
  compositionForHome,
  resolveHomePersona,
} from "../dist/index.js";

const session = (roles, permissions = []) => ({ roles, permissions });

test("a principal who also teaches may open both homes, principal first", () => {
  assert.deepEqual(availableHomePersonas(session(["principal", "teacher"])), [
    "principal",
    "teacher",
  ]);
});

test("a teacher-only session gets only the teaching home", () => {
  assert.deepEqual(availableHomePersonas(session(["teacher"])), ["teacher"]);
});

test("the school config owner receives the operations home (no 403 home)", () => {
  assert.deepEqual(availableHomePersonas(session(["school_config_owner"])), [
    "admin",
  ]);
});

test("platform identities never receive a school home", () => {
  assert.deepEqual(availableHomePersonas(session(["platform_super_admin"])), []);
  assert.deepEqual(
    availableHomePersonas(session(["platform_support", "admin"])),
    [],
  );
});

test("a stale or tampered preference falls back to the default home", () => {
  const principalTeacher = session(["principal", "teacher"]);
  assert.equal(resolveHomePersona(principalTeacher, "teacher"), "teacher");
  assert.equal(resolveHomePersona(principalTeacher, "accountant"), "principal");
  assert.equal(resolveHomePersona(principalTeacher, null), "principal");
  assert.equal(resolveHomePersona(session(["librarian"]), "admin"), null);
});

test("only operational homes map to a dashboard composition", () => {
  assert.equal(compositionForHome("teacher"), null);
  assert.equal(compositionForHome("accountant"), "accountant");
  assert.equal(compositionForHome(null), null);
});
