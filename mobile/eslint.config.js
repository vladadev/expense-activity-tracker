// The bug this exists to prevent: AgendaScreen called useToast() and
// tapLight() without importing either. Nothing complained — not Metro, not
// the build, not the tests — and the app crashed the moment that screen
// rendered. `no-undef` finds it in under a second.
//
// Deliberately narrow. A rule set that reports hundreds of style opinions
// gets ignored, and then the one real error is invisible inside the noise.
// Only mistakes that break the app at runtime are errors here.
const js = require('@eslint/js');
const globals = require('globals');
const reactHooks = require('eslint-plugin-react-hooks');

module.exports = [
  { ignores: ['node_modules/**', 'dist/**', '.expo/**', 'android/**', 'ios/**'] },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
        __DEV__: 'readonly',
        global: 'readonly',
      },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...js.configs.recommended.rules,
      'no-undef': 'error',
      // A hook called conditionally corrupts React's hook order, which shows
      // up as one screen rendering another's state.
      'react-hooks/rules-of-hooks': 'error',
      // Noise, not danger: an unused variable is untidy, never fatal.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': 'off',
    },
  },
];
