import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import pluginVue from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'cypress/screenshots/**', 'cypress/videos/**'],
  },

  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...pluginVue.configs['flat/recommended'],

  {
    languageOptions: {
      parserOptions: {
        projectService: {
          // .vue files are part of the TypeScript program through vue-tsc, but
          // the project service has to be told about the extension explicitly.
          allowDefaultProject: ['*.config.js'],
        },
        extraFileExtensions: ['.vue'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Same rules as the backend, so both sides of the project read alike.
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // TypeScript already reports undefined identifiers, and unlike this rule
      // it knows about browser globals, `import.meta` and type-only names.
      'no-undef': 'off',
      'vue/multi-word-component-names': ['error', { ignores: ['App'] }],
    },
  },

  // .vue files are parsed by vue-eslint-parser, with the TypeScript parser for
  // the <script lang="ts"> block.
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },

  // Cypress specs run in a browser-like runtime: declare its globals rather
  // than pulling in another plugin.
  {
    files: ['cypress/**/*.ts'],
    languageOptions: {
      globals: {
        cy: 'readonly',
        Cypress: 'readonly',
        describe: 'readonly',
        context: 'readonly',
        it: 'readonly',
        specify: 'readonly',
        before: 'readonly',
        beforeEach: 'readonly',
        after: 'readonly',
        afterEach: 'readonly',
        expect: 'readonly',
        assert: 'readonly',
      },
    },
  },

  eslintConfigPrettier,
);
