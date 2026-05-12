import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function sourceFiles(relativeDir) {
  const root = join(webRoot, relativeDir);
  const entries = readdirSync(root);
  const files = [];

  for (const entry of entries) {
    const absolute = join(root, entry);
    const relative = join(relativeDir, entry);

    if (entry === '.next' || entry === 'node_modules' || entry === 'test') {
      continue;
    }

    if (statSync(absolute).isDirectory()) {
      files.push(...sourceFiles(relative));
      continue;
    }

    if (/\.(tsx?|css)$/.test(entry)) {
      files.push(relative);
    }
  }

  return files;
}

describe('Typography Standardization Contract', () => {
  const files = sourceFiles('app').concat(sourceFiles('components'));

  it('prohibits font-serif and arbitrary font-family classes', () => {
    for (const file of files) {
      const content = readFileSync(join(webRoot, file), 'utf8');
      
      assert.doesNotMatch(
        content, 
        /font-serif/, 
        `Forbidden 'font-serif' found in ${file}. Use 'font-sans' (Inter) instead.`
      );

      assert.doesNotMatch(
        content, 
        /font-\[.*\]/, 
        `Forbidden arbitrary font class 'font-[...]' found in ${file}.`
      );

      if (file.endsWith('.tsx')) {
        assert.doesNotMatch(
          content, 
          /fontFamily:|font-family:/, 
          `Forbidden inline font-family style found in ${file}. Use Tailwind classes.`
        );
      }
    }
  });

  it('restricts font-mono to technical identifiers and whitelisted contexts', () => {
    // Whitelisted files where font-mono is permitted for technical values (IDs, hex codes, slugs)
    const whitelistedPaths = [
      'app/platform/audit/page.tsx',
      'app/platform/schools/page.tsx',
      'app/platform/schools/[tenantId]/page.tsx',
      'app/platform/settings/page.tsx',
      'app/dashboard/settings/page.tsx',
      'components/hr/contract-list.tsx',
      'components/hr/staff-attendance-summary.tsx',
      'components/hr/payroll-runs.tsx',
      'components/hr/payroll-preview.tsx',
      'components/accounting/opening-balance-dialog.tsx',
      'components/academics/tabs/promotion-tab.tsx',
      'components/academics/tabs/result-publishing-tab.tsx',
    ];

    for (const file of files) {
      if (whitelistedPaths.some(p => file.endsWith(p))) continue;

      const content = readFileSync(join(webRoot, file), 'utf8');
      
      assert.doesNotMatch(
        content, 
        /font-mono/, 
        `Unauthorized 'font-mono' found in ${file}. Monospaced fonts are restricted to technical IDs in whitelisted files.`
      );
    }
  });

  it('ensures next/font/google is only imported in globals.css or root layout', () => {
    for (const file of files) {
      if (file === 'app/layout.tsx' || file.endsWith('.css')) continue;

      const content = readFileSync(join(webRoot, file), 'utf8');
      assert.doesNotMatch(
        content,
        /next\/font\/google/,
        `Forbidden 'next/font/google' import found in ${file}. Fonts should be managed in globals.css and applied via --font-sans.`
      );
    }
  });
});
