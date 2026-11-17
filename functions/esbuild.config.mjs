// Bundle di src/index.ts in lib/index.js. packages/domain entra nel bundle tramite alias,
// senza dichiararlo in functions/package.json. Le altre dipendenze restano esterne (installate al deploy).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const qui = path.dirname(fileURLToPath(import.meta.url));

await esbuild.build({
  entryPoints: [path.join(qui, 'src/index.ts')],
  outfile: path.join(qui, 'lib/index.js'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  packages: 'external',
  alias: {
    '@turni/domain': path.join(qui, '../packages/domain/src/index.ts'),
  },
  logLevel: 'info',
});
