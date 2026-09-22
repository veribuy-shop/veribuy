import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import rootConfig from '../eslint.config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

/**
 * Frontend ESLint configuration.
 *
 * Layers the Next.js rules (still published as an eslintrc-style config, hence
 * FlatCompat) on top of the shared workspace rules.
 */
export default [
  ...rootConfig,
  ...compat.extends('next/core-web-vitals'),
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
];
