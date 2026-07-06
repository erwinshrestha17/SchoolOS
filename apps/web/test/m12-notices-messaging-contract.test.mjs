import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const webRoot = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, webRoot), "utf8");

describe("M12 notices and messaging contract", () => {
  it("requires a recipient-preview confirmation for whole-school notices, not just emergencies", () => {
    const form = read("components/forms/communications-form.tsx");

    // The high-impact gate must cover audienceType "ALL" in addition to
    // EMERGENCY priority — a school-wide NORMAL/URGENT notice is just as
    // impactful to send by mistake as an emergency one.
    assert.match(
      form,
      /isHighImpactNotice\s*=\s*\n?\s*notice\.priority === "EMERGENCY" \|\| notice\.audienceType === "ALL"/,
    );
    assert.match(form, /isHighImpactNotice && !recipientPreview/);
    assert.match(form, /isHighImpactNotice && !highImpactConfirmed/);
    assert.match(
      form,
      /This notice goes to the whole school\. Preview and confirm recipients/,
    );
  });

  it("requires confirmation before an irreversible parent-teacher thread close", () => {
    const workspace = read(
      "components/messaging/parent-teacher-messaging-workspace.tsx",
    );

    assert.match(workspace, /isConfirmingClose/);
    assert.match(workspace, /Confirm thread close/);
    // The Moderation panel's onSubmit must open the dialog, not call
    // closeMutation.mutate() directly on click.
    assert.doesNotMatch(
      workspace,
      /if \(moderationReason\.trim\(\)\.length >= 3\)\s*\n\s*closeMutation\.mutate\(\);/,
    );
  });
});
