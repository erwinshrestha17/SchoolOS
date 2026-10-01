#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const scannedRoots = ['apps/api', 'apps/web'];
const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const blockedImportPatterns = [
  /from\s+['"](?:@schoolos\/core\/src(?:\/[^'"]*)?|packages\/core\/src(?:\/[^'"]*)?)['"]/g,
  /import\s*\(\s*['"](?:@schoolos\/core\/src(?:\/[^'"]*)?|packages\/core\/src(?:\/[^'"]*)?)['"]\s*\)/g,
  /require\s*\(\s*['"](?:@schoolos\/core\/src(?:\/[^'"]*)?|packages\/core\/src(?:\/[^'"]*)?)['"]\s*\)/g,
];
const blockedLiteralPatterns = [
  /['"](?:@schoolos\/core\/src(?:\/[^'"]*)?|packages\/core\/src(?:\/[^'"]*)?)['"]/g,
];
const ignoredDirectories = new Set(['node_modules', '.next', 'dist', 'coverage', '.turbo']);

function walk(dir, files = []) {
  if (!existsSync(dir)) {
    return files;
  }

  for (const entry of readdirSync(dir)) {
    if (ignoredDirectories.has(entry)) {
      continue;
    }

    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      walk(fullPath, files);
      continue;
    }

    if (allowedExtensions.has(path.extname(entry))) {
      files.push(fullPath);
    }
  }

  return files;
}

const violations = [];

for (const root of scannedRoots) {
  const absoluteRoot = path.join(repoRoot, root);

  for (const file of walk(absoluteRoot)) {
    const source = readFileSync(file, 'utf8');
    const relativeFile = path.relative(repoRoot, file);

    for (const pattern of [...blockedImportPatterns, ...blockedLiteralPatterns]) {
      pattern.lastIndex = 0;
      for (const match of source.matchAll(pattern)) {
        const line = source.slice(0, match.index).split('\n').length;
        violations.push(`${relativeFile}:${line} -> ${match[0]}`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Raw @schoolos/core source imports are not allowed in runtime apps.');
  console.error('Import from the compiled package boundary instead: @schoolos/core');
  console.error('');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('Core import boundary check passed.');
