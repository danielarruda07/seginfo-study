import type { VaultEntry, VaultBlob } from '@seginfo/shared';
import { deriveKey, encryptJSON, decryptJSON, randomBytes, fromB64, type Bytes } from './crypto';
import { read, write, uid } from './store';

/**
 * Cofre cifrado. O estado em disco é apenas um VaultBlob (ciphertext).
 * A chave derivada e as entradas decifradas vivem SÓ em memória, enquanto a
 * sessão estiver "destravada". Travar = descartar a chave da memória.
 */

const BLOB_KEY = 'vault:blob';
const TIMEOUT_KEY = 'vault:autolock-min'; // minutos de inatividade (config do usuário)
const DEFAULT_TIMEOUT_MIN = 5;

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
  const blob = read<VaultBlob | null>(BLOB_KEY, null);
  if (!blob) return false;
  const salt = fromB64(blob.salt);
  const key = await deriveKey(masterPassword, salt);
  try {
    const entries = await decryptJSON<VaultEntry[]>(blob, key);
    sessionKey = key;
    sessionSalt = salt;
    cache = entries;
    resetIdleTimer();
    return true;
  } catch {
    // tag GCM inválida => senha errada
    return false;
  }
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
