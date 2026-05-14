#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const coreDist = path.join(repoRoot, 'packages/core/dist');

if (!existsSync(coreDist)) {
  console.log('packages/core/dist does not exist, skipping check.');
  process.exit(0);
}

const pollutionPatterns = [
  { pattern: /import\.meta\.webpackHot/g, name: 'import.meta.webpackHot' },
  { pattern: /webpackHot/g, name: 'webpackHot' },
  { pattern: /Refresh Boundary/g, name: 'Refresh Boundary' },
  { pattern: /RefreshBoundary/g, name: 'RefreshBoundary' },
];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      walk(fullPath, files);
    } else if (entry.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = walk(coreDist);
let violations = 0;

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  const relativeFile = path.relative(repoRoot, file);

  for (const { pattern, name } of pollutionPatterns) {
    if (pattern.test(content)) {
      console.error(`Pollution detected in ${relativeFile}: found ${name}`);
      violations++;
    }
  }

  // Check for ESM extensionless relative imports/exports
  // Catches: from './permissions', import './something', etc.
  const esmRelativeImportPattern = /(?:from|import)\s+['"](\.\.?\/[^'"]*?)['"]/g;
  let match;
  while ((match = esmRelativeImportPattern.exec(content)) !== null) {
    const importPath = match[1];
    // Allow valid extensions. Node ESM requires these for relative paths.
    const hasValidExtension = /\.(js|json|mjs|css|svg)$/.test(importPath);
    if (!hasValidExtension) {
      console.error(`Extensionless relative import detected in ${relativeFile}: found "${importPath}"`);
      violations++;
    }
  }
}

if (violations > 0) {
  console.error(`\nError: packages/core/dist is polluted with bundler-specific code (HMR/React Refresh).`);
  console.error(`Ensure @schoolos/core is only built with 'tsc' and not processed by Next.js/Webpack during build.`);
  process.exit(1);
}

console.log('packages/core/dist is clean.');
