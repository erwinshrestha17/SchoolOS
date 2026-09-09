import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL(
    "../components/settings/school-profile-workspace.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("school profile uses the canonical Nepal geography cascade", () => {
  assert.match(source, /NepalAddressSelector/);
  assert.match(source, /localLevelId: address\.localLevelId/);
  assert.match(source, /Province and district are derived/);
  assert.doesNotMatch(source, /label="Municipality"/);
  assert.doesNotMatch(source, /label="District"/);
  assert.doesNotMatch(source, /label="Province"/);
});

test("school profile requires a server-verifiable local level before save", () => {
  assert.match(source, /if \(!form\.localLevelId\)/);
  assert.match(source, /Select the school province, district, and local level/);
});
