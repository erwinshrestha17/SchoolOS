#!/usr/bin/env node

/**
 * GA program wave verification helper.
 * Usage: node scripts/ga-program-verify.mjs wave0|wave1|wave2|wave3|wave4|wave5|wave6
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './lib/schoolos-env.mjs';

const wave = process.argv[2] ?? 'wave0';
const evidenceDir = join(repoRoot, 'docs/production/evidence');
const stamp = new Date().toISOString().slice(0, 10);
const evidencePath = join(evidenceDir, `ga-${wave}-${stamp}-local.md`);

function run(name, command, args, optional = false) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
  });
  const ok = result.status === 0;
  return {
    name,
    status: ok ? 'PASS' : optional ? 'SKIP/FAIL' : 'FAIL',
    detail: (result.stdout || result.stderr || '').trim().slice(0, 800),
  };
}

const checks = [];

checks.push(run('db:validate', 'pnpm', ['db:validate']));
checks.push(run('verify:openapi', 'pnpm', ['verify:openapi']));
checks.push(run('api typecheck', 'pnpm', ['--filter', '@schoolos/api', 'exec', 'tsc', '--noEmit']));

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
  checks.push(
    run('smoke:pilot (staging env)', 'pnpm', ['smoke:pilot'], true),
  );
}

if (wave === 'wave1') {
  checks.push(
    run('M15 notice workflows spec', 'pnpm', [
      '--filter',
      '@schoolos/web',
      'exec',
      'playwright',
      'test',
      'm12-m15-notice-workflows.spec.ts',
    ], true),
  );
}

if (wave === 'wave4') {
  checks.push(
    run('M7-M11 role boundaries spec', 'pnpm', [
      '--filter',
      '@schoolos/web',
      'exec',
      'playwright',
      'test',
      'm7-m11-role-boundaries.spec.ts',
    ], true),
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
    ], true),
  );
}

if (wave === 'wave2') {
  checks.push(
    run('M3 fees smoke spec', 'pnpm', [
      '--filter',
      '@schoolos/web',
      'exec',
      'playwright',
      'test',
      'attendance-fees-smoke.spec.ts',
    ], true),
  );
}

if (wave === 'wave3') {
  checks.push(
    run('M4 academics smoke spec', 'pnpm', [
      '--filter',
      '@schoolos/web',
      'exec',
      'playwright',
      'test',
      'academics-phase2a-smoke.spec.ts',
    ], true),
  );
}

if (wave === 'wave5') {
  checks.push(run('smoke:learning', 'pnpm', ['smoke:learning'], true));
}

const failed = checks.filter((c) => c.status === 'FAIL');
mkdirSync(evidenceDir, { recursive: true });
writeFileSync(
  evidencePath,
  `# GA ${wave} verification (${stamp}, local)

Status: ${failed.length === 0 ? 'PASS' : 'PARTIAL'}

| Check | Result | Detail |
|---|---|---|
${checks.map((c) => `| ${c.name} | ${c.status} | ${c.detail.replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`).join('\n')}

`,
);

console.log(`GA ${wave} verification written to ${evidencePath}`);
process.exitCode = failed.length > 0 ? 1 : 0;
