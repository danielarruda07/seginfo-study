import { describe, expect, it } from 'vitest';
import { combinarMitre, ordemDeEventos, ORDENS_EVENTOS } from './radar.js';
import { escopoDoIp } from './radarEscopo.js';

describe('combinarMitre', () => {
  it('soma técnicas do coletor com as mapeadas por ação nos eventos sem técnica', () => {
    const r = combinarMitre(
      [{ id: 'T1110.001', nome: 'Password Guessing', eventos: 5 }, { id: 'T1059', nome: 'Command and Scripting Interpreter', eventos: 2 }],
      [{ acao: 'comando', total: 3 }, { acao: 'conexao', total: 900 }, { acao: 'download', total: 1 }],
    );
    expect(r).toEqual([
      { id: 'T1059', nome: 'Command and Scripting Interpreter', eventos: 5 },
      { id: 'T1110.001', nome: 'Password Guessing', eventos: 5 },
      { id: 'T1105', nome: 'Ingress Tool Transfer', eventos: 1 },
    ]);
  });

  it('ação sem técnica conhecida (conexao, bloqueio) não vira técnica', () => {
    expect(combinarMitre([], [{ acao: 'conexao', total: 10 }, { acao: 'bloqueio', total: 4 }])).toEqual([]);
  });

  it('reflexão UDP e túnel SSH têm técnica própria', () => {
    expect(combinarMitre([], [{ acao: 'reflexao', total: 2 }, { acao: 'tunel', total: 1 }]).map((t) => t.id)).toEqual(['T1498.002', 'T1090']);
  });
});

describe('escopoDoIp', () => {
  it('IP público é internet', () => {
    expect(escopoDoIp('203.0.113.10')).toBe('internet');
    expect(escopoDoIp('8.8.8.8')).toBe('internet');
    expect(escopoDoIp('2001:db8::1')).toBe('internet');
  });

  it('redes privadas, reservadas e sem IP são internas', () => {
    for (const ip of ['10.10.81.10', '172.20.1.1', '192.168.50.125', '127.0.0.1', '169.254.1.1', '100.64.0.1', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.5']) {
      expect(escopoDoIp(ip), ip).toBe('interno');
    }
    expect(escopoDoIp(null)).toBe('interno');
    expect(escopoDoIp('lixo')).toBe('interno');
  });

  it('172.32.x e 192.169.x ficam fora das faixas privadas', () => {
    expect(escopoDoIp('172.32.0.1')).toBe('internet');
    expect(escopoDoIp('192.169.0.1')).toBe('internet');
  });
});

describe('ordenação da tabela de eventos', () => {
  it('ordena pela coluna escolhida e desempata pelo mais recente', () => {
    expect(ordemDeEventos('ipOrigem', 'asc')).toEqual([{ ipOrigem: 'asc' }, { ocorridoEm: 'desc' }]);
    expect(ordemDeEventos('acao', 'desc')).toEqual([{ acao: 'desc' }, { ocorridoEm: 'desc' }]);
  });

  it('quando a coluna é a data, ordena só pela data', () => {
    expect(ordemDeEventos('ocorridoEm', 'asc')).toEqual([{ ocorridoEm: 'asc' }]);
  });

  it('aceita só as colunas da lista (nada de texto livre vai para o banco)', () => {
    expect(ORDENS_EVENTOS).toContain('ocorridoEm');
    expect(ORDENS_EVENTOS).not.toContain('detalhes');
  });
});
