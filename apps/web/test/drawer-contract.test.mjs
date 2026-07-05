import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("shared Drawer primitive", () => {
  const drawer = read("components/ui/drawer.tsx");

  it("is a real portal-based dialog, not an inline positioned div", () => {
    assert.match(drawer, /createPortal\(/);
    assert.match(drawer, /document\.body/);
  });

  it("closes on Escape and on backdrop click", () => {
    assert.match(drawer, /event\.key === 'Escape'/);
    assert.match(drawer, /onClick=\{onClose\}/);
  });

  it("is accessible: dialog role, aria-modal, and labelled by its own title", () => {
    assert.match(drawer, /role="dialog"/);
    assert.match(drawer, /aria-modal="true"/);
    assert.match(drawer, /aria-labelledby=\{titleId\}/);
  });

  it("moves focus to the close control on open", () => {
    assert.match(drawer, /closeButtonRef\.current\?\.focus\(\)/);
  });

  it("does not introduce forbidden visual styles", () => {
    assert.doesNotMatch(
      drawer,
      /bg-slate-950|bg-slate-900|shadow-xl|shadow-2xl|rounded-3xl/,
    );
  });
});

describe("Student Inspector uses the shared Drawer instead of an ad-hoc panel", () => {
  const directory = read("components/forms/student-directory.tsx");

  it("renders through the shared Drawer component", () => {
    assert.match(directory, /import \{ Drawer \} from '\.\.\/ui\/drawer'/);
    assert.match(directory, /<Drawer/);
    assert.match(directory, /title="Student Inspector"/);
  });

  it("removed the old hand-rolled fixed-position panel", () => {
    assert.doesNotMatch(directory, /aria-label="Selected student inspector"/);
    assert.doesNotMatch(directory, /fixed inset-y-0 right-0 z-40 w-full max-w-\[360px\]/);
  });
});
