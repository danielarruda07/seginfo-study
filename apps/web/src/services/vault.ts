import { VaultBlobSchema, type VaultEntry, type VaultBlob } from '@seginfo/shared';
import { deriveKey, encryptJSON, decryptJSON, randomBytes, fromB64, type Bytes } from './crypto';
import { read, write, removeKey, uid, registerSchema } from './store';
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

export function isInitialized(): boolean {
  return read<VaultBlob | null>(BLOB_KEY, null) !== null;
}

export function isUnlocked(): boolean {
  return sessionKey !== null;
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

/** Destrava um cofre existente. Retorna false se a senha estiver errada. */
export async function unlock(masterPassword: string): Promise<boolean> {
  const waitMs = unlockWaitSeconds() * 1000;
  if (waitMs > 0) { await new Promise((resolve) => setTimeout(resolve, waitMs)); }
  const blob = read<VaultBlob | null>(BLOB_KEY, null);
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
  const idx = cache.findIndex((e) => e.id === full.id);
  if (idx >= 0) cache[idx] = full; else cache.push(full);
  await persist();
}

/** Lê o segredo decifrado de uma entrada (só com o cofre destravado). */
export function getSecret(id: string): string {
  assertUnlocked();
  const e = cache.find((x) => x.id === id) as (VaultEntry & { secret?: string }) | undefined;
  return e?.secret ?? '';
}

export async function removeEntry(id: string): Promise<void> {
  assertUnlocked();
  cache = cache.filter((e) => e.id !== id);
  await persist();
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
