import { describe, expect, it } from 'vitest';
import { idadeConfirmacao } from './confirmacao';

const hoje = new Date(2026, 10, 12, 23, 30);

describe('idadeConfirmacao', () => {
  it('sem data pede revisão', () => {
    expect(idadeConfirmacao(undefined, hoje)).toEqual({ texto: 'Não confirmado', rever: true });
    expect(idadeConfirmacao('ontem', hoje).rever).toBe(true);
  });

  it('descreve a idade em dias', () => {
    expect(idadeConfirmacao('2026-11-12', hoje)).toEqual({ texto: '12/11/2026 (hoje)', rever: false });
    expect(idadeConfirmacao('2026-11-11', hoje).texto).toBe('11/11/2026 (há 1 dia)');
    expect(idadeConfirmacao('2026-08-14', hoje)).toEqual({ texto: '14/08/2026 (há 90 dias)', rever: false });
  });

  it('marca como desatualizada depois de 90 dias', () => {
    expect(idadeConfirmacao('2026-08-13', hoje).rever).toBe(true);
  });
});
