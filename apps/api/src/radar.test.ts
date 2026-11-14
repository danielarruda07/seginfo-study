import { describe, expect, it } from 'vitest';
import { tecnicasDoEvento } from './radar.js';

describe('tecnicasDoEvento', () => {
  it('usa as técnicas que vieram do coletor (regra do Wazuh)', () => {
    const t = tecnicasDoEvento('outro', { mitre: [{ id: 'T1110.001', nome: 'Password Guessing' }, { id: 'T1078', nome: 'Valid Accounts' }] });
    expect(t.map((m) => m.id)).toEqual(['T1110.001', 'T1078']);
  });

  it('cai no mapeamento fixo por ação quando não há mitre em detalhes', () => {
    expect(tecnicasDoEvento('login_falha', {})).toEqual([{ id: 'T1110', nome: 'Brute Force' }]);
    expect(tecnicasDoEvento('download', null)).toEqual([{ id: 'T1105', nome: 'Ingress Tool Transfer' }]);
    expect(tecnicasDoEvento('reflexao', {})[0].id).toBe('T1498.002');
    expect(tecnicasDoEvento('conexao', {})).toEqual([]);
  });

  it('ignora entradas malformadas e, se nada sobrar, usa o mapeamento fixo', () => {
    expect(tecnicasDoEvento('comando', { mitre: [{ id: 'xyz', nome: 'x' }, 'T1059'] })).toEqual([
      { id: 'T1059', nome: 'Command and Scripting Interpreter' },
    ]);
    expect(tecnicasDoEvento('comando', { mitre: 'T1059' })[0].id).toBe('T1059');
  });
});
