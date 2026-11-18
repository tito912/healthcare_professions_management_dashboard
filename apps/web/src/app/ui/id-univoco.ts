let contatore = 0;

/** ID univoco per collegare etichette, descrizioni ed errori (`aria-describedby`, `for`). */
export function idUnivoco(prefisso: string): string {
  contatore += 1;
  return `${prefisso}-${contatore}`;
}
