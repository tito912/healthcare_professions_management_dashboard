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

// Testi delle pagine pesanti (CLAUDE.md, «Testi dell'interfaccia»): ogni file `testi/it-<pagina>.ts` si importa solo
// dal codice della sua pagina (le rotte lo caricano con `import()` dinamico, che qui non è vietato). `testi/it.ts`,
// il guscio e le altre pagine non lo importano: così il bundle iniziale non lo include.
const TESTI_DI_PAGINA = {
  griglia: { file: 'it-griglia', cartelle: ['pagine/griglia'] },
  configurazione: { file: 'it-configurazione', cartelle: ['pagine/reparto/configurazione'] },
  bancaOre: { file: 'it-banca-ore', cartelle: ['pagine/banca-ore'] },
  dettaglioDipendente: {
    file: 'it-dettaglio-dipendente',
    cartelle: ['pagine/dettaglio-dipendente'],
  },
  report: { file: 'it-report', cartelle: ['pagine/report', 'pagine/home'] },
};

function vietaTestiDiPagina(consentiti) {
  return [
    'error',
    {
      patterns: Object.entries(TESTI_DI_PAGINA)
        .filter(([chiave]) => !consentiti.includes(chiave))
        .map(([, { file }]) => ({
          group: [`**/${file}`],
          message:
            'I testi di una pagina pesante si importano solo dal codice di quella pagina (CLAUDE.md, Testi dell’interfaccia).',
        })),
    },
  ];
}

const REGOLE_TESTI_DI_PAGINA = [
  {
    files: ['apps/web/src/app/**/*.ts'],
    rules: { 'no-restricted-imports': vietaTestiDiPagina([]) },
  },
  ...Object.entries(TESTI_DI_PAGINA).map(([chiave, { cartelle }]) => ({
    files: cartelle.map((c) => `apps/web/src/app/${c}/**/*.ts`),
    rules: { 'no-restricted-imports': vietaTestiDiPagina([chiave]) },
  })),
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
    files: ['apps/web/**/*.ts', 'functions/**/*.ts', 'scripts/**/*.ts', 'tests/**/*.ts'],
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
  ...REGOLE_TESTI_DI_PAGINA,
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
