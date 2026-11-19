// Stato della schermata «Pianificazione mese» (UX §9, D1): righe salvate e locali, selezione, pennello,
// cronologia, inserimento veloce, avvisi dal dominio e «Salva bozza». Un'istanza per pagina (si fornisce nel
// componente). Una modifica tocca solo il signal della riga: gli avvisi, i totali e le celle di ogni riga
// sono `computed` che dipendono dalla sola riga e dalla configurazione condivisa (PIANO 2.2 criterio 10).
import {
  computed,
  inject,
  Injectable,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import {
  adessoMs,
  applicaAssegnazione,
  avvisiRiga,
  calendarioMese,
  cellaVuota,
  convalidaConsentita,
  dipendentiInServizio,
  dataDelGiorno,
  chiaveGiornoDi,
  eChiaveGiorno,
  eChiaveMese,
  eCodiceTurno,
  festivitaDelMese,
  formattaData,
  formattaGiornoCompleto,
  formattaMese,
  formattaOraDaMs,
  impostaCella,
  incollaIntervallo,
  inServizioIl,
  interpretaInserimento,
  MAX_UNITA_REPERIBILITA_MESE,
  opzioniCella,
  meseModificabile,
  primoGiornoConvalida,
  soloBlocchi,
  spostaMese,
  totaliRiga,
  validaMese,
  validaRiga,
  type Assegnazione,
  type CalendarioMese,
  type CellaDoc,
  type ChiaveGiorno,
  type ChiaveMese,
  type ConfigurazioneGriglia,
  type ContrattoRiga,
  type IdColoreTurno,
  type OpzioniCella,
  type MotivoRifiuto,
  type NotaCellaSaltata,
  type Segnalazione,
} from '@turni/domain';
import { DATA_OGGI, FINESTRA_MESI_MODIFICABILI } from '../../../core/ambiente';
import { Connessione } from '../../../core/connessione.service';
import { Preferenze } from '../../../core/preferenze.service';
import { Sessione } from '../../../core/sessione.service';
import { AssenzeRepo, type AssenzaSalvata } from '../../../dati/assenze.repo';
import { DipendentiRepo, type DipendenteSalvato } from '../../../dati/dipendenti.repo';
import { MesiRepo, type MeseSalvato } from '../../../dati/mesi.repo';
import { RepartiRepo, type RepartoConfigurazione } from '../../../dati/reparti.repo';
import {
  ErroreSalvataggio,
  RigheRepo,
  type RigaDaSalvare,
  type RigaSalvata,
} from '../../../dati/righe.repo';
import { TurniRepo, type TurnoSalvato } from '../../../dati/turni.repo';
import { testi } from '../../../testi/it';
import { Dialoghi } from '../../../ui/dialog';
import { ToastService } from '../../../ui/toast';
import { bloccoDaCelle, bloccoDaTesto, stessoTesto, testoPerAppunti } from '../appunti';
import { Cronologia, type ModificaCella, type Passo } from '../cronologia';
import {
  celleDellaRiga,
  celleUguali,
  colonneDelMese,
  giorniModificati,
  nomeBreve,
  testoMotivo,
  testoSegnalazione,
  totaliDiVista,
  uguali,
  type CellaVista,
  type ColonnaGiorno,
  type ConfigVista,
  type TotaliVista,
} from '../modello';
import {
  colonnaIntera,
  limita,
  numeroCelle,
  posizioniDi,
  rettangolo,
  rigaIntera,
  stessoRettangolo,
  type Posizione,
  type Rettangolo,
} from '../selezione';
import {
  configurazioneVista,
  giorniVisibili,
  limitaSettimana,
  passoSettimane,
  settimanaDelGiorno,
  VISTA_PREDEFINITA,
  type ConfigurazioneVista,
  type Vista,
} from '../vista';

export type StatoCaricamento = 'caricamento' | 'pronto' | 'errore' | 'nonDisponibile';
export type StatoSalvataggio = 'riposo' | 'inCorso' | 'errore';

/** Una riga come la vede il browser: il salvato più le modifiche locali. */
export interface RigaStato {
  readonly dipendenteId: string;
  readonly contratto: ContrattoRiga;
  readonly giorni: Readonly<Partial<Record<ChiaveGiorno, CellaDoc>>>;
  /** Celle non valide già salvate: si riscrivono invariate finché non si svuotano. */
  readonly grezzi: Readonly<Record<string, unknown>>;
}

/** Una cella della griglia: la riga e il giorno. */
export interface RiferimentoCella {
  readonly dipendenteId: string;
  readonly giorno: ChiaveGiorno;
}

/** Il pennello: un codice di turno, assenza o reperibilità, oppure la gomma. */
export type Pennello =
  { readonly tipo: 'codice'; readonly codice: string } | { readonly tipo: 'gomma' };

/** Cosa si sceglie dal menu della cella. */
export type VoceScelta =
  | { readonly tipo: 'codice'; readonly codice: string }
  | { readonly tipo: 'gomma' }
  | { readonly tipo: 'eliminaTurnoScoperto' }
  | { readonly tipo: 'rimuovi'; readonly codice: string };

/** Ciò che la riga mostra oltre alle celle: dipende da selezione e inserimento, non dai dati. */
export interface StatoRiga {
  readonly giornoAttivo: ChiaveGiorno | null;
  /** Intervallo selezionato (almeno 2 celle) limitato a questa riga, in indici dei giorni visibili. */
  readonly selezione: {
    readonly da: number;
    readonly a: number;
    readonly primaRiga: boolean;
    readonly ultimaRiga: boolean;
  } | null;
  readonly inserimento: { readonly giorno: ChiaveGiorno; readonly iniziale: string } | null;
}

function stessoStatoRiga(a: StatoRiga, b: StatoRiga): boolean {
  return (
    a.giornoAttivo === b.giornoAttivo &&
    a.inserimento?.giorno === b.inserimento?.giorno &&
    a.inserimento?.iniziale === b.inserimento?.iniziale &&
    (a.selezione === null || b.selezione === null
      ? a.selezione === b.selezione
      : a.selezione.da === b.selezione.da &&
        a.selezione.a === b.selezione.a &&
        a.selezione.primaRiga === b.selezione.primaRiga &&
        a.selezione.ultimaRiga === b.selezione.ultimaRiga)
  );
}

export interface DatiRiga {
  readonly id: string;
  readonly nome: string;
  readonly nomeCompleto: string;
  readonly celle: readonly CellaVista[];
  readonly totali: TotaliVista;
  readonly modificata: boolean;
}

/** Una voce del pannello Avvisi (UX §9.6). */
export interface VoceAvviso {
  readonly chiave: string;
  readonly livello: 'blocco' | 'avviso' | 'nota';
  readonly testo: string;
  /** «Rossi M. · 4 nov». */
  readonly dettaglio: string;
  readonly cella: RiferimentoCella | null;
  readonly azione: Allineamento | null;
}

export type Allineamento =
  | { readonly tipo: 'calendario' }
  | { readonly tipo: 'contratto'; readonly dipendenteId: string }
  | { readonly tipo: 'dipendente'; readonly dipendenteId: string };

export interface EsitoInserimentoVeloce {
  readonly ok: boolean;
  readonly messaggio: string | null;
}

interface Derivati {
  readonly segnalazioni: Signal<readonly Segnalazione[]>;
  readonly modificate: Signal<ReadonlySet<ChiaveGiorno>>;
  readonly numeroModifiche: Signal<number>;
  readonly dati: Signal<DatiRiga>;
  readonly stato: Signal<StatoRiga>;
}

const NUMERO_RIGHE_PER_PAGINA = 12;

@Injectable()
export class GrigliaStore {
  private readonly sessione = inject(Sessione);
  private readonly connessione = inject(Connessione);
  private readonly preferenze = inject(Preferenze);
  private readonly dialoghi = inject(Dialoghi);
  private readonly toast = inject(ToastService);
  private readonly repartiRepo = inject(RepartiRepo);
  private readonly turniRepo = inject(TurniRepo);
  private readonly assenzeRepo = inject(AssenzeRepo);
  private readonly dipendentiRepo = inject(DipendentiRepo);
  private readonly mesiRepo = inject(MesiRepo);
  private readonly righeRepo = inject(RigheRepo);
  private readonly oggiIso = inject(DATA_OGGI);
  private readonly finestraMesi = inject(FINESTRA_MESI_MODIFICABILI);

  // --- dati caricati -------------------------------------------------------------------------

  readonly stato = signal<StatoCaricamento>('caricamento');
  readonly repartoId = signal('');
  readonly chiaveMese = signal<ChiaveMese | null>(null);
  readonly reparto = signal<RepartoConfigurazione | null>(null);
  readonly turni = signal<readonly TurnoSalvato[]>([]);
  readonly assenze = signal<readonly AssenzaSalvata[]>([]);
  readonly dipendenti = signal<readonly DipendenteSalvato[]>([]);
  /** Il mese salvato; null se non è stato creato. */
  readonly mese = signal<MeseSalvato | null>(null);
  readonly ordine = signal<readonly string[]>([]);

  private readonly righe = new Map<string, WritableSignal<RigaStato>>();
  private readonly baseline = signal<ReadonlyMap<string, RigaSalvata>>(new Map());
  private readonly adiacenti = signal<{
    readonly precedente: ReadonlyMap<string, RigaSalvata> | null;
    readonly successivo: ReadonlyMap<string, RigaSalvata> | null;
  }>({ precedente: null, successivo: null });
  private readonly cacheRighe = new Map<ChiaveMese, readonly RigaSalvata[]>();
  private readonly derivati = new Map<string, Derivati>();
  private caricamentoCorrente = 0;
  /** Calendario del mese con l'eventuale allineamento non ancora salvato. */
  readonly calendarioLocale = signal<CalendarioMese | null>(null);

  // --- permessi e stato del mese -------------------------------------------------------------

  readonly eAdmin = computed(() => this.sessione.ruolo() === 'ADMIN');
  readonly convalidato = computed(() => this.mese()?.stato === 'convalidato');
  /** Il coordinatore può modificare un mese in bozza (D2: dopo la convalida, sola lettura totale). */
  readonly modificabile = computed(
    () => this.sessione.ruolo() === 'COORDINATORE' && this.mese()?.stato === 'bozza',
  );
  readonly solaLettura = computed(() => !this.modificabile());

  /** Il giorno di oggi a Europe/Rome (dal dominio, fissabile nei test). */
  readonly oggi = computed(() => this.oggiIso());

  // --- vista ---------------------------------------------------------------------------------

  readonly vista = signal<Vista>(VISTA_PREDEFINITA);
  /** Indice della prima settimana mostrata nelle viste a settimane. */
  readonly settimana = signal(0);
  /** Spazio per i giorni in px: la pagina lo misura con un `ResizeObserver` (UX §8.1). */
  readonly larghezzaDisponibile = signal(1366 - 408);

  readonly tuttiIGiorni = computed<readonly ColonnaGiorno[]>(() => {
    const chiave = this.chiaveMese();
    const calendario = this.calendarioLocale();
    return chiave === null || calendario === null
      ? []
      : colonneDelMese(chiave, calendario, this.oggi());
  });
  readonly giorni = computed<readonly ChiaveGiorno[]>(() => {
    const chiave = this.chiaveMese();
    return chiave === null ? [] : giorniVisibili(chiave, this.vista(), this.settimana());
  });
  readonly colonne = computed<readonly ColonnaGiorno[]>(() => {
    const visibili = new Set<ChiaveGiorno>(this.giorni());
    return this.tuttiIGiorni().filter((c) => visibili.has(c.giorno));
  });
  /** Le colonne mantengono la larghezza della vista anche nelle settimane corte a inizio o fine mese (UX §9.9). */
  readonly configurazioneVista = computed<ConfigurazioneVista>(() => {
    const vista = this.vista();
    const giorniPerLarghezza =
      vista === 'mese' ? this.giorni().length : vista === 'settimane2' ? 14 : 7;
    return configurazioneVista(vista, this.larghezzaDisponibile(), giorniPerLarghezza);
  });
  /** «9–15 nov» per la barra delle viste a settimane. */
  readonly intervalloVisibile = computed(() => {
    const colonne = this.colonne();
    const prima = colonne[0];
    const ultima = colonne.at(-1);
    return prima === undefined || ultima === undefined ? null : { da: prima.data, a: ultima.data };
  });
  readonly puoSpostareSettimana = computed(() => {
    const chiave = this.chiaveMese();
    if (chiave === null || this.vista() === 'mese') {
      return { indietro: false, avanti: false };
    }
    const prima = limitaSettimana(chiave, this.vista(), this.settimana());
    return {
      indietro: prima > 0,
      avanti: limitaSettimana(chiave, this.vista(), prima + 1) !== prima,
    };
  });

  // --- configurazione per le regole ---------------------------------------------------------

  readonly configurazione = computed<ConfigurazioneGriglia>(() => ({
    turni: this.turni(),
    assenze: this.assenze(),
  }));
  readonly configVista = computed<ConfigVista>(() => ({
    turni: new Map(this.turni().map((t) => [t.codice, { nome: t.nome, colore: t.colore }])),
    assenze: new Map(this.assenze().map((a) => [a.codice, { descrizione: a.descrizione }])),
  }));
  private readonly dipendentiPerId = computed(
    () => new Map(this.dipendenti().map((d) => [d.id, d])),
  );
  /** Turni e fasce attivi per il pennello e per la legenda, in ordine. */
  readonly turniAttivi = computed(() => this.turni().filter((t) => t.attivo && t.tipo === 'turno'));
  readonly fasceAttive = computed(() =>
    this.turni().filter((t) => t.attivo && t.tipo === 'reperibilita'),
  );
  readonly assenzeAttive = computed(() => this.assenze().filter((a) => a.attivo));

  // --- selezione e pennello ------------------------------------------------------------------

  readonly attiva = signal<RiferimentoCella | null>(null);
  private readonly ancora = signal<RiferimentoCella | null>(null);
  readonly pennello = signal<Pennello | null>(null);
  /** Cella in inserimento veloce (UX §9.2) e messaggio dell'ultimo rifiuto. */
  readonly inserimento = signal<{
    readonly cella: RiferimentoCella;
    readonly iniziale: string;
  } | null>(null);
  readonly messaggioInserimento = signal<string | null>(null);

  private posizioneDi(riferimento: RiferimentoCella | null): Posizione | null {
    if (riferimento === null) {
      return null;
    }
    const riga = this.ordine().indexOf(riferimento.dipendenteId);
    const colonna = this.giorni().indexOf(riferimento.giorno);
    return riga < 0 || colonna < 0 ? null : { riga, colonna };
  }

  private riferimentoDi(posizione: Posizione): RiferimentoCella | null {
    const dipendenteId = this.ordine()[posizione.riga];
    const giorno = this.giorni()[posizione.colonna];
    return dipendenteId === undefined || giorno === undefined ? null : { dipendenteId, giorno };
  }

  readonly posizioneAttiva = computed(() => this.posizioneDi(this.attiva()));
  readonly intervallo = computed<Rettangolo | null>(
    () => {
      const attiva = this.posizioneAttiva();
      if (attiva === null) {
        return null;
      }
      return rettangolo(this.posizioneDi(this.ancora()) ?? attiva, attiva);
    },
    { equal: stessoRettangolo },
  );
  readonly celleSelezionate = computed(() => {
    const r = this.intervallo();
    return r === null ? 0 : numeroCelle(r);
  });

  // --- cronologia ---------------------------------------------------------------------------

  private readonly cronologia = new Cronologia();
  private readonly versioneCronologia = signal(0);
  readonly puoAnnullare = computed(() => {
    this.versioneCronologia();
    return this.cronologia.puoAnnullare();
  });
  readonly puoRipristinare = computed(() => {
    this.versioneCronologia();
    return this.cronologia.puoRipristinare();
  });

  // --- salvataggio ---------------------------------------------------------------------------

  readonly salvataggio = signal<StatoSalvataggio>('riposo');
  readonly ultimoSalvataggio = signal<string | null>(null);
  readonly pannello = signal<'avvisi' | null>(null);
  /** Celle saltate dall'ultimo pennello, incolla o menu: note nel pannello Avvisi. */
  readonly noteSaltate = signal<readonly NotaCellaSaltata[]>([]);
  private ultimaCopia: {
    readonly testo: string;
    readonly blocco: readonly (readonly string[])[];
  } | null = null;

  /** Modifiche non salvate: ogni cella diversa dal salvato, più ogni allineamento (UX §9.7). */
  readonly modifiche = computed(() => {
    let totale = this.mese() !== null && this.calendarioDiverso() ? 1 : 0;
    for (const id of this.ordine()) {
      totale += this.derivatiDi(id).numeroModifiche();
    }
    return totale;
  });
  readonly righeModificate = computed(() =>
    this.ordine().filter((id) => this.derivatiDi(id).numeroModifiche() > 0),
  );
  private readonly calendarioDiverso = computed(() => {
    const locale = this.calendarioLocale();
    const salvato = this.mese()?.calendario ?? null;
    return locale !== null && salvato !== null && !uguali(locale, salvato);
  });

  readonly motivoSalvaDisabilitato = computed<string | null>(() => {
    if (this.convalidato()) {
      return testi.griglia.motivoSalva.meseConvalidato;
    }
    if (this.salvataggio() === 'inCorso') {
      return testi.griglia.motivoSalva.inCorso;
    }
    if (!this.connessione.connesso()) {
      return testi.griglia.motivoSalva.connessioneAssente;
    }
    return this.modifiche() === 0 ? testi.griglia.motivoSalva.nessunaModifica : null;
  });

  /** Perché «Convalida mese» è disabilitato (UX §9.8); nello step 2.2 la convalida non c'è ancora. */
  readonly motivoConvalidaDisabilitata = computed<string>(() => {
    const chiave = this.chiaveMese();
    if (this.convalidato()) {
      return testi.griglia.motivoConvalida.meseConvalidato;
    }
    if (this.modifiche() > 0) {
      return testi.griglia.motivoConvalida.modificheNonSalvate;
    }
    if (chiave !== null && !convalidaConsentita(chiave, this.oggi())) {
      return testi.griglia.motivoConvalida.daQuando(formattaData(primoGiornoConvalida(chiave)));
    }
    return testi.griglia.motivoConvalida.inArrivo;
  });

  /** Il mese si può creare con «Aggiungi mese»: solo il coordinatore, entro la finestra (D8). */
  readonly oltreFinestra = computed(() => {
    const chiave = this.chiaveMese();
    return chiave !== null && !meseModificabile(chiave, this.oggi(), this.finestraMesi);
  });
  readonly ultimoMeseCreabile = computed(() =>
    spostaMese(this.meseDi(this.oggi()), this.finestraMesi),
  );

  constructor() {
    // Nessun altro lavoro: il caricamento parte da `carica()`.
  }

  // ----------------------------------------------------------------------------------------------
  // Caricamento
  // ----------------------------------------------------------------------------------------------

  private meseDi(data: string): ChiaveMese {
    const chiave = data.slice(0, 7);
    if (!eChiaveMese(chiave)) {
      throw new Error('Data non valida');
    }
    return chiave;
  }

  /** Apre il mese (ARCHITETTURA §9): configurazione del reparto una volta, poi mese, righe e mesi adiacenti. */
  async carica(repartoId: string, chiave: string): Promise<void> {
    const numero = ++this.caricamentoCorrente;
    this.azzeraLocale();
    if (!eChiaveMese(chiave)) {
      this.stato.set('nonDisponibile');
      return;
    }
    this.stato.set('caricamento');
    this.chiaveMese.set(chiave);
    try {
      if (this.repartoId() !== repartoId || this.reparto() === null) {
        this.cacheRighe.clear();
        const reparto = await this.repartiRepo.leggiConfigurazione(repartoId);
        if (numero !== this.caricamentoCorrente) {
          return;
        }
        if (reparto === null) {
          this.reparto.set(null);
          this.stato.set('nonDisponibile');
          return;
        }
        const [turni, assenze, dipendenti] = await Promise.all([
          this.turniRepo.elenco(repartoId),
          this.assenzeRepo.elenco(repartoId),
          this.dipendentiRepo.elenco(repartoId),
        ]);
        if (numero !== this.caricamentoCorrente) {
          return;
        }
        this.repartoId.set(repartoId);
        this.reparto.set(reparto);
        this.turni.set(turni);
        this.assenze.set(assenze);
        this.dipendenti.set(dipendenti);
      }
      const mese = await this.mesiRepo.leggi(repartoId, chiave);
      if (numero !== this.caricamentoCorrente) {
        return;
      }
      if (mese === null) {
        this.mese.set(null);
        this.calendarioLocale.set(null);
        this.stato.set('pronto');
        return;
      }
      const precedente = spostaMese(chiave, -1);
      const successivo = spostaMese(chiave, 1);
      const [righe, righePrecedente, righeSuccessive] = await Promise.all([
        this.righeRepo.leggi(repartoId, chiave),
        this.righeDelMese(repartoId, precedente),
        this.righeDelMese(repartoId, successivo),
      ]);
      if (numero !== this.caricamentoCorrente) {
        return;
      }
      this.cacheRighe.set(chiave, righe);
      this.applicaCaricamento(mese, righe, righePrecedente, righeSuccessive);
      this.stato.set('pronto');
    } catch {
      if (numero === this.caricamentoCorrente) {
        this.stato.set('errore');
      }
    }
  }

  /** Righe di un mese adiacente: dalla memoria se già lette in questa sessione, altrimenti da Firestore. */
  private async righeDelMese(
    repartoId: string,
    chiave: ChiaveMese,
  ): Promise<readonly RigaSalvata[]> {
    const inMemoria = this.cacheRighe.get(chiave);
    if (inMemoria !== undefined) {
      return inMemoria;
    }
    const lette = await this.righeRepo.leggi(repartoId, chiave);
    this.cacheRighe.set(chiave, lette);
    return lette;
  }

  ricarica(): Promise<void> {
    const chiave = this.chiaveMese();
    // Un mese ricaricato si rilegge sempre: la copia in memoria potrebbe essere vecchia.
    if (chiave !== null) {
      this.cacheRighe.delete(chiave);
    }
    return this.carica(this.repartoId(), chiave ?? '');
  }

  private azzeraLocale(): void {
    this.righe.clear();
    this.derivati.clear();
    this.ordine.set([]);
    this.baseline.set(new Map());
    this.adiacenti.set({ precedente: null, successivo: null });
    this.attiva.set(null);
    this.ancora.set(null);
    this.pennello.set(null);
    this.inserimento.set(null);
    this.messaggioInserimento.set(null);
    this.noteSaltate.set([]);
    this.cronologia.azzera();
    this.versioneCronologia.update((v) => v + 1);
    this.salvataggio.set('riposo');
    this.pannello.set(null);
    this.mese.set(null);
  }

  private applicaCaricamento(
    mese: MeseSalvato,
    righe: readonly RigaSalvata[],
    precedente: readonly RigaSalvata[],
    successivo: readonly RigaSalvata[],
  ): void {
    this.mese.set(mese);
    this.calendarioLocale.set(mese.calendario);
    this.baseline.set(new Map(righe.map((r) => [r.dipendenteId, r])));
    this.adiacenti.set({
      precedente: new Map(precedente.map((r) => [r.dipendenteId, r])),
      successivo: new Map(successivo.map((r) => [r.dipendenteId, r])),
    });
    for (const riga of righe) {
      this.righe.set(
        riga.dipendenteId,
        signal<RigaStato>({
          dipendenteId: riga.dipendenteId,
          contratto: riga.contratto,
          giorni: riga.giorni,
          grezzi: riga.grezzi,
        }),
      );
    }
    this.ordine.set(this.ordinate(righe.map((r) => r.dipendenteId)));
    // Vista ricordata per l'utente (U9): le settimane partono da quella di oggi, se è nel mese.
    const utente = this.sessione.utente();
    if (utente !== null) {
      this.vista.set(this.preferenze.leggi(utente.uid).vistaGriglia);
    }
    this.settimana.set(this.settimanaIniziale(mese.chiave));
    const primo = this.ordine()[0];
    const primoGiorno = this.giorni()[0];
    if (primo !== undefined && primoGiorno !== undefined) {
      this.attiva.set({ dipendenteId: primo, giorno: primoGiorno });
      this.ancora.set(null);
    }
  }

  private settimanaIniziale(chiave: ChiaveMese): number {
    const oggi = this.oggi();
    return oggi.startsWith(`${chiave}-`) ? settimanaDelGiorno(chiave, chiaveGiornoDi(oggi)) : 0;
  }

  /** Righe in ordine di cognome e nome (UX §7.6). Un dipendente rimosso va in fondo. */
  private ordinate(ids: readonly string[]): string[] {
    const dipendenti = this.dipendentiPerId();
    const chiave = (id: string): string => {
      const d = dipendenti.get(id);
      return d === undefined ? '￿' : `${d.cognome} ${d.nome}`;
    };
    return [...ids].sort((a, b) => chiave(a).localeCompare(chiave(b), 'it') || a.localeCompare(b));
  }

  // ----------------------------------------------------------------------------------------------
  // Aggiungi mese
  // ----------------------------------------------------------------------------------------------

  /** Mesi già creati del reparto, per il selettore. */
  mesiCreati(): Promise<readonly ChiaveMese[]> {
    return this.mesiRepo.elenco(this.repartoId());
  }

  /** Il mese si può scegliere nel selettore: dentro la finestra di modifica (D8). */
  meseCreabile(chiave: ChiaveMese): boolean {
    return meseModificabile(chiave, this.oggi(), this.finestraMesi);
  }

  /** «Aggiungi mese»: il mese in bozza e una riga per ogni dipendente in servizio (ARCHITETTURA §9). */
  async aggiungiMese(chiave: ChiaveMese): Promise<boolean> {
    const utente = this.sessione.utente();
    const reparto = this.reparto();
    if (utente === null || reparto === null || this.eAdmin() || !this.meseCreabile(chiave)) {
      return false;
    }
    const inServizio = dipendentiInServizio(chiave, this.dipendenti());
    try {
      await this.mesiRepo.crea({
        repartoId: this.repartoId(),
        uid: utente.uid,
        chiave,
        calendario: calendarioMese(chiave, reparto.festivita, reparto.attribuzioneNotte),
        righe: inServizio.map((d) => ({
          dipendenteId: d.id,
          contratto: {
            oreSettimanali: d.oreSettimanali,
            dataAssunzione: d.dataAssunzione,
            dataCessazione: d.dataCessazione,
          },
        })),
      });
      return true;
    } catch {
      this.toast.errore(testi.griglia.aggiungiMeseDialogo.errore);
      return false;
    }
  }

  // ----------------------------------------------------------------------------------------------
  // Valori derivati di ogni riga
  // ----------------------------------------------------------------------------------------------

  rigaSignal(id: string): WritableSignal<RigaStato> | undefined {
    return this.righe.get(id);
  }

  private nomeDi(id: string): { readonly breve: string; readonly completo: string } {
    const d = this.dipendentiPerId().get(id);
    return d === undefined
      ? { breve: testi.griglia.riga.rimosso, completo: testi.griglia.riga.rimosso }
      : { breve: nomeBreve(d.cognome, d.nome), completo: `${d.cognome} ${d.nome}` };
  }

  /** I valori derivati della riga, creati una volta sola e legati al solo signal della riga. */
  derivatiDi(id: string): Derivati {
    const esistenti = this.derivati.get(id);
    if (esistenti !== undefined) {
      return esistenti;
    }
    const riga = this.righe.get(id);
    if (riga === undefined) {
      throw new Error('Riga inesistente');
    }
    const segnalazioni = computed<readonly Segnalazione[]>(() => {
      const chiave = this.chiaveMese();
      if (chiave === null) {
        return [];
      }
      const r = riga();
      const { precedente, successivo } = this.adiacenti();
      const giorniDi = (mappa: ReadonlyMap<string, RigaSalvata> | null) => {
        const salvata = mappa?.get(id);
        return salvata === undefined ? null : { ...salvata.grezzi, ...salvata.giorni };
      };
      return avvisiRiga(
        { dipendenteId: id, contratto: r.contratto, giorni: { ...r.grezzi, ...r.giorni } },
        {
          chiaveMese: chiave,
          turniEsclusi: this.dipendentiPerId().get(id)?.turniEsclusi ?? [],
          righeAdiacenti: { precedente: giorniDi(precedente), successiva: giorniDi(successivo) },
        },
      );
    });
    const modificate = computed(() => {
      const giorni = new Set(giorniModificati(riga().giorni, this.baseline().get(id)?.giorni));
      // Una cella «grezza» salvata e poi tolta (svuotata) è una modifica da scrivere nel documento.
      const corrente = riga().grezzi;
      for (const giorno of Object.keys(this.baseline().get(id)?.grezzi ?? {})) {
        if (corrente[giorno] === undefined && eChiaveGiorno(giorno)) {
          giorni.add(giorno);
        }
      }
      return giorni;
    });
    const numeroModifiche = computed(() => {
      const salvata = this.baseline().get(id);
      const corrente = riga();
      return (
        modificate().size +
        (salvata === undefined ? 1 : uguali(corrente.contratto, salvata.contratto) ? 0 : 1)
      );
    });
    const totali = computed(() => {
      const chiave = this.chiaveMese();
      const calendario = this.calendarioLocale();
      const r = riga();
      return chiave === null || calendario === null
        ? null
        : totaliRiga(
            { contratto: r.contratto, giorni: r.giorni },
            { chiaveMese: chiave, festivita: festivitaDelMese(chiave, calendario.festivita) },
          );
    });
    const dati = computed<DatiRiga>(() => {
      const chiave = this.chiaveMese();
      const r = riga();
      const nome = this.nomeDi(id);
      const t = totali();
      return {
        id,
        nome: nome.breve,
        nomeCompleto: nome.completo,
        celle:
          chiave === null
            ? []
            : celleDellaRiga({
                nome: nome.breve,
                chiaveMese: chiave,
                colonne: this.colonne(),
                contratto: r.contratto,
                giorni: r.giorni,
                grezzi: r.grezzi,
                segnalazioni: segnalazioni(),
                config: this.configVista(),
                vista: this.configurazioneVista(),
              }),
        totali:
          t === null
            ? {
                pianificate: '',
                dovute: '',
                differenza: '',
                differenzaNegativa: false,
                reperibilita: '',
                reperibilitaOltre: false,
              }
            : totaliDiVista(t, MAX_UNITA_REPERIBILITA_MESE),
        modificata: numeroModifiche() > 0,
      };
    });
    const stato = computed<StatoRiga>(
      () => {
        const indice = this.ordine().indexOf(id);
        const attiva = this.attiva();
        const intervallo = this.intervallo();
        const inserimento = this.inserimento();
        const selezionata =
          intervallo !== null &&
          numeroCelle(intervallo) > 1 &&
          indice >= intervallo.rigaDa &&
          indice <= intervallo.rigaA;
        return {
          giornoAttivo: attiva?.dipendenteId === id ? attiva.giorno : null,
          selezione:
            selezionata && intervallo !== null
              ? {
                  da: intervallo.colonnaDa,
                  a: intervallo.colonnaA,
                  primaRiga: indice === intervallo.rigaDa,
                  ultimaRiga: indice === intervallo.rigaA,
                }
              : null,
          inserimento:
            inserimento?.cella.dipendenteId === id
              ? { giorno: inserimento.cella.giorno, iniziale: inserimento.iniziale }
              : null,
        };
      },
      { equal: stessoStatoRiga },
    );
    const creati: Derivati = { segnalazioni, modificate, numeroModifiche, dati, stato };
    this.derivati.set(id, creati);
    return creati;
  }

  // ----------------------------------------------------------------------------------------------
  // Avvisi del mese (pannello)
  // ----------------------------------------------------------------------------------------------

  /** Tutte le segnalazioni del mese: blocchi e avvisi delle righe, più le note. */
  readonly voci = computed<readonly VoceAvviso[]>(() => {
    const chiave = this.chiaveMese();
    if (chiave === null) {
      return [];
    }
    const voci: VoceAvviso[] = [];
    for (const id of this.ordine()) {
      const nome = this.nomeDi(id).breve;
      for (const s of this.derivatiDi(id).segnalazioni()) {
        if (s.livello === 'nota') {
          continue;
        }
        const giorno = s.giorno === null ? null : chiaveGiornoDi(s.giorno);
        voci.push({
          chiave: `${id}-${voci.length}`,
          livello: s.livello,
          testo: testoSegnalazione(s, { nome, chiaveMese: chiave }),
          dettaglio: s.giorno === null ? nome : `${nome} · ${this.dataBreve(s.giorno)}`,
          cella: giorno === null ? null : { dipendenteId: id, giorno },
          azione: null,
        });
      }
    }
    for (const nota of this.noteSaltate()) {
      const nome = this.nomeDi(nota.dipendenteId).breve;
      voci.push({
        chiave: `nota-${nota.dipendenteId}-${nota.giorno}`,
        livello: 'nota',
        testo: testoSegnalazione(nota, { nome, chiaveMese: chiave }),
        dettaglio: `${nome} · ${this.dataBreve(nota.giorno)}`,
        cella: { dipendenteId: nota.dipendenteId, giorno: chiaveGiornoDi(nota.giorno) },
        azione: null,
      });
    }
    for (const a of this.allineamenti()) {
      voci.push(this.voceAllineamento(a));
    }
    return voci;
  });

  /** Il numero del pulsante «Avvisi»: blocchi e avvisi, non le note (UX §9.6). */
  readonly numeroAvvisi = computed(() => this.voci().filter((v) => v.livello !== 'nota').length);

  private dataBreve(data: string): string {
    return `${Number(data.slice(8))} ${testi.mesi[Number(data.slice(5, 7)) - 1]?.slice(0, 3) ?? ''}`;
  }

  /** Allineamento della bozza (ARCHITETTURA §9): note con «Aggiorna», mai in automatico. */
  readonly allineamenti = computed<readonly Allineamento[]>(() => {
    const reparto = this.reparto();
    const chiave = this.chiaveMese();
    const locale = this.calendarioLocale();
    if (!this.modificabile() || reparto === null || chiave === null || locale === null) {
      return [];
    }
    const elenco: Allineamento[] = [];
    const proposto = calendarioMese(chiave, reparto.festivita, reparto.attribuzioneNotte);
    if (!uguali(proposto, locale)) {
      elenco.push({ tipo: 'calendario' });
    }
    const dipendenti = this.dipendentiPerId();
    for (const id of this.ordine()) {
      const d = dipendenti.get(id);
      const riga = this.righe.get(id)?.();
      if (
        d !== undefined &&
        riga !== undefined &&
        !uguali(riga.contratto, {
          oreSettimanali: d.oreSettimanali,
          dataAssunzione: d.dataAssunzione,
          dataCessazione: d.dataCessazione,
        })
      ) {
        elenco.push({ tipo: 'contratto', dipendenteId: id });
      }
    }
    for (const d of dipendentiInServizio(chiave, this.dipendenti())) {
      if (!this.righe.has(d.id)) {
        elenco.push({ tipo: 'dipendente', dipendenteId: d.id });
      }
    }
    return elenco;
  });

  private voceAllineamento(a: Allineamento): VoceAvviso {
    const t = testi.griglia.pannelloAvvisi;
    if (a.tipo === 'calendario') {
      return {
        chiave: 'allinea-calendario',
        livello: 'nota',
        testo: t.calendarioCambiato,
        dettaglio: '',
        cella: null,
        azione: a,
      };
    }
    const d = this.dipendentiPerId().get(a.dipendenteId);
    const nome = d === undefined ? '' : nomeBreve(d.cognome, d.nome);
    if (a.tipo === 'dipendente') {
      return {
        chiave: `allinea-dip-${a.dipendenteId}`,
        livello: 'nota',
        testo: t.dipendenteNuovo(nome),
        dettaglio: nome,
        cella: null,
        azione: a,
      };
    }
    const riga = this.righe.get(a.dipendenteId)?.();
    const ore = riga?.contratto.oreSettimanali;
    const testo =
      d !== undefined && ore !== undefined && ore !== d.oreSettimanali
        ? t.contrattoCambiato(
            nome,
            String(ore).replace('.', ','),
            String(d.oreSettimanali).replace('.', ','),
          )
        : t.periodoCambiato(nome);
    return {
      chiave: `allinea-contratto-${a.dipendenteId}`,
      livello: 'nota',
      testo,
      dettaglio: nome,
      cella: null,
      azione: a,
    };
  }

  applicaAllineamento(a: Allineamento): void {
    const reparto = this.reparto();
    const chiave = this.chiaveMese();
    if (!this.modificabile() || reparto === null || chiave === null) {
      return;
    }
    if (a.tipo === 'calendario') {
      this.calendarioLocale.set(
        calendarioMese(chiave, reparto.festivita, reparto.attribuzioneNotte),
      );
      return;
    }
    const d = this.dipendentiPerId().get(a.dipendenteId);
    if (d === undefined) {
      return;
    }
    const contratto: ContrattoRiga = {
      oreSettimanali: d.oreSettimanali,
      dataAssunzione: d.dataAssunzione,
      dataCessazione: d.dataCessazione,
    };
    if (a.tipo === 'contratto') {
      this.righe.get(a.dipendenteId)?.update((r) => ({ ...r, contratto }));
      return;
    }
    this.righe.set(
      d.id,
      signal<RigaStato>({ dipendenteId: d.id, contratto, giorni: {}, grezzi: {} }),
    );
    this.ordine.set(this.ordinate([...this.ordine(), d.id]));
  }

  // ----------------------------------------------------------------------------------------------
  // Vista
  // ----------------------------------------------------------------------------------------------

  impostaVista(vista: Vista): void {
    const chiave = this.chiaveMese();
    if (chiave === null || vista === this.vista()) {
      return;
    }
    const attiva = this.attiva();
    this.vista.set(vista);
    // Passando a una vista a settimane si apre la settimana della cella attiva (o di oggi, se è nel mese).
    this.settimana.set(
      attiva !== null ? settimanaDelGiorno(chiave, attiva.giorno) : this.settimanaIniziale(chiave),
    );
    const utente = this.sessione.utente();
    if (utente !== null) {
      this.preferenze.imposta(utente.uid, { vistaGriglia: vista });
    }
    this.riallineaSelezione();
  }

  spostaSettimana(direzione: 1 | -1): void {
    const chiave = this.chiaveMese();
    if (chiave === null || this.vista() === 'mese') {
      return;
    }
    this.settimana.set(
      limitaSettimana(
        chiave,
        this.vista(),
        this.settimana() + direzione * passoSettimane(this.vista()),
      ),
    );
    this.riallineaSelezione();
  }

  /** Dopo un cambio di giorni visibili la cella attiva deve restare visibile: se non lo è, passa al primo giorno. */
  private riallineaSelezione(): void {
    const attiva = this.attiva();
    const giorni = this.giorni();
    if (attiva !== null && !giorni.includes(attiva.giorno)) {
      const primo = giorni[0];
      if (primo !== undefined) {
        this.attiva.set({ dipendenteId: attiva.dipendenteId, giorno: primo });
      }
    }
    const ancora = this.ancora();
    if (ancora !== null && !giorni.includes(ancora.giorno)) {
      this.ancora.set(null);
    }
  }

  // ----------------------------------------------------------------------------------------------
  // Selezione
  // ----------------------------------------------------------------------------------------------

  selezionaCella(cella: RiferimentoCella, estendi = false): void {
    if (!estendi || this.ancora() === null) {
      if (estendi) {
        this.ancora.set(this.attiva());
      } else {
        this.ancora.set(null);
      }
    }
    this.attiva.set(cella);
  }

  /** Sposta la cella attiva (frecce, Home, Fine…); con `estendi` l'ancora resta dov'era. */
  spostaAttiva(destinazione: Posizione, estendi: boolean): void {
    const limitata = limita(destinazione, this.ordine().length, this.giorni().length);
    const riferimento = this.riferimentoDi(limitata);
    if (riferimento === null) {
      return;
    }
    this.selezionaCella(riferimento, estendi);
  }

  muovi(dRiga: number, dColonna: number, estendi: boolean): void {
    const corrente = this.posizioneAttiva() ?? { riga: 0, colonna: 0 };
    this.spostaAttiva(
      { riga: corrente.riga + dRiga, colonna: corrente.colonna + dColonna },
      estendi,
    );
  }

  primoGiorno(estendi: boolean): void {
    this.spostaAttiva({ riga: this.posizioneAttiva()?.riga ?? 0, colonna: 0 }, estendi);
  }

  ultimoGiorno(estendi: boolean): void {
    this.spostaAttiva(
      { riga: this.posizioneAttiva()?.riga ?? 0, colonna: this.giorni().length - 1 },
      estendi,
    );
  }

  primaCella(estendi: boolean): void {
    this.spostaAttiva({ riga: 0, colonna: 0 }, estendi);
  }

  ultimaCella(estendi: boolean): void {
    this.spostaAttiva(
      { riga: this.ordine().length - 1, colonna: this.giorni().length - 1 },
      estendi,
    );
  }

  pagina(direzione: 1 | -1, estendi: boolean): void {
    this.muovi(direzione * NUMERO_RIGHE_PER_PAGINA, 0, estendi);
  }

  /** Vero se `Tab` può spostare la cella attiva: sull'ultima (o sulla prima con Maiusc) la griglia si lascia. */
  tab(indietro: boolean): boolean {
    const corrente = this.posizioneAttiva();
    if (corrente === null) {
      return false;
    }
    const ultimaColonna = this.giorni().length - 1;
    const ultimaRiga = this.ordine().length - 1;
    if (indietro) {
      if (corrente.riga === 0 && corrente.colonna === 0) {
        return false;
      }
      this.spostaAttiva(
        corrente.colonna === 0
          ? { riga: corrente.riga - 1, colonna: ultimaColonna }
          : { riga: corrente.riga, colonna: corrente.colonna - 1 },
        false,
      );
      return true;
    }
    if (corrente.riga === ultimaRiga && corrente.colonna === ultimaColonna) {
      return false;
    }
    this.spostaAttiva(
      corrente.colonna === ultimaColonna
        ? { riga: corrente.riga + 1, colonna: 0 }
        : { riga: corrente.riga, colonna: corrente.colonna + 1 },
      false,
    );
    return true;
  }

  selezionaRiga(): void {
    const attiva = this.posizioneAttiva();
    if (attiva === null) {
      return;
    }
    const r = rigaIntera(attiva.riga, this.giorni().length);
    this.ancora.set(this.riferimentoDi({ riga: r.rigaDa, colonna: r.colonnaDa }));
    this.attiva.set(this.riferimentoDi({ riga: r.rigaA, colonna: r.colonnaA }));
  }

  selezionaColonna(): void {
    const attiva = this.posizioneAttiva();
    if (attiva === null) {
      return;
    }
    const r = colonnaIntera(attiva.colonna, this.ordine().length);
    this.ancora.set(this.riferimentoDi({ riga: r.rigaDa, colonna: r.colonnaDa }));
    this.attiva.set(this.riferimentoDi({ riga: r.rigaA, colonna: r.colonnaA }));
  }

  /** Ripiega l'intervallo sulla cella attiva; vero se c'era un intervallo da ridurre. */
  riduciSelezione(): boolean {
    if (this.celleSelezionate() > 1) {
      this.ancora.set(null);
      return true;
    }
    return false;
  }

  /** Il rettangolo di celle tra due celle (trascinamento): imposta ancora e attiva. */
  selezionaRettangolo(da: RiferimentoCella, a: RiferimentoCella): void {
    this.ancora.set(da);
    this.attiva.set(a);
  }

  // ----------------------------------------------------------------------------------------------
  // Modifica delle celle
  // ----------------------------------------------------------------------------------------------

  private cellaCorrente(id: string, giorno: ChiaveGiorno): CellaDoc | null {
    return this.righe.get(id)?.().giorni[giorno] ?? null;
  }

  /**
   * La cella cambia rispetto a ora? Una cella «grezza» (dato non valido già salvato) non è mai uguale a una
   * vuota: scriverci sopra, anche una cella vuota, la toglie dal documento.
   */
  private cambia(
    id: string,
    giorno: ChiaveGiorno,
    prima: CellaDoc | null,
    dopo: CellaDoc | null,
  ): boolean {
    return this.righe.get(id)?.().grezzi[giorno] !== undefined || !celleUguali(prima, dopo);
  }

  private contestoDi(id: string, giorno: ChiaveGiorno) {
    const riga = this.righe.get(id)?.();
    const chiave = this.chiaveMese();
    const data = chiave === null ? null : dataDelGiorno(chiave, giorno);
    return {
      turniEsclusi: this.dipendentiPerId().get(id)?.turniEsclusi ?? [],
      inServizio: riga !== undefined && data !== null && inServizioIl(riga.contratto, data),
      contratto: riga?.contratto ?? null,
    };
  }

  private posizioniDelRettangolo(r: Rettangolo | null): RiferimentoCella[] {
    return r === null
      ? []
      : posizioniDi(r)
          .map((p) => this.riferimentoDi(p))
          .filter((c): c is RiferimentoCella => c !== null);
  }

  /** Le celle su cui agiscono pennello, svuota e menu: l'intervallo selezionato. */
  celleDellIntervallo(): RiferimentoCella[] {
    return this.posizioniDelRettangolo(this.intervallo());
  }

  /** Scrive le celle nelle righe locali. Non registra nella cronologia. */
  private scrivi(modifiche: Passo, verso: 'dopo' | 'prima'): void {
    const perRiga = new Map<string, ModificaCella[]>();
    for (const m of modifiche) {
      perRiga.set(m.dipendenteId, [...(perRiga.get(m.dipendenteId) ?? []), m]);
    }
    for (const [id, elenco] of perRiga) {
      this.righe.get(id)?.update((riga) => {
        let giorni = riga.giorni;
        const grezzi: Record<string, unknown> = { ...riga.grezzi };
        for (const m of elenco) {
          giorni = impostaCella(
            giorni,
            m.giorno,
            (verso === 'dopo' ? m.dopo : m.prima) ?? cellaVuota(),
          );
          delete grezzi[m.giorno];
        }
        return { ...riga, giorni, grezzi };
      });
    }
  }

  private registra(passo: Passo): void {
    if (passo.length === 0) {
      return;
    }
    this.cronologia.registra(passo);
    this.versioneCronologia.update((v) => v + 1);
  }

  /**
   * Applica un'operazione a un elenco di celle come un solo passo di annulla (UX §9.3). `esegui` dice, per
   * ogni cella, la cella nuova o il motivo del rifiuto. Le celle che non cambiano non contano.
   */
  private applicaACelle(
    celle: readonly RiferimentoCella[],
    esegui: (
      cella: CellaDoc | null,
      c: RiferimentoCella,
    ) => { cella: CellaDoc } | { motivo: MotivoRifiuto; codice: string },
  ): { applicate: number; saltate: NotaCellaSaltata[] } {
    const passo: ModificaCella[] = [];
    const saltate: NotaCellaSaltata[] = [];
    const chiave = this.chiaveMese();
    for (const c of celle) {
      const prima = this.cellaCorrente(c.dipendenteId, c.giorno);
      const esito = esegui(prima, c);
      if ('motivo' in esito) {
        const data = chiave === null ? null : dataDelGiorno(chiave, c.giorno);
        if (data !== null) {
          saltate.push({
            livello: 'nota',
            codice: 'cellaSaltata',
            giorno: data,
            dipendenteId: c.dipendenteId,
            motivo: esito.motivo,
            codiceInserito: esito.codice === '' ? null : esito.codice,
          });
        }
        continue;
      }
      if (this.cambia(c.dipendenteId, c.giorno, prima, esito.cella)) {
        passo.push({ dipendenteId: c.dipendenteId, giorno: c.giorno, prima, dopo: esito.cella });
      }
    }
    this.scrivi(passo, 'dopo');
    this.registra(passo);
    return { applicate: passo.length, saltate };
  }

  private esitoPerRifiutoMultiplo(applicate: number, saltate: NotaCellaSaltata[]): void {
    this.noteSaltate.set(saltate);
    if (applicate === 0 && saltate.length === 0) {
      return;
    }
    const testo =
      applicate === 0
        ? testi.griglia.esiti.nessunaCella(saltate.length)
        : testi.griglia.esiti.applicato(applicate, saltate.length);
    if (saltate.length > 0) {
      this.toast.info(testo, {
        etichetta: testi.griglia.esiti.dettagli,
        esegui: () => this.pannello.set('avvisi'),
      });
    } else {
      this.toast.info(testo);
    }
  }

  /** Applica un codice (testo digitato o scelto) alle celle; un rifiuto su più celle diventa una nota. */
  private applicaCodice(
    testo: string,
    celle: readonly RiferimentoCella[],
  ): { applicate: number; saltate: NotaCellaSaltata[] } {
    return this.applicaACelle(celle, (cella, c) => {
      const contesto = this.contestoDi(c.dipendenteId, c.giorno);
      const esito = interpretaInserimento(testo, cella, {
        configurazione: this.configurazione(),
        turniEsclusi: contesto.turniEsclusi,
        inServizio: contesto.inServizio,
      });
      return esito.esito === 'applicata'
        ? { cella: esito.cella }
        : { motivo: esito.motivo, codice: esito.codice };
    });
  }

  private applicaOperazione(
    assegnazione: Assegnazione,
    celle: readonly RiferimentoCella[],
  ): { applicate: number; saltate: NotaCellaSaltata[] } {
    return this.applicaACelle(celle, (cella, c) => {
      const contesto = this.contestoDi(c.dipendenteId, c.giorno);
      const esito = applicaAssegnazione(cella, assegnazione, contesto);
      return esito.esito === 'applicata'
        ? { cella: esito.cella }
        : { motivo: esito.motivo, codice: '' };
    });
  }

  /** Impedisce ogni modifica a un mese in sola lettura, dicendo perché. */
  private puoModificare(): boolean {
    if (this.modificabile()) {
      return true;
    }
    if (this.convalidato()) {
      this.toast.info(testi.griglia.sola.soloLetturaToast);
    }
    return false;
  }

  // -- inserimento veloce ------------------------------------------------------------------------

  avviaInserimento(iniziale: string): boolean {
    const attiva = this.attiva();
    if (attiva === null || !this.puoModificare()) {
      return false;
    }
    this.messaggioInserimento.set(null);
    this.inserimento.set({ cella: attiva, iniziale });
    return true;
  }

  annullaInserimento(): void {
    this.inserimento.set(null);
    this.messaggioInserimento.set(null);
  }

  /**
   * Conferma il testo digitato (UX §9.2). Un codice non ammesso lascia la cella in inserimento con il motivo;
   * `suTutto` (Ctrl+Invio) lo applica a tutto l'intervallo selezionato.
   */
  confermaInserimento(testo: string, suTutto: boolean): EsitoInserimentoVeloce {
    const corrente = this.inserimento();
    if (corrente === null) {
      return { ok: true, messaggio: null };
    }
    if (testo.trim() === '') {
      this.annullaInserimento();
      return { ok: true, messaggio: null };
    }
    if (suTutto && this.celleSelezionate() > 1) {
      const { applicate, saltate } = this.applicaCodice(testo, this.celleDellIntervallo());
      this.esitoPerRifiutoMultiplo(applicate, saltate);
      this.annullaInserimento();
      return { ok: true, messaggio: null };
    }
    const cella = corrente.cella;
    const esito = interpretaInserimento(
      testo,
      this.cellaCorrente(cella.dipendenteId, cella.giorno),
      {
        configurazione: this.configurazione(),
        ...this.contestoDi(cella.dipendenteId, cella.giorno),
      },
    );
    if (esito.esito === 'rifiutata') {
      const messaggio = testoMotivo(
        esito.motivo,
        esito.codice,
        this.nomeDi(cella.dipendenteId).breve,
        this.righe.get(cella.dipendenteId)?.().contratto ?? null,
      );
      this.messaggioInserimento.set(messaggio);
      return { ok: false, messaggio };
    }
    const prima = this.cellaCorrente(cella.dipendenteId, cella.giorno);
    if (this.cambia(cella.dipendenteId, cella.giorno, prima, esito.cella)) {
      const passo: Passo = [
        { dipendenteId: cella.dipendenteId, giorno: cella.giorno, prima, dopo: esito.cella },
      ];
      this.scrivi(passo, 'dopo');
      this.registra(passo);
    }
    this.annullaInserimento();
    return { ok: true, messaggio: null };
  }

  // -- pennello, menu, svuota ----------------------------------------------------------------------

  scegliPennello(pennello: Pennello | null): void {
    if (pennello !== null && !this.puoModificare()) {
      return;
    }
    this.pennello.set(pennello);
  }

  /** Applica il pennello alle celle del rettangolo come un solo passo di annulla. */
  applicaPennelloA(celle: readonly RiferimentoCella[]): void {
    const pennello = this.pennello();
    if (pennello === null || !this.puoModificare()) {
      return;
    }
    const esito =
      pennello.tipo === 'gomma'
        ? this.applicaOperazione({ tipo: 'gomma' }, celle)
        : this.applicaCodice(pennello.codice, celle);
    this.esitoPerRifiutoMultiplo(esito.applicate, esito.saltate);
  }

  applicaPennelloAllaSelezione(): void {
    this.applicaPennelloA(this.celleDellIntervallo());
  }

  svuota(): void {
    if (!this.puoModificare()) {
      return;
    }
    const esito = this.applicaOperazione({ tipo: 'gomma' }, this.celleDellIntervallo());
    this.esitoPerRifiutoMultiplo(esito.applicate, esito.saltate);
  }

  /** Una voce del menu: turni, assenze, fasce e «Svuota» valgono per l'intervallo; le voci «In questa cella» per la cella attiva. */
  scegliDalMenu(voce: VoceScelta): void {
    if (!this.puoModificare()) {
      return;
    }
    const attiva = this.attiva();
    switch (voce.tipo) {
      case 'codice': {
        const { applicate, saltate } = this.applicaCodice(voce.codice, this.celleDellIntervallo());
        this.esitoPerRifiutoMultiplo(applicate, saltate);
        return;
      }
      case 'gomma':
        this.svuota();
        return;
      case 'eliminaTurnoScoperto':
      case 'rimuovi': {
        if (attiva === null) {
          return;
        }
        if (voce.tipo === 'rimuovi' && !eCodiceTurno(voce.codice)) {
          return;
        }
        const assegnazione: Assegnazione =
          voce.tipo === 'rimuovi' && eCodiceTurno(voce.codice)
            ? { tipo: 'rimuoviReperibilita', codice: voce.codice }
            : { tipo: 'eliminaTurnoScoperto' };
        const { applicate, saltate } = this.applicaOperazione(assegnazione, [attiva]);
        this.esitoPerRifiutoMultiplo(applicate, saltate);
        return;
      }
    }
  }

  // -- copia e incolla -------------------------------------------------------------------------

  /** Il testo da mettere negli appunti per l'intervallo selezionato; ricorda il blocco per l'incolla interna. */
  copia(): string | null {
    const r = this.intervallo();
    if (r === null) {
      return null;
    }
    const celle: (CellaDoc | null)[][] = [];
    for (let riga = r.rigaDa; riga <= r.rigaA; riga++) {
      const linea: (CellaDoc | null)[] = [];
      for (let colonna = r.colonnaDa; colonna <= r.colonnaA; colonna++) {
        const rif = this.riferimentoDi({ riga, colonna });
        linea.push(rif === null ? null : this.cellaCorrente(rif.dipendenteId, rif.giorno));
      }
      celle.push(linea);
    }
    const blocco = bloccoDaCelle(celle);
    const testo = testoPerAppunti(blocco);
    this.ultimaCopia = { testo, blocco };
    return testo;
  }

  /** Incolla con la cella attiva come angolo in alto a sinistra (UX §9.4); un solo passo di annulla. */
  incolla(testoAppunti: string): void {
    const chiave = this.chiaveMese();
    const attiva = this.posizioneAttiva();
    if (chiave === null || attiva === null || !this.puoModificare()) {
      return;
    }
    const blocco =
      this.ultimaCopia !== null && stessoTesto(this.ultimaCopia.testo, testoAppunti)
        ? this.ultimaCopia.blocco
        : bloccoDaTesto(testoAppunti);
    const destinazioni = this.ordine()
      .slice(attiva.riga)
      .map((id) => {
        const riga = this.righe.get(id)?.();
        return riga === undefined
          ? null
          : {
              dipendenteId: id,
              turniEsclusi: this.dipendentiPerId().get(id)?.turniEsclusi ?? [],
              contratto: riga.contratto,
              giorni: riga.giorni,
            };
      })
      .filter((r) => r !== null);
    const giornoIniziale = this.attiva()?.giorno;
    if (giornoIniziale === undefined) {
      return;
    }
    const esito = incollaIntervallo({
      chiaveMese: chiave,
      giornoIniziale,
      blocco,
      righe: destinazioni,
      configurazione: this.configurazione(),
    });
    const passo: ModificaCella[] = [];
    for (const applicata of esito.applicate) {
      const prima = this.cellaCorrente(applicata.dipendenteId, applicata.giorno);
      if (this.cambia(applicata.dipendenteId, applicata.giorno, prima, applicata.cella)) {
        passo.push({
          dipendenteId: applicata.dipendenteId,
          giorno: applicata.giorno,
          prima,
          dopo: applicata.cella,
        });
      }
    }
    this.scrivi(passo, 'dopo');
    this.registra(passo);
    const saltate: NotaCellaSaltata[] = [];
    for (const s of esito.saltate) {
      const data = dataDelGiorno(chiave, s.giorno);
      if (data !== null) {
        saltate.push({
          livello: 'nota',
          codice: 'cellaSaltata',
          giorno: data,
          dipendenteId: s.dipendenteId,
          motivo: s.motivo,
          codiceInserito: s.codice,
        });
      }
    }
    this.esitoPerRifiutoMultiplo(passo.length, saltate);
  }

  // -- annulla e ripristina ------------------------------------------------------------------------

  annulla(): void {
    if (!this.puoModificare()) {
      return;
    }
    const passo = this.cronologia.annulla();
    if (passo !== null) {
      this.scrivi(passo, 'prima');
      this.versioneCronologia.update((v) => v + 1);
    }
  }

  ripristina(): void {
    if (!this.puoModificare()) {
      return;
    }
    const passo = this.cronologia.ripristina();
    if (passo !== null) {
      this.scrivi(passo, 'dopo');
      this.versioneCronologia.update((v) => v + 1);
    }
  }

  /** Che cosa mostra il menu di una cella (UX §9.5): le opzioni ammesse per quel dipendente. */
  datiPerMenu(cella: RiferimentoCella): {
    readonly titolo: string;
    readonly opzioni: OpzioniCella;
    readonly cella: CellaDoc | null;
    readonly colori: ReadonlyMap<string, IdColoreTurno | null>;
  } | null {
    const chiave = this.chiaveMese();
    const riga = this.righe.get(cella.dipendenteId)?.();
    const data = chiave === null ? null : dataDelGiorno(chiave, cella.giorno);
    if (riga === undefined || data === null) {
      return null;
    }
    const contenuto = riga.giorni[cella.giorno] ?? null;
    return {
      titolo: testi.griglia.menu.etichetta(
        this.nomeDi(cella.dipendenteId).breve,
        formattaGiornoCompleto(data),
      ),
      opzioni: opzioniCella(
        this.configurazione(),
        this.dipendentiPerId().get(cella.dipendenteId)?.turniEsclusi ?? [],
        contenuto,
      ),
      cella: contenuto,
      colori: new Map(this.turni().map((t) => [t.codice, t.colore])),
    };
  }

  // ----------------------------------------------------------------------------------------------
  // Salva bozza
  // ----------------------------------------------------------------------------------------------

  /** I blocchi di `validaRiga()` sulle righe toccate e, se non ce ne sono, di `validaMese()` su tutto il mese. */
  private bloccoDiValidazione(): boolean {
    const chiave = this.chiaveMese();
    if (chiave === null) {
      return false;
    }
    const toccate = this.righeModificate().map((id) => {
      const r = this.righe.get(id)?.();
      return { dipendenteId: id, contratto: r?.contratto, giorni: { ...r?.grezzi, ...r?.giorni } };
    });
    const bloccate = toccate.some(
      (riga) => soloBlocchi(validaRiga(riga, { chiaveMese: chiave })).length > 0,
    );
    if (bloccate) {
      return true;
    }
    const righeDelMese = this.ordine().map((id) => ({
      dipendenteId: id,
      giorni: this.righe.get(id)?.().giorni ?? {},
    }));
    return soloBlocchi(validaMese(righeDelMese)).length > 0;
  }

  /** «Salva bozza»: una transazione sulle sole righe toccate (ARCHITETTURA §9). Restituisce se ha salvato. */
  async salva(): Promise<boolean> {
    const utente = this.sessione.utente();
    const chiave = this.chiaveMese();
    if (
      utente === null ||
      chiave === null ||
      !this.modificabile() ||
      this.salvataggio() === 'inCorso' ||
      this.modifiche() === 0 ||
      !this.connessione.connesso()
    ) {
      return false;
    }
    if (this.bloccoDiValidazione()) {
      this.pannello.set('avvisi');
      this.toast.errore(testi.griglia.salvataggio.bloccoPrima);
      return false;
    }
    const baseline = this.baseline();
    const daSalvare: RigaDaSalvare[] = this.righeModificate().flatMap((id) => {
      const riga = this.righe.get(id)?.();
      return riga === undefined
        ? []
        : [
            {
              dipendenteId: id,
              contratto: riga.contratto,
              giorni: riga.giorni,
              grezzi: riga.grezzi,
              versioneCaricata: baseline.get(id)?.versione ?? null,
            },
          ];
    });
    const calendario = this.calendarioDiverso() ? this.calendarioLocale() : null;
    const numeroModifiche = this.modifiche();
    // Se nel frattempo si apre un altro mese, l'esito riguarda solo il mese salvato (cache), non lo stato aperto.
    const caricamento = this.caricamentoCorrente;
    this.salvataggio.set('inCorso');
    try {
      const versioni = await this.righeRepo.salva({
        repartoId: this.repartoId(),
        uid: utente.uid,
        chiave,
        righe: daSalvare,
        calendario,
      });
      const nuova = new Map(baseline);
      for (const riga of daSalvare) {
        const versione = versioni.get(riga.dipendenteId);
        if (versione !== undefined) {
          nuova.set(riga.dipendenteId, {
            dipendenteId: riga.dipendenteId,
            contratto: riga.contratto,
            giorni: riga.giorni,
            grezzi: riga.grezzi,
            versione,
          });
        }
      }
      this.cacheRighe.set(chiave, [...nuova.values()]);
      if (caricamento !== this.caricamentoCorrente) {
        return true;
      }
      this.baseline.set(nuova);
      const mese = this.mese();
      if (mese !== null && calendario !== null) {
        this.mese.set({ ...mese, calendario });
      }
      this.salvataggio.set('riposo');
      this.ultimoSalvataggio.set(formattaOraDaMs(adessoMs()));
      return true;
    } catch (errore) {
      if (caricamento !== this.caricamentoCorrente) {
        return false;
      }
      await this.gestisciErroreSalvataggio(errore, numeroModifiche);
      return false;
    }
  }

  private async gestisciErroreSalvataggio(errore: unknown, modifiche: number): Promise<void> {
    if (errore instanceof ErroreSalvataggio) {
      if (errore.codice === 'CONFLITTO_VERSIONE') {
        this.salvataggio.set('riposo');
        const ricarica = await this.dialoghi.conferma({
          titolo: testi.griglia.salvataggio.conflittoTitolo,
          messaggio: testi.griglia.salvataggio.conflitto(modifiche),
          etichettaConferma: testi.griglia.salvataggio.ricarica,
          etichettaAnnulla: testi.griglia.annulla,
          pericolo: true,
        });
        if (ricarica) {
          await this.ricarica();
        }
        return;
      }
      if (errore.codice === 'MESE_CONVALIDATO') {
        this.salvataggio.set('riposo');
        this.toast.errore(testi.griglia.salvataggio.convalidato);
        await this.ricarica();
        return;
      }
      if (errore.codice === 'MESE_ASSENTE') {
        // Riprovare non serve: si rilegge il mese e la pagina mostra lo stato «mese non creato».
        this.salvataggio.set('riposo');
        this.toast.errore(testi.griglia.salvataggio.meseAssente);
        await this.ricarica();
        return;
      }
    }
    // Rete o altro: le modifiche locali restano, la fascia dice di riprovare.
    this.salvataggio.set('errore');
  }

  /** Spostamento alla cella di una voce del pannello (anche in un'altra settimana). */
  vaiAllaCella(cella: RiferimentoCella): void {
    const chiave = this.chiaveMese();
    if (chiave === null) {
      return;
    }
    if (!this.giorni().includes(cella.giorno) && this.vista() !== 'mese') {
      this.settimana.set(settimanaDelGiorno(chiave, cella.giorno));
    }
    this.selezionaCella(cella);
  }

  /** Mese precedente o successivo nell'URL. */
  meseAdiacente(direzione: 1 | -1): ChiaveMese | null {
    const chiave = this.chiaveMese();
    return chiave === null ? null : spostaMese(chiave, direzione);
  }

  /** Etichetta del mese per i testi. */
  readonly meseEtichetta = computed(() => {
    const chiave = this.chiaveMese();
    return chiave === null ? '' : formattaMese(chiave);
  });
}
