// Cifratura con Cloud KMS (ARCHITETTURA §5.6, §8): `encrypt` e `decrypt` con i dati autenticati aggiuntivi (AAD).
// Il testo da cifrare non passa mai nei log né nei messaggi d'errore.
import type { Cifratore, TestoCifrato } from './cifratore';

/** Parte del client KMS che serve qui (il client vero la soddisfa; nei test si sostituisce). */
export interface ClienteKms {
  encrypt(richiesta: {
    name: string;
    plaintext: Uint8Array;
    additionalAuthenticatedData: Uint8Array;
  }): Promise<
    readonly [{ ciphertext?: Uint8Array | string | null; name?: string | null }, ...unknown[]]
  >;
  decrypt(richiesta: {
    name: string;
    ciphertext: Uint8Array;
    additionalAuthenticatedData: Uint8Array;
  }): Promise<readonly [{ plaintext?: Uint8Array | string | null }, ...unknown[]]>;
}

function inByte(valore: Uint8Array | string | null | undefined): Buffer {
  if (valore === undefined || valore === null) {
    throw new Error('Risposta KMS senza contenuto.');
  }
  return typeof valore === 'string' ? Buffer.from(valore, 'base64') : Buffer.from(valore);
}

/** Il client si crea al primo uso e si importa solo allora: caricare le funzioni non apre connessioni gRPC. */
async function clienteKmsPredefinito(): Promise<ClienteKms> {
  const { KeyManagementServiceClient } = await import('@google-cloud/kms');
  return new KeyManagementServiceClient();
}

export class CifratoreKms implements Cifratore {
  private cliente: Promise<ClienteKms> | undefined;

  constructor(
    /** Nome completo della chiave (`projects/…/cryptoKeys/…`). */
    private readonly chiave: string,
    private readonly creaCliente: () => Promise<ClienteKms> = clienteKmsPredefinito,
  ) {}

  private clienteKms(): Promise<ClienteKms> {
    this.cliente ??= this.creaCliente();
    return this.cliente;
  }

  async cifra(testo: string, aad: string): Promise<TestoCifrato> {
    const cliente = await this.clienteKms();
    const [risposta] = await cliente.encrypt({
      name: this.chiave,
      plaintext: Buffer.from(testo, 'utf8'),
      additionalAuthenticatedData: Buffer.from(aad, 'utf8'),
    });
    return {
      cifrato: inByte(risposta.ciphertext).toString('base64'),
      // La versione della chiave usata, se KMS la indica (utile alla rotazione); altrimenti la chiave.
      chiave: risposta.name ?? this.chiave,
    };
  }

  async decifra(cifratoBase64: string, aad: string): Promise<string> {
    const cliente = await this.clienteKms();
    const [risposta] = await cliente.decrypt({
      name: this.chiave,
      ciphertext: Buffer.from(cifratoBase64, 'base64'),
      additionalAuthenticatedData: Buffer.from(aad, 'utf8'),
    });
    return inByte(risposta.plaintext).toString('utf8');
  }
}
