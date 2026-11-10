import {
  constants, createCipheriv, createDecipheriv, privateDecrypt, publicEncrypt, randomBytes,
} from 'node:crypto';

/**
 * Criptografia do armazenamento externo.
 *
 * 1) Segredos em repouso (refresh token do OneDrive): AES-256-GCM com STORAGE_TOKEN_KEY.
 * 2) Backups: criptografia HÍBRIDA. Uma chave AES-256 aleatória por backup cifra os dados
 *    (AES-GCM) e é ela mesma cifrada com a chave PÚBLICA RSA-OAEP-SHA256. O servidor só tem
 *    a chave pública: consegue cifrar, NÃO consegue decifrar. A chave privada fica com o dono,
 *    fora do lab. Se o servidor for perdido ou invadido, os backups continuam ilegíveis.
 *
 * Formato do backup (.sgb): "SGB1" | len(2, BE) | chaveAESCifrada | iv(12) | tag(16) | dados
 */

function chaveToken(): Buffer {
  const b64 = process.env.STORAGE_TOKEN_KEY;
  if (!b64) throw new Error('STORAGE_TOKEN_KEY não configurada');
  const k = Buffer.from(b64, 'base64');
  if (k.length !== 32) throw new Error('STORAGE_TOKEN_KEY deve ter 32 bytes em base64 (openssl rand -base64 32)');
  return k;
}

/** Cifra um segredo curto para guardar no banco. Saída: base64(iv | tag | ciphertext). */
export function cifrarSegredo(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', chaveToken(), iv);
  const ct = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}

export function decifrarSegredo(b64: string): string {
  const raw = Buffer.from(b64, 'base64');
  const d = createDecipheriv('aes-256-gcm', chaveToken(), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
}

/** Lê a chave PÚBLICA do ambiente. Recusa explicitamente uma chave privada por engano. */
export function chavePublica(): string {
  const b64 = process.env.BACKUP_PUBLIC_KEY_B64;
  if (!b64) throw new Error('BACKUP_PUBLIC_KEY_B64 não configurada');
  const pem = Buffer.from(b64, 'base64').toString('utf8');
  if (/PRIVATE KEY/.test(pem)) {
    throw new Error('BACKUP_PUBLIC_KEY_B64 contém uma chave PRIVADA. Use somente a chave pública no servidor.');
  }
  if (!/BEGIN PUBLIC KEY/.test(pem)) throw new Error('BACKUP_PUBLIC_KEY_B64 inválida (esperado PEM de chave pública).');
  return pem;
}

const MAGIC = Buffer.from('SGB1');
const OAEP = { padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' } as const;

export function cifrarBackup(dados: Buffer, publicKeyPem: string): Buffer {
  const chaveDados = randomBytes(32);
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', chaveDados, iv);
  const ct = Buffer.concat([c.update(dados), c.final()]);
  const tag = c.getAuthTag();
  const chaveCifrada = publicEncrypt({ key: publicKeyPem, ...OAEP }, chaveDados);
  const len = Buffer.alloc(2);
  len.writeUInt16BE(chaveCifrada.length);
  return Buffer.concat([MAGIC, len, chaveCifrada, iv, tag, ct]);
}

/** Usado pela ferramenta de restauração (com a chave privada, offline). */
export function decifrarBackup(blob: Buffer, privateKeyPem: string, passphrase?: string): Buffer {
  if (!blob.subarray(0, 4).equals(MAGIC)) throw new Error('Arquivo não é um backup SegInfo (cabeçalho SGB1 ausente).');
  const tamChave = blob.readUInt16BE(4);
  let o = 6;
  const chaveCifrada = blob.subarray(o, o + tamChave); o += tamChave;
  const iv = blob.subarray(o, o + 12); o += 12;
  const tag = blob.subarray(o, o + 16); o += 16;
  const ct = blob.subarray(o);
  const chaveDados = privateDecrypt({ key: privateKeyPem, passphrase, ...OAEP }, chaveCifrada);
  const d = createDecipheriv('aes-256-gcm', chaveDados, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]);
}
