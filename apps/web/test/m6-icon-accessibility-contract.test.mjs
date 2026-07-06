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

  it("requires confirmation before assigning homework or sending reminders from the combined timetable/homework tab", () => {
    const tab = read("components/timetable/tabs/homework-tab.tsx");

    // Assign (making a draft live to students) and Send Reminder are both
    // notify/publish-equivalent high-risk actions that must not fire on a
    // single click.
    assert.match(tab, /import \{ ConfirmDialog \} from "\.\.\/\.\.\/ui\/confirm-dialog"/);
    assert.doesNotMatch(tab, /onClick=\{\(\)\s*=>\s*\n?\s*assignMutation\.mutate\(selectedAssignment\.id\)/);
    assert.doesNotMatch(
      tab,
      /onClick=\{\(\)\s*=>\s*\n?\s*reminderMutation\.mutate\(selectedAssignment\.id\)/,
    );
    assert.match(tab, /setConfirmAssignment\(\{/);
    assert.match(tab, /<ConfirmDialog/);
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
    const studentTab = read("components/timetable/tabs/student-homework-tab.tsx");

    assert.match(studentTab, /import \{ Tooltip \} from "\.\.\/\.\.\/ui\/tooltip"/);
    assert.match(studentTab, /<Tooltip content=\{`Remove \$\{a\.fileName\}`\}>/);
    assert.match(studentTab, /aria-label=\{`Remove \$\{a\.fileName\}`\}/);
  });
});
