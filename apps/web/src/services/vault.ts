import { VaultBlobSchema, type VaultEntry, type VaultBlob } from '@seginfo/shared';
import { deriveKey, encryptJSON, decryptJSON, randomBytes, fromB64, type Bytes } from './crypto';
import { read, write, removeKey, uid, registerSchema } from './store';
import { cofre2fa } from './cofre2fa';
import { z } from 'zod';

/**
 * Cofre cifrado. O estado em disco é apenas um VaultBlob (ciphertext).
 * A chave derivada e as entradas decifradas vivem SÓ em memória, enquanto a
 * sessão estiver "destravada". Travar = descartar a chave da memória.
 */

const BLOB_KEY = 'vault:blob';
const TIMEOUT_KEY = 'vault:autolock-min'; // minutos de inatividade (config do usuário)
const DEFAULT_TIMEOUT_MIN = 5;
const FAILED_UNLOCKS_KEY = 'vault:failed-unlocks';
registerSchema(BLOB_KEY, { safeParse: (v) => VaultBlobSchema.nullable().safeParse(v) });
registerSchema(TIMEOUT_KEY, { safeParse: (v) => z.number().int().min(0).max(120).safeParse(v) });
registerSchema(FAILED_UNLOCKS_KEY, { safeParse: (v) => z.object({ count: z.number().int().nonnegative(), at: z.number().nonnegative() }).safeParse(v) });
const LOCKOUT_BASE_MS = 1_000;
const LOCKOUT_MAX_MS = 30_000;

function failedUnlocks(): { count: number; at: number } { return read(FAILED_UNLOCKS_KEY, { count: 0, at: 0 }); }
export function unlockWaitSeconds(): number {
  const failed = failedUnlocks();
  const delay = Math.min(LOCKOUT_BASE_MS * (2 ** Math.max(0, failed.count - 1)), LOCKOUT_MAX_MS);
  return Math.max(0, Math.ceil((delay - (Date.now() - failed.at)) / 1000));
}

let sessionKey: CryptoKey | null = null;
let sessionSalt: Bytes | null = null;
let cache: VaultEntry[] = [];

// ---- Auto-lock (sugestão 2) ----
let idleTimer: ReturnType<typeof setTimeout> | null = null;
const lockListeners = new Set<() => void>();

/** Avisa a UI quando o cofre trava sozinho. Retorna função para cancelar a inscrição. */
export function onLock(fn: () => void): () => void {
  lockListeners.add(fn);
  return () => lockListeners.delete(fn);
}

export function getAutoLockMinutes(): number {
  return read<number>(TIMEOUT_KEY, DEFAULT_TIMEOUT_MIN);
}
export function setAutoLockMinutes(min: number): void {
  write(TIMEOUT_KEY, min);
  if (isUnlocked()) resetIdleTimer();
}

function clearIdleTimer(): void {
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
}

/** Reinicia a contagem de inatividade; chamado a cada atividade do usuário. */
export function resetIdleTimer(): void {
  if (!isUnlocked()) return;
  clearIdleTimer();
  const min = getAutoLockMinutes();
  if (min <= 0) return; // 0 = sem trava automática por tempo
  idleTimer = setTimeout(() => lock(), min * 60_000);
}

// ---- Modo servidor (segundo fator ativo) ----
// Com o 2FA ligado, o blob mora SÓ no servidor e só é entregue depois de um código válido.
// Este marcador (não secreto) só lembra o modo; nenhuma cópia do blob fica no navegador.
const SERVIDOR_KEY = 'vault:servidor';
registerSchema(SERVIDOR_KEY, { safeParse: (v) => z.boolean().safeParse(v) });
/** Data da versão do servidor que está carregada; vai junto no PUT para detectar conflito. */
let servidorBase: string | null = null;

export function modoServidor(): boolean {
  return read<boolean>(SERVIDOR_KEY, false);
}
export function definirModoServidor(on: boolean): void {
  if (on) write(SERVIDOR_KEY, true); else removeKey(SERVIDOR_KEY);
}
/** Há cópia do blob neste navegador (modo local, ou resto antigo de antes do 2FA)? */
export function temCopiaLocal(): boolean {
  return read<VaultBlob | null>(BLOB_KEY, null) !== null;
}
export function apagarCopiaLocal(): void {
  removeKey(BLOB_KEY);
}

export function isInitialized(): boolean {
  return modoServidor() || temCopiaLocal();
}

export function isUnlocked(): boolean {
  return sessionKey !== null;
}

/**
 * Destrava com o blob baixado do servidor (depois do código do autenticador).
 * `blob` null = servidor sem cofre ainda. Retorna false se a senha estiver errada.
 */
export async function unlockServidor(masterPassword: string, blob: (VaultBlob & { atualizadoEm?: string }) | null): Promise<boolean> {
  if (!blob) return false;
  const ok = await unlock(masterPassword, blob);
  if (ok) servidorBase = blob.atualizadoEm ?? null;
  return ok;
}

/** Cria o primeiro cofre direto no servidor (aparelho novo, 2FA ativo e servidor vazio). */
export async function initVaultServidor(masterPassword: string): Promise<void> {
  servidorBase = null;
  await initVault(masterPassword);
}

/** Blob cifrado do cofre destravado, para ir junto na ativação do 2FA. */
export async function blobAtual(): Promise<VaultBlob> {
  assertUnlocked();
  return { versao: 1, ...(await encryptJSON(cache, sessionKey!, sessionSalt!)) };
}

/**
 * Depois que o servidor confirmou a ativação (e guardou o blob na mesma operação):
 * liga o modo servidor e apaga a cópia deste navegador.
 */
export function concluirMigracao(atualizadoEm: string): void {
  servidorBase = atualizadoEm;
  definirModoServidor(true);
  apagarCopiaLocal();
}

/** Antes de desligar o 2FA: grava a cópia local e sai do modo servidor. */
export async function voltarParaLocal(): Promise<void> {
  assertUnlocked();
  const blob = await encryptJSON(cache, sessionKey!, sessionSalt!);
  write<VaultBlob>(BLOB_KEY, { versao: 1, ...blob });
  definirModoServidor(false);
}

/** Cria um cofre novo com a senha-mestra escolhida. */
export async function initVault(masterPassword: string): Promise<void> {
  const salt = randomBytes(16);
  const key = await deriveKey(masterPassword, salt);
  sessionKey = key;
  sessionSalt = salt;
  cache = [];
  await persist();
  resetIdleTimer();
}

/** Destrava um cofre existente (o local, ou o `externo` vindo do servidor). Retorna false se a senha estiver errada. */
export async function unlock(masterPassword: string, externo?: VaultBlob): Promise<boolean> {
  const waitMs = unlockWaitSeconds() * 1000;
  if (waitMs > 0) { await new Promise((resolve) => setTimeout(resolve, waitMs)); }
  const blob = externo ?? read<VaultBlob | null>(BLOB_KEY, null);
  if (!blob) return false;
  const salt = fromB64(blob.salt);
  const key = await deriveKey(masterPassword, salt);
  let entries: VaultEntry[];
  try {
    entries = await decryptJSON<VaultEntry[]>(blob, key);
  } catch {
    // tag GCM inválida => senha errada
    const failed = failedUnlocks();
    write(FAILED_UNLOCKS_KEY, { count: failed.count + 1, at: Date.now() });
    return false;
  }
  sessionKey = key;
  sessionSalt = salt;
  cache = entries;
  resetIdleTimer();
  removeKey(FAILED_UNLOCKS_KEY);
  return true;
}

/** Trava o cofre: descarta a chave e as entradas da memória. */
export function lock(): void {
  sessionKey = null;
  sessionSalt = null;
  cache = [];
  clearIdleTimer();
  lockListeners.forEach((fn) => fn());
}

function assertUnlocked(): void {
  if (!sessionKey || !sessionSalt) throw new Error('Cofre travado.');
}

async function persist(): Promise<void> {
  assertUnlocked();
  const blob = await encryptJSON(cache, sessionKey!, sessionSalt!);
  if (modoServidor()) {
    // falha (sessão expirada, conflito, rede) sobe para a tela, que pede o código ou recarrega
    servidorBase = await cofre2fa.gravarBlob({ versao: 1, ...blob }, servidorBase);
    return;
  }
  write<VaultBlob>(BLOB_KEY, { versao: 1, ...blob });
}

export function listEntries(): VaultEntry[] {
  assertUnlocked();
  return [...cache].sort((a, b) => a.titulo.localeCompare(b.titulo));
}

/** Guarda uma entrada. O segredo é passado à parte e cifrado junto no blob. */
export async function saveEntry(entry: Omit<VaultEntry, 'id' | 'atualizadoEm'> & { id?: string; secret: string }): Promise<void> {
  assertUnlocked();
  const { secret, id, ...meta } = entry;
  const now = new Date().toISOString();
  const full = { ...meta, id: id || uid(), atualizadoEm: now, secret } as VaultEntry & { secret: string };
  await mudar(() => {
    const idx = cache.findIndex((e) => e.id === full.id);
    if (idx >= 0) cache[idx] = full; else cache.push(full);
  });
}

/** Aplica a mudança e grava; se a gravação falhar (ex.: servidor), desfaz para a tela não mentir. */
async function mudar(fn: () => void): Promise<void> {
  const antes = cache.map((e) => ({ ...e }));
  fn();
  try {
    await persist();
  } catch (e) {
    cache = antes;
    throw e;
  }
}

const ImportSchema = z.array(z.object({
  titulo: z.string().min(1),
  usuario: z.string().default(''),
  url: z.string().default(''),
  notas: z.string().default(''),
  ativoId: z.string().optional(),
  confirmadoEm: z.string().optional(),
  secret: z.string(),
}));

/**
 * Importa credenciais de um arquivo JSON para o cofre destravado. Entrada com o mesmo
 * título é atualizada. O arquivo de origem tem segredos em texto puro: apague-o depois.
 */
export async function importEntries(texto: string): Promise<{ novas: number; atualizadas: number }> {
  assertUnlocked();
  const lista = ImportSchema.parse(JSON.parse(texto));
  let novas = 0;
  let atualizadas = 0;
  const agora = new Date().toISOString();
  // uma gravação só (no modo servidor, um PUT em vez de um por credencial)
  await mudar(() => {
    for (const item of lista) {
      const existente = cache.find((e) => e.titulo === item.titulo);
      if (existente) atualizadas++; else novas++;
      const full = { ...item, ambiente: 'criecomia', id: existente?.id ?? uid(), atualizadoEm: agora } as VaultEntry & { secret: string };
      if (existente) cache[cache.indexOf(existente)] = full; else cache.push(full);
    }
  });
  return { novas, atualizadas };
}

/** Lê o segredo decifrado de uma entrada (só com o cofre destravado). */
export function getSecret(id: string): string {
  assertUnlocked();
  const e = cache.find((x) => x.id === id) as (VaultEntry & { secret?: string }) | undefined;
  return e?.secret ?? '';
}

export async function removeEntry(id: string): Promise<void> {
  assertUnlocked();
  await mudar(() => { cache = cache.filter((e) => e.id !== id); });
}

/** Exporta o blob cifrado para backup (continua inútil sem a senha-mestra). */
export function exportBlob(): string {
  const blob = read<VaultBlob | null>(BLOB_KEY, null);
  return JSON.stringify(blob, null, 2);
}

// Trava ao ocultar a aba (troca de aba, minimizar, fechar) — defesa extra.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && isUnlocked()) lock();
  });
}
