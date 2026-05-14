#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const coreDist = path.join(repoRoot, 'packages/core/dist');
const requiredFiles = [
  path.join(coreDist, 'index.js'),
  path.join(coreDist, 'index.d.ts'),
];

if (!existsSync(coreDist)) {
  console.error('Error: packages/core/dist does not exist. Run `pnpm --filter @schoolos/core build` first.');
  process.exit(1);
}

if (!statSync(coreDist).isDirectory()) {
  console.error('Error: packages/core/dist exists but is not a directory.');
  process.exit(1);
}

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    console.error(`Error: required @schoolos/core build artifact is missing: ${path.relative(repoRoot, file)}`);
    process.exit(1);
  }
}

const pollutionPatterns = [
  { pattern: /import\.meta\.webpackHot/, name: 'import.meta.webpackHot' },
  { pattern: /Refresh Boundary/, name: 'Refresh Boundary' },
  { pattern: /RefreshBoundary/, name: 'RefreshBoundary' },
  { pattern: /webpackHot/, name: 'webpackHot' },
];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      walk(fullPath, files);
    } else if (entry.endsWith('.js') || entry.endsWith('.d.ts')) {
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
  // Catches: from './permissions', import './something', import('./something'), etc.
  const esmRelativeImportPattern =
    /(?:\bfrom\s+|\bimport\s+(?:[^'"]+\s+from\s+)?|\bexport\s+[^'"]+\s+from\s+|\bimport\s*\(\s*)['"](\.\.?\/[^'"]*?)['"]/g;
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
  console.error(`\nError: packages/core/dist failed validation.`);
  console.error(`Ensure @schoolos/core is built with 'tsc', emits Node ESM-safe imports, and is not processed by Next.js/Webpack.`);
  process.exit(1);
}

console.log('packages/core/dist is clean.');
