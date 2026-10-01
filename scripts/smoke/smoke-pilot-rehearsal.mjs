#!/usr/bin/env node

process.env.SMOKE_WAVE1_PILOT = 'true';
process.env.SMOKE_TENANT_SLUG =
  process.env.SMOKE_TENANT_SLUG ?? 'pilot-rehearsal-1';
process.env.SMOKE_EMAIL =
  process.env.SMOKE_EMAIL ?? 'admin@pilot-rehearsal.schoolos.test';

const personaPassword =
  process.env.PILOT_REHEARSAL_PERSONA_PASSWORD ??
  process.env.PILOT_REHEARSAL_ADMIN_PASSWORD ??
  'PilotRehearsal1!';

process.env.SMOKE_PASSWORD =
  process.env.SMOKE_PASSWORD ??
  process.env.PILOT_REHEARSAL_VERIFIED_ADMIN_PASSWORD ??
  'Ktm!7River-Cedar29';
process.env.SMOKE_PRINCIPAL_PASSWORD = personaPassword;
process.env.SMOKE_PARENT_PASSWORD = personaPassword;
process.env.SMOKE_CLASS_TEACHER_PASSWORD = personaPassword;
process.env.SMOKE_SUBJECT_TEACHER_PASSWORD = personaPassword;
process.env.SMOKE_STAFF_PASSWORD = personaPassword;
process.env.SMOKE_ACCOUNTANT_PASSWORD = personaPassword;
process.env.SMOKE_DRIVER_PASSWORD = personaPassword;

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const result = spawnSync(
  process.execPath,
  [join(scriptDir, 'smoke-runner-local.mjs'), 'pilot'],
  { encoding: 'utf8', env: process.env },
);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

const passed = result.status === 0;
const evidenceDir = join(scriptDir, '..', 'docs', 'production', 'evidence');
const stamp = new Date().toISOString().slice(0, 10);
const evidencePath = join(
  evidenceDir,
  `controlled-pilot-rehearsal-smoke-${stamp}-local.md`,
);
mkdirSync(evidenceDir, { recursive: true });
writeFileSync(
  evidencePath,
  `# Controlled-Pilot Rehearsal Smoke (${stamp}, local)

- Tenant: \`pilot-rehearsal-1\`
- Result: **${passed ? 'PASS' : 'FAIL'}**
- Boundary: deterministic local-staging rehearsal; not real-school pilot evidence

## Output

\`\`\`text
${`${result.stdout ?? ''}${result.stderr ?? ''}`.trim()}
\`\`\`
`,
  'utf8',
);
console.log(`Evidence written to ${evidencePath}`);

process.exit(result.status ?? 1);
