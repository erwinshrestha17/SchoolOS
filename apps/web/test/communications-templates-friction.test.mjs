import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("communication template confirmation friction is proportionate to risk", () => {
  const page = read("app/dashboard/communications/templates/page.tsx");

  it("publishes a template directly (toast+undo), no blocking confirm dialog", () => {
    // Publishing only makes a template selectable by notice authors; it has
    // no effect on anyone until a separate, already-gated notice send, and
    // archiving reverses it instantly. A full modal is disproportionate.
    assert.match(page, /function publishTemplate\(template: CommunicationTemplateSummary\) \{\s*publishMutation\.mutate\(template\.id\);/);
    assert.doesNotMatch(page, /"publish" \| "archive"/);
    assert.doesNotMatch(page, /Publish communication template\?/);
  });

  it("offers an Undo action on the publish success toast that archives it back", () => {
    assert.match(page, /undo: \(\) => archiveMutation\.mutate\(template\.id\)/);
    assert.match(page, /<Toast/);
    assert.match(page, /action=\{/);
  });

  it("keeps archive behind the confirmation dialog (still real risk: disrupts in-progress notice authoring)", () => {
    assert.match(page, /function archiveTemplate\(template: CommunicationTemplateSummary\) \{\s*setPendingAction\(\{ action: "archive", template \}\);/);
    assert.match(page, /title="Archive communication template\?"/);
    assert.match(page, /variant="warning"/);
  });

  it("still requires no reason for either action (matches the real backend contract, not invented)", () => {
    const api = read("lib/api/communications.ts");
    assert.match(
      api,
      /publishCommunicationTemplate: \(templateId: string\) =>/,
    );
    assert.match(
      api,
      /archiveCommunicationTemplate: \(templateId: string\) =>/,
    );
  });
});
