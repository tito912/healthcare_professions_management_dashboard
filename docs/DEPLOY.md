# Preparazione al deploy: elenco unico

Elenco unico dei parametri, dei secret e delle impostazioni da preparare **a mano** prima del primo deploy su un progetto Firebase reale. Nasce
dall'audit 4.4 (rilievo I4); i riferimenti `L…` e `D…` sono in `docs/DECISIONI.md`, le sezioni `§…` in `docs/ARCHITETTURA.md`.
Nulla di quanto segue è stato eseguito: la pipeline lavora solo sugli emulatori e non fa deploy.

## 1. Parametri delle Functions

Definiti in `functions/src/comune/parametri.ts`. I valori vanno in `functions/.env.<id-progetto>`, mai in `functions/.env.local`, che vale solo
per l'emulatore e non viene caricato al deploy.

| Nome | Tipo | Valore richiesto | Note |
|---|---|---|---|
| `KMS_CHIAVE_DIPENDENTI` | stringa, default vuoto | `projects/<p>/locations/europe-west12/keyRings/<anello>/cryptoKeys/<chiave>` (il nome della chiave, non di una versione: serve anche al `decrypt`) | Vuoto = `salvaDipendente` e `leggiDatiPrivati` rispondono ERRORE_INTERNO (voluto e sicuro, ma blocca l'anagrafica). API Cloud KMS abilitata; ruolo `roles/cloudkms.cryptoKeyEncrypterDecrypter` sulla chiave al service account di esecuzione delle Functions di 2a generazione (di default `<numero>-compute@developer.gserviceaccount.com`) |
| `HMAC_CF_CHIAVE` | secret (Secret Manager) | stringa casuale di almeno 32 caratteri (per esempio 64 esadecimali) | **Crearlo prima del deploy** con replica gestita in `europe-west12` (`--replication-policy=user-managed --locations=europe-west12`), altrimenti la CLI lo crea con replica automatica (L30). Il deploy concede `secretAccessor` alla funzione. **Non ruotarlo**: con una chiave nuova gli HMAC esistenti non corrispondono più e i doppioni non si riconoscono |
| `PULIZIA_MODALITA_PROVA` | booleano, default `true` | `true` al primo deploy | Va a `false` (nuovo deploy di `pulisciCessati`) solo dopo alcune notti di prova con i log «Pulizia in prova» e la voce di registro `pulizia.eseguita` controllati. La correzione dell'audit I1 (conferma della cessazione retroattiva, periodo di grazia di 30 giorni, rilettura in transazione) è già nel codice |
| `POSTA_MITTENTE` | stringa, default vuoto | indirizzo mittente autorizzato dal fornitore SMTP, oppure vuoto (vale quello dell'estensione) | Domanda D-E3 |

## 2. Build dell'app web

Il file `.env` alla radice (mai in git) è letto da `scripts/genera-ambiente-web.ts` a ogni build:

- `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`,
  `FIREBASE_APP_ID`: dalla configurazione dell'app web nella console Firebase;
- `USE_EMULATORS=false`;
- `FINESTRA_MESI_MODIFICABILI` vuoto (= 2, D8).

Il predeploy di Hosting (`firebase.json`) è `npm run build:deploy -w @turni/web`. Lo script `build:deploy` (in `apps/web/package.json`) lancia
`genera-ambiente-web.ts --deploy` e poi `ng build`: con `--deploy` lo script **fallisce** (exit 1, quindi il predeploy e il deploy si fermano), con
l'elenco dei nomi mancanti (mai i valori), se manca una variabile `FIREBASE_*` o se `USE_EMULATORS=true`. Senza `--deploy` (`npm run build`,
sviluppo, test) manca solo un avviso. Il comando di predeploy non contiene `=`: la CLI Firebase passa la riga a `cross-env-shell` come un solo
argomento e una riga con `=` non verrebbe eseguita ma uscirebbe con 0 (audit 4.4, R1); `tests/regole/predeploy-hosting.test.ts` lo verifica.

## 3. Progetto e servizi, da fare a mano, in quest'ordine

1. Confermare che `.firebaserc` (`helthcare-managment-syst-f18d6`) è il progetto di produzione (domanda D-E5); piano Blaze; **avviso di spesa**
   sul progetto (la stima delle letture, §11, ha poco margine rispetto alla quota gratuita).
2. API da abilitare: Cloud Functions, Cloud Build, Artifact Registry, Cloud Run, Eventarc, Pub/Sub, Cloud Scheduler, Secret Manager, Cloud KMS,
   Firestore, Storage.
3. Firestore `(default)`, edizione Standard, località **`europe-west12`** (irreversibile).
4. Bucket di Storage predefinito in **`europe-west12`** (irreversibile). **Eccezione per la demo con dati fittizi**: si può creare in
   `us-central1` per usare la quota gratuita di Cloud Storage (solo `us-east1`, `us-west1` e `us-central1`); il nome si imposta in
   `FIREBASE_STORAGE_BUCKET` e il codice non dipende dalla regione. Con dati reali (nomi nei report Excel) il bucket deve stare in Europa:
   si crea un bucket nuovo in `europe-west12` e si migrano i file, perché la regione non si cambia.
5. Anello di chiavi e chiave KMS in `europe-west12`, con il permesso al service account (§1).
6. Secret `HMAC_CF_CHIAVE` con replica in `europe-west12` (§1).
7. Authentication:
   - provider Email/Password attivo;
   - **creazione di account da parte degli utenti disattivata** (la registrazione libera permetterebbe a chiunque di occupare in anticipo l'email di un
     futuro coordinatore; handoff 1.1, domanda 2);
   - protezione dall'enumerazione delle email attiva;
   - politica delle password;
   - MFA per l'ADMIN (richiede Identity Platform, L40);
   - domini autorizzati = dominio di Hosting;
   - modello dell'email di reimpostazione della password in italiano.
8. Deploy di regole e indici, che comprende la **politica TTL** su `mail.scadeIl` (documenti della coda `mail` eliminati dopo 30 giorni, L17):
   verificarla in console (TTL attivo).
9. Backup programmati giornalieri di Firestore con conservazione di 7 giorni (L19).
10. Estensione Trigger Email (o altro servizio, D12) in `europe-west12`, raccolta `mail`, credenziali SMTP nel suo secret.
    I parametri stanno in `extensions/firestore-send-email.env`, **non versionato** (mittente, login SMTP e numero del progetto);
    `extensions/firestore-send-email.env.example` ha i segnaposto. Passi: `npx firebase ext:install firebase/firestore-send-email
    --project <id>` (o copia dell'esempio), poi `npx firebase ext:configure firestore-send-email` per la chiave SMTP (campo «SMTP
    password», con Spazio su «Google Cloud Secret Manager»), poi `npx firebase deploy --only extensions`. Il mittente deve essere
    verificato presso il fornitore SMTP e, per la consegna, su un dominio proprio con DKIM e DMARC (un indirizzo gmail.com può finire
    in spam).
11. **CSP ristretta** in `firebase.json` prima del deploy di Hosting: oggi `connect-src` ammette `https://*.run.app`, `http://127.0.0.1:*` e
    `http://localhost:*` (utili agli emulatori). In produzione sostituire con `'self' https://firestore.googleapis.com
    https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://europe-west12-<progetto>.cloudfunctions.net` (audit M3).
    `style-src 'unsafe-inline'` resta necessario con Angular senza nonce.
12. Primo ADMIN: `npm run crea-primo-admin -- --project <id> --email … --nome … --cognome …`, con le credenziali predefinite dell'applicazione di chi
    lo esegue.
13. JDK 21 e `firebase-tools@15.x` sulla macchina del deploy (audit M11): oggi è fissato `firebase-tools@14.27.0` per Java 17.

## 4. Verifiche dopo il primo deploy

Non verificabili sugli emulatori:

- una transazione di «Salva bozza» con 40 righe passa: il limite di 20 accessi delle regole vale anche in produzione (`MAX_RIGHE_PER_TRANSAZIONE`);
- i job di Cloud Scheduler sono in `europe-west12` con `Europe/Rome`;
- `salvaDipendente` e `leggiDatiPrivati` funzionano con KMS vero (`chiaveKms` = versione della chiave);
- nessuna violazione della CSP in console con i servizi veri, compreso lo scarico dell'Excel;
- gli indici compositi del registro bastano per le combinazioni di filtri;
- l'installazione delle dipendenze delle Functions senza lockfile (Cloud Build esegue `npm install` nella sola cartella `functions`, audit M12);
- `PULIZIA_MODALITA_PROVA` resta `true` finché le notti di prova non sono controllate.

## 5. Conservazione dei dati e privacy: decisioni da prendere con chi tratta i dati

Vedi `docs/ARCHITETTURA.md` §16 (conservazione). In sintesi, oggi:

- cancellati con il dipendente, 5 anni dopo la cessazione (e dopo 30 giorni dall'ultimo salvataggio del dipendente): documento, `privato/dati`
  (codice fiscale, data di nascita, email) e indice HMAC;
- **non cancellati**: righe dei mesi, riepiloghi, banca ore, report e voci del registro che portano l'ID del dipendente, compresi i codici di
  assenza per malattia (`MA`), senza scadenza (L3, L18). Sono dati pseudonimi sulla salute: decidere e mettere per iscritto la conservazione
  (domanda D-B1 dell'audit; default: nessuna modifica);
- file Excel dei report: 365 giorni; documenti `mail`: 30 giorni; log di Cloud Logging: 30 giorni; backup: 7 giorni.
- la **stampa del mese** non mostra le malattie (le assenze neutre sono «Ass.») né i saldi ore individuali (audit I3; domanda D-B6).
