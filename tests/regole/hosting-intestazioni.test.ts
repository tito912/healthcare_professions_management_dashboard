// Intestazioni di sicurezza e cache dell'hosting (PIANO 4.2 criterio 5): si leggono da firebase.json, senza emulatori.
// La prova nel browser, con l'app costruita sull'emulatore di hosting, è descritta nell'handoff.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { radice } from './aiuti';

interface Regola {
  readonly source: string;
  readonly headers: readonly { readonly key: string; readonly value: string }[];
}

const configurazione: { hosting: { headers: readonly Regola[] } } = JSON.parse(
  readFileSync(path.join(radice, 'firebase.json'), 'utf8'),
);
const regole = configurazione.hosting.headers;

function valore(regola: Regola | undefined, chiave: string): string | undefined {
  return regola?.headers.find((h) => h.key.toLowerCase() === chiave.toLowerCase())?.value;
}

const generale = regole.find((r) => r.source === '**');
const csp = valore(generale, 'Content-Security-Policy') ?? '';
const direttive = new Map(
  csp.split(';').map((d) => {
    const [nome = '', ...valori] = d.trim().split(/\s+/);
    return [nome, valori] as const;
  }),
);

/** Glob di Firebase Hosting (`**`, `*`, `?`, `@(a|b)`) come espressione regolare, per i soli casi usati. */
function globInRegex(glob: string): RegExp {
  const corpo = glob
    .replace(/@\(([^)]*)\)/g, (_, alternative: string) => `<<A>>${alternative}<<Z>>`)
    .replace(/[.+^${}()[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '<<D>>')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replaceAll('<<D>>', '(?:.*/)?')
    .replaceAll('<<A>>', '(?:')
    .replaceAll('<<Z>>', ')');
  return new RegExp(`^${corpo}$`);
}

describe('hosting: intestazioni di sicurezza', () => {
  it('ogni risposta ha le intestazioni di base', () => {
    expect(valore(generale, 'X-Content-Type-Options')).toBe('nosniff');
    expect(valore(generale, 'Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(valore(generale, 'X-Frame-Options')).toBe('DENY');
  });

  it('la Content-Security-Policy non ammette script inline, eval, CDN esterne né inclusione in frame', () => {
    expect(direttive.get('default-src')).toEqual(["'self'"]);
    expect(direttive.get('script-src')).toEqual(["'self'"]);
    expect(direttive.get('frame-ancestors')).toEqual(["'none'"]);
    expect(direttive.get('object-src')).toEqual(["'none'"]);
    expect(direttive.get('base-uri')).toEqual(["'self'"]);
    expect(csp).not.toContain('unsafe-eval');
    expect(direttive.get('script-src')).not.toContain("'unsafe-inline'");
    // Font e immagini solo dal sito stesso (niente CDN): i font sono serviti da /media.
    expect(direttive.get('font-src')).toEqual(["'self'"]);
    expect(direttive.get('img-src')).toEqual(["'self'", 'data:']);
  });

  it('connect-src ammette solo i servizi Firebase usati (Auth, Firestore, Functions) e l’emulatore locale', () => {
    const connect = direttive.get('connect-src') ?? [];
    expect(connect).toContain("'self'");
    expect(connect).toContain('https://*.googleapis.com');
    expect(connect).toContain('https://*.cloudfunctions.net');
    for (const origine of connect) {
      expect(origine).toMatch(
        /^('self'|https:\/\/\*\.[a-z.]+|http:\/\/(127\.0\.0\.1|localhost):\*)$/,
      );
    }
  });
});

describe('hosting: cache', () => {
  const lunga = regole.find((r) => valore(r, 'Cache-Control')?.includes('immutable'));
  const lungaRegex = globInRegex(lunga?.source ?? '');

  it('di base nessuna cache (index.html e rotte dell’app si rileggono sempre)', () => {
    expect(valore(generale, 'Cache-Control')).toBe('no-cache');
  });

  it('la cache lunga vale solo per i file con l’hash nel nome', () => {
    expect(valore(lunga, 'Cache-Control')).toBe('public, max-age=31536000, immutable');
    for (const hashato of [
      'main-ST6OQ542.js',
      'chunk-q4O370rY.js',
      'chunk--ImivdX-.js',
      'styles-B2F7YP2D.css',
      'media/inter-latin-wght-normal-NRMW37G5.woff2',
    ]) {
      expect(lungaRegex.test(hashato), hashato).toBe(true);
    }
    for (const altro of ['index.html', 'favicon.ico', 'home', 'main.js', 'media/inter.woff2']) {
      expect(lungaRegex.test(altro), altro).toBe(false);
    }
  });
});
