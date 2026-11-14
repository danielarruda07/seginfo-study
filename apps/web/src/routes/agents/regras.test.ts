import { describe, expect, it } from 'vitest';
import { agenteConfigVazio } from '@seginfo/shared';
import type { AcaoAuditoria, RuntimeInfo } from '@/services/agentes';
import { agentesQueUsam, comIds, duracao, filtrarFerramentas, formatarJson, noServidor, placar, resumoPilares, truncar } from './regras';

describe('formatação', () => {
  it('duração em ms, s e min', () => {
    expect(duracao(850)).toBe('850 ms');
    expect(duracao(1234)).toBe('1,2 s');
    expect(duracao(125_000)).toBe('2 min 5 s');
    expect(duracao(120_000)).toBe('2 min');
    expect(duracao(-1)).toBe('—');
  });

  it('JSON indentado, inclusive quando chega como texto', () => {
    expect(formatarJson({ a: 1 })).toBe('{\n  "a": 1\n}');
    expect(formatarJson('{"a":1}')).toBe('{\n  "a": 1\n}');
    expect(formatarJson('texto puro')).toBe('texto puro');
    expect(formatarJson('{quebrado')).toBe('{quebrado');
  });

  it('truncar junta espaços e corta com reticências', () => {
    expect(truncar('a  b\nc', 10)).toBe('a b c');
    expect(truncar('abcdefghij', 5)).toBe('abcd…');
  });
});

describe('placar das avaliações', () => {
  it('conta resultados, taxa e latência média só de quem informou', () => {
    const p = placar([
      { resultado: 'ok', latenciaMs: 100 }, { resultado: 'ok', latenciaMs: null },
      { resultado: 'falha', latenciaMs: 300 }, { resultado: 'parcial', latenciaMs: null },
    ]);
    expect(p).toMatchObject({ total: 4, ok: 2, falha: 1, parcial: 1, pct: 50, latMedia: 200, comLatencia: 2 });
    expect(placar([]).pct).toBeNull();
  });
});

describe('resumo dos 8 pilares', () => {
  it('agente vazio: falta propósito, instruções e modelo; ferramentas ok', () => {
    const r = resumoPilares(agenteConfigVazio());
    expect(r).toHaveLength(8);
    expect(r.filter((p) => !p.ok).map((p) => p.numero)).toEqual([1, 2, 3, 6]);
    expect(r[3].texto).toBe('Nenhuma (só conversa)');
  });

  it('escrita sem aprovação derruba os pilares 4 e 8', () => {
    const c = agenteConfigVazio();
    c.ferramentas = [{ id: 'x', nome: 'X', permissao: 'escrita', exigeAprovacao: false, observacao: '' }];
    const r = resumoPilares(c);
    expect(r[3]).toMatchObject({ ok: false, texto: '0 de leitura, 1 de escrita (1 sem aprovação)' });
    expect(r[7].ok).toBe(false);
  });
});

describe('ferramentas no servidor e uso', () => {
  const rt: RuntimeInfo['ferramentas'] = [
    { id: 'a', nome: 'a1', permissao: 'leitura', descricao: '', faltando: [] },
    { id: 'b', nome: 'b1', permissao: 'escrita', descricao: '', faltando: ['TOKEN_X'] },
    { id: 'b', nome: 'b2', permissao: 'leitura', descricao: '', faltando: ['TOKEN_X'] },
  ];
  it('pronta, falta configuração ou só no projeto', () => {
    expect(noServidor(rt, 'a').estado).toBe('pronta');
    expect(noServidor(rt, 'b')).toMatchObject({ estado: 'falta-config', faltando: ['TOKEN_X'] });
    expect(noServidor(rt, 'c').estado).toBe('so-projeto');
    expect(noServidor(undefined, 'a').estado).toBe('so-projeto');
  });

  it('lista os agentes que ligaram a ferramenta', () => {
    const c = agenteConfigVazio();
    c.ferramentas = [{ id: 'a', nome: 'A', permissao: 'leitura', exigeAprovacao: false, observacao: '' }];
    const uso = agentesQueUsam([{ id: '1', nome: 'Um', config: c }, { id: '2', nome: 'Dois', config: agenteConfigVazio() }], 'a');
    expect(uso).toEqual([{ agenteId: '1', agenteNome: 'Um', permissao: 'leitura', exigeAprovacao: false }]);
  });
});

describe('ids da auditoria', () => {
  it('numera as ações dentro de cada execução', () => {
    const base = { agenteId: 'g', agenteNome: 'G', ferramenta: 'f', entrada: {}, saida: '', erro: false, decisao: 'automatica' as const, decididoEm: null, ms: 1 };
    const acoes: AcaoAuditoria[] = [{ ...base, execucaoId: 'e1' }, { ...base, execucaoId: 'e2' }, { ...base, execucaoId: 'e1' }];
    expect(comIds(acoes).map((a) => a.id)).toEqual(['e1#0', 'e2#0', 'e1#1']);
  });
});

describe('filtro do catálogo de ferramentas', () => {
  const cat = [
    { id: 'a', nome: 'Busca na base', categoria: 'dados', descricao: 'Recupera notas', risco: 'baixo', permissaoSugerida: 'leitura', aprovacaoSugerida: false, cuidados: '' },
    { id: 'b', nome: 'Executar comando', categoria: 'infra', descricao: 'Shell', risco: 'alto', permissaoSugerida: 'escrita', aprovacaoSugerida: true, cuidados: 'Nunca como root' },
  ] as const;
  const lista = [...cat] as unknown as Parameters<typeof filtrarFerramentas>[0];
  const rt: RuntimeInfo['ferramentas'] = [{ id: 'b', nome: 'b', permissao: 'escrita', descricao: '', faltando: ['X'] }];
  it('combina categoria, risco, busca sem acento e falta de configuração', () => {
    expect(filtrarFerramentas(lista, { busca: '' }).length).toBe(2);
    expect(filtrarFerramentas(lista, { busca: 'ROOT' }).map((x) => x.id)).toEqual(['b']);
    expect(filtrarFerramentas(lista, { busca: 'notás' }).map((x) => x.id)).toEqual(['a']);
    expect(filtrarFerramentas(lista, { busca: '', risco: 'baixo', categoria: 'dados' }).map((x) => x.id)).toEqual(['a']);
    expect(filtrarFerramentas(lista, { busca: '', faltaConfig: true }, rt).map((x) => x.id)).toEqual(['b']);
  });
});
