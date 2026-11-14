import { describe, expect, it } from 'vitest';
import type { EntradaDiario, PostPublicado } from '@seginfo/shared';
import {
  avisoMetricas, briefingDoMarco, falaDoProjeto, marcosAntesDe, primeiraLinha, resumoPublicados, tomChecklist, validarPost,
} from './regras';

const analise = (pilar: string) => ({
  resumo: 'r', pilar, tipoGancho: 'pergunta', temas: [], tags: [], topicoIds: [], trilhaIds: [], aprendizados: [],
  ideiasDerivadas: [], pontosFortes: [], melhorias: [], analisadoEm: '2026-11-01T00:00:00Z', modelo: 'm',
});

const post = (id: string, extra: Partial<PostPublicado> = {}): PostPublicado => ({
  id, url: `https://www.linkedin.com/feed/update/urn:li:share:${id}`, publicadoEm: '2026-11-01', texto: 'Texto do post com tamanho suficiente.',
  formato: 'texto', metricas: {}, origem: 'manual', analise: null, memoriaId: null, ...extra,
});

describe('primeiraLinha', () => {
  it('pula linhas vazias e corta com reticências', () => {
    expect(primeiraLinha('\n\n  Olá mundo  \nresto')).toBe('Olá mundo');
    expect(primeiraLinha('abcdefghij', 5)).toBe('abcd…');
  });
});

describe('resumoPublicados', () => {
  it('conta organizados, cérebro, pendentes e média de engajamento', () => {
    const posts = [
      post('1', { analise: analise('A'), memoriaId: 'x', metricas: { impressoes: 100, reacoes: 10 } }),
      post('2', { metricas: { impressoes: 200, reacoes: 10 } }),
    ];
    const r = resumoPublicados(posts, ['A', 'B']);
    expect(r.analisados).toBe(1);
    expect(r.noCerebro).toBe(1);
    expect(r.pendentes.map((p) => p.id)).toEqual(['2']);
    expect(r.taxaMedia).toBe('7.5');
    expect(r.porPilar).toEqual([['A', 1], ['B', 0]]);
    expect(r.esquecidos).toEqual([]); // menos de 3 organizados: não alarma
  });
  it('aponta pilar esquecido a partir de 3 posts organizados', () => {
    const posts = ['1', '2', '3'].map((id) => post(id, { analise: analise('A') }));
    expect(resumoPublicados(posts, ['A', 'B']).esquecidos).toEqual(['B']);
  });
});

describe('validarPost', () => {
  const base = { url: 'https://www.linkedin.com/posts/abc', publicadoEm: '2026-11-01', formato: 'texto' as const, texto: 'x'.repeat(30), metricas: {} };
  it('exige link do LinkedIn e texto', () => {
    expect(validarPost({ ...base, url: 'https://example.com/x' }, [])).toMatch(/link do post/);
    expect(validarPost({ ...base, texto: 'curto' }, [])).toMatch(/texto do post/);
    expect(validarPost(base, [])).toBeNull();
  });
  it('recusa duplicado, mas não o próprio post em edição', () => {
    const existente = post('9', { url: base.url });
    expect(validarPost(base, [existente])).toMatch(/já está registrado/);
    expect(validarPost({ ...base, id: '9' }, [existente])).toBeNull();
  });
});

describe('avisoMetricas', () => {
  it('pede métricas só depois de alguns dias', () => {
    expect(avisoMetricas({ publicadoEm: '2026-11-10', metricas: {} }, '2026-11-11')).toBeNull();
    expect(avisoMetricas({ publicadoEm: '2026-11-01', metricas: {} }, '2026-11-10')).toMatch(/Sem métricas/);
  });
  it('sugere atualizar métricas colhidas cedo demais', () => {
    const m = { impressoes: 50, atualizadoEm: '2026-11-01' };
    expect(avisoMetricas({ publicadoEm: '2026-11-01', metricas: m }, '2026-11-12')).toMatch(/Vale atualizar/);
    expect(avisoMetricas({ publicadoEm: '2026-11-01', metricas: { ...m, atualizadoEm: '2026-11-08' } }, '2026-11-12')).toBeNull();
  });
});

describe('diário e post', () => {
  const e = (id: string, data: string): EntradaDiario => ({ id, data, titulo: id, descricao: 'd', categoria: 'infra', tags: [] });
  it('reconhece post sobre o projeto', () => {
    expect(falaDoProjeto({ texto: 'Construindo a SegInfo Study', analise: null })).toBe(true);
    expect(falaDoProjeto({ texto: 'Sobre SIEM', analise: null })).toBe(false);
  });
  it('lista marcos dos 30 dias anteriores, mais recentes primeiro', () => {
    const lista = [e('velho', '2026-09-01'), e('a', '2026-10-20'), e('b', '2026-10-30'), e('depois', '2026-11-05')];
    expect(marcosAntesDe(lista, '2026-11-01').map((x) => x.id)).toEqual(['b', 'a']);
  });
  it('monta briefing a partir do marco', () => {
    expect(briefingDoMarco({ titulo: 'Cofre', descricao: 'AES-GCM' })).toContain('"Cofre"');
  });
  it('tom do checklist', () => {
    expect([tomChecklist(7), tomChecklist(4), tomChecklist(2)]).toEqual(['ok', 'warning', 'danger']);
  });
});
