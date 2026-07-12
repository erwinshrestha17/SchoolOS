import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const webRoot = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, webRoot), "utf8");

describe("M6 homework/timetable icon and confirmation audit", () => {
  it("requires confirmation before sending homework reminders from the detail page", () => {
    const detail = read("components/homework/homework-detail-page.tsx");

    assert.match(detail, /showReminderDialog/);
    assert.doesNotMatch(detail, /onClick=\{\(\) => sendReminderMutation\.mutate\(\)\}/);
    assert.match(detail, /title="Send Reminders Now"/);
  });

  it("requires confirmation before destructive or bulk homework actions on the detail page", () => {
    // homework-tab.tsx (the combined timetable/homework tab this used to
    // guard) was deleted in the M6 homework redesign consolidation
    // (fuzzy-gliding-hopper.md) — its assign/cancel/bulk-action confirmation
    // requirements now live on the consolidated homework detail page instead.
    const detail = read("components/homework/homework-detail-page.tsx");

    assert.match(detail, /import \{ ConfirmDialog \} from "@\/components\/ui\/confirm-dialog"/);
    assert.doesNotMatch(detail, /onClick=\{\(\) => (cancelMutation|deleteMutation|bulkCompleteMutation)\.mutate\(\)\}/);
    assert.match(detail, /onClick=\{\(\) => setShowCancelDialog\(true\)\}/);
    assert.match(detail, /onClick=\{\(\) => setShowDeleteDialog\(true\)\}/);
    assert.match(detail, /onClick=\{\(\) => setShowMarkAllDialog\(true\)\}/);
    assert.match(detail, /<ConfirmDialog/);
  });

  it("requires confirmation before publishing, locking, or archiving a timetable version", () => {
    const versionsList = read("components/timetable/versions-list.tsx");

    // versions-list.tsx previously fired these mutations directly on click,
    // unlike its sibling timetable-builder-tab.tsx which already gated the
    // same three actions behind a ConfirmDialog.
    assert.match(versionsList, /import \{ ConfirmDialog \} from "@\/components\/ui\/confirm-dialog"/);
    assert.doesNotMatch(versionsList, /onClick: \(\) => publishMutation\.mutate\(row\.id\)/);
    assert.doesNotMatch(versionsList, /onClick: \(\) => lockMutation\.mutate\(row\.id\)/);
    assert.doesNotMatch(versionsList, /onClick: \(\) => archiveMutation\.mutate\(row\.id\)/);
    assert.match(versionsList, /setConfirmTarget/);
    assert.match(versionsList, /<ConfirmDialog/);

    // The permanently-disabled, no-op "Duplicate" menu item (no backend
    // contract, empty onClick) was dead UI and has been removed rather than
    // left as a confusing always-disabled option.
    assert.doesNotMatch(versionsList, /label: "Duplicate"/);
    assert.doesNotMatch(versionsList, /onClick: \(\) => \{\}/);
  });

  it("makes the clickable timetable slot cell a real keyboard-accessible control", () => {
    const grid = read("components/timetable/timetable-grid.tsx");

    // A bare <div onClick> with no role/tabIndex/keyboard handling excluded
    // keyboard and screen-reader users from opening the substitution modal.
    assert.doesNotMatch(grid, /<div[\s\S]{0,40}className="h-full min-h-\[100px\] cursor-pointer/);
    assert.match(grid, /<button[\s\S]{0,100}aria-label=\{`\$\{subjectName\}/);
  });

  it("gives the student homework attachment remove control both a tooltip and an aria-label", () => {
    // student-homework-tab.tsx was deleted in the M6 homework redesign
    // consolidation; the digital-submission attachment flow it guarded now
    // lives in homework-detail-page.tsx's StudentSubmissionForm.
    const detail = read("components/homework/homework-detail-page.tsx");

    assert.match(detail, /import \{ Tooltip \} from "@\/components\/ui\/tooltip"/);
    assert.match(detail, /<Tooltip content=\{`Remove \$\{a\.fileName\}`\}>/);
    assert.match(detail, /aria-label=\{`Remove \$\{a\.fileName\}`\}/);
  });
});
