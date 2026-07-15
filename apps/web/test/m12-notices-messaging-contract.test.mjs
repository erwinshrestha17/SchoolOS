import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const webRoot = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, webRoot), "utf8");

describe("M12 notifications and M15 notices boundary", () => {
  it("keeps the M15 overview focused and moves delivery settings out of it", () => {
    const workspace = read("components/notices/notices-workspace.tsx");
    const form = read("components/forms/communications-form.tsx");
    const shell = read("components/layout/dashboard-shell.tsx");

    assert.equal((workspace.match(/<SummaryCard/g) ?? []).length, 4);
    assert.match(workspace, /<SummaryGrid/);
    assert.match(workspace, /<WorkspaceTabs/);
    assert.match(workspace, /<WorkSurface/);
    assert.doesNotMatch(workspace, /title="Escalated Chats"/);
    assert.doesNotMatch(workspace, /title="Provider Status"/);
    assert.match(workspace, /label: 'Recipient Preview'/);
    assert.match(workspace, /label: 'Notification Settings'/);
    assert.match(workspace, /M15 Notices and Announcements/);
    assert.doesNotMatch(workspace, /Parent-Teacher Chat/);

    assert.match(form, /mode === "composer"\s*\? \["Notices"\]/);
    assert.match(form, /mode === "delivery"\s*\? \["Delivery Records"\]/);
    assert.match(form, /\["Notices", "Events", "Consent Management"\]/);
    assert.match(form, /<TabsList/);
    assert.match(form, /<TabsTrigger/);
    assert.doesNotMatch(form, /<ModuleTabs/);
    assert.match(
      form,
      /enabled: mode === "overview" && activeSection === "Notices"/,
    );
    assert.match(form, /enabled: activeSection === "Delivery Records"/);
    assert.match(workspace, /mode=\{/);

    assert.doesNotMatch(shell, /'\/dashboard\/notices':/);
    assert.doesNotMatch(shell, /'\/dashboard\/messages':/);
  });

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

  it("hides chat navigation and renders bounded compatibility routes", () => {
    const sidebar = read("components/layout/sidebar.tsx");
    const deferred = read("components/messaging/chat-deferred-state.tsx");
    const messagesPage = read("app/dashboard/messages/page.tsx");

    assert.doesNotMatch(sidebar, /label: 'Messages'/);
    assert.doesNotMatch(sidebar, /messaging:create/);
    assert.match(deferred, /Chat is deferred/);
    assert.match(messagesPage, /ChatDeferredState/);
  });
});
