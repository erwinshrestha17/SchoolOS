#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnvFile, repoRoot } from './lib/schoolos-env.mjs';

const envPath = join(repoRoot, 'apps/api/.env.staging-local');
if (existsSync(envPath)) {
  loadEnvFile(envPath);
}
process.env.NODE_ENV = process.env.STAGING_API_NODE_ENV ?? 'development';

const child = spawn('node', ['dist/apps/api/src/main.js'], {
  cwd: join(repoRoot, 'apps/api'),
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => process.exit(code ?? 0));
