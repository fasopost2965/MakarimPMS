// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
    ],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  eslintPluginPrettierRecommended,
  {
    rules: {
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
  {
    // Fichiers générés/gérés par le CLI shadcn/ui : exportent volontairement
    // un composant et ses variantes (cva) depuis le même fichier.
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // label.tsx (CH-032) est un wrapper générique de <label> — l'association
    // à un contrôle (htmlFor ou imbrication) se fait à chaque site d'appel,
    // pas dans la définition du composant lui-même ; jsx-a11y ne peut pas le
    // vérifier statiquement à travers `{...props}` (CH-029). Chaque usage
    // réel sans htmlFor a été audité et corrigé individuellement.
    files: ['src/components/ui/label.tsx'],
    rules: {
      'jsx-a11y/label-has-associated-control': 'off',
    },
  },
);
