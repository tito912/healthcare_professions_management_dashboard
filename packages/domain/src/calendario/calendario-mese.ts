// Calendario da copiare nel documento del mese (ARCHITETTURA §5.8) alla creazione o all'allineamento in bozza.
import type { CalendarioMese, ConfigurazioneFestivita } from '../documenti';
import type { ChiaveMese } from '../tipi';
import { festivitaReparto } from './festivita';
import { chiaveGiornoDi, chiaveMeseDi } from './mesi';

/**
 * Le festività del reparto che cadono nel mese, con id e nome, più l'attribuzione della notte (D6). Se due
 * festività cadono nello stesso giorno resta la nazionale (o la prima in ordine di nome).
 */
export function calendarioMese(
  chiave: ChiaveMese,
  configurazione: ConfigurazioneFestivita,
  attribuzioneNotte: 'inizio' | 'fine',
): CalendarioMese {
  const festivita: CalendarioMese['festivita'] = {};
  const delMese = festivitaReparto(Number(chiave.slice(0, 4)), configurazione)
    .filter((f) => chiaveMeseDi(f.data) === chiave)
    .sort((a, b) => Number(a.tipo === 'locale') - Number(b.tipo === 'locale'));
  for (const festa of delMese) {
    const giorno = chiaveGiornoDi(festa.data);
    festivita[giorno] ??= { id: festa.id, nome: festa.nome };
  }
  return { festivita, attribuzioneNotte };
}
