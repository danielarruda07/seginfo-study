/**
 * Criptografia do Cofre — Web Crypto API nativa, sem dependências.
 * AES-GCM (confidencialidade + autenticidade) com chave derivada por PBKDF2.
 * A senha-mestra NUNCA é persistida; só a chave derivada vive em memória na sessão.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Bytes do Web Crypto: sempre sobre ArrayBuffer (nunca SharedArrayBuffer). */
export type Bytes = Uint8Array<ArrayBuffer>;

function toB64(data: ArrayBuffer | Bytes): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  // loop em vez de spread: evita estourar a pilha com cofres grandes
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
export function fromB64(b64: string): Bytes {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

const PBKDF2_ITERATIONS = 310_000; // recomendação OWASP para PBKDF2-SHA256

/** Deriva uma CryptoKey AES-GCM a partir da senha-mestra e do salt. */
export async function deriveKey(masterPassword: string, salt: Bytes): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(masterPassword), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function randomBytes(len: number): Bytes {
  return crypto.getRandomValues(new Uint8Array(len));
}

/** Cifra um objeto JSON -> { salt, iv, ciphertext } em base64. */
export async function encryptJSON(data: unknown, key: CryptoKey, salt: Bytes): Promise<{ salt: string; iv: string; ciphertext: string }> {
  const iv = randomBytes(12);
  const plaintext = enc.encode(JSON.stringify(data));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return { salt: toB64(salt), iv: toB64(iv), ciphertext: toB64(ct) };
}

/** Decifra um blob -> objeto JSON. Lança se a senha-mestra estiver errada (tag GCM inválida). */
export async function decryptJSON<T>(blob: { iv: string; ciphertext: string }, key: CryptoKey): Promise<T> {
  const iv = fromB64(blob.iv);
  const ct = fromB64(blob.ciphertext);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return JSON.parse(dec.decode(pt)) as T;
}

