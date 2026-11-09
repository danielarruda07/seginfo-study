import { listKeys, readRaw, writeRaw, removeKey } from './store';

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
  const blob = new Blob([JSON.stringify(buildBackup(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  a.href = url;
  a.download = `seginfo-backup-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
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
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) {
    return invalid(`Versão de backup não suportada (${b.version}).`);
  }
  if (!b.data || typeof b.data !== 'object') {
    return invalid('Backup sem a seção de dados.');
  }
  // cada valor precisa ser string JSON válida
  for (const [k, v] of Object.entries(b.data)) {
    if (typeof v !== 'string') return invalid(`Valor inválido na chave "${k}".`);
    try { JSON.parse(v); } catch { return invalid(`JSON corrompido na chave "${k}".`); }
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

  if (mode === 'replace') {
    for (const key of listKeys()) removeKey(key);
  }
  for (const [key, raw] of Object.entries(b.data)) {
    writeRaw(key, raw);
  }
  return preview;
}
