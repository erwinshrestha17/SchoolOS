#!/usr/bin/env node

import { inspectMobileReleaseConfig } from './lib/mobile-release-config.mjs';
import { repoRoot } from './lib/schoolos-env.mjs';

const errors = inspectMobileReleaseConfig({ repoRoot });

if (errors.length > 0) {
  console.error('Mobile production release configuration failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  console.error(
    'This check validates configuration only; signed store artifacts, size estimates, provider delivery, physical-device QA, and pilot evidence remain separate gates.',
  );
  process.exit(1);
}

console.log('Mobile production release configuration passed.');
console.log(
  'Signed store artifacts, size estimates, provider delivery, physical-device QA, and pilot evidence remain separate gates.',
);
