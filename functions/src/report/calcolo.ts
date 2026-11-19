// Calcolo e salvataggio del report del bimestre (ARCHITETTURA §5.12, §8). Il report è la somma dei riepiloghi dei
// soli mesi convalidati (`conteggiBimestre()` del dominio): i mesi in bozza non entrano né nel documento né nel file né
// nell'invio. I nomi dei dipendenti si leggono da `dipendenti` al momento della generazione e restano nei soli file.
import {
  annoDelBimestre,
  conteggiBimestre,
  eCodiceTurno,
  mesiDelBimestre,
  numeroDelBimestre,
  type ChiaveMese,
  type ConteggiBimestre,
  type ConteggiReport,
  type IdBimestre,
  type IdColoreTurno,
  type ReportDoc,
  type VoceRegistroDoc,
  ID_COLORI_TURNO,
} from '@turni/domain';
import type { DocumentReference } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { db, oraServer, rifReparto, type InScrittura } from '../comune/admin';
import { errore } from '../comune/errori';
import { rifDipendenti } from '../dipendenti/rif';
import { rifMese } from '../mesi/rif';
import { leggiRiepilogoPerReport } from './lettura';
import { DIPENDENTE_RIMOSSO } from './nomi';
import { rifReport, rifRiepiloghi } from './rif';

/** Un codice di turno o di reperibilità per la legenda del file (con il suo colore, se è un turno). */
export interface VoceLegenda {
  readonly codice: string;
  readonly nome: string;
  readonly tipo: 'turno' | 'reperibilita';
  readonly colore: IdColoreTurno | null;
  readonly inizio: string;
  readonly fine: string;
}

export interface DatiReport {
  readonly repartoId: string;
  readonly nomeReparto: string;
  readonly idBimestre: IdBimestre;
  readonly conteggi: ConteggiBimestre;
  readonly nomi: ReadonlyMap<string, { readonly nome: string; readonly cognome: string }>;
  readonly legenda: readonly VoceLegenda[];
}

export interface RigaReport {
  readonly dipendenteId: string;
  /** «Cognome Nome», o «Dipendente rimosso». */
  readonly nome: string;
  readonly conteggi: ConteggiReport;
}

function testo(valore: unknown, predefinito: string): string {
  return typeof valore === 'string' && valore !== '' ? valore : predefinito;
}

function coloreValido(valore: unknown): IdColoreTurno | null {
  return ID_COLORI_TURNO.find((id) => id === valore) ?? null;
}

/**
 * Legge i dati del bimestre. Un mese conta se il suo documento è `convalidato`. Senza alcun mese convalidato lancia
 * NESSUN_MESE_CONVALIDATO.
 */
export async function preparaReport(
  repartoId: string,
  idBimestre: IdBimestre,
): Promise<DatiReport> {
  const mesi = mesiDelBimestre(idBimestre);
  const documenti = await Promise.all(mesi.map((mese) => rifMese(repartoId, mese).get()));
  const mesiInclusi: ChiaveMese[] = mesi.filter(
    (_, i) => documenti[i]?.get('stato') === 'convalidato',
  );
  if (mesiInclusi.length === 0) {
    throw errore('NESSUN_MESE_CONVALIDATO');
  }

  const [reparto, riepiloghi, dipendenti, turni] = await Promise.all([
    rifReparto(repartoId).get(),
    rifRiepiloghi(repartoId).where('chiaveMese', 'in', mesiInclusi).get(),
    rifDipendenti(repartoId).select('nome', 'cognome').get(),
    rifReparto(repartoId).collection('turni').orderBy('ordine').get(),
  ]);

  const letti = riepiloghi.docs.map(leggiRiepilogoPerReport);
  const scartati = letti.filter((r) => r === null).length;
  if (scartati > 0) {
    logger.warn('Riepiloghi illeggibili saltati nel report', { repartoId, idBimestre, scartati });
  }
  const conteggi = conteggiBimestre(
    idBimestre,
    letti.filter((r) => r !== null),
    mesiInclusi,
  );

  const nomi = new Map<string, { nome: string; cognome: string }>();
  for (const dipendente of dipendenti.docs) {
    const nome: unknown = dipendente.get('nome');
    const cognome: unknown = dipendente.get('cognome');
    if (typeof nome === 'string' && typeof cognome === 'string') {
      nomi.set(dipendente.id, { nome, cognome });
    }
  }

  const legenda: VoceLegenda[] = [];
  for (const turno of turni.docs) {
    const tipo: unknown = turno.get('tipo');
    if ((tipo !== 'turno' && tipo !== 'reperibilita') || !eCodiceTurno(turno.id)) {
      continue;
    }
    legenda.push({
      codice: turno.id,
      nome: testo(turno.get('nome'), turno.id),
      tipo,
      colore: tipo === 'turno' ? coloreValido(turno.get('colore')) : null,
      inizio: testo(turno.get('inizio'), ''),
      fine: testo(turno.get('fine'), ''),
    });
  }

  return {
    repartoId,
    nomeReparto: testo(reparto.get('nome'), 'Reparto'),
    idBimestre,
    conteggi,
    nomi,
    legenda,
  };
}

/** «Cognome Nome» del dipendente, o «Dipendente rimosso» se non c'è più in anagrafica (L3). */
export function nomeDipendente(dati: DatiReport, dipendenteId: string): string {
  const persona = dati.nomi.get(dipendenteId);
  return persona === undefined ? DIPENDENTE_RIMOSSO : `${persona.cognome} ${persona.nome}`;
}

/** Le righe del report in ordine di cognome e nome; i dipendenti rimossi in fondo. */
export function righeOrdinate(dati: DatiReport): RigaReport[] {
  return Object.entries(dati.conteggi.righe)
    .map(([dipendenteId, conteggi]) => ({
      dipendenteId,
      nome: nomeDipendente(dati, dipendenteId),
      conteggi,
      rimosso: !dati.nomi.has(dipendenteId),
    }))
    .sort(
      (a, b) =>
        Number(a.rimosso) - Number(b.rimosso) ||
        a.nome.localeCompare(b.nome, 'it') ||
        a.dipendenteId.localeCompare(b.dipendenteId),
    )
    .map(({ dipendenteId, nome, conteggi }) => ({ dipendenteId, nome, conteggi }));
}

/**
 * Salva `report/{idBimestre}` in una transazione. Se il documento esiste ne conserva `file`, `invii` e
 * `invioAutomaticoIl`; altrimenti lo crea con `file: null`, `invii: {}` e `invioAutomaticoIl: null`. `generatoDa` è
 * l'uid, oppure `'sistema'`. Con `voce` scrive nella stessa transazione anche la voce del registro.
 */
export async function salvaReport(
  dati: DatiReport,
  generatoDa: string,
  voce?: { readonly ref: DocumentReference; readonly dati: InScrittura<VoceRegistroDoc> },
): Promise<void> {
  const riferimento = rifReport(dati.repartoId, dati.idBimestre);
  const mesi = mesiDelBimestre(dati.idBimestre);
  const campi = {
    idBimestre: dati.idBimestre,
    anno: annoDelBimestre(dati.idBimestre),
    bimestre: numeroDelBimestre(dati.idBimestre),
    mesi: [...mesi],
    mesiInclusi: [...dati.conteggi.mesiInclusi],
    righe: dati.conteggi.righe,
    totali: dati.conteggi.totali,
    generatoDa,
  };
  await db().runTransaction(async (transazione) => {
    const esistente = await transazione.get(riferimento);
    if (esistente.exists) {
      transazione.update(riferimento, { ...campi, generatoIl: oraServer() });
    } else {
      const nuovo: InScrittura<ReportDoc> = {
        ...campi,
        mesi: [mesi[0], mesi[1]],
        generatoIl: oraServer(),
        file: null,
        invii: {},
        invioAutomaticoIl: null,
      };
      transazione.create(riferimento, nuovo);
    }
    if (voce !== undefined) {
      transazione.create(voce.ref, voce.dati);
    }
  });
}
