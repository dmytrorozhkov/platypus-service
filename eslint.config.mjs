import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import vue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import prettier from 'eslint-config-prettier/flat';

export default defineConfig(
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/.angular/**',
    '**/.vite/**',
    '**/.local/**',
    '**/coverage/**',
    '**/playwright-report/**',
    '**/test-results/**',
  ]),
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
  },
  {
    files: [
      'apps/{shell,support,analytics,administration}/src/**/*.{ts,tsx,vue}',
    ],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['apps/*/vite.config.ts', 'apps/server/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/shell/**/*.ts', 'apps/support/**/*.ts'],
    extends: [angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
  },
  {
    files: ['apps/shell/**/*.html', 'apps/support/**/*.html'],
    extends: [
      angular.configs.templateRecommended,
      angular.configs.templateAccessibility,
    ],
  },
  {
    files: ['apps/analytics/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
  },
  {
    files: ['apps/administration/**/*.vue'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      vue.configs['flat/essential'],
    ],
    languageOptions: {
      parser: vueParser,
      parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.vue'] },
    },
  },
  prettier,
);
