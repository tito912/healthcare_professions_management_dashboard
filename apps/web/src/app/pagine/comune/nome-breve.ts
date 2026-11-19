// Funzione pura condivisa da griglia, banca ore e report. Sta fuori da `griglia/` perché quel modulo importa i testi
// della griglia (`testi/it-griglia`): un modulo condiviso non deve trascinare i testi di una sola pagina.

/** «Rossi M.»: cognome e iniziale del nome (UX §7.6). */
export function nomeBreve(cognome: string, nome: string): string {
  const iniziale = nome.trim().charAt(0).toUpperCase();
  return iniziale === '' ? cognome : `${cognome} ${iniziale}.`;
}
