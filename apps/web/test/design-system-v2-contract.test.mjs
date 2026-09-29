import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  AD_HOC_OVERLAY_BASELINE_MAX,
  LEGACY_PRIMITIVES,
} from '../components/schoolos/legacy-map.ts';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(webRoot, path), 'utf8');

function sourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(join(webRoot, dir))) {
    const rel = join(dir, entry);
    const abs = join(webRoot, rel);
    if (statSync(abs).isDirectory()) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      out.push(...sourceFiles(rel));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.d\.ts$/.test(entry)) {
      out.push(rel);
    }
  }
  return out;
}

const FILES = ['app', 'components', 'lib'].flatMap(sourceFiles);

function resolveSpecifier(fromFile, spec) {
  let base;
  if (spec.startsWith('@/')) base = spec.slice(2);
  else if (spec.startsWith('.'))
    base = relative(webRoot, resolve(webRoot, dirname(fromFile), spec));
  else return null;
  return base.replace(/\.(tsx?|jsx?)$/, '').replace(/\/index$/, '');
}

function importersOf(module) {
  const importers = new Set();
  for (const file of FILES) {
    const self = file.replace(/\.(tsx?)$/, '').replace(/\/index$/, '');
    if (self === module) continue;
    const source = read(file);
    for (const match of source.matchAll(
      /(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g,
    )) {
      const spec = match[1] ?? match[2];
      if (resolveSpecifier(file, spec) === module) importers.add(file);
    }
  }
  return [...importers].sort();
}

describe('Design System v2 — one canonical layer (Phase 3C)', () => {
  it('exports every canonical responsibility from components/schoolos', () => {
    const barrel = read('components/schoolos/index.ts');
    for (const name of [
      'Surface',
      'Section',
      'Panel',
      'Card',
      'Metric',
      'StatusBadge',
      'DataWorkspace',
      'PaginatedDataTable',
      'Inspector',
      'useInspectorState',
      'Entity360',
      'QueueWorkspace',
      'FormSection',
      'FormSectionNav',
      'StickyFormActions',
      'FormField',
      'ConfirmDialog',
      'SearchableSelect',
      'Timeline',
      'Dialog',
    ]) {
      assert.match(barrel, new RegExp(`\\b${name}\\b`), `${name} missing`);
    }
  });

  it('reuses existing canonical implementations instead of re-creating them', () => {
    const barrel = read('components/schoolos/index.ts');
    assert.match(barrel, /SummaryCard as Metric/);
    assert.match(barrel, /from '\.\.\/ui\/status-badge'/);
    assert.match(barrel, /from '\.\.\/ui\/form-field'/);
    assert.match(barrel, /from '\.\.\/ui\/confirm-dialog'/);
    // DataWorkspace renders the one grid; Inspector renders the one Drawer.
    assert.match(
      read('components/schoolos/workspace/data-workspace.tsx'),
      /<PaginatedDataTable/,
    );
    assert.match(
      read('components/schoolos/workspace/inspector.tsx'),
      /<Drawer/,
    );
    for (const file of FILES.filter((f) =>
      f.startsWith('components/schoolos/'),
    )) {
      assert.doesNotMatch(
        read(file),
        /<table[\s>]/,
        `${file} renders a raw table`,
      );
    }
  });

  it('does not introduce a third component tree', () => {
    for (const forbidden of [
      'components/v2',
      'components/ds',
      'components/design-system',
      'components/ui-v2',
    ]) {
      assert.equal(existsSync(join(webRoot, forbidden)), false, forbidden);
    }
  });

  it('keeps legacy primitives on a shrinking ratchet', () => {
    const over = [];
    for (const legacy of LEGACY_PRIMITIVES) {
      const count = importersOf(legacy.module).length;
      if (count > legacy.maxImporters)
        over.push(
          `${legacy.module}: ${count} importers > ${legacy.maxImporters} (use ${legacy.replacement})`,
        );
    }
    assert.deepEqual(over, []);
  });

  it('does not add new hand-rolled fixed overlays', () => {
    const overlays = FILES.filter(
      (file) =>
        file.endsWith('.tsx') &&
        !file.startsWith('components/ui/') &&
        /fixed inset-0/.test(read(file)),
    );
    assert.ok(
      overlays.length <= AD_HOC_OVERLAY_BASELINE_MAX,
      `ad-hoc overlays grew to ${overlays.length}: use Dialog/ConfirmDialog/Inspector`,
    );
  });

  it('keeps canonical components free of raw red/rose utilities and module colours', () => {
    for (const file of FILES.filter((f) =>
      f.startsWith('components/schoolos/'),
    )) {
      const source = read(file);
      assert.doesNotMatch(
        source,
        /\b(?:bg|text|border)-(?:red|rose)-\d{2,3}\b/,
        file,
      );
      assert.doesNotMatch(source, /--color-mod-/, file);
      assert.doesNotMatch(source, /shadow-(?:xl|2xl)|rounded-3xl/, file);
    }
  });
});

describe('Design System v2 tokens (Phase 3D)', () => {
  const css = read('app/globals.css');

  it('defines the §5.3 geometry scale', () => {
    for (const [token, value] of [
      ['--radius-chip', '6px'],
      ['--radius-control', '8px'],
      ['--radius-surface', '12px'],
      ['--spacing-control-compact', '32px'],
      ['--spacing-control', '40px'],
      ['--spacing-control-large', '44px'],
      ['--spacing-row-compact', '44px'],
      ['--spacing-row', '48px'],
      ['--spacing-gutter-compact', '16px'],
      ['--spacing-gutter', '24px'],
      ['--spacing-gutter-large', '32px'],
      ['--spacing-inspector-sm', '360px'],
      ['--spacing-inspector-md', '440px'],
      ['--spacing-inspector-lg', '560px'],
    ]) {
      assert.match(css, new RegExp(`${token}:\\s*${value};`), token);
    }
    assert.match(css, /--shadow-popover:/);
    assert.match(css, /--shadow-overlay:/);
  });

  it('does not redefine Tailwind default radius steps', () => {
    assert.doesNotMatch(css, /--radius-(?:sm|md|lg):/);
  });
});

describe('DataWorkspace and Inspector (Phase 3E/3F)', () => {
  const workspace = read('components/schoolos/workspace/data-workspace.tsx');
  const inspector = read('components/schoolos/workspace/inspector.tsx');
  const table = read('components/schoolos/data/paginated-data-table.tsx');

  it('supports search, filters, chips, columns, density, refresh, export, inspector', () => {
    for (const feature of [
      /<SearchInput/,
      /moreFilters/,
      /<FilterChips/,
      /Visible columns/,
      /onDensityChange/,
      /onRefresh/,
      /exportAction/,
      /\{inspector\}/,
      /refreshError/,
    ])
      assert.match(workspace, feature);
  });

  it('derives "no results" from active filters, never from a guessed total', () => {
    assert.match(workspace, /hasActiveFilters=\{hasActiveFilters\}/);
    assert.match(table, /Server-owned pagination metadata/);
  });

  it('applies density and hidden columns inside the one grid', () => {
    assert.match(table, /hiddenColumnIds/);
    assert.match(table, /h-row-compact/);
    assert.match(table, /visibleColumns\.map\(/);
  });

  it('keeps the open record in the URL without resetting list state', () => {
    assert.match(inspector, /useUrlFilters/);
    assert.match(inspector, /parseInspectorId/);
    assert.doesNotMatch(inspector, /resetPage:\s*true/);
    assert.match(inspector, /max-w-inspector-sm/);
    assert.match(inspector, /max-w-inspector-lg/);
  });
});

describe('Entity360 consumes the server authorization contract (3A × 3C)', () => {
  const entity = read('components/schoolos/workspace/entity-360.tsx');

  it('gates tabs through the shared fail-closed reader only', () => {
    assert.match(entity, /resourceAccess/);
    assert.match(entity, /tab\.sections\.every/);
    assert.doesNotMatch(entity, /roles?\.includes|permissions?\.includes/);
  });
});

describe('Form system (Phase 3G)', () => {
  const form = read('components/schoolos/form/form-system.tsx');

  it('groups with fieldset/legend and navigates by section', () => {
    assert.match(form, /<fieldset/);
    assert.match(form, /<legend/);
    assert.match(form, /aria-current=\{item\.id === activeId \? 'location'/);
  });

  it('never enables save without changes or while saving', () => {
    assert.match(form, /disabled=\{!dirty \|\| saving \|\| saveDisabled\}/);
    assert.match(form, /aria-live="polite"/);
  });

  it('guards dirty forms against unload', () => {
    assert.match(form, /beforeunload/);
  });
});
