import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const config = [
  {
    ignores: [
      'node_modules/**',
      '**/.next/**',
      '**/dist/**',
      'coverage/**',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
  {
    files: ['apps/api/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './apps/api/tsconfig.json',
      },
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    settings: {
      next: {
        rootDir: 'apps/web/',
      },
    },
    languageOptions: {
      parserOptions: {
        project: './apps/web/tsconfig.json',
      },
    },
  },
];

export default config;
