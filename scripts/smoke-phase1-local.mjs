#!/usr/bin/env node

// Legacy smoke:phase1 wrapper delegating to modern smoke:pilot
process.argv[2] = 'pilot';
await import('./smoke-runner-local.mjs');
