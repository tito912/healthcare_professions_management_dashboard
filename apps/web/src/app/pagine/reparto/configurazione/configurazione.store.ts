import { computed, inject, Injectable, signal } from '@angular/core';
import {
  idFestivitaLocale,
  MAX_FESTIVITA_LOCALI,
  meseCorrente,
  normalizzaCodice,
  type FestivitaLocale,
} from '@turni/domain';
import type { IdFestivitaNazionale } from '@turni/domain';
import { Sessione } from '../../../core/sessione.service';
import { AssenzeRepo } from '../../../dati/assenze.repo';
import { ConfigurazioneRepo } from '../../../dati/configurazione.repo';
import { ElencoReparti } from '../../../dati/elenco-reparti';
import { RepartiRepo, type RepartoConfigurazione } from '../../../dati/reparti.repo';
import { TurniRepo } from '../../../dati/turni.repo';
import { testiConfigurazione } from '../../../testi/it-configurazione';
import { Dialoghi } from '../../../ui/dialog';
import { ToastService } from '../../../ui/toast';
import {
  bozzaIniziale,
  conCampo,
  impronta,
  nuovaRigaAssenza,
  nuovaRigaTurno,
  pianoDiSalvataggio,
  turniConOrarioCambiato,
  validaBozza,
  type Bozza,
  type DatiSalvati,
  type RigaAssenza,
  type RigaTurno,
} from './bozza';

export type StatoConfigurazione = 'caricamento' | 'pronto' | 'errore' | 'nonDisponibile';
export type TipoRiga = 'turno' | 'reperibilita';
export type CampoRigaTurno = 'codice' | 'nome' | 'colore' | 'inizio' | 'fine' | 'pausa';
/** Come finisce un tentativo di salvataggio. */
export type EsitoSalvataggio = 'salvato' | 'invalido' | 'annullato' | 'errore';

/**
 * Stato della schermata di configurazione (UX §7.4): i dati salvati, la bozza locale e il salvataggio
 * esplicito in un batch. Un'istanza per pagina (si fornisce nel componente, non nella radice).
 */
@Injectable()
export class ConfigurazioneStore {
  private readonly repartiRepo = inject(RepartiRepo);
  private readonly turniRepo = inject(TurniRepo);
  private readonly assenzeRepo = inject(AssenzeRepo);
  private readonly scritture = inject(ConfigurazioneRepo);
  private readonly sessione = inject(Sessione);
  private readonly elenco = inject(ElencoReparti);
  private readonly dialoghi = inject(Dialoghi);
  private readonly toast = inject(ToastService);

  readonly stato = signal<StatoConfigurazione>('caricamento');
  readonly reparto = signal<RepartoConfigurazione | null>(null);
  readonly salvati = signal<DatiSalvati>({ turni: [], assenze: [] });
  readonly bozza = signal<Bozza | null>(null);
  /** Anno mostrato nell'elenco delle festività. */
  readonly anno = signal(Number(meseCorrente().slice(0, 4)));
  /** Dopo un tentativo di salvataggio con errori, tutti gli errori diventano visibili. */
  readonly tentato = signal(false);
  readonly inSalvataggio = signal(false);

  private readonly improntaIniziale = signal('');
  private chiaveSuccessiva = 1;
  private readonly nuovaChiave = (): number => this.chiaveSuccessiva++;

  /** Solo il coordinatore proprietario modifica: l'ADMIN consulta (UX §7.4). Le regole lo impongono comunque. */
  readonly modificabile = computed(() => this.sessione.ruolo() === 'COORDINATORE');
  readonly completata = computed(() => this.reparto()?.passo === 'completata');
  /** L'eliminazione è consentita solo prima di completare la configurazione (L29). */
  readonly puoEliminare = computed(() => !this.completata());

  readonly errori = computed(() => {
    const bozza = this.bozza();
    return bozza === null ? null : validaBozza(bozza);
  });

  readonly piano = computed(() => {
    const bozza = this.bozza();
    const errori = this.errori();
    return bozza !== null && errori?.valida === true
      ? pianoDiSalvataggio(bozza, this.salvati())
      : [];
  });

  readonly sporca = computed(() => {
    const bozza = this.bozza();
    return bozza !== null && impronta(bozza) !== this.improntaIniziale();
  });

  /** Quante modifiche non salvate: per l'avviso di inattività. 0 se la bozza coincide con la partenza. */
  readonly modificheNonSalvate = computed(() =>
    this.sporca() ? Math.max(1, this.piano().length) : 0,
  );

  /** Legge reparto, turni e assenze. `silenzioso`: rilettura dopo un salvataggio, senza lo scheletro. */
  async carica(repartoId: string, silenzioso = false): Promise<void> {
    if (!silenzioso) {
      this.stato.set('caricamento');
    }
    this.tentato.set(false);
    try {
      const reparto = await this.repartiRepo.leggiConfigurazione(repartoId);
      if (reparto === null) {
        this.reparto.set(null);
        this.bozza.set(null);
        this.stato.set('nonDisponibile');
        return;
      }
      const [turni, assenze] = await Promise.all([
        this.turniRepo.elenco(repartoId),
        this.assenzeRepo.elenco(repartoId),
      ]);
      this.applica(reparto, { turni, assenze });
      this.stato.set('pronto');
    } catch {
      this.stato.set('errore');
    }
  }

  private applica(reparto: RepartoConfigurazione, salvati: DatiSalvati): void {
    const bozza = bozzaIniziale(reparto, salvati, this.nuovaChiave);
    this.reparto.set(reparto);
    this.salvati.set(salvati);
    this.bozza.set(bozza);
    this.improntaIniziale.set(impronta(bozza));
  }

  private aggiorna(cambia: (bozza: Bozza) => Bozza): void {
    this.bozza.update((bozza) => (bozza === null ? null : cambia(bozza)));
  }

  // --- reparto e impostazioni ------------------------------------------------------------------

  impostaNome(nome: string): void {
    this.aggiorna((b) => ({ ...b, nome }));
  }

  impostaAttribuzioneNotte(valore: 'inizio' | 'fine'): void {
    this.aggiorna((b) => ({ ...b, attribuzioneNotte: valore }));
  }

  // --- turni e fasce ---------------------------------------------------------------------------

  private righe(bozza: Bozza, tipo: TipoRiga): readonly RigaTurno[] {
    return tipo === 'turno' ? bozza.turni : bozza.fasce;
  }

  private conRighe(bozza: Bozza, tipo: TipoRiga, righe: readonly RigaTurno[]): Bozza {
    return tipo === 'turno' ? { ...bozza, turni: righe } : { ...bozza, fasce: righe };
  }

  aggiungiRiga(tipo: TipoRiga): number {
    const chiave = this.nuovaChiave();
    this.aggiorna((b) =>
      this.conRighe(b, tipo, [
        ...this.righe(b, tipo),
        nuovaRigaTurno(tipo, this.righe(b, tipo), chiave),
      ]),
    );
    return chiave;
  }

  impostaCampo(tipo: TipoRiga, chiave: number, campo: CampoRigaTurno, valore: string): void {
    this.aggiorna((b) =>
      this.conRighe(
        b,
        tipo,
        this.righe(b, tipo).map((r) =>
          r.chiave === chiave ? conCampo(r, tipo, campo, valore) : r,
        ),
      ),
    );
  }

  alternaAttivo(tipo: TipoRiga, chiave: number): void {
    this.aggiorna((b) =>
      this.conRighe(
        b,
        tipo,
        this.righe(b, tipo).map((r) => (r.chiave === chiave ? { ...r, attivo: !r.attivo } : r)),
      ),
    );
  }

  /** Toglie la riga dalla bozza (una riga già salvata si elimina davvero solo al salvataggio, L29). */
  rimuoviRiga(tipo: TipoRiga, chiave: number): void {
    this.aggiorna((b) =>
      this.conRighe(
        b,
        tipo,
        this.righe(b, tipo).filter((r) => r.chiave !== chiave),
      ),
    );
  }

  // --- assenze ---------------------------------------------------------------------------------

  aggiungiAssenza(): number {
    const chiave = this.nuovaChiave();
    this.aggiorna((b) => ({ ...b, assenze: [...b.assenze, nuovaRigaAssenza(chiave)] }));
    return chiave;
  }

  private cambiaAssenza(chiave: number, cambia: (riga: RigaAssenza) => RigaAssenza): void {
    this.aggiorna((b) => ({
      ...b,
      assenze: b.assenze.map((r) => (r.chiave === chiave && !r.predefinita ? cambia(r) : r)),
    }));
  }

  impostaCodiceAssenza(chiave: number, valore: string): void {
    this.cambiaAssenza(chiave, (r) => ({ ...r, codice: normalizzaCodice(valore) }));
  }

  impostaDescrizioneAssenza(chiave: number, descrizione: string): void {
    this.cambiaAssenza(chiave, (r) => ({ ...r, descrizione }));
  }

  impostaEffettoAssenza(chiave: number, effetto: 'comeRiposo' | 'neutra'): void {
    this.cambiaAssenza(chiave, (r) => ({ ...r, effetto }));
  }

  alternaAttivoAssenza(chiave: number): void {
    this.cambiaAssenza(chiave, (r) => ({ ...r, attivo: !r.attivo }));
  }

  rimuoviAssenza(chiave: number): void {
    this.aggiorna((b) => ({
      ...b,
      assenze: b.assenze.filter((r) => r.chiave !== chiave || r.predefinita),
    }));
  }

  // --- festività -------------------------------------------------------------------------------

  /** «Rimuovi» una nazionale: la esclude per tutti gli anni (L36). */
  escludiNazionale(id: IdFestivitaNazionale): void {
    this.aggiorna((b) =>
      b.festivita.nazionaliEscluse.includes(id)
        ? b
        : {
            ...b,
            festivita: { ...b.festivita, nazionaliEscluse: [...b.festivita.nazionaliEscluse, id] },
          },
    );
  }

  ripristinaNazionale(id: IdFestivitaNazionale): void {
    this.aggiorna((b) => ({
      ...b,
      festivita: {
        ...b.festivita,
        nazionaliEscluse: b.festivita.nazionaliEscluse.filter((e) => e !== id),
      },
    }));
  }

  /** Aggiunge una locale; false se si è già al massimo. */
  aggiungiLocale(nome: string, giorno: number, mese: number): boolean {
    const bozza = this.bozza();
    if (bozza === null || bozza.festivita.locali.length >= MAX_FESTIVITA_LOCALI) {
      return false;
    }
    const suffisso = Math.random().toString(36).slice(2, 6);
    const locale: FestivitaLocale = {
      id: idFestivitaLocale(nome, suffisso),
      nome: nome.trim(),
      giorno,
      mese,
    };
    this.aggiorna((b) => ({
      ...b,
      festivita: { ...b.festivita, locali: [...b.festivita.locali, locale] },
    }));
    return true;
  }

  modificaLocale(id: string, nome: string, giorno: number, mese: number): void {
    this.aggiorna((b) => ({
      ...b,
      festivita: {
        ...b.festivita,
        locali: b.festivita.locali.map((l) =>
          l.id === id ? { id, nome: nome.trim(), giorno, mese } : l,
        ),
      },
    }));
  }

  eliminaLocale(id: string): void {
    this.aggiorna((b) => ({
      ...b,
      festivita: { ...b.festivita, locali: b.festivita.locali.filter((l) => l.id !== id) },
    }));
  }

  // --- salvataggio -----------------------------------------------------------------------------

  /**
   * Salva in un batch. Con `avanza` (e passo ancora «turni») imposta anche il passo successivo.
   * Se la bozza non è valida non scrive e rende visibili tutti gli errori. Il cambio d'orario di un turno
   * già salvato chiede prima conferma (UX §7.4).
   */
  async salva(avanza: boolean): Promise<EsitoSalvataggio> {
    const bozza = this.bozza();
    const reparto = this.reparto();
    const utente = this.sessione.utente();
    const errori = this.errori();
    if (bozza === null || reparto === null || utente === null || errori === null) {
      return 'errore';
    }
    if (!errori.valida || (avanza && errori.nessunTurno)) {
      this.tentato.set(true);
      return 'invalido';
    }
    const cambiati = turniConOrarioCambiato(bozza, this.salvati());
    if (cambiati.length > 0) {
      const conferma = await this.dialoghi.conferma({
        titolo: testiConfigurazione.cambioOrari.titolo,
        messaggio: testiConfigurazione.cambioOrari.messaggio(cambiati.join(', ')),
        etichettaConferma: testiConfigurazione.cambioOrari.conferma,
      });
      if (!conferma) {
        return 'annullato';
      }
    }
    this.inSalvataggio.set(true);
    try {
      await this.scritture.salva(
        reparto.id,
        utente.uid,
        {
          nome: bozza.nome.trim(),
          attribuzioneNotte: bozza.attribuzioneNotte,
          festivita: bozza.festivita,
          ...(avanza && reparto.passo === 'turni' ? { passo: 'dipendenti' as const } : {}),
        },
        this.piano(),
      );
    } catch {
      this.toast.errore(testiConfigurazione.salvataggioNonRiuscito);
      return 'errore';
    } finally {
      this.inSalvataggio.set(false);
    }
    this.tentato.set(false);
    void this.elenco.carica(true);
    try {
      await this.carica(reparto.id, true);
    } catch {
      // Il salvataggio è riuscito: se la rilettura fallisce, resta lo stato di «errore» di carica().
    }
    return 'salvato';
  }
}
