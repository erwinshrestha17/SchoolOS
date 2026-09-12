import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  // Resolve Next's bundled plugins consistently in CLI and build workers.
  resolvePluginsRelativeTo: dirname(require.resolve('eslint-config-next/package.json')),
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals'),
  {
    ignores: [
      '.next/**',
      'next-env.d.ts',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
];

export default eslintConfig;
