import { z } from 'zod';
import { LOCAL_SCHEMA_VERSION, NS } from './localVersion';

/**
 * Persistência local (MVP). Camada fina sobre localStorage, com namespace.
 * Troque estas funções por chamadas ao `http` quando migrar para o apps/api.
 */
export { LOCAL_SCHEMA_VERSION, NS };

const SCHEMAS: Record<string, { safeParse: (value: unknown) => { success: boolean; data?: unknown; error?: unknown } }> = {};
export function registerSchema(key: string, schema: (typeof SCHEMAS)[string]) { SCHEMAS[key] = schema; }
registerSchema('_schema-version', { safeParse: (v) => z.number().int().min(1).max(LOCAL_SCHEMA_VERSION).safeParse(v) });
registerSchema('inventario:seed-version', { safeParse: (v) => z.number().int().nonnegative().safeParse(v) });
registerSchema('study:weekly-target', { safeParse: (v) => z.number().int().min(0).max(80).safeParse(v) });
export function validateStoredValue(key: string, value: unknown): { success: boolean; error?: unknown } {
  const schema = SCHEMAS[key];
  if (!schema) return { success: true };
  const result = schema.safeParse(value);
  return { success: result.success, error: result.success ? undefined : result.error };
}

/** Guarda a última chave cuja leitura falhou por JSON corrompido (sugestão 3). */
let lastReadError: { key: string; message: string } | null = null;

export function getLastReadError() {
  return lastReadError;
}
export function clearReadError() {
  lastReadError = null;
}

export function read<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(NS + key);
  if (raw === null) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (SCHEMAS[key]) {
      const result = SCHEMAS[key].safeParse(parsed);
      if (!result.success) {
        lastReadError = { key, message: String(result.error ?? 'formato inválido') };
        console.error(`[store] Formato inválido na chave "${key}"; os dados originais foram preservados.`);
        return fallback;
      }
      return result.data as T;
    }
    return parsed as T;
  } catch (e) {
    // Não engole a corrupção silenciosamente: registra para a UI avisar.
    lastReadError = { key, message: e instanceof Error ? e.message : String(e) };
    console.error(`[store] JSON corrompido na chave "${key}":`, e);
    return fallback;
  }
}

export function write<T>(key: string, value: T): void {
  if (lastReadError?.key === key) {
    const original = localStorage.getItem(NS + key);
    if (original !== null) localStorage.setItem(NS + `recovery:${key}:${Date.now()}`, original);
    lastReadError = null;
  }
  localStorage.setItem(NS + key, JSON.stringify(value));
  if (key !== '_schema-version') localStorage.setItem(NS + '_schema-version', String(LOCAL_SCHEMA_VERSION));
}

/** Todas as chaves do namespace, sem o prefixo. */
export function listKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(NS)) keys.push(k.slice(NS.length));
  }
  return keys;
}

/** Valor bruto (string) de uma chave — usado no backup sem reparsear. */
export function readRaw(key: string): string | null {
  return localStorage.getItem(NS + key);
}

export function writeRaw(key: string, raw: string): void {
  localStorage.setItem(NS + key, raw);
}

export function removeKey(key: string): void {
  localStorage.removeItem(NS + key);
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Data de hoje no formato YYYY-MM-DD. */
export function todayISO(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** Resultado paginado padrão das listagens. */
export interface Page<T> {
  items: T[];
  total: number;
}

/** Fatia uma lista já filtrada na página pedida (paginação "no servidor"). */
export function paginate<T>(items: T[], page = 0, rows = 10): Page<T> {
  const start = page * rows;
  return { items: items.slice(start, start + rows), total: items.length };
}

/** Busca case-insensitive: true se algum campo contém o termo. */
export function matchesSearch(term: string, ...fields: (string | string[])[]): boolean {
  return fields.some((f) =>
    Array.isArray(f) ? f.some((x) => x.toLowerCase().includes(term)) : f.toLowerCase().includes(term),
  );
}

/** CRUD genérico de uma lista de registros `{ id }` guardada em uma chave. */
export function collection<T extends { id: string }>(key: string) {
  const all = () => read<T[]>(key, []);
  const save = (items: T[]) => write(key, items);
  return {
    all,
    add(item: Omit<T, 'id'>): T {
      const novo = { ...item, id: uid() } as T;
      save([...all(), novo]);
      return novo;
    },
    update(id: string, fn: (item: T) => T): void {
      save(all().map((x) => (x.id === id ? fn(x) : x)));
    },
    remove(id: string): void {
      save(all().filter((x) => x.id !== id));
    },
  };
}
