import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(join(webRoot, relativePath), 'utf8');
}

describe('Shadcn foundation (components.json + primitive bridge)', () => {
  it('points the ui alias at a non-colliding primitives folder', () => {
    const config = JSON.parse(read('components.json'));
    assert.equal(config.aliases.ui, '@/components/ui/primitives');
    assert.equal(config.aliases.components, '@/components/schoolos');
    assert.equal(config.tailwind.cssVariables, true);
  });

  it('installs Shadcn primitives without touching any existing components/ui/*.tsx file', () => {
    assert.ok(existsSync(join(webRoot, 'components/ui/primitives/button.tsx')));
    assert.ok(existsSync(join(webRoot, 'components/ui/primitives/dialog.tsx')));
    // The pre-existing custom Button/Dialog (91 and 36 consumers respectively)
    // must remain untouched adapters, not be overwritten by the CLI.
    const legacyButton = read('components/ui/button.tsx');
    assert.doesNotMatch(legacyButton, /radix-ui/);
  });

  it('upgrades cn() to clsx + tailwind-merge without changing its call signature', () => {
    const utils = read('lib/utils.ts');
    assert.match(utils, /import \{ type ClassValue, clsx \} from 'clsx'/);
    assert.match(utils, /import \{ twMerge \} from 'tailwind-merge'/);
    assert.match(utils, /export function cn\(\.\.\.inputs: ClassValue\[\]\)/);
  });

  it('bridges Shadcn semantic tokens onto existing SchoolOS brand tokens instead of overloading them', () => {
    const css = read('app/globals.css');
    // --secondary and --muted already mean something else in SchoolOS
    // (a purple brand accent and a text color, respectively), so the bridge
    // must not repoint those existing names at new Shadcn surface colors.
    assert.match(css, /--secondary-surface: #F1F5F9;/);
    assert.match(css, /--muted-surface-foreground: var\(--muted\);/);
    assert.match(css, /--color-secondary: var\(--secondary-surface\);/);
    assert.match(css, /--color-muted: var\(--muted-surface\);/);
    // Must not redefine the global Tailwind radius scale (rounded-lg is used
    // 350+ times across the app; silently resizing it would be a visual
    // regression far outside this task's scope).
    assert.doesNotMatch(css, /--radius-lg: var\(--radius\)/);
  });

  it('mounts TooltipProvider and a light-pinned Sonner Toaster once, globally', () => {
    const providers = read('app/providers.tsx');
    assert.match(providers, /from '..\/components\/ui\/primitives\/tooltip'/);
    assert.match(providers, /from '..\/components\/ui\/primitives\/sonner'/);
    assert.match(providers, /<TooltipProvider>/);
    assert.match(providers, /<Toaster theme="light"/);
  });
});

describe('PaginatedDataTable (components/schoolos/data)', () => {
  const source = read('components/schoolos/data/paginated-data-table.tsx');

  it('is built on the new Shadcn table/checkbox primitives, not a duplicate grid', () => {
    assert.match(source, /from '@\/components\/ui\/primitives\/table'/);
    assert.match(source, /from '@\/components\/ui\/primitives\/checkbox'/);
  });

  it('models selection as a discriminated union so "select all" can never silently imply every backend record', () => {
    assert.match(source, /mode: 'none'/);
    assert.match(source, /mode: 'explicit'; ids: Set<string>/);
    assert.match(source, /mode: 'all-matching-filter'; totalCount: number/);
    assert.match(source, /onSelectAllMatchingFilter/);
  });

  it('takes server-owned pagination metadata rather than deriving totals from loaded rows', () => {
    assert.match(source, /totalItems: number/);
    assert.match(source, /onPageChange: \(page: number\) => void/);
    assert.doesNotMatch(source, /items\.length \* pageSize/);
  });

  it('renders every required list screen state explicitly', () => {
    for (const status of ['loading', 'error', 'permission-denied', 'module-locked']) {
      assert.match(source, new RegExp(`status === '${status}'`));
    }
    assert.match(source, /showEmpty/);
    assert.match(source, /showNoResults/);
  });
});

describe('QueuedJobState (components/schoolos/jobs)', () => {
  const source = read('components/schoolos/jobs/queued-job-state.tsx');

  it('covers the full background-job lifecycle from the design system', () => {
    for (const status of [
      'QUEUED',
      'PROCESSING',
      'SUCCEEDED',
      'PARTIALLY_SUCCEEDED',
      'FAILED',
      'CANCELLED',
      'EXPIRED',
    ]) {
      assert.match(source, new RegExp(status));
    }
  });

  it('reuses the shared StatusBadge instead of a second badge implementation', () => {
    assert.match(source, /from '@\/components\/ui\/status-badge'/);
  });

  it('never simulates progress client-side', () => {
    assert.match(source, /Never simulates progress client-side|Backend-owned background-job status/);
    assert.doesNotMatch(source, /setInterval|setTimeout/);
  });

  it('surfaces backend-provided partial-failure detail rather than inventing it', () => {
    assert.match(source, /failureItems/);
    assert.match(source, /never invented in the browser/);
  });
});

describe('StatusBadge job-lifecycle extension (additive only)', () => {
  const source = read('components/ui/status-badge.tsx');

  it('adds new lifecycle keys without changing any existing mapping', () => {
    // Original mappings this file shipped with (46 consumers depend on
    // these exact tones) must remain byte-for-byte present.
    assert.match(source, /ACTIVE: 'active',/);
    assert.match(source, /QUEUED: 'pending',/);
    assert.match(source, /FAILED: 'rejected',/);
    assert.match(source, /PAID: 'paid',/);
    // New job-lifecycle keys added for QueuedJobState.
    assert.match(source, /PROCESSING: 'pending',/);
    assert.match(source, /PARTIALLY_SUCCEEDED: 'partial',/);
    assert.match(source, /EXPIRED: 'rejected',/);
  });
});
