// Regole condivise del repository. Il dominio (packages/domain) è l'unico posto dove si usa Date.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

const VIETA_DATE = [
  'error',
  {
    name: 'Date',
    message: 'Date è vietato fuori da packages/domain: usa @turni/domain (CLAUDE.md, Date e ore).',
  },
];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/lib/**',
      '**/.angular/**',
      '**/coverage/**',
      '**/emulator-data/**',
      'apps/web/src/environments/environment.ts',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['apps/web/**/*.ts', 'functions/**/*.ts'],
    rules: {
      'no-restricted-globals': VIETA_DATE,
      // Copre anche l'accesso come proprietà globale (review 0.2, rilievo 5).
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "MemberExpression[object.name=/^(globalThis|window|self)$/][property.name='Date']",
          message: VIETA_DATE[1].message,
        },
      ],
    },
  },
  {
    files: ['functions/**/*.ts'],
    rules: {
      'no-console': 'error',
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      globals: globals.node,
    },
  },
  prettier,
);
