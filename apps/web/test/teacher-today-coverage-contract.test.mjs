import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("subject-only and substitution periods count as real teacher work", () => {
  const workspace = read("components/dashboard/teacher-today-workspace.tsx");
  const contract = read("lib/api/teacher-workspace.ts");

  assert.match(workspace, /const hasTeachingWork =/);
  assert.match(workspace, /data\.todaysPeriods\.length > 0/);
  assert.match(workspace, /Boolean\(data\.substitutions\?\.length\)/);
  assert.match(workspace, /!hasTeachingWork/);
  assert.match(workspace, /No homeroom attendance\s+class is assigned/);
  assert.match(contract, /coverageStatus\?: 'SCHEDULED' \| 'SUBSTITUTING' \| 'COVERED'/);
});

test("coverage labels come from the backend period contract", () => {
  const workspace = read("components/dashboard/teacher-today-workspace.tsx");

  assert.match(workspace, /period\.coverageStatus === 'SUBSTITUTING'/);
  assert.match(workspace, /You are substituting for this period/);
  assert.match(workspace, /A substitute is covering this period/);
});
