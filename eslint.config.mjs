import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

// This gate checks source correctness. Hook policy is retained for existing
// inline directives; enabling a new hook policy is a separate change.
export default [
  { ignores: ['**/node_modules/**', '**/dist/**', '**/*[wW]hats[aA]pp*/**', '**/*[wW]hats[aA]pp*.*', '**/*[cC]hatwoot*.*', '**/*[eE]volution*.*'] },
  {
    files: ['**/*.{js,mjs,cjs,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest', sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.node, ...globals.browser, __DEV__: 'readonly' },
    },
    plugins: { 'react-hooks': reactHooks },
    linterOptions: { reportUnusedDisableDirectives: false },
    rules: {
      'no-undef': 'error', 'no-unreachable': 'error',
      'no-const-assign': 'error', 'no-dupe-args': 'error',
      'no-dupe-keys': 'error', 'no-duplicate-case': 'error',
      'no-func-assign': 'error', 'constructor-super': 'error',
      'valid-typeof': 'error',
    },
  },
];
