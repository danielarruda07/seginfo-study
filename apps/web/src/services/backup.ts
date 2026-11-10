import { listKeys, readRaw, writeRaw, removeKey, NS, validateStoredValue } from './store';
import { ensureLocalSchemaVersion } from './localVersion';
// Registra os schemas locais antes da validação de um arquivo, mesmo que as telas não tenham sido abertas.
import './catalog';
import './sessoes';
import './inventario';
import './arsenal';
import './biblioteca';
import './vault';

/**
 * Backup e restauração dos dados locais (sugestão 1).
 *
 * Segurança:
 * - Exporta os valores BRUTOS do namespace `seginfo:`. O cofre é persistido como
 *   `vault:blob` já cifrado (AES-GCM), então entra no backup como ciphertext.
 * - NUNCA exporta segredos em texto puro: as entradas decifradas do cofre vivem
 *   só em memória e não são tocadas aqui.
 */

export const BACKUP_FORMAT = 'seginfo-backup';
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 25 * 1024 * 1024;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  /** chave (sem prefixo) -> valor bruto (string JSON) */
  data: Record<string, string>;
}

/** Monta o objeto de backup com todas as chaves do namespace. */
export function buildBackup(): BackupFile {
  const data: Record<string, string> = {};
  for (const key of listKeys()) {
    const raw = readRaw(key);
    if (raw !== null) data[key] = raw;
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data };
}

/** Dispara o download de um arquivo .json com o backup. */
export function downloadBackup(): void {
  const content = JSON.stringify(buildBackup(), null, 2);
  if (new Blob([content]).size > MAX_BACKUP_BYTES) throw new Error('Backup maior que o limite de 25 MB.');
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  a.href = url;
  a.download = `seginfo-backup-${stamp}.json`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export interface BackupPreview {
  valid: boolean;
  error?: string;
  version?: number;
  exportedAt?: string;
  keys: string[];
  hasVault: boolean;
}

function invalid(error: string): BackupPreview {
  return { valid: false, error, keys: [], hasVault: false };
}

/** Valida o conteúdo de um arquivo de backup e descreve o que ele contém. */
export function validateBackup(text: string): BackupPreview {
  if (new Blob([text]).size > MAX_BACKUP_BYTES) return invalid('O arquivo excede o limite de 25 MB.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return invalid('Arquivo não é um JSON válido.');
  }
  const b = parsed as Partial<BackupFile>;
  if (b.format !== BACKUP_FORMAT) {
    return invalid('Este arquivo não é um backup do SegInfo Study.');
  }
  if (b.version !== BACKUP_VERSION) {
    return invalid(`Versão de backup não suportada (${b.version}).`);
  }
  if (!b.data || typeof b.data !== 'object' || Array.isArray(b.data)) {
    return invalid('Backup sem a seção de dados.');
  }
  // cada valor precisa ser string JSON válida
  for (const [k, v] of Object.entries(b.data)) {
    if (!k || k.length > 120 || k.startsWith(NS)) return invalid(`Nome de chave inválido: "${k.slice(0, 40)}".`);
    if (typeof v !== 'string') return invalid(`Valor inválido na chave "${k}".`);
    let parsedValue: unknown;
    try { parsedValue = JSON.parse(v); } catch { return invalid(`JSON corrompido na chave "${k}".`); }
    const check = validateStoredValue(k, parsedValue);
    if (!check.success) return invalid(`Formato inválido na chave "${k}". Os dados do arquivo foram preservados; restaure uma exportação compatível.`);
  }
  const keys = Object.keys(b.data);
  return { valid: true, version: b.version, exportedAt: b.exportedAt, keys, hasVault: keys.includes('vault:blob') };
}

/**
 * Restaura um backup já validado. `mode`:
 * - 'replace': limpa o namespace e grava só o que vem no backup.
 * - 'merge': mantém chaves atuais e sobrescreve apenas as que vierem no backup.
 */
export function restoreBackup(text: string, mode: 'replace' | 'merge' = 'replace'): BackupPreview {
  const preview = validateBackup(text);
  if (!preview.valid) return preview;
  const b = JSON.parse(text) as BackupFile;

  const before: Record<string, string> = {};
  for (const key of listKeys()) {
    const raw = readRaw(key);
    if (raw !== null) before[key] = raw;
  }
  try {
    if (mode === 'replace') {
      for (const key of listKeys()) removeKey(key);
    }
    for (const [key, raw] of Object.entries(b.data)) writeRaw(key, raw);
  } catch {
    // Se faltar espaço, tenta restaurar o estado anterior em vez de deixar uma
    // importação pela metade no navegador.
    try {
      for (const key of listKeys()) removeKey(key);
      for (const [key, raw] of Object.entries(before)) writeRaw(key, raw);
    } catch { /* recuperação best-effort: armazenamento indisponível */ }
    return invalid('Não foi possível restaurar: armazenamento local cheio ou indisponível. Os dados anteriores foram preservados quando possível.');
  }
  ensureLocalSchemaVersion();
  return preview;
}
