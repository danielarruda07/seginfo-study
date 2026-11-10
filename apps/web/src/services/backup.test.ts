import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NS } from './store';
import { BACKUP_FORMAT, BACKUP_VERSION, restoreBackup, validateBackup } from './backup';

function mockStorage() {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, key: (i: number) => [...values.keys()][i] ?? null,
    getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, String(v)); }, removeItem: (k: string) => { values.delete(k); } };
}
const file = (data: Record<string, string>) => JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data });

describe('local backup', () => {
  beforeEach(() => vi.stubGlobal('localStorage', mockStorage()));
  it('validates JSON and schema of known collections', () => {
    expect(validateBackup(file({ sessoes: '[]' })).valid).toBe(true);
    expect(validateBackup(file({ sessoes: '[{"id":false}]' })).valid).toBe(false);
    expect(validateBackup('{broken').valid).toBe(false);
  });
  it('merges validated backup data into the SegInfo namespace', () => {
    localStorage.setItem(`${NS}local-only`, '1');
    const result = restoreBackup(file({ metas: '[]' }), 'merge');
    expect(result.valid).toBe(true);
    expect(localStorage.getItem(`${NS}local-only`)).toBe('1');
    expect(localStorage.getItem(`${NS}metas`)).toBe('[]');
  });
});
