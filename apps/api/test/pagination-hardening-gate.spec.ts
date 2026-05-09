import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const API_SRC_ROOT = join(__dirname, '..', 'src');

const HIGH_GROWTH_MODULES = [
  'students',
  'student-records',
  'attendance',
  'finance',
  'activity-feed',
  'communications',
  'homework',
  'timetable',
  'staff',
  'payroll',
  'library',
  'transport',
  'canteen',
  'messaging',
];

const INTENTIONALLY_SMALL_LISTS = [
  '/settings/',
  '/plans/',
  '/usage/',
  '/platform/',
  '/notifications/',
];

function listFiles(root: string): string[] {
  if (!existsSync(root)) return [];

  const files: string[] = [];

  for (const entry of readdirSync(root)) {
    const fullPath = join(root, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...listFiles(fullPath));
    } else if (fullPath.endsWith('.service.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

function normalizePath(filePath: string) {
  return `/${relative(API_SRC_ROOT, filePath).replace(/\\/g, '/')}`;
}

function read(filePath: string) {
  return readFileSync(filePath, 'utf8');
}

function isAllowedSmallList(filePath: string) {
  const normalized = normalizePath(filePath);
  return INTENTIONALLY_SMALL_LISTS.some((allowedPath) =>
    normalized.includes(allowedPath),
  );
}

function serviceMethodBlocks(source: string) {
  const matches = source.matchAll(
    /(?:async\s+)?(list|getAll|search|findMany)[A-Z][A-Za-z0-9_]*\s*\([^)]*\)\s*\{[\s\S]*?\n\s{2}\}/g,
  );

  return Array.from(matches, (match) => match[0]);
}

describe('pagination hardening gate', () => {
  it('keeps high-growth list service methods bounded with take/limit pagination', () => {
    const serviceFiles = HIGH_GROWTH_MODULES.flatMap((moduleName) =>
      listFiles(join(API_SRC_ROOT, moduleName)),
    ).filter((file) => !isAllowedSmallList(file));

    const violations: string[] = [];

    for (const file of serviceFiles) {
      const source = read(file);
      const blocks = serviceMethodBlocks(source);

      for (const block of blocks) {
        if (!block.includes('.findMany(')) continue;

        const hasBound =
          /\btake\s*:/m.test(block) ||
          /\blimit\b/i.test(block) ||
          /pagination\(/i.test(block);

        if (!hasBound) {
          const methodName =
            /(?:async\s+)?([A-Za-z0-9_]+)\s*\(/.exec(block)?.[1] ??
            'unknownMethod';
          violations.push(`${normalizePath(file)}:${methodName}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
