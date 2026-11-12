import { describe, expect, it } from 'vitest';
import { breadcrumb, filterNav, findActive, secoesAbertas } from './nav';

describe('nav', () => {
  it('monta o breadcrumb seção › tela', () => {
    expect(breadcrumb('/ambiente')).toEqual(['Prática', 'Meu Ambiente']);
    expect(breadcrumb('/')).toEqual(['Estudo', 'Painel']);
  });

  it('prefere o item de rota mais longa', () => {
    expect(findActive('/agents/base')?.item.label).toBe('Base de conhecimento');
    expect(findActive('/agents')?.item.label).toBe('Meus agentes');
  });

  it('sub-rotas sem item herdam o pai e ganham segmento extra', () => {
    expect(breadcrumb('/trilhas/abc')).toEqual(['Estudo', 'Trilhas', 'Tópicos da trilha']);
    expect(breadcrumb('/agents/agente/x1')).toEqual(['Agents', 'Meus agentes', 'Editor']);
  });

  it('rota desconhecida não gera breadcrumb', () => {
    expect(breadcrumb('/nao-existe')).toEqual([]);
  });

  it('filtra o menu sem acento e mantém a seção inteira quando o título casa', () => {
    expect(filterNav('topicos').flatMap((s) => s.items.map((i) => i.label))).toEqual(['Tópicos']);
    expect(filterNav('pratica')[0].items).toHaveLength(4);
    expect(filterNav('zzz')).toEqual([]);
  });
});

describe('secoesAbertas', () => {
  it('abre a seção da tela atual além das salvas', () => {
    expect(secoesAbertas(['Estudo'], '/ambiente')).toEqual(['Estudo', 'Prática']);
    expect(secoesAbertas(['Prática'], '/ambiente')).toEqual(['Prática']);
  });
  it('ignora valor salvo inválido ou seção que não existe mais', () => {
    expect(secoesAbertas('lixo', '/')).toEqual(['Estudo']);
    expect(secoesAbertas(['Antiga', 3], '/radar')).toEqual(['Inteligência']);
    expect(secoesAbertas(null, '/nao-existe')).toEqual([]);
  });
});
