import { describe, expect, it } from 'vitest';
import { breadcrumb, filterNav, findActive, montarSecoes } from './nav';

describe('nav', () => {
  it('monta o breadcrumb seção › tela', () => {
    expect(breadcrumb('/ambiente')).toEqual(['Prática', 'Meu Ambiente']);
    expect(breadcrumb('/')).toEqual(['Visão geral', 'Central de segurança']);
  });

  it('prefere o item de rota mais longa', () => {
    expect(findActive('/agents/base')?.item.label).toBe('Base de conhecimento');
    expect(findActive('/agents')?.item.label).toBe('Meus agentes');
  });

  it('sub-rotas sem item herdam o pai e ganham segmento extra', () => {
    expect(breadcrumb('/agents/agente/x1')).toEqual(['Agents', 'Meus agentes', 'Editor']);
  });

  it('rota desconhecida não gera breadcrumb', () => {
    expect(breadcrumb('/nao-existe')).toEqual([]);
  });

  it('filtra o menu sem acento e mantém a seção inteira quando o título casa', () => {
    expect(filterNav('scanner').flatMap((s) => s.items.map((i) => i.label))).toEqual(['Scanner de endpoints']);
    expect(filterNav('pratica')[0].items).toHaveLength(6);
    expect(filterNav('zzz')).toEqual([]);
  });

  it('com o módulo de estudo desligado, trilhas/tópicos/sessões/metas somem do menu', () => {
    const rotas = filterNav('').flatMap((s) => s.items.map((i) => i.to));
    for (const rota of ['/trilhas', '/topicos', '/sessoes', '/metas']) expect(rotas).not.toContain(rota);
  });

  it('montarSecoes liga e desliga a seção de estudo', () => {
    expect(montarSecoes(true)[0].title).toBe('Estudo');
    expect(montarSecoes(true)[0].items.map((i) => i.to)).toContain('/trilhas');
    expect(montarSecoes(false)[0].title).toBe('Visão geral');
  });
});
