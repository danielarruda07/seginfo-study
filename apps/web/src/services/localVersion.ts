export const NS = 'seginfo:';
export const LOCAL_SCHEMA_VERSION = 2;

/** Marca o formato atual sem reescrever nem descartar os valores locais existentes. */
export function ensureLocalSchemaVersion(): number {
  const key = NS + '_schema-version';
  const current = Number(localStorage.getItem(key) ?? 1);
  if (!Number.isFinite(current) || current < LOCAL_SCHEMA_VERSION) {
    localStorage.setItem(key, String(LOCAL_SCHEMA_VERSION));
    return LOCAL_SCHEMA_VERSION;
  }
  return current;
}
