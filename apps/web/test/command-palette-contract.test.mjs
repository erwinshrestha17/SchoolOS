import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("global command palette (Ctrl/Cmd+K)", () => {
  const palette = read("components/layout/command-palette.tsx");

  it("reuses the sidebar's exact nav data and permission filter, not a second copy", () => {
    assert.match(
      palette,
      /import \{\s*canDisplayNavItem,\s*dashboardNavGroups,\s*settingsNavItem,/,
    );
    assert.match(palette, /from '\.\/sidebar'/);
    assert.match(
      palette,
      /\.filter\(\(item\) => canDisplayNavItem\(item, session, hasModule\)\)/,
    );
  });

  it("opens on Ctrl/Cmd+K from anywhere and closes on Escape", () => {
    assert.match(palette, /event\.metaKey \|\| event\.ctrlKey/);
    assert.match(palette, /event\.key\.toLowerCase\(\) === 'k'/);
    assert.match(palette, /event\.key === 'Escape'/);
  });

  it("does not duplicate the topbar student/invoice search — '/' focuses it instead", () => {
    assert.match(palette, /event\.key === '\/'/);
    assert.match(
      palette,
      /document\s*\.getElementById\('global-student-search'\)/,
    );
    // The palette's own results are workspaces (NavItem[]), not students/invoices.
    assert.doesNotMatch(palette, /listInvoices|students\/search/);
  });

  it("supports arrow-key navigation and Enter-to-open, and is keyboard-accessible", () => {
    assert.match(palette, /event\.key === 'ArrowDown'/);
    assert.match(palette, /event\.key === 'ArrowUp'/);
    assert.match(palette, /event\.key === 'Enter'/);
    assert.match(palette, /role="dialog"/);
    assert.match(palette, /aria-modal="true"/);
  });

  it("is wired into the dashboard shell so it's available on every page", () => {
    const shell = read("components/layout/dashboard-shell.tsx");
    assert.match(shell, /import \{ CommandPalette \} from '\.\/command-palette'/);
    assert.match(shell, /<CommandPalette \/>/);
  });
});
