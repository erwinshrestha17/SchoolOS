import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  decideAttendanceRosterReplay,
  normalizeAttendanceRosterVersion,
} from "../lib/attendance-roster-version.ts";

const current = "a".repeat(64);
const changed = "b".repeat(64);
const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("attendance roster version replay fence", () => {
  it("accepts only canonical lowercase SHA-256 roster versions", () => {
    assert.equal(normalizeAttendanceRosterVersion(current), current);
    assert.equal(normalizeAttendanceRosterVersion("A".repeat(64)), null);
    assert.equal(normalizeAttendanceRosterVersion("a".repeat(63)), null);
    assert.equal(normalizeAttendanceRosterVersion(undefined), null);
  });

  it("submits an editable draft only against the same current roster", () => {
    assert.deepEqual(
      decideAttendanceRosterReplay({
        draftRosterVersion: current,
        currentRosterVersion: current,
        isProtectedReceiptReplay: false,
      }),
      { allowed: true, mode: "current_roster" },
    );
    assert.deepEqual(
      decideAttendanceRosterReplay({
        draftRosterVersion: current,
        currentRosterVersion: changed,
        isProtectedReceiptReplay: false,
      }),
      { allowed: false, reason: "roster_changed" },
    );
    assert.deepEqual(
      decideAttendanceRosterReplay({
        draftRosterVersion: undefined,
        currentRosterVersion: current,
        isProtectedReceiptReplay: false,
      }),
      { allowed: false, reason: "missing_draft_version" },
    );
  });

  it("replays a protected queued receipt with its original precondition", () => {
    for (const draftRosterVersion of [current, changed, undefined]) {
      assert.deepEqual(
        decideAttendanceRosterReplay({
          draftRosterVersion,
          currentRosterVersion: current,
          isProtectedReceiptReplay: true,
        }),
        { allowed: true, mode: "original_receipt" },
      );
    }
  });

  it("persists and submits the original roster version without a current-version fallback", () => {
    const session = readFileSync(join(webRoot, "lib/session.ts"), "utf8");
    const form = readFileSync(
      join(webRoot, "components/forms/attendance-form.tsx"),
      "utf8",
    );

    assert.match(session, /expectedRosterVersion\?: string/);
    assert.match(
      session,
      /ATTENDANCE_ROSTER_VERSION_PATTERN\.test\([\s\S]{0,80}draft\.expectedRosterVersion/,
    );
    assert.match(
      form,
      /setDraftRosterVersion\(storedRosterVersion\)/,
    );
    assert.match(
      form,
      /decideAttendanceRosterReplay\(\{[\s\S]{0,220}isProtectedReceiptReplay: isReceiptReplay/,
    );
    assert.match(
      form,
      /expectedRosterVersion: draftRosterVersion/,
    );
    assert.doesNotMatch(
      form,
      /draftRosterVersion\s*\?\?\s*rosterQuery\.data\?\.rosterVersion/,
    );
    assert.match(form, /Queued on this browser — not submitted/);
  });
});
