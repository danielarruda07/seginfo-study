import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NS } from './store';
import { agendarRevisao, getRevisoes, setStatus, resumoGeral } from './catalog';

function mockStorage() {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, key: (i: number) => [...values.keys()][i] ?? null,
    getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, String(v)); }, removeItem: (k: string) => { values.delete(k); } };
}

describe('study catalog progress', () => {
  beforeEach(() => { vi.stubGlobal('localStorage', mockStorage()); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-10T12:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  it('schedules increasingly spaced review dates', () => {
    expect(agendarRevisao('fund-cia').revisarEm).toBe('2026-11-11');
    expect(agendarRevisao('fund-cia').revisarEm).toBe('2026-11-13');
    expect(getRevisoes()['fund-cia'].intervalo).toBe(1);
  });
  it('updates topic completion totals', () => {
    const before = resumoGeral();
    setStatus('fund-cia', 'concluido');
    const after = resumoGeral();
    expect(after.concluidos).toBe(before.concluidos + 1);
    expect(localStorage.getItem(`${NS}status`)).toContain('fund-cia');
  });
});
