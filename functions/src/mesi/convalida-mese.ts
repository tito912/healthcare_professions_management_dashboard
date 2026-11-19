// convalidaMese (ARCHITETTURA §8, D1, D2, D18): blocca il mese in sola lettura totale. In una transazione:
// proprietà del reparto → mese esistente e in bozza → mese concluso (L5) → `validaRiga()` su ogni riga →
// `validaMese()` sull'insieme (solo se nessuna riga ha blocchi: review 2.1, rilievo 1) → `stato`,
// `convalidatoIl`, `convalidatoDa` e `convalidatoDaNome` + voce `mese.convalidato`. Non tocca le righe. Gli
// avvisi (riposo, reperibilità oltre 7) non bloccano: il riepilogo e la conferma sono nel browser (U5).
// I riepiloghi diventano definitivi nel trigger `aggiornaRiepiloghiMese`. Riaprire un mese non si può da qui (D18).
import {
  celleValide,
  convalidaConsentita,
  dataISO,
  oggi,
  schemaConvalidaMeseInput,
  soloBlocchi,
  validaMese,
  validaRiga,
  type ConvalidaMeseOutput,
  type MeseDoc,
} from '@turni/domain';
import * as logger from 'firebase-functions/logger';
import { db, oraServer, type InScrittura } from '../comune/admin';
import { richiediCoordinatoreDi } from '../comune/autorizzazione';
import { definisciCallable, errore } from '../comune/errori';
import { rifNuovaVoce, voceRegistro } from '../comune/registro';
import { validaInput } from '../comune/validazione';
import { leggiMese, leggiRiga } from './lettura';
import { rifMese, rifRighe } from './rif';

const NOME = 'convalidaMese';

export const convalidaMese = definisciCallable(
  NOME,
  async (richiesta): Promise<ConvalidaMeseOutput> => {
    if (richiesta.auth === undefined) {
      throw errore('NON_AUTENTICATO');
    }
    const input = validaInput(NOME, schemaConvalidaMeseInput, richiesta.data);
    const { repartoId, chiaveMese } = input;
    const autore = await richiediCoordinatoreDi(richiesta, repartoId);

    const riferimentoMese = rifMese(repartoId, chiaveMese);
    await db().runTransaction(async (transazione) => {
      const snapshotMese = await transazione.get(riferimentoMese);
      if (!snapshotMese.exists) {
        throw errore('NON_TROVATO');
      }
      const mese = leggiMese(snapshotMese);
      if (mese === null) {
        logger.error('Mese con dati illeggibili', { repartoId, chiaveMese });
        throw errore('ERRORE_INTERNO');
      }
      if (mese.stato === 'convalidato') {
        throw errore('MESE_GIA_CONVALIDATO');
      }
      if (!convalidaConsentita(chiaveMese, dataISO(oggi()))) {
        throw errore('MESE_NON_CONCLUSO');
      }

      const righe = (await transazione.get(rifRighe(repartoId, chiaveMese))).docs
        .map(leggiRiga)
        .filter((riga) => riga !== null);
      const nonValide = righe.filter(
        (riga) => soloBlocchi(validaRiga(riga, { chiaveMese })).length > 0,
      );
      if (nonValide.length > 0) {
        logger.warn('Convalida rifiutata: righe non valide', {
          repartoId,
          chiaveMese,
          righe: nonValide.length,
        });
        throw errore(
          'RIGHE_NON_VALIDE',
          nonValide.map((riga) => riga.dipendenteId),
        );
      }
      // Tutte le celle sono valide: ora si possono controllare le sostituzioni tra righe.
      const incoerenti = soloBlocchi(
        validaMese(
          righe.map((riga) => ({
            dipendenteId: riga.dipendenteId,
            giorni: celleValide(chiaveMese, riga.giorni),
          })),
        ),
      );
      if (incoerenti.length > 0) {
        logger.warn('Convalida rifiutata: righe incoerenti', {
          repartoId,
          chiaveMese,
          problemi: incoerenti.length,
        });
        throw errore('RIGHE_NON_VALIDE', [...new Set(incoerenti.map((p) => p.dipendenteId))]);
      }

      const modifica: Pick<
        InScrittura<MeseDoc>,
        'stato' | 'convalidatoIl' | 'convalidatoDa' | 'convalidatoDaNome'
      > = {
        stato: 'convalidato',
        convalidatoIl: oraServer(),
        convalidatoDa: autore.uid,
        convalidatoDaNome: autore.nomeCompleto,
      };
      transazione.update(riferimentoMese, modifica);
      transazione.create(
        rifNuovaVoce(repartoId),
        voceRegistro(autore, {
          tipo: 'mese.convalidato',
          repartoId,
          chiaveMese,
          dettagli: { righe: righe.length },
        }),
      );
    });

    const convalidato = (await riferimentoMese.get()).get('convalidatoIl');
    logger.info('Mese convalidato', { repartoId, chiaveMese, autoreUid: autore.uid });
    return {
      convalidatoIl:
        typeof convalidato === 'object' && convalidato !== null && 'toMillis' in convalidato
          ? Number(convalidato.toMillis())
          : 0,
    };
  },
);
