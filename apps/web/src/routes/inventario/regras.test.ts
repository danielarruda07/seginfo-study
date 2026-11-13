import { describe, expect, it } from 'vitest';
import type { Ativo } from '@seginfo/shared';
import { TIPO_ATIVO_LABEL } from '@/theme/status';
import { GRUPOS_TIPO, campoEndereco, contarPorTipo, linhaClasse, noEscopo, ordenarAtivos, validarAtivo } from './regras';

const ativo = (p: Partial<Ativo>): Ativo => ({
  id: p.nome ?? 'x', ambiente: 'criecomia', tipo: 'vm', nome: 'x', endereco: '', funcao: '',
  estado: 'ativo', detalhes: {}, tags: [], labsRelacionados: [], ...p,
});

describe('regras do inventário', () => {
  it('cada tipo de ativo está em exatamente um grupo do filtro', () => {
    const todos = GRUPOS_TIPO.flatMap((g) => g.tipos);
    expect(new Set(todos).size).toBe(todos.length);
    expect([...todos].sort()).toEqual(Object.keys(TIPO_ATIVO_LABEL).sort());
  });

  it('ordena o que pede ação primeiro e depois por nome', () => {
    const r = ordenarAtivos([ativo({ nome: 'b' }), ativo({ nome: 'z', estado: 'critico' }), ativo({ nome: 'a', estado: 'desativado' }), ativo({ nome: 'a' })]);
    expect(r.map((x) => x.nome)).toEqual(['z', 'a', 'b', 'a']);
    expect(r[3].estado).toBe('desativado');
  });

  it('escopo separa em operação de planejados/desativados', () => {
    expect(noEscopo(ativo({ estado: 'critico' }), 'operacao')).toBe(true);
    expect(noEscopo(ativo({ estado: 'planejado' }), 'operacao')).toBe(false);
    expect(noEscopo(ativo({ estado: 'desativado' }), 'fora')).toBe(true);
    expect(noEscopo(ativo({ estado: 'ativo' }), 'todos')).toBe(true);
  });

  it('só crítico e atenção ganham barra na linha', () => {
    expect(linhaClasse(ativo({ estado: 'critico' }))).toBe('iv-row-alert tone-danger');
    expect(linhaClasse(ativo({ estado: 'atencao' }))).toBe('iv-row-alert tone-serious');
    expect(linhaClasse(ativo({ estado: 'ativo' }))).toBe('');
    expect(linhaClasse(ativo({ estado: 'planejado' }))).toBe('');
    expect(linhaClasse(ativo({ estado: 'desativado' }))).toBe('iv-row-muted');
  });

  it('conta por tipo, maior primeiro', () => {
    const r = contarPorTipo([ativo({ tipo: 'vm', nome: 'a' }), ativo({ tipo: 'host', nome: 'b' }), ativo({ tipo: 'vm', nome: 'c' })]);
    expect(r).toEqual([{ tipo: 'vm', total: 2, nomes: ['a', 'c'] }, { tipo: 'host', total: 1, nomes: ['b'] }]);
  });

  it('rótulo do endereço muda com o tipo e usa só exemplos de documentação', () => {
    expect(campoEndereco('vlan').label).toBe('Sub-rede / VLAN ID');
    expect(campoEndereco('host').label).toBe('Endereço IP / hostname');
    for (const t of ['vlan', 'host', 'rota', 'servico', 'storage'] as const) {
      expect(campoEndereco(t).placeholder).not.toMatch(/\b(10|172|192\.168)\.\d+\.\d+/);
    }
  });

  it('valida nome e JSON dos detalhes', () => {
    expect(validarAtivo('', '').erros.nome).toBeTruthy();
    expect(validarAtivo('pve', '{"cpu": 8}')).toEqual({ erros: {}, detalhes: { cpu: '8' } });
    expect(validarAtivo('pve', '[1]').erros.detalhes).toBeTruthy();
    expect(validarAtivo('pve', '{quebrado').erros.detalhes).toBeTruthy();
    expect(validarAtivo('pve', '  ').detalhes).toEqual({});
  });
});
