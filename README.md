# Gestionale Turni di Reparto

Il progetto nasce da un'idea di Giovanni Michele Tetta (Tecnico di Radiologia), come supporto alla sua tesi "Ottimizzazione e digitalizzazione della gestione integrata della turnistica TSRM nei servizi di radiologia" del master in Coordinamento delle professioni sanitarie.


Web app per PC: il coordinatore pianifica i turni del reparto su una griglia mensile, l'ADMIN consulta
e gestisce gli utenti. Monorepo npm con workspaces:

| Cartella          | Contenuto                                               |
| ----------------- | ------------------------------------------------------- |
| `apps/web`        | interfaccia Angular (componenti standalone, signals)    |
| `functions`       | Cloud Functions 2a generazione, regione `europe-west12` |
| `packages/domain` | regole di calcolo in TypeScript puro (Luxon, Vitest)    |
| `scripts`         | utilità: dati dimostrativi, primo ADMIN, ambiente web   |
| `tests/regole`    | test delle Security Rules sull'emulatore                |

La documentazione di progetto sta in `docs/`: `ARCHITETTURA.md` (dati, regole, funzioni), `UX.md`
(schermate e griglia), `DECISIONI.md` (prevale su `SPEC.md`), `PIANO.md` (gli step di sviluppo),
`GUIDA-COORDINATORE.md` (uso dell'app), `handoff/` (una relazione per ogni step).

## Funzionalità

**Pianificazione dei turni (coordinatore)**

- Griglia mensile, una riga per dipendente e una colonna per giorno, in tre viste: mese intero, 2 settimane,
  1 settimana.
- Inserimento veloce da tastiera come in un foglio di calcolo, pennello e gomma, copia e incolla di
  intervalli, annulla e ripristina, menu della cella.
- Turni (un codice di una lettera e una cifra, come M1), assenze (R riposo, MA malattia, F ferie e altre) e
  fino a 2 reperibilità al giorno, mostrate sempre in ordine temporale crescente.
- Turni scoperti per assenza, ricerca del sostituto con l'elenco dei disponibili e il motivo di chi non lo è.
- Consuntivo: orari reali del turno, chiamate di reperibilità con durata e ora di inizio.
- Avvisi calcolati a ogni modifica: riposo sotto le 11 ore, reperibilità oltre il limite mensile o sovrapposta
  a un turno, turno escluso assegnato, turno scoperto. Un clic porta alla cella.
- Salvataggio esplicito della bozza (nessun salvataggio automatico) e avviso sulle modifiche non salvate.
- Convalida del mese: da quel momento il mese è in sola lettura e alimenta saldi definitivi e report.
- Festività nazionali precalcolate e locali del reparto, con lo storico dei festivi lavorati negli ultimi 5 anni.
- Stampa o PDF del mese in orizzontale, con legenda.

**Reparto e personale**

- Creazione guidata del reparto in tre passi (nome, turni e reperibilità, dipendenti), riprendibile.
- Anagrafica dei dipendenti: ore settimanali, turni esclusi, assunzione e cessazione. Codice fiscale, data di
  nascita ed email sono cifrati e illeggibili dal browser.

**Ore e report**

- Banca ore per dipendente e per anno, con riporto, saldi provvisori sui mesi in bozza e pagina di dettaglio.
- Report bimestrale per dipendente (turni, notti, sabati, domeniche, festivi, reperibilità, chiamate), file
  Excel e invio per email, anche automatico.

**Amministrazione**

- L'ADMIN consulta tutti i reparti in sola lettura e gestisce i coordinatori: crea, disattiva e riattiva,
  riassegna i reparti, reimposta la password.
- Registro attività filtrabile per reparto, utente, operazione e periodo.
- Pulizia automatica dei dipendenti cessati da oltre 5 anni.

Come si usa, schermata per schermata, è spiegato nella [Guida d'uso](docs/GUIDA-COORDINATORE.md).

Tutto il lavoro di sviluppo e di prova avviene sugli **emulatori Firebase** sul proprio computer:
per provare l'app non serve un account Firebase né alcuna credenziale.

## Prerequisiti

- **Node.js 22 o successivo** (`node -v`). Il file `package.json` richiede `>=22`.
- **npm**, incluso con Node.
- **Java 17 o successivo**, necessario agli emulatori. Con Java 17 funziona la CLI Firebase fissata in
  `package.json` (`firebase-tools` 14.27.0). Java 21 è consigliato: la CLI avverte che le versioni future
  richiederanno Java 21.
- **Git**, per clonare il repository.

La CLI Firebase è una dipendenza di sviluppo: non va installata in modo globale (`npx firebase …`).

## Avvio da un clone pulito

Eseguire i comandi in quest'ordine. Il secondo e il terzo passo richiedono due terminali aperti.

1. Clonare e installare le dipendenze di tutti i workspace:

   ```sh
   git clone <url-del-repository> gestionale-turni-reparto
   cd gestionale-turni-reparto
   npm install
   ```

2. Terminale 1: avviare emulatori e applicazione web.

   ```sh
   npm run dev
   ```

   Attendere la riga `All emulators ready` (emulatori) e il messaggio di `ng serve` con
   `Local: http://localhost:4200/`. Il terminale resta aperto: è il server di sviluppo.

3. Terminale 2: caricare i dati dimostrativi negli emulatori appena avviati.

   ```sh
   npm run seed-demo -- --emulatore
   ```

   L'output elenca gli utenti demo, la password e i sei mesi creati (per ciascun reparto: due convalidati
   e uno in bozza). Il comando termina con codice 0.

4. Aprire il browser su <http://localhost:4200> e accedere con uno degli utenti demo:

   | Ruolo                     | Email                           | Password          |
   | ------------------------- | ------------------------------- | ----------------- |
   | ADMIN                     | `admin.demo@prova.example`      | `Password-demo-1` |
   | COORDINATORE di Medicina  | `coord.medicina@prova.example`  | `Password-demo-1` |
   | COORDINATORE di Chirurgia | `coord.chirurgia@prova.example` | `Password-demo-1` |

   La console degli emulatori (dati, utenti, registro delle funzioni) è su <http://127.0.0.1:4000>.

Per fermare tutto: `Ctrl+C` nel terminale 1. Gli emulatori non salvano i dati: alla ripartenza il
database è vuoto, e il seed va rifatto.

## Dati dimostrativi

`npm run seed-demo -- --emulatore` crea:

- un ADMIN (con lo stesso percorso dello script `crea-primo-admin`) e due coordinatori, creati con la callable
  `creaCoordinatore`; i dipendenti passano dalla callable `salvaDipendente` e i due mesi precedenti vengono
  convalidati con `convalidaMese`, così come farebbe l'app;
- due reparti, «Medicina (dati demo)» e «Chirurgia (dati demo)», ciascuno con i turni M1, P1, N1, G1, le
  reperibilità R1 e R2, le assenze R (riposo), MA (malattia) e F (ferie);
- 12 dipendenti per reparto, con nomi di fantasia e codici fiscali formalmente validi ma inventati; un
  dipendente di Chirurgia esclude il turno notturno;
- tre mesi per reparto: i due mesi precedenti convalidati e il mese corrente in bozza. Sono presenti riposi,
  malattie, sostituzioni, un turno scoperto, variazioni di orario e reperibilità con chiamate.

Il mese corrente non contiene solo il turno scoperto: ha anche altri avvisi, voluti per provare il pannello
**Avvisi** (per esempio reperibilità oltre il limite, reperibilità sovrapposta a un turno, riposo sotto le
11 ore). Alcuni saldi della banca ore sono volutamente estremi, per vedere come appaiono.

Il seed rifiuta di partire senza `--emulatore` e rifiuta di scrivere in un database che contiene già dati:
per ricrearli si usa `npm run seed-demo -- --emulatore --svuota`, che svuota prima Auth e Firestore
dell'emulatore. Non ha nessuna opzione per un progetto reale: gli host sono forzati su `127.0.0.1` e il
progetto è `demo-turni`.

## Comandi

| Comando                                                                        | Effetto                                                                      |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `npm install`                                                                  | installa le dipendenze di tutti i workspace                                  |
| `npm run dev`                                                                  | emulatori e applicazione web collegata agli emulatori (`USE_EMULATORS=true`) |
| `npm run emulators`                                                            | solo la suite di emulatori (Auth, Firestore, Functions, Storage, Hosting)    |
| `npm run seed-demo -- --emulatore`                                             | dati dimostrativi sugli emulatori già avviati (`--svuota` per ricrearli)     |
| `npm run crea-primo-admin -- --emulatore --email <e> --nome <n> --cognome <c>` | primo ADMIN sugli emulatori                                                  |
| `npm run lint`                                                                 | ESLint e Prettier su tutto il repository                                     |
| `npm run typecheck`                                                            | `tsc --noEmit` su tutti i workspace                                          |
| `npm test`                                                                     | test unitari senza emulatori (dominio, web, functions)                       |
| `npm run test:rules`                                                           | test sull'emulatore: Security Rules e Functions (`*.emu.test.ts`)            |
| `npm run build`                                                                | build di dominio, Functions (esbuild) e applicazione web                     |

`npm run test:rules` avvia da sé gli emulatori sulle stesse porte: prima chiudere `npm run dev` o
`npm run emulators`, altrimenti le porte sono occupate.

## Configurazione locale

Nessun file con segreti è necessario per l'emulatore. Il repository contiene due file di esempio:

- `functions/.env.local` (versionato): parametri delle Functions sull'emulatore. Senza questo file la CLI
  Firebase chiede i valori a ogni avvio e blocca `npm run emulators` e `npm run test:rules`. Contiene:
  - `KMS_CHIAVE_DIPENDENTI`: valore segnaposto. Sull'emulatore la cifratura dei dati dei dipendenti è
    quella locale non sicura, che non usa questa chiave;
  - `POSTA_MITTENTE`: vuoto, cioè il mittente configurato nell'estensione Trigger Email;
  - `PULIZIA_MODALITA_PROVA=true`: la pulizia notturna dei dipendenti cessati elenca soltanto e non
    cancella. Su un progetto reale questo valore si decide al deploy.
- `functions/.secret.local` (facoltativo, ignorato da git): riga `HMAC_CF_CHIAVE=<almeno 32 caratteri>`
  per usare una chiave HMAC propria sull'emulatore. Senza il file vale una chiave di prova dichiarata non
  sicura nel codice.
- `.env.example` (versionato): variabili dell'applicazione web per un progetto Firebase reale. Per
  l'emulatore non servono: basta `USE_EMULATORS=true`, che `npm run dev` imposta da sé. Il file `.env`
  non va mai committato.

## Struttura del repository

```
apps/web/            interfaccia Angular (src/app: pagine, dati, funzioni, core, ui, testi)
functions/           Cloud Functions (src: utenti, dipendenti, mesi, report, manutenzione; test)
packages/domain/     regole di dominio: calcolo di ore, saldi, griglia, report, registro
scripts/             seed-demo.ts, crea-primo-admin.ts, genera-ambiente-web.ts
tests/regole/        Security Rules sull'emulatore
docs/                documentazione di progetto, guida del coordinatore, handoff degli step
firebase.json        emulatori, hosting (intestazioni di sicurezza), Functions, Firestore, Storage
firestore.rules      regole di Firestore (solo forma e autorizzazione)
storage.rules        regole di Storage (nessun accesso dal browser)
```

## Sicurezza e deploy

- **Non fare deploy da questo repository senza una preparazione.** Il file `.firebaserc` punta a un
  progetto reale: i comandi `firebase` vanno sempre con `--project demo-turni` quando si lavora sugli
  emulatori. `npm run emulators` lo fa già.
- I dati personali dei dipendenti (codice fiscale, data di nascita, email) non entrano nei log né nei
  documenti leggibili dal browser: restano cifrati in `privato/dati`.
- Gli ADMIN e i coordinatori dei dati demo non sono reali. Le password demo funzionano solo sugli
  emulatori.

Preparazione al deploy, da eseguire a mano e non ancora eseguita. L'elenco unico e completo, con i valori, è in
`docs/DEPLOY.md` (audit 4.4); in sintesi:

1. progetto Firebase su piano Blaze, con avviso di spesa; `.firebaserc` confermato come progetto di produzione;
2. API abilitate (Functions, Cloud Build, Artifact Registry, Cloud Run, Eventarc, Pub/Sub, Cloud Scheduler,
   Secret Manager, Cloud KMS, Firestore, Storage);
3. database `(default)` e bucket di Storage in `europe-west12` (irreversibile; per una demo con dati fittizi il bucket può stare
   in `us-central1`, vedi `docs/DEPLOY.md`);
4. key ring e chiave KMS in `europe-west12`, con il ruolo `cryptoKeyEncrypterDecrypter` per il service
   account delle Functions;
5. secret `HMAC_CF_CHIAVE` con replica gestita in `europe-west12`, con una chiave casuale di almeno 32
   caratteri, da non ruotare;
6. parametri delle Functions in `functions/.env.<progetto>` (non in `.env.local`, che vale solo per
   l'emulatore): `KMS_CHIAVE_DIPENDENTI`, `PULIZIA_MODALITA_PROVA` (resta `true` finché le notti di prova non
   sono controllate), `POSTA_MITTENTE`;
7. `.env` alla radice con `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`,
   `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID` e `USE_EMULATORS=false`: il
   predeploy di Hosting fallisce se ne manca una;
8. Authentication: Email/Password, **creazione di account da parte degli utenti disattivata**, protezione
   dall'enumerazione delle email, politica delle password, MFA per l'ADMIN, domini autorizzati, modello
   dell'email di reimpostazione in italiano;
9. politica TTL su `mail.scadeIl` (si crea con il deploy di `firestore.indexes.json`, da verificare in console);
10. backup giornaliero programmato di Firestore (7 giorni);
11. estensione Trigger Email (o altro servizio di posta) per l'invio dei report;
12. **CSP da restringere** in `firebase.json` (oggi ammette `*.run.app`, `localhost` e `127.0.0.1`);
13. primo ADMIN con `npm run crea-primo-admin`; JDK 21 e `firebase-tools@15` sulla macchina del deploy.

Conservazione dei dati (da confermare con chi li tratta): con il dipendente cessato da 5 anni si cancellano
documento, dati riservati e indice del codice fiscale. Righe, riepiloghi, banca ore, report e registro restano,
senza scadenza, legati all'ID anonimo, compresi i codici di assenza per malattia (dati sulla salute,
pseudonimi): vedi `docs/ARCHITETTURA.md` §16 e `docs/DEPLOY.md` §5.

## Risoluzione dei problemi

- **`npm run seed-demo` dice che un emulatore non risponde**: `npm run dev` (o `npm run emulators`) non è
  ancora pronto. Attendere `All emulators ready` e riprovare.
- **«Negli emulatori ci sono già dati»**: rilanciare con `npm run seed-demo -- --emulatore --svuota`.
- **Porta già in uso** (4000, 4200, 5001, 5002, 8080, 9099, 9150, 9199): chiudere il processo che la
  occupa. Le porte sono in `firebase.json` e nella configurazione di Angular.
- **Emulatori che non partono con errori di Java**: verificare `java -version` (17 o successivo).
- **Accesso rifiutato con le credenziali demo**: il seed non è stato rilanciato dopo un riavvio degli
  emulatori. Gli emulatori ripartono vuoti.

## Licenza

Copyright (C) 2026 Antonio Amoroso e Giovanni Michele Tetta

Questo programma è software libero: puoi ridistribuirlo e modificarlo secondo i termini della **GNU Affero
General Public License** pubblicata dalla Free Software Foundation, versione 3 della Licenza o, a tua scelta,
qualsiasi versione successiva. Il testo completo è nel file [LICENSE](LICENSE).

Il programma è distribuito nella speranza che sia utile, ma **senza alcuna garanzia**, nemmeno implicita di
commerciabilità o di idoneità a uno scopo particolare. Il gestionale tratta dati di lavoratori: chi lo mette
in servizio è responsabile della conformità alla normativa sulla protezione dei dati.

Poiché è un'applicazione web, la AGPL (sezione 13) richiede che chi ne offre una versione **modificata** agli
utenti in rete metta a loro disposizione il codice sorgente corrispondente, per esempio con un collegamento
al repository nell'interfaccia. Le dipendenze usano licenze compatibili (MIT, Apache-2.0, 0BSD; il carattere
Inter è sotto SIL OFL 1.1).
