import { beforeEach, describe, expect, it, vi } from 'vitest';
import { importPurpleExercises, listPurpleExercises, savePurpleExercise, EMPTY_PURPLE_EXERCISE } from './exerciciosPurple';

function mockStorage() {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, key: (i: number) => [...values.keys()][i] ?? null,
    getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, String(v)); }, removeItem: (k: string) => { values.delete(k); } };
}
beforeEach(() => vi.stubGlobal('localStorage', mockStorage()));

describe('importPurpleExercises', () => {
  it('acrescenta exercícios parciais aplicando os padrões e sem apagar os existentes', () => {
    savePurpleExercise({ ...EMPTY_PURPLE_EXERCISE('lab-dvwa'), title: 'já existente', techniques: ['T1190'] });
    const r = importPurpleExercises(JSON.stringify([
      { title: 'Força bruta SSH', techniques: ['T1110'], detection: 'detectado', blueResponse: 'contido' },
    ]));
    expect(r).toEqual({ novos: 1, repetidos: 0 });
    const todos = listPurpleExercises();
    expect(todos).toHaveLength(2);
    const novo = todos.find((e) => e.title === 'Força bruta SSH')!;
    expect(novo.labId).toBe('lab-atomic-cobertura'); // padrão
    expect(novo.detection).toBe('detectado');
    expect(novo.status).toBe('planejado'); // veio do EMPTY, não informado
    expect(novo.id).toBeTruthy();
  });

  it('aceita um único objeto e não duplica o que já tem a mesma assinatura (lab+título+técnicas)', () => {
    const payload = JSON.stringify({ title: 'Scan de portas', techniques: ['t1046', 'T1046'] });
    expect(importPurpleExercises(payload)).toEqual({ novos: 1, repetidos: 0 });
    expect(importPurpleExercises(payload)).toEqual({ novos: 0, repetidos: 1 });
    expect(listPurpleExercises().filter((e) => e.title === 'Scan de portas')).toHaveLength(1);
  });

  it('rejeita item sem título', () => {
    expect(() => importPurpleExercises(JSON.stringify([{ techniques: ['T1110'] }]))).toThrow();
  });
});
