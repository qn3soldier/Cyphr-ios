import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'node_modules',
      'dist',
      'test-*.js',
      '*.mjs',
      'postcss.config.cjs',
      'tailwind.config.js',
      'src/api/crypto/**' // Ignore large crypto impl files
    ]
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021
      }
    },
    plugins: {
      react
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      'no-undef': 'error' // Keep but with env it should resolve globals
    }
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  react.configs.flat.recommended,
  {
    rules: {
      'react/prop-types': 'off'
    }
  },
  {
    settings: {
      react: {
        version: 'detect'
      }
    }
  }
); 