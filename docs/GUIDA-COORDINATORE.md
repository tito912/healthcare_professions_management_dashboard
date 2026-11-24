# Guida del coordinatore

Questa guida spiega come usare il gestionale per pianificare i turni del reparto. Ogni sezione descrive una
schermata. Per avviare l'app con dati di prova, vedi il README.

## Chi fa che cosa

- Il **coordinatore** pianifica i turni dei propri reparti, gestisce dipendenti e configurazione, convalida i
  mesi e invia i report. Vede solo i propri reparti.
- L'**ADMIN** consulta tutti i reparti **in sola lettura** (griglia, banca ore, report, registro) e gestisce gli
  utenti. Non modifica turni né convalida mesi.

## Accesso

Inserisci l'email e la password che ti ha dato l'amministratore, poi premi **Entra**.

- Se hai dimenticato la password, premi **Password dimenticata?**, inserisci l'email e premi **Invia il
  link**. Riceverai un'email per sceglierne una nuova. Il messaggio è lo stesso anche se l'indirizzo non è
  registrato, per proteggere gli account.
- Se l'accesso non riesce, il messaggio **Email o password non corrette** compare sotto i campi.

Dopo l'accesso vai alla pagina che stavi cercando. Altrimenti:

- se hai un solo reparto, vai direttamente al mese corrente;
- se hai più reparti, vai alla **Home**;
- se non hai ancora un reparto, la Home ti invita a crearne uno.

## Home

La Home riassume il lavoro da fare.

- **Avvisi aperti**: mesi in bozza con avvisi da risolvere, il mese successivo che non è ancora stato
  creato, e i report bimestrali non inviati. Premi **Apri** per andare al punto indicato.
- **I tuoi reparti**: una scheda per ogni reparto. La scheda dice quanti dipendenti sono in servizio e lo
  stato del mese corrente (bozza o convalidato). Premi **Apri** per entrare nella pianificazione, oppure
  **Riprendi** se la configurazione del reparto non è completa.
- **Aggiungi reparto** crea un nuovo reparto.

## Creazione del reparto

Quando crei un reparto, la creazione guidata ti porta per tre passi. Un indicatore in alto mostra a che
punto sei: Nome, Turni e reperibilità, Dipendenti.

1. **Nome del reparto**: scrivi il nome e premi **Crea reparto**. Il reparto nasce con le assenze predefinite
   **R** (riposo) e **MA** (malattia), che non si possono eliminare.
2. **Turni e reperibilità**: vedi la schermata qui sotto. Premi **Salva e continua** per passare al passo
   successivo.
3. **Dipendenti**: aggiungi almeno un dipendente. Premi **Fine: vai alla pianificazione** per aprire il mese.

Puoi interrompere la creazione in qualsiasi momento: alla prossima apertura riprendi dal passo in cui eri.

## Turni e reperibilità

Qui configuri i turni del reparto, con i loro orari, la pausa e il colore. Ogni turno ha un **codice** di una
lettera e una cifra (per esempio M1), che si usa in griglia.

- **Aggiungi turno** aggiunge un turno. Il colore serve a riconoscerlo in griglia e nella legenda.
- Le **fasce di reperibilità** hanno un codice come R1 o R2 e non hanno colore.
- Un turno che finisce dopo mezzanotte è **notturno**: l'app lo riconosce dagli orari.
- **Disattiva** un turno lo nasconde dai menu e dal pennello, ma lo lascia leggibile nei mesi già pianificati.
- **Salva modifiche** salva la configurazione. Non si possono eliminare i turni già usati in un mese.

## Dipendenti

L'elenco mostra tutti i dipendenti del reparto con lo stato: in servizio, da assumere o cessato.

- **Nuovo dipendente** apre la scheda per inserire nome, cognome, ore settimanali, codice fiscale, data di
  nascita ed email. Il codice fiscale e la data di nascita sono riservati: li vedi solo tu e l'amministratore,
  e non compaiono nei registri.
- Puoi indicare i **turni esclusi** per un dipendente: l'app segnala se ne viene assegnato uno escluso.
- **Disattiva dipendente** serve a un dipendente che lascia il reparto: chiede la data di cessazione. I dati
  di chi è cessato da più di cinque anni vengono cancellati automaticamente.

## Pianificazione del mese

È la schermata di lavoro. Il mese è una griglia: una riga per dipendente, una colonna per giorno.

In alto trovi il mese, il selettore della vista (**Mese**, **2 settimane**, **1 settimana**), il pulsante
**Avvisi**, la **Legenda**, **Stampa** e i pulsanti per salvare e convalidare.

**Come si lavora**

- Scegli una cella e digita il codice (M1, P1, N1, R, MA, F, R1, R2) e premi **Invio**. Il turno compare
  nella cella.
- Oppure scegli un codice dal **Pennello** in alto e clicca le celle: il pennello resta attivo finché non lo
  deponi con **Esc**. La **Gomma** (⌫) accanto ai codici svuota le celle cliccate.
- Con il clic destro, o con **Invio** sulla cella, apri il menu della cella per assegnare un turno, un'assenza
  o una reperibilità, o per svuotarla.
- **Assenze**: un'assenza come **R** sostituisce il turno. Un'assenza come **MA** o **F** su un turno lascia
  il turno come **scoperto**: il turno resta visibile ed è da coprire. Puoi cercare un sostituto dal menu
  della cella con **Trova sostituto**, oppure eliminare il turno scoperto.
- **Orari reali**: se un turno è svolto con orari diversi da quelli previsti, aprilo dal menu con **Dettaglio
  turno** e inserisci gli orari reali. Lo scarto viene conteggiato nelle ore.
- **Avvisi**: il pannello **Avvisi** elenca i problemi del mese (riposo sotto le 11 ore, reperibilità oltre il
  limite, turni scoperti). Un clic sull'avviso porta alla cella. Gli avvisi non bloccano né il salvataggio né la
  convalida: prima di convalidare, l'app li riepiloga e chiede conferma.
- **Note di allineamento**: nel pannello **Avvisi**, gruppo **Note** (non sono contate nel numero sul
  pulsante), l'app segnala quando i dati del reparto sono cambiati dopo la creazione del mese in bozza:
  - un dipendente **nuovo** (o assunto in quel mese) che non ha ancora una riga: premi **Aggiungi**;
  - **ore settimanali** o **date di assunzione e cessazione** cambiate: premi **Aggiorna**;
  - **festività** o attribuzione della notte cambiate: premi **Aggiorna** per ricalcolare il calendario.
  Nulla avviene da solo: il pulsante applica la modifica solo sulla schermata (la riga porta il segno «●») e
  va confermata con **Salva bozza**. L'elenco dei dipendenti si legge all'apertura della griglia: se hai
  appena aggiunto un dipendente, esci dalla griglia e rientra. Nei mesi convalidati le note non compaiono e
  la riga non si può aggiungere.
- **Festività**: i giorni festivi sono evidenziati in intestazione. Un clic sull'intestazione di un giorno
  festivo apre lo storico degli ultimi 5 anni: per ogni dipendente, quante volte ha lavorato quella festività.
  Quando la cella attiva è in una colonna festiva, accanto a ogni nome compare anche un conteggio **«×N»**:
  quante volte quel dipendente ha lavorato **quella** festività nei 5 anni precedenti. **«×0»** significa
  mai. Serve a distribuire le festività in modo equo; il conteggio sparisce quando lasci la colonna.

**Reperibilità e chiamate**

- Ogni giorno puoi assegnare al massimo **2 reperibilità** a una persona. Se ce ne sono già due, il menu lo
  dice e non offre altre voci. Nella cella compaiono sempre in **ordine temporale crescente**, in base all'ora
  di inizio, qualunque sia l'ordine in cui le hai assegnate.
- Nella vista **Mese** la cella mostra solo l'ora di inizio di ciascuna reperibilità e, passandoci sopra con il
  mouse, la fascia e la durata. Nelle viste a settimane le fasce sono scritte per intero.
- Se la reperibilità è scattata, apri il menu della cella e scegli **Dettaglio…** accanto alla fascia: spunta
  **Chiamata scattata**, indica la **Durata** in minuti e, se serve, l'**Ora di inizio**. Con l'ora di inizio le
  11 ore di riposo ripartono dalla fine dell'intervento. Premi **Applica**: la modifica resta tra quelle non
  salvate. Sulla cella compare il segno di chiamata in alto a sinistra.
- Il totale delle reperibilità del mese è nella colonna **Rep.** a destra e diventa arancione oltre il limite
  di 7 unità. Una reperibilità sovrapposta a un turno genera un avviso.
- Anche una reperibilità può restare scoperta e avere un sostituto, come un turno.

**Sostituti**

Su una cella scoperta scegli **Trova sostituto**: a destra si apre un pannello con i **Disponibili**, per
ciascuno quante volte ha già fatto quel turno e il saldo della banca ore, e in fondo i **Non disponibili** con
il motivo (già in servizio, turno escluso, assente). Passando su un nome, la sua settimana si evidenzia nella
griglia. Un candidato con un avviso, per esempio un riposo troppo corto, è segnato con ⚠ e il motivo.
**Assegna** crea la sostituzione come modifica non salvata: la persona sostituita e il sostituto portano il
segno di sostituzione in alto a destra.

**Viste, legenda e stampa**

- Il selettore **Mese / 2 settimane / 1 settimana** cambia il livello di dettaglio. L'app ricorda la scelta.
  Nelle viste a settimane si naviga con **◀ ▶** o **Alt+Maiusc+←/→**.
- **Legenda** (o `?`) spiega i colori, i codici e i segni d'angolo: in alto a destra la sostituzione, in basso a
  destra l'orario variato, in alto a sinistra la chiamata; un bordo arancione con icona indica un avviso.
- **Stampa** (o `Ctrl+P`) prepara il mese intero in orizzontale con legenda. Nel dialogo del browser scegli
  A3 o A4, oppure **Salva come PDF**.
- A destra della griglia i totali del mese: ore pianificate, ore dovute, differenza e reperibilità.

**Salvare**

Le modifiche restano nella pagina finché non le salvi. La barra in alto dice quante modifiche non sono
ancora salvate.

- **Salva bozza** (o **Ctrl+S**) salva il lavoro. Non c'è salvataggio automatico.
- Se provi a uscire con modifiche non salvate, l'app chiede se salvare, uscire senza salvare o restare.
- Se il salvataggio non riesce, le modifiche restano sulla pagina: premi **Riprova**.

**Convalidare**

**Convalida mese** è disponibile solo quando il mese è concluso e non ci sono modifiche non salvate. L'app
mostra prima gli avvisi ancora aperti, poi chiede conferma.

Dopo la convalida il mese è in **sola lettura totale**: non puoi più modificare turni, reperibilità, orari
reali, malattie, sostituzioni o chiamate. Il mese convalidato entra nei saldi definitivi della banca ore e nel
report. Per riaprirlo serve una richiesta all'amministratore del
database: l'ADMIN dell'app non ha una funzione per riaprire un mese.

**Aggiungi mese** crea un mese nuovo. Il mese successivo non ancora creato compare tra gli avvisi della Home.
Il mese nuovo ha una riga per ogni dipendente in servizio almeno un giorno di quel mese, con le ore e le date
copiate in quel momento. Un dipendente aggiunto dopo si inserisce con **Aggiungi** nel pannello **Avvisi**
(vedi *Note di allineamento*). I giorni prima dell'assunzione sono «fuori servizio» e non modificabili.

### Scorciatoie da tastiera della griglia

| Tasto | Azione |
|---|---|
| `←` `→` `↑` `↓` | sposta la cella attiva |
| `Maiusc` + frecce | seleziona un intervallo di celle |
| `Tab` / `Maiusc+Tab` | cella a destra / a sinistra; a fine riga passa alla riga successiva |
| `Home` / `Fine` | primo / ultimo giorno visibile della riga |
| `Ctrl+Home` / `Ctrl+Fine` | prima / ultima cella del mese |
| `PagSu` / `PagGiù` | una schermata di righe su / giù |
| `Alt+Maiusc+←` / `Alt+Maiusc+→` | settimana precedente / successiva |
| `Alt+PagSu` / `Alt+PagGiù` | mese precedente / successivo |
| lettera o cifra | avvia l'inserimento veloce con quel carattere |
| `Invio`, `F2`, `Alt+↓`, `Maiusc+F10` | apre il menu della cella |
| `Spazio` | con il pennello attivo, applica il pennello alla selezione |
| `Canc`, `Backspace` | svuota le celle selezionate |
| `Esc` | deponi il pennello; altrimenti riduci la selezione alla cella attiva |
| `Ctrl+C` / `Ctrl+V` | copia / incolla la pianificazione (turno, assenza, reperibilità) |
| `Ctrl+Z` / `Ctrl+Y` | annulla / ripristina |
| `Ctrl+S` | Salva bozza |
| `F6` / `Maiusc+F6` | passa alla zona successiva / precedente della pagina |
| `?` | apre la legenda e l'elenco delle scorciatoie |

Nell'inserimento veloce, `Invio` conferma e scende, `Tab` conferma e va a destra, `Esc` annulla.

## Banca ore

La banca ore mostra, per ogni dipendente, il saldo di ogni mese dell'anno scelto, il riporto dall'anno
precedente e il totale.

- Il segno **+** indica un credito di ore, il segno **−** un debito.
- Il simbolo **≈** indica un saldo provvisorio: il mese è ancora in bozza.
- Il trattino **—** indica un mese non ancora creato.
- Usa il selettore **Anno** per cambiare anno, e la casella **Cerca per nome** per trovare un dipendente.
- Un clic sul nome apre il dettaglio del dipendente.

## Dettaglio del dipendente

Mostra l'andamento di un dipendente nell'anno scelto: per ogni mese le ore dovute, quelle lavorate e il saldo.
Sotto trovi le variazioni di orario, cioè i turni svolti con orari diversi da quelli previsti, e il totale
delle assenze per tipologia.

## Report bimestrale

Il report riepiloga, per ogni dipendente, i turni svolti, le notti, i sabati, le domeniche e i festivi, le
reperibilità, le chiamate e le **ore** del bimestre.

Le colonne delle ore sono quattro:
- **Ore dovute** e **Ore lavorate** del bimestre, in ore con un decimale (per esempio «120,0»).
- **Saldo bimestre**: ore lavorate meno ore dovute, con il segno («+3,0» o «−7,0»).
- **Saldo da inizio anno**: il saldo della banca ore dall'inizio dell'anno fino alla fine del bimestre, riporto
  dell'anno precedente compreso. Se uno di quei mesi non è ancora convalidato il valore ha il segno **≈**
  (provvisorio); un trattino vuol dire che per quel dipendente non c'è ancora una banca ore.

Le stesse ore compaiono nel file Excel del reparto, nel file individuale e nell'email che riceve ogni
dipendente (solo le sue). Un report generato prima di questa funzione non ha le ore: la tabella le mostra
ricalcolate dai riepiloghi finché non premi **Scarica Excel**, che lo rigenera. Il file del reparto contiene i
saldi di tutti: consultalo e non affiggerlo.

- Scegli il bimestre con le frecce **◀ ▶**.
- Se uno dei due mesi è ancora in bozza, il report è **provvisorio**: il file e l'invio comprendono solo i mesi
  convalidati, e l'intestazione lo dice.
- **Scarica Excel** scarica il file del bimestre.
- **Invia il report** invia ai dipendenti con un'email registrata. Chi non ha un'email non riceve nulla e
  l'app lo segnala. **Reinvia** rimanda il report a una persona.
- La scheda **Festività dell'anno** mostra, per ogni dipendente, i turni lavorati nelle festività.

## Utenti (solo amministratore)

L'amministratore gestisce i coordinatori.

- **Nuovo coordinatore** crea un account. Il coordinatore riceve l'email per scegliere la password.
- **Disattiva** blocca l'accesso di un coordinatore. I suoi reparti restano e vanno riassegnati.
- **Riassegna** passa un reparto a un altro coordinatore attivo.
- **Reimposta password** manda al coordinatore l'email per cambiarla.

## Registro attività

Il registro elenca le operazioni fatte nel gestionale: modifiche al consuntivo, convalide, creazione di
coordinatori, pulizie. Puoi filtrare per reparto, utente, tipo di operazione e periodo. I filtri si applicano
appena li cambi. **Carica altre** mostra le voci più vecchie. Il coordinatore vede solo i propri reparti.

## Se qualcosa non funziona

Se compare la pagina **Qualcosa non ha funzionato**, premi **Riprova** oppure **Torna alla Home**. Se il
problema continua, avvisa l'amministratore. Le modifiche non salvate di una pagina restano in memoria finché
la pagina è aperta: non chiudere la scheda prima di averle salvate.
