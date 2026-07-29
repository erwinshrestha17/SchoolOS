#!/usr/bin/env node

process.env.SMOKE_WAVE1_PILOT = 'true';
process.env.SMOKE_TENANT_SLUG =
  process.env.SMOKE_TENANT_SLUG ?? 'pilot-rehearsal-1';
process.env.SMOKE_EMAIL =
  process.env.SMOKE_EMAIL ?? 'admin@pilot-rehearsal.schoolos.test';

const personaPassword =
  process.env.PILOT_REHEARSAL_PERSONA_PASSWORD ??
  process.env.PILOT_REHEARSAL_ADMIN_PASSWORD ??
  process.env.SMOKE_PASSWORD ??
  'PilotRehearsal1!';

process.env.SMOKE_PASSWORD = personaPassword;
process.env.SMOKE_PRINCIPAL_PASSWORD = personaPassword;
process.env.SMOKE_PARENT_PASSWORD = personaPassword;
process.env.SMOKE_CLASS_TEACHER_PASSWORD = personaPassword;
process.env.SMOKE_SUBJECT_TEACHER_PASSWORD = personaPassword;
process.env.SMOKE_STAFF_PASSWORD = personaPassword;
process.env.SMOKE_ACCOUNTANT_PASSWORD = personaPassword;
process.env.SMOKE_DRIVER_PASSWORD = personaPassword;

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const result = spawnSync(
  process.execPath,
  [join(scriptDir, 'smoke-runner-local.mjs'), 'pilot'],
  { stdio: 'inherit', env: process.env },
);

process.exit(result.status ?? 1);
