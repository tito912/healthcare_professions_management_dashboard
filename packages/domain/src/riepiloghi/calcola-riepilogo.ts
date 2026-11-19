// Riepilogo mensile di un dipendente (ARCHITETTURA §5.10): tutto ciò che il trigger `aggiornaRiepilogo` scrive,
// calcolato qui dalla sola riga, dal mese e dalle righe adiacenti, senza accedere a Firestore. È una funzione
// pura: la stessa riga dà sempre lo stesso risultato (il trigger è idempotente). `calcolatoIl` lo aggiunge chi
// scrive. Ore lavorate, saldo e variazioni arrivano con lo step 3.1b: qui sono a zero (VERSIONE_CALCOLO = 1).
import { oreDovuteMese } from '../banca-ore/ore-dovute';
import {
  categoriaDelTurno,
  classificaGiorno,
  festivitaDelMese,
  giornoDiAttribuzione,
} from '../calendario/classifica-giorno';
import { dataDelGiorno, eChiaveGiorno } from '../calendario/mesi';
import type { CalendarioMese, RiepilogoMensileDoc } from '../documenti';
import {
  contrattoValido,
  soloBlocchi,
  validaRiga,
  type RigaDaValidare,
} from '../griglia/valida-riga';
import { VERSIONE_CALCOLO } from '../impostazioni';
import {
  avvisiRiga,
  celleValide,
  contaAvvisi,
  type ContestoAvvisiRiga,
} from '../regole/avvisi-riga';
import { reperibilitaSvolta, turnoSvolto } from '../regole/giorni-riga';
import { minutiReperibilitaMese } from '../regole/reperibilita';
import { minutiPianificatiMese } from '../regole/totali-riga';
import type { ChiaveMese } from '../tipi';

export interface DatiRiepilogo {
  /** La riga come arriva da Firestore: celle e contratto non sono fidati, si verificano qui. */
  readonly riga: RigaDaValidare;
  readonly chiaveMese: ChiaveMese;
  readonly statoMese: 'bozza' | 'convalidato';
  readonly calendario: CalendarioMese;
  /** Mappe `giorni` delle righe dello stesso dipendente nel mese prima e dopo (riposo a cavallo di mese). */
  readonly righeAdiacenti: ContestoAvvisiRiga['righeAdiacenti'];
}

/** Il riepilogo senza l'istante di calcolo, che mette chi lo scrive (`serverTimestamp()`). */
export type RiepilogoCalcolato = Omit<RiepilogoMensileDoc, 'calcolatoIl'>;

function incrementa(conteggi: Record<string, number>, codice: string, quanto = 1): void {
  conteggi[codice] = (conteggi[codice] ?? 0) + quanto;
}

/**
 * Conta solo le celle valide (le altre sono blocchi di `validaRiga()`, riportati in `erroriValidazione`).
 * - turni svolti: turno principale senza assenza (esclusi i turni scoperti o coperti da un collega, comprese
 *   le sostituzioni fatte dal dipendente);
 * - sabati, domeniche e festivi: ogni turno in una sola categoria (L11), con il giorno di attribuzione della
 *   notte (D6); `notti` conta i turni notturni a parte;
 * - festività lavorate: un turno svolto il cui giorno di attribuzione è una festività del mese; `giorno` è
 *   quello della cella; le reperibilità non contano;
 * - reperibilità e chiamate: solo le reperibilità a carico del dipendente (non coperte, non in assenza neutra);
 * - `numeroAvvisi`: come §5.10, senza «turno escluso già assegnato» (dipende dal dipendente, non dalla riga).
 */
export function calcolaRiepilogo(dati: DatiRiepilogo): RiepilogoCalcolato {
  const { riga, chiaveMese, calendario } = dati;
  const celle = celleValide(chiaveMese, riga.giorni);
  const festivita = festivitaDelMese(chiaveMese, calendario.festivita);
  const contratto = contrattoValido(riga.contratto);

  const conteggiPerCodice: Record<string, number> = {};
  const assenzePerCodice: Record<string, number> = {};
  const festivitaLavorate: RiepilogoMensileDoc['festivitaLavorate'] = [];
  let turniSvolti = 0;
  let notti = 0;
  let sabati = 0;
  let domenicheEFestivi = 0;
  let reperibilitaSvolte = 0;
  let chiamate = 0;
  let minutiChiamate = 0;

  for (const [chiaveGiorno, cella] of Object.entries(celle).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const data = eChiaveGiorno(chiaveGiorno) ? dataDelGiorno(chiaveMese, chiaveGiorno) : null;
    if (data === null || cella === undefined || !eChiaveGiorno(chiaveGiorno)) {
      continue;
    }
    if (cella.assenza !== null) {
      incrementa(assenzePerCodice, cella.assenza.codice);
    }
    if (cella.turno !== null && turnoSvolto(cella)) {
      turniSvolti += 1;
      incrementa(conteggiPerCodice, cella.turno.codice);
      if (cella.turno.notturno) {
        notti += 1;
      }
      const categoria = categoriaDelTurno(
        data,
        cella.turno,
        calendario.attribuzioneNotte,
        festivita,
      );
      if (categoria === 'sabato') {
        sabati += 1;
      } else if (categoria === 'domenica' || categoria === 'festivo') {
        domenicheEFestivi += 1;
      }
      const festa = classificaGiorno(
        giornoDiAttribuzione(data, cella.turno, calendario.attribuzioneNotte),
        festivita,
      ).festivita;
      if (festa !== null) {
        festivitaLavorate.push({
          idFestivita: festa.id,
          giorno: chiaveGiorno,
          codice: cella.turno.codice,
        });
      }
    }
    for (const reperibilita of cella.reperibilita) {
      if (!reperibilitaSvolta(cella, reperibilita)) {
        continue;
      }
      reperibilitaSvolte += 1;
      incrementa(conteggiPerCodice, reperibilita.codice);
      for (const chiamata of reperibilita.chiamate) {
        chiamate += 1;
        minutiChiamate += chiamata.durataMinuti;
      }
    }
  }

  const blocchi = soloBlocchi(validaRiga(riga, { chiaveMese }));
  const erroriValidazione = [...new Set(blocchi.map((problema) => problema.codice))].sort();
  const minutiReperibilita = minutiReperibilitaMese(chiaveMese, celle);
  const avvisi = avvisiRiga(riga, {
    chiaveMese,
    turniEsclusi: [],
    righeAdiacenti: dati.righeAdiacenti,
  });

  return {
    dipendenteId: riga.dipendenteId,
    chiaveMese,
    anno: Number(chiaveMese.slice(0, 4)),
    statoMese: dati.statoMese,
    valida: blocchi.length === 0,
    erroriValidazione,
    turniSvolti,
    notti,
    sabati,
    domenicheEFestivi,
    conteggiPerCodice,
    reperibilitaSvolte,
    minutiReperibilita,
    chiamate,
    minutiChiamate,
    minutiPianificati: minutiPianificatiMese(chiaveMese, celle),
    minutiLavorati: 0,
    minutiDovuti: contratto === null ? 0 : oreDovuteMese(chiaveMese, contratto, festivita, celle),
    saldoMinuti: 0,
    variazioni: 0,
    minutiVariazioni: 0,
    assenzePerCodice,
    festivitaIds: [...new Set(festivitaLavorate.map((f) => f.idFestivita))].sort(),
    festivitaLavorate,
    numeroAvvisi: contaAvvisi(avvisi),
    versioneCalcolo: VERSIONE_CALCOLO,
  };
}
