import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

/**
 * VeriBuy workspace ESLint configuration (flat config, ESLint 9+).
 *
 * A single root config covers every package. ESLint resolves this file by
 * walking up from each package directory, so `eslint .` works both from the
 * repo root and from within `backend/`, `frontend/`, and `packages/*`.
 */
export default tseslint.config(
  {
    // Never lint build output, dependencies, or generated Prisma clients.
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/build/**',
      '**/.expo/**',
      'backend/src/generated/**',
      'backend/prisma/migrations/**',
      '**/*.d.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // ---------------------------------------------------------------------
  // Shared TypeScript rules
  // ---------------------------------------------------------------------
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      // Allow deliberate `any` — the codebase uses it at trust boundaries
      // (Prisma JSON columns, Stripe payloads) where narrowing adds no safety.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-empty-object-type': 'off',

      // Security-relevant rules — these guard the practices the codebase
      // already follows and should fail the build if regressed.
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
    },
  },

  // ---------------------------------------------------------------------
  // Backend (NestJS)
  // ---------------------------------------------------------------------
  {
    files: ['backend/**/*.ts'],
    rules: {
      // Nest uses parameter decorators and empty constructors extensively.
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },

  // ---------------------------------------------------------------------
  // Frontend (Next.js / React) + mobile (React Native)
  // ---------------------------------------------------------------------
  {
    files: ['frontend/**/*.{ts,tsx}', 'mobile/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
  },

  // ---------------------------------------------------------------------
  // Test files
  // ---------------------------------------------------------------------
  {
    files: ['**/*.spec.{ts,tsx}', '**/*.test.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },

  // ---------------------------------------------------------------------
  // Plain JS config files
  // ---------------------------------------------------------------------
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
