// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    // ── Ignored files ────────────────────────────────────────────────────────────
    {
      ignores: [
        'eslint.config.mjs',
        'dist/**',
        'node_modules/**',
        'coverage/**',
        'prisma/migrations/**',
      ],
    },

    // ── Base rule sets ────────────────────────────────────────────────────────────
    eslint.configs.recommended,
    ...tseslint.configs.strictTypeChecked,   // strictTypeChecked > recommendedTypeChecked
    ...tseslint.configs.stylisticTypeChecked,
    eslintPluginPrettierRecommended,

    // ── Language / parser options (applies to all files) ─────────────────────────
    {
      languageOptions: {
        globals: {
          ...globals.node,
          ...globals.jest,
        },
        sourceType: 'commonjs',
        parserOptions: {
          projectService: true,
          tsconfigRootDir: import.meta.dirname,
        },
      },
    },

    // ══════════════════════════════════════════════════════════════════════════════
    // PRODUCTION SOURCE  src/**/*.ts  (strict — errors block CI)
    // ══════════════════════════════════════════════════════════════════════════════
    {
      files: ['src/**/*.ts'],
      ignores: ['src/**/*.spec.ts'],
      rules: {
        // ── Formatting ────────────────────────────────────────────────────────────
        'prettier/prettier': [
          'error',
          {
            singleQuote: true,
            trailingComma: 'all',
            endOfLine: 'auto',
          },
        ],

        // ── General ESLint ────────────────────────────────────────────────────────
        'no-console':               ['warn', { allow: ['warn', 'error'] }],
        'no-debugger':              'error',
        'no-duplicate-imports':     'error',
        'no-shadow':                'off',           // replaced by TS version below
        'eqeqeq':                  ['error', 'always'],
        'prefer-const':             'error',
        'no-var':                   'error',
        'object-shorthand':         'error',
        'no-return-await':          'off',           // replaced by TS version below

        // ── TypeScript: type safety ───────────────────────────────────────────────
        '@typescript-eslint/no-explicit-any':         'off',   // kept off — Prisma mocks need it
        '@typescript-eslint/no-unsafe-argument':       'error',
        '@typescript-eslint/no-unsafe-assignment':     'error',
        '@typescript-eslint/no-unsafe-call':           'error',
        '@typescript-eslint/no-unsafe-member-access':  'error',
        '@typescript-eslint/no-unsafe-return':         'error',
        '@typescript-eslint/no-floating-promises':     'error',
        '@typescript-eslint/no-misused-promises':      'error',
        '@typescript-eslint/await-thenable':           'error',
        '@typescript-eslint/require-await':            'error',
        '@typescript-eslint/no-unnecessary-type-assertion': 'error',
        '@typescript-eslint/no-unnecessary-condition': 'warn',
        '@typescript-eslint/restrict-template-expressions': [
          'error',
          { allowNumber: true, allowBoolean: true },
        ],

        // ── TypeScript: correctness ───────────────────────────────────────────────
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
        '@typescript-eslint/no-shadow':               'error',
        '@typescript-eslint/return-await':            ['error', 'in-try-catch'],
        '@typescript-eslint/unbound-method':          ['error', { ignoreStatic: true }],

        // ── TypeScript: style (auto-fixable) ─────────────────────────────────────
        '@typescript-eslint/consistent-type-imports': [
          'error',
          { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
        ],
        '@typescript-eslint/consistent-type-exports': 'error',
        '@typescript-eslint/prefer-nullish-coalescing':   'warn',
        '@typescript-eslint/prefer-optional-chain':       'warn',
        '@typescript-eslint/array-type':              ['error', { default: 'array-simple' }],

        // ── NestJS-specific ───────────────────────────────────────────────────────
        // NestJS DI constructors are intentionally empty — don't require explicit return types
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
      },
    },

    // ══════════════════════════════════════════════════════════════════════════════
    // TEST FILES  *.spec.ts | *.e2e-spec.ts | test/**  (relaxed — warnings only)
    // ══════════════════════════════════════════════════════════════════════════════
    {
      files: ['**/*.spec.ts', '**/*.e2e-spec.ts', 'test/**/*.ts'],
      rules: {
        // Formatting still enforced in tests
        'prettier/prettier': [
          'error',
          { singleQuote: true, trailingComma: 'all', endOfLine: 'auto' },
        ],

        // Type safety — downgraded to warn (mocks are untyped by nature)
        '@typescript-eslint/no-unsafe-argument':      'warn',
        '@typescript-eslint/no-unsafe-assignment':    'warn',
        '@typescript-eslint/no-unsafe-call':          'warn',
        '@typescript-eslint/no-unsafe-member-access': 'warn',
        '@typescript-eslint/no-unsafe-return':        'warn',
        '@typescript-eslint/no-floating-promises':    'warn',
        '@typescript-eslint/no-misused-promises':     'warn',
        '@typescript-eslint/require-await':           'warn',

        // Fully off in tests — these patterns are idiomatic in Jest/NestJS testing
        '@typescript-eslint/unbound-method':                  'off', // expect(mock).toHaveBeenCalledWith(service.method)
        '@typescript-eslint/no-unnecessary-condition':         'off', // guard checks in test setup
        '@typescript-eslint/consistent-type-imports':          'off', // test imports are verbose by design
        '@typescript-eslint/no-unnecessary-type-assertion':    'off',
        'no-console':                                          'off', // console.log in tests is fine
      },
    },
);
