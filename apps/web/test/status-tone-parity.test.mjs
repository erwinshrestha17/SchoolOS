import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { STATUS_TONE_MAP } from '@schoolos/core';

// Phase 4G: mobile and Web must render every status with the same tone.
const dart = readFileSync(
  new URL(
    '../../schoolos_mobile/lib/shared/design/status_tone.dart',
    import.meta.url,
  ),
  'utf8',
);

test('the Dart status-tone mirror matches the core table exactly', () => {
  const mirrored = Object.fromEntries(
    [...dart.matchAll(/'(\w+)': StatusTone\.(\w+),/g)].map((m) => [m[1], m[2]]),
  );
  assert.deepEqual(mirrored, { ...STATUS_TONE_MAP });
});

test('StatusChip colours come only from the shared tone table', () => {
  const chip = readFileSync(
    new URL(
      '../../schoolos_mobile/lib/shared/widgets/status_chip.dart',
      import.meta.url,
    ),
    'utf8',
  );
  assert.match(chip, /statusToneColors\(/);
  assert.doesNotMatch(chip, /AppColors\./);
});
