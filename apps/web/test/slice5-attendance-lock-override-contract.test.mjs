import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(webRoot, path), "utf8");

describe("Slice 5 attendance reopen / correction / re-lock contracts", () => {
  it("exposes the locked-session override API client", () => {
    const attendanceApi = read("lib/api/attendance.ts");

    assert.match(
      attendanceApi,
      /overrideLockedAttendanceSession:\s*\([\s\S]*?\/attendance\/sessions\/\$\{encodeURIComponent\(sessionId\)\}\/override/,
    );
    assert.match(attendanceApi, /AttendanceSessionOverrideResult/);
  });

  it("wires mark attendance override mode to capabilities and audited re-lock copy", () => {
    const form = read("components/forms/attendance-form.tsx");

    assert.match(form, /useAttendanceCapabilities\(\)/);
    assert.match(form, /canOverrideLock/);
    assert.match(form, /isOverrideMode/);
    assert.match(form, /overrideLockedAttendanceSession/);
    assert.match(form, /Apply & re-lock/);
    assert.match(form, /Records remain locked/);
    assert.match(form, /LockedRecordBanner/);
    assert.match(form, /computeOverrideChanges/);
  });

  it("gates correction review surfaces on canReviewConflicts", () => {
    const inlineReview = read(
      "components/attendance/attendance-correction-review.tsx",
    );
    const detailWorkspace = read(
      "components/attendance/attendance-m2-workspaces.tsx",
    );
    const conflictReview = read(
      "components/attendance/attendance-conflict-review.tsx",
    );

    assert.match(inlineReview, /useAttendanceCapabilities\(\)/);
    assert.match(inlineReview, /canReviewConflicts/);
    assert.match(inlineReview, /PermissionDenied/);

    assert.match(detailWorkspace, /canReviewConflicts/);
    assert.match(detailWorkspace, /correctionReviewMinReasonLength/);
    assert.match(detailWorkspace, /lockStateRequiresEscalation/);

    assert.match(conflictReview, /useAttendanceCapabilities\(\)/);
    assert.match(conflictReview, /canReviewConflicts/);
  });

  it("keeps teacher read-only lock messaging when override authority is absent", () => {
    const form = read("components/forms/attendance-form.tsx");

    assert.match(form, /Request a correction/);
    assert.match(
      form,
      /rosterEditingDisabled[\s\S]*!isOverrideMode && \(isLocked \|\| isSubmitted\)/,
    );
  });
});
