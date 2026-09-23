import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('local backup rehearsal rejects source-as-target before connecting', () => {
  // An unreachable endpoint makes this regression safe even if the guard is
  // accidentally removed: it can never connect to or drop a real database.
  const databaseUrl =
    'postgresql://fixture:fixture@127.0.0.1:1/schoolos_guard_test';
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(
        new URL(
          '../../../scripts/rehearse-backup-restore-local.mjs',
          import.meta.url,
        ),
      ),
      '--skip-docker-check',
    ],
    {
      encoding: 'utf8',
      timeout: 10_000,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        RESTORE_DATABASE_URL: databaseUrl,
        ALLOW_RESTORE_INPLACE: '0',
      },
    },
  );
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Refusing in-place restore into ['"]schoolos_guard_test['"]/,
  );
  assert.doesNotMatch(result.stdout, /Creating backup|Backup completed/);
});
