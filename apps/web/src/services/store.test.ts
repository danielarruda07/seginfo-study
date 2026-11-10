import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { clearReadError, getLastReadError, NS, read, registerSchema, write } from './store';

function mockStorage() {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    key: (i: number) => [...values.keys()][i] ?? null,
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => { values.set(k, String(v)); },
    removeItem: (k: string) => { values.delete(k); },
    clear: () => values.clear(),
  };
}

describe('local store', () => {
  beforeEach(() => { vi.stubGlobal('localStorage', mockStorage()); clearReadError(); });
  afterEach(() => vi.unstubAllGlobals());

  it('serializes and reads namespaced values', () => {
    write('test', { value: 42 });
    expect(localStorage.getItem(`${NS}test`)).toBe('{"value":42}');
    expect(read('test', { value: 0 })).toEqual({ value: 42 });
  });

  it('reports malformed JSON and preserves it before a later write', () => {
    localStorage.setItem(`${NS}broken`, '{invalid');
    expect(read('broken', [])).toEqual([]);
    expect(getLastReadError()?.key).toBe('broken');
    write('broken', ['recovered']);
    expect(read('broken', [])).toEqual(['recovered']);
    expect([...Array(localStorage.length)].some((_, i) => localStorage.key(i)?.startsWith(`${NS}recovery:broken:`))).toBe(true);
  });

  it('rejects records that do not match the registered schema', () => {
    registerSchema('validated', { safeParse: (v) => z.array(z.object({ id: z.string() })).safeParse(v) });
    localStorage.setItem(`${NS}validated`, '[{"id":1}]');
    expect(read('validated', [])).toEqual([]);
    expect(getLastReadError()?.key).toBe('validated');
    expect(localStorage.getItem(`${NS}validated`)).toBe('[{"id":1}]');
  });
});
