// Modello puro del Registro attività (UX §7.12): da una voce alla riga mostrata, senza Angular né Firestore.
import { formattaDataDaMs, formattaOraDaMs } from '@turni/domain';
import type { VoceRegistro } from '../../dati/registro.repo';
import { testiRegistro } from '../../testi/it-registro';

export interface RigaRegistro {
  readonly id: string;
  readonly dataOra: string;
  readonly utente: string;
  readonly reparto: string;
  readonly operazione: string;
  readonly dettagli: string;
}

export interface ContestoRegistro {
  /** Nome del reparto dato l'ID; undefined se il reparto non è tra quelli noti. */
  readonly nomeReparto: (repartoId: string) => string | undefined;
  /** Nome del dipendente dato reparto e ID: stringa se esiste, `null` se non esiste più, undefined se non ancora noto. */
  readonly nomeDipendente: (repartoId: string, dipendenteId: string) => string | null | undefined;
}

function valore(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined || v === '') {
    return testiRegistro.valoreVuoto;
  }
  return typeof v === 'boolean' ? (v ? 'sì' : 'no') : String(v);
}

function numero(v: string | number | boolean | null | undefined): number {
  return typeof v === 'number' ? v : 0;
}

/** «05/11» da giorno '05' e mese 'AAAA-MM'. */
function giornoMese(
  giorno: string | number | boolean | null | undefined,
  chiaveMese: string | null,
): string {
  const g = valore(giorno);
  return chiaveMese === null ? g : `${g}/${chiaveMese.slice(5, 7)}`;
}

/** Testo dei dettagli: solo codici, orari, conteggi e ID già presenti nella voce, mai altri dati. */
export function testoDettagli(voce: VoceRegistro): string {
  const d = voce.dettagli;
  if (voce.tipo === 'pulizia.eseguita') {
    const base =
      d['modalitaProva'] === true
        ? testiRegistro.pulizia.prova(numero(d['dipendentiTrovati']), numero(d['fileScaduti']))
        : testiRegistro.pulizia.eseguita(
            numero(d['dipendentiEliminati']),
            numero(d['fileEliminati']),
          );
    return numero(d['errori']) > 0
      ? base + testiRegistro.pulizia.conErrori(numero(d['errori']))
      : base;
  }
  if (voce.tipo === 'consuntivo.modificato') {
    const campo = typeof d['campo'] === 'string' ? d['campo'] : '';
    return testiRegistro.consuntivo(
      giornoMese(d['giorno'], voce.chiaveMese),
      testiRegistro.campi[campo] ?? campo,
      valore(d['prima']),
      valore(d['dopo']),
    );
  }
  const parti = Object.entries(d).map(
    ([chiave, v]) => `${testiRegistro.chiaviDettaglio[chiave] ?? chiave}: ${valore(v)}`,
  );
  if (voce.chiaveMese !== null) {
    parti.unshift(voce.chiaveMese);
  }
  return parti.join(' · ');
}

export function rigaDiVoce(voce: VoceRegistro, contesto: ContestoRegistro): RigaRegistro {
  const reparto =
    voce.repartoId === null
      ? testiRegistro.nessunReparto
      : (contesto.nomeReparto(voce.repartoId) ?? testiRegistro.reparto.sconosciuto);
  let dettagli = testoDettagli(voce);
  if (voce.dipendenteId !== null && voce.repartoId !== null) {
    const nome = contesto.nomeDipendente(voce.repartoId, voce.dipendenteId);
    if (nome !== undefined) {
      dettagli = `${nome ?? testiRegistro.dipendenteRimosso}${dettagli === '' ? '' : ` · ${dettagli}`}`;
    }
  }
  return {
    id: voce.id,
    dataOra: `${formattaDataDaMs(voce.ilMs)} ${formattaOraDaMs(voce.ilMs)}`,
    utente: voce.autoreNome ?? testiRegistro.sistema,
    reparto,
    operazione: testiRegistro.operazioni[voce.tipo],
    dettagli,
  };
}
