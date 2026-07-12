import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const webRoot = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, webRoot), "utf8");

describe("M2 attendance workspace contract", () => {
  it("uses the shared Button component with consistent risk styling for correction approve/reject", () => {
    const inlineReview = read("components/attendance/attendance-correction-review.tsx");
    const detailWorkspace = read("components/attendance/attendance-m2-workspaces.tsx");

    // Both surfaces review the exact same underlying action — they must use
    // the shared Button component (not hand-rolled <button>s with ad-hoc
    // colors) and agree on which variant signals "this is destructive".
    assert.match(inlineReview, /import \{ Button \} from '@\/components\/ui\/button'/);
    assert.doesNotMatch(inlineReview, /className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600/);
    assert.doesNotMatch(inlineReview, /className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-danger-100 bg-danger-50/);
    assert.match(inlineReview, /<Button[\s\S]{0,80}variant="destructive"/);

    // Wording must agree across both surfaces for the same action —
    // shortened to the 1-3 word convention, not "Approve Request"/"Reject
    // Request" in one place and "Approve"/"Reject" in the other.
    assert.doesNotMatch(detailWorkspace, /Approve Request/);
    assert.doesNotMatch(detailWorkspace, /Reject Request/);
    assert.match(inlineReview, /\{activeReview\?\.action === 'APPROVED'[\s\S]{0,100}: 'Approve'\}/);
  });

  it("uses the shared Button for conflict resolution instead of a hand-styled button", () => {
    const conflictReview = read("components/attendance/attendance-conflict-review.tsx");

    assert.match(conflictReview, /import \{ Button \} from '@\/components\/ui\/button'/);
    assert.doesNotMatch(
      conflictReview,
      /className="flex items-center justify-center gap-2 rounded-xl bg-\[var\(--color-mod-attendance-accent\)\]/,
    );
  });

  it("gives the medical-alert indicator an accessible name, not color alone", () => {
    const rosterItem = read("components/attendance/attendance-roster-item.tsx");

    assert.match(rosterItem, /role="img"/);
    assert.match(rosterItem, /aria-label="Medical alert"/);
  });

  it("does not present a non-functional export button as an active primary action", () => {
    const workspaces = read("components/attendance/attendance-m2-workspaces.tsx");

    // This button has no onClick and no backend export contract — it must
    // be honestly disabled with an explanatory tooltip, not look clickable.
    assert.match(
      workspaces,
      /Tooltip content="No export contract for this queue yet"[\s\S]{0,80}<Button variant="outline" disabled>/,
    );
  });

  it("keeps the practical attendance workspace to five main sections", () => {
    const workspaces = read("components/attendance/attendance-m2-workspaces.tsx");

    assert.match(workspaces, /label: "Overview"/);
    assert.match(workspaces, /label: "Mark Attendance"/);
    assert.match(workspaces, /label: "Monthly Register"/);
    assert.match(workspaces, /label: "Corrections"/);
    assert.match(workspaces, /label: "Reports"/);
    assert.doesNotMatch(workspaces, /label: "Anomalies"/);
    assert.doesNotMatch(workspaces, /label: "Follow-ups"/);
  });

  it("uses the four pilot statuses and filters teacher choices to assignments", () => {
    const form = read("components/forms/attendance-form.tsx");
    const rosterItem = read("components/attendance/attendance-roster-item.tsx");

    assert.match(form, /<option value="PRESENT">Present<\/option>/);
    assert.match(form, /<option value="ABSENT">Absent<\/option>/);
    assert.match(form, /<option value="LATE">Late<\/option>/);
    assert.match(form, /<option value="LEAVE">Leave \/ Excused<\/option>/);
    assert.doesNotMatch(form, /<option value="SICK_LEAVE">/);
    assert.match(form, /isTeacherPersona[\s\S]*assignedSections[\s\S]*availableClasses/);
    assert.match(rosterItem, /onStatusChange\('EXCUSED_LEAVE'\)/);
    assert.doesNotMatch(rosterItem, /label: 'Unexcused'/);
  });

  it("keeps submitted attendance read-only and exposes all weak-network states", () => {
    const form = read("components/forms/attendance-form.tsx");

    assert.match(form, /disabled=\{isLocked \|\| isSubmitted\}/);
    assert.match(form, /Attendance Submitted/);
    assert.match(form, /Request a correction/);
    assert.match(form, /Not synced\. Draft saved locally/);
    assert.match(form, /Retrying attendance sync/);
    assert.match(form, /Draft synced with SchoolOS/);
    assert.match(form, /Sync failed\. Draft is still saved locally/);
    assert.match(form, /Conflict found\. Review before syncing/);
  });

  it("prints backend-owned monthly register totals and never opens protected exports directly", () => {
    const workspaces = read("components/attendance/attendance-m2-workspaces.tsx");
    const styles = read("app/globals.css");

    assert.match(workspaces, /register\.summary/);
    assert.match(workspaces, /window\.print\(\)/);
    assert.match(workspaces, /Print register/);
    assert.doesNotMatch(workspaces, /window\.open\(/);
    assert.doesNotMatch(workspaces, /function summarizeRegister/);
    assert.match(styles, /@page[\s\S]*size: A4 landscape/);
    assert.match(styles, /attendance-register-print/);
  });
});
