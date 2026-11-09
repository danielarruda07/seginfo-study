/**
 * Persistência local (MVP). Camada fina sobre localStorage, com namespace.
 * Troque estas funções por chamadas ao `http` quando migrar para o apps/api.
 */
export const NS = 'seginfo:';

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
    return JSON.parse(raw) as T;
  } catch (e) {
    // Não engole a corrupção silenciosamente: registra para a UI avisar.
    lastReadError = { key, message: e instanceof Error ? e.message : String(e) };
    console.error(`[store] JSON corrompido na chave "${key}":`, e);
    return fallback;
  }
}

export function write<T>(key: string, value: T): void {
  localStorage.setItem(NS + key, JSON.stringify(value));
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
  return new Date().toISOString().slice(0, 10);
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
