#!/usr/bin/env node

/**
 * GA program wave verification helper.
 * Usage: node scripts/ga-program-verify.mjs wave0|wave1|wave2|wave3|wave4|wave5|wave6
 *
 * Release-truth rule:
 * - Every check declared for a wave is blocking by default.
 * - Environment/server/tooling failures are FAIL for required checks; they
 *   must never be converted into a PASS-like state.
 * - A check may be marked non-blocking only when it is explicitly declared
 *   with { required: false } and is genuinely optional to that wave.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './lib/schoolos-env.mjs';

const wave = process.argv[2] ?? 'wave0';
const evidenceDir = join(repoRoot, 'docs/production/evidence');
const stamp = new Date().toISOString().slice(0, 10);
const evidencePath = join(evidenceDir, `ga-${wave}-${stamp}-local.md`);

function run(name, command, args, options = {}) {
  const { required = true } = options;
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
  });
  const ok = result.status === 0;

  return {
    name,
    required,
    status: ok ? 'PASS' : required ? 'FAIL' : 'OPTIONAL_FAIL',
    detail: (result.stdout || result.stderr || '').trim().slice(0, 800),
  };
}

const checks = [];

checks.push(run('db:validate', 'pnpm', ['db:validate']));
checks.push(run('verify:openapi', 'pnpm', ['verify:openapi']));
checks.push(
  run('api typecheck', 'pnpm', [
    '--filter',
    '@schoolos/api',
    'exec',
    'tsc',
    '--noEmit',
  ]),
);

if (wave === 'wave0' || wave === 'wave1') {
  checks.push(
    run('entitlement contract', 'pnpm', [
      '--filter',
      '@schoolos/api',
      'test',
      'entitlement-coverage.contract.spec',
    ]),
  );
}

if (wave === 'wave0' || wave === 'wave1') {
  checks.push(run('smoke:pilot (staging env)', 'pnpm', ['smoke:pilot']));
}

if (wave === 'wave1') {
  checks.push(
    run('verify:m1-admissions (staging env)', 'pnpm', [
      'verify:m1-admissions',
    ]),
  );
  checks.push(
    run('verify:m2-attendance (staging env)', 'pnpm', [
      'verify:m2-attendance',
    ]),
  );
  checks.push(
    run('verify:m15-notices (staging env)', 'pnpm', [
      'verify:m15-notices',
    ]),
  );
  checks.push(
    run('verify:m6-homework (staging env)', 'pnpm', [
      'verify:m6-homework',
    ]),
  );
  checks.push(
    run('verify:m5-activity (staging env)', 'pnpm', [
      'verify:m5-activity',
    ]),
  );
  checks.push(
    run('M15 notice workflows spec', 'pnpm', [
      '--filter',
      '@schoolos/web',
      'exec',
      'playwright',
      'test',
      'm12-m15-notice-workflows.spec.ts',
    ]),
  );
}

if (wave === 'wave2') {
  checks.push(
    run('verify:m3-fees (staging env)', 'pnpm', ['verify:m3-fees']),
  );
  checks.push(
    run('M3 fees smoke spec', 'pnpm', [
      '--filter',
      '@schoolos/web',
      'exec',
      'playwright',
      'test',
      'attendance-fees-smoke.spec.ts',
    ]),
  );
}

if (wave === 'wave3') {
  checks.push(
    run('verify:m4-academics (staging env)', 'pnpm', [
      'verify:m4-academics',
    ]),
  );
  checks.push(
    run('M4 academics smoke spec', 'pnpm', [
      '--filter',
      '@schoolos/web',
      'exec',
      'playwright',
      'test',
      'academics-phase2a-smoke.spec.ts',
    ]),
  );
}

if (wave === 'wave4') {
  checks.push(
    run('verify:m7-hr (staging env)', 'pnpm', ['verify:m7-hr']),
  );
  checks.push(
    run('verify:m8-library (staging env)', 'pnpm', ['verify:m8-library']),
  );
  checks.push(
    run('verify:m9-transport (staging env)', 'pnpm', ['verify:m9-transport']),
  );
  checks.push(
    run('verify:m10-canteen (staging env)', 'pnpm', ['verify:m10-canteen']),
  );
  checks.push(
    run('verify:m11-accounting (staging env)', 'pnpm', [
      'verify:m11-accounting',
    ]),
  );
  checks.push(
    run('M7-M11 role boundaries spec', 'pnpm', [
      '--filter',
      '@schoolos/web',
      'exec',
      'playwright',
      'test',
      'm7-m11-role-boundaries.spec.ts',
    ]),
  );
}

if (wave === 'wave6') {
  checks.push(
    run('tenant register spec', 'pnpm', [
      '--filter',
      '@schoolos/api',
      'test',
      'tenants.service.spec',
    ]),
  );
}

if (wave === 'wave1' || wave === 'wave0') {
  checks.push(
    run('flutter analyze', 'bash', [
      '-lc',
      'cd apps/schoolos_mobile && flutter analyze',
    ]),
  );
}

if (wave === 'wave5') {
  checks.push(run('smoke:learning', 'pnpm', ['smoke:learning']));
}

const blockingFailures = checks.filter(
  (check) => check.required && check.status !== 'PASS',
);
const overallStatus = blockingFailures.length === 0 ? 'PASS' : 'FAIL';

mkdirSync(evidenceDir, { recursive: true });
writeFileSync(
  evidencePath,
  `# GA ${wave} verification (${stamp}, local)

Status: ${overallStatus}

| Check | Required | Result | Detail |
|---|---|---|---|
${checks
  .map(
    (check) =>
      `| ${check.name} | ${check.required ? 'yes' : 'no'} | ${check.status} | ${check.detail.replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`,
  )
  .join('\n')}

`,
);

console.log(`GA ${wave} verification written to ${evidencePath}`);
process.exitCode = blockingFailures.length > 0 ? 1 : 0;
