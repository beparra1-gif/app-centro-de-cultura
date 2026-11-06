import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Current app lives mostly in a single large component with many staged states.
      // Keep lint signal useful without blocking release on known legacy debt.
      'no-unused-vars': 'warn',
      'react-hooks/purity': 'warn',
      // Regla de rendimiento del React Compiler (renders en cascada), no de
      // correctitud: hay ~23 casos heredados que funcionan bien. Como error
      // dejaba el lint siempre en rojo y ocultaba problemas reales.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    files: ['src/App.jsx'],
    rules: {
      // Temporary override until App is split into smaller modules.
      'no-unused-vars': 'off',
    },
  },
  {
    files: ['src/**/*.test.{js,jsx}', 'src/**/*.spec.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.vitest,
      },
    },
  },
  {
    files: ['backend/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
      sourceType: 'script',
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // `const crypto = require('crypto')` es lo correcto en CommonJS aunque
      // Node 20+ también exponga un global crypto.
      'no-redeclare': ['error', { builtinGlobals: false }],
    },
  },
  {
    // Los tests de backend usan import de vitest (ESM) + require.
    files: ['backend/**/*.test.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.vitest },
      sourceType: 'module',
    },
  },
  {
    files: ['vite.config.js', 'eslint.config.js'],
    languageOptions: {
      globals: globals.node,
      sourceType: 'module',
    },
  },
])
