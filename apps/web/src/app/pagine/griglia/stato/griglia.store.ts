// Stato della schermata «Pianificazione mese» (UX §9, D1): righe salvate e locali, selezione, pennello,
// cronologia, inserimento veloce, avvisi dal dominio e «Salva bozza». Un'istanza per pagina (si fornisce nel
// componente). Una modifica tocca solo il signal della riga: gli avvisi, i totali e le celle di ogni riga
// sono `computed` che dipendono dalla sola riga e dalla configurazione condivisa (PIANO 2.2 criterio 10).
import {
  computed,
  effect,
  inject,
  Injectable,
  signal,
  untracked,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import {
  adessoMs,
  aggregaStoricoFestivita,
  classificaSostituti,
  eOraLocale,
  formattaOreCompatte,
  formattaSaldoOre,
  MESI_STORICO_SOSTITUTI,
  oggettoScoperto,
  validaModifica,
  variazioneOrario,
  applicaAssegnazione,
  avvisiRiga,
  durataReale,
  impostaChiamata,
  intervalloStoricoFestivita,
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
  type Chiamata,
  type ChiaveGiorno,
  type ChiaveMese,
  type CodiceTurno,
  type ConfigurazioneGriglia,
  type ContestoModifica,
  type ContrattoRiga,
  type DataISO,
  type MotivoBloccoModifica,
  type ModificaConsuntivo,
  type Minuti,
  type OggettoSostituzione,
  type OrarioReale,
  type RigaConsuntivo,
  type RigheAdiacentiDipendente,
  type RiepilogoPerClassifica,
  type IdColoreTurno,
  type OpzioniCella,
  type MotivoRifiuto,
  type MotivoRifiutoChiamata,
  type NotaCellaSaltata,
  type Segnalazione,
  type StoricoFestivita,
} from '@turni/domain';
import { DATA_OGGI, FINESTRA_MESI_MODIFICABILI } from '../../../core/ambiente';
import { Connessione } from '../../../core/connessione.service';
import { codiceErroreFunzione, righeDaErroreFunzione } from '../../../core/errori';
import { Preferenze } from '../../../core/preferenze.service';
import { Sessione } from '../../../core/sessione.service';
import { AssenzeRepo, type AssenzaSalvata } from '../../../dati/assenze.repo';
import { BancaOreRepo } from '../../../dati/banca-ore.repo';
import { DipendentiRepo, type DipendenteSalvato } from '../../../dati/dipendenti.repo';
import { MesiRepo, type MeseSalvato } from '../../../dati/mesi.repo';
import { RepartiRepo, type RepartoConfigurazione } from '../../../dati/reparti.repo';
import { RiepiloghiRepo } from '../../../dati/riepiloghi.repo';
import {
  ErroreSalvataggio,
  RigheRepo,
  type RigaDaSalvare,
  type RigaSalvata,
} from '../../../dati/righe.repo';
import { TurniRepo, type TurnoSalvato } from '../../../dati/turni.repo';
import { FunzioniMesi } from '../../../funzioni/mesi';
import { testi } from '../../../testi/it';
import { testiGriglia } from '../../../testi/it-griglia';
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
  giornoBreve,
  testoMotivo,
  testoNonDisponibile,
  reperibilitaOrdinate,
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
  settimaneDelMese,
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
  | { readonly tipo: 'rimuovi'; readonly codice: string }
  | { readonly tipo: 'dettaglio' }
  | { readonly tipo: 'dettaglioTurno' }
  | { readonly tipo: 'trovaSostituto'; readonly oggetto: OggettoSostituzione }
  | { readonly tipo: 'rimuoviSostituzione'; readonly oggetto: OggettoSostituzione };

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
  /** La settimana del candidato su cui si passa nel pannello «Trova sostituto», in indici dei giorni visibili. */
  readonly evidenza: { readonly da: number; readonly a: number } | null;
}

function stessoStatoRiga(a: StatoRiga, b: StatoRiga): boolean {
  return (
    a.giornoAttivo === b.giornoAttivo &&
    a.inserimento?.giorno === b.inserimento?.giorno &&
    a.inserimento?.iniziale === b.inserimento?.iniziale &&
    a.evidenza?.da === b.evidenza?.da &&
    a.evidenza?.a === b.evidenza?.a &&
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
  /** Il codice della segnalazione del dominio (o `cellaSaltata`, `allineamento`, `rigaServer`): per raggruppare. */
  readonly codice: string;
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

/** Una reperibilità della cella aperta nel pannello «Dettaglio reperibilità» (UX §9.11). */
export interface DettaglioReperibilita {
  readonly codice: CodiceTurno;
  readonly nome: string;
  readonly inizio: string;
  readonly fine: string;
  /** Durata massima della chiamata: la durata reale della fascia nel giorno (cambio d'ora compreso). */
  readonly durataMassima: number;
  readonly chiamata: Chiamata | null;
  /** Coperta da un collega: la chiamata non è di questo dipendente. */
  readonly coperta: boolean;
}

export interface DatiDettaglio {
  /** «Rossi M. · martedì 3 novembre». */
  readonly titolo: string;
  readonly cella: RiferimentoCella;
  readonly reperibilita: readonly DettaglioReperibilita[];
}

/** Una chiamata da applicare (o da togliere) a una reperibilità della cella. */
export interface ModificaChiamata {
  readonly codice: CodiceTurno;
  readonly chiamata: Chiamata | null;
}

/** Il turno della cella aperta nel pannello «Dettaglio turno» (UX §9.11). */
export interface DatiTurno {
  /** «Rossi M. · martedì 3 novembre». */
  readonly titolo: string;
  readonly cella: RiferimentoCella;
  readonly data: DataISO;
  readonly codice: CodiceTurno;
  readonly nome: string;
  readonly inizio: string;
  readonly fine: string;
  readonly pausaMinuti: number;
  readonly notturno: boolean;
  readonly orarioReale: OrarioReale | null;
  /** Svolto: l'orario reale si può registrare; scoperto o coperto: solo lettura. */
  readonly stato: 'svolto' | 'scoperto' | 'coperto';
  /** Nomi brevi dei colleghi della sostituzione, se ci sono. */
  readonly sostituisce: string | null;
  readonly copertoDa: string | null;
}

/** Il risultato di una modifica di consuntivo: applicata, oppure il motivo del blocco già in italiano. */
export type EsitoApplicazione =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly motivo: MotivoBloccoModifica | 'nonModificabile';
      readonly testo: string;
    };

/** Un collega disponibile nella classifica, pronto da mostrare (UX §9.11). */
export interface VoceDisponibile {
  readonly id: string;
  readonly nome: string;
  readonly volte: number;
  /** «+12,0» (ore), null se il saldo non è noto. */
  readonly saldo: string | null;
  readonly saldoNegativo: boolean;
  readonly reperibile: boolean;
  /** Frasi sul riposo sotto le 11 ore («Riposo di 8 ore prima del turno»); vuoto se il riposo c'è. */
  readonly riposo: readonly string[];
}

export interface VoceNonDisponibile {
  readonly id: string;
  readonly nome: string;
  readonly motivo: string;
}

/** Lo stato del pannello «Trova sostituto»: lo storico e i saldi si leggono solo quando lo si apre. */
export type DatiSostituti =
  | { readonly stato: 'caricamento' | 'errore' | 'nonScoperto'; readonly titolo: string }
  | {
      readonly stato: 'pronto';
      readonly titolo: string;
      readonly disponibili: readonly VoceDisponibile[];
      readonly nonDisponibili: readonly VoceNonDisponibile[];
    };

interface StatoSostituti {
  readonly cella: RiferimentoCella;
  readonly oggetto: OggettoSostituzione;
  readonly stato: 'caricamento' | 'errore' | 'pronto';
  readonly storico: readonly RiepilogoPerClassifica[];
  readonly saldi: Readonly<Record<string, Minuti>>;
}

/** Stato dello storico di una festività per l'anno del mese aperto (UX §9.10). */
export type StatoStorico =
  | { readonly stato: 'caricamento' }
  | { readonly stato: 'errore' }
  | { readonly stato: 'pronto'; readonly storico: StoricoFestivita };

/** Lo storico pronto da mostrare: i nomi sono quelli dell'anagrafica, gli ID non lasciano il browser. */
export interface DatiStoricoVista {
  readonly stato: 'caricamento' | 'errore' | 'pronto';
  readonly anni: readonly {
    readonly anno: number;
    readonly voci: readonly { readonly nome: string; readonly codice: string }[];
  }[];
}

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
  private readonly riepiloghiRepo = inject(RiepiloghiRepo);
  private readonly bancaOreRepo = inject(BancaOreRepo);
  private readonly funzioniMesi = inject(FunzioniMesi);
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
  /** Il pannello laterale aperto (uno alla volta, UX §7.6): Avvisi o Dettaglio reperibilità. */
  readonly pannello = signal<'avvisi' | 'dettaglio' | 'turno' | 'sostituti' | null>(null);
  /** La cella di cui il pannello Dettaglio mostra le reperibilità. */
  readonly cellaDettaglio = signal<RiferimentoCella | null>(null);
  /** La cella di cui il pannello «Dettaglio turno» mostra l'orario. */
  readonly cellaTurno = signal<RiferimentoCella | null>(null);
  /** «Trova sostituto» aperto: la cella scoperta e, a mano a mano, storico e saldi (letti solo su richiesta). */
  private readonly sostitutiAperti = signal<StatoSostituti | null>(null);
  private richiestaSostituti = 0;
  /** Il collega su cui si passa nella classifica: la sua settimana si evidenzia nella griglia. */
  readonly candidatoEvidenziato = signal<string | null>(null);
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
      return testiGriglia.motivoSalva.meseConvalidato;
    }
    if (this.salvataggio() === 'inCorso') {
      return testiGriglia.motivoSalva.inCorso;
    }
    if (!this.connessione.connesso()) {
      return testiGriglia.motivoSalva.connessioneAssente;
    }
    return this.modifiche() === 0 ? testiGriglia.motivoSalva.nessunaModifica : null;
  });

  /** La convalida è in corso: i pulsanti restano fermi finché la callable non risponde. */
  readonly convalidaInCorso = signal(false);
  /** Righe che il server ha trovato non valide o incoerenti all'ultimo tentativo di convalida (ID, mai nomi). */
  readonly righeNonValideDalServer = signal<readonly string[]>([]);

  /**
   * Perché «Convalida mese» è disabilitato (UX §9.8), o null se si può convalidare: mese in bozza, nessuna
   * modifica non salvata, mese concluso (L5), nessuna operazione in corso, connessione presente.
   */
  readonly motivoConvalidaDisabilitata = computed<string | null>(() => {
    const chiave = this.chiaveMese();
    if (this.convalidato()) {
      return testiGriglia.motivoConvalida.meseConvalidato;
    }
    if (this.modifiche() > 0) {
      return testiGriglia.motivoConvalida.modificheNonSalvate;
    }
    if (this.salvataggio() === 'inCorso' || this.convalidaInCorso()) {
      return testiGriglia.motivoConvalida.inCorso;
    }
    if (chiave !== null && !convalidaConsentita(chiave, this.oggi())) {
      return testiGriglia.motivoConvalida.daQuando(formattaData(primoGiornoConvalida(chiave)));
    }
    return this.connessione.connesso() ? null : testiGriglia.motivoConvalida.connessioneAssente;
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
    // Con la colonna di un festivo attiva servono i conteggi dello storico (U6): si leggono una volta per sessione.
    effect(() => {
      const festa = this.festivitaAttiva();
      if (festa !== null) {
        untracked(() => void this.caricaStorico(festa.id));
      }
    });
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
    // «Salvato alle …» riguarda il mese salvato: cambiando mese o reparto non va ripetuto (audit 4.4, M8).
    if (this.chiaveMese() !== chiave || this.repartoId() !== repartoId) {
      this.ultimoSalvataggio.set(null);
    }
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
        this.statiStorico.set(new Map());
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
    this.cellaDettaglio.set(null);
    this.cellaTurno.set(null);
    this.sostitutiAperti.set(null);
    this.candidatoEvidenziato.set(null);
    this.richiestaSostituti += 1;
    this.righeNonValideDalServer.set([]);
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
      this.toast.errore(testiGriglia.aggiungiMeseDialogo.errore);
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
      ? { breve: testi.dipendenteRimosso, completo: testi.dipendenteRimosso }
      : { breve: nomeBreve(d.cognome, d.nome), completo: `${d.cognome} ${d.nome}` };
  }

  /** Le mappe dei giorni delle righe dello stesso dipendente nel mese prima e dopo (riposo a cavallo di mese). */
  private righeAdiacentiDi(id: string): {
    readonly precedente: Readonly<Record<string, unknown>> | null;
    readonly successiva: Readonly<Record<string, unknown>> | null;
  } {
    const { precedente, successivo } = this.adiacenti();
    const giorniDi = (mappa: ReadonlyMap<string, RigaSalvata> | null) => {
      const salvata = mappa?.get(id);
      return salvata === undefined ? null : { ...salvata.grezzi, ...salvata.giorni };
    };
    return { precedente: giorniDi(precedente), successiva: giorniDi(successivo) };
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
      return avvisiRiga(
        { dipendenteId: id, contratto: r.contratto, giorni: { ...r.grezzi, ...r.giorni } },
        {
          chiaveMese: chiave,
          turniEsclusi: this.dipendentiPerId().get(id)?.turniEsclusi ?? [],
          righeAdiacenti: this.righeAdiacentiDi(id),
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
                nomeDi: (altro) => this.nomeDi(altro).breve,
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
        const evidenza = this.evidenzaSettimana();
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
          evidenza: evidenza?.dipendenteId === id ? { da: evidenza.da, a: evidenza.a } : null,
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
          codice: s.codice,
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
        codice: nota.codice,
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
    for (const id of this.righeNonValideDalServer()) {
      voci.push({
        chiave: `server-${id}`,
        codice: 'rigaServer',
        livello: 'blocco',
        testo: testiGriglia.convalidaDialogo.rigaDaCorreggereTesto,
        dettaglio: this.nomeDi(id).breve,
        cella: null,
        azione: null,
      });
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
    const t = testiGriglia.pannelloAvvisi;
    if (a.tipo === 'calendario') {
      return {
        chiave: 'allinea-calendario',
        codice: 'allineamento',
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
        codice: 'allineamento',
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
      codice: 'allineamento',
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
        ? testiGriglia.esiti.nessunaCella(saltate.length)
        : testiGriglia.esiti.applicato(applicate, saltate.length);
    if (saltate.length > 0) {
      this.toast.info(testo, {
        etichetta: testiGriglia.esiti.dettagli,
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
      this.toast.info(testiGriglia.sola.soloLetturaToast);
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
    if (voce.tipo === 'dettaglio') {
      // Il dettaglio si apre anche in sola lettura (UX §9.5): il pannello mostra i dati senza modificarli.
      this.apriDettaglio();
      return;
    }
    if (voce.tipo === 'dettaglioTurno') {
      this.apriTurno();
      return;
    }
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
      case 'trovaSostituto':
        if (attiva !== null) {
          void this.apriSostituti(attiva, voce.oggetto);
        }
        return;
      case 'rimuoviSostituzione':
        this.rimuoviSostituzione(voce.oggetto);
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
      titolo: testiGriglia.menu.etichetta(
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
      this.toast.errore(testiGriglia.salvataggio.bloccoPrima);
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
      // Un blocco del server riguardava la riga com'era prima: una volta salvata si riprova e decide il server.
      const salvate = new Set(daSalvare.map((r) => r.dipendenteId));
      this.righeNonValideDalServer.update((ids) =>
        calendario !== null ? [] : ids.filter((id) => !salvate.has(id)),
      );
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
          titolo: testiGriglia.salvataggio.conflittoTitolo,
          messaggio: testiGriglia.salvataggio.conflitto(modifiche),
          etichettaConferma: testiGriglia.salvataggio.ricarica,
          etichettaAnnulla: testiGriglia.annulla,
          pericolo: true,
        });
        if (ricarica) {
          await this.ricarica();
        }
        return;
      }
      if (errore.codice === 'MESE_CONVALIDATO') {
        this.salvataggio.set('riposo');
        this.toast.errore(testiGriglia.salvataggio.convalidato);
        await this.ricarica();
        return;
      }
      if (errore.codice === 'RESPINTO') {
        // Le regole hanno negato la scrittura: le modifiche locali restano, il messaggio dice perché e che cosa fare.
        this.salvataggio.set('riposo');
        this.toast.errore(testiGriglia.salvataggioRespinto);
        return;
      }
      if (errore.codice === 'MESE_ASSENTE') {
        // Riprovare non serve: si rilegge il mese e la pagina mostra lo stato «mese non creato».
        this.salvataggio.set('riposo');
        this.toast.errore(testiGriglia.salvataggio.meseAssente);
        await this.ricarica();
        return;
      }
    }
    // Rete o altro: le modifiche locali restano, la fascia dice di riprovare.
    this.salvataggio.set('errore');
  }

  // ----------------------------------------------------------------------------------------------
  // Dettaglio della reperibilità (UX §9.11, L21, L38)
  // ----------------------------------------------------------------------------------------------

  /** Apre il pannello con le reperibilità della cella (anche in sola lettura: il pannello non modifica). */
  apriDettaglio(cella: RiferimentoCella | null = this.attiva()): void {
    if (
      cella === null ||
      (this.cellaCorrente(cella.dipendenteId, cella.giorno)?.reperibilita.length ?? 0) === 0
    ) {
      return;
    }
    this.cellaDettaglio.set(cella);
    this.pannello.set('dettaglio');
  }

  /** Le reperibilità della cella aperta nel pannello, con la durata massima della chiamata nel giorno. */
  readonly datiDettaglio = computed<DatiDettaglio | null>(() => {
    const rif = this.cellaDettaglio();
    const chiave = this.chiaveMese();
    if (rif === null || chiave === null) {
      return null;
    }
    const cella = this.righe.get(rif.dipendenteId)?.().giorni[rif.giorno];
    const data = dataDelGiorno(chiave, rif.giorno);
    if (cella === undefined || data === null || cella.reperibilita.length === 0) {
      return null;
    }
    return {
      titolo: testiGriglia.menu.etichetta(
        this.nomeDi(rif.dipendenteId).breve,
        formattaGiornoCompleto(data),
      ),
      cella: rif,
      reperibilita: reperibilitaOrdinate(cella).map((r) => ({
        codice: r.codice,
        nome: this.turni().find((t) => t.codice === r.codice)?.nome ?? '',
        inizio: r.inizio,
        fine: r.fine,
        durataMassima: durataReale(data, r.inizio, r.fine),
        chiamata: r.chiamate[0] ?? null,
        coperta: r.copertaDa !== null,
      })),
    };
  });

  /** La cella dopo aver applicato le chiamate, o il motivo del primo rifiuto. */
  private cellaConChiamate(
    rif: RiferimentoCella,
    modifiche: readonly ModificaChiamata[],
  ): { readonly cella: CellaDoc } | { readonly motivo: MotivoRifiutoChiamata } | null {
    const chiave = this.chiaveMese();
    const data = chiave === null ? null : dataDelGiorno(chiave, rif.giorno);
    const prima = this.cellaCorrente(rif.dipendenteId, rif.giorno);
    if (data === null || prima === null) {
      return null;
    }
    let cella = prima;
    for (const modifica of modifiche) {
      const esito = impostaChiamata(cella, data, modifica.codice, modifica.chiamata);
      if (esito.esito === 'rifiutata') {
        return { motivo: esito.motivo };
      }
      cella = esito.cella;
    }
    return { cella };
  }

  /** Il motivo per cui le chiamate non si possono applicare (L21, L38), o null se vanno bene. */
  verificaChiamate(
    rif: RiferimentoCella,
    modifiche: readonly ModificaChiamata[],
  ): MotivoRifiutoChiamata | null {
    const esito = this.cellaConChiamate(rif, modifiche);
    return esito !== null && 'motivo' in esito ? esito.motivo : null;
  }

  /**
   * Gli avvisi di riposo e di sovrapposizione del giorno, come sarebbero dopo aver applicato le chiamate: con
   * l'ora di inizio le 11 ore ripartono dalla fine dell'intervento (D8). Non modifica nulla.
   */
  anteprimaAvvisiChiamate(
    rif: RiferimentoCella,
    modifiche: readonly ModificaChiamata[],
  ): readonly string[] {
    const chiave = this.chiaveMese();
    const riga = this.righe.get(rif.dipendenteId)?.();
    const esito = this.cellaConChiamate(rif, modifiche);
    const data = chiave === null ? null : dataDelGiorno(chiave, rif.giorno);
    if (
      chiave === null ||
      riga === undefined ||
      data === null ||
      esito === null ||
      'motivo' in esito
    ) {
      return [];
    }
    const nome = this.nomeDi(rif.dipendenteId).breve;
    return avvisiRiga(
      {
        dipendenteId: rif.dipendenteId,
        contratto: riga.contratto,
        giorni: { ...riga.grezzi, ...riga.giorni, [rif.giorno]: esito.cella },
      },
      {
        chiaveMese: chiave,
        turniEsclusi: [],
        righeAdiacenti: this.righeAdiacentiDi(rif.dipendenteId),
      },
    )
      .filter(
        (s) =>
          (s.codice === 'riposoInsufficiente' &&
            (s.giorno === data || s.giornoPrecedente === data)) ||
          (s.codice === 'reperibilitaSovrapposta' && s.giorno === data),
      )
      .map((s) => testoSegnalazione(s, { nome, chiaveMese: chiave }));
  }

  /**
   * «Applica» del pannello: le chiamate diventano modifiche non salvate, un solo passo di annulla. Restituisce il
   * motivo del rifiuto, o null se applicate. Il mese convalidato e l'ADMIN non modificano (D2).
   */
  applicaChiamate(
    rif: RiferimentoCella,
    modifiche: readonly ModificaChiamata[],
  ): MotivoRifiutoChiamata | 'nonModificabile' | null {
    if (!this.puoModificare()) {
      return 'nonModificabile';
    }
    const esito = this.cellaConChiamate(rif, modifiche);
    if (esito === null) {
      return null;
    }
    if ('motivo' in esito) {
      return esito.motivo;
    }
    const prima = this.cellaCorrente(rif.dipendenteId, rif.giorno);
    if (this.cambia(rif.dipendenteId, rif.giorno, prima, esito.cella)) {
      const passo: Passo = [
        { dipendenteId: rif.dipendenteId, giorno: rif.giorno, prima, dopo: esito.cella },
      ];
      this.scrivi(passo, 'dopo');
      this.registra(passo);
      this.toast.info(testiGriglia.dettaglio.applicato);
    }
    return null;
  }

  // ----------------------------------------------------------------------------------------------
  // Consuntivo: orari reali, sostituzioni (UX §9.11, PIANO 3.2) — tutte con `validaModifica()` del dominio
  // ----------------------------------------------------------------------------------------------

  private rigaConsuntivo(id: string): RigaConsuntivo | null {
    const riga = this.righe.get(id)?.();
    return riga === undefined
      ? null
      : { dipendenteId: id, contratto: riga.contratto, giorni: riga.giorni };
  }

  private adiacentiTipizzate(id: string): RigheAdiacentiDipendente {
    const { precedente, successivo } = this.adiacenti();
    return {
      precedente: precedente?.get(id)?.giorni ?? null,
      successiva: successivo?.get(id)?.giorni ?? null,
    };
  }

  /** Il contesto di `validaModifica()` per le righe indicate (turni esclusi e righe dei mesi adiacenti). */
  private contestoModifica(
    ids: readonly string[],
    collegaId: string | null,
  ): ContestoModifica | null {
    const chiave = this.chiaveMese();
    const mese = this.mese();
    if (chiave === null || mese === null) {
      return null;
    }
    const turniEsclusi: Record<string, readonly CodiceTurno[]> = {};
    const righeAdiacenti: Record<string, RigheAdiacentiDipendente> = {};
    for (const id of ids) {
      turniEsclusi[id] = this.dipendentiPerId().get(id)?.turniEsclusi ?? [];
      righeAdiacenti[id] = this.adiacentiTipizzate(id);
    }
    return {
      chiaveMese: chiave,
      statoMese: mese.stato,
      turniEsclusi,
      righeAdiacenti,
      collega: collegaId === null ? null : this.rigaConsuntivo(collegaId),
    };
  }

  /** Prova una modifica di consuntivo senza applicarla: l'esito del dominio, o null se mese o riga mancano. */
  private provaModifica(
    id: string,
    modifica: ModificaConsuntivo,
    collegaId: string | null = null,
  ): ReturnType<typeof validaModifica> | null {
    const riga = this.rigaConsuntivo(id);
    const contesto = this.contestoModifica(collegaId === null ? [id] : [id, collegaId], collegaId);
    return riga === null || contesto === null ? null : validaModifica(riga, modifica, contesto);
  }

  private testoDelBlocco(
    esito: Extract<ReturnType<typeof validaModifica>, { esito: 'bloccata' }>,
  ): string {
    const base = testiGriglia.motiviModifica[esito.motivo];
    const primo = esito.codici[0];
    return esito.motivo === 'rigaNonValida' && primo !== undefined
      ? `${base} (${testiGriglia.segnalazioni.problemi[primo]})`
      : base;
  }

  /**
   * Applica una modifica di consuntivo come un solo passo di annulla (anche su due righe, per le sostituzioni):
   * entra tra le modifiche non salvate. Mese convalidato e ADMIN non modificano (D2).
   */
  private applicaModifica(
    id: string,
    modifica: ModificaConsuntivo,
    collegaId: string | null = null,
  ): EsitoApplicazione {
    if (!this.puoModificare()) {
      return { ok: false, motivo: 'nonModificabile', testo: testiGriglia.sola.soloLetturaToast };
    }
    const esito = this.provaModifica(id, modifica, collegaId);
    if (esito === null) {
      return { ok: false, motivo: 'nonModificabile', testo: testiGriglia.sola.soloLetturaToast };
    }
    if (esito.esito === 'bloccata') {
      return { ok: false, motivo: esito.motivo, testo: this.testoDelBlocco(esito) };
    }
    const passo: ModificaCella[] = [];
    for (const nuova of esito.righe) {
      const prima = this.righe.get(nuova.dipendenteId)?.().giorni ?? {};
      for (const giorno of giorniModificati(nuova.giorni, prima)) {
        passo.push({
          dipendenteId: nuova.dipendenteId,
          giorno,
          prima: prima[giorno] ?? null,
          dopo: nuova.giorni[giorno] ?? null,
        });
      }
    }
    this.scrivi(passo, 'dopo');
    this.registra(passo);
    return { ok: true };
  }

  /** Gli avvisi di riposo e di sovrapposizione che toccano il giorno, come testi (anteprima prima di «Applica»). */
  private avvisiDelGiorno(
    id: string,
    segnalazioni: readonly Segnalazione[],
    data: DataISO,
  ): readonly string[] {
    const chiave = this.chiaveMese();
    if (chiave === null) {
      return [];
    }
    const nome = this.nomeDi(id).breve;
    return segnalazioni
      .filter(
        (s) =>
          (s.codice === 'riposoInsufficiente' &&
            (s.giorno === data || s.giornoPrecedente === data)) ||
          (s.codice === 'reperibilitaSovrapposta' && s.giorno === data),
      )
      .map((s) => testoSegnalazione(s, { nome, chiaveMese: chiave }));
  }

  // -- Dettaglio turno ---------------------------------------------------------------------------

  /** Apre il pannello con l'orario del turno della cella (anche in sola lettura: il pannello non modifica). */
  apriTurno(cella: RiferimentoCella | null = this.attiva()): void {
    if (cella === null || this.cellaCorrente(cella.dipendenteId, cella.giorno)?.turno == null) {
      return;
    }
    this.sostitutiAperti.set(null);
    this.cellaDettaglio.set(null);
    this.cellaTurno.set(cella);
    this.pannello.set('turno');
  }

  /** Il turno della cella aperta nel pannello, con il suo orario reale e i colleghi della sostituzione. */
  readonly datiTurno = computed<DatiTurno | null>(() => {
    const rif = this.cellaTurno();
    const chiave = this.chiaveMese();
    if (this.pannello() !== 'turno' || rif === null || chiave === null) {
      return null;
    }
    const cella = this.righe.get(rif.dipendenteId)?.().giorni[rif.giorno];
    const data = dataDelGiorno(chiave, rif.giorno);
    if (cella?.turno == null || data === null) {
      return null;
    }
    const turno = cella.turno;
    return {
      titolo: testiGriglia.menu.etichetta(
        this.nomeDi(rif.dipendenteId).breve,
        formattaGiornoCompleto(data),
      ),
      cella: rif,
      data,
      codice: turno.codice,
      nome: this.turni().find((t) => t.codice === turno.codice)?.nome ?? '',
      inizio: turno.inizio,
      fine: turno.fine,
      pausaMinuti: turno.pausaMinuti,
      notturno: turno.notturno,
      orarioReale: cella.orarioReale,
      stato: cella.assenza === null ? 'svolto' : cella.copertoDa === null ? 'scoperto' : 'coperto',
      sostituisce: cella.sostituisce === null ? null : this.nomeDi(cella.sostituisce).breve,
      copertoDa: cella.copertoDa === null ? null : this.nomeDi(cella.copertoDa).breve,
    };
  });

  /** La differenza (minuti reali, col cambio d'ora) tra l'orario digitato e il previsto; null se incompleto. */
  differenzaOrario(rif: RiferimentoCella, inizio: string, fine: string): Minuti | null {
    const chiave = this.chiaveMese();
    const turno = this.cellaCorrente(rif.dipendenteId, rif.giorno)?.turno;
    const data = chiave === null ? null : dataDelGiorno(chiave, rif.giorno);
    if (turno == null || data === null || !eOraLocale(inizio) || !eOraLocale(fine)) {
      return null;
    }
    return variazioneOrario(data, turno, { inizio, fine });
  }

  /**
   * L'orario reale (o null per ripristinare il previsto) come lo giudica il dominio: il testo del blocco, se c'è,
   * e gli avvisi di riposo che ne seguirebbero. Non modifica nulla.
   */
  verificaOrarioReale(
    rif: RiferimentoCella,
    orario: OrarioReale | null,
  ): { readonly blocco: string | null; readonly avvisi: readonly string[] } {
    const chiave = this.chiaveMese();
    const data = chiave === null ? null : dataDelGiorno(chiave, rif.giorno);
    const esito = this.provaModifica(rif.dipendenteId, {
      tipo: 'orarioReale',
      giorno: rif.giorno,
      orario,
    });
    if (esito === null || data === null) {
      return { blocco: testiGriglia.sola.soloLetturaToast, avvisi: [] };
    }
    if (esito.esito === 'bloccata') {
      return {
        blocco: esito.motivo === 'meseConvalidato' ? null : this.testoDelBlocco(esito),
        avvisi: [],
      };
    }
    const della = esito.avvisi.find((a) => a.dipendenteId === rif.dipendenteId);
    return {
      blocco: null,
      avvisi: this.avvisiDelGiorno(rif.dipendenteId, della?.segnalazioni ?? [], data),
    };
  }

  /** «Applica» del pannello: l'orario reale (null = ripristina il previsto) diventa una modifica non salvata. */
  applicaOrarioReale(rif: RiferimentoCella, orario: OrarioReale | null): EsitoApplicazione {
    const esito = this.applicaModifica(rif.dipendenteId, {
      tipo: 'orarioReale',
      giorno: rif.giorno,
      orario,
    });
    if (esito.ok) {
      this.toast.info(orario === null ? testiGriglia.turno.rimosso : testiGriglia.turno.applicato);
    }
    return esito;
  }

  // -- Trova sostituto -----------------------------------------------------------------------------

  /**
   * Apre «Trova sostituto» da una cella scoperta (turno o reperibilità, UX §9.11): solo su richiesta legge i
   * riepiloghi dei 12 mesi precedenti e i saldi definitivi dell'anno (review 3.1a, rilievo 2). Restituisce se si è aperto.
   */
  async apriSostituti(cella: RiferimentoCella, oggetto: OggettoSostituzione): Promise<boolean> {
    if (!this.puoModificare()) {
      return false;
    }
    const contenuto = this.cellaCorrente(cella.dipendenteId, cella.giorno);
    const verifica = oggettoScoperto(contenuto ?? undefined, oggetto);
    if (verifica.esito === 'rifiutato') {
      this.toast.info(
        testiGriglia.sostituti.respinta(testiGriglia.motiviModifica[verifica.motivo]),
      );
      return false;
    }
    this.cellaTurno.set(null);
    this.cellaDettaglio.set(null);
    this.candidatoEvidenziato.set(null);
    this.sostitutiAperti.set({ cella, oggetto, stato: 'caricamento', storico: [], saldi: {} });
    this.pannello.set('sostituti');
    await this.caricaSostituti(++this.richiestaSostituti);
    return true;
  }

  riprovaSostituti(): Promise<void> {
    this.sostitutiAperti.update((a) => (a === null ? null : { ...a, stato: 'caricamento' }));
    return this.caricaSostituti(++this.richiestaSostituti);
  }

  private async caricaSostituti(numero: number): Promise<void> {
    const chiave = this.chiaveMese();
    if (chiave === null) {
      return;
    }
    try {
      const [storico, banche] = await Promise.all([
        this.riepiloghiRepo.perClassifica(
          this.repartoId(),
          spostaMese(chiave, -MESI_STORICO_SOSTITUTI),
          spostaMese(chiave, -1),
        ),
        this.bancaOreRepo.anno(this.repartoId(), Number(chiave.slice(0, 4))),
      ]);
      if (numero !== this.richiestaSostituti) {
        return;
      }
      // Per i pari merito si usa il saldo dei soli mesi convalidati (un mese in bozza vuoto vale come un riposo).
      const saldi: Record<string, Minuti> = {};
      for (const banca of banche) {
        saldi[banca.dipendenteId] = banca.saldoDefinitivoMinuti;
      }
      this.sostitutiAperti.update((a) =>
        a === null ? null : { ...a, stato: 'pronto', storico, saldi },
      );
    } catch {
      if (numero === this.richiestaSostituti) {
        this.sostitutiAperti.update((a) => (a === null ? null : { ...a, stato: 'errore' }));
      }
    }
  }

  /** La classifica con i dati correnti della griglia (anche le modifiche non salvate) e i testi pronti. */
  readonly datiSostituti = computed<DatiSostituti | null>(() => {
    const aperti = this.sostitutiAperti();
    const chiave = this.chiaveMese();
    if (this.pannello() !== 'sostituti' || aperti === null || chiave === null) {
      return null;
    }
    const { cella: rif, oggetto } = aperti;
    const data = dataDelGiorno(chiave, rif.giorno);
    const contenuto = this.righe.get(rif.dipendenteId)?.().giorni[rif.giorno];
    const scoperto = oggettoScoperto(contenuto, oggetto);
    const t = testiGriglia.sostituti;
    if (data === null || scoperto.esito === 'rifiutato') {
      return { stato: 'nonScoperto', titolo: t.titoloPannello };
    }
    const codice = oggetto.tipo === 'turno' ? (contenuto?.turno?.codice ?? '') : oggetto.codice;
    const titolo = t.titolo(codice, scoperto.inizio, scoperto.fine, giornoBreve(data));
    if (aperti.stato !== 'pronto') {
      return { stato: aperti.stato, titolo };
    }
    const righe: RigaConsuntivo[] = [];
    const turniEsclusi: Record<string, readonly CodiceTurno[]> = {};
    const righeAdiacenti: Record<string, RigheAdiacentiDipendente> = {};
    for (const id of this.ordine()) {
      const riga = this.rigaConsuntivo(id);
      if (riga !== null) {
        righe.push(riga);
        turniEsclusi[id] = this.dipendentiPerId().get(id)?.turniEsclusi ?? [];
        righeAdiacenti[id] = this.adiacentiTipizzate(id);
      }
    }
    const classifica = classificaSostituti({
      chiaveMese: chiave,
      giorno: rif.giorno,
      assenteId: rif.dipendenteId,
      oggetto,
      righe,
      righeAdiacenti,
      turniEsclusi,
      riepiloghi: aperti.storico,
      saldi: aperti.saldi,
    });
    if (classifica === null) {
      return { stato: 'nonScoperto', titolo: t.titoloPannello };
    }
    return {
      stato: 'pronto',
      titolo,
      disponibili: classifica.disponibili.map((c) => ({
        id: c.dipendenteId,
        nome: this.nomeDi(c.dipendenteId).breve,
        volte: c.volte,
        saldo: c.saldoMinuti === null ? null : formattaSaldoOre(c.saldoMinuti),
        saldoNegativo: c.saldoMinuti !== null && c.saldoMinuti < 0,
        reperibile: c.reperibile,
        riposo:
          c.riposo === null
            ? []
            : [
                ...(c.riposo.prima === null
                  ? []
                  : [t.riposoPrima(formattaOreCompatte(c.riposo.prima))]),
                ...(c.riposo.dopo === null
                  ? []
                  : [t.riposoDopo(formattaOreCompatte(c.riposo.dopo))]),
              ],
      })),
      nonDisponibili: classifica.nonDisponibili.map((c) => ({
        id: c.dipendenteId,
        nome: this.nomeDi(c.dipendenteId).breve,
        motivo: testoNonDisponibile(
          c.motivo,
          (codiceAssenza) =>
            this.assenze().find((a) => a.codice === codiceAssenza)?.descrizione ?? codiceAssenza,
        ),
      })),
    };
  });

  /** La settimana (lunedì-domenica) del giorno scoperto evidenziata nella riga del candidato su cui si passa. */
  private readonly evidenzaSettimana = computed(() => {
    const id = this.candidatoEvidenziato();
    const aperti = this.sostitutiAperti();
    const chiave = this.chiaveMese();
    if (this.pannello() !== 'sostituti' || id === null || aperti === null || chiave === null) {
      return null;
    }
    const settimana = settimaneDelMese(chiave)[settimanaDelGiorno(chiave, aperti.cella.giorno)];
    if (settimana === undefined) {
      return null;
    }
    const visibili = this.giorni();
    const indici = settimana.giorni.map((g) => visibili.indexOf(g)).filter((i) => i >= 0);
    return indici.length === 0
      ? null
      : { dipendenteId: id, da: Math.min(...indici), a: Math.max(...indici) };
  });

  evidenziaCandidato(id: string | null): void {
    this.candidatoEvidenziato.set(id);
  }

  /** «Assegna»: il sostituto prende il turno o la fascia (due righe, un solo passo di annulla). */
  assegnaSostituto(sostitutoId: string): EsitoApplicazione {
    const aperti = this.sostitutiAperti();
    if (aperti === null) {
      return { ok: false, motivo: 'nonModificabile', testo: testiGriglia.sola.soloLetturaToast };
    }
    const esito = this.applicaModifica(
      aperti.cella.dipendenteId,
      {
        tipo: 'sostituzione',
        giorno: aperti.cella.giorno,
        oggetto: aperti.oggetto,
        sostitutoId,
      },
      sostitutoId,
    );
    if (esito.ok) {
      this.toast.info(testiGriglia.sostituti.assegnato(this.nomeDi(sostitutoId).breve));
      this.chiudiPannelli();
    } else {
      this.toast.errore(testiGriglia.sostituti.respinta(esito.testo));
    }
    return esito;
  }

  /** «Rimuovi la sostituzione», dalla cella dell'assente o da quella del sostituto: l'assente torna scoperto. */
  rimuoviSostituzione(oggetto: OggettoSostituzione): EsitoApplicazione {
    const rif = this.attiva();
    const cella = rif === null ? null : this.cellaCorrente(rif.dipendenteId, rif.giorno);
    if (rif === null || cella === null) {
      return { ok: false, motivo: 'nonModificabile', testo: testiGriglia.sola.soloLetturaToast };
    }
    const fascia =
      oggetto.tipo === 'reperibilita'
        ? cella.reperibilita.find((r) => r.codice === oggetto.codice)
        : undefined;
    const copertoDa = oggetto.tipo === 'turno' ? cella.copertoDa : (fascia?.copertaDa ?? null);
    const sostituisce =
      oggetto.tipo === 'turno' ? cella.sostituisce : (fascia?.sostituisce ?? null);
    const assenteId = copertoDa !== null ? rif.dipendenteId : sostituisce;
    const sostitutoId = copertoDa !== null ? copertoDa : rif.dipendenteId;
    if (assenteId === null) {
      return {
        ok: false,
        motivo: 'sostituzioneAssente',
        testo: testiGriglia.motiviModifica.sostituzioneAssente,
      };
    }
    const esito = this.applicaModifica(
      assenteId,
      { tipo: 'rimuoviSostituzione', giorno: rif.giorno, oggetto, sostitutoId },
      sostitutoId,
    );
    if (esito.ok) {
      this.toast.info(testiGriglia.sostituti.rimossa);
    } else if (esito.motivo !== 'nonModificabile') {
      this.toast.errore(testiGriglia.sostituti.respinta(esito.testo));
    }
    return esito;
  }

  /** Chiude i pannelli del consuntivo e rimette a posto ciò che portavano con sé. */
  chiudiPannelli(): void {
    this.cellaDettaglio.set(null);
    this.cellaTurno.set(null);
    this.sostitutiAperti.set(null);
    this.candidatoEvidenziato.set(null);
    this.richiestaSostituti += 1;
    this.pannello.set(null);
  }

  // ----------------------------------------------------------------------------------------------
  // Storico delle festività (U6, UX §9.10)
  // ----------------------------------------------------------------------------------------------

  private readonly statiStorico = signal<ReadonlyMap<string, StatoStorico>>(new Map());

  /** La festività della colonna della cella attiva, o null. Cambia solo passando da una colonna festiva all'altra. */
  readonly festivitaAttiva = computed<{ readonly id: string; readonly nome: string } | null>(
    () => {
      const attiva = this.attiva();
      const colonna =
        attiva === null ? undefined : this.tuttiIGiorni().find((c) => c.giorno === attiva.giorno);
      return colonna?.festivita == null
        ? null
        : { id: colonna.festivita.id, nome: colonna.festivita.nome };
    },
    { equal: (a, b) => a?.id === b?.id },
  );

  private chiaveStorico(idFestivita: string): string | null {
    const chiave = this.chiaveMese();
    return chiave === null
      ? null
      : `${this.repartoId()}|${idFestivita}|${intervalloStoricoFestivita(chiave).da}`;
  }

  /** Quante volte ogni dipendente ha lavorato la festività attiva negli ultimi 5 anni; null se non c'è o non è pronto. */
  readonly conteggiStorico = computed<ReadonlyMap<string, number> | null>(() => {
    const festa = this.festivitaAttiva();
    const chiave = festa === null ? null : this.chiaveStorico(festa.id);
    const stato = chiave === null ? undefined : this.statiStorico().get(chiave);
    return stato?.stato === 'pronto' ? stato.storico.perDipendente : null;
  });

  /** Legge lo storico di una festività dai riepiloghi, una volta per sessione e per anno (UX §9.10). */
  async caricaStorico(idFestivita: string, riprova = false): Promise<void> {
    const chiave = this.chiaveMese();
    const chiaveCache = this.chiaveStorico(idFestivita);
    if (chiave === null || chiaveCache === null) {
      return;
    }
    const attuale = this.statiStorico().get(chiaveCache);
    if (attuale !== undefined && !(riprova && attuale.stato === 'errore')) {
      return;
    }
    const imposta = (stato: StatoStorico): void =>
      this.statiStorico.update((m) => new Map(m).set(chiaveCache, stato));
    imposta({ stato: 'caricamento' });
    const intervallo = intervalloStoricoFestivita(chiave);
    try {
      const riepiloghi = await this.riepiloghiRepo.festivita(
        this.repartoId(),
        idFestivita,
        intervallo.da,
        intervallo.a,
      );
      imposta({
        stato: 'pronto',
        storico: aggregaStoricoFestivita(idFestivita, chiave, riepiloghi),
      });
    } catch {
      imposta({ stato: 'errore' });
    }
  }

  /** Lo storico di una festività con i nomi dell'anagrafica, per il popover dell'intestazione. */
  datiStorico(idFestivita: string): Signal<DatiStoricoVista> {
    return computed<DatiStoricoVista>(() => {
      const chiave = this.chiaveStorico(idFestivita);
      const stato = chiave === null ? undefined : this.statiStorico().get(chiave);
      if (stato?.stato !== 'pronto') {
        return { stato: stato?.stato ?? 'caricamento', anni: [] };
      }
      return {
        stato: 'pronto',
        anni: stato.storico.perAnno.map((a) => ({
          anno: a.anno,
          voci: a.voci.map((v) => ({ nome: this.nomeDi(v.dipendenteId).breve, codice: v.codice })),
        })),
      };
    });
  }

  // ----------------------------------------------------------------------------------------------
  // Convalida (D1, D2, D18, U5, UX §9.8)
  // ----------------------------------------------------------------------------------------------

  /**
   * Chiama `convalidaMese` e, se riesce, rilegge il mese: la fascia diventa «Convalidato il … da …». Gli errori
   * del server si traducono con messaggi dell'interfaccia; le righe non valide aprono il pannello Avvisi.
   */
  async convalida(): Promise<boolean> {
    const chiave = this.chiaveMese();
    if (chiave === null || this.motivoConvalidaDisabilitata() !== null) {
      return false;
    }
    const t = testiGriglia.convalidaDialogo;
    this.convalidaInCorso.set(true);
    try {
      await this.funzioniMesi.convalida({ repartoId: this.repartoId(), chiaveMese: chiave });
    } catch (errore) {
      const codice = codiceErroreFunzione(errore);
      if (codice === 'RIGHE_NON_VALIDE') {
        this.righeNonValideDalServer.set(righeDaErroreFunzione(errore));
        this.pannello.set('avvisi');
        this.toast.errore(t.errori.RIGHE_NON_VALIDE);
      } else if (codice === 'MESE_NON_CONCLUSO') {
        this.toast.errore(t.errori.MESE_NON_CONCLUSO);
      } else if (codice === 'MESE_GIA_CONVALIDATO') {
        this.toast.errore(t.errori.MESE_GIA_CONVALIDATO);
        await this.ricarica();
      } else {
        this.toast.errore(t.errori.altro);
      }
      return false;
    } finally {
      this.convalidaInCorso.set(false);
    }
    this.toast.successo(t.convalidato(formattaMese(chiave)));
    await this.ricarica();
    return true;
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
