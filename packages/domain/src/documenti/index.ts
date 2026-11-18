// Tipi dei documenti Firestore (ARCHITETTURA §5). Percorsi:
//   utenti/{uid}                                              UtenteDoc
//   reparti/{rid}                                             RepartoDoc
//   reparti/{rid}/turni/{codice}                              TurnoDoc
//   reparti/{rid}/assenze/{codice}                            TipologiaAssenzaDoc
//   reparti/{rid}/dipendenti/{did}                            DipendenteDoc
//   reparti/{rid}/dipendenti/{did}/privato/dati               DatiPrivatiDoc
//   reparti/{rid}/mesi/{chiaveMese}                           MeseDoc
//   reparti/{rid}/mesi/{chiaveMese}/righe/{did}               RigaDoc
//   reparti/{rid}/riepiloghi/{chiaveMese}_{did}               RiepilogoMensileDoc
//   reparti/{rid}/bancaOre/{anno}_{did}                       BancaOreDoc
//   reparti/{rid}/report/{idBimestre}                         ReportDoc
//   reparti/{rid}/registroAttivita/{voceId}, registroAttivita/{voceId}   VoceRegistroDoc
//   indiceCodiciFiscali/{hmac}                                IndiceCodiceFiscaleDoc
//   mail/{mailId}                                             MailDoc
export * from './utente';
export * from './reparto';
export * from './turno';
export * from './assenza';
export * from './dipendente';
export * from './mese';
export * from './derivati';
export * from './registro';
